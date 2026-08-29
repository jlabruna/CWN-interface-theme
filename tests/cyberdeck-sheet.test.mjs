import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  CYBERDECK_SHEET_LABEL,
  createCwnCyberdeckSheetClass,
  eligibleHackerActors,
  prepareCyberdeckContext,
  registerCwnCyberdeckSheet,
  resolveSwnrCyberdeckSheet,
  updateNativeHackerLink,
} from "../scripts/sheets/cwn-cyberdeck-sheet-v0100.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-cyberdeck-sheet-v0100.mjs", import.meta.url), "utf8");
const main = await fs.readFile(new URL("../scripts/cwn-interface-theme-v0100.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v0100.css", import.meta.url), "utf8");
const names = ["header", "operations", "programs", "files", "configuration", "notes"];
const templates = Object.fromEntries(await Promise.all(names.map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/cyberdeck/${name}-v0100.hbs`, import.meta.url), "utf8"),
])));

function program(id, name, type, system = {}, flags = {}) {
  return { id, _id: id, name, type: "program", img: `${id}.webp`, sort: 0, system: { type, ...system }, flags };
}

function fixture() {
  const programs = [
    program("blind", "Blind", "verb", { target: "Device/Cyber", accessCost: 2, selfTerminating: false, useAffects: "Camera vision" }),
    program("camera", "Camera", "subject", { target: "Device" }),
    program("file", "Personnel Archive", "dataFile", { description: "Copied records" }),
    program("running", "Blind Camera", "running", { useAffects: "Camera" }),
  ];
  return {
    id: "deck", uuid: "Actor.deck", name: "Yamagata Tanto", type: "cyberdeck", isOwner: true,
    system: {
      hackerId: "hacker", bonusAccess: 1,
      access: { value: 1, max: 1 }, cpu: { value: 2, max: 3 }, memory: { value: 7, max: 10 },
      health: { value: 8, max: 10 }, baseShielding: 8, bonusShielding: 2,
    },
    items: programs,
    itemTypes: { program: programs },
    flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) {
      if ("system.hackerId" in changes) this.system.hackerId = changes["system.hackerId"];
      if ("system.hacker" in changes) this.system.hacker = changes["system.hacker"];
    },
  };
}

function hacker(id = "hacker", owner = true) {
  return {
    id, uuid: `Actor.${id}`, name: "Bobby Wires", type: "character", isOwner: owner,
    system: { access: { value: 2, max: 3 }, stats: { int: { mod: 1 } }, cyberdecks: [] },
    items: [{ type: "skill", name: "Program", system: { rank: 2, pool: "2d6" } }],
    testUserPermission: () => owner,
    async update(changes) { if (changes["system.cyberdecks"]) this.system.cyberdecks = changes["system.cyberdecks"]; },
  };
}

test("cyberdeck sheet resolves native registration and remains optional", () => {
  class SWNCyberdeckSheet {}
  const calls = [];
  const runtime = { foundry: { documents: { collections: { Actors: {
    registeredSheets: [SWNCyberdeckSheet], registerSheet: (...args) => calls.push(args),
  } } } } };
  assert.equal(resolveSwnrCyberdeckSheet(runtime), SWNCyberdeckSheet);
  const SheetClass = registerCwnCyberdeckSheet(runtime);
  assert.equal(Object.getPrototypeOf(SheetClass), SWNCyberdeckSheet);
  assert.deepEqual(calls[0][2], { types: ["cyberdeck"], makeDefault: false, label: CYBERDECK_SHEET_LABEL });
});

test("registration occurs at ready and native cyberdeck remains selectable", () => {
  const ready = main.indexOf('Hooks.once("ready"');
  assert.ok(ready >= 0);
  assert.match(main.slice(ready), /registerCwnCyberdeckSheet\(\)/u);
  assert.doesNotMatch(source, /unregisterSheet/u);
});

test("deck view derives native resources, loaded programs, and files", () => {
  const context = prepareCyberdeckContext(fixture(), { hacker: hacker(), isGM: true });
  assert.deepEqual(context.resources.access, { value: 3, max: 4, hackerValue: 2, hackerMax: 3, bonus: 1 });
  assert.deepEqual(context.resources.cpu, { value: 2, max: 3, used: 1 });
  assert.equal(context.resources.memory.used, 3);
  assert.deepEqual(context.resources.memory.breakdown, { verbs: 1, subjects: 1, files: 1 });
  assert.deepEqual(context.resources.shielding, { value: 8, max: 10 });
  assert.equal(context.verbs[0].item.name, "Blind");
  assert.equal(context.subjects[0].item.name, "Camera");
  assert.equal(context.files[0].memory, 1);
  assert.equal(context.runningPrograms.length, 1);
});

test("GM sees all eligible hackers while a player sees OWNER actors only", () => {
  const owned = hacker("owned", true);
  const denied = hacker("denied", false);
  const invalid = { ...hacker("deck", true), type: "cyberdeck" };
  assert.deepEqual(eligibleHackerActors([owned, denied, invalid], { isGM: true }).map((actor) => actor.id), ["owned", "denied"]);
  assert.deepEqual(eligibleHackerActors([owned, denied, invalid], { isGM: false }).map((actor) => actor.id), ["owned"]);
});

test("native hacker association persists on both Actors and unlink clears both sides", async () => {
  const deck = fixture();
  deck.system.hackerId = "";
  const operator = hacker();
  const actors = new Map([[operator.id, operator]]);
  assert.equal(await updateNativeHackerLink(deck, operator, { actors }), true);
  assert.equal(deck.system.hackerId, operator.id);
  assert.deepEqual(operator.system.cyberdecks, [deck.id]);
  assert.equal(await updateNativeHackerLink(deck, null, { actors }), true);
  assert.equal(deck.system.hackerId, null);
  assert.deepEqual(operator.system.cyberdecks, []);
});

test("sheet provides five tabs, CE-safe controls, GM fields, notes, and native item actions", () => {
  for (const name of names) assert.match(templates[name], /^(?:<header|<section)/u);
  assert.match(templates.header, /openNetworkConsole/u);
  assert.match(templates.operations, /assignHacker/u);
  assert.match(templates.programs, /data-action="viewDoc"/u);
  assert.match(templates.files, /data-action="deleteDoc"/u);
  assert.match(templates.configuration, /system\.wirelessConnectionPenalty/u);
  assert.match(templates.configuration, /\{\{#if cwnit\.isGM\}\}/u);
  assert.match(templates.notes, /flags\.cwn-interface-theme\.cyberdeckNotes/u);
  assert.match(source, /getCyberdeckStatus/u);
  assert.match(source, /Enable CWN Combat Enhancements/u);
  assert.match(css, /\.cwnit-cyberdeck-sheet-window/u);
});

test("custom sheet inherits native class and passes deck and hacker to CE", () => {
  class NativeSheet {}
  const SheetClass = createCwnCyberdeckSheetClass(NativeSheet);
  assert.equal(Object.getPrototypeOf(SheetClass), NativeSheet);
  assert.match(source, /cyberdeckUuid: this\.actor\.uuid/u);
  assert.match(source, /hackerUuid:/u);
});
