import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  ACTION_REFERENCES,
  CHARACTER_SHEET_LABEL,
  registerCwnCharacterSheet,
  skillRankTier,
} from "../scripts/sheets/cwn-character-sheet-v091.mjs";
import { linkedDronesForPilot, weaponClassification } from "../scripts/sheets/cwn-sheet-shared-v062.mjs";

const source = await fs.readFile(new URL("../scripts/sheets/cwn-character-sheet-v091.mjs", import.meta.url), "utf8");
const moduleSource = await fs.readFile(new URL("../scripts/cwn-interface-theme-v091.mjs", import.meta.url), "utf8");
const css = await fs.readFile(new URL("../styles/cwn-interface-theme-v090.css", import.meta.url), "utf8");
const templateNames = ["header", "combat", "skills", "inventory", "cyberware", "features", "actions", "biography"];
const templateVersions = { header: "v081", combat: "v081", skills: "v082", inventory: "v090", features: "v081", actions: "v080" };
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

test("character initiative joins combat and passes the actor-native formula for every user", async () => {
  class FakeSwnrSheet {}
  const registered = [];
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: (_scope, sheet) => registered.push(sheet) } } } },
  };
  const SheetClass = registerCwnCharacterSheet(runtime);
  const rolled = [];
  const actor = {
    id: "actor-1",
    rollInitiative() {
      return { formula: "2d8kh1 + @stats.dex.mod + 2" };
    },
  };
  const token = { actor, document: { id: "token-1" } };
  const combatant = { id: "combatant-1", tokenId: "token-1" };
  globalThis.canvas = { scene: { id: "scene-1" }, tokens: { controlled: [token], placeables: [token] } };
  globalThis.game = {
    combat: {
      combatants: { find: () => combatant },
      async rollInitiative(ids, options) { rolled.push({ ids, options }); },
    },
  };
  await SheetClass.DEFAULT_OPTIONS.actions.rollInitiative.call(
    { actor },
    { preventDefault() {} },
  );
  assert.deepEqual(rolled, [{
    ids: ["combatant-1"],
    options: { formula: "2d8kh1 + @stats.dex.mod + 2" },
  }]);
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
  assert.doesNotMatch(source, /rollSkill:\s*this\._onRollSkill/u);
  assert.doesNotMatch(source, /installSkillMessageModeCompat|Object\.defineProperty\(skill/u);
  assert.match(templates.skills, /data-action="rollSkill" data-item-id="\{\{skill\._id\}\}"/u);
});

test("skill ranks use semantic numeric-only colour tiers", () => {
  assert.equal(skillRankTier(-1), "untrained");
  assert.equal(skillRankTier(0), "trained");
  assert.equal(skillRankTier(1), "professional");
  assert.equal(skillRankTier(2), "expert");
  assert.equal(skillRankTier(5), "expert");
  assert.match(templates.skills, /<b class="cwnit-sheet__skill-level cwnit-sheet__skill-level--\{\{lookup/u);
  for (const tier of ["untrained", "trained", "professional", "expert"]) {
    assert.match(css, new RegExp(`--cwnit-skill-rank-${tier}`, "u"));
    assert.match(css, new RegExp(`cwnit-sheet__skill-level--${tier}`, "u"));
  }
  assert.doesNotMatch(templates.skills, /cwnit-sheet__skill-roll[^>]*(?:untrained|trained|professional|expert)/u);
});

test("Psychic Points follows the native Show Psychic field without hiding skills", () => {
  assert.match(templates.skills, /\{\{#if system\.tweak\.showPsychic\}\}<label>Psychic Points/u);
  assert.match(templates.skills, /#each cwnit\.skills as \|skill\|/u);
  assert.doesNotMatch(source, /skills\.filter\([^)]*showPsychic/su);
});

test("ordinary rerenders restore the active Character tab scroll position", () => {
  class FakeSwnrSheet { _onRender() {} }
  const SheetClass = registerCwnCharacterSheet({
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet() {} } } } },
  });
  const sheet = new SheetClass();
  const listeners = {};
  const scrollContainer = {
    scrollTop: 0,
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  const tabListeners = {};
  const combatTab = {
    dataset: { tab: "combat" },
    addEventListener(type, handler) { tabListeners[type] = handler; },
  };
  sheet.tabGroups = { primary: "skills" };
  sheet._cwnitScrollPositions = new Map([["skills", 137]]);
  sheet.element = {
    querySelector(selector) {
      return selector === ".cwnit-sheet__body.active" ? scrollContainer : null;
    },
    querySelectorAll() { return [combatTab]; },
  };
  sheet._onRender({}, {});
  assert.equal(scrollContainer.scrollTop, 137);
  scrollContainer.scrollTop = 221;
  listeners.scroll();
  assert.equal(sheet._cwnitScrollPositions.get("skills"), 221);
  tabListeners.click();
  assert.equal(sheet._cwnitScrollPositions.get("combat"), 0);
});

test("Character tabs and checkboxes use consistent scoped controls", () => {
  assert.match(css, /\.cwnit-character-sheet-window nav\.tabs > \[data-tab\]\.active/u);
  assert.match(css, /display: grid !important/u);
  assert.match(css, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\) !important/u);
  assert.match(css, /flex: none !important/u);
  assert.match(css, /box-shadow: inset 0 -3px 0 var\(--cwnit-sheet-primary\)/u);
  assert.doesNotMatch(css, /nav\.tabs > \[data-tab\]\.active \{[^}]*border-bottom: 3px/su);
  assert.match(css, /input\[type="checkbox"\]/u);
  assert.match(css, /appearance: auto !important/u);
  assert.match(css, /accent-color: var\(--cwnit-sheet-secondary\)/u);
});

test("identity fields are CWN-specific and submit Background only once", () => {
  const all = Object.values(templates).join("\n");
  assert.equal((all.match(/name="system\.background"/gu) ?? []).length, 1);
  for (const removed of ["system.class", "system.species", "system.employer", "system.homeworld"]) {
    assert.doesNotMatch(all, new RegExp(`name=["']${removed.replace(".", "\\.")}`, "u"));
  }
  assert.doesNotMatch(templates.header, /data-action="rest"/u);
  assert.match(templates.header, /data-action="scene"/u);
  assert.match(templates.actions, /data-action="rest"/u);
  assert.match(templates.actions, /Rest &amp; Recover/u);
});

test("Cyberware lists reverse-linked visible drones and opens them through the shared Actor action", () => {
  const pilot = { id: "pilot" };
  const visible = { id: "visible", name: "Visible Drone", type: "drone", system: { crewMembers: ["pilot"] }, testUserPermission: () => true };
  const hidden = { id: "hidden", name: "Hidden Drone", type: "drone", system: { crewMembers: ["pilot"] }, testUserPermission: () => false };
  const otherPilot = { id: "other", name: "Other Drone", type: "drone", system: { crewMembers: ["someone-else"] }, testUserPermission: () => true };
  assert.deepEqual(linkedDronesForPilot(pilot, { actors: [hidden, otherPilot, visible], user: { isGM: false } }), [visible]);
  assert.deepEqual(linkedDronesForPilot(pilot, { actors: [hidden, visible], user: { isGM: true } }).map((actor) => actor.id), ["hidden", "visible"]);
  assert.match(templates.cyberware, /Linked Drones/u);
  assert.match(templates.cyberware, /#each cwnit\.linkedDrones/u);
  assert.match(templates.cyberware, /data-action="openLinkedActor" data-actor-id="\{\{drone\.id\}\}"/u);
  assert.match(templates.cyberware, /data-action="openMaintenance"/u);
});

test("level-up HP remains native and is surfaced through Action Centre setup", () => {
  assert.match(moduleSource, /renderApplicationV2/u);
  assert.match(moduleSource, /cwnce-action-center/u);
  assert.match(moduleSource, /actor\.system\?\.rollHitDice\?\.\(true\)/u);
  assert.match(moduleSource, /Set Up Later/u);
});

test("monthly expenses integration and native Readied combat loadout are exposed", () => {
  assert.match(templates.inventory, /cwnit-sheet__currency[^"\n]*grid grid-5col/u);
  assert.match(templates.inventory, /cwnit-sheet__accounts-drawer/u);
  assert.match(templates.inventory, /Accounts &amp; Monthly Expenses/u);
  assert.match(templates.inventory, /cwnit\.accountsOpen/u);
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

test("Combat Enhancements integration uses only public Action Centre and usage APIs", () => {
  assert.match(source, /cwnCombatEnhancements\?\.actions\?\.open/u);
  assert.match(source, /cwnCombatEnhancements\?\.actions\?\.resetUsage/u);
  assert.match(source, /api\?\.focus\?\.availableActions/u);
  assert.match(source, /api\?\.edge\?\.availableActions/u);
  assert.doesNotMatch(source, /markFocusActionUsed|setFlag|unsetFlag/u);
});

test("common combat actions are declaration-only references", () => {
  assert.deepEqual(Object.keys(ACTION_REFERENCES), [
    "total-defense", "fighting-withdrawal", "hold-action", "swarm-attack",
    "charge", "screen-an-ally", "snap-attack", "execution-attack",
  ]);
  assert.match(ACTION_REFERENCES["swarm-attack"].summary, /maximum of \+6\/\+3/u);
  assert.match(ACTION_REFERENCES["swarm-attack"].summary, /does not add to Shock/u);
  assert.match(source, /Declaration\/reference only — no mechanical state was changed/u);
  assert.doesNotMatch(source, /actor\.update|updateEmbeddedDocuments|registerSchema|migrat/iu);
});

test("scene reset and Rest use native SWNR recovery while Rest offers optional rules Access reprogramming", () => {
  assert.match(templates.header, /data-action="scene"/u);
  assert.match(templates.actions, /data-action="rest"/u);
  assert.match(source, /refreshActor\(\{ actor: this\.actor, cadence: "scene", createChat: false \}\)/u);
  assert.match(source, /await this\._resetSoak\(\)/u);
  assert.match(source, /resetCombatEnhancementSceneUsage/u);
  assert.match(source, /cwnit-scene-refresh/u);
  assert.match(source, /rest: this\._onRestWithAccess/u);
  assert.match(source, /Spend one hour reprogramming a linked cyberdeck/u);
  assert.match(source, /beginNewDay/u);
  assert.match(source, /accessApi\?\.refresh/u);
  assert.doesNotMatch(source, /actor\.update\(\{[^}]*system\.(?:soak|pools)/su);
});

test("GM advanced configuration exposes native Character fields only to GMs", () => {
  assert.match(source, /isGM: Boolean\(globalThis\.game\?\.user\?\.isGM\)/u);
  assert.match(templates.features, /\{\{#if cwnit\.isGM\}\}/u);
  for (const path of [
    "system.tweak.advInit", "system.tweak.initiative.mod", "system.tweak.showCyberware",
    "system.tweak.showPsychic", "system.tweak.showArts", "system.tweak.showSpells",
    "system.tweak.showAdept", "system.tweak.showMutation", "system.tweak.showPoolsInHeader",
    "system.tweak.showPoolsInPowers", "system.tweak.showPoolsInCombat",
    "system.tweak.otherLabel", "system.tweak.extraLabel", "system.tweak.modifiers.unskilledPenalty",
  ]) assert.match(templates.features, new RegExp(`name="${path.replaceAll(".", "\\.")}"`, "u"));
  for (const field of ["base", "boost", "modModifier"]) {
    assert.ok(templates.features.includes(`name="system.stats.{{stat.key}}.${field}"`));
  }
  assert.match(templates.features, /cwnit\.advancedConfigOpen/u);
  assert.match(source, /_cwnitAdvancedConfigOpen/u);
  assert.doesNotMatch(templates.features, /system\.credits\.(?:debt|balance|owed)/u);
});

test("native capability and pool placement fields affect the alternative layout", () => {
  assert.match(source, /POWER_VISIBILITY_FIELDS/u);
  assert.match(source, /visiblePowers/u);
  assert.match(source, /showCyberware\) options\.parts\.push\("cyberware"\)/u);
  assert.match(templates.features, /#each cwnit\.visiblePowers/u);
  assert.match(templates.header, /showPoolsInHeader/u);
  assert.match(templates.features, /showPoolsInPowers/u);
  assert.match(templates.combat, /showPoolsInCombat/u);
  for (const template of [templates.header, templates.features, templates.combat]) {
    assert.match(template, /pools-display\.hbs/u);
  }
  assert.match(templates.features, /do not remove owned Skill Items such as Psychic/u);
});

test("End Scene reports native and CE recovery through one themed summary", async () => {
  class FakeSwnrSheet {
    async _resetSoak() {
      this.actor.system.soakTotal.value = this.actor.system.soakTotal.max;
    }
  }
  const registered = [];
  const runtime = {
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet: (_scope, sheet) => registered.push(sheet) } } } },
  };
  const SheetClass = registerCwnCharacterSheet(runtime);
  const actor = { id: "actor-1", system: { soakTotal: { value: 2, max: 5 } } };
  const resets = [];
  const messages = [];
  globalThis.canvas = { scene: { id: "scene-1" } };
  globalThis.swnr = { utils: { refreshActor: async (options) => {
    assert.equal(options.createChat, false);
    return { poolsRefreshed: 1, effortReleased: ["Effort"] };
  } } };
  globalThis.game = {
    cwnCombatEnhancements: {
      actions: { resetUsage: async (_actor, predicate) => resets.push(predicate("scene:scene-1")) },
      focus: { availableActions: () => [{ key: "ghost-reroll", label: "Ghost: reroll failed Sneak check", cadence: "scene", available: false }] },
      edge: { availableActions: () => [] },
    },
  };
  globalThis.ChatMessage = class {
    static getSpeaker() { return { actor: "actor-1" }; }
    static async create(data) { messages.push(data); }
  };
  const sheet = new SheetClass();
  sheet.actor = actor;
  await SheetClass.DEFAULT_OPTIONS.actions.scene.call(sheet, { preventDefault() {} }, {});
  assert.deepEqual(resets, [true]);
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Soak:<\/strong> 2\/5 → 5\/5/u);
  assert.match(messages[0].content, /1 refreshed — Ghost/u);
  assert.match(messages[0].content, /1 refreshed/u);
  delete globalThis.canvas;
  delete globalThis.swnr;
  delete globalThis.game;
  delete globalThis.ChatMessage;
  assert.equal(registered[0], SheetClass);
});

test("End Scene remains functional when Combat Enhancements is disabled", async () => {
  class FakeSwnrSheet {
    async _resetSoak() {
      this.actor.system.soakTotal.value = this.actor.system.soakTotal.max;
    }
  }
  const SheetClass = registerCwnCharacterSheet({
    swnr: { applications: { SWNActorSheet: FakeSwnrSheet } },
    foundry: { documents: { collections: { Actors: { registerSheet() {} } } } },
  });
  const actor = { id: "actor-without-ce", system: { soakTotal: { value: 1, max: 4 } } };
  const messages = [];
  globalThis.swnr = { utils: { refreshActor: async () => ({ poolsRefreshed: 0, effortReleased: [] }) } };
  globalThis.game = {};
  globalThis.ChatMessage = class {
    static getSpeaker() { return { actor: actor.id }; }
    static async create(data) { messages.push(data); }
  };
  const sheet = new SheetClass();
  sheet.actor = actor;
  await SheetClass.DEFAULT_OPTIONS.actions.scene.call(sheet, { preventDefault() {} }, {});
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Soak:<\/strong> 1\/4 → 4\/4/u);
  assert.match(messages[0].content, /Scene abilities:<\/strong> none required recovery/u);
  delete globalThis.swnr;
  delete globalThis.game;
  delete globalThis.ChatMessage;
});

test("System Strain display identifies SWNR usable capacity without rounding or mutation", () => {
  assert.match(source, /strainMax: system\.systemStrain\?\.max/u);
  assert.match(source, /strainConstitution: system\.stats\?\.con\?\.total/u);
  assert.match(source, /strainCyberware: system\.systemStrain\?\.cyberware/u);
  assert.match(source, /strainPermanent: system\.systemStrain\?\.permanent/u);
  assert.match(templates.header, /Strain Used/u);
  assert.match(templates.features, /Constitution minus cyberware strain minus permanent strain/u);
  assert.doesNotMatch(source, /Math\.(?:round|floor|ceil).*strain/iu);
});

test("Inventory exposes read-only native balances through the public CE ledger API", () => {
  assert.match(source, /cwnCombatEnhancements\?\.accounts/u);
  assert.match(source, /accountLedgerApi\.peek\(actor\)/u);
  assert.match(templates.inventory, /#each cwnit\.accounts as \|account\|/u);
  assert.match(templates.inventory, /data-action="openAccountLedger"/u);
  assert.match(templates.inventory, /data-action="addLedgerAccount"/u);
  assert.match(templates.inventory, /data-action="editLedgerAccount"/u);
  assert.match(templates.inventory, /<output class=/u);
  assert.doesNotMatch(templates.inventory, /data-action="creditChange"/u);
  assert.doesNotMatch(templates.inventory, /name="system\.credits/u);
  assert.match(templates.inventory, /Transactions require CWN Combat Enhancements 0\.22\.0/u);
  assert.match(templates.inventory, /data-action="addCurrency"/u);
  assert.match(templates.inventory, /data-action="editCurrency"/u);
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
