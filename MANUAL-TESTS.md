# Manual Tests — CWN Interface Theme 0.12.0

Install CWN Combat Enhancements 0.26.0 before testing authoritative Vehicle operations. Hard-refresh Foundry after both modules update.

## GM tests

1. Open Sheet Configuration on an SWNR Vehicle and select **CWN Vehicle Operations Sheet**. Confirm all six tabs appear: Operations, Weapons, Fittings, Cargo, Configuration, Notes.
2. Assign a Character Driver, unlink it, assign an NPC Driver, and reopen both the Vehicle and Character/NPC sheets. Confirm Linked Vehicles updates immediately, no inventory Item is created, and unlink does not silently change the explicit Operating/Stationary state.
3. Create two Vehicles with the same name and link each to a different Driver. Confirm each Character/NPC opens the correct Vehicle by Actor identity.
4. Set a base AC 14 Vehicle with a Drive-2 Driver to Operating, then Stationary. Confirm effective AC changes 16 → 10 and the state persists after reopen/hard refresh.
5. Add two native mounted `shipWeapon` Items. Assign independent Character/NPC Gunners. Confirm assignments persist and both compact Operations cards and detailed Weapons entries agree.
6. Clear one Gunner and click Attack as GM. Confirm **No gunner assigned** is shown and no roll occurs.
7. Attack the assigned weapons. Confirm the proper Gunner name/formula appears and native ammo changes.
8. Attempt installations that separately exceed Power, Mass, hardpoints, and minimum Size. Confirm each rejection names the relevant capacity; confirm GM override is explicit and cancel leaves the Vehicle unchanged.
9. Open Cargo. Add/open/delete a normal carried Item and add/edit/delete a bulk cargo resource. Confirm mounted weapons and fittings remain in their own tabs.
10. Damage a Vehicle above 0 HP. Use Repair with Tool Rack or the suitable-workshop checkbox. Confirm restored HP, rate, time, and parts cost; confirm the message says the financial transaction is manual and Accounts Ledger is unchanged.
11. Repeat Repair with tagged Ace Driver or Roamer. Confirm $0 parts cost.
12. Reduce the Vehicle to 0 HP. Confirm the prominent TOTALLED banner and refusal of Operating, Attack, and Repair.
13. Disable **Allow Players to Edit Vehicle Advanced Configuration**. Confirm a player owner sees the Configuration summary but not raw fields/Effect mutation. Enable it and confirm those controls appear.
14. Open a Character with zero cyberware. Confirm Cyberware still appears and shows Maintenance plus Linked Cyberdecks, Linked Drones, and Linked Vehicles. Repeat with one cyberware Item to confirm the native list remains functional.
15. Fill a Drone's fitting capacity, then attempt a new/drop fitting. Confirm a visible notification/dialog appears and there is no unhandled fitting-capacity promise error.
16. Regression-check Character, NPC, Drone, Cyberdeck, Maintenance, Action Centre, Access refresh/Force Refresh, attacks, reloads, exact magazines, and Accounts Ledger.

## Player tests (deferred if no player is available)

1. Give the player's assigned Gunner Actor ownership and the Vehicle Observer access, but do not grant Vehicle ownership. Confirm Attack appears only on weapons assigned to an Actor they own and resolves through the active GM.
2. Confirm the assigned Gunner cannot change Driver/Gunners, Operating state, Repair, reload, fittings, cargo, or Configuration.
3. Confirm an unrelated player cannot Attack or mutate the Vehicle.
4. Confirm Linked Vehicles lists only visible Vehicles and opens the correct Vehicle directly.
5. Verify existing Drone Advanced Configuration and Cyberdeck Advanced Configuration/Force Refresh world toggles retain their current behaviour.
