import {
  MODULE_ID,
  loadNativePartials,
  number,
  prepareCommonSheetContext,
  queueMissingBaseWarning,
  resolveSwnrActorSheet,
} from "./cwn-sheet-shared-v060.mjs";

export const CHARACTER_SHEET_LABEL = "CWN Character Sheet";

export const ACTION_REFERENCES = Object.freeze({
  "total-defense": Object.freeze({
    name: "Total Defense",
    cost: "Instant action; commits the character's Main Action",
    summary: "Use only before spending your Main Action. Gain +2 AC until the start of your next turn and ignore Shock damage, including Swarm Attack Shock.",
  }),
  "fighting-withdrawal": Object.freeze({
    name: "Fighting Withdrawal",
    cost: "Main Action",
    summary: "Disengage carefully; you can then Move away without triggering the usual free melee attacks.",
  }),
  "hold-action": Object.freeze({
    name: "Hold an Action",
    cost: "Move Action",
    summary: "Delay your remaining actions and name the circumstance that releases them later as an Instant action. A held response resolves before its trigger.",
  }),
  "execution-attack": Object.freeze({
    name: "Execution Attack",
    cost: "One minute of setup, then a Main Action",
    summary: "Declare an execution attack against a helpless or completely unaware target; resolve the detailed requirements with the GM.",
  }),
});

function prepareCharacterContext(actor, resolveActor) {
  const cwnit = prepareCommonSheetContext(actor, { resolveActor });
  const system = actor?.system ?? {};
  const stats = Object.entries(system.stats ?? {}).map(([key, value]) => ({ key, ...value }));
  return {
    ...cwnit,
    hasActionCentre: typeof globalThis.game?.cwnCombatEnhancements?.actions?.open === "function",
    vitals: {
      ac: system.ac ?? system.baseAc ?? 10,
      traumaTarget: system.modifiedTraumaTarget ?? system.traumaTarget ?? "—",
      strainValue: system.systemStrain?.value ?? system.strain?.value ?? 0,
      strainMax: system.systemStrain?.max ?? system.strain?.max ?? 0,
      movement: system.speed ?? system.movement ?? 0,
      attackBonus: system.ab ?? 0,
    },
    stats,
    actionReferences: Object.entries(ACTION_REFERENCES).map(([key, value]) => ({ key, ...value })),
    readiedArmor: cwnit.armor.filter((entry) => entry.isActive),
    readyPercentage: number(system.encumbrance?.ready?.percentage),
    stowedPercentage: number(system.encumbrance?.stowed?.percentage),
  };
}

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(String(value));
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function createCwnCharacterSheetClass(SWNActorSheet) {
  return class CwnCharacterSheet extends SWNActorSheet {
    static DEFAULT_OPTIONS = {
      classes: ["swnr", "actor", "cwnit-character-sheet-window"],
      position: { width: 1040, height: 820 },
      window: { resizable: true },
      actions: {
        openActionCentre: this._onOpenActionCentre,
        rollInitiative: this._onRollInitiative,
        declareAction: this._onDeclareAction,
        openActionsTab: this._onOpenActionsTab,
        openLinkedActor: this._onOpenLinkedActor,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/character/header-v060.hbs` },
      combat: { template: `modules/${MODULE_ID}/templates/sheets/character/combat-v060.hbs` },
      skills: { template: `modules/${MODULE_ID}/templates/sheets/character/skills-v060.hbs` },
      inventory: { template: `modules/${MODULE_ID}/templates/sheets/character/inventory-v060.hbs` },
      cyberware: { template: `modules/${MODULE_ID}/templates/sheets/character/cyberware-v060.hbs` },
      features: { template: `modules/${MODULE_ID}/templates/sheets/character/features-v060.hbs` },
      actions: { template: `modules/${MODULE_ID}/templates/sheets/character/actions-v060.hbs` },
      biography: { template: `modules/${MODULE_ID}/templates/sheets/character/biography-v060.hbs` },
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
      options.parts = [
        "header", "combat", "skills", "inventory", "cyberware", "features", "actions", "biography", "tabs",
      ];
    }

    _getTabs(parts, defaultTab = "combat") {
      const group = "primary";
      if (!this.tabGroups[group]) this.tabGroups[group] = defaultTab;
      const labels = {
        combat: "CWNIT.Sheet.Character.Tabs.Combat",
        skills: "CWNIT.Sheet.Character.Tabs.Skills",
        inventory: "CWNIT.Sheet.Character.Tabs.Inventory",
        cyberware: "CWNIT.Sheet.Character.Tabs.Cyberware",
        features: "CWNIT.Sheet.Character.Tabs.Features",
        actions: "CWNIT.Sheet.Character.Tabs.Actions",
        biography: "CWNIT.Sheet.Character.Tabs.Biography",
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
      await loadNativePartials();
      context.cwnit = prepareCharacterContext(
        this.actor,
        (id) => globalThis.game?.actors?.get?.(id) ?? null,
      );
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    static async _onOpenActionCentre(event) {
      event.preventDefault();
      await globalThis.game?.cwnCombatEnhancements?.actions?.open?.(this.actor);
    }

    static async _onRollInitiative(event) {
      event.preventDefault();
      await this.actor?.rollInitiative?.();
    }

    static async _onDeclareAction(event, target) {
      event.preventDefault();
      const reference = ACTION_REFERENCES[target.dataset.actionKey];
      if (!reference) return;
      const content = `<article class="cwnit-action-reference"><header><i class="fa-solid fa-bullhorn"></i><h3>${escapeHtml(reference.name)}</h3></header><p><strong>${escapeHtml(reference.cost)}</strong></p><p>${escapeHtml(reference.summary)}</p><footer>Declaration/reference only — no mechanical state was changed.</footer></article>`;
      const ChatMessageClass = globalThis.ChatMessage;
      if (typeof ChatMessageClass?.create !== "function") return;
      await ChatMessageClass.create({
        speaker: ChatMessageClass.getSpeaker?.({ actor: this.actor }) ?? { actor: this.actor?.id },
        content,
      });
    }

    static _onOpenActionsTab(event) {
      event.preventDefault();
      this.element?.querySelector?.('[data-tab="actions"]')?.click?.();
    }

    static async _onOpenLinkedActor(event, target) {
      event.preventDefault();
      const linkedActor = globalThis.game?.actors?.get?.(target.dataset.actorId);
      if (linkedActor?.sheet) await linkedActor.sheet.render(true);
    }
  };
}

export function registerCwnCharacterSheet(runtime = globalThis) {
  const base = resolveSwnrActorSheet(runtime);
  const actorSheets = runtime.foundry?.documents?.collections?.Actors;
  if (!base || typeof actorSheets?.registerSheet !== "function") {
    queueMissingBaseWarning(runtime);
    return null;
  }
  const SheetClass = createCwnCharacterSheetClass(base);
  actorSheets.registerSheet(MODULE_ID, SheetClass, {
    types: ["character"],
    makeDefault: false,
    label: CHARACTER_SHEET_LABEL,
  });
  return SheetClass;
}
