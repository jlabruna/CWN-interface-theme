import {
  MODULE_ID,
  loadNativePartials,
  number,
  prepareCommonSheetContext,
  queueMissingBaseWarning,
  resolveSwnrActorSheet,
} from "./cwn-sheet-shared-v062.mjs";

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

function prepareCharacterContext(actor, resolveActor, { skillsUnlocked = false } = {}) {
  const cwnit = prepareCommonSheetContext(actor, { resolveActor });
  const system = actor?.system ?? {};
  const stats = Object.entries(system.stats ?? {}).map(([key, value]) => ({ key, ...value }));
  return {
    ...cwnit,
    combatWeapons: cwnit.weapons.filter((attack) => attack.item?.system?.location === "readied"),
    skillsUnlocked,
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

async function postActorChat(actor, content) {
  const ChatMessageClass = globalThis.ChatMessage;
  if (typeof ChatMessageClass?.create !== "function") return;
  await ChatMessageClass.create({
    speaker: ChatMessageClass.getSpeaker?.({ actor }) ?? { actor: actor?.id },
    content,
  });
}

/**
 * SWNR 2.3.1 still passes Foundry's deprecated rollMode option from skill
 * rolls. Patch only the clicked skill DataModel instance and leave the native
 * prompt, remembered settings, formula, and unskilled rules in control.
 */
function installSkillMessageModeCompat(skillItem) {
  const skill = skillItem?.system;
  if (!skill || skill._cwnitMessageModeCompat) return Boolean(skill);
  try {
    Object.defineProperty(skill, "rollSkill", {
      configurable: true,
      value: async function rollSkillCompat(
        skillName,
        statShortName,
        statMod,
        dice,
        skillRank,
        modifier,
        unskilledPenaltyMod = 0,
      ) {
        if (skillRank < 0 && globalThis.game?.settings?.get?.("swnr", "unskilledPenalty") !== -1) {
          skillRank = globalThis.game.settings.get("swnr", "unskilledPenalty");
        }
        if (skillRank < 0 && unskilledPenaltyMod >= 0) skillRank += unskilledPenaltyMod;

        const roll = new globalThis.Roll(`${dice} + @stat + @skill + @modifier`, {
          skill: skillRank,
          modifier,
          stat: statMod,
        });
        await roll.roll();
        const title = `${globalThis.game.i18n.localize("swnr.chat.skillCheck")}: ${statShortName}/${skillName}`;
        const generation = Number(globalThis.game?.release?.generation ?? 13);
        const mode = globalThis.game.settings.get("core", "rollMode");
        await roll.toMessage({
          speaker: globalThis.ChatMessage.getSpeaker({ actor: this.parent?.actor }),
          flavor: title,
        }, generation >= 14 ? { messageMode: mode } : { rollMode: mode });
      },
    });
    Object.defineProperty(skill, "_cwnitMessageModeCompat", { configurable: true, value: true });
    return true;
  } catch {
    return false;
  }
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
        toggleSkillControls: this._onToggleSkillControls,
        rollSkill: this._onRollSkillCompat,
        skillUp: this._onSkillUpWithChat,
        openLinkedActor: this._onOpenLinkedActor,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/character/header-v062.hbs` },
      combat: { template: `modules/${MODULE_ID}/templates/sheets/character/combat-v063.hbs` },
      skills: { template: `modules/${MODULE_ID}/templates/sheets/character/skills-v062.hbs` },
      inventory: { template: `modules/${MODULE_ID}/templates/sheets/character/inventory-v062.hbs` },
      cyberware: { template: `modules/${MODULE_ID}/templates/sheets/character/cyberware-v062.hbs` },
      features: { template: `modules/${MODULE_ID}/templates/sheets/character/features-v062.hbs` },
      actions: { template: `modules/${MODULE_ID}/templates/sheets/character/actions-v063.hbs` },
      biography: { template: `modules/${MODULE_ID}/templates/sheets/character/biography-v062.hbs` },
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
        {
          skillsUnlocked: Boolean(this._cwnitSkillsUnlocked),
        },
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
        globalThis.ui?.notifications?.warn?.("Place this character on the active scene before rolling initiative.");
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

    static async _onDeclareAction(event, target) {
      event.preventDefault();
      const reference = ACTION_REFERENCES[target.dataset.actionKey];
      if (!reference) return;
      const content = `<article class="cwnit-action-reference"><header><i class="fa-solid fa-bullhorn"></i><h3>${escapeHtml(reference.name)}</h3></header><p><strong>${escapeHtml(reference.cost)}</strong></p><p>${escapeHtml(reference.summary)}</p><footer>Declaration/reference only — no mechanical state was changed.</footer></article>`;
      await postActorChat(this.actor, content);
    }

    static async _onToggleSkillControls(event) {
      event.preventDefault();
      this._cwnitSkillsUnlocked = !this._cwnitSkillsUnlocked;
      await this.render({ parts: ["skills"] });
    }

    static async _onRollSkillCompat(event, target) {
      event.preventDefault();
      const skillItem = this.actor?.items?.get?.(target.dataset.itemId);
      if (!skillItem?.system?.roll) return;
      installSkillMessageModeCompat(skillItem);
      await skillItem.system.roll(Boolean(event.shiftKey));
    }

    static async _onSkillUpWithChat(event, target) {
      event.preventDefault();
      const skillId = target.dataset.itemId;
      const before = this.actor?.items?.get?.(skillId);
      if (!before) return;

      const previousRank = number(before.system?.rank, -1);
      const previousPoints = number(this.actor.system?.unspentSkillPoints)
        + number(this.actor.system?.unspentPsySkillPoints);
      const nativeSkillUp = SWNActorSheet.DEFAULT_OPTIONS?.actions?.skillUp
        ?? SWNActorSheet._onSkillUp;
      if (typeof nativeSkillUp !== "function") return;
      await nativeSkillUp.call(this, event, target);

      const after = this.actor?.items?.get?.(skillId);
      const newRank = number(after?.system?.rank, previousRank);
      if (newRank <= previousRank) return;
      const remainingPoints = number(this.actor.system?.unspentSkillPoints)
        + number(this.actor.system?.unspentPsySkillPoints);
      const spent = Math.max(0, previousPoints - remainingPoints);
      const content = `<article class="cwnit-skill-upgrade"><header><i class="fa-solid fa-arrow-up-right-dots"></i><h3>Skill upgraded: ${escapeHtml(after.name)}</h3></header><dl><div><dt>Previous rank</dt><dd>${previousRank >= 0 ? "+" : ""}${previousRank}</dd></div><div><dt>New rank</dt><dd>${newRank >= 0 ? "+" : ""}${newRank}</dd></div><div><dt>Skill points spent</dt><dd>${spent}</dd></div></dl></article>`;
      await postActorChat(this.actor, content);
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
