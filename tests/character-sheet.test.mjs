import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  ACTION_REFERENCES,
  CHARACTER_SHEET_LABEL,
  registerCwnCharacterSheet,
} from "../scripts/sheets/cwn-character-sheet-v060.mjs";
import { weaponClassification } from "../scripts/sheets/cwn-sheet-shared-v060.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-character-sheet-v060.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v060.css", import.meta.url), "utf8");
const templateNames = ["header", "combat", "skills", "inventory", "cyberware", "features", "actions", "biography"];
const templates = Object.fromEntries(await Promise.all(templateNames.map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/character/${name}-v060.hbs`, import.meta.url), "utf8"),
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

test("character sheet registers for character actors only and is never default", () => {
  class FakeSwnrSheet {}
  const calls = [];
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: (...args) => calls.push(args) } } } },
  };
  const SheetClass = registerCwnCharacterSheet(runtime);
  assert.equal(Object.getPrototypeOf(SheetClass), FakeSwnrSheet);
  assert.deepEqual(calls[0][2], { types: ["character"], makeDefault: false, label: CHARACTER_SHEET_LABEL });
});

test("character sheet safely declines registration without supported SWNR API", () => {
  assert.equal(registerCwnCharacterSheet({}), null);
});

test("character sheet exposes all seven requested tabs with Combat first", () => {
  const order = ["combat", "skills", "inventory", "cyberware", "features", "actions", "biography"];
  let previous = -1;
  for (const tab of order) {
    const next = source.indexOf(`${tab}: { template`);
    assert.ok(next > previous, `${tab} missing or out of order`);
    previous = next;
  }
  assert.match(source, /options\.defaultTab = "combat"/u);
});

test("every character ApplicationV2 template part has exactly one root", () => {
  for (const [name, template] of Object.entries(templates)) {
    assert.equal(countTopLevelElements(template), 1, `${name} needs one root`);
  }
  assert.doesNotMatch(templates.header, /<button[^>]*data-edit="img"/u);
  assert.match(templates.header, /<img[^>]*data-action="onEditImage"[^>]*data-edit="img"/u);
});

test("native SWNR contracts remain the only mechanical item and roll executors", () => {
  assert.match(templates.combat, /data-action="roll" data-roll-type="item"/u);
  assert.match(templates.combat, /data-action="reload"/u);
  assert.match(templates.combat, /data-action="rollSave"/u);
  assert.match(templates.skills, /data-action="rollSkill"/u);
  assert.match(templates.skills, /data-action="skillUp"/u);
  assert.match(templates.inventory, /items-list\.hbs/u);
  assert.match(templates.cyberware, /cyberware-list\.hbs/u);
  for (const template of Object.values(templates)) {
    assert.doesNotMatch(template, /<article[^>]*data-item-id/u, "draggable item rows must not use article");
  }
});

test("Combat Enhancements integration uses only the public combined Action Centre opener", () => {
  assert.match(source, /cwnCombatEnhancements\?\.actions\?\.open/u);
  assert.doesNotMatch(source, /cwnCombatEnhancements\?\.(?:focus|edge)/u);
  assert.doesNotMatch(source, /resetUsage|manageUsage|useAction/u);
});

test("common combat actions are declaration-only references", () => {
  assert.deepEqual(Object.keys(ACTION_REFERENCES), ["total-defense", "fighting-withdrawal", "hold-action", "execution-attack"]);
  assert.match(source, /Declaration\/reference only — no mechanical state was changed/u);
  assert.doesNotMatch(source, /actor\.update|updateEmbeddedDocuments|registerSchema|migrat/iu);
});

test("weapon classification uses Content Pack base weapon then family then mode", () => {
  assert.equal(weaponClassification({ flags: { "harbour-city-stories": { baseWeapon: "Submachine Gun", weaponFamily: "rifle" } }, system: {} }), "Submachine Gun");
  assert.equal(weaponClassification({ flags: { "harbour-city-stories": { weaponFamily: "advanced-sword" } }, system: {} }), "Advanced Sword");
  assert.equal(weaponClassification({ flags: {}, system: { isMelee: true } }), "Melee Weapon");
});

test("sheet design tokens are shared and rich text toolbar is placed in its own row", () => {
  assert.match(css, /:is\(\.cwnit-npc-sheet-window, \.cwnit-character-sheet-window\) \{/u);
  assert.match(css, /prose-mirror > :is\(menu, \.editor-menu, \.prosemirror-menu\)/u);
  assert.match(css, /position: static !important/u);
});
