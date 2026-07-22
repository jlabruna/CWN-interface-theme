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

Hooks.once("ready", () => {
  if (game.system.id !== "swnr") return;
  refreshChatThemes();
  observeChatThemeAncestors();
  console.info(`${MODULE_ID} | Adaptive SWNR chat-card theme ready`);
});

/**
 * Follow the closest interface theme rather than body.theme-dark. Foundry v13
 * uses the body class for its Applications preference, while the chat sidebar
 * can have a nearer Interface-specific theme ancestor.
 */
function applyChatTheme(root) {
  if (!root?.querySelector(".chat-card")) return;

  const themeOwner = root.closest(".theme-light, .theme-dark");
  const isDark = themeOwner
    ? themeOwner.classList.contains("theme-dark")
    : document.body.classList.contains("theme-dark");

  root.classList.add("cwnit-chat-message");
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(isDark ? "cwnit-theme-dark" : "cwnit-theme-light");
}

function refreshChatThemes() {
  for (const card of document.querySelectorAll(".chat-message .chat-card")) {
    const message = card.closest(".chat-message");
    if (message) applyChatTheme(message);
  }
}

/** Refresh existing cards when Foundry changes either Interface theme class. */
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
