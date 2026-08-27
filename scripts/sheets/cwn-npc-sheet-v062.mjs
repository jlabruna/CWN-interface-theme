import {
  MODULE_ID,
  loadNativePartials,
  prepareCommonSheetContext,
  queueMissingBaseWarning,
  resolveSwnrActorSheet,
} from "./cwn-sheet-shared-v062.mjs";

export { MODULE_ID, resolveSwnrActorSheet };
export const SHEET_LABEL = "CWN NPC Sheet";

/** Build display-only view data. This function never mutates the Actor or its Items. */
export function prepareNpcSheetContext(actor, { resolveActor = () => null } = {}) {
  return prepareCommonSheetContext(actor, { resolveActor });
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
      header: { template: `modules/${MODULE_ID}/templates/sheets/npc/header-v062.hbs` },
      combat: { template: `modules/${MODULE_ID}/templates/sheets/npc/combat-v062.hbs` },
      inventory: { template: `modules/${MODULE_ID}/templates/sheets/npc/inventory.hbs` },
      cyberware: { template: `modules/${MODULE_ID}/templates/sheets/npc/cyberware.hbs` },
      features: { template: `modules/${MODULE_ID}/templates/sheets/npc/features.hbs` },
      biography: { template: `modules/${MODULE_ID}/templates/sheets/npc/biography-v062.hbs` },
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
      await loadNativePartials();
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
      const canvas = globalThis.canvas;
      const combat = globalThis.game?.combat;
      if (!combat) {
        globalThis.ui?.notifications?.warn?.("Start a combat encounter before rolling initiative.");
        return;
      }

      const syntheticToken = this.actor?.token?.object ?? this.actor?.token;
      const controlledToken = canvas?.tokens?.controlled?.find?.((token) => token.actor?.id === this.actor?.id);
      const sceneToken = canvas?.tokens?.placeables?.find?.((token) => token.actor?.id === this.actor?.id);
      const token = syntheticToken?.document ? syntheticToken : controlledToken ?? sceneToken;
      const tokenDocument = token?.document ?? (syntheticToken?.actor ? syntheticToken : null);
      if (!tokenDocument) {
        globalThis.ui?.notifications?.warn?.("Place this NPC on the active scene before rolling initiative.");
        return;
      }

      let combatant = token?.combatant ?? combat.combatants?.find?.((entry) => entry.tokenId === tokenDocument.id);
      if (!combatant) {
        const created = await combat.createEmbeddedDocuments("Combatant", [{
          tokenId: tokenDocument.id,
          actorId: this.actor.id,
          sceneId: canvas?.scene?.id,
        }]);
        combatant = created?.[0] ?? null;
      }
      if (combatant?.id) await combat.rollInitiative([combatant.id]);
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
