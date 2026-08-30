import assert from "node:assert/strict";
import test from "node:test";

import { linkDronePilot, unlinkDronePilot } from "../scripts/sheets/drone-pilot-link.mjs";
import { createCwnDroneSheetClass } from "../scripts/sheets/cwn-drone-sheet-v0100.mjs";

function fixture() {
  const pilot = {
    id: "pilot", uuid: "Actor.pilot", type: "character", items: [], deleted: [],
    async createEmbeddedDocuments(_type, sources) {
      const item = { ...sources[0], id: `item-${this.items.length + 1}`, uuid: `Actor.pilot.Item.item-${this.items.length + 1}` };
      this.items.push(item);
      return [item];
    },
    async deleteEmbeddedDocuments(_type, ids) { this.deleted.push(...ids); this.items = this.items.filter((item) => !ids.includes(item.id)); },
  };
  const drone = {
    id: "drone", uuid: "Actor.drone", name: "Same Name", type: "drone",
    system: { crewMembers: [], crew: { current: 1 }, enc: 2, cost: 1000 }, flags: {},
    async update(changes) {
      if (changes["system.crewMembers"]) this.system.crewMembers = [...changes["system.crewMembers"]];
      if (changes["system.crew.current"] != null) this.system.crew.current = changes["system.crew.current"];
    },
    async setFlag(scope, key, value) { this.flags[scope] ??= {}; this.flags[scope][key] = value; },
    async unsetFlag(scope, key) { delete this.flags[scope]?.[key]; },
  };
  const actors = new Map([[pilot.id, pilot], [drone.id, drone]]);
  return { pilot, drone, actors, runtime: {} };
}

test("repeated assignment is idempotent and creates one provenance-tagged native inventory record", async () => {
  const { pilot, drone, actors, runtime } = fixture();
  await linkDronePilot(drone, pilot, { actors, runtime });
  await linkDronePilot(drone, pilot, { actors, runtime });
  assert.deepEqual(drone.system.crewMembers, [pilot.id]);
  assert.equal(pilot.items.length, 1);
  assert.equal(pilot.items[0].flags["cwn-interface-theme"].dronePilotLink.droneUuid, drone.uuid);
});

test("unlink deletes only the exact provenance-tagged relationship Item", async () => {
  const { pilot, drone, actors, runtime } = fixture();
  pilot.items.push({ id: "unrelated", name: drone.name, type: "item", flags: {} });
  await linkDronePilot(drone, pilot, { actors, runtime });
  const linkedId = pilot.items.find((item) => item.id !== "unrelated").id;
  const result = await unlinkDronePilot(drone, { actors, runtime });
  assert.equal(result.removedInventoryItem, true);
  assert.deepEqual(drone.system.crewMembers, []);
  assert.deepEqual(pilot.items.map((item) => item.id), ["unrelated"]);
  assert.deepEqual(pilot.deleted, [linkedId]);
});

test("similarly named Drones retain distinct Actor identity", async () => {
  const { pilot, drone, actors, runtime } = fixture();
  const other = { ...drone, id: "other", uuid: "Actor.other", system: { ...drone.system, crewMembers: [] }, flags: {} };
  actors.set(other.id, other);
  await linkDronePilot(drone, pilot, { actors, runtime });
  await linkDronePilot(other, pilot, { actors, runtime });
  assert.equal(pilot.items.length, 2);
  assert.deepEqual(new Set(pilot.items.map((item) => item.flags["cwn-interface-theme"].dronePilotLink.droneId)), new Set(["drone", "other"]));
});

test("live-shaped sheet drop and pilotDelete routes use the same idempotent relationship", async () => {
  class NativeVehicleSheet { static DEFAULT_OPTIONS = { actions: {} }; constructor(actor) { this.actor = actor; } }
  const Sheet = createCwnDroneSheetClass(NativeVehicleSheet);
  const { pilot, drone, actors } = fixture();
  drone.isOwner = true;
  const previous = { game: globalThis.game, fromUuid: globalThis.fromUuid, ui: globalThis.ui };
  globalThis.game = { actors, user: { isGM: true } };
  globalThis.fromUuid = async () => pilot;
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  try {
    const sheet = new Sheet(drone);
    assert.equal(await sheet._onDropActor({}, { uuid: pilot.uuid }), true);
    assert.equal(await sheet._onDropActor({}, { uuid: pilot.uuid }), true);
    assert.equal(pilot.items.length, 1);
    await Sheet.DEFAULT_OPTIONS.actions.pilotDelete.call(sheet, { preventDefault() {} });
    assert.deepEqual(drone.system.crewMembers, []);
    assert.equal(pilot.items.length, 0);
  } finally {
    globalThis.game = previous.game;
    globalThis.fromUuid = previous.fromUuid;
    globalThis.ui = previous.ui;
  }
});
