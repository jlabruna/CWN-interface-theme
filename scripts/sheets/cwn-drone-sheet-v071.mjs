import {
  MODULE_ID,
  number,
  queueMissingBaseWarning,
  sortDocuments,
  weaponClassification,
} from "./cwn-sheet-shared-v062.mjs";

export const DRONE_SHEET_LABEL = "CWN Drone Operations Sheet";

export const COMMAND_DECK_NAMES = Object.freeze({
  follow: "command deck/follow",
  kill: "command deck/kill",
  patrol: "command deck/patrol",
  watch: "command deck/watch",
});

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replaceAll(/\s*\/\s*/gu, "/")
    .replaceAll(/\s+/gu, " ");
}

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(String(value ?? ""));
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function plainText(value, maximumLength = 230) {
  const text = String(value ?? "")
    .replaceAll(/<br\s*\/?>/giu, " ")
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  if (!text) return "Open the fitting for full operational details.";
  return text.length > maximumLength ? `${text.slice(0, maximumLength - 1).trimEnd()}…` : text;
}

function ammoLabel(ammo = {}) {
  if (!ammo.type || ammo.type === "none") return "—";
  if (ammo.type === "infinite") return "∞";
  return `${number(ammo.value)}/${number(ammo.max)}`;
}

function resourceUsage(resource = {}) {
  const maximum = number(resource.max);
  const remaining = number(resource.value, maximum);
  return { maximum, remaining, used: maximum - remaining };
}

function prepareDroneWeapon(item) {
  const system = item?.system ?? {};
  const isMelee = Boolean(system.isMelee);
  const isShipWeapon = item?.type === "shipWeapon";
  const shock = system.shock ?? {};
  const trauma = system.trauma ?? {};
  return {
    item,
    classification: isShipWeapon ? "Mounted Weapon" : weaponClassification(item),
    mode: isMelee ? "Melee" : "Ranged",
    damage: system.damage || "—",
    ammo: ammoLabel(system.ammo),
    canReload: Boolean(system.ammo?.type && system.ammo.type !== "none" && system.ammo.type !== "infinite"),
    range: isMelee ? "Melee" : `${number(system.range?.normal)} / ${number(system.range?.max)}`,
    shock: number(shock.dmg) ? `${shock.dmg} / AC ${shock.ac}` : "—",
    trauma: trauma.die && trauma.rating != null ? `${trauma.die} ×${number(trauma.rating, 1)}` : "—",
    hardpoints: isShipWeapon ? number(system.hardpoint, 1) : 1,
  };
}

function prepareFitting(item) {
  const system = item?.system ?? {};
  return {
    item,
    capacity: number(system.mass, 1),
    power: number(system.power),
    summary: plainText(system.effect || system.description),
  };
}

function prepareEffect(effect) {
  return {
    effect,
    parentId: effect?.parent?.id ?? "",
    source: effect?.sourceName ?? effect?.parent?.name ?? "Drone",
    duration: effect?.duration?.label ?? "—",
  };
}

export function hasCanonicalFitting(actor, fittingName) {
  const expected = COMMAND_DECK_NAMES[fittingName] ?? normalizeName(fittingName);
  return Array.from(actor?.itemTypes?.shipFitting ?? [])
    .some((item) => normalizeName(item?.name) === expected);
}

export function eligiblePilotActors(actors = [], user = globalThis.game?.user) {
  return Array.from(actors)
    .filter((actor) => actor?.type === "character" || actor?.type === "npc")
    .filter((actor) => user?.isGM || actor.testUserPermission?.(user, "OWNER") || actor.isOwner)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export function resolveSwnrVehicleSheet(runtime = globalThis) {
  const publicExport = runtime.swnr?.applications?.SWNVehicleSheet;
  if (publicExport) return publicExport;

  const registrations = runtime.foundry?.documents?.collections?.Actors?.registeredSheets ?? [];
  const registeredClass = Array.from(registrations).find((entry) =>
    typeof entry === "function" && entry.name === "SWNVehicleSheet",
  );
  if (registeredClass) return registeredClass;

  // Retain descriptor support for Foundry-compatible registry adapters.
  const exact = Array.from(registrations).find((entry) => entry?.id === "swnr.SWNVehicleSheet");
  if (exact?.sheetClass) return exact.sheetClass;

  return Array.from(registrations).find((entry) =>
    String(entry?.id ?? "").startsWith("swnr.")
      && entry?.types?.includes?.("drone")
      && entry?.sheetClass?.name === "SWNVehicleSheet",
  )?.sheetClass ?? null;
}

export function prepareDroneSheetContext(actor, {
  resolveActor = (id) => globalThis.game?.actors?.get?.(id) ?? null,
  localize = (key) => globalThis.game?.i18n?.localize?.(key) ?? key,
} = {}) {
  const system = actor?.system ?? {};
  const pilot = system.pilot ?? resolveActor(system.crewMembers?.[0]) ?? null;
  const fittings = sortDocuments(actor?.itemTypes?.shipFitting ?? []).map(prepareFitting);
  const defenses = sortDocuments(actor?.itemTypes?.shipDefense ?? []).map(prepareFitting);
  const weapons = sortDocuments([
    ...(actor?.itemTypes?.shipWeapon ?? []),
    ...(actor?.itemTypes?.weapon ?? []),
  ]).map(prepareDroneWeapon);
  const modelKey = system.model === "custom" ? "" : `swnr.sheet.drone.models.${system.model}`;
  const modelLabel = system.model === "custom"
    ? system.customModel || localize("CWNIT.Sheet.Drone.CustomModel")
    : localize(modelKey);
  const allEffects = actor?.allApplicableEffects?.() ?? actor?.effects ?? [];

  const commandDeck = Object.fromEntries(
    Object.keys(COMMAND_DECK_NAMES).map((key) => [key, hasCanonicalFitting(actor, key)]),
  );

  return {
    pilot,
    modelLabel,
    weapons,
    fittings,
    defenses,
    cargoItems: sortDocuments(system.carriedGear ?? actor?.items?.filter?.((item) =>
      item.type === "item" || item.type === "weapon" || item.type === "armor",
    ) ?? []),
    effects: sortDocuments(Array.from(allEffects)).map(prepareEffect),
    fittingUsage: resourceUsage(system.fittings),
    hardpointUsage: resourceUsage(system.hardpoints),
    commandDeck,
    hasAutonomousCommands: Object.values(commandDeck).some(Boolean),
    quickLaunch: Array.from(actor?.itemTypes?.shipFitting ?? [])
      .some((item) => normalizeName(item?.name) === "quick launch"),
  };
}

async function postDroneChat(actor, { title, cost, details = [], note }) {
  const ChatMessageClass = globalThis.ChatMessage;
  if (typeof ChatMessageClass?.create !== "function") return;
  const rows = details
    .filter((entry) => entry?.value)
    .map((entry) => `<div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`)
    .join("");
  const content = `<article class="cwnit-drone-command"><header><i class="fa-solid fa-satellite-dish"></i><div><small>DRONE OPERATIONS</small><h3>${escapeHtml(title)}</h3></div></header><p class="cwnit-drone-command__cost">${escapeHtml(cost)}</p>${rows ? `<dl>${rows}</dl>` : ""}<footer>${escapeHtml(note)}</footer></article>`;
  await ChatMessageClass.create({
    speaker: ChatMessageClass.getSpeaker?.({ actor }) ?? { actor: actor?.id },
    content,
  });
}

function currentTarget() {
  return Array.from(globalThis.game?.user?.targets ?? [])[0] ?? null;
}

function targetName(target) {
  return target?.name ?? target?.document?.name ?? target?.actor?.name ?? "";
}

function valueInCard(target, selector) {
  return target.closest?.(".cwnit-drone__command-card")?.querySelector?.(selector)?.value?.trim?.() ?? "";
}

export function createCwnDroneSheetClass(SWNVehicleSheet) {
  return class CwnDroneSheet extends SWNVehicleSheet {
    static DEFAULT_OPTIONS = {
      classes: ["swnr", "actor", "vehicle", "cwnit-drone-sheet-window"],
      position: { width: 1040, height: 820 },
      window: { resizable: true },
      actions: {
        assignPilot: this._onAssignPilot,
        declareDroneAction: this._onDeclareDroneAction,
        issueAutonomousCommand: this._onIssueAutonomousCommand,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/drone/header-v070.hbs` },
      operations: { template: `modules/${MODULE_ID}/templates/sheets/drone/operations-v070.hbs` },
      fittings: { template: `modules/${MODULE_ID}/templates/sheets/drone/fittings-v070.hbs` },
      cargo: { template: `modules/${MODULE_ID}/templates/sheets/drone/cargo-v070.hbs` },
      configuration: { template: `modules/${MODULE_ID}/templates/sheets/drone/configuration-v070.hbs` },
      notes: { template: `modules/${MODULE_ID}/templates/sheets/drone/notes-v070.hbs` },
      tabs: { template: "templates/generic/tab-navigation.hbs" },
    };

    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      options.defaultTab = "operations";
      options.parts = ["header", "notes", "tabs"];
      if (this.document.limited) {
        options.defaultTab = "notes";
        return;
      }
      options.parts = ["header", "operations", "fittings", "cargo", "configuration", "notes", "tabs"];
    }

    _getTabs(parts, defaultTab = "operations") {
      const group = "primary";
      if (!this.tabGroups[group]) this.tabGroups[group] = defaultTab;
      const labels = {
        operations: "CWNIT.Sheet.Drone.Tabs.Operations",
        fittings: "CWNIT.Sheet.Drone.Tabs.Fittings",
        cargo: "CWNIT.Sheet.Drone.Tabs.Cargo",
        configuration: "CWNIT.Sheet.Drone.Tabs.Configuration",
        notes: "CWNIT.Sheet.Drone.Tabs.Notes",
      };
      return parts.reduce((tabs, partId) => {
        if (!labels[partId]) return tabs;
        tabs[partId] = {
          id: partId,
          group,
          label: labels[partId],
          cssClass: this.tabGroups[group] === partId ? "active" : "",
        };
        return tabs;
      }, {});
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.cwnit = prepareDroneSheetContext(this.actor);
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    static async _onAssignPilot(event) {
      event.preventDefault();
      const collection = globalThis.game?.actors;
      const candidates = eligiblePilotActors(collection?.contents ?? collection ?? []);
      if (!candidates.length) {
        globalThis.ui?.notifications?.warn?.("No eligible Character or NPC Actors are available to pilot this drone.");
        return;
      }

      const currentId = this.actor.system?.crewMembers?.[0] ?? "";
      const options = candidates.map((actor) =>
        `<option value="${escapeHtml(actor.id)}" ${actor.id === currentId ? "selected" : ""}>${escapeHtml(actor.name)} (${escapeHtml(actor.type)})</option>`,
      ).join("");
      const selectedId = await globalThis.foundry?.applications?.api?.DialogV2?.prompt?.({
        window: { title: `Assign Pilot — ${this.actor.name}` },
        content: `<label class="cwnit-drone__pilot-picker">Pilot<select name="pilotId">${options}</select></label><p>This uses SWNR's native drone-pilot link and inventory handling.</p>`,
        modal: true,
        rejectClose: false,
        ok: {
          label: "Assign Pilot",
          callback: (_dialogEvent, button) => button.form.elements.pilotId.value,
        },
      });
      if (!selectedId || selectedId === currentId) return;

      const selected = collection?.get?.(selectedId);
      const allowed = selected && (globalThis.game?.user?.isGM
        || selected.testUserPermission?.(globalThis.game.user, "OWNER")
        || selected.isOwner);
      if (!allowed || (selected.type !== "character" && selected.type !== "npc")) {
        globalThis.ui?.notifications?.error?.("That Actor is not an eligible pilot.");
        return;
      }

      if (currentId) {
        const nativeUnlink = SWNVehicleSheet.DEFAULT_OPTIONS?.actions?.pilotDelete;
        if (typeof nativeUnlink !== "function") {
          globalThis.ui?.notifications?.error?.("SWNR's native pilot unlink action is unavailable.");
          return;
        }
        await nativeUnlink.call(this, { preventDefault() {} }, null);
      }
      await this._onDropActor(event, { type: "Actor", uuid: selected.uuid });
    }

    static async _onDeclareDroneAction(event, target) {
      event.preventDefault();
      const cwnit = prepareDroneSheetContext(this.actor);
      const pilot = cwnit.pilot?.name || "No pilot assigned";
      const actions = {
        deploy: {
          title: `Deploy ${this.actor.name}`,
          cost: cwnit.quickLaunch ? "On Turn (Quick Launch fitting)" : "Main Action",
          details: [{ label: "Pilot", value: pilot }],
          note: cwnit.quickLaunch
            ? "Deployment declared. No token was placed and no control state was changed."
            : "Deployment declared. Accessing a Stowed drone may require its normal additional action; no token was placed.",
        },
        assume: {
          title: `Assume Command — ${this.actor.name}`,
          cost: "Main + Move Actions",
          details: [{ label: "Pilot", value: pilot }],
          note: "Declaration only; no Theme-owned control state was created. Drone Pilot level 2 may alter this action once per round.",
        },
        drop: {
          title: `Drop Control — ${this.actor.name}`,
          cost: "On Turn",
          details: [{ label: "Pilot", value: pilot }],
          note: "Declaration only; no Theme-owned control state was changed.",
        },
        halt: {
          title: `Halt Autonomous Mode — ${this.actor.name}`,
          cost: "On Turn",
          details: [{ label: "Pilot", value: pilot }],
          note: "The drone does nothing until a new command is issued. No persistent autonomous state is stored by Interface Theme.",
        },
      };
      const action = actions[target.dataset.actionKey];
      if (!action) return;
      if (target.dataset.actionKey === "halt" && !cwnit.hasAutonomousCommands) return;
      await postDroneChat(this.actor, action);
    }

    static async _onIssueAutonomousCommand(event, target) {
      event.preventDefault();
      const command = target.dataset.command;
      if (!hasCanonicalFitting(this.actor, command)) {
        globalThis.ui?.notifications?.warn?.(`This drone no longer has Command Deck/${command}.`);
        return;
      }

      const pilot = prepareDroneSheetContext(this.actor).pilot?.name || "No pilot assigned";
      const foundryTarget = currentTarget();
      const selectedTarget = targetName(foundryTarget);
      const details = [{ label: "Pilot", value: pilot }];
      let title = "";
      let note = "Command recorded only; Interface Theme does not automate movement, attacks, perception, or autonomous state.";

      if (command === "kill") {
        if (!selectedTarget) {
          globalThis.ui?.notifications?.warn?.("Target a visible Token before issuing a Kill order.");
          return;
        }
        title = `Kill Order — ${this.actor.name}`;
        details.push({ label: "Target", value: selectedTarget });
      } else if (command === "follow") {
        if (!selectedTarget) {
          globalThis.ui?.notifications?.warn?.("Target a visible Token before issuing a Follow order.");
          return;
        }
        const distance = valueInCard(target, "[data-cwnit-follow-distance]");
        const speed = valueInCard(target, "[data-cwnit-follow-speed]") || "Half speed";
        title = `Follow Order — ${this.actor.name}`;
        details.push({ label: "Target", value: selectedTarget }, { label: "Distance", value: distance || "As directed" }, { label: "Speed", value: speed });
      } else if (command === "watch") {
        const instruction = valueInCard(target, "[data-cwnit-command-instruction]");
        if (!instruction) {
          globalThis.ui?.notifications?.warn?.("Enter a short Watch instruction first.");
          return;
        }
        title = `Watch Order — ${this.actor.name}`;
        details.push({ label: "Instruction", value: instruction });
        note = "Command recorded only. Keep the instruction to roughly one sentence; no scene detection was enabled.";
      } else if (command === "patrol") {
        const route = valueInCard(target, "[data-cwnit-command-instruction]");
        if (!route) {
          globalThis.ui?.notifications?.warn?.("Enter a Patrol route or instruction first.");
          return;
        }
        title = `Patrol Order — ${this.actor.name}`;
        details.push({ label: "Route / instructions", value: route });
      } else return;

      await postDroneChat(this.actor, { title, cost: "Main Action", details, note });
    }
  };
}

export function registerCwnDroneSheet(runtime = globalThis) {
  const base = resolveSwnrVehicleSheet(runtime);
  const actorSheets = runtime.foundry?.documents?.collections?.Actors;
  if (!base || typeof actorSheets?.registerSheet !== "function") {
    queueMissingBaseWarning(runtime);
    return null;
  }
  const SheetClass = createCwnDroneSheetClass(base);
  actorSheets.registerSheet(MODULE_ID, SheetClass, {
    types: ["drone"],
    makeDefault: false,
    label: DRONE_SHEET_LABEL,
  });
  return SheetClass;
}
