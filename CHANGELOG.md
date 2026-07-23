# Changelog

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
