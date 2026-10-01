# Interactive mini-games

## Where to find them

- **Trainee → Mini-Game to Learn** (`/games`): four standalone saved challenges, available without creating a new module.
- **Admin → Modules → Add module**: choose a game template, complete the lessons and knowledge check, publish, and assign it through **Assignments**.
- **Admin → Management → Live activity log**: game starts, saved moves, completions, scores, training progress, assignments, and module/account events.

## The four games

| Game | Interaction |
| --- | --- |
| Forklift Simulator | Navigate a grid, operate brake/fork controls, check and yield at the crossing, collect/deliver a load, and park. Keyboard and on-screen controls are supported. |
| PPE Dress-Up | Equip individual PPE items for three stated workplace assessments. Drag items onto the avatar or tap to equip/remove. |
| Sorting Zone | Place six inventory, hazardous-material, and waste cards into the appropriate destination or incident response. Drag-and-drop and tap-to-place are supported. |
| Load Stacking Challenge | Arrange five pallets across two rated bays, observe slot/bay limits and the stated loading plan, and hold the damaged pallet. This is a strategic puzzle, not a physics simulation. |

These are simplified learning exercises, not equipment authorisations, real rack-capacity calculations, or substitutes for site procedures. The existing Hazard Perception 360° scene and built-in activities are unchanged.

## Creating a game module

1. Choose **Modules → Add module**, enter the module details and select a game.
2. In the editor, complete the overview, objectives, learning sections, cover, and knowledge-check questions.
3. The **Mini-game** step shows the selected interactive mission. Its rules and scoring contract are versioned and fixed; administrators do not edit its internal pass/review keys or game mechanics.
4. Save and resolve the publication checklist, then publish and assign the module.

Existing guided-round game modules remain compatible. Their editor offers **Use interactive mission** to replace those rounds deliberately. Existing publication/assignment restrictions still apply; no published module is automatically rewritten. A different game in the same module receives its own saved-game context rather than loading the previous game's moves.

## Saving and scoring

- Moves autosave after a short pause; **Save progress** provides an explicit retry. Return to the same challenge to resume its saved state.
- Offline or failed saves are reported. Unsaved moves remain on screen, but there is no offline-storage guarantee; save successfully before leaving.
- Revision checks prevent an older tab from overwriting newer progress. A conflicting tab must reload.
- **Submit challenge** records the server-calculated result once. Reopening a finished challenge reviews that result; it does not overwrite it or award duplicate points.
- Standalone games save separately from module games. They do not issue module certificates.
- Module games save the activity checkpoint; submission advances to the knowledge check. The exact game percentage appears in the activity feed. Existing module activity scoring remains pass/review: all game rules met earns the activity points; a lower game score records review with zero activity points. Quiz scoring/certification remains separate and unchanged.

## Supabase setup

After the existing foundation, module-authoring, and progress/checkpoint migrations, apply these migrations in order through the project's normal migration workflow:

1. `202609070001_mini_game_activity_kind.sql`
2. `202609090001_admin_activity_feed.sql`
3. `202609090002_admin_activity_feed_fixes.sql`
4. `202609090003_interactive_learning_games.sql`

The linked IFI-360 project (`rrvpnkrkrptduazncchx`) was updated through SQL Editor on 2026-09-11. The final definitions of all 16 changed functions were compared with the repository; Realtime publication membership, five event triggers, both protected tables, and RPC privileges were verified. This manual application does not populate the Supabase CLI migration ledger; reconcile migration history before using `supabase db push`. Do not rerun the non-idempotent game-table migration against that project.

The game API requires an active trainee. Results are recomputed in PostgreSQL, not accepted from a client-supplied score. Trainees can read only their own runs; the event projection is administrator-only. Private scoring functions cannot be called directly by authenticated clients.

## Live management feed

The feed subscribes to `admin_activity_events`. Database triggers capture committed training, assignment, module, and profile changes; the game-save transaction emits game events. New events refresh the feed and dashboard statistics automatically. The UI reports **Live** only when the database setup and subscription are ready; otherwise it uses a 10-second polling fallback and reports that state.

Database activation and event generation have been verified. Browser-to-browser push delivery still needs an authenticated trainee/admin smoke test; database readiness alone is not proof of a working browser subscription. Historic events before feed activation are not backfilled into the new projection.

## Regression checks

Run `npm test` and `npm run typecheck`. Disposable-database SQL coverage lives in `tests/sql/learning-games.sql` and `tests/sql/admin-activity-feed.sql`; see their README. Never run those fixture scripts against production. They cover scoring, save/resume, revision conflicts, final-result idempotency, role isolation, forged submissions, authoring contracts, complete module progression, and event classification.
