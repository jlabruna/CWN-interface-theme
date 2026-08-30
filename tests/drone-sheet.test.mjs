import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  COMMAND_DECK_NAMES,
  DRONE_DEPLOYED_FLAG,
  DRONE_SHEET_LABEL,
  PLAYER_DRONE_ADVANCED_CONFIG_SETTING,
  canUseAdvancedDroneConfiguration,
  checkFittingCapacity,
  createCwnDroneSheetClass,
  eligiblePilotActors,
  hasCanonicalFitting,
  isDroneDeployed,
  prepareDroneSheetContext,
  registerCwnDroneSheet,
  resolveSwnrVehicleSheet,
} from "../scripts/sheets/cwn-drone-sheet-v0100.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-drone-sheet-v0100.mjs", import.meta.url), "utf8");
const moduleSource = await fs.readFile(new URL("../scripts/cwn-interface-theme-v0101.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v0101.css", import.meta.url), "utf8");
const templateNames = ["header", "operations", "fittings", "cargo", "configuration", "notes"];
const templateVersions = { operations: "v092", fittings: "v092", cargo: "v092" };
const templates = Object.fromEntries(await Promise.all(templateNames.map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/drone/${name}-${templateVersions[name] ?? "v070"}.hbs`, import.meta.url), "utf8"),
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
  const magazine = item("magazine", "item", "Combat Rifle Magazine", {
    quantity: 1,
    encumbrance: 0,
    uses: { ammo: "ammo", consumable: "use", value: 11, max: 20 },
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
      carriedGear: [weapon, magazine],
    },
    flags: {},
    items: [weapon, magazine, ...fittings],
    itemTypes: { shipFitting: fittings, shipDefense: [], shipWeapon: [], weapon: [weapon], item: [magazine] },
    allApplicableEffects: () => [],
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async setFlag(scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
    },
  };
  return actor;
}

test("drone sheet resolves the registered native SWNR vehicle class and remains optional", () => {
  class SWNVehicleSheet {}
  const registeredSheets = [SWNVehicleSheet];
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

test("drone resolver retains descriptor compatibility for registry adapters", () => {
  class SWNVehicleSheet {}
  const runtime = {
    foundry: { documents: { collections: { Actors: {
      registeredSheets: [{
        id: "swnr.SWNVehicleSheet",
        sheetClass: SWNVehicleSheet,
        types: ["ship", "mech", "drone", "vehicle"],
      }],
    } } } },
  };
  assert.equal(resolveSwnrVehicleSheet(runtime), SWNVehicleSheet);
});

test("drone registration waits for ready when Foundry exposes registered sheet classes", () => {
  const initStart = moduleSource.indexOf('Hooks.once("init"');
  const readyStart = moduleSource.indexOf('Hooks.once("ready"');
  assert.ok(initStart >= 0 && readyStart > initStart);
  assert.doesNotMatch(moduleSource.slice(initStart, readyStart), /registerCwnDroneSheet\(\)/u);
  assert.doesNotMatch(moduleSource, /Hooks\.once\("setup"/u);
  assert.match(moduleSource.slice(readyStart), /registerCwnDroneSheet\(\)/u);
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
  const cargoWeapon = context.cargoItems.find((entry) => entry.item.id === "weapon");
  const cargoMagazine = context.cargoItems.find((entry) => entry.item.id === "magazine");
  assert.equal(cargoWeapon.ammo.label, "8/15");
  assert.equal(cargoMagazine.ammo.label, "11/20");
  assert.equal(cargoMagazine.ammo.empty, false);
  assert.equal(context.commandDeck.kill, true);
  assert.equal(context.commandDeck.follow, false);
  assert.equal(context.quickLaunch, true);
  assert.equal(context.deployed, false);
  assert.equal(context.hasDefenses, false);
  assert.equal(context.fittingOverCapacity, false);
  assert.equal(JSON.stringify(actor), before);
});

test("native magazine uses are shown as remaining rounds, including empty magazines", () => {
  const actor = actorFixture();
  const magazine = actor.system.carriedGear.find((entry) => entry.id === "magazine");
  magazine.system.uses.value = 0;
  const context = prepareDroneSheetContext(actor);
  const cargo = context.cargoItems.find((entry) => entry.item.id === "magazine");
  assert.deepEqual(cargo.ammo, { empty: true, label: "0/20 · Empty" });
  assert.match(templates.cargo, /Rounds \{\{cargo\.ammo\.label\}\}/u);
});

test("fitting capacity uses SWNR's native remaining value and allows only a GM override", () => {
  const actor = actorFixture();
  const tooLarge = item("large", "shipFitting", "Large Fitting", { mass: 2 });
  assert.deepEqual(checkFittingCapacity(actor, tooLarge, { isGM: false }), {
    added: 2,
    remaining: 1,
    projected: -1,
    exceeded: true,
    canOverride: false,
  });
  assert.equal(checkFittingCapacity(actor, tooLarge, { isGM: true }).canOverride, true);
  assert.equal(checkFittingCapacity(actor, item("cargo", "item", "Cargo"), { isGM: false }).exceeded, false);
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
  assert.doesNotMatch(templates.fittings, /data-type="shipDefense"/u);
  assert.match(templates.fittings, /\{\{#if cwnit\.hasDefenses\}\}/u);
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

test("deploy toggles persistent packed state and control actions remain themed declarations", async () => {
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
    assert.equal(isDroneDeployed(actor), true);
    await SheetClass.DEFAULT_OPTIONS.actions.declareDroneAction.call(
      { actor },
      { preventDefault() {} },
      { dataset: { actionKey: "deploy" } },
    );
    assert.equal(isDroneDeployed(actor), false);
    await SheetClass.DEFAULT_OPTIONS.actions.issueAutonomousCommand.call(
      { actor },
      { preventDefault() {} },
      { dataset: { command: "kill" }, closest: () => null },
    );
  } finally {
    globalThis.ChatMessage = previousChatMessage;
    globalThis.game = previousGame;
  }
  assert.equal(created.length, 3);
  assert.match(created[0].content, /On Turn \(Quick Launch fitting\)/u);
  assert.match(created[0].content, /marked deployed/iu);
  assert.match(created[1].content, /Pack Hummingbird/u);
  assert.match(created[1].content, /marked packed/iu);
  assert.match(created[2].content, /Target Token/u);
  assert.match(created[2].content, /does not automate movement, attacks, perception, or autonomous state/u);
  assert.ok(created.every((entry) => entry.content.includes("cwnit-drone-command")));
});

test("Drop Control explains that deployment and pilot links remain unchanged", async () => {
  class FakeVehicleSheet { static DEFAULT_OPTIONS = { actions: {} }; }
  const SheetClass = createCwnDroneSheetClass(FakeVehicleSheet);
  const actor = actorFixture();
  const created = [];
  const previousChatMessage = globalThis.ChatMessage;
  globalThis.ChatMessage = { create: async (data) => created.push(data) };
  try {
    await SheetClass.DEFAULT_OPTIONS.actions.declareDroneAction.call(
      { actor },
      { preventDefault() {} },
      { dataset: { actionKey: "drop" } },
    );
  } finally {
    globalThis.ChatMessage = previousChatMessage;
  }
  assert.match(created[0].content, /remains deployed but inert/iu);
  assert.match(created[0].content, /pilot link and deployment state are unchanged/iu);
});

test("over-capacity drops are blocked for players and require GM confirmation", async () => {
  class FakeVehicleSheet {
    static DEFAULT_OPTIONS = { actions: {} };
    async _onDropItemCreate(itemData) {
      this.created = itemData;
      return [itemData];
    }
  }
  const SheetClass = createCwnDroneSheetClass(FakeVehicleSheet);
  const sheet = new SheetClass();
  sheet.actor = actorFixture();
  const large = item("large", "shipFitting", "Large Fitting", { mass: 2 });
  const warnings = [];
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  const previousFoundry = globalThis.foundry;
  globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };
  try {
    globalThis.game = { user: { isGM: false } };
    assert.equal(await sheet._onDropItemCreate(large, {}), false);
    assert.equal(sheet.created, undefined);
    assert.match(warnings[0], /Ask the GM/u);

    globalThis.game = { user: { isGM: true } };
    globalThis.foundry = { applications: { api: { DialogV2: { wait: async () => true } } } };
    await sheet._onDropItemCreate(large, {});
    assert.equal(sheet.created, large);
  } finally {
    globalThis.game = previousGame;
    globalThis.ui = previousUi;
    globalThis.foundry = previousFoundry;
  }
});

test("GM fitting override uses the Foundry-safe DialogV2.wait path", async () => {
  class FakeVehicleSheet {
    async _onDropItemCreate(itemData) { this.created = itemData; }
  }
  class RuntimeDialogV2 {
    static async wait() {
      assert.equal(this, RuntimeDialogV2);
      return true;
    }
  }
  const SheetClass = createCwnDroneSheetClass(FakeVehicleSheet);
  const sheet = new SheetClass();
  sheet.actor = actorFixture();
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  try {
    globalThis.game = { user: { isGM: true } };
    globalThis.foundry = { applications: { api: { DialogV2: RuntimeDialogV2 } } };
    const fitting = item("large-bound", "shipFitting", "Large Bound Fitting", { mass: 3 });
    await sheet._onDropItemCreate(fitting, {});
    assert.equal(sheet.created, fitting);
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});

test("advanced Drone configuration is GM-always and world-setting controlled for player owners", () => {
  const actor = { isOwner: true };
  assert.equal(canUseAdvancedDroneConfiguration(actor, { user: { isGM: true }, settings: { get: () => false } }), true);
  assert.equal(canUseAdvancedDroneConfiguration(actor, { user: { isGM: false }, settings: { get: () => true } }), true);
  assert.equal(canUseAdvancedDroneConfiguration(actor, { user: { isGM: false }, settings: { get: () => false } }), false);
  assert.equal(canUseAdvancedDroneConfiguration({ isOwner: false }, { user: { isGM: false }, settings: { get: () => true } }), false);
  assert.equal(PLAYER_DRONE_ADVANCED_CONFIG_SETTING, "allowPlayerDroneAdvancedConfiguration");
  assert.match(moduleSource, /registerCwnDroneSettings\(\)/u);
  assert.match(templates.configuration, /#if cwnit\.canConfigureAdvanced/u);
  assert.match(templates.configuration, /Configuration is always visible as a summary/u);
});

test("Drone Pilot benefits drive Assume Command cost and the matching chat declaration", () => {
  assert.match(templates.operations, /cwnit\.pilotBenefits\.assumeCostShort/u);
  assert.match(templates.operations, /Linked Pilot Rules/u);
  assert.match(source, /game\?\.cwnCombatEnhancements\?\.drone/u);
  assert.match(source, /useAssumeCommand/u);
  assert.match(source, /action\.cost = use\.assumeCost/u);
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
  assert.match(css, /\.cwnit-drone__deployment\.is-deployed/u);
  assert.match(css, /\.cwnit-drone__capacity-badges \.is-over-capacity/u);
  assert.match(templates.operations, /Pack Drone/u);
  assert.equal(DRONE_DEPLOYED_FLAG, "deployed");
});
