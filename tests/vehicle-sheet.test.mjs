import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCwnVehicleSheetClass,
  canUseAdvancedVehicleConfiguration,
  clearVehicleDriver,
  eligibleVehicleCrew,
  linkedVehiclesForDriver,
  carriedWeaponDataFromMountedWeapon,
  mountableVehicleWeapons,
  mountedWeaponDataFromCarriedWeapon,
  prepareVehicleSheetContext,
  registerCwnVehicleSettings,
  registerCwnVehicleSheet,
  setVehicleDriver,
  PLAYER_VEHICLE_ADVANCED_CONFIG_SETTING,
  VEHICLE_SHEET_LABEL,
} from "../scripts/sheets/cwn-vehicle-sheet-v0120.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function actor(id, type = "character", owner = true) {
  return { id, name: id, type, isOwner: owner, items: [], testUserPermission: (_user, level) => owner && ["OWNER", "OBSERVER"].includes(level) };
}

function vehicle(extra = {}) {
  const result = {
    id: "car", uuid: "Actor.car", name: "Interceptor", type: "vehicle", img: "car.webp", isOwner: true,
    _source: { system: { ac: 14 } },
    flags: { "cwn-combat-enhancements": { vehicleOperating: true } },
    system: {
      ac: 16, health: { value: 12, max: 20 }, crewMembers: ["driver"], crew: { current: 1 },
      power: { value: 2, max: 5 }, mass: { value: 4, max: 8 }, hardpoints: { value: 1, max: 3 },
      cargo: { value: 2, max: 10 }, cargoCarried: [], carriedGear: [], size: "m",
    },
    itemTypes: { shipWeapon: [], shipFitting: [], shipDefense: [] },
    items: { get: () => null, [Symbol.iterator]: function* () {} }, effects: [],
    allApplicableEffects: () => [],
    testUserPermission: (_user, level) => level === "OWNER" || level === "OBSERVER",
    async update(changes) { this.lastUpdate = changes; if (changes["system.crewMembers"]) this.system.crewMembers = changes["system.crewMembers"]; },
    ...extra,
  };
  return result;
}

test("Vehicle context exposes Driver, authoritative AC, resources, and explicit Gunner", () => {
  const driver = actor("driver");
  const cannon = {
    id: "gun", name: "Cannon", type: "shipWeapon", img: "gun.webp", sort: 0,
    system: { stat: "dex", ab: 1, damage: "2d10", power: 2, mass: 2, hardpoint: 1, minClass: "s", ammo: { type: "ammo", value: 4, max: 10 }, range: { normal: 500, max: 2000 }, trauma: { die: "1d10", rating: 3 } },
    flags: { "cwn-combat-enhancements": { vehicleGunnerActorId: "driver" } },
  };
  const car = vehicle({ itemTypes: { shipWeapon: [cannon], shipFitting: [], shipDefense: [] } });
  cannon.parent = car;
  const oldGame = globalThis.game;
  globalThis.game = {
    user: { id: "gm", isGM: true }, actors: { get: (id) => id === driver.id ? driver : null },
    cwnCombatEnhancements: { vehicle: {
      driver: () => driver,
      gunner: () => driver,
      ac: () => ({ base: 14, effective: 16, driveRank: 2, modifier: 2, operating: true, stateLabel: "Operating" }),
    } },
  };
  try {
    const context = prepareVehicleSheetContext(car);
    assert.equal(context.driver, driver);
    assert.equal(context.ac.effective, 16);
    assert.equal(context.ac.modifierText, "+2");
    assert.deepEqual(context.powerUsage, { maximum: 5, remaining: 2, used: 3, over: false });
    assert.equal(context.mountedWeapons[0].gunner, driver);
    assert.equal(context.mountedWeapons[0].canAttack, true);
    assert.equal(context.mountedWeapons[0].ammo, "4 / 10");
  } finally { globalThis.game = oldGame; }
});

test("carried SWNR weapons convert to mounted weapons without losing combat or ammunition data", () => {
  const rifle = {
    id: "rifle", name: "Autocannon", type: "weapon", img: "rifle.webp", sort: 2,
    system: {
      description: "Vehicle pintle gun", damage: "2d8", ab: 2, stat: "dex", qualities: "AP 5",
      ammo: { type: "ammo", value: 17, max: 30, burst: true },
      trauma: { die: "1d10", rating: 3, vehicle: true }, range: { normal: 100, max: 300 }, cost: 4000,
    },
    flags: { "cwn-content-pack": { weaponFamily: "heavy-rifle" } },
  };
  const broken = { ...rifle, id: "broken", name: "Broken Gun", system: { ...rifle.system, destroyed: true } };
  const car = vehicle({ itemTypes: { weapon: [broken, rifle], shipWeapon: [], shipFitting: [], shipDefense: [] } });
  assert.deepEqual(mountableVehicleWeapons(car).map((item) => item.id), ["rifle"]);
  const mounted = mountedWeaponDataFromCarriedWeapon(rifle, { power: 2, mass: 3, hardpoint: 1, minClass: "m" });
  assert.equal(mounted.type, "shipWeapon");
  assert.equal(mounted.name, rifle.name);
  assert.equal(mounted.system.damage, "2d8");
  assert.equal(mounted.system.ab, 2);
  assert.deepEqual(mounted.system.ammo, rifle.system.ammo);
  assert.deepEqual(mounted.system.trauma, rifle.system.trauma);
  assert.deepEqual(mounted.system.range, rifle.system.range);
  assert.equal(mounted.system.power, 2);
  assert.equal(mounted.system.mass, 3);
  assert.equal(mounted.system.hardpoint, 1);
  assert.equal(mounted.system.minClass, "m");
  assert.deepEqual(mounted.flags["cwn-content-pack"], rifle.flags["cwn-content-pack"]);
  assert.deepEqual(mounted.flags["cwn-interface-theme"].mountedWeaponSource.system, rifle.system);
});

test("mounted weapons return to Cargo with current ammo, restored carried fields, and no stale Gunner", () => {
  const carried = {
    name: "Autocannon", type: "weapon", img: "rifle.webp",
    system: {
      description: "Vehicle pintle gun", quantity: 2, encumbrance: 3, location: "readied", quality: "masterwork",
      stat: "str", secondStat: "dex", skill: "shoot", skillBoostsDamage: true, shock: { dmg: "2", ac: 15 },
      ammo: { type: "ammo", value: 17, max: 30, burst: true, suppress: true, longReload: false },
      trauma: { die: "1d10", rating: 3 }, range: { normal: 100, max: 300 }, damage: "2d8", ab: 2, cost: 4000,
    },
    flags: { "cwn-content-pack": { weaponFamily: "heavy-rifle" } },
  };
  const mounted = mountedWeaponDataFromCarriedWeapon(carried, { power: 2, mass: 3, hardpoint: 1, minClass: "m" });
  mounted.system.ammo.value = 6;
  mounted.flags["cwn-combat-enhancements"] = { vehicleGunnerActorId: "gunner" };
  const returned = carriedWeaponDataFromMountedWeapon(mounted);
  assert.equal(returned.type, "weapon");
  assert.equal(returned.system.location, "stowed");
  assert.equal(returned.system.quantity, 2);
  assert.equal(returned.system.encumbrance, 3);
  assert.equal(returned.system.shock.dmg, "2");
  assert.equal(returned.system.skillBoostsDamage, true);
  assert.equal(returned.system.ammo.value, 6);
  assert.equal(returned.system.ammo.burst, true);
  assert.equal(returned.system.ammo.suppress, true);
  assert.deepEqual(returned.flags["cwn-content-pack"], carried.flags["cwn-content-pack"]);
  assert.equal(returned.flags["cwn-combat-enhancements"], undefined);
  assert.equal(returned.flags["cwn-interface-theme"], undefined);
});

test("legacy mounted weapons without a carried snapshot still return as safe Stowed weapons", () => {
  const returned = carriedWeaponDataFromMountedWeapon({
    name: "Legacy Turret", type: "shipWeapon", img: "turret.webp",
    system: { damage: "3d6", ab: 1, stat: "dex", ammo: { type: "ammo", value: 2, max: 10 }, range: { normal: 500, max: 2000 } },
    flags: { "cwn-combat-enhancements": { vehicleGunnerActorId: "gunner" } },
  });
  assert.equal(returned.type, "weapon");
  assert.equal(returned.system.location, "stowed");
  assert.equal(returned.system.encumbrance, 1);
  assert.equal(returned.system.damage, "3d6");
  assert.deepEqual(returned.system.ammo, { longReload: false, suppress: false, type: "ammo", max: 10, value: 2, burst: false });
  assert.equal(returned.flags["cwn-combat-enhancements"], undefined);
});

test("Linked Vehicles use the first native crew ID and respect visibility", () => {
  const driver = actor("driver");
  const visible = vehicle({ id: "visible", name: "B Vehicle" });
  const hidden = vehicle({ id: "hidden", name: "A Vehicle", isOwner: false, testUserPermission: () => false });
  const passenger = vehicle({ id: "passenger", system: { ...vehicle().system, crewMembers: ["other", "driver"] } });
  assert.deepEqual(linkedVehiclesForDriver(driver, { actors: [visible, hidden, passenger], user: { isGM: false } }).map((entry) => entry.id), ["visible"]);
  assert.deepEqual(linkedVehiclesForDriver(driver, { actors: [visible, hidden], user: { isGM: true } }).map((entry) => entry.id), ["hidden", "visible"]);
});

test("eligible crew contains only owned Character and NPC Actors", () => {
  const user = { id: "player", isGM: false };
  assert.deepEqual(eligibleVehicleCrew([actor("pc"), actor("npc", "npc"), actor("denied", "character", false), actor("drone", "drone")], user).map((entry) => entry.id), ["npc", "pc"]);
});

test("Vehicle sheet registers as optional only for vehicle Actors", () => {
  class Base {}
  const calls = [];
  const runtime = {
    swnr: { applications: { SWNVehicleSheet: Base } },
    foundry: { documents: { collections: { Actors: { registerSheet: (...args) => calls.push(args) } } } },
  };
  const Sheet = registerCwnVehicleSheet(runtime);
  assert.ok(Sheet.prototype instanceof Base);
  assert.equal(calls[0][2].label, VEHICLE_SHEET_LABEL);
  assert.deepEqual(calls[0][2].types, ["vehicle"]);
  assert.equal(calls[0][2].makeDefault, false);
});

test("Vehicle Advanced Configuration is GM-always and disabled by default for player owners", () => {
  const registrations = [];
  registerCwnVehicleSettings({ game: { settings: { register: (...args) => registrations.push(args) } } });
  assert.equal(registrations[0][1], PLAYER_VEHICLE_ADVANCED_CONFIG_SETTING);
  assert.equal(registrations[0][2].default, false);
  const car = vehicle();
  assert.equal(canUseAdvancedVehicleConfiguration(car, { user: { isGM: true }, settings: {} }), true);
  assert.equal(canUseAdvancedVehicleConfiguration(car, { user: { isGM: false }, settings: { get: () => false } }), false);
  assert.equal(canUseAdvancedVehicleConfiguration(car, { user: { isGM: false }, settings: { get: () => true } }), true);
});

test("Driver assignment is ID-based, idempotent, reassignable, and unlink creates no inventory documents", async () => {
  const car = vehicle();
  let updates = 0;
  car.update = async function (changes) { updates += 1; this.lastUpdate = changes; if (changes["system.crewMembers"]) this.system.crewMembers = changes["system.crewMembers"]; };
  const first = actor("driver");
  const sameName = actor("other");
  first.name = sameName.name = "Same Name";
  const oldGame = globalThis.game;
  globalThis.game = { user: { isGM: true }, cwnCombatEnhancements: { vehicle: { setOperating: async () => {} } } };
  try {
    assert.equal((await setVehicleDriver(car, first)).changed, false);
    assert.equal(updates, 0);
    assert.equal((await setVehicleDriver(car, sameName)).changed, true);
    assert.deepEqual(car.system.crewMembers, ["other"]);
    assert.equal(updates, 1);
    assert.equal((await clearVehicleDriver(car)).changed, true);
    assert.deepEqual(car.system.crewMembers, []);
    assert.equal(updates, 2);
    assert.equal((await clearVehicleDriver(car)).changed, false);
    assert.equal(updates, 2);
  } finally { globalThis.game = oldGame; }
});

test("dropping a Character replaces the single Driver without inventory Items", async () => {
  class Base { constructor() { this.actor = null; } }
  Base.DEFAULT_OPTIONS = { actions: {} };
  const Sheet = createCwnVehicleSheetClass(Base);
  const car = vehicle();
  const replacement = actor("replacement");
  const sheet = new Sheet();
  sheet.actor = car;
  const oldGame = globalThis.game;
  const oldFromUuid = globalThis.fromUuid;
  globalThis.game = { user: { isGM: true } };
  globalThis.fromUuid = async () => replacement;
  try {
    assert.equal(await sheet._onDropActor({}, { uuid: "Actor.replacement" }), true);
    assert.deepEqual(car.lastUpdate, { "system.crewMembers": ["replacement"], "system.crew.current": 1 });
  } finally { globalThis.game = oldGame; globalThis.fromUuid = oldFromUuid; }
});

test("templates expose all approved tabs, attack gating, repair, and capacity feedback", () => {
  const header = read("templates/sheets/vehicle/header.hbs");
  const operations = read("templates/sheets/vehicle/operations.hbs");
  const weapons = read("templates/sheets/vehicle/weapons.hbs");
  const fittings = read("templates/sheets/vehicle/fittings.hbs");
  const character = read("templates/sheets/character/cyberware-v062.hbs");
  const npc = read("templates/sheets/npc/cyberware.hbs");
  assert.match(operations, /data-action="toggleOperating"/u);
  assert.match(operations, /data-action="repairVehicle"/u);
  assert.match(operations, /data-action="attackVehicleWeapon"/u);
  assert.match(operations, /<dt>Ammo<\/dt>/u);
  assert.match(operations, /data-action="unlinkGunner"[^>]*>[\s\S]*?Clear/u);
  assert.match(operations, /data-action="unmountWeapon"[^>]*>[\s\S]*?Unmount/u);
  assert.match(operations, /fa-pen-to-square/u);
  assert.match(weapons, /New Mounted Weapon/u);
  assert.match(weapons, /Mount Existing Weapon/u);
  assert.match(weapons, /data-action="unlinkGunner"/u);
  assert.match(weapons, /data-action="unmountWeapon"[^>]*title="Unmount to Cargo"/u);
  assert.doesNotMatch(weapons, /fa-user-crosshairs/u);
  assert.match(header, /class="cwnit-vehicle__ac"><span>AC<\/span>/u);
  assert.match(fittings, /Power, Mass, hardpoints/u);
  assert.match(character, /Linked Vehicles/u);
  assert.match(npc, /Linked Vehicles/u);
});

test("Vehicle patch CSS keeps six tabs on one row, preserves narrow AC detail, and themes chat cards", () => {
  const css = read("styles/cwn-interface-theme-v0121.css");
  assert.match(css, /\.cwnit-vehicle-sheet-window nav\.tabs \{[\s\S]*repeat\(6,/u);
  assert.match(css, /\.cwnit-vehicle__ac > small/u);
  assert.match(css, /\.cwnit-chat-message \.cwnit-vehicle-chat/u);
  assert.match(css, /var\(--cwnit-text\)/u);
});

test("Character sheet always includes Cyberware for linked assets and Maintenance", () => {
  const source = read("scripts/sheets/cwn-character-sheet-v091.mjs");
  assert.match(source, /\["header", "combat", "skills", "inventory", "cyberware"\]/u);
  assert.doesNotMatch(source, /showCyberware\) options\.parts\.push\("cyberware"\)/u);
});
