import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  ACTION_REFERENCES,
  CHARACTER_SHEET_LABEL,
  registerCwnCharacterSheet,
} from "../scripts/sheets/cwn-character-sheet-v064.mjs";
import { weaponClassification } from "../scripts/sheets/cwn-sheet-shared-v062.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-character-sheet-v064.mjs", import.meta.url), "utf8");
const moduleSource = await fs.readFile(new URL("../scripts/cwn-interface-theme-v072.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v070.css", import.meta.url), "utf8");
const templateNames = ["header", "combat", "skills", "inventory", "cyberware", "features", "actions", "biography"];
const templateVersions = { header: "v064", combat: "v064", actions: "v063" };
const templates = Object.fromEntries(await Promise.all(templateNames.map(async (name) => [
  name,
  await fs.readFile(new URL(`../templates/sheets/character/${name}-${templateVersions[name] ?? "v062"}.hbs`, import.meta.url), "utf8"),
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

test("native SWNR contracts remain the mechanical item executors", () => {
  assert.match(templates.combat, /data-action="roll" data-roll-type="item"/u);
  assert.match(templates.combat, /data-action="reload"/u);
  assert.match(templates.combat, /data-action="rollSave"/u);
  assert.match(templates.combat, /data-action="toggleArmor"/u);
  assert.match(templates.skills, /data-action="rollSkill"/u);
  assert.ok(templates.skills.includes('data-action="rollSkill" data-item-id="{{skill._id}}"'));
  assert.match(templates.skills, /data-action="skillUp"/u);
  assert.match(templates.inventory, /items-list\.hbs/u);
  assert.match(templates.cyberware, /cyberware-list\.hbs/u);
  for (const template of Object.values(templates)) {
    assert.doesNotMatch(template, /<article[^>]*data-item-id/u, "draggable item rows must not use article");
  }
});

test("character initiative joins the active combat and rolls the combatant", async () => {
  class FakeSwnrSheet {}
  const registered = [];
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: (_scope, sheet) => registered.push(sheet) } } } },
  };
  const SheetClass = registerCwnCharacterSheet(runtime);
  const rolled = [];
  const actor = { id: "actor-1" };
  const token = { actor, document: { id: "token-1" } };
  const combatant = { id: "combatant-1", tokenId: "token-1" };
  globalThis.canvas = { scene: { id: "scene-1" }, tokens: { controlled: [token], placeables: [token] } };
  globalThis.game = {
    combat: {
      combatants: { find: () => combatant },
      async rollInitiative(ids) { rolled.push(ids); },
    },
  };
  await SheetClass.DEFAULT_OPTIONS.actions.rollInitiative.call(
    { actor },
    { preventDefault() {} },
  );
  assert.deepEqual(rolled, [["combatant-1"]]);
  delete globalThis.canvas;
  delete globalThis.game;
  assert.equal(registered[0], SheetClass);
});

test("skills are compact, lockable, and upgrades produce a chat confirmation", () => {
  assert.match(templates.skills, /data-action="toggleSkillControls"/u);
  assert.match(templates.skills, /cwnit\.skillsUnlocked/u);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(source, /cwnit-skill-upgrade/u);
  assert.match(source, /nativeSkillUp\.call\(this, event, target\)/u);
  assert.match(source, /generation >= 14 \? \{ messageMode: mode \} : \{ rollMode: mode \}/u);
  assert.match(source, /settings\.get\("core", "rollMode"\)/u);
});

test("identity fields are CWN-specific and submit Background only once", () => {
  const all = Object.values(templates).join("\n");
  assert.equal((all.match(/name="system\.background"/gu) ?? []).length, 1);
  for (const removed of ["system.class", "system.species", "system.employer", "system.homeworld"]) {
    assert.doesNotMatch(all, new RegExp(`name=["']${removed.replace(".", "\\.")}`, "u"));
  }
  assert.match(templates.header, /data-action="rest"/u);
  assert.match(templates.header, /Rest &amp; Recover/u);
});

test("level-up HP remains native and is surfaced through Action Centre setup", () => {
  assert.match(moduleSource, /renderApplicationV2/u);
  assert.match(moduleSource, /cwnce-action-center/u);
  assert.match(moduleSource, /actor\.system\?\.rollHitDice\?\.\(true\)/u);
  assert.match(moduleSource, /Set Up Later/u);
});

test("monthly expenses integration and native Readied combat loadout are exposed", () => {
  assert.match(templates.inventory, /cwnit-sheet__currency grid grid-5col/u);
  assert.match(source, /attack\.item\?\.system\?\.location === "readied"/u);
  assert.match(templates.combat, /No weapons are currently Readied/u);
  assert.doesNotMatch(source, /hideFromCombat|toggleWeaponCombatVisibility|toggleHiddenWeapons/u);
  assert.doesNotMatch(templates.combat, /hideFromCombat|toggleWeaponCombatVisibility|toggleHiddenWeapons/u);
});

test("combat keeps one initiative launcher and uses the NPC-style armor lower panel", () => {
  assert.match(templates.header, /data-action="rollInitiative"/u);
  assert.doesNotMatch(templates.combat, /data-action="rollInitiative"/u);
  assert.doesNotMatch(templates.actions, /data-action="rollInitiative"/u);
  assert.doesNotMatch(templates.combat, /data-action="openActionCentre"/u);
  assert.doesNotMatch(templates.combat, /cwnit-sheet__stats/u);
  assert.doesNotMatch(templates.combat, /data-action="openActionsTab"|data-action="declareAction"/u);
  assert.doesNotMatch(source, /openActionsTab|_onOpenActionsTab/u);
  assert.match(templates.combat, /cwnit-sheet__combat-columns--loadout/u);
  assert.match(templates.combat, /#each cwnit\.armor as \|armor\|/u);
  assert.match(templates.combat, /cwnit-sheet__armor-toggle \{\{#if armor\.isActive\}\}is-active/u);
  assert.match(templates.actions, /data-action="declareAction"/u);
  assert.doesNotMatch(templates.actions, /data-action="rollSave"/u);
  assert.match(css, /\.cwnit-sheet__armor-toggle\.is-active/u);
  assert.match(templates.combat, /cwnit-sheet__armor-empty/u);
});

test("character vitals distinguish ranged and melee AC and expose native Soak", () => {
  assert.match(source, /rangedAc: system\.ac \?\? system\.baseAc/u);
  assert.match(source, /meleeAc: system\.meleeAc \?\? system\.ac/u);
  assert.match(source, /soakValue: system\.soakTotal\?\.value/u);
  assert.match(source, /soakMax: system\.soakTotal\?\.max/u);
  assert.match(templates.header, /CWNIT\.Sheet\.Character\.RangedAC/u);
  assert.match(templates.header, /CWNIT\.Sheet\.Character\.MeleeAC/u);
  assert.match(templates.header, /CWNIT\.Sheet\.Character\.Soak/u);
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
  assert.match(css, /prose-mirror :is\(menu, \.editor-menu, \.prosemirror-menu\)/u);
  assert.match(css, /\.cwnit-chat-message :is\(\.cwnit-action-reference, \.cwnit-skill-upgrade\)/u);
  assert.match(css, /dt, dd/u);
});
