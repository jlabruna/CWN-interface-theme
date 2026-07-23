const MODULE_ID = "cwn-interface-theme";
const THEME_CLASSES = ["cwnit-theme-light", "cwnit-theme-dark"];
const SYSTEM_CARD_SELECTOR = ".chat-card, .refresh-summary";
const PAUSE_TEXT_KEY = "CWNIT.Pause.SystemHalted";

Hooks.on("renderChatMessage", (_message, html) => {
  if (game.system.id !== "swnr") return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelector(SYSTEM_CARD_SELECTOR)) return;
  applyChatTheme(root);
});

Hooks.on("renderChatLog", () => {
  if (game.system.id !== "swnr") return;
  refreshChatThemes();
});

Hooks.on("updateSetting", (setting) => {
  if (game.system.id !== "swnr") return;

  if (setting.key === "core.uiConfig") {
    requestAnimationFrame(refreshChatThemes);
  }

  if (setting.key === "core.photosensitivityMode") {
    requestAnimationFrame(refreshPauseOverlay);
  }
});

Hooks.on("renderPause", () => {
  if (game.system.id !== "swnr") return;
  requestAnimationFrame(refreshPauseOverlay);
});

Hooks.on("pauseGame", () => {
  if (game.system.id !== "swnr") return;
  requestAnimationFrame(refreshPauseOverlay);
});

Hooks.once("ready", () => {
  if (game.system.id !== "swnr") return;
  refreshChatThemes();
  refreshPauseOverlay();
  observeChatThemeAncestors();
  observePauseOverlay();
  console.info(`${MODULE_ID} | Adaptive SWNR interface theme ready`);
});

/**
 * Follow Foundry v13's explicit Interface preference. The document body's
 * theme class reflects the separate Applications preference and cannot be used
 * to decide how chat-sidebar content should appear.
 */
function applyChatTheme(root) {
  if (!root?.querySelector(SYSTEM_CARD_SELECTOR)) return;

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
  for (const card of document.querySelectorAll(
    ".chat-message .chat-card, .chat-message .refresh-summary",
  )) {
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

/**
 * Replace Foundry's default pause artwork and caption with an original
 * cyberpunk presentation. The existing #pause application remains in charge
 * of visibility, so this changes presentation only.
 */
function refreshPauseOverlay() {
  const pause = document.querySelector("#pause");
  if (!pause) return;

  pause.classList.add("cwnit-system-halted");
  pause.classList.toggle("cwnit-reduced-motion", prefersReducedMotion());

  let stage = pause.querySelector(":scope > .cwnit-pause-stage");
  if (stage) return;

  const text = game.i18n.localize(PAUSE_TEXT_KEY);
  stage = document.createElement("div");
  stage.className = "cwnit-pause-stage";

  const image = document.createElement("img");
  image.src = `modules/${MODULE_ID}/assets/system-halted-dial.svg`;
  image.alt = "";
  image.className = "cwnit-pause-dial";
  image.setAttribute("aria-hidden", "true");

  const caption = document.createElement("div");
  caption.className = "cwnit-pause-caption";
  caption.textContent = text;
  caption.dataset.text = text;
  caption.setAttribute("role", "status");

  stage.append(image, caption);
  pause.append(stage);
}

function prefersReducedMotion() {
  const foundryPreference = game.settings.get("core", "photosensitivityMode");
  const operatingSystemPreference =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return Boolean(foundryPreference || operatingSystemPreference);
}

/**
 * Foundry can recreate the pause application after the world has loaded.
 * Observe only for the #pause element so the theme is reapplied immediately
 * without repeatedly processing unrelated canvas changes.
 */
function observePauseOverlay() {
  const observer = new MutationObserver((mutations) => {
    const pauseChanged = mutations.some(
      (mutation) =>
        mutation.target instanceof Element &&
        (mutation.target.id === "pause" ||
          mutation.target.closest?.("#pause") ||
          [...mutation.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.id === "pause" || node.querySelector?.("#pause")),
          )),
    );

    if (pauseChanged) requestAnimationFrame(refreshPauseOverlay);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
