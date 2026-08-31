# Changelog

## 0.12.2

- Added an owner/GM **Unmount** control to every mounted Vehicle weapon on both Operations and Weapons.
- Unmounting converts the native mounted `shipWeapon` back into an ordinary Stowed SWNR Weapon, releases mounting capacity, and removes the obsolete Gunner relationship with the mounted Item.
- Preserved current mounted combat and ammunition values while restoring carried-only fields from a private conversion snapshot when available; older mounted weapons use safe native Weapon defaults.
- Added rollback protection so a failed source deletion does not leave both mounted and carried copies.
- Added reversible-conversion, current-ammo, carried-field, stale-Gunner, and template regression coverage.

## 0.12.1

- Fixed the Vehicle footer so all six tabs remain on one row at every supported sheet width.
- Changed the Vehicle header label to **AC** and kept the Operating/Stationary base derivation directly beneath the value at narrow widths.
- Added complete adaptive styling for Vehicle state and repair chat cards.
- Added **Mount Existing Weapon**, which safely converts a carried native SWNR Weapon into a mounted `shipWeapon`, preserving combat/ammunition data and rolling back on a failed source removal.
- Made mounted ammo a dedicated Operations stat, added established edit/assignment icons, and added an explicit Clear Gunner control to the detailed Weapons tab.
- Added focused layout, theming, conversion, ammo, icon, and Gunner-control regression coverage.

## 0.12.0

- Added an optional shared CWN Vehicle Operations Sheet for SWNR Vehicle Actors with Operations, Weapons, Fittings, Cargo, Configuration, and Notes tabs.
- Added one native-ID Driver link, persistent Operating/Stationary state and effective AC presentation, compact first-tab mounted weapons, persistent per-weapon Character/NPC Gunners, detailed weapon management, RAW repair workflow, and prominent TOTALLED handling.
- Added Power, Mass, hardpoint, and minimum-size installation feedback for vehicle weapons, fittings, and defenses, including explicit GM override confirmation for intentional custom Vehicles.
- Added Linked Vehicles to Character and NPC Cyberware tabs, derived from native Vehicle crew IDs with live unlink/relink refresh and no duplicate inventory Items.
- Made the Character Cyberware tab always available, including for Characters with zero cyberware, so Maintenance and linked Cyberdecks, Drones, and Vehicles remain usable.
- Added a disabled-by-default **Allow Players to Edit Vehicle Advanced Configuration** world setting. GMs always retain access; Vehicle owners retain operational controls and a read-only Configuration summary when it is disabled.
- Improved Drone over-capacity dialog failure handling so unexpected dialog errors become visible notifications rather than console-only promise failures, without changing Drone capacity mechanics or permissions.
- Added `PERMISSION-AUDIT.md` documenting the inspected Character, NPC, Drone, Cyberdeck, and new Vehicle permission models and the recommended future Drone handler hardening.
- Added Vehicle sheet, relationship, capacity, permission, zero-cyberware, and live refresh regression coverage.

## 0.11.3

- Fixed CWN Character and NPC sheet availability by registering the optional sheets during Foundry's `ready` lifecycle, after SWNR has completed its native Actor-sheet registry.
- Added lifecycle regression coverage that fails if Character or NPC registration moves back into the earlier initialization window.

## 0.11.2

- Made world Drone `crewMembers` the authoritative pilot relationship and added provenance-tracked SWNR inventory records so repeated assignment is idempotent and unlink removes only the exact relationship record.
- Refreshed every open Character/NPC application displaying a changed Drone relationship and retained Actor-ID identity for similarly named Drones.
- Added Linked Drones parity to the custom NPC Cyberware tab.
- Added the compact Character Maintenance capacity display and detailed calculation dialog through Combat Enhancements' public Maintenance API.

## 0.11.1

- Fixed open Character sheets so their reverse-linked Drone list rerenders immediately when a Drone is linked, unlinked, or moved to another pilot.
- Fixed open Cyberdeck sheets so their linked hacker's Access display rerenders immediately after rules-based, Rest-based, or forced Access refreshes.
- Kept the refresh narrowly scoped to already-open dependent sheets; closed sheets are never opened automatically and no stored Actor data is changed.
- Added nested and flattened Foundry update-path regression coverage for both cross-Actor refresh routes.

## 0.11.0

- Added **Linked Drones** to the Character Cyberware tab, derived safely from visible Drone pilot links and opening each Drone sheet directly.
- Integrated tagged Drone Pilot benefits from the linked actor. Level 2 changes Assume Command to an On Turn action once per combat round and updates the matching chat card.
- Added the disabled-by-default **Allow Players to Edit Drone Advanced Configuration** world setting. All users retain a read-only summary; GMs and permitted owners can edit raw fields and Effects.
- Added the rules-based **Reprogram Deck** Cyberdeck operation and optional Rest checkbox, plus an unlimited **Force Refresh Access** control available to every user permitted into Cyberdeck Advanced Configuration.
- Fixed Drone over-capacity confirmation to use Foundry V14's safe `DialogV2.wait` path, avoiding the prior console-only failure.
- Expanded Cyberdeck Memory presentation with explicit effective-capacity and usage detail.

## 0.10.1

- Fixed Cyberdeck form submission by placing SWNR's native `data-edit="img"`
  contract on the portrait image rather than its wrapper, preventing an invalid
  empty `img` value from blocking Advanced Configuration updates.
- Added the GM-controlled **Allow Player Cyberdeck Advanced Configuration**
  world setting. GMs always retain access; when enabled, player owners can view
  and edit the stored Cyberdeck source fields.
- Added focused image-form-contract, setting-registration, ownership, and
  Advanced Configuration visibility regression coverage.
- Added the published Cyberdeck model selector with the eight supplied base
  profiles and a confirmed Apply Model Defaults action that writes native SWNR
  Access, Memory, Shielding, CPU, Encumbrance, and Cost fields.
- Added effective Memory display and visible creation/drop blocking at
  capacity, including Expert Programmer's level-1 extra elements, level-2
  half-Memory elements, and level-2 Program-skill CPU bonus.
- Preserved existing over-capacity programs and files, warning instead of
  deleting data when a model change lowers capacity.

## 0.10.0

- Added an optional, non-default CWN Cyberdeck Operations Sheet for SWNR Cyberdeck Actors, preserving the native sheet and requiring no migration.
- Added native hacker assignment, Access/CPU/Memory/Shielding dashboards, loaded Verb and Subject views, persistent Data File management, hardware configuration, GM diagnostics, and deck notes.
- Integrated with Combat Enhancements through its public Network Console API for deck/hacker preselection and live session status, while retaining safe CE-disabled operation.
- Fixed Drone fitting-capacity confirmation by preserving `DialogV2.confirm` class binding and added a runtime-shaped regression.
- Corrected NPC and Drone bottom-tab sizing and inset active accents using sheet-specific navigation selectors.
- Added focused Cyberdeck, registration, permissions, resource, persistence, integration, and release coverage.

## 0.9.2

- Made Deploy Drone a persistent packed/deployed toggle: deployed drones keep
  the illuminated control, and a second click posts the Main Action Pack Drone
  card without placing or removing Tokens or changing the native pilot link.
- Clarified Drop Control as releasing active control while leaving the drone
  deployed and inert until command is assumed again.
- Added native remaining-round displays for magazines and other ammunition
  Items in Cargo, including an explicit empty state.
- Enforced SWNR's native drone fitting capacity for new or dropped fittings.
  Players are blocked when an addition would exceed capacity, while GMs may
  confirm an override for custom drones; existing over-capacity drones remain
  intact and are highlighted.
- Hid the unused Defensive Systems creator for ordinary CWN drones while still
  displaying and preserving any existing SWNR ship-defense Items for legacy or
  cross-system compatibility.
- Added cache-busted v0.9.2 runtime, Drone templates and stylesheet, focused
  regression coverage, release staging, and workflow verification.

## 0.9.1

- Fixed actor-specific initiative advantage and initiative modifiers for
  player-owned Characters by passing SWNR's native actor initiative formula
  into the Combat roll regardless of whether the GM or owning player presses
  the sheet button.

## 0.9.0

- Replaced editable Character account balance fields with a compact read-only
  native-balance summary and per-account Transactions controls.
- Added a themed account-ledger window with positive whole-number Credit and
  Debit actions, mandatory descriptions, newest-first signed history, user and
  local date/time attribution, resulting balances, negative-balance styling,
  and a clear zero-history state.
- Added Character account creation, rename, carried-state editing, native-rule
  conversion, and confirmed deletion through Combat Enhancements 0.22.0's
  public account API, while preserving SWNR's native balance fields and the
  existing Monthly Expenses hook.
- Added safe degradation when Combat Enhancements is unavailable: native
  account management remains available, transaction controls explain the
  missing dependency, and no ledger UI attempts to mutate balances directly.
- Added dark/light ledger styling and focused account UI, history-limit,
  integration, manifest, and regression coverage.

## 0.8.3

- Fixed the Character sheet's non-Combat active-tab treatment by overriding
  Foundry's competing flex sizing with seven equal-width grid tracks.
- Replaced the edge-aligned active-tab border with an inset accent so the red
  indicator remains fully visible instead of being clipped by the sheet
  window boundary.

## 0.8.2

- Added semantic, numeric-only Skill rank colours: cyan for untrained (-1),
  green for trained (+0), magenta for professional (+1), and gold for expert
  ranks (+2 and higher).
- Made the Skills summary show Psychic Points only when SWNR's native Show
  Psychic option is enabled, without hiding or changing any owned Skill Item.
- Preserved the active Character workspace's vertical scroll position across
  ordinary actor-update rerenders while keeping deliberate tab changes and new
  sheet windows at the top.
- Tightened the Skills summary and row spacing, refined the GM Advanced
  Configuration layout, normalized checkbox presentation, and made every
  active bottom tab use the same full-width highlight as Combat.
- Added a Combat Enhancements-disabled End Scene regression alongside focused
  coverage for skill tiers, Psychic Points visibility, scroll restoration,
  tabs, and checkboxes.

## 0.8.1

- Preserved the open/closed state of Advanced Configuration and the new compact
  Accounts drawer across Character-sheet rerenders.
- Made SWNR's native power-category toggles control the alternative Features
  presentation and made Show Cyberware control the Cyberware tab; clarified
  that these native toggles do not remove owned Skill Items.
- Rendered native SWNR resource pools in the Header, Features, and Combat
  locations selected by the existing pool-placement fields.
- Added native Character attribute base, boost, and modifier-adjustment fields
  to the GM-only Advanced Configuration section.
- Extended End Scene through SWNR's native refresh orchestrator, reset native
  Soak, recover used Combat Enhancements scene abilities through its public API,
  and post one themed summary of the resulting refresh.
- Collapsed Accounts and Monthly Expenses behind a compact Inventory summary so
  weapon and item lists remain near the top of the workspace.

## 0.8.0

- Restored the native SWNR End Scene action to the Character header and moved
  native Rest & Recover to the Actions workspace.
- Added a GM-only Advanced Configuration section backed exclusively by native
  SWNR Character fields, including initiative advantage, initiative and
  encumbrance modifiers, capability visibility, pool-placement options,
  location labels, and the unskilled-roll adjustment.
- Replaced the single-currency strip with compact Accounts that show the base
  balance and every native `extraCurrencies` entry while delegating adjustment,
  creation, editing, conversion, and confirmed deletion to SWNR.
- Removed the Character sheet's instance-level skill-roll replacement so Heal,
  Specialist, and other Combat Enhancements dice changes once again pass
  through SWNR's authoritative skill DataModel path.
- Added concise declaration cards for Swarm Attack, Charge, Screen an Ally,
  and Snap Attack; ordinary weapon attacks and other native controls remain
  unduplicated.
- Documented SWNR's System Strain calculation in-sheet and relabelled the
  header value as Strain Used: usable capacity is Constitution total minus
  cyberware strain minus permanent strain, so fractional capacity is valid.
- Added cache-busted v0.8.0 runtime, Character templates and stylesheet,
  focused regression coverage, release staging, and corrected workflow checks.

## 0.7.3

- Moved Drone-sheet registration to Foundry's `ready` phase after a live
  console registration proved the native SWNR vehicle class and adapter work
  once the registered-sheet list is populated.
- Replaced the setup-phase regression with coverage requiring Drone
  registration only during `ready`.
- Kept the v0.7.3 browser upload to ten visible hotfix files.

## 0.7.2

- Fixed Drone-sheet registration ordering by waiting until Foundry's `setup`
  phase, after SWNR has populated its native vehicle-sheet registry.
- Kept Character and NPC registration in `init`; only the dependent Drone
  adapter is deferred.
- Added a lifecycle-order regression test and a minimal browser hotfix upload
  containing only the v0.7.2 changes.

## 0.7.1

- Fixed the optional CWN Drone Operations Sheet registration on Foundry VTT
  v14 by resolving SWNR's native vehicle sheet from the actual registered
  sheet-class array.
- Corrected the Drone registration regression fixture so it matches Foundry's
  documented runtime registry shape while retaining descriptor compatibility.
- Added cache-busted v0.7.1 runtime and Drone adapter files, release staging,
  and workflow verification.

## 0.7.0

- Added an optional, non-default **CWN Drone Operations Sheet** for SWNR
  `drone` Actors, while keeping the native SWNR vehicle sheet available.
- Built a dense operations console with pilot identity, native drone vitals,
  SWNR-derived fitting/hardpoint capacity, mounted weapon cards, and native
  Attack, Reload, item, effect, form, and drag/drop actions.
- Added an OWNER-filtered pilot picker that delegates linking, changing, and
  unlinking to SWNR's native pilot workflows; native Actor drag/drop remains
  supported.
- Added declaration-only Deploy, Assume Command, Drop Control, and Halt
  Autonomous Mode chat cards without introducing Theme-owned control state.
- Added contextual Follow, Kill, Patrol, and Watch controls only when their
  exact native Command Deck fittings are installed. Commands record targets or
  instructions in themed chat cards without automating AI, movement, attacks,
  or scene monitoring.
- Added Fittings, Cargo, Configuration, and Notes workspaces, including native
  fitting/defense Items, full low-frequency Drone fields, Active Effects, and
  SWNR rich-text descriptions and modification notes.
- Added cache-busted v0.7.0 runtime and stylesheet, release staging, workflow
  verification, and Drone-sheet compatibility and safety tests.

## 0.6.4

- Replaced the character sheet's generic AC header cell with explicit Ranged
  AC and Melee AC values from SWNR's native actor data.
- Added current/maximum Soak to the character header, matching the NPC header
  while leaving SWNR responsible for derived defenses.
- Tidied the no-armor empty state so the message is centered on one readable
  line instead of inheriting the populated armor-row grid.
- Added cache-busted v0.6.4 runtime, character sheet, stylesheet, header and
  combat templates, workflow validation, release staging, and regression tests.

## 0.6.3

- Added an NPC-style Armor panel to the alternative character Combat tab.
  Owned armor now shows its icon, name, AC, and native active state, and its
  shield button delegates to SWNR's native armor toggle.
- Preserved the responsive three-column Readied weapon grid and placed Quick
  Saves and Armor together beneath the weapon loadout.
- Removed duplicate Quick Saves from the Actions tab; tactical declarations
  remain in that dedicated workspace.
- Deferred direct System Strain management to a future release without
  changing the existing display or native Rest & Recover behaviour.
- Added cache-busted v0.6.3 runtime, character sheet, stylesheet, templates,
  release staging, workflow verification, and regression coverage.

## 0.6.2

- Added explicit light/dark styling for every visible descendant of the
  module's action-reference and skill-upgrade chat cards.
- Added a narrow Foundry v14 `messageMode` bridge for native SWNR skill rolls,
  retaining the v13 `rollMode` fallback and native SWNR roll behaviour.
- Removed duplicate character identity form paths and reduced the alternative
  sheet to Level, XP, and a single Background input.
- Restored native Rest & Recover from the character header.
- Added a pending level-up Hit Point setup card to Combat Enhancements' public
  Action Centre; rolling delegates to native `rollHitDice(true)`, while Set Up
  Later leaves the task untouched.
- Restored the existing Combat Enhancements Monthly Expenses injection point on
  the alternative Inventory tab.
- Limited Combat dashboard weapon cards to Items whose native SWNR Location is
  `readied`; Stowed, Other, and Ship weapons remain available in Inventory and
  require no module-owned visibility flags.
- Added cache-busted v0.6.2 runtime, stylesheet, templates, release staging,
  workflow verification, and regression coverage.

## 0.6.1

- Fixed character initiative so the sheet locates or creates the actor's active
  combatant and rolls it through Foundry's combat tracker.
- Fixed skill rolls by supplying the embedded skill ID required by SWNR's
  native skill handler.
- Rebuilt Skills as a compact two-column list with a locked-by-default editing
  mode; unlock reveals upgrade, edit, delete, new-skill, attribute-boost, and
  skill-point controls.
- Added a themed chat confirmation after a native SWNR skill upgrade succeeds.
- Removed duplicate Initiative and Action Centre controls from the Combat and
  Actions layouts, moved attributes into the Skills training summary, and fixed
  More Actions navigation.
- Improved character-sheet typography, spacing, action-card title contrast,
  and biography editor toolbar clearance.
- Added cache-busted v0.6.1 runtime, stylesheet, templates, release staging,
  and regression coverage.

## 0.6.0

- Added an optional **CWN Character Sheet** for SWNR `character` actors without
  changing the native default or migrating existing actors.
- Added Combat, Skills, Inventory, Cyberware, Features, Actions, and Bio & Notes
  tabs with a compact tactical layout built on SWNR's supported actor sheet.
- Preserved native SWNR weapon rolls, reloads, saves, initiative, skills,
  inventory, containers, consumables, item management, effects, and drag/drop.
- Integrated Combat Enhancements only through its public combined Action Centre
  opener; disabling Combat Enhancements leaves the sheet functional.
- Added declaration-only chat references for Total Defense, Fighting
  Withdrawal, Hold an Action, and Execution Attack without changing mechanical
  state.
- Added base-weapon and weapon-family classification labels to character and
  NPC weapon cards, with melee/ranged fallbacks.
- Centralized the optional sheets' tactical color tokens and corrected rich-text
  editor toolbar spacing on character and NPC biographies.
- Added cache-busted v0.6.0 source, stylesheet, templates, staging paths, and
  automated compatibility and safety coverage.

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
