# Changelog

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
