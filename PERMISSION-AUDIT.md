# Permission Audit — CWN Interface Theme 0.12.1

Date: 2026-09-01  
Scope: the optional Character, NPC, Drone, and Cyberdeck sheets as they existed before the Vehicle Operations release. This is an inspection report. No permission changes were made to those four sheets in this release, apart from shared rerendering needed for Linked Vehicles and the approved always-visible Character Cyberware tab.

## Summary matrix

| Sheet | Read / open | Ordinary owner actions | Elevated configuration | Audit result |
|---|---|---|---|---|
| Character | Foundry document visibility controls the rendered parts; LIMITED users receive Biography only. | Most writes ultimately use native SWNR document updates or Combat Enhancements APIs, which enforce document ownership. | Existing GM-only controls remain GM-gated in their templates/context. | No confirmed unauthorized document write. Several handlers rely on render-side gating plus Foundry's document permission rather than beginning with one common action-side ownership guard. Defence-in-depth cleanup is recommended. |
| NPC | Foundry document visibility controls the rendered parts; LIMITED users receive Biography only. | Initiative and linked-Actor opening are available from the rendered sheet; mutations delegate to native SWNR actions. | No new advanced permission surface was added. | No confirmed unauthorized document write. Action-side checks are sparse and mostly delegated to Foundry/SWNR. |
| Drone | LIMITED users receive Notes only. Owners receive operational tabs. Actor drops explicitly require Drone ownership. | Item writes are enforced by native embedded-document permissions. Pilot candidates are restricted to Actors the user owns. | Advanced Configuration requires GM status or both Drone ownership and the world toggle. | **Follow-up recommended:** Assign/Unlink Pilot and declaration-only command handlers rely on button visibility and downstream document permissions instead of a shared action-side Drone-owner guard. A forged UI action could post some declaration chat without changing protected Drone data. No change was made in this release. |
| Cyberdeck | LIMITED users receive Notes only. Owners receive operational tabs. | Native hacker-link updates explicitly refuse a Cyberdeck the user does not own; candidate hackers are ownership-filtered. Program/file changes delegate to native permissions and capacity checks. | Advanced Configuration and Force Refresh require GM status or both Cyberdeck ownership and the world toggle. | No confirmed unauthorized document write. Some non-configuration handlers still rely on downstream API/native checks rather than one common guard. |

## Vehicle release permission model

The new Vehicle sheet uses action-side checks in addition to conditional controls:

- GM or Vehicle owner: assign/change/unlink Driver, assign/change/unlink Gunners, toggle Operating/Stationary, repair, edit Configuration, manage Items and Cargo.
- Assigned Gunner: may attack only a mounted weapon explicitly linked to a Character/NPC Actor they own.
- Assigned Gunner permission does not grant Vehicle editing, reload, Item deletion, Gunner assignment, Driver assignment, repair, or Configuration access.
- A non-owner Gunner attack is revalidated and executed by the active GM through the module socket so ammunition can change without granting Vehicle ownership.
- Observer: may view the operational sheet and open linked Actors they are permitted to see, but receives no mutation controls.
- Limited: receives Notes only, following the existing optional-sheet pattern.

## Recommended future hardening

In a dedicated permission release, add one shared action-side `requireOwnerOrGM` guard to every mutating Character, NPC, Drone, and Cyberdeck handler, then add direct invocation tests for Observer and Limited users. The most useful first target is Drone declaration and pilot management because that sheet has the clearest gap between UI gating and handler-level gating.
