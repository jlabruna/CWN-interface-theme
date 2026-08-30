const MODULE_ID = "cwn-interface-theme";
export const PILOT_LINK_FLAG = "pilotInventoryLink";
export const DRONE_ITEM_LINK_FLAG = "dronePilotLink";

function linkedItemSource(drone) {
  return {
    name: drone.name,
    type: "item",
    img: "systems/swnr/assets/icons/drone.png",
    system: {
      encumbrance: drone.system?.enc,
      quantity: 1,
      cost: drone.system?.cost,
    },
    flags: {
      [MODULE_ID]: {
        [DRONE_ITEM_LINK_FLAG]: {
          droneId: drone.id,
          droneUuid: drone.uuid ?? `Actor.${drone.id}`,
        },
      },
    },
  };
}

function taggedInventoryItem(pilot, drone, itemId = "") {
  return Array.from(pilot?.items ?? []).find((item) => {
    if (itemId && String(item.id) !== String(itemId)) return false;
    const link = item?.flags?.[MODULE_ID]?.[DRONE_ITEM_LINK_FLAG];
    return String(link?.droneId ?? "") === String(drone?.id ?? "")
      && (!link?.droneUuid || String(link.droneUuid) === String(drone?.uuid ?? `Actor.${drone?.id}`));
  }) ?? null;
}

export function openApplicationsForActor(actor, runtime = globalThis) {
  const applications = [
    ...Array.from(runtime.foundry?.applications?.instances?.values?.() ?? []),
    ...Object.values(runtime.ui?.windows ?? {}),
  ];
  const matched = [...new Set(applications)].filter((application) => {
    const document = application?.actor ?? application?.document;
    return document && String(document.id) === String(actor?.id);
  });
  if (actor?.sheet?.rendered && !matched.includes(actor.sheet)) matched.push(actor.sheet);
  return matched;
}

export async function renderActorDependents(actor, runtime = globalThis) {
  const applications = openApplicationsForActor(actor, runtime);
  await Promise.allSettled(applications.map((application) => application.render?.({ parts: ["cyberware"] })));
  return applications.length;
}

async function clearStoredLink(drone) {
  if (typeof drone?.unsetFlag === "function") await drone.unsetFlag(MODULE_ID, PILOT_LINK_FLAG);
  else await drone?.update?.({ [`flags.${MODULE_ID}.-=${PILOT_LINK_FLAG}`]: null });
}

async function removeProvenancedInventoryItem(drone, pilot) {
  const relation = drone?.flags?.[MODULE_ID]?.[PILOT_LINK_FLAG] ?? {};
  if (String(relation.pilotId ?? "") !== String(pilot?.id ?? "")) return false;
  const item = taggedInventoryItem(pilot, drone, relation.itemId);
  if (!item?.id || typeof pilot?.deleteEmbeddedDocuments !== "function") return false;
  await pilot.deleteEmbeddedDocuments("Item", [item.id]);
  return true;
}

export async function unlinkDronePilot(drone, {
  actors = globalThis.game?.actors,
  runtime = globalThis,
} = {}) {
  const oldPilotId = String(drone?.system?.crewMembers?.[0] ?? "");
  const oldPilot = oldPilotId ? actors?.get?.(oldPilotId) ?? null : null;
  if (oldPilotId) {
    await drone.update({ "system.crew.current": 1, "system.crewMembers": [] });
  }
  const removedInventoryItem = oldPilot ? await removeProvenancedInventoryItem(drone, oldPilot) : false;
  await clearStoredLink(drone);
  if (oldPilot) await renderActorDependents(oldPilot, runtime);
  return { changed: Boolean(oldPilotId), oldPilot, removedInventoryItem };
}

export async function linkDronePilot(drone, pilot, {
  actors = globalThis.game?.actors,
  runtime = globalThis,
} = {}) {
  if (drone?.type !== "drone") throw new Error("Only Drone Actors can use a pilot link.");
  if (pilot?.type !== "character" && pilot?.type !== "npc") throw new Error("Only Character or NPC Actors can pilot a Drone.");

  const currentPilotId = String(drone.system?.crewMembers?.[0] ?? "");
  const relation = drone.flags?.[MODULE_ID]?.[PILOT_LINK_FLAG] ?? {};
  const existing = currentPilotId === String(pilot.id)
    ? taggedInventoryItem(pilot, drone, relation.itemId)
    : null;
  if (existing) {
    await renderActorDependents(pilot, runtime);
    return { changed: false, pilot, item: existing, repairedInventory: false };
  }

  if (currentPilotId && currentPilotId !== String(pilot.id)) {
    await unlinkDronePilot(drone, { actors, runtime });
  }
  if (String(drone.system?.crewMembers?.[0] ?? "") !== String(pilot.id)) {
    await drone.update({ "system.crew.current": 1, "system.crewMembers": [pilot.id] });
  }

  const [item] = await pilot.createEmbeddedDocuments("Item", [linkedItemSource(drone)], {});
  const stored = { pilotId: pilot.id, itemId: item?.id ?? "", itemUuid: item?.uuid ?? "" };
  if (typeof drone.setFlag === "function") await drone.setFlag(MODULE_ID, PILOT_LINK_FLAG, stored);
  else await drone.update({ [`flags.${MODULE_ID}.${PILOT_LINK_FLAG}`]: stored });
  await renderActorDependents(pilot, runtime);
  return { changed: true, pilot, item, repairedInventory: currentPilotId === String(pilot.id) };
}
