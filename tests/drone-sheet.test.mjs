import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  COMMAND_DECK_NAMES,
  DRONE_SHEET_LABEL,
  createCwnDroneSheetClass,
  eligiblePilotActors,
  hasCanonicalFitting,
  prepareDroneSheetContext,
  registerCwnDroneSheet,
  resolveSwnrVehicleSheet,
} from "../scripts/sheets/cwn-drone-sheet-v070.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-drone-sheet-v070.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v070.css", import.meta.url), "utf8");
const templateNames = ["header", "operations", "fittings", "cargo", "configuration", "notes"];
const templates = Object.fromEntries(await Promise.all(templateNames.map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/drone/${name}-v070.hbs`, import.meta.url), "utf8"),
])));

function countTopLevelElements(template) {
  const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  let depth = 0;
  let roots = 0;
  for (const match of template.matchAll(/<\/?([a-z][\w-]*)(?:\s[^<>]*?)?\s*\/?>/giu)) {
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    const selfClosing = match[0].endsWith("/>") || voidElements.has(tag);
    if (closing) depth -= 1;
    else {
      if (depth === 0) roots += 1;
      if (!selfClosing) depth += 1;
    }
    assert.ok(depth >= 0, `unexpected closing ${tag} tag`);
  }
  assert.equal(depth, 0);
  return roots;
}

function item(id, type, name, system = {}) {
  return { id, _id: id, name, type, img: `${id}.webp`, sort: 0, system };
}

function actorFixture() {
  const fittings = [
    item("kill", "shipFitting", "Command Deck/Kill", { mass: 1, power: 1, description: "Autonomous attack routines." }),
    item("launch", "shipFitting", "Quick Launch", { mass: 1, power: 1 }),
  ];
  const weapon = item("weapon", "weapon", "BH-5 Mutt", {
    damage: "1d6",
    ammo: { type: "ammo", value: 8, max: 15 },
    range: { normal: 10, max: 80 },
    shock: { dmg: 0, ac: 0 },
    trauma: { die: "1d8", rating: 2 },
  });
  const actor = {
    id: "drone-1",
    name: "Hummingbird",
    type: "drone",
    system: {
      pilot: null,
      crewMembers: ["pilot-1"],
      model: "custom",
      customModel: "VC-14 Hummingbird",
      fittings: { value: 1, max: 3 },
      hardpoints: { value: 0, max: 1 },
      carriedGear: [weapon],
    },
    items: [weapon, ...fittings],
    itemTypes: { shipFitting: fittings, shipDefense: [], shipWeapon: [], weapon: [weapon] },
    allApplicableEffects: () => [],
  };
  return actor;
}

test("drone sheet resolves the registered native SWNR vehicle class and remains optional", () => {
  class SWNVehicleSheet {}
  const registeredSheets = [{
    id: "swnr.SWNVehicleSheet",
    sheetClass: SWNVehicleSheet,
    types: ["ship", "mech", "drone", "vehicle"],
  }];
  const calls = [];
  const runtime = {
    foundry: { documents: { collections: { Actors: {
      registeredSheets,
      registerSheet: (...args) => calls.push(args),
    } } } },
  };
  assert.equal(resolveSwnrVehicleSheet(runtime), SWNVehicleSheet);
  const SheetClass = registerCwnDroneSheet(runtime);
  assert.equal(Object.getPrototypeOf(SheetClass), SWNVehicleSheet);
  assert.deepEqual(calls[0][2], { types: ["drone"], makeDefault: false, label: DRONE_SHEET_LABEL });
});

test("drone sheet safely declines registration if the native vehicle class is unavailable", () => {
  assert.equal(registerCwnDroneSheet({}), null);
});

test("context uses native pilot, capacity, weapon, cargo, and fitting data without mutation", () => {
  const actor = actorFixture();
  const pilot = { id: "pilot-1", name: "Dirk Cobalt", type: "character" };
  const before = JSON.stringify(actor);
  const context = prepareDroneSheetContext(actor, {
    resolveActor: () => pilot,
    localize: (key) => key,
  });
  assert.equal(context.pilot, pilot);
  assert.equal(context.modelLabel, "VC-14 Hummingbird");
  assert.deepEqual(context.fittingUsage, { maximum: 3, remaining: 1, used: 2 });
  assert.deepEqual(context.hardpointUsage, { maximum: 1, remaining: 0, used: 1 });
  assert.equal(context.weapons[0].ammo, "8/15");
  assert.equal(context.weapons[0].damage, "1d6");
  assert.equal(context.cargoItems[0].id, "weapon");
  assert.equal(context.commandDeck.kill, true);
  assert.equal(context.commandDeck.follow, false);
  assert.equal(context.quickLaunch, true);
  assert.equal(JSON.stringify(actor), before);
});

test("Command Deck controls use canonical fitting names rather than parsing prose", () => {
  const actor = actorFixture();
  assert.equal(hasCanonicalFitting(actor, "kill"), true);
  assert.equal(hasCanonicalFitting(actor, "follow"), false);
  actor.itemTypes.shipFitting.push(item("fake", "shipFitting", "Target Logic", {
    description: "This prose mentions Command Deck/Follow but is not that fitting.",
  }));
  assert.equal(hasCanonicalFitting(actor, "follow"), false);
  assert.deepEqual(Object.keys(COMMAND_DECK_NAMES), ["follow", "kill", "patrol", "watch"]);
});

test("pilot picker allows GMs any eligible Actor and players only owned Character/NPC Actors", () => {
  const owner = { id: "owner", name: "Owned", type: "character", testUserPermission: () => true };
  const observer = { id: "observer", name: "Observer", type: "npc", testUserPermission: () => false, isOwner: false };
  const invalid = { id: "ship", name: "Ship", type: "ship", testUserPermission: () => true };
  assert.deepEqual(eligiblePilotActors([observer, owner, invalid], { isGM: false }), [owner]);
  assert.deepEqual(eligiblePilotActors([observer, owner, invalid], { isGM: true }), [observer, owner]);
});

test("all six ApplicationV2 template parts have exactly one root", () => {
  for (const [name, template] of Object.entries(templates)) {
    assert.equal(countTopLevelElements(template), 1, `${name} needs one root`);
  }
  assert.match(templates.header, /^\s*<div class="cwnit-drone__masthead">/u);
});

test("operations delegates attacks and reloads to native Item actions", () => {
  assert.match(templates.operations, /data-action="roll" data-roll-type="item"/u);
  assert.match(templates.operations, /data-action="reload"/u);
  assert.match(templates.operations, /data-document-class="Item" data-drag="true"/u);
  assert.match(templates.fittings, /data-action="createDoc" data-document-class="Item" data-type="shipFitting"/u);
  assert.match(templates.configuration, /data-document-class="ActiveEffect"/u);
  assert.match(templates.configuration, /data-action="toggleEffect"/u);
  assert.match(templates.cargo, /data-action="createDoc" data-document-class="Item"/u);
  assert.doesNotMatch(source, /rollAttack|pilotTotal|effectiveSkillRank|attackRollDie/u);
});

test("pilot assignment delegates linking and unlinking to native SWNR paths", () => {
  assert.match(source, /this\._onDropActor\(event, \{ type: "Actor", uuid: selected\.uuid \}\)/u);
  assert.match(source, /SWNVehicleSheet\.DEFAULT_OPTIONS\?\.actions\?\.pilotDelete/u);
  assert.doesNotMatch(source, /"system\.crewMembers"\s*:/u);
});

test("deploy and autonomous actions are declaration-only themed chat cards", async () => {
  class FakeVehicleSheet {
    static DEFAULT_OPTIONS = { actions: {} };
  }
  const SheetClass = createCwnDroneSheetClass(FakeVehicleSheet);
  const actor = actorFixture();
  const created = [];
  const previousChatMessage = globalThis.ChatMessage;
  const previousGame = globalThis.game;
  globalThis.ChatMessage = {
    getSpeaker: () => ({ actor: actor.id }),
    create: async (data) => created.push(data),
  };
  globalThis.game = { user: { targets: new Set([{ name: "Target Token" }]) }, actors: { get: () => null } };
  try {
    await SheetClass.DEFAULT_OPTIONS.actions.declareDroneAction.call(
      { actor },
      { preventDefault() {} },
      { dataset: { actionKey: "deploy" } },
    );
    await SheetClass.DEFAULT_OPTIONS.actions.issueAutonomousCommand.call(
      { actor },
      { preventDefault() {} },
      { dataset: { command: "kill" }, closest: () => null },
    );
  } finally {
    globalThis.ChatMessage = previousChatMessage;
    globalThis.game = previousGame;
  }
  assert.equal(created.length, 2);
  assert.match(created[0].content, /On Turn \(Quick Launch fitting\)/u);
  assert.match(created[0].content, /no token was placed/iu);
  assert.match(created[1].content, /Target Token/u);
  assert.match(created[1].content, /does not automate movement, attacks, perception, or autonomous state/u);
  assert.ok(created.every((entry) => entry.content.includes("cwnit-drone-command")));
});

test("sheet exposes the requested five tabs and operations is first", () => {
  const order = ["operations", "fittings", "cargo", "configuration", "notes"];
  let previous = -1;
  for (const tab of order) {
    const next = source.indexOf(`${tab}: { template`);
    assert.ok(next > previous, `${tab} missing or out of order`);
    previous = next;
  }
  assert.match(source, /options\.defaultTab = "operations"/u);
});

test("drone header always exposes native Trauma Target", () => {
  const header = templates.header;
  assert.match(header, /<span>Trauma Target<\/span><strong>\{\{system\.traumaTarget\}\}<\/strong>/u);
  assert.doesNotMatch(header, /useCWNArmor/u);
});

test("drone styling is isolated, dense, responsive, and themes its chat cards", () => {
  assert.match(css, /\.cwnit-drone-sheet-window/u);
  assert.match(css, /\.cwnit-drone__weapon-grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/u);
  assert.match(css, /\.cwnit-chat-message \.cwnit-drone-command/u);
  assert.match(css, /\.cwnit-drone-sheet-window prose-mirror/u);
  assert.match(css, /@media \(max-width: 860px\)/u);
});
