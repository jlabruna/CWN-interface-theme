const MODULE_ID = "cwn-interface-theme";
const ledgerApps = new Map();

export function formatLedgerCurrency(value, { signed = false } = {}) {
  const amount = Number(value) || 0;
  const absolute = Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (amount < 0) return `-$${absolute}`;
  if (signed && amount > 0) return `+$${absolute}`;
  return `$${absolute}`;
}

export function formatLedgerTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function accountsApi() {
  return globalThis.game?.cwnCombatEnhancements?.accounts ?? null;
}

function accountReferenceKey(reference) {
  if (typeof reference === "string") return reference;
  if (reference?.id) return reference.id;
  return `${reference?.kind ?? "extra"}:${reference?.index ?? "unknown"}`;
}

async function promptDescription(kind, api = globalThis.foundry?.applications?.api) {
  const DialogV2 = api?.DialogV2;
  if (!DialogV2?.prompt) return null;
  const label = kind === "credit" ? "Credit description" : "Debit description";
  const description = await DialogV2.prompt({
    window: { title: label },
    content: `<div class="cwnit-ledger-prompt"><label>${label}<textarea name="description" rows="3" maxlength="240" autofocus required></textarea></label><p>Describe what this transaction was for.</p></div>`,
    modal: true,
    rejectClose: false,
    ok: {
      label: "Confirm Transaction",
      icon: "fa-solid fa-check",
      callback: (_event, button) => String(button.form.elements.description.value ?? "").trim(),
    },
  });
  const clean = String(description ?? "").trim();
  if (!clean) {
    if (description !== null && description !== undefined) {
      globalThis.ui?.notifications?.warn?.("A transaction description is required.");
    }
    return null;
  }
  return clean;
}

export function createCwnAccountLedgerAppClass(api = globalThis.foundry?.applications?.api) {
  if (!api?.ApplicationV2 || !api?.HandlebarsApplicationMixin) return null;
  return class CwnAccountLedgerApp extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
    actor;
    actorId;
    accountReference;
    ledgerAppKey;

    constructor(actor, accountReference, ledgerAppKey = null) {
      super({ id: `cwnit-account-ledger-${actor.id}-${accountReferenceKey(accountReference)}` });
      this.actor = actor;
      this.actorId = actor.id;
      this.accountReference = accountReference;
      this.ledgerAppKey = ledgerAppKey ?? `${actor.id}:${accountReferenceKey(accountReference)}`;
    }

    static DEFAULT_OPTIONS = {
      classes: ["cwnit-account-ledger-window"],
      position: { width: 590, height: 680 },
      window: {
        title: "Account Transactions",
        icon: "fa-solid fa-building-columns",
        resizable: true,
        minimizable: true,
      },
      actions: {
        credit: this._onCredit,
        debit: this._onDebit,
      },
    };

    static PARTS = {
      main: { template: `modules/${MODULE_ID}/templates/dialogs/account-ledger-v090.hbs` },
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      const accounts = accountsApi();
      if (!accounts?.history) throw new Error("CWN Combat Enhancements account ledger is unavailable.");
      const result = await accounts.history(this.actor, this.accountReference);
      this.accountReference = result.account.id;
      const transactions = result.transactions.slice(0, 200).map((entry) => ({
        ...entry,
        amountText: formatLedgerCurrency(entry.amount, { signed: true }),
        balanceText: formatLedgerCurrency(entry.balance),
        dateText: formatLedgerTimestamp(entry.timestamp),
        isoTimestamp: new Date(entry.timestamp).toISOString(),
        amountClass: entry.amount < 0 ? "is-debit" : entry.amount > 0 ? "is-credit" : "is-neutral",
      }));
      return {
        ...context,
        account: {
          ...result.account,
          balanceText: formatLedgerCurrency(result.account.balance),
        },
        transactions,
        omittedCount: Math.max(0, result.transactions.length - transactions.length),
      };
    }

    static async _onCredit(event) {
      await this._transact(event, "credit");
    }

    static async _onDebit(event) {
      await this._transact(event, "debit");
    }

    async _transact(event, kind) {
      event.preventDefault();
      const amountInput = this.element?.querySelector?.("[data-cwnit-ledger-amount]");
      const amount = Number(amountInput?.value);
      if (!Number.isInteger(amount) || amount <= 0) {
        globalThis.ui?.notifications?.warn?.("Enter a whole-number amount greater than zero.");
        return;
      }
      const description = await promptDescription(kind);
      if (!description) return;
      const accounts = accountsApi();
      const operation = kind === "credit" ? accounts?.credit : accounts?.debit;
      if (typeof operation !== "function") {
        globalThis.ui?.notifications?.warn?.("Account transactions are unavailable.");
        return;
      }
      for (const button of this.element?.querySelectorAll?.("[data-action='credit'], [data-action='debit']") ?? []) {
        button.disabled = true;
      }
      try {
        await operation(this.actor, this.accountReference, amount, description);
        if (amountInput) amountInput.value = "";
        await this.render();
      } catch (error) {
        console.warn(`${MODULE_ID} | Account transaction failed`, error);
        globalThis.ui?.notifications?.warn?.(error?.message ?? "The transaction could not be completed.");
      }
    }

    async close(options = {}) {
      ledgerApps.delete(this.ledgerAppKey);
      return super.close(options);
    }
  };
}

export async function openCwnAccountLedger(actor, accountReference) {
  if (!actor?.isOwner && !globalThis.game?.user?.isGM) {
    globalThis.ui?.notifications?.warn?.("You do not have permission to use this account.");
    return false;
  }
  if (!accountsApi()?.history) {
    globalThis.ui?.notifications?.warn?.("Account transactions require CWN Combat Enhancements 0.22.0 or newer.");
    return false;
  }
  const key = `${actor.id}:${accountReferenceKey(accountReference)}`;
  let app = ledgerApps.get(key);
  if (!app) {
    const AppClass = createCwnAccountLedgerAppClass();
    if (!AppClass) return false;
    app = new AppClass(actor, accountReference, key);
    ledgerApps.set(key, app);
  } else {
    app.actor = actor;
    app.accountReference = accountReference;
  }
  await app.render(true);
  return app;
}
