# Changelog

## 0.5.2

- Fixed the optional NPC sheet submitting an empty portrait value with ordinary
  form changes, which prevented names, HP, profile fields, item locations, and
  biography edits from persisting.
- Restored native SWNR weapon attacks, reloads, and item editing by using the
  list-row document structure expected by SWNR's embedded-document handlers.
- Made Initiative add the displayed NPC token to the active combat encounter
  when necessary and roll through the combat tracker.
- Removed the redundant Combat-tab Add Weapon control and the SWNR 2.3.1
  Reaction quick roll that is incompatible with Foundry V14 RollTable result
  validation.
- Added a visible equipped/readied state to armor shields and labelled tactical
  movement in metres.
- Cache-busted the corrected entry script, sheet module, stylesheet, and
  affected templates.

## 0.5.1

- Fixed the optional CWN NPC Sheet failing to open after selection in Foundry
  V14 because its header template returned two top-level HTML elements.
- Wrapped the identity header and vitals strip in the single root element
  required by Foundry's ApplicationV2 template renderer.
- Added a regression test enforcing exactly one root HTML element for every NPC
  sheet template part.
- Cache-busted the release entry script and corrected header template so an
  updated Forge installation cannot reuse the broken v0.5.0 files.

## 0.5.0

- Added the optional **CWN NPC Sheet** for SWNR `npc` actors.
- Registered the sheet with `makeDefault: false`; the native SWNR sheet remains
  available and no existing actor is migrated or reassigned.
- Built the sheet as a runtime subclass of SWNR's public `SWNActorSheet` export
  with a one-time GM warning if the supported API is unavailable.
- Added native item attacks and reloads, NPC quick rolls, armor, effects, full
  inventory management, cyberware, linked cyberdecks, features, powers,
  biography, and notes across five bottom tabs.
- Preserved SWNR form updates, item drag/drop, item sorting, containers,
  consumable uses, locations, and document actions.
- Added isolated dark tactical sheet styling with centralized red, cyan, amber,
  text, state, and accessibility tokens.
- Added automated registration, view-data, native-action-contract, data-safety,
  tab-order, and CSS tests.
- Updated cache-busted assets and release staging for templates and artwork.

## 0.4.3

- Restored readable Target Check target names and details in the Foundry V14
  dark interface theme.

## 0.4.2

- Themed ordinary Foundry chat messages in the active CWN light or dark palette.
- Added chat-scoped styling for user messages, whispers, blind messages, emotes,
  out-of-character messages, inline rolls, metadata, and hover controls.
- Restored readable CWN Combat Enhancements modifier-breakdown labels, values,
  muted details, and total rows in Foundry V14 dark mode.

## 0.4.1

- Verified the theme against Foundry VTT 14.365 and SWNR 2.3.1.
- Migrated chat-card enhancement to Foundry V14's `renderChatMessageHTML` hook.
- Versioned the JavaScript filename so existing installations cannot retain the
  pre-V14 hook implementation in browser cache.

## 0.4.0

- Replaced the single rotating dial with the selected **Split-Reel Data Gate**
  concept built from four independently animated SVG layers.
- Added a slow clockwise violet chassis, counter-rotating yellow inner rotor,
  and six cyan read heads that pause before rapidly indexing to the next
  station like an old computer tape drive.
- Added two transient magenta diagnostic layers that print into view, fade,
  and reappear at different orientations.
- Retuned the **SYSTEM HALTED** caption with a violet-white glow, cyan and
  magenta glitch separation, and a restrained amber accent.
- Extended Photosensitive Mode and operating-system reduced-motion support to
  freeze every dial, diagnostic, and text animation.

## 0.3.8

- Halved the frequency of the **SYSTEM HALTED** text glitches by doubling the
  intervals between animation cycles.
- Preserved the existing glitch strength, colour separation, displacement, and
  approximate duration of each individual burst.

## 0.3.7

- Replaced the pause dial with a brighter, predominantly white angular design.
- Added asymmetric cyan and magenta chassis segments, locator shards, and
  split-colour circuitry to match the **SYSTEM HALTED** glitch treatment.
- Increased the dial opacity for stronger contrast while retaining the
  existing glow, rotation, and reduced-motion behavior.

## 0.3.6

- Increased the intensity and frequency of the **SYSTEM HALTED** text glitch.
- Added short cyan and magenta split-image bursts with displaced horizontal
  text slices.
- Increased the main caption's flicker and lateral jitter while keeping the
  title readable between glitch bursts.
- Ensured Photosensitive Mode and operating-system reduced-motion preferences
  disable all new glitch layers.

## 0.3.5

- Fixed the missing **SYSTEM HALTED** caption by reusing Foundry's persistent
  native pause caption instead of relying only on an injected child.
- Added a CSS-only caption fallback so the title remains visible if Foundry
  rebuilds the pause markup or a browser retains a cached script.
- Versioned the module script filename to prevent Forge/browser caching from
  retaining an older pause implementation.
- Made Photosensitive Mode detection resilient to Foundry setting-name and
  client-setting update differences.

## 0.3.4

- Fixed the missing **SYSTEM HALTED** caption by rendering it as a dedicated
  module-owned element instead of CSS-generated text.
- Increased the pause strip height so the complete rotating dial and its glow
  remain visible.
- Kept the pause presentation centred in the lower third with the v0.3.3
  transparency.

## 0.3.3

- Moved the custom pause presentation from the middle of the viewport to the
  lower third.
- Made the dark pause strip substantially more transparent.

## 0.3.2

- Fixed the custom dial and caption not appearing in Foundry despite the pause
  strip being themed.
- Moved the dial and **SYSTEM HALTED** caption to CSS-rendered layers that do
  not depend on Foundry accepting replacement child elements.

## 0.3.1

- Fixed the original Foundry pause dial and **GAME PAUSED** caption remaining
  visible instead of the new theme.
- Added a self-contained pause stage that does not depend on Foundry's internal
  pause markup.
- Improved handling of pause-overlay rerenders.

## 0.3.0

- Replaced Foundry's default pause presentation with an original animated
  **SYSTEM HALTED** overlay.
- Added a rotating geometric cyberpunk dial and restrained text-glitch effect.
- Disabled pause animations when Foundry Photosensitive Mode or the operating
  system reduced-motion preference is active.

## 0.2.1

- Changed the normal overnight-rest chat heading from **Day Refresh** to
  **Good Night's Rest**.
- Changed the frail-rest chat heading to **Rest Without HP Recovery** so it
  directly matches the selected rest option.

## 0.2.0

- Added light and dark theme styling for SWNR Day Refresh and Frail Rest chat
  cards, including per-actor refresh messages that do not use SWNR's standard
  `.chat-card` class.
- Added the missing English Frail Rest localization so the result card no longer
  displays `swnr.pools.refreshSummary.frailRest`.

## 0.1.1

- Fixed mixed-theme configurations incorrectly following Foundry's Applications
  setting instead of its Interface setting.
- Chat cards now read Foundry v13's explicit `core.uiConfig.colorScheme.interface`
  preference and update when the UI configuration changes.

## 0.1.0

- Added adaptive light and dark styling for SWNR system chat cards.
- Tied card appearance to the nearest Foundry Interface theme rather than the
  separate Applications theme stored on the document body.
- Added compatible colours for CWN Combat Enhancements Target Check results.
