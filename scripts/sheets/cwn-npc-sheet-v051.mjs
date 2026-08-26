export const MODULE_ID = "cwn-interface-theme";
export const SHEET_LABEL = "CWN NPC Sheet";

const NATIVE_PARTIALS = [
  "systems/swnr/templates/actor/fragments/items-list.hbs",
  "systems/swnr/templates/actor/fragments/consumable-list.hbs",
  "systems/swnr/templates/actor/fragments/cyberware-list.hbs",
];

let missingBaseWarningQueued = false;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortDocuments(documents = []) {
  return Array.from(documents).sort((left, right) =>
    number(left.sort) - number(right.sort) || String(left.name).localeCompare(String(right.name)),
  );
}

function flattenPowers(powers = {}) {
  return Object.entries(powers).flatMap(([subType, levels]) =>
    Object.entries(levels ?? {}).flatMap(([level, items]) =>
      Array.from(items ?? []).map((item) => ({ item, subType, level })),
    ),
  );
}

function prepareWeapon(item, actor) {
  const system = item.system ?? {};
  const ammo = system.ammo ?? {};
  const shock = system.shock ?? {};
  const trauma = system.trauma ?? {};
  const isMelee = Boolean(system.isMelee);
  return {
    item,
    mode: isMelee ? "Melee" : "Ranged",
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

/** Build display-only view data. This function never mutates the Actor or its Items. */
export function prepareNpcSheetContext(actor, { resolveActor = () => null } = {}) {
  const items = sortDocuments(actor?.items ?? []);
  const knownTypes = new Set(["weapon", "armor", "item", "cyberware", "feature", "power"]);
  const powerGroups = actor?.itemTypes?.power
    ? sortDocuments(actor.itemTypes.power).map((item) => ({ item, subType: item.system?.subType ?? "power", level: item.system?.level ?? 0 }))
    : [];
  const cyberdeckIds = Array.from(actor?.system?.cyberdecks ?? []).filter(Boolean);

  return {
    weapons: sortDocuments(actor?.itemTypes?.weapon ?? items.filter((item) => item.type === "weapon"))
      .map((item) => prepareWeapon(item, actor)),
    armor: sortDocuments(actor?.itemTypes?.armor ?? items.filter((item) => item.type === "armor")),
    features: sortDocuments(actor?.itemTypes?.feature ?? items.filter((item) => item.type === "feature")),
    cyberware: sortDocuments(actor?.itemTypes?.cyberware ?? items.filter((item) => item.type === "cyberware")),
    powers: powerGroups.length ? powerGroups : flattenPowers(actor?.powers),
    otherItems: items.filter((item) => !knownTypes.has(item.type)),
    effects: sortDocuments(actor?.effects ?? []),
    linkedCyberdecks: cyberdeckIds.map((id) => resolveActor(id)).filter(Boolean),
  };
}

export function resolveSwnrActorSheet(runtime = globalThis) {
  return runtime.swnr?.applications?.SWNActorSheet ?? null;
}

function queueMissingBaseWarning(runtime) {
  if (missingBaseWarningQueued) return;
  missingBaseWarningQueued = true;
  const warn = () => {
    if (!runtime.game?.user?.isGM) return;
    runtime.ui?.notifications?.warn?.(
      "CWN Interface Theme could not register CWN NPC Sheet because the supported SWNR sheet API was unavailable.",
    );
  };
  if (runtime.Hooks?.once) runtime.Hooks.once("ready", warn);
  else warn();
}

export function createCwnNpcSheetClass(SWNActorSheet) {
  return class CwnNpcSheet extends SWNActorSheet {
    static DEFAULT_OPTIONS = {
      classes: ["swnr", "actor", "cwnit-npc-sheet-window"],
      position: { width: 900, height: 760 },
      window: { resizable: true },
      actions: {
        openActionCentre: this._onOpenActionCentre,
        rollInitiative: this._onRollInitiative,
        openLinkedActor: this._onOpenLinkedActor,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/npc/header-v051.hbs` },
      combat: { template: `modules/${MODULE_ID}/templates/sheets/npc/combat.hbs` },
      inventory: { template: `modules/${MODULE_ID}/templates/sheets/npc/inventory.hbs` },
      cyberware: { template: `modules/${MODULE_ID}/templates/sheets/npc/cyberware.hbs` },
      features: { template: `modules/${MODULE_ID}/templates/sheets/npc/features.hbs` },
      biography: { template: `modules/${MODULE_ID}/templates/sheets/npc/biography.hbs` },
      tabs: { template: "templates/generic/tab-navigation.hbs" },
    };

    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      options.defaultTab = "combat";
      options.parts = ["header", "biography", "tabs"];
      if (this.document.limited) {
        options.defaultTab = "biography";
        return;
      }
      options.parts = ["header", "combat", "inventory", "cyberware", "features", "biography", "tabs"];
    }

    _getTabs(parts, defaultTab = "combat") {
      const group = "primary";
      if (!this.tabGroups[group]) this.tabGroups[group] = defaultTab;
      const labels = {
        combat: "CWNIT.Sheet.NPC.Tabs.Combat",
        inventory: "CWNIT.Sheet.NPC.Tabs.Inventory",
        cyberware: "CWNIT.Sheet.NPC.Tabs.Cyberware",
        features: "CWNIT.Sheet.NPC.Tabs.Features",
        biography: "CWNIT.Sheet.NPC.Tabs.Biography",
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
      await globalThis.foundry?.applications?.handlebars?.loadTemplates?.(NATIVE_PARTIALS);
      context.cwnit = prepareNpcSheetContext(this.actor, {
        resolveActor: (id) => globalThis.game?.actors?.get?.(id) ?? null,
      });
      context.cwnit.hasActionCentre = typeof globalThis.game?.cwnCombatEnhancements?.actions?.open === "function";
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    static async _onOpenActionCentre(event) {
      event.preventDefault();
      const open = globalThis.game?.cwnCombatEnhancements?.actions?.open;
      if (typeof open !== "function") return;
      const result = await open(this.actor);
      if (result === false) {
        globalThis.ui?.notifications?.info?.(
          "Combat Enhancements currently provides tracked Action Centre abilities to player characters only.",
        );
      }
    }

    static async _onRollInitiative(event) {
      event.preventDefault();
      if (typeof this.actor?.rollInitiative === "function") await this.actor.rollInitiative();
    }

    static async _onOpenLinkedActor(event, target) {
      event.preventDefault();
      const linkedActor = globalThis.game?.actors?.get?.(target.dataset.actorId);
      if (linkedActor?.sheet) await linkedActor.sheet.render(true);
    }
  };
}

export function registerCwnNpcSheet(runtime = globalThis) {
  const base = resolveSwnrActorSheet(runtime);
  const actorSheets = runtime.foundry?.documents?.collections?.Actors;
  if (!base || typeof actorSheets?.registerSheet !== "function") {
    queueMissingBaseWarning(runtime);
    return null;
  }
  const SheetClass = createCwnNpcSheetClass(base);
  actorSheets.registerSheet(MODULE_ID, SheetClass, {
    types: ["npc"],
    makeDefault: false,
    label: SHEET_LABEL,
  });
  return SheetClass;
}
