import {
  MODULE_ID,
  number,
  queueMissingBaseWarning,
  sortDocuments,
} from "./cwn-sheet-shared-v062.mjs?v=0.12.1";
import { resolveSwnrVehicleSheet } from "./cwn-drone-sheet-v0100.mjs?v=0.12.1";

export const VEHICLE_SHEET_LABEL = "CWN Vehicle Operations Sheet";
export const PLAYER_VEHICLE_ADVANCED_CONFIG_SETTING = "allowPlayerVehicleAdvancedConfiguration";

export function registerCwnVehicleSettings(runtime = globalThis) {
  runtime.game?.settings?.register?.(MODULE_ID, PLAYER_VEHICLE_ADVANCED_CONFIG_SETTING, {
    name: "Allow Players to Edit Vehicle Advanced Configuration",
    hint: "Owners can edit raw Vehicle source fields and Effects. When disabled, players retain the operational sheet and read-only Configuration summary.",
    scope: "world", config: true, type: Boolean, default: false, restricted: true,
  });
}

export function canUseAdvancedVehicleConfiguration(actor, {
  user = globalThis.game?.user,
  settings = globalThis.game?.settings,
} = {}) {
  if (user?.isGM) return true;
  if (!owns(actor, user)) return false;
  try { return Boolean(settings?.get?.(MODULE_ID, PLAYER_VEHICLE_ADVANCED_CONFIG_SETTING)); }
  catch (_error) { return false; }
}

const normalized = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en");

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
  if (typeof escape === "function") return escape(String(value ?? ""));
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function plainText(value, maximumLength = 240) {
  const text = String(value ?? "").replaceAll(/<br\s*\/?>/giu, " ").replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/\s+/gu, " ").trim();
  if (!text) return "Open this Item for full details.";
  return text.length > maximumLength ? `${text.slice(0, maximumLength - 1).trimEnd()}…` : text;
}

function vehicleApi() {
  return globalThis.game?.cwnCombatEnhancements?.vehicle ?? null;
}

function owns(actor, user = globalThis.game?.user) {
  return Boolean(user?.isGM || actor?.testUserPermission?.(user, "OWNER") || actor?.isOwner);
}

function assertManager(actor) {
  if (!owns(actor)) throw new Error("Only a GM or Vehicle owner can make that change.");
}

function resourceUsage(resource = {}) {
  const maximum = number(resource.max);
  const remaining = number(resource.value, maximum);
  return { maximum, remaining, used: maximum - remaining, over: remaining < 0 };
}

function ammoLabel(ammo = {}) {
  if (!ammo.type || ammo.type === "none") return "—";
  if (ammo.type === "infinite") return "∞";
  return `${number(ammo.value)} / ${number(ammo.max)}`;
}

function cloneData(value, fallback = {}) {
  if (value == null) return fallback;
  const clone = globalThis.foundry?.utils?.deepClone;
  if (typeof clone === "function") return clone(value);
  return JSON.parse(JSON.stringify(value));
}

export function mountableVehicleWeapons(vehicle) {
  return sortDocuments(vehicle?.itemTypes?.weapon ?? [])
    .filter((item) => !item.system?.destroyed);
}

export function mountedWeaponDataFromCarriedWeapon(item, {
  power = 0,
  mass = 0,
  hardpoint = 1,
  minClass = "s",
} = {}) {
  if (item?.type !== "weapon") throw new Error("Only a carried SWNR Weapon can be converted into a mounted weapon.");
  const source = typeof item.toObject === "function" ? item.toObject() : item;
  const system = source.system ?? {};
  return {
    name: source.name ?? item.name ?? "Mounted Weapon",
    img: source.img ?? item.img,
    type: "shipWeapon",
    system: {
      description: system.description ?? "",
      favorite: Boolean(system.favorite),
      tl: system.tl ?? null,
      broken: Boolean(system.broken),
      destroyed: Boolean(system.destroyed),
      juryRigged: Boolean(system.juryRigged),
      cost: number(system.cost),
      costMultiplier: Boolean(system.costMultiplier),
      mass: Math.max(0, number(mass)),
      massMultiplier: false,
      power: Math.max(0, number(power)),
      powerMultiplier: false,
      minClass: String(minClass || "s"),
      type: "vehicle",
      damage: system.damage ?? "",
      ab: number(system.ab ?? system.attackBonus),
      hardpoint: Math.max(0, number(hardpoint, 1)),
      qualities: system.qualities ?? "",
      ammo: cloneData(system.ammo, { type: "none", max: 0, value: 0 }),
      trauma: cloneData(system.trauma, { die: "1d6", rating: "", vehicle: false }),
      range: cloneData(system.range, { normal: 1, max: 2 }),
      stat: typeof system.stat === "string" ? system.stat : "dex",
    },
    flags: cloneData(source.flags, {}),
  };
}

function prepareMountedWeapon(vehicle, item, { resolveActor, user }) {
  const api = vehicleApi();
  const gunner = api?.gunner?.(item, { resolveActor }) ?? (() => {
    const id = item.getFlag?.("cwn-combat-enhancements", "vehicleGunnerActorId")
      ?? item.flags?.["cwn-combat-enhancements"]?.vehicleGunnerActorId;
    return id ? resolveActor(id) : null;
  })();
  const trauma = item.system?.trauma ?? {};
  const manager = owns(vehicle, user);
  const canAttack = Boolean(gunner && (manager || gunner.testUserPermission?.(user, "OWNER") || gunner.isOwner));
  return {
    item,
    gunner,
    canAttack,
    canRequestAttack: manager || canAttack,
    canManage: manager,
    damage: item.system?.damage || "—",
    attackBonus: number(item.system?.ab),
    stat: String(item.system?.stat || "dex").toUpperCase(),
    ammo: ammoLabel(item.system?.ammo),
    canReload: manager && item.system?.ammo?.type && !["none", "infinite"].includes(item.system.ammo.type),
    range: `${number(item.system?.range?.normal)} / ${number(item.system?.range?.max)}`,
    trauma: trauma.die && trauma.rating != null ? `${trauma.die} ×${number(trauma.rating, 1)}` : "—",
    power: number(item.system?.power),
    mass: number(item.system?.mass),
    hardpoints: number(item.system?.hardpoint, 1),
    minClass: String(item.system?.minClass || "—").toUpperCase(),
  };
}

function prepareVehicleItem(item) {
  return {
    item,
    power: number(item.system?.power),
    mass: number(item.system?.mass),
    minClass: String(item.system?.minClass || "—").toUpperCase(),
    summary: plainText(item.system?.effect || item.system?.description),
  };
}

function prepareCargoItem(item) {
  return {
    item,
    quantity: number(item.system?.quantity, 1),
    encumbrance: number(item.system?.encumbrance),
    location: item.system?.location || "—",
  };
}

function prepareEffect(effect) {
  return {
    effect,
    parentId: effect?.parent?.id ?? "",
    source: effect?.sourceName ?? effect?.parent?.name ?? "Vehicle",
    duration: effect?.duration?.label ?? "—",
  };
}

export function eligibleVehicleCrew(actors = [], user = globalThis.game?.user) {
  return Array.from(actors ?? [])
    .filter((actor) => actor?.type === "character" || actor?.type === "npc")
    .filter((actor) => user?.isGM || actor.testUserPermission?.(user, "OWNER") || actor.isOwner)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

export function linkedVehiclesForDriver(actor, {
  actors = globalThis.game?.actors?.contents ?? globalThis.game?.actors ?? [],
  user = globalThis.game?.user,
} = {}) {
  return Array.from(actors ?? [])
    .filter((vehicle) => vehicle?.type === "vehicle" && String(vehicle.system?.crewMembers?.[0] ?? "") === String(actor?.id ?? ""))
    .filter((vehicle) => user?.isGM || vehicle.testUserPermission?.(user, "OBSERVER") || vehicle.isOwner)
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function fallbackAc(vehicle, driver) {
  const base = number(vehicle?._source?.system?.ac, vehicle?.system?.ac ?? 10);
  const operating = Boolean(vehicle?.getFlag?.("cwn-combat-enhancements", "vehicleOperating")
    ?? vehicle?.flags?.["cwn-combat-enhancements"]?.vehicleOperating);
  const drive = Math.max(0, driver?.type === "npc"
    ? number(driver.system?.skillBonus)
    : number(Array.from(driver?.itemTypes?.skill ?? driver?.items ?? []).find((item) => item.type === "skill" && normalized(item.name) === "drive")?.system?.rank, -1));
  return { base, driver, driveRank: drive, operating, modifier: operating ? drive : -4, effective: base + (operating ? drive : -4), stateLabel: operating ? "Operating" : "Stationary" };
}

export function prepareVehicleSheetContext(actor, {
  resolveActor = (id) => globalThis.game?.actors?.get?.(id) ?? null,
  user = globalThis.game?.user,
} = {}) {
  const api = vehicleApi();
  const driver = api?.driver?.(actor, { resolveActor }) ?? resolveActor(actor.system?.crewMembers?.[0]) ?? null;
  const ac = api?.ac?.(actor, { resolveActor }) ?? fallbackAc(actor, driver);
  ac.modifierText = `${ac.modifier >= 0 ? "+" : ""}${ac.modifier}`;
  ac.driveText = `${ac.driveRank >= 0 ? "+" : ""}${ac.driveRank}`;
  const mountedWeapons = sortDocuments(actor.itemTypes?.shipWeapon ?? []).map((item) => prepareMountedWeapon(actor, item, { resolveActor, user }));
  const allEffects = actor?.allApplicableEffects?.() ?? actor?.effects ?? [];
  const healthValue = number(actor.system?.health?.value);
  const canManage = owns(actor, user);
  return {
    driver,
    ac,
    canManage,
    canConfigureAdvanced: canUseAdvancedVehicleConfiguration(actor, { user }),
    totalled: healthValue <= 0,
    mountedWeapons,
    fittings: sortDocuments(actor.itemTypes?.shipFitting ?? []).map(prepareVehicleItem),
    defenses: sortDocuments(actor.itemTypes?.shipDefense ?? []).map(prepareVehicleItem),
    cargoItems: sortDocuments(actor.system?.carriedGear ?? []).map(prepareCargoItem),
    mountableWeapons: mountableVehicleWeapons(actor),
    cargoResources: Array.from(actor.system?.cargoCarried ?? []).map((entry, index) => ({ ...entry, index })),
    effects: sortDocuments(Array.from(allEffects)).map(prepareEffect),
    powerUsage: resourceUsage(actor.system?.power),
    massUsage: resourceUsage(actor.system?.mass),
    hardpointUsage: resourceUsage(actor.system?.hardpoints),
    cargoUsage: { used: number(actor.system?.cargo?.value), maximum: number(actor.system?.cargo?.max) },
    baseAc: number(actor?._source?.system?.ac, ac.base),
    hasSupportingModule: Boolean(api),
  };
}

export async function setVehicleDriver(vehicle, driver) {
  assertManager(vehicle);
  if (!driver || (driver.type !== "character" && driver.type !== "npc")) throw new Error("A Driver must be a Character or NPC Actor.");
  if (String(vehicle.system?.crewMembers?.[0] ?? "") === String(driver.id)) return { changed: false, driver };
  await vehicle.update({ "system.crewMembers": [driver.id], "system.crew.current": 1 });
  globalThis.ui?.notifications?.info?.(`${driver.name} is now driving ${vehicle.name}.`);
  return { changed: true, driver };
}

export async function clearVehicleDriver(vehicle) {
  assertManager(vehicle);
  if (!vehicle.system?.crewMembers?.[0]) return { changed: false };
  await vehicle.update({ "system.crewMembers": [], "system.crew.current": 0 });
  globalThis.ui?.notifications?.info?.(`${vehicle.name}'s Driver was unlinked.`);
  return { changed: true };
}

async function chooseCrew({ title, selectedId = "" } = {}) {
  const collection = globalThis.game?.actors;
  const candidates = eligibleVehicleCrew(collection?.contents ?? collection ?? []);
  if (!candidates.length) throw new Error("No eligible Character or NPC Actors are available.");
  const options = candidates.map((actor) => `<option value="${escapeHtml(actor.id)}" ${actor.id === selectedId ? "selected" : ""}>${escapeHtml(actor.name)} (${escapeHtml(actor.type)})</option>`).join("");
  const id = await globalThis.foundry?.applications?.api?.DialogV2?.prompt?.({
    window: { title }, modal: true, rejectClose: false,
    content: `<label class="cwnit-drone__pilot-picker">Actor<select name="actorId">${options}</select></label>`,
    ok: { label: "Assign", callback: (_event, button) => button.form.elements.actorId.value },
  });
  return id ? collection?.get?.(id) ?? null : null;
}

async function postVehicleChat(vehicle, title, content) {
  const Chat = globalThis.ChatMessage;
  if (typeof Chat?.create !== "function") return;
  await Chat.create({
    speaker: Chat.getSpeaker?.({ actor: vehicle }) ?? { actor: vehicle.id },
    content: `<article class="cwnit-vehicle-chat"><header><i class="fa-solid fa-car-side"></i><h3>${escapeHtml(title)}</h3></header>${content}</article>`,
  });
}

async function approveVehicleCapacity(vehicle, itemData) {
  const api = vehicleApi();
  if (typeof api?.capacity !== "function") {
    globalThis.ui?.notifications?.error?.("Vehicle capacity checks require CWN Combat Enhancements 0.26.0 or newer.");
    return false;
  }
  const check = api.capacity(vehicle, itemData);
  if (check.valid) return true;
  const details = check.reasons.join(" ");
  if (!globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.error?.(`${vehicle.name}: ${details}`);
    return false;
  }
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    globalThis.ui?.notifications?.error?.(`${vehicle.name}: ${details}`);
    return false;
  }
  return Boolean(await DialogV2.wait({
    window: { title: "Exceed Vehicle Capacity?" }, modal: true, rejectClose: false,
    content: `<p>${escapeHtml(details)}</p><p>Continue only for an intentionally custom Vehicle. Existing Items will not be removed.</p>`,
    buttons: [
      { action: "override", label: "Add Over Capacity", default: true, callback: () => true },
      { action: "cancel", label: "Cancel", callback: () => false },
    ],
    close: () => false,
  }));
}

function notifyError(error) {
  globalThis.ui?.notifications?.error?.(error?.message ?? String(error));
}

export function createCwnVehicleSheetClass(SWNVehicleSheet) {
  const nativeActions = SWNVehicleSheet.DEFAULT_OPTIONS?.actions ?? {};
  return class CwnVehicleSheet extends SWNVehicleSheet {
    static DEFAULT_OPTIONS = {
      classes: ["swnr", "actor", "vehicle", "cwnit-drone-sheet-window", "cwnit-vehicle-sheet-window"],
      position: { width: 1120, height: 840 },
      window: { resizable: true },
      actions: {
        onEditImage: this._onVehicleEditImage,
        viewDoc: nativeActions.viewDoc,
        deleteDoc: this._onVehicleDeleteDocument,
        reload: this._onVehicleReload,
        toggle: this._onVehicleToggle,
        toggleEffect: this._onVehicleToggleEffect,
        assignDriver: this._onAssignDriver,
        unlinkDriver: this._onUnlinkDriver,
        openActor: this._onOpenActor,
        toggleOperating: this._onToggleOperating,
        assignGunner: this._onAssignGunner,
        unlinkGunner: this._onUnlinkGunner,
        mountExistingWeapon: this._onMountExistingWeapon,
        attackVehicleWeapon: this._onAttackVehicleWeapon,
        repairVehicle: this._onRepairVehicle,
        createDoc: this._onCreateVehicleDocument,
        resourceCreate: this._onVehicleResourceCreate,
        resourceDelete: this._onVehicleResourceDelete,
      },
    };

    static PARTS = {
      header: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/header.hbs` },
      operations: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/operations.hbs` },
      weapons: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/weapons.hbs` },
      fittings: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/fittings.hbs` },
      cargo: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/cargo.hbs` },
      configuration: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/configuration.hbs` },
      notes: { template: `modules/${MODULE_ID}/templates/sheets/vehicle/notes.hbs` },
      tabs: { template: "templates/generic/tab-navigation.hbs" },
    };

    _configureRenderOptions(options) {
      super._configureRenderOptions(options);
      options.defaultTab = "operations";
      options.parts = ["header", "notes", "tabs"];
      if (this.document.limited) { options.defaultTab = "notes"; return; }
      options.parts = ["header", "operations", "weapons", "fittings", "cargo", "configuration", "notes", "tabs"];
    }

    _getTabs(parts, defaultTab = "operations") {
      const group = "primary";
      if (!this.tabGroups[group]) this.tabGroups[group] = defaultTab;
      const labels = { operations: "Operations", weapons: "Weapons", fittings: "Fittings", cargo: "Cargo", configuration: "Configuration", notes: "Notes" };
      return parts.reduce((tabs, id) => {
        if (!labels[id]) return tabs;
        tabs[id] = { id, group, label: labels[id], cssClass: this.tabGroups[group] === id ? "active" : "" };
        return tabs;
      }, {});
    }

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.cwnit = prepareVehicleSheetContext(this.actor);
      context.editable = context.cwnit.canManage;
      return context;
    }

    async _preparePartContext(partId, context) {
      context = await super._preparePartContext(partId, context);
      if (context.tabs?.[partId]) context.tab = context.tabs[partId];
      return context;
    }

    async _onDropActor(_event, data) {
      try {
        assertManager(this.actor);
        const actor = await globalThis.fromUuid?.(data?.uuid) ?? globalThis.fromUuidSync?.(data?.uuid);
        await setVehicleDriver(this.actor, actor);
        return true;
      } catch (error) { notifyError(error); return false; }
    }

    async _onDropItemCreate(itemData, event) {
      if (!owns(this.actor)) return false;
      if (!await approveVehicleCapacity(this.actor, itemData)) return false;
      return super._onDropItemCreate(itemData, event);
    }

    static async _onCreateVehicleDocument(event, target) {
      try {
        assertManager(this.actor);
        if (target.dataset.documentClass === "ActiveEffect" && !canUseAdvancedVehicleConfiguration(this.actor)) {
          throw new Error("Vehicle Advanced Configuration permission is required to create Effects.");
        }
        if (["shipWeapon", "shipFitting", "shipDefense"].includes(target.dataset.type)) {
          const proposed = { name: `New ${target.dataset.type}`, type: target.dataset.type, system: { power: 1, mass: 1, hardpoint: target.dataset.type === "shipWeapon" ? 1 : 0, minClass: "s" } };
          if (!await approveVehicleCapacity(this.actor, proposed)) return;
        }
        if (typeof nativeActions.createDoc !== "function") throw new Error("SWNR's native Item creation action is unavailable.");
        await nativeActions.createDoc.call(this, event, target);
      } catch (error) { notifyError(error); }
    }

    static async _onVehicleEditImage(event, target) {
      try {
        assertManager(this.actor);
        await nativeActions.onEditImage?.call(this, event, target);
      } catch (error) { notifyError(error); }
    }

    static async _onVehicleDeleteDocument(event, target) {
      try {
        assertManager(this.actor);
        if (target.dataset.documentClass === "ActiveEffect" && !canUseAdvancedVehicleConfiguration(this.actor)) {
          throw new Error("Vehicle Advanced Configuration permission is required to delete Effects.");
        }
        await nativeActions.deleteDoc?.call(this, event, target);
      } catch (error) { notifyError(error); }
    }

    static async _onVehicleReload(event, target) {
      try { assertManager(this.actor); await nativeActions.reload?.call(this, event, target); }
      catch (error) { notifyError(error); }
    }

    static async _onVehicleToggle(event, target) {
      try { assertManager(this.actor); await nativeActions.toggle?.call(this, event, target); }
      catch (error) { notifyError(error); }
    }

    static async _onVehicleToggleEffect(event, target) {
      try {
        assertManager(this.actor);
        if (!canUseAdvancedVehicleConfiguration(this.actor)) throw new Error("Vehicle Advanced Configuration permission is required to change Effects.");
        await nativeActions.toggleEffect?.call(this, event, target);
      } catch (error) { notifyError(error); }
    }

    static async _onVehicleResourceCreate(event, target) {
      try { assertManager(this.actor); await nativeActions.resourceCreate?.call(this, event, target); }
      catch (error) { notifyError(error); }
    }

    static async _onVehicleResourceDelete(event, target) {
      try { assertManager(this.actor); await nativeActions.resourceDelete?.call(this, event, target); }
      catch (error) { notifyError(error); }
    }

    static async _onAssignDriver(event) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const selected = await chooseCrew({ title: `Assign Driver — ${this.actor.name}`, selectedId: this.actor.system?.crewMembers?.[0] });
        if (selected) await setVehicleDriver(this.actor, selected);
      } catch (error) { notifyError(error); }
    }

    static async _onUnlinkDriver(event) {
      event.preventDefault();
      try { await clearVehicleDriver(this.actor); } catch (error) { notifyError(error); }
    }

    static async _onOpenActor(event, target) {
      event.preventDefault();
      const actor = globalThis.game?.actors?.get?.(target.dataset.actorId);
      if (actor?.sheet) await actor.sheet.render(true);
    }

    static async _onToggleOperating(event) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const api = vehicleApi();
        if (!api?.setOperating) throw new Error("Vehicle operations require CWN Combat Enhancements 0.26.0 or newer.");
        const current = prepareVehicleSheetContext(this.actor).ac.operating;
        await api.setOperating(this.actor, !current);
        const state = prepareVehicleSheetContext(this.actor).ac;
        await postVehicleChat(this.actor, `${this.actor.name}: ${state.stateLabel}`, `<p>Effective AC: <strong>${state.effective}</strong> (base ${state.base} ${state.modifier >= 0 ? "+" : ""}${state.modifier}).</p>`);
      } catch (error) { notifyError(error); }
    }

    static async _onAssignGunner(event, target) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const weapon = this.actor.items?.get?.(target.dataset.itemId);
        const current = vehicleApi()?.gunner?.(weapon);
        const selected = await chooseCrew({ title: `Assign Gunner — ${weapon?.name ?? "Weapon"}`, selectedId: current?.id });
        if (selected) await vehicleApi()?.assignGunner?.(this.actor, weapon, selected);
      } catch (error) { notifyError(error); }
    }

    static async _onMountExistingWeapon(event) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const candidates = mountableVehicleWeapons(this.actor);
        if (!candidates.length) throw new Error("This Vehicle has no carried weapons available to mount.");
        const options = candidates.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
        const defaultSize = String(this.actor.system?.size || "s");
        const values = await globalThis.foundry?.applications?.api?.DialogV2?.prompt?.({
          window: { title: `Mount Existing Weapon — ${this.actor.name}` }, modal: true, rejectClose: false,
          content: `<div class="cwnit-vehicle-mount"><p>This converts one carried SWNR Weapon into a native mounted weapon. Its combat and ammunition data are preserved. The carried original is removed only after the mounted weapon is created successfully.</p><label>Carried weapon<select name="itemId">${options}</select></label><div><label>Power<input type="number" name="power" min="0" step="1" value="0"></label><label>Mass<input type="number" name="mass" min="0" step="1" value="0"></label><label>Hardpoints<input type="number" name="hardpoint" min="0" step="1" value="1"></label><label>Minimum size<select name="minClass"><option value="s" ${defaultSize === "s" ? "selected" : ""}>Small</option><option value="m" ${defaultSize === "m" ? "selected" : ""}>Medium</option><option value="l" ${defaultSize === "l" ? "selected" : ""}>Large</option></select></label></div><p>Review the mounted Item after conversion if its installation requirements differ.</p></div>`,
          ok: { label: "Mount Weapon", callback: (_dialogEvent, button) => ({
            itemId: button.form.elements.itemId.value,
            power: number(button.form.elements.power.value),
            mass: number(button.form.elements.mass.value),
            hardpoint: number(button.form.elements.hardpoint.value, 1),
            minClass: button.form.elements.minClass.value,
          }) },
        });
        if (!values) return;
        const source = this.actor.items?.get?.(values.itemId);
        if (!source || source.type !== "weapon") throw new Error("That carried weapon is no longer available.");
        const mountedData = mountedWeaponDataFromCarriedWeapon(source, values);
        if (!await approveVehicleCapacity(this.actor, mountedData)) return;
        const created = await this.actor.createEmbeddedDocuments?.("Item", [mountedData]);
        const mounted = created?.[0];
        if (!mounted) throw new Error("The mounted weapon could not be created.");
        try {
          await source.delete();
        } catch (error) {
          await mounted.delete?.();
          throw new Error(`The carried weapon could not be removed, so the mounting conversion was rolled back. ${error?.message ?? ""}`.trim());
        }
        globalThis.ui?.notifications?.info?.(`${source.name} is now mounted on ${this.actor.name}.`);
      } catch (error) { notifyError(error); }
    }

    static async _onUnlinkGunner(event, target) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const weapon = this.actor.items?.get?.(target.dataset.itemId);
        await vehicleApi()?.clearGunner?.(this.actor, weapon);
      } catch (error) { notifyError(error); }
    }

    static async _onAttackVehicleWeapon(event, target) {
      event.preventDefault();
      try {
        const weapon = this.actor.items?.get?.(target.dataset.itemId);
        if (!vehicleApi()?.requestAttack) throw new Error("Vehicle attacks require CWN Combat Enhancements 0.26.0 or newer.");
        await vehicleApi().requestAttack(this.actor, weapon);
      } catch (error) { notifyError(error); }
    }

    static async _onRepairVehicle(event) {
      event.preventDefault();
      try {
        assertManager(this.actor);
        const api = vehicleApi();
        if (!api?.repairContext || !api?.repair) throw new Error("Vehicle repair requires CWN Combat Enhancements 0.26.0 or newer.");
        const candidates = eligibleVehicleCrew(globalThis.game?.actors?.contents ?? globalThis.game?.actors ?? []);
        if (!candidates.length) throw new Error("No eligible technician is available.");
        const options = candidates.map((actor) => `<option value="${escapeHtml(actor.id)}">${escapeHtml(actor.name)}</option>`).join("");
        const missing = Math.max(0, number(this.actor.system?.health?.max) - number(this.actor.system?.health?.value));
        const values = await globalThis.foundry?.applications?.api?.DialogV2?.prompt?.({
          window: { title: `Repair — ${this.actor.name}` }, modal: true, rejectClose: false,
          content: `<div class="cwnit-vehicle-repair"><label>Technician<select name="technicianId">${options}</select></label><label>HP to repair<input type="number" name="hp" min="1" max="${missing}" value="${Math.max(1, missing)}"></label><label><input type="checkbox" name="workshop"> Suitable workshop is available</label><p>A Tool Rack on the Vehicle also satisfies the facility requirement. This records HP, time, and cost but never changes a currency ledger.</p></div>`,
          ok: { label: "Calculate & Repair", callback: (_event, button) => ({ technicianId: button.form.elements.technicianId.value, requestedHp: number(button.form.elements.hp.value, 1), suitableWorkshop: Boolean(button.form.elements.workshop.checked) }) },
        });
        if (!values) return;
        const technician = globalThis.game?.actors?.get?.(values.technicianId);
        const result = await api.repair(this.actor, technician, values);
        const payment = result.cost > 0
          ? `Record $${result.cost.toLocaleString()} against the appropriate account manually.`
          : "No parts payment is required for this repair.";
        await postVehicleChat(this.actor, `Vehicle Repair — ${this.actor.name}`, `<dl><div><dt>Technician</dt><dd>${escapeHtml(technician.name)}</dd></div><div><dt>HP restored</dt><dd>${result.hp}</dd></div><div><dt>Repair rate</dt><dd>${result.rate} HP/day</dd></div><div><dt>Time</dt><dd>${result.days} day${result.days === 1 ? "" : "s"}</dd></div><div><dt>Parts cost</dt><dd>$${result.cost.toLocaleString()}</dd></div></dl><footer>${payment} No account or currency ledger was changed automatically.</footer>`);
      } catch (error) { notifyError(error); }
    }
  };
}

export function registerCwnVehicleSheet(runtime = globalThis) {
  const base = resolveSwnrVehicleSheet(runtime);
  const actorSheets = runtime.foundry?.documents?.collections?.Actors;
  if (!base || typeof actorSheets?.registerSheet !== "function") {
    queueMissingBaseWarning(runtime);
    return null;
  }
  const SheetClass = createCwnVehicleSheetClass(base);
  actorSheets.registerSheet(MODULE_ID, SheetClass, {
    types: ["vehicle"], makeDefault: false, label: VEHICLE_SHEET_LABEL,
  });
  return SheetClass;
}
