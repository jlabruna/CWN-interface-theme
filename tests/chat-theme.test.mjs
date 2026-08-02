import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const css = await fs.readFile(
  new URL("../styles/cwn-interface-theme-v043.css", import.meta.url),
  "utf8",
);
const source = await fs.readFile(
  new URL("../scripts/cwn-interface-theme-v042.mjs", import.meta.url),
  "utf8",
);

test("theme CSS has balanced rule blocks", () => {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(
    [...withoutComments].reduce((depth, character) => {
      if (character === "{") return depth + 1;
      if (character === "}") return depth - 1;
      return depth;
    }, 0),
    0,
  );
});

test("modifier breakdowns use readable theme variables", () => {
  for (const selector of [
    ".cwnit-chat-message .cwnce-modifier-breakdown {",
    ".cwnit-chat-message .cwnce-modifier-breakdown :is(h4, dt, dd) {",
    ".cwnit-chat-message .cwnce-modifier-breakdown dt small {",
    ".cwnit-chat-message .cwnce-modifier-breakdown .cwnce-breakdown-total {",
  ]) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
  assert.match(css, /cwnce-modifier-breakdown[\s\S]*?color: var\(--cwnit-text\)/u);
  assert.match(css, /cwnce-breakdown-total[\s\S]*?color: var\(--cwnit-accent\)/u);
});

test("Target Check rows use readable theme variables", () => {
  for (const selector of [
    ".cwnit-chat-message .cwnce-target {",
    ".cwnit-chat-message .cwnce-target :is(.cwnce-target-name, dt, dd) {",
  ]) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
  assert.match(css, /cwnce-target[\s\S]*?color: var\(--cwnit-text\)/u);
});

test("ordinary chat and private-message selectors remain chat scoped", () => {
  for (const selector of [
    ".cwnit-chat-message .message-content",
    ".cwnit-chat-message .inline-roll",
    ".chat-message.cwnit-theme-light:is(.whisper, .message-whisper)",
    ".chat-message.cwnit-theme-dark:is(.blind, .message-blind)",
  ]) {
    assert.ok(css.includes(selector), `missing ${selector}`);
  }
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:table|tr|td|span)\s*\{/mu);
});

test("all rendered chat messages receive the current interface theme", () => {
  assert.match(source, /renderChatMessageHTML/u);
  assert.match(source, /root\?\.matches\?\.\("\.chat-message"\)/u);
  assert.match(source, /document\.querySelectorAll\("\.chat-message"\)/u);
});
