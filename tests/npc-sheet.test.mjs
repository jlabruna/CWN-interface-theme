import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  MODULE_ID,
  SHEET_LABEL,
  prepareNpcSheetContext,
  registerCwnNpcSheet,
  resolveSwnrActorSheet,
} from "../scripts/sheets/cwn-npc-sheet-v062.mjs";

const sheetSource = await fs.readFile(new URL("../scripts/sheets/cwn-npc-sheet-v062.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v062.css", import.meta.url), "utf8");
const templateFiles = {
  header: "header-v062",
  combat: "combat-v062",
  inventory: "inventory",
  cyberware: "cyberware",
  features: "features",
  biography: "biography-v062",
};
const templates = Object.fromEntries(await Promise.all(Object.keys(templateFiles).map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/npc/${templateFiles[name]}.hbs`, import.meta.url), "utf8"),
])));

function countTopLevelElements(template) {
  const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const tags = template.matchAll(/<\/?([a-z][\w-]*)(?:\s[^<>]*?)?\s*\/?>/giu);
  let depth = 0;
  let roots = 0;
  for (const match of tags) {
    const tag = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    const selfClosing = match[0].endsWith("/>") || voidElements.has(tag);
    if (closing) {
      depth -= 1;
      assert.ok(depth >= 0, `unexpected closing ${tag} tag`);
      continue;
    }
    if (depth === 0) roots += 1;
    if (!selfClosing) depth += 1;
  }
  assert.equal(depth, 0, "template has unclosed HTML elements");
  return roots;
}

function item(id, type, system = {}) {
  return { id, _id: id, name: id, img: `${id}.webp`, sort: 0, type, system };
}

test("NPC sheet registration is optional, NPC-only, and never the default", () => {
  class FakeSwnrSheet {}
  const calls = [];
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: (...args) => calls.push(args) } } } },
  };
  const SheetClass = registerCwnNpcSheet(runtime);
  assert.equal(Object.getPrototypeOf(SheetClass), FakeSwnrSheet);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], MODULE_ID);
  assert.equal(calls[0][1], SheetClass);
  assert.deepEqual(calls[0][2], { types: ["npc"], makeDefault: false, label: SHEET_LABEL });
});

test("registration feature-detects the supported SWNR runtime export", () => {
  class FakeSwnrSheet {}
  assert.equal(resolveSwnrActorSheet({ swnr: { applications: { SWNActorSheet: FakeSwnrSheet } } }), FakeSwnrSheet);
  assert.equal(resolveSwnrActorSheet({}), null);
});

test("missing SWNR sheet support queues one GM-facing warning and does not register", () => {
  let readyCallback;
  const runtime = { Hooks: { once: (_hook, callback) => { readyCallback = callback; } } };
  assert.equal(registerCwnNpcSheet(runtime), null);
  assert.equal(typeof readyCallback, "function");
});

test("initiative action creates a missing combatant and rolls through the active tracker", async () => {
  class FakeSwnrSheet {}
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: () => {} } } } },
  };
  const SheetClass = registerCwnNpcSheet(runtime);
  const tokenDocument = { id: "token-1", actor: {} };
  const actor = { id: "npc-1", token: tokenDocument };
  const created = [];
  const rolled = [];
  const combat = {
    combatants: [],
    async createEmbeddedDocuments(type, documents) {
      created.push({ type, documents });
      return [{ id: "combatant-1" }];
    },
    async rollInitiative(ids) { rolled.push(ids); },
  };
  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  globalThis.canvas = { scene: { id: "scene-1" }, tokens: { controlled: [], placeables: [] } };
  globalThis.game = { combat };
  globalThis.ui = { notifications: { warn: () => {} } };
  try {
    await SheetClass.DEFAULT_OPTIONS.actions.rollInitiative.call(
      { actor },
      { preventDefault() {} },
    );
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.ui = previousUi;
  }
  assert.deepEqual(created, [{
    type: "Combatant",
    documents: [{ tokenId: "token-1", actorId: "npc-1", sceneId: "scene-1" }],
  }]);
  assert.deepEqual(rolled, [["combatant-1"]]);
});

test("display context groups known and unknown documents without mutating actor data", () => {
  const weapon = item("weapon", "weapon", {
    isMelee: true,
    ab: 1,
    damage: "1d8",
    ammo: { type: "none" },
    shock: { dmg: 2, ac: 15 },
    trauma: { die: "1d8", rating: 2 },
  });
  const armor = item("armor", "armor", { ac: 16 });
  const unknown = item("custom", "mystery", {});
  const actor = {
    system: { ab: 7, meleeAb: 6, cyberdecks: ["deck"] },
    items: [weapon, armor, unknown],
    itemTypes: { weapon: [weapon], armor: [armor], feature: [], cyberware: [], power: [] },
    effects: [],
  };
  const before = JSON.stringify(actor);
  const context = prepareNpcSheetContext(actor, { resolveActor: (id) => ({ id, name: "Deck" }) });
  assert.equal(context.weapons[0].actorAttackBonus, 6);
  assert.equal(context.weapons[0].shock, "2 / AC 15");
  assert.equal(context.armor[0].item, armor);
  assert.equal(context.armor[0].isActive, false);
  assert.equal(context.otherItems[0], unknown);
  assert.equal(context.linkedCyberdecks[0].id, "deck");
  assert.equal(JSON.stringify(actor), before);
});

test("templates preserve native SWNR roll, reload, item management, and drag contracts", () => {
  assert.match(templates.combat, /data-action="roll" data-roll-type="item"/u);
  assert.match(templates.combat, /data-action="reload"/u);
  assert.match(templates.combat, /data-drag="true"/u);
  assert.match(templates.inventory, /systems\/swnr\/templates\/actor\/fragments\/items-list\.hbs/u);
  assert.match(templates.inventory, /consumable-list\.hbs/u);
  assert.match(templates.cyberware, /cyberware-list\.hbs/u);
  assert.match(templates.features, /data-document-class="ActiveEffect"/u);
  assert.match(templates.combat, /<li class="cwnit-sheet--npc__attack item"/u);
  assert.doesNotMatch(templates.combat, /data-action="reactionRoll"/u);
  assert.doesNotMatch(templates.combat, /data-action="createDoc"[^>]*data-type="weapon"/u);
});

test("every ApplicationV2 template part renders exactly one top-level HTML element", () => {
  for (const [name, template] of Object.entries(templates)) {
    assert.equal(countTopLevelElements(template), 1, `${name} must have exactly one root element`);
  }
  assert.match(templates.header, /^\s*<div class="cwnit-sheet--npc__masthead">/u);
  assert.match(sheetSource, /header-v062\.hbs/u);
  assert.match(sheetSource, /combat-v062\.hbs/u);
  assert.doesNotMatch(templates.header, /<button[^>]*data-edit="img"/u);
  assert.match(templates.header, /<img[^>]*data-action="onEditImage"[^>]*data-edit="img"/u);
});

test("sheet implementation has no internal SWNR import, migration, schema, or direct item update path", () => {
  assert.doesNotMatch(sheetSource, /from\s+["'][^"']*swnr/u);
  assert.doesNotMatch(sheetSource, /migrat|registerSchema|updateEmbeddedDocuments|\.update\(/iu);
  assert.doesNotMatch(sheetSource, /unregisterSheet/u);
  assert.match(sheetSource, /game\?\.cwnCombatEnhancements\?\.actions\?\.open/u);
  assert.match(sheetSource, /createEmbeddedDocuments\("Combatant"/u);
  assert.match(sheetSource, /combat\.rollInitiative\(\[combatant\.id\]\)/u);
});

test("NPC styling is isolated and uses centralized tactical color tokens", () => {
  for (const token of ["--cwnit-sheet-primary", "--cwnit-sheet-secondary", "--cwnit-sheet-warning", "--cwnit-sheet-text"]) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  assert.match(css, /\.cwnit-npc-sheet-window nav\.tabs/u);
  assert.match(css, /color-mix\(in srgb, var\(--cwnit-sheet-(?:primary|secondary)\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.cwnit-npc-sheet-window/u);
  assert.match(css, /\.cwnit-sheet--npc__armor-toggle\.is-active/u);
});

test("sheet provides all five requested local tabs with Combat first", () => {
  const order = ["combat", "inventory", "cyberware", "features", "biography"];
  let previous = -1;
  for (const tab of order) {
    const next = sheetSource.indexOf(`${tab}: { template`);
    assert.ok(next > previous, `${tab} is missing or out of order`);
    previous = next;
  }
  assert.match(sheetSource, /options\.defaultTab = "combat"/u);
});
