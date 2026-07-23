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
`cwn-interface-theme-v0.4.0.zip` release asset. The ZIP must contain
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

### 0.4.0

- Replaced the pause dial with the selected **Split-Reel Data Gate** design.
- Separately animates its violet slow rotor, yellow counter-rotor, cyan
  pause-and-index read heads, and transient magenta diagnostic printing.
- Adjusted the **SYSTEM HALTED** typography and glow to match the new violet,
  cyan, magenta, and amber interface.
- Photosensitive Mode freezes the complete dial and text presentation.

### 0.3.8

- Reduced the frequency of the **SYSTEM HALTED** glitch bursts by half.
- Kept the existing displacement, cyan/magenta colour splitting, and individual
  burst intensity.

### 0.3.7

- Reworked the rotating pause dial as a sharper, predominantly white angular
  cyberpunk mechanism.
- Added cyan and magenta split accents that match the animated text treatment.
- Increased dial visibility without changing its position, rotation speed, or
  Photosensitive Mode behavior.

### 0.3.6

- Made the **SYSTEM HALTED** glitch substantially more visible with stronger
  flicker, larger horizontal displacement, and brief cyan/magenta sliced-text
  echoes.
- Kept the title stable and readable between short glitch bursts.
- Photosensitive Mode continues to stop the dial and every text animation.

### 0.3.5

- Fixed the missing **SYSTEM HALTED** caption by claiming Foundry's persistent
  native pause caption, with a CSS-only fallback during rerenders.
- Versioned the JavaScript filename so Forge and browsers cannot retain the
  older caption implementation after this update.
- Improved Photosensitive Mode detection and live updating. Enabling it stops
  the dial rotation and caption flicker without removing either graphic.

### 0.3.4

- Fixed the missing **SYSTEM HALTED** caption by replacing the unreliable
  CSS-generated caption with a dedicated module-owned text element.
- Increased the pause strip height from 132px to 220px so the entire rotating
  dial and its glow fit inside the overlay.
- Preserved the lower-third centre point and translucent strip appearance.

### 0.3.3

- Moved the **SYSTEM HALTED** pause strip and its graphical elements to the
  lower third of the viewport.
- Reduced the strip opacity to more closely match Foundry's default translucent
  pause presentation.

### 0.3.2

- Fixed the v0.3.1 replacement pause elements being suppressed by Foundry.
- The rotating dial and **SYSTEM HALTED** caption are now rendered as CSS
  layers on the confirmed-working pause strip.
- Removed dependency on both Foundry's pause markup and injected child
  elements.

### 0.3.1

- Fixed Foundry v13 retaining its original **GAME PAUSED** artwork and caption
  inside the themed pause strip.
- The theme now renders a self-contained pause stage instead of relying on
  Foundry's internal pause markup.
- Improved reapplication when Foundry recreates or updates the pause overlay.

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
