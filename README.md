# CWN Interface Theme for SWNR

An adaptive light and dark interface theme for **Cities Without Number** games
running on **Systems Without Number Redux (SWNR)** in Foundry VTT v13.

## Current scope

- Styles SWNR system chat cards without changing ordinary player messages.
- Follows Foundry's **Interface** light/dark theme around the chat sidebar.
- Provides a warm, readable light card and a charcoal cyberpunk dark card.
- Themes roll totals, headings, buttons, metadata, and card borders.
- Themes SWNR Day Refresh and Frail Rest result cards in both colour schemes.
- Supplies the missing English label for SWNR's Frail Rest result card.
- Includes optional styling for CWN Combat Enhancements Target Check results.
- Replaces Foundry's default pause overlay with an original animated
  **SYSTEM HALTED** display and rotating cyberpunk dial.
- Respects Foundry's Photosensitive Mode and the operating system's reduced
  motion preference by disabling pause animations.
- Does not require CWN Combat Enhancements and does not alter game rules.

## Installation

Install using this manifest URL:

```text
https://github.com/jlabruna/CWN-interface-theme/releases/latest/download/module.json
```

For a manual Forge import, upload the versioned
`cwn-interface-theme-v0.3.0.zip` release asset. The ZIP must contain
`module.json` at its root.

## Compatibility design

This module may style elements produced by CWN Combat Enhancements when that
module is installed, but neither module requires the other. Disabling this
theme must never disable or change Combat Enhancements automation.

Theme selection reads Foundry v13's explicit **Interface** colour-scheme
preference. The separate **Applications** preference does not affect chat-card
appearance.

## Known limitations

- Initial styling is focused on system-generated chat cards.
- Some cards produced by third-party modules may retain their own colours.
- Actor sheets, item sheets, dialogs, and the remainder of the SWNR interface
  are outside the v0.1 scope.

## Changes

### 0.3.0

- Added an original cyberpunk pause overlay with a rotating geometric dial,
  animated **SYSTEM HALTED** text, and a dark focus strip.
- Added reduced-motion handling for Foundry Photosensitive Mode and operating
  system accessibility preferences.
- The visual direction was informed by the open-source Cyberpunk RED Foundry
  system, but the dial artwork and animation implementation are original to
  this module.

### 0.2.1

- Renamed the normal rest result from **Day Refresh** to **Good Night's Rest**.
- Renamed the no-HP rest result to **Rest Without HP Recovery**.

### 0.2.0

- Added adaptive styling for per-actor and group refresh/rest chat cards.
- Added a readable Frail Rest title in place of SWNR's unresolved localization
  key.
