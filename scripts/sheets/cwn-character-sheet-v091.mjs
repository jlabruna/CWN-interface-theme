import {
  MODULE_ID,
  loadNativePartials,
  number,
  prepareCommonSheetContext,
  queueMissingBaseWarning,
  resolveSwnrActorSheet,
} from "./cwn-sheet-shared-v062.mjs";
import {
  formatLedgerCurrency,
  openCwnAccountLedger,
} from "./cwn-account-ledger-v090.mjs";

export const CHARACTER_SHEET_LABEL = "CWN Character Sheet";

const POWER_VISIBILITY_FIELDS = Object.freeze({
  psychic: "showPsychic",
  art: "showArts",
  spell: "showSpells",
  adept: "showAdept",
  mutation: "showMutation",
});

export function skillRankTier(rank) {
  const value = number(rank, -1);
  if (value < 0) return "untrained";
  if (value === 0) return "trained";
  if (value === 1) return "professional";
  return "expert";
}

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
  "swarm-attack": Object.freeze({
    name: "Make a Swarm Attack",
    cost: "Main Action",
    summary: "Join up to three other assailants against one target in weapon range. One participant makes the attack with +2 to hit and +1 damage per helper, to a maximum of +6/+3. The bonus damage does not add to Shock or exceed the weapon's normal maximum, but the attack's Shock always applies unless Total Defense prevents it.",
  }),
  "charge": Object.freeze({
    name: "Charge",
    cost: "Special Action; spends Main and Move Actions",
    summary: "Move at least 3 metres and up to twice your normal movement in a straight line, then make a melee or thrown attack at +2 to hit. Suffer -2 to both Armor Classes until the end of the round.",
  }),
  "screen-an-ally": Object.freeze({
    name: "Screen an Ally",
    cost: "Move Action",
    summary: "Move adjacent to an ally and intercept feasible attacks against them until your next turn. Resolve the attacker's opposed combat-skill check against you; on your success, the attack targets you instead. You can screen attackers up to your highest combat skill level.",
  }),
  "snap-attack": Object.freeze({
    name: "Make a Snap Attack",
    cost: "Instant action; commits the character's Main Action",
    summary: "Before spending your Main Action, make an immediate melee or ranged attack at -4 to hit, even outside your turn. Resolve simultaneous reactions in the order chosen by the GM.",
  }),
  "execution-attack": Object.freeze({
    name: "Execution Attack",
    cost: "One minute of setup, then a Main Action",
    summary: "Declare an execution attack against a helpless or completely unaware target; resolve the detailed requirements with the GM.",
  }),
});

function prepareCharacterContext(actor, resolveActor, {
  skillsUnlocked = false,
  advancedConfigOpen = false,
  accountsOpen = false,
} = {}) {
  const cwnit = prepareCommonSheetContext(actor, { resolveActor });
  const system = actor?.system ?? {};
  const stats = Object.entries(system.stats ?? {}).map(([key, value]) => ({ key, ...value }));
  const visiblePowers = cwnit.powers.filter((power) => {
    const field = POWER_VISIBILITY_FIELDS[String(power.subType ?? "").toLowerCase()];
    return !field || Boolean(system.tweak?.[field]);
  });
  const accountLedgerApi = globalThis.game?.cwnCombatEnhancements?.accounts;
  const nativeAccounts = [
    {
      id: "base",
      kind: "base",
      name: String(globalThis.game?.settings?.get?.("swnr", "baseCurrencyName") ?? "Dollars"),
      type: "base",
      typeName: String(globalThis.game?.settings?.get?.("swnr", "baseCurrencyName") ?? "Dollars"),
      carried: true,
      balance: number(system.credits?.carriedBase),
      index: null,
      primary: true,
    },
    ...Array.from(system.credits?.extraCurrencies ?? []).map((currency, index) => ({
      id: null,
      kind: "extra",
      name: String(currency.name || currency.typeName || `Account ${index + 1}`),
      type: String(currency.type ?? "base"),
      typeName: String(currency.typeName || currency.type || "Currency"),
      carried: Boolean(currency.carried),
      balance: number(currency.value),
      index,
      primary: false,
    })),
  ];
  const accountRows = typeof accountLedgerApi?.peek === "function"
    ? accountLedgerApi.peek(actor).map((account, index) => ({
        ...nativeAccounts[index],
        ...account,
        typeName: nativeAccounts[index]?.typeName ?? account.type,
        primary: account.kind === "base",
      }))
    : nativeAccounts;
  const accounts = accountRows.map((account) => ({
    ...account,
    balanceText: formatLedgerCurrency(account.balance),
    negative: account.balance < 0,
  }));
  return {
    ...cwnit,
    combatWeapons: cwnit.weapons.filter((attack) => attack.item?.system?.location === "readied"),
    skillsUnlocked,
    advancedConfigOpen,
    accountsOpen,
    isGM: Boolean(globalThis.game?.user?.isGM),
    hasActionCentre: typeof globalThis.game?.cwnCombatEnhancements?.actions?.open === "function",
    visiblePowers,
    accountLedgerAvailable: typeof accountLedgerApi?.history === "function",
    accounts,
    primaryAccount: accounts[0],
    skillRankTiers: Object.fromEntries(
      cwnit.skills.map((skill) => [skill.id ?? skill._id, skillRankTier(skill.system?.rank)]),
    ),
    vitals: {
      rangedAc: system.ac ?? system.baseAc ?? 10,
      meleeAc: system.meleeAc ?? system.ac ?? system.baseAc ?? 10,
      soakValue: system.soakTotal?.value ?? system.soak?.value ?? 0,
      soakMax: system.soakTotal?.max ?? system.soak?.max ?? 0,
      traumaTarget: system.modifiedTraumaTarget ?? system.traumaTarget ?? "—",
      strainValue: system.systemStrain?.value ?? system.strain?.value ?? 0,
      strainMax: system.systemStrain?.max ?? system.strain?.max ?? 0,
      strainConstitution: system.stats?.con?.total ?? 0,
      strainCyberware: system.systemStrain?.cyberware ?? 0,
      strainPermanent: system.systemStrain?.permanent ?? 0,
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

function accountReference(target) {
  const id = String(target?.dataset?.accountId ?? "").trim();
  if (id) return id;
  if (target?.dataset?.accountKind === "base") return { kind: "base" };
  return { kind: "extra", index: Number(target?.dataset?.accountIndex) };
}

function accountApi() {
  return globalThis.game?.cwnCombatEnhancements?.accounts ?? null;
}

function currencyTypeOptions(selected = "base") {
  const values = [["base", globalThis.game?.settings?.get?.("swnr", "baseCurrencyName") ?? "Dollars"]];
  for (let index = 0; index < 5; index += 1) {
    const name = globalThis.game?.settings?.get?.("swnr", `customCurrencyName${index}`);
    if (name) values.push([String(index), name]);
  }
  return values.map(([value, label]) =>
    `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

async function promptNewAccount() {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.prompt) return null;
  return DialogV2.prompt({
    classes: ["cwnit-account-management-dialog"],
    window: { title: "New Account" },
    modal: true,
    rejectClose: false,
    content: `<div class="cwnit-account-form"><label>Name<input name="name" type="text" maxlength="80" required autofocus></label><label>Starting Balance<input name="balance" type="number" step="1" value="0" required></label><label>Currency Type<select name="type">${currencyTypeOptions()}</select></label><label class="cwnit-sheet__config-check"><input name="carried" type="checkbox"> Carried by the character</label></div>`,
    ok: {
      label: "Create Account",
      icon: "fa-solid fa-plus",
      callback: (_event, button) => ({
        name: String(button.form.elements.name.value ?? "").trim(),
        balance: button.form.elements.balance.value,
        type: button.form.elements.type.value,
        carried: button.form.elements.carried.checked,
      }),
    },
  });
}

async function promptAccountManagement(account) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  return DialogV2.wait({
    classes: ["cwnit-account-management-dialog"],
    window: { title: `Manage ${account.name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="cwnit-account-form"><label>Name<input name="name" type="text" maxlength="80" value="${escapeHtml(account.name)}" required></label><label>Currency Type<select name="type">${currencyTypeOptions(account.type)}</select></label><label class="cwnit-sheet__config-check"><input name="carried" type="checkbox"${account.carried ? " checked" : ""}> Carried by the character</label><p>Balances are changed only through Transactions. Historical entries are append-only.</p></div>`,
    buttons: [
      {
        action: "save",
        label: "Save",
        icon: "fa-solid fa-floppy-disk",
        default: true,
        callback: (_event, button) => ({
          action: "save",
          data: {
            name: String(button.form.elements.name.value ?? "").trim(),
            type: button.form.elements.type.value,
            carried: button.form.elements.carried.checked,
          },
        }),
      },
      { action: "convert", label: "Convert to Dollars", icon: "fa-solid fa-right-left", callback: () => ({ action: "convert" }) },
      { action: "delete", label: "Delete", icon: "fa-solid fa-trash", callback: () => ({ action: "delete" }) },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark", callback: () => null },
    ],
  });
}

async function confirmAccountDeletion(account) {
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return false;
  return DialogV2.wait({
    window: { title: "Delete Account" },
    modal: true,
    rejectClose: false,
    content: `<p>Delete <strong>${escapeHtml(account.name)}</strong>? Its transaction history will be archived and retained.</p>`,
    buttons: [
      { action: "delete", label: "Delete Account", icon: "fa-solid fa-trash", callback: () => true },
      { action: "cancel", label: "Cancel", icon: "fa-solid fa-xmark", default: true, callback: () => false },
    ],
  });
}

function notifyAccountError(error) {
  console.warn(`${MODULE_ID} | Account operation failed`, error);
  globalThis.ui?.notifications?.warn?.(error?.message ?? "The account operation could not be completed.");
}

async function postActorChat(actor, content) {
  const ChatMessageClass = globalThis.ChatMessage;
  if (typeof ChatMessageClass?.create !== "function") return;
  await ChatMessageClass.create({
    speaker: ChatMessageClass.getSpeaker?.({ actor }) ?? { actor: actor?.id },
    content,
  });
}

function soakSnapshot(actor) {
  const system = actor?.system ?? {};
  return {
    value: number(system.soakTotal?.value ?? system.soak?.value),
    max: number(system.soakTotal?.max ?? system.soak?.max),
  };
}

async function usedSceneActions(actor) {
  const api = globalThis.game?.cwnCombatEnhancements;
  const providers = [api?.focus?.availableActions, api?.edge?.availableActions]
    .filter((provider) => typeof provider === "function");
  const actions = [];
  for (const provider of providers) {
    const entries = await Promise.resolve(provider(actor));
    actions.push(...Array.from(entries ?? []).filter((entry) => entry.cadence === "scene" && entry.available === false));
  }
  return Array.from(new Map(actions.map((action) => [action.key, action])).values());
}

async function resetCombatEnhancementSceneUsage(actor) {
  const resetUsage = globalThis.game?.cwnCombatEnhancements?.actions?.resetUsage;
  if (typeof resetUsage !== "function") return [];
  const used = await usedSceneActions(actor);
  const sceneId = globalThis.canvas?.scene?.id ?? "manual";
  await resetUsage(actor, (key) => key === `scene:${sceneId}`);
  return used;
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
        scene: this._onSceneWithSummary,
        declareAction: this._onDeclareAction,
        toggleSkillControls: this._onToggleSkillControls,
        skillUp: this._onSkillUpWithChat,
        openLinkedActor: this._onOpenLinkedActor,
        openAccountLedger: this._onOpenAccountLedger,
        addLedgerAccount: this._onAddLedgerAccount,
        editLedgerAccount: this._onEditLedgerAccount,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/character/header-v081.hbs` },
      combat: { template: `modules/${MODULE_ID}/templates/sheets/character/combat-v081.hbs` },
      skills: { template: `modules/${MODULE_ID}/templates/sheets/character/skills-v082.hbs` },
      inventory: { template: `modules/${MODULE_ID}/templates/sheets/character/inventory-v090.hbs` },
      cyberware: { template: `modules/${MODULE_ID}/templates/sheets/character/cyberware-v062.hbs` },
      features: { template: `modules/${MODULE_ID}/templates/sheets/character/features-v081.hbs` },
      actions: { template: `modules/${MODULE_ID}/templates/sheets/character/actions-v080.hbs` },
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
      options.parts = ["header", "combat", "skills", "inventory"];
      if (this.document.system?.tweak?.showCyberware) options.parts.push("cyberware");
      options.parts.push("features", "actions", "biography", "tabs");
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
          advancedConfigOpen: Boolean(this._cwnitAdvancedConfigOpen),
          accountsOpen: Boolean(this._cwnitAccountsOpen),
        },
      );
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    _onRender(context, options) {
      super._onRender(context, options);
      const bindDetailsState = (selector, property) => {
        const details = this.element?.querySelector?.(selector);
        if (!details) return;
        details.addEventListener("toggle", () => {
          this[property] = details.open;
        });
      };
      bindDetailsState(".cwnit-sheet__advanced-config", "_cwnitAdvancedConfigOpen");
      bindDetailsState(".cwnit-sheet__accounts-drawer", "_cwnitAccountsOpen");

      const activeTab = this.tabGroups?.primary ?? "combat";
      const scrollContainer = this.element?.querySelector?.(".cwnit-sheet__body.active");
      if (!scrollContainer) return;

      this._cwnitScrollPositions ??= new Map();
      const savedPosition = this._cwnitScrollPositions.get(activeTab);
      if (Number.isFinite(savedPosition)) scrollContainer.scrollTop = savedPosition;

      scrollContainer.addEventListener("scroll", () => {
        this._cwnitScrollPositions.set(activeTab, scrollContainer.scrollTop);
      }, { passive: true });

      for (const tabControl of this.element?.querySelectorAll?.("nav.tabs > [data-tab]") ?? []) {
        tabControl.addEventListener("click", () => {
          const nextTab = tabControl.dataset.tab;
          if (!nextTab || nextTab === activeTab) return;
          this._cwnitScrollPositions.set(nextTab, 0);
        });
      }
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
      if (combatant?.id) {
        // SWNR installs its Combatant initiative adapter only for GM clients.
        // Supplying the actor's native formula explicitly preserves actor-level
        // initiative advantage and modifiers when an owning player rolls too.
        const nativeRoll = this.actor?.rollInitiative?.();
        const formula = typeof nativeRoll?.formula === "string" ? nativeRoll.formula.trim() : "";
        const options = formula ? { formula } : undefined;
        await combat.rollInitiative([combatant.id], options);
      }
    }

    static async _onSceneWithSummary(event, target) {
      event.preventDefault();
      const beforeSoak = soakSnapshot(this.actor);
      let refreshResult = null;
      const refreshActor = globalThis.swnr?.utils?.refreshActor;
      if (typeof refreshActor === "function") {
        refreshResult = await refreshActor({ actor: this.actor, cadence: "scene", createChat: false });
        await this._resetSoak();
      } else {
        const nativeScene = SWNActorSheet.DEFAULT_OPTIONS?.actions?.scene ?? SWNActorSheet._onScene;
        if (typeof nativeScene === "function") await nativeScene.call(this, event, target);
      }

      const refreshedActions = await resetCombatEnhancementSceneUsage(this.actor);
      const afterSoak = soakSnapshot(this.actor);
      const soakChanged = beforeSoak.value !== afterSoak.value || beforeSoak.max !== afterSoak.max;
      const details = [
        `<li><strong>Soak:</strong> ${soakChanged ? `${beforeSoak.value}/${beforeSoak.max} → ${afterSoak.value}/${afterSoak.max}` : `${afterSoak.value}/${afterSoak.max} (already full)`}</li>`,
      ];
      const poolsRefreshed = number(refreshResult?.poolsRefreshed);
      const commitmentsReleased = Array.from(refreshResult?.effortReleased ?? []).length;
      if (poolsRefreshed) details.push(`<li><strong>Resource pools:</strong> ${poolsRefreshed} refreshed</li>`);
      if (commitmentsReleased) details.push(`<li><strong>Commitments:</strong> ${commitmentsReleased} released</li>`);
      if (refreshedActions.length) {
        const labels = refreshedActions.map((action) => escapeHtml(action.label)).join("; ");
        details.push(`<li><strong>Scene abilities:</strong> ${refreshedActions.length} refreshed — ${labels}</li>`);
      } else {
        details.push("<li><strong>Scene abilities:</strong> none required recovery</li>");
      }
      const content = `<article class="cwnit-scene-refresh"><header><i class="fa-solid fa-arrows-rotate"></i><h3>Scene Refresh</h3></header><ul>${details.join("")}</ul></article>`;
      await postActorChat(this.actor, content);
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

    static async _onOpenAccountLedger(event, target) {
      event.preventDefault();
      try {
        await openCwnAccountLedger(this.actor, accountReference(target));
      } catch (error) {
        notifyAccountError(error);
      }
    }

    static async _onAddLedgerAccount(event) {
      event.preventDefault();
      const api = accountApi();
      if (typeof api?.create !== "function") {
        globalThis.ui?.notifications?.warn?.("Account transactions require CWN Combat Enhancements 0.22.0 or newer.");
        return;
      }
      const data = await promptNewAccount();
      if (!data) return;
      try {
        await api.create(this.actor, data);
        await this.render({ parts: ["inventory"] });
      } catch (error) {
        notifyAccountError(error);
      }
    }

    static async _onEditLedgerAccount(event, target) {
      event.preventDefault();
      const api = accountApi();
      if (typeof api?.history !== "function") {
        globalThis.ui?.notifications?.warn?.("Account management requires CWN Combat Enhancements 0.22.0 or newer.");
        return;
      }
      const reference = accountReference(target);
      try {
        const { account } = await api.history(this.actor, reference);
        const result = await promptAccountManagement(account);
        if (!result) return;
        if (result.action === "save") await api.update(this.actor, account.id, result.data);
        if (result.action === "convert") await api.convertToBase(this.actor, account.id);
        if (result.action === "delete" && await confirmAccountDeletion(account)) {
          await api.archive(this.actor, account.id);
        }
        await this.render({ parts: ["inventory"] });
      } catch (error) {
        notifyAccountError(error);
      }
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
