import assert from "node:assert/strict";
import test from "node:test";

import {
  refreshDependentSheets,
  registerLinkedSheetRefreshHooks,
  updateTouchesPath,
} from "../scripts/sheet-refresh.mjs";

function openActor(id) {
  return { id, sheet: { rendered: true, renderCount: 0, render() { this.renderCount += 1; } } };
}

test("update path detection accepts nested and flattened Foundry updates", () => {
  assert.equal(updateTouchesPath({ system: { crewMembers: ["pilot"] } }, "system.crewMembers"), true);
  assert.equal(updateTouchesPath({ "system.access.value": 3 }, "system.access"), true);
  assert.equal(updateTouchesPath({ system: { health: { value: 5 } } }, "system.access"), false);
});

test("Drone pilot changes rerender both the previous and current open Character sheets", () => {
  const previous = openActor("old");
  const current = openActor("new");
  const actors = new Map([["old", previous], ["new", current]]);
  const refreshed = refreshDependentSheets(
    { type: "drone", system: { crewMembers: ["new"] } },
    { system: { crewMembers: ["new"] } },
    { actors, previousPilotId: "old" },
  );
  assert.deepEqual(refreshed, ["old", "new"]);
  assert.equal(previous.sheet.renderCount, 1);
  assert.equal(current.sheet.renderCount, 1);
});

test("Access changes rerender linked open Cyberdeck sheets without opening closed sheets", () => {
  const openDeck = openActor("open");
  const closedDeck = { id: "closed", sheet: { rendered: false, renderCount: 0, render() { this.renderCount += 1; } } };
  const actors = new Map([["open", openDeck], ["closed", closedDeck]]);
  const refreshed = refreshDependentSheets(
    { type: "character", system: { cyberdecks: ["open", "closed"] } },
    { "system.access.value": 3 },
    { actors },
  );
  assert.deepEqual(refreshed, ["open"]);
  assert.equal(openDeck.sheet.renderCount, 1);
  assert.equal(closedDeck.sheet.renderCount, 0);
});

test("registered hooks preserve the old Drone pilot and refresh dependents after the update", () => {
  const callbacks = new Map();
  const oldPilot = openActor("old");
  const newPilot = openActor("new");
  const runtime = {
    game: { system: { id: "swnr" }, actors: new Map([["old", oldPilot], ["new", newPilot]]) },
    Hooks: { on: (name, callback) => callbacks.set(name, callback) },
  };
  registerLinkedSheetRefreshHooks(runtime);
  const drone = { id: "drone", uuid: "Actor.drone", type: "drone", system: { crewMembers: ["old"] } };
  callbacks.get("preUpdateActor")(drone, { system: { crewMembers: ["new"] } });
  drone.system.crewMembers = ["new"];
  callbacks.get("updateActor")(drone, { system: { crewMembers: ["new"] } });
  assert.equal(oldPilot.sheet.renderCount, 1);
  assert.equal(newPilot.sheet.renderCount, 1);
});
