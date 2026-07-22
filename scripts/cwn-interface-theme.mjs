const MODULE_ID = "cwn-interface-theme";
const THEME_CLASSES = ["cwnit-theme-light", "cwnit-theme-dark"];

Hooks.on("renderChatMessage", (_message, html) => {
  if (game.system.id !== "swnr") return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelector(".chat-card")) return;
  applyChatTheme(root);
});

Hooks.on("renderChatLog", () => {
  if (game.system.id !== "swnr") return;
  refreshChatThemes();
});

Hooks.on("updateSetting", (setting) => {
  if (game.system.id !== "swnr" || setting.key !== "core.uiConfig") return;
  requestAnimationFrame(refreshChatThemes);
});

Hooks.once("ready", () => {
  if (game.system.id !== "swnr") return;
  refreshChatThemes();
  observeChatThemeAncestors();
  console.info(`${MODULE_ID} | Adaptive SWNR chat-card theme ready`);
});

/**
 * Follow Foundry v13's explicit Interface preference. The document body's
 * theme class reflects the separate Applications preference and cannot be used
 * to decide how chat-sidebar content should appear.
 */
function applyChatTheme(root) {
  if (!root?.querySelector(".chat-card")) return;

  const isDark = getInterfaceTheme() === "dark";

  root.classList.add("cwnit-chat-message");
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(isDark ? "cwnit-theme-dark" : "cwnit-theme-light");
}

function getInterfaceTheme() {
  const preference = game.settings
    .get("core", "uiConfig")
    ?.colorScheme?.interface;

  if (preference === "dark" || preference === "light") return preference;
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function refreshChatThemes() {
  for (const card of document.querySelectorAll(".chat-message .chat-card")) {
    const message = card.closest(".chat-message");
    if (message) applyChatTheme(message);
  }
}

/** Refresh existing cards when Foundry reapplies its UI configuration. */
function observeChatThemeAncestors() {
  const chatLog = document.querySelector("#chat-log");
  if (!chatLog) return;

  const ancestors = [];
  for (let element = chatLog; element; element = element.parentElement) {
    ancestors.push(element);
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === "class")) {
      refreshChatThemes();
    }
  });

  for (const ancestor of ancestors) {
    observer.observe(ancestor, { attributes: true, attributeFilter: ["class"] });
  }
}
