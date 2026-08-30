import { MODULE_ID, number, queueMissingBaseWarning, sortDocuments } from "./cwn-sheet-shared-v062.mjs";

export const CYBERDECK_SHEET_LABEL = "CWN Cyberdeck Operations Sheet";
export const PLAYER_ADVANCED_CONFIG_SETTING = "allowPlayerCyberdeckAdvancedConfiguration";
export const CYBERDECK_MODEL_FLAG = "cyberdeckModelKey";

export const CYBERDECK_MODELS = Object.freeze([
  { key: "cranial-jack", name: "Cranial Jack Only", cost: 0, costLabel: "As cyber", bonusAccess: 0, memory: 0, shielding: 0, cpu: 1, encumbrance: 0, encumbranceLabel: "N/A" },
  { key: "scrap-deck", name: "Scrap Deck", cost: 500, costLabel: "$500", bonusAccess: 1, memory: 8, shielding: 5, cpu: 2, encumbrance: 1, encumbranceLabel: "1" },
  { key: "yamagata-tanto", name: "Yamagata Tanto", cost: 5000, costLabel: "$5,000", bonusAccess: 1, memory: 10, shielding: 10, cpu: 3, encumbrance: 1, encumbranceLabel: "1" },
  { key: "redding-tech-icepick", name: "Redding Tech Icepick", cost: 15000, costLabel: "$15,000", bonusAccess: 2, memory: 10, shielding: 10, cpu: 3, encumbrance: 1, encumbranceLabel: "1" },
  { key: "alliance-synapse", name: "Alliance Synapse", cost: 30000, costLabel: "$30,000", bonusAccess: 2, memory: 11, shielding: 5, cpu: 4, encumbrance: 1, encumbranceLabel: "1" },
  { key: "legau-durach-beowulf", name: "Legau-Durach Beowulf", cost: 60000, costLabel: "$60,000", bonusAccess: 2, memory: 13, shielding: 10, cpu: 4, encumbrance: 1, encumbranceLabel: "1" },
  { key: "nova-vida-tizona", name: "Nova Vida Tizona", cost: 100000, costLabel: "$100,000", bonusAccess: 3, memory: 11, shielding: 10, cpu: 5, encumbrance: 1, encumbranceLabel: "1" },
  { key: "guang-taifu", name: "Guang Taifu", cost: 250000, costLabel: "$250,000", bonusAccess: 3, memory: 13, shielding: 15, cpu: 6, encumbrance: 1, encumbranceLabel: "1" },
]);

export function registerCwnCyberdeckSettings(runtime = globalThis) {
  runtime.game?.settings?.register?.(MODULE_ID, PLAYER_ADVANCED_CONFIG_SETTING, {
    name: "CWNIT.Settings.PlayerCyberdeckAdvanced.Name",
    hint: "CWNIT.Settings.PlayerCyberdeckAdvanced.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

export function canUseAdvancedCyberdeckConfiguration(
  actor,
  user = globalThis.game?.user,
  settings = globalThis.game?.settings,
) {
  if (user?.isGM) return true;
  if (!actor?.isOwner) return false;
  try {
    return Boolean(settings?.get?.(MODULE_ID, PLAYER_ADVANCED_CONFIG_SETTING));
  } catch (_error) {
    return false;
  }
}

function escapeHtml(value) {
  const nativeEscape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof nativeEscape === "function") return nativeEscape(String(value ?? ""));
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemsOf(actor) {
  return sortDocuments(actor?.itemTypes?.program ?? actor?.items?.filter?.((item) => item.type === "program") ?? []);
}

function actorItems(actor) {
  if (Array.isArray(actor?.items?.contents)) return actor.items.contents;
  if (actor?.items && typeof actor.items[Symbol.iterator] === "function") return Array.from(actor.items);
  return [];
}

function cwnFocusLevel(actor, focusKey) {
  if (actor?.type !== "character") return 0;
  return actorItems(actor).reduce((highest, item) => {
    const key = item?.type === "feature" && item?.system?.type === "focus"
      ? item.flags?.["cwn-content-pack"]?.focusKey
      : null;
    if (key !== focusKey) return highest;
    return Math.max(highest, Math.max(0, Math.min(2, Math.trunc(number(item.system?.level)))));
  }, 0);
}

export function expertProgrammerCyberdeckRules(hacker) {
  const focusLevel = cwnFocusLevel(hacker, "expert-programmer");
  const characterLevel = Math.max(1, Math.trunc(number(hacker?.system?.level?.value, 1)));
  const programSkill = actorItems(hacker).find((item) => item.type === "skill" && String(item.name).toLowerCase() === "program");
  return {
    focusLevel,
    bonusElements: focusLevel >= 1 ? characterLevel + 2 : 0,
    elementCost: focusLevel >= 2 ? 0.5 : 1,
    cpuBonus: focusLevel >= 2 ? Math.max(0, number(programSkill?.system?.rank, -1)) : 0,
  };
}

export function cyberdeckProgramMemoryState(actor, hacker = null, proposed = []) {
  const programs = [...itemsOf(actor), ...Array.from(proposed).filter((item) => item?.type === "program")];
  const verbs = programs.filter((item) => item.system?.type === "verb");
  const subjects = programs.filter((item) => item.system?.type === "subject");
  const files = programs.filter((item) => item.system?.type === "dataFile");
  const rules = expertProgrammerCyberdeckRules(hacker);
  const writtenElements = verbs.length + subjects.length;
  const freeElements = Math.min(writtenElements, rules.bonusElements);
  const chargedElements = Math.max(0, writtenElements - rules.bonusElements);
  const writtenMemory = chargedElements * rules.elementCost;
  const used = files.length + writtenMemory;
  const max = number(actor?.system?.memory?.max);
  return {
    value: Math.max(0, max - used), max, used, over: Math.max(0, used - max),
    breakdown: {
      verbs: verbs.length,
      subjects: subjects.length,
      writtenElements,
      freeElements,
      chargedElements,
      elementCost: rules.elementCost,
      writtenMemory,
      files: files.length,
      summary: `${writtenElements} written; ${freeElements} free; ${chargedElements} x ${rules.elementCost} = ${writtenMemory} Memory; ${files.length} file${files.length === 1 ? "" : "s"} = ${files.length} Memory`,
    },
    expertProgrammer: rules,
  };
}

function linkedHacker(actor) {
  return actor?.system?.getHacker?.()
    ?? globalThis.game?.actors?.get?.(actor?.system?.hackerId)
    ?? null;
}

export async function approveProgramCapacity(actor, itemData, hacker = linkedHacker(actor)) {
  const proposed = (Array.isArray(itemData) ? itemData : [itemData])
    .filter((item) => item?.type === "program" && ["verb", "subject", "dataFile"].includes(item.system?.type));
  if (!proposed.length) return true;
  const state = cyberdeckProgramMemoryState(actor, hacker, proposed);
  if (state.over <= 0) return true;
  globalThis.ui?.notifications?.warn?.(
    `Cyberdeck Memory full: adding ${proposed.length === 1 ? proposed[0].name || "that program element" : `${proposed.length} items`} would use ${state.used}/${state.max} effective Memory. Expert Programmer benefits are already included.`,
  );
  return false;
}

export async function applyCyberdeckModel(actor, modelKey) {
  const model = CYBERDECK_MODELS.find((entry) => entry.key === modelKey);
  if (!model || !actor?.isOwner) return false;
  await actor.update({
    [`flags.${MODULE_ID}.${CYBERDECK_MODEL_FLAG}`]: model.key,
    "system.bonusAccess": model.bonusAccess,
    "system.memory.max": model.memory,
    "system.cpu.max": model.cpu,
    "system.baseShielding": model.shielding,
    "system.bonusShielding": 0,
    "system.health.value": model.shielding,
    "system.encumberance": model.encumbrance,
    "system.cost": model.cost,
  });
  return true;
}

export function resolveSwnrCyberdeckSheet(runtime = globalThis) {
  const registrations = runtime.foundry?.documents?.collections?.Actors?.registeredSheets ?? [];
  const direct = Array.from(registrations).find((entry) =>
    typeof entry === "function" && entry.name === "SWNCyberdeckSheet",
  );
  if (direct) return direct;
  const descriptor = Array.from(registrations).find((entry) =>
    entry?.sheetClass?.name === "SWNCyberdeckSheet"
      || (entry?.types?.includes?.("cyberdeck") && String(entry?.id ?? "").startsWith("swnr.")),
  );
  return descriptor?.sheetClass ?? null;
}

export function eligibleHackerActors(actors = [], user = globalThis.game?.user) {
  return Array.from(actors)
    .filter((actor) => actor?.type === "character" || actor?.type === "npc")
    .filter((actor) => user?.isGM || actor.testUserPermission?.(user, "OWNER") || actor.isOwner)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export function prepareCyberdeckContext(actor, {
  hacker = null,
  ceStatus = null,
  isGM = false,
  ceAvailable = false,
  canConfigureAdvanced = isGM,
} = {}) {
  const programs = itemsOf(actor);
  const verbs = programs.filter((item) => item.system?.type === "verb");
  const subjects = programs.filter((item) => item.system?.type === "subject");
  const files = programs.filter((item) => item.system?.type === "dataFile");
  const runningPrograms = programs.filter((item) => item.system?.type === "running");
  const programSkill = hacker?.items?.find?.(
    (item) => item.type === "skill" && String(item.name).toLowerCase() === "program",
  );
  const intMod = number(hacker?.system?.stats?.int?.mod);
  const programRank = hacker?.type === "npc"
    ? number(hacker.system?.skillBonus)
    : number(programSkill?.system?.rank);
  const bonusAccess = number(actor?.system?.bonusAccess);
  const hackerAccess = number(hacker?.system?.access?.value);
  const hackerAccessMax = number(hacker?.system?.access?.max);
  const memory = cyberdeckProgramMemoryState(actor, hacker);
  const focusRules = memory.expertProgrammer;
  const nativeCpuMax = number(actor?.system?.cpu?.max);
  const cpuMax = nativeCpuMax + focusRules.cpuBonus;
  const runningCount = runningPrograms.length;
  const cpuFree = Math.max(0, cpuMax - runningCount);
  const selectedModelKey = actor?.getFlag?.(MODULE_ID, CYBERDECK_MODEL_FLAG)
    ?? actor?.flags?.[MODULE_ID]?.[CYBERDECK_MODEL_FLAG]
    ?? "";
  const localResources = {
    access: {
      value: hacker ? hackerAccess + bonusAccess : bonusAccess,
      max: hacker ? hackerAccessMax + bonusAccess : bonusAccess,
      hackerValue: hackerAccess,
      hackerMax: hackerAccessMax,
      bonus: bonusAccess,
    },
    cpu: { value: cpuFree, max: cpuMax, used: runningCount, focusBonus: focusRules.cpuBonus },
    memory,
    shielding: { value: number(actor?.system?.health?.value), max: number(actor?.system?.health?.max) },
  };
  return {
    hacker,
    isGM,
    canConfigureAdvanced,
    ceAvailable,
    ceStatus,
    session: ceStatus?.session ?? null,
    resources: ceStatus?.resources
      ? { ...ceStatus.resources, cpu: localResources.cpu, memory: localResources.memory }
      : localResources,
    hackerStats: { intMod, programRank, programPool: programSkill?.system?.pool ?? "2d6" },
    verbs: verbs.map((item) => ({
      item,
      targets: item.system?.target || "—",
      accessCost: number(item.system?.accessCost),
      cpuLabel: item.system?.selfTerminating ? "Immediate" : "1 CPU ongoing",
      effect: item.system?.useAffects || "—",
    })),
    subjects: subjects.map((item) => ({ item, target: item.system?.target || "—" })),
    files: files.map((item) => ({ item, memory: 1, source: item.flags?.["cwn-combat-enhancements"]?.copiedNetworkFile ?? null })),
    runningPrograms,
    cyberdeckModels: CYBERDECK_MODELS.map((model) => ({ ...model, selected: model.key === selectedModelKey })),
    selectedModel: CYBERDECK_MODELS.find((model) => model.key === selectedModelKey) ?? null,
    notes: actor?.getFlag?.(MODULE_ID, "cyberdeckNotes") ?? actor?.flags?.[MODULE_ID]?.cyberdeckNotes ?? "",
  };
}

export async function updateNativeHackerLink(cyberdeck, hacker, { actors = globalThis.game?.actors } = {}) {
  if (!cyberdeck?.isOwner) return false;
  const currentId = String(cyberdeck.system?.hackerId ?? "");
  const current = currentId ? actors?.get?.(currentId) : null;
  if (current && current.id !== hacker?.id) {
    const remaining = Array.from(current.system?.cyberdecks ?? []).filter((id) => id !== cyberdeck.id);
    await current.update({ "system.cyberdecks": remaining });
  }
  if (!hacker) {
    await cyberdeck.update({ "system.hackerId": null, "system.hacker": "" });
    return true;
  }
  if (hacker.type !== "character" && hacker.type !== "npc") return false;
  const linked = Array.from(hacker.system?.cyberdecks ?? []);
  if (!linked.includes(cyberdeck.id)) {
    await hacker.update({ "system.cyberdecks": [...linked, cyberdeck.id] });
  }
  await cyberdeck.update({ "system.hackerId": hacker.id, "system.hacker": hacker.name });
  return true;
}

export function createCwnCyberdeckSheetClass(SWNCyberdeckSheet) {
  return class CwnCyberdeckSheet extends SWNCyberdeckSheet {
    static DEFAULT_OPTIONS = {
      classes: ["swnr", "actor", "cwnit-cyberdeck-sheet-window"],
      position: { width: 980, height: 760 },
      window: { resizable: true },
      actions: {
        assignHacker: this._onAssignHacker,
        openHacker: this._onOpenHacker,
        unlinkHacker: this._onUnlinkHacker,
        openNetworkConsole: this._onOpenNetworkConsole,
        createCyberdeckItem: this._onCreateCyberdeckItem,
        applyCyberdeckModel: this._onApplyCyberdeckModel,
        reprogramAccess: this._onReprogramAccess,
        forceRefreshAccess: this._onForceRefreshAccess,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/header-v0101.hbs` },
      operations: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/operations-v0100.hbs` },
      programs: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/programs-v0101.hbs` },
      files: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/files-v0100.hbs` },
      configuration: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/configuration-v0101.hbs` },
      notes: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/notes-v0100.hbs` },
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
      options.parts = ["header", "operations", "programs", "files", "configuration", "notes", "tabs"];
    }

    _getTabs(parts, defaultTab = "operations") {
      const group = "primary";
      if (!this.tabGroups[group]) this.tabGroups[group] = defaultTab;
      const labels = {
        operations: "Operations",
        programs: "Programs",
        files: "Files",
        configuration: "Configuration",
        notes: "Notes",
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
      const hacker = this.actor.system?.getHacker?.()
        ?? globalThis.game?.actors?.get?.(this.actor.system?.hackerId)
        ?? null;
      const ceApi = globalThis.game?.modules?.get?.("cwn-combat-enhancements")?.api?.networkConsole;
      const ceStatus = typeof ceApi?.getCyberdeckStatus === "function"
        ? await ceApi.getCyberdeckStatus(this.actor.uuid).catch?.(() => null) ?? null
        : null;
      context.cwnit = prepareCyberdeckContext(this.actor, {
        hacker,
        ceStatus,
        isGM: Boolean(globalThis.game?.user?.isGM),
        ceAvailable: typeof ceApi?.open === "function",
        canConfigureAdvanced: canUseAdvancedCyberdeckConfiguration(this.actor),
      });
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    async _onDropActor(_event, data) {
      const hacker = data?.uuid ? await globalThis.fromUuid?.(data.uuid) : null;
      const allowed = hacker && (globalThis.game?.user?.isGM
        || hacker.testUserPermission?.(globalThis.game.user, "OWNER")
        || hacker.isOwner);
      if (!allowed || (hacker.type !== "character" && hacker.type !== "npc")) {
        globalThis.ui?.notifications?.warn?.("Only an owned Character or NPC can be assigned as this cyberdeck's hacker.");
        return false;
      }
      return updateNativeHackerLink(this.actor, hacker);
    }

    async _onDropItemCreate(itemData, event) {
      if (!await approveProgramCapacity(this.actor, itemData)) return false;
      return super._onDropItemCreate(itemData, event);
    }

    static async _onCreateCyberdeckItem(event, target) {
      event.preventDefault();
      const programType = target.dataset["system.type"] ?? target.getAttribute?.("data-system.type") ?? "verb";
      const proposed = {
        name: programType === "subject" ? "New Subject" : "New Verb",
        type: target.dataset.type,
        system: { type: programType },
      };
      if (!await approveProgramCapacity(this.actor, proposed)) return;
      const nativeCreate = SWNCyberdeckSheet.DEFAULT_OPTIONS?.actions?.createDoc;
      if (typeof nativeCreate !== "function") {
        globalThis.ui?.notifications?.error?.("SWNR's native Item creation action is unavailable.");
        return;
      }
      return nativeCreate.call(this, event, target);
    }

    static async _onApplyCyberdeckModel(event) {
      event.preventDefault();
      if (!canUseAdvancedCyberdeckConfiguration(this.actor)) return;
      const modelKey = this.element?.querySelector?.('[name="cwnitCyberdeckModel"]')?.value;
      const model = CYBERDECK_MODELS.find((entry) => entry.key === modelKey);
      if (!model) {
        globalThis.ui?.notifications?.warn?.("Choose a Cyberdeck model first.");
        return;
      }
      const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
      const confirmed = typeof DialogV2?.confirm === "function"
        ? await DialogV2.confirm({
          window: { title: `Apply ${model.name}` },
          content: `<p>Replace this deck's Bonus Access, Memory, CPU, Shielding, Encumbrance, and Cost with the published ${escapeHtml(model.name)} defaults?</p><p>Shielding will be restored to the model's base maximum. Programs and files are not removed.</p>`,
          modal: true,
        })
        : false;
      if (!confirmed) return;
      await applyCyberdeckModel(this.actor, model.key);
      const state = cyberdeckProgramMemoryState(this.actor, linkedHacker(this.actor));
      if (state.over > 0) globalThis.ui?.notifications?.warn?.(`Model applied, but existing programs exceed effective Memory by ${state.over}. Nothing was removed.`);
    }

    static async _onReprogramAccess(event) {
      event.preventDefault();
      const hacker = linkedHacker(this.actor);
      const api = globalThis.game?.cwnCombatEnhancements?.access;
      if (!hacker) {
        globalThis.ui?.notifications?.warn?.("Assign a hacker before refreshing Access.");
        return;
      }
      if (typeof api?.reprogram !== "function") {
        globalThis.ui?.notifications?.warn?.("Enable the matching CWN Combat Enhancements release to track the rules-based Access refresh.");
        return;
      }
      try {
        const result = await api.reprogram(hacker, { cyberdeck: this.actor });
        if (result?.alreadyFull) globalThis.ui?.notifications?.info?.("Access is already full; the daily refresh was not used.");
      } catch (error) {
        globalThis.ui?.notifications?.warn?.(error?.message ?? "Access could not be refreshed.");
      }
    }

    static async _onForceRefreshAccess(event) {
      event.preventDefault();
      if (!canUseAdvancedCyberdeckConfiguration(this.actor)) return;
      const hacker = linkedHacker(this.actor);
      const api = globalThis.game?.cwnCombatEnhancements?.access;
      if (!hacker) {
        globalThis.ui?.notifications?.warn?.("Assign a hacker before refreshing Access.");
        return;
      }
      if (typeof api?.forceRefresh !== "function") {
        globalThis.ui?.notifications?.warn?.("Enable the matching CWN Combat Enhancements release to use the Access override.");
        return;
      }
      const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
      if (!DialogV2?.wait) return;
      const choice = await DialogV2.wait({
        window: { title: "Force Refresh Access" },
        modal: true,
        rejectClose: false,
        content: `<form><p class="notification warning">Administrative override: this ignores the one-hour and once-per-day rules.</p><label class="checkbox"><input type="checkbox" name="resetDaily"> Reset legitimate daily refresh tracking for regression testing</label></form>`,
        buttons: [
          { action: "refresh", label: "Force Refresh", default: true, callback: (_dialogEvent, button) => ({ confirmed: true, resetDailyTracking: button.form.elements.resetDaily.checked }) },
          { action: "cancel", label: "Cancel", callback: () => null },
        ],
        close: () => null,
      });
      if (!choice?.confirmed) return;
      try {
        const result = await api.forceRefresh(hacker, { cyberdeck: this.actor, resetDailyTracking: choice.resetDailyTracking });
        globalThis.ui?.notifications?.info?.(result?.alreadyFull ? "Access is already full." : "Access force-refreshed.");
      } catch (error) {
        globalThis.ui?.notifications?.warn?.(error?.message ?? "Access could not be force-refreshed.");
      }
    }

    static async _onAssignHacker(event) {
      event.preventDefault();
      const collection = globalThis.game?.actors;
      const candidates = eligibleHackerActors(collection?.contents ?? collection ?? []);
      if (!candidates.length) {
        globalThis.ui?.notifications?.warn?.("No eligible Character or NPC Actors are available.");
        return;
      }
      const currentId = this.actor.system?.hackerId ?? "";
      const options = candidates.map((actor) =>
        `<option value="${escapeHtml(actor.id)}" ${actor.id === currentId ? "selected" : ""}>${escapeHtml(actor.name)} (${escapeHtml(actor.type)})</option>`,
      ).join("");
      const selectedId = await globalThis.foundry?.applications?.api?.DialogV2?.prompt?.({
        window: { title: `Assign Hacker — ${this.actor.name}` },
        content: `<label class="cwnit-cyberdeck__picker">Hacker<select name="hackerId">${options}</select></label><p>Players see only Character or NPC Actors they own.</p>`,
        modal: true,
        rejectClose: false,
        ok: { label: "Assign Hacker", callback: (_event, button) => button.form.elements.hackerId.value },
      });
      const hacker = collection?.get?.(selectedId);
      if (!hacker) return;
      const allowed = globalThis.game?.user?.isGM || hacker.testUserPermission?.(globalThis.game.user, "OWNER") || hacker.isOwner;
      if (!allowed) return;
      await updateNativeHackerLink(this.actor, hacker);
    }

    static async _onOpenHacker(event) {
      event.preventDefault();
      const hacker = globalThis.game?.actors?.get?.(this.actor.system?.hackerId);
      await hacker?.sheet?.render?.(true);
    }

    static async _onUnlinkHacker(event) {
      event.preventDefault();
      await updateNativeHackerLink(this.actor, null);
    }

    static async _onOpenNetworkConsole(event) {
      event.preventDefault();
      const api = globalThis.game?.modules?.get?.("cwn-combat-enhancements")?.api?.networkConsole;
      if (typeof api?.open !== "function") {
        globalThis.ui?.notifications?.info?.("Enable CWN Combat Enhancements and its Network Console to use live network operations.");
        return;
      }
      api.open({ cyberdeckUuid: this.actor.uuid, hackerUuid: this.actor.system?.hackerId ? `Actor.${this.actor.system.hackerId}` : "" });
    }
  };
}

export function registerCwnCyberdeckSheet(runtime = globalThis) {
  const base = resolveSwnrCyberdeckSheet(runtime);
  const actorSheets = runtime.foundry?.documents?.collections?.Actors;
  if (!base || typeof actorSheets?.registerSheet !== "function") {
    queueMissingBaseWarning(runtime);
    return null;
  }
  const SheetClass = createCwnCyberdeckSheetClass(base);
  actorSheets.registerSheet(MODULE_ID, SheetClass, {
    types: ["cyberdeck"],
    makeDefault: false,
    label: CYBERDECK_SHEET_LABEL,
  });
  return SheetClass;
}
