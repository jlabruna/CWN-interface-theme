# Changelog

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
