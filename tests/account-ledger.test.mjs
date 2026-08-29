import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  createCwnAccountLedgerAppClass,
  formatLedgerCurrency,
} from "../scripts/sheets/cwn-account-ledger-v090.mjs";

const source = await fs.readFile(
  new URL("../scripts/sheets/cwn-account-ledger-v090.mjs", import.meta.url),
  "utf8",
);
const template = await fs.readFile(
  new URL("../templates/dialogs/account-ledger-v090.hbs", import.meta.url),
  "utf8",
);
const css = await fs.readFile(
  new URL("../styles/cwn-interface-theme-v090.css", import.meta.url),
  "utf8",
);

test("currency formatting preserves signs and whole native balances", () => {
  assert.equal(formatLedgerCurrency(2500), "$2,500");
  assert.equal(formatLedgerCurrency(2500, { signed: true }), "+$2,500");
  assert.equal(formatLedgerCurrency(-3500, { signed: true }), "-$3,500");
  assert.equal(formatLedgerCurrency(0, { signed: true }), "$0");
});

test("ledger dialog uses the CE public history API and limits the rendered history", async () => {
  class ApplicationV2 {
    constructor(options) { this.options = options; }
    async _prepareContext() { return { inherited: true }; }
  }
  const AppClass = createCwnAccountLedgerAppClass({
    ApplicationV2,
    HandlebarsApplicationMixin: (Base) => class extends Base {},
  });
  const transactions = Array.from({ length: 205 }, (_, index) => ({
    id: `tx-${index}`,
    amount: index % 2 ? -1 : 1,
    balance: 100 - index,
    description: `Entry ${index}`,
    userName: "Tester",
    timestamp: 1000 + index,
  }));
  const calls = [];
  globalThis.game = {
    cwnCombatEnhancements: {
      accounts: {
        async history(actor, reference) {
          calls.push({ actor, reference });
          return {
            account: { id: "stable-account", name: "Debt", balance: -105 },
            transactions,
          };
        },
      },
    },
  };
  const actor = { id: "actor-1" };
  const app = new AppClass(actor, { kind: "extra", index: 0 }, "actor-1:extra:0");
  const context = await app._prepareContext({});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].actor, actor);
  assert.deepEqual(calls[0].reference, { kind: "extra", index: 0 });
  assert.equal(app.accountReference, "stable-account");
  assert.equal(context.account.balanceText, "-$105");
  assert.equal(context.transactions.length, 200);
  assert.equal(context.omittedCount, 5);
  assert.equal(context.transactions[0].amountText, "+$1");
  assert.equal(context.transactions[1].amountText, "-$1");
  delete globalThis.game;
});

test("ledger surface is append-only, themed, and requires descriptions", () => {
  assert.match(template, /data-action="credit"/u);
  assert.match(template, /data-action="debit"/u);
  assert.match(template, /A description is required/u);
  assert.match(template, /Newest first/u);
  assert.match(template, /entry\.description/u);
  assert.match(template, /entry\.userName/u);
  assert.match(template, /entry\.balanceText/u);
  assert.doesNotMatch(template, /data-action="(?:edit|delete)"/iu);
  assert.match(source, /accounts\.history/u);
  assert.match(source, /accounts\?\.credit/u);
  assert.match(source, /accounts\?\.debit/u);
  assert.doesNotMatch(source, /ChatMessage|postToChat|createChat/u);
  assert.match(css, /\.cwnit-account-ledger-window/u);
  assert.match(css, /body\.theme-light/u);
  assert.match(css, /--cwnit-ledger-credit/u);
  assert.match(css, /--cwnit-ledger-debit/u);
});
