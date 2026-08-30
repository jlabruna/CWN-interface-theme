export const MODULE_ID = "cwn-interface-theme";

const NATIVE_PARTIALS = [
  "systems/swnr/templates/actor/fragments/items-list.hbs",
  "systems/swnr/templates/actor/fragments/consumable-list.hbs",
  "systems/swnr/templates/actor/fragments/cyberware-list.hbs",
];

let missingBaseWarningQueued = false;

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sortDocuments(documents = []) {
  return Array.from(documents).sort((left, right) =>
    number(left.sort) - number(right.sort) || String(left.name).localeCompare(String(right.name)),
  );
}

export function flattenPowers(powers = {}) {
  return Object.entries(powers).flatMap(([subType, levels]) =>
    Object.entries(levels ?? {}).flatMap(([level, items]) =>
      Array.from(items ?? []).map((item) => ({ item, subType, level })),
    ),
  );
}

function humanize(value) {
  return String(value ?? "")
    .trim()
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}

function usefulClassification(value) {
  if (value && typeof value === "object") {
    value = value.name ?? value.label ?? value.type ?? value.weaponType ?? value.baseWeapon;
  }
  const text = String(value ?? "").trim();
  return text && !/^(?:none|unassigned|null|undefined)$/iu.test(text) ? humanize(text) : "";
}

export function weaponClassification(item) {
  const harbourFlags = item?.flags?.["harbour-city-stories"] ?? {};
  const baseWeapon = usefulClassification(harbourFlags.baseWeapon);
  if (baseWeapon) return baseWeapon;

  for (const candidate of [
    harbourFlags.weaponFamily,
    item?.system?.weaponFamily,
    item?.system?.family,
    item?.flags?.swnr?.weaponFamily,
  ]) {
    const family = usefulClassification(candidate);
    if (family) return family;
  }
  return item?.system?.isMelee ? "Melee Weapon" : "Ranged Weapon";
}

export function prepareWeapon(item, actor) {
  const system = item.system ?? {};
  const ammo = system.ammo ?? {};
  const shock = system.shock ?? {};
  const trauma = system.trauma ?? {};
  const isMelee = Boolean(system.isMelee);
  return {
    item,
    mode: isMelee ? "Melee" : "Ranged",
    classification: weaponClassification(item),
    actorAttackBonus: number(isMelee ? actor.system?.meleeAb : actor.system?.ab),
    weaponAttackBonus: number(system.ab),
    damage: system.damage || "—",
    ammo: ammo.type && ammo.type !== "none" ? `${number(ammo.value)}/${number(ammo.max)}` : "—",
    canReload: Boolean(ammo.type && ammo.type !== "none"),
    shock: number(shock.dmg) ? `${shock.dmg} / AC ${shock.ac}` : "—",
    trauma: trauma.die ? `${trauma.die} ×${number(trauma.rating, 1)}` : "—",
    range: isMelee ? "Melee" : `${number(system.range?.normal)} / ${number(system.range?.max)}`,
  };
}

export function resolveSwnrActorSheet(runtime = globalThis) {
  return runtime.swnr?.applications?.SWNActorSheet ?? null;
}

export function queueMissingBaseWarning(runtime = globalThis) {
  if (missingBaseWarningQueued) return;
  missingBaseWarningQueued = true;
  const warn = () => {
    if (!runtime.game?.user?.isGM) return;
    runtime.ui?.notifications?.warn?.(
      "CWN Interface Theme could not register its optional sheets because the supported SWNR sheet API was unavailable.",
    );
  };
  if (runtime.Hooks?.once) runtime.Hooks.once("ready", warn);
  else warn();
}

export async function loadNativePartials(runtime = globalThis) {
  await runtime.foundry?.applications?.handlebars?.loadTemplates?.(NATIVE_PARTIALS);
}

export function linkedDronesForPilot(actor, {
  actors = globalThis.game?.actors?.contents ?? globalThis.game?.actors ?? [],
  user = globalThis.game?.user,
} = {}) {
  return Array.from(actors ?? [])
    .filter((entry) => entry?.type === "drone" && String(entry.system?.crewMembers?.[0] ?? "") === String(actor?.id ?? ""))
    .filter((entry) => user?.isGM || entry.isOwner || entry.testUserPermission?.(user, "OBSERVER"))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export function prepareCommonSheetContext(actor, {
  resolveActor = () => null,
  actors = globalThis.game?.actors?.contents ?? globalThis.game?.actors ?? [],
  user = globalThis.game?.user,
} = {}) {
  const items = sortDocuments(actor?.items ?? []);
  const knownTypes = new Set(["weapon", "armor", "item", "cyberware", "feature", "power", "skill"]);
  const powerGroups = actor?.itemTypes?.power
    ? sortDocuments(actor.itemTypes.power).map((item) => ({
      item,
      subType: item.system?.subType ?? "power",
      level: item.system?.level ?? 0,
    }))
    : [];
  const cyberdeckIds = Array.from(actor?.system?.cyberdecks ?? []).filter(Boolean);
  return {
    weapons: sortDocuments(actor?.itemTypes?.weapon ?? items.filter((item) => item.type === "weapon"))
      .map((item) => prepareWeapon(item, actor)),
    armor: sortDocuments(actor?.itemTypes?.armor ?? items.filter((item) => item.type === "armor"))
      .map((item) => ({ item, isActive: Boolean(item.system?.use) })),
    skills: sortDocuments(actor?.itemTypes?.skill ?? items.filter((item) => item.type === "skill")),
    features: sortDocuments(actor?.itemTypes?.feature ?? items.filter((item) => item.type === "feature")),
    cyberware: sortDocuments(actor?.itemTypes?.cyberware ?? items.filter((item) => item.type === "cyberware")),
    powers: powerGroups.length ? powerGroups : flattenPowers(actor?.powers),
    otherItems: items.filter((item) => !knownTypes.has(item.type)),
    effects: sortDocuments(actor?.effects ?? []),
    linkedCyberdecks: cyberdeckIds.map((id) => resolveActor(id)).filter(Boolean),
    linkedDrones: linkedDronesForPilot(actor, { actors, user }).map((drone) => ({
      actor: drone,
      id: drone.id,
      name: drone.name,
      img: drone.img,
      model: drone.system?.model === "custom" ? drone.system?.customModel || "Custom" : drone.system?.model || "Drone",
      deployed: Boolean(drone.getFlag?.(MODULE_ID, "deployed") ?? drone.flags?.[MODULE_ID]?.deployed),
    })),
  };
}
