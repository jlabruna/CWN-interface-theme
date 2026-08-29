import { MODULE_ID, number, queueMissingBaseWarning, sortDocuments } from "./cwn-sheet-shared-v062.mjs";

export const CYBERDECK_SHEET_LABEL = "CWN Cyberdeck Operations Sheet";

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
  const memoryFree = number(actor?.system?.memory?.value);
  const memoryMax = number(actor?.system?.memory?.max);
  const cpuFree = number(actor?.system?.cpu?.value);
  const cpuMax = number(actor?.system?.cpu?.max);
  return {
    hacker,
    isGM,
    ceAvailable,
    ceStatus,
    session: ceStatus?.session ?? null,
    resources: ceStatus?.resources ?? {
      access: {
        value: hacker ? hackerAccess + bonusAccess : bonusAccess,
        max: hacker ? hackerAccessMax + bonusAccess : bonusAccess,
        hackerValue: hackerAccess,
        hackerMax: hackerAccessMax,
        bonus: bonusAccess,
      },
      cpu: { value: cpuFree, max: cpuMax, used: Math.max(0, cpuMax - cpuFree) },
      memory: {
        value: memoryFree,
        max: memoryMax,
        used: Math.max(0, memoryMax - memoryFree),
        breakdown: { verbs: verbs.length, subjects: subjects.length, files: files.length },
      },
      shielding: { value: number(actor?.system?.health?.value), max: number(actor?.system?.health?.max) },
    },
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
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/header-v0100.hbs` },
      operations: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/operations-v0100.hbs` },
      programs: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/programs-v0100.hbs` },
      files: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/files-v0100.hbs` },
      configuration: { template: `modules/${MODULE_ID}/templates/sheets/cyberdeck/configuration-v0100.hbs` },
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
