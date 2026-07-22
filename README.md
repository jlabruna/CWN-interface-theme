# CWN Interface Theme for SWNR

An adaptive light and dark interface theme for **Cities Without Number** games
running on **Systems Without Number Redux (SWNR)** in Foundry VTT v13.

## Version 0.1 scope

- Styles SWNR system chat cards without changing ordinary player messages.
- Follows Foundry's **Interface** light/dark theme around the chat sidebar.
- Provides a warm, readable light card and a charcoal cyberpunk dark card.
- Themes roll totals, headings, buttons, metadata, and card borders.
- Includes optional styling for CWN Combat Enhancements Target Check results.
- Does not require CWN Combat Enhancements and does not alter game rules.

## Installation

Install using this manifest URL:

```text
https://github.com/jlabruna/CWN-interface-theme/releases/latest/download/module.json
```

For a manual Forge import, upload the versioned
`cwn-interface-theme-v0.1.1.zip` release asset. The ZIP must contain
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
