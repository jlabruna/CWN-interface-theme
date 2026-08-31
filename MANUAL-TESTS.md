# Manual Tests — CWN Interface Theme 0.12.1

Install CWN Combat Enhancements 0.26.0 before testing authoritative Vehicle operations. Hard-refresh Foundry after both modules update.

## GM tests

1. Open Sheet Configuration on an SWNR Vehicle and select **CWN Vehicle Operations Sheet**. Confirm Operations, Weapons, Fittings, Cargo, Configuration, and Notes remain on one footer row while resizing the sheet.
2. Assign a Character Driver, unlink it, assign an NPC Driver, and reopen both the Vehicle and Character/NPC sheets. Confirm Linked Vehicles updates immediately, no inventory Item is created, and unlink does not silently change the explicit Operating/Stationary state.
3. Create two Vehicles with the same name and link each to a different Driver. Confirm each Character/NPC opens the correct Vehicle by Actor identity.
4. Set a base AC 14 Vehicle with a Drive-2 Driver to Operating, then Stationary. Confirm AC changes 16 → 10, its derivation remains directly under AC at narrow widths, and state persists after reopen/hard refresh.
5. Drag an ordinary Weapon to the Vehicle and confirm it is Cargo. Use **Mount Existing Weapon**, configure installation needs, and confirm it becomes a mounted weapon with combat/ammo data preserved and no duplicate cargo copy.
6. Add another native mounted `shipWeapon`. Assign independent Character/NPC Gunners. Confirm assignment icons render, assignments persist, Clear removes one, and both tabs agree.
7. Click Attack after clearing the Gunner. Confirm **No gunner assigned** is shown and no roll occurs.
8. Attack an assigned finite-ammo weapon. Confirm ammo is visible on Operations and decreases after the native roll.
9. Toggle Operating/Stationary and perform a paid and $0 repair. Confirm both chat-card types remain readable in light and dark Interface themes.
10. Attempt installations that separately exceed Power, Mass, hardpoints, and minimum Size. Confirm each rejection names the relevant capacity; confirm GM override is explicit and cancel leaves the Vehicle unchanged.
11. Open Cargo. Add/open/delete a normal carried Item and add/edit/delete a bulk cargo resource. Confirm mounted weapons and fittings remain in their own tabs.
12. Damage a Vehicle above 0 HP. Use Repair with Tool Rack or the suitable-workshop checkbox. Confirm restored HP, rate, time, and parts cost; confirm the message says the financial transaction is manual and Accounts Ledger is unchanged.
13. Repeat Repair with tagged Ace Driver or Roamer. Confirm $0 parts cost.
14. Reduce the Vehicle to 0 HP. Confirm the prominent TOTALLED banner and refusal of Operating, Attack, and Repair.
15. Disable **Allow Players to Edit Vehicle Advanced Configuration**. Confirm a player owner sees the Configuration summary but not raw fields/Effect mutation. Enable it and confirm those controls appear.
16. Open a Character with zero cyberware. Confirm Cyberware still appears and shows Maintenance plus Linked Cyberdecks, Linked Drones, and Linked Vehicles. Repeat with one cyberware Item to confirm the native list remains functional.
17. Fill a Drone's fitting capacity, then attempt a new/drop fitting. Confirm a visible notification/dialog appears and there is no unhandled fitting-capacity promise error.
18. Regression-check Character, NPC, Drone, Cyberdeck, Maintenance, Action Centre, Access refresh/Force Refresh, attacks, reloads, exact magazines, and Accounts Ledger.

## Player tests (deferred if no player is available)

1. Give the player's assigned Gunner Actor ownership and the Vehicle Observer access, but do not grant Vehicle ownership. Confirm Attack appears only on weapons assigned to an Actor they own and resolves through the active GM.
2. Confirm the assigned Gunner cannot change Driver/Gunners, Operating state, Repair, reload, fittings, cargo, or Configuration.
3. Confirm an unrelated player cannot Attack or mutate the Vehicle.
4. Confirm Linked Vehicles lists only visible Vehicles and opens the correct Vehicle directly.
5. Verify existing Drone Advanced Configuration and Cyberdeck Advanced Configuration/Force Refresh world toggles retain their current behaviour.
