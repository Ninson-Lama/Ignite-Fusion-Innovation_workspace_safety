# B1 Use Cases

## Actors and trust boundaries

| Actor | Scope |
| --- | --- |
| Trainee | Own profile, assignments, progress, attempts and achievements; published/assigned training; no role or answer-key access. |
| Health & Safety Manager | Relevant monitoring and assignment activity for trainees in the manager’s department. This department scope is an implementation decision because no separate team relationship was supplied. |
| Administrator | Authorised cross-department administration, module controls, assignments, results and reporting. |
| Supabase Auth | Verifies credentials and owns password/session operations. It is an external system actor, not a user role. |

The browser interface is not a security boundary. Trusted server/database checks and Supabase RLS must enforce every protected outcome.

## UC-01 — Register and sign in

**Primary actor:** Trainee<br>
**Precondition:** The application has valid Supabase public credentials; the user is not signed in.<br>
**Trigger:** The user submits registration or sign-in.

**Normal flow:**

1. The application validates required email/password fields.
2. Supabase Auth processes the request.
3. For registration, the profile creation mechanism assigns `trainee` without accepting a client role.
4. For sign-in, the application resolves the trusted profile role.
5. The user is directed to an authorised dashboard.

**Alternatives:** Invalid data stays on the form with an accessible message; email verification may be required; unverified/invalid credentials fail generically; missing profile/session enters a safe recovery/error state.<br>
**Postcondition:** A valid session exists and only role-permitted routes/data are available, or no session has been created.

## UC-02 — Recover and reset a password

**Primary actor:** Any registered role<br>
**Precondition:** Supabase email recovery and redirect URLs are configured.<br>
**Trigger:** The user requests password help.

**Normal flow:**

1. The user submits their email on `/forgot-password`.
2. Supabase sends a recovery link without the UI disclosing account existence.
3. The callback establishes a valid recovery context.
4. `/reset-password` validates and submits the replacement password.
5. The user returns to sign-in or an authorised area according to session behaviour.

**Alternatives:** An invalid/expired/used link displays recovery guidance; a weak or mismatched password is rejected.<br>
**Postcondition:** The password changes only after Supabase validates the recovery context.

## UC-03 — Select and complete training

**Primary actor:** Trainee<br>
**Precondition:** The user is authenticated; at least one assigned or published module is readable.<br>
**Trigger:** The trainee opens a module from the dashboard/library.

**Normal flow:**

1. The module introduction presents objectives, duration, difficulty and current progress.
2. The trainee reads the learning content and the trusted boundary records learning completion.
3. The trainee completes the required interactive activity. For decision modules, each module/scenario/choice is validated against a private map, the first stored choice is authoritative and points/progress are server-derived.
4. The trainee starts the quiz; each first valid checked answer is privately locked for two hours before that question’s permitted feedback is returned.
5. The trainee submits every answer. Trusted scoring requires an exact unexpired lock for each active question, stores the immutable attempt and then clears the module locks.
6. Only when learning and activity are both complete and the quiz meets 70% does progress become complete; otherwise it remains in progress/review.
7. The result shows a next action.

**Alternatives:** Unpublished or otherwise unauthorised module access is rejected according to policy; a network failure preserves a safe retry route; an invalid decision is rejected without trusting caller score; a changed checked quiz answer or missing/expired lock is rejected; a failed quiz permits an appropriate retry without rewriting old attempts.<br>
**Postcondition:** Genuine progress/attempt state is stored, or no completion is claimed.

## UC-04 — Complete Hazard Perception in 360 mode

**Primary actor:** Trainee<br>
**Precondition:** The trainee may access Hazard Perception; browser WebGL and the panorama can load.<br>
**Trigger:** The trainee chooses the 360 scene.

**Normal flow:**

1. A dedicated loader reports real readiness or an indeterminate state.
2. Lazy-loaded Three.js renders the generated automotive-warehouse panorama through WebGL.
3. The trainee inspects and selects hotspots using pointer, touch or available keyboard controls.
4. Each unique selection opens hazard, risk, consequence and corrective-action feedback.
5. A confirmed hazard is marked found and cannot award duplicate points.
6. Finding all seven satisfies the hazard activity requirement and its state is persisted when the backend is configured.

**Alternatives:** Three.js/WebGL/asset failure offers the Hazard List View; the trainee may choose the list at any time; closing feedback returns focus appropriately.<br>
**Postcondition:** The same seven-hazard learning outcome is recorded whether the scene or list is used.

## UC-05 — Complete Hazard Perception using the list

**Primary actor:** Trainee<br>
**Precondition:** The trainee may access the module; JavaScript permits the accessible activity UI.<br>
**Trigger:** The trainee chooses the Hazard List View or receives it after scene failure.

**Normal flow:**

1. The page presents seven clearly labelled, keyboard-reachable hazards.
2. The trainee opens each item and reviews equivalent feedback.
3. Reviewed hazards receive a textual and visual completed state.
4. The seventh unique review satisfies the same activity completion condition.

**Alternatives:** The trainee can return to the scene without losing valid current progress; a persistence failure is stated and can be retried.<br>
**Postcondition:** Equivalent learning completion is stored without WebGL being mandatory.

## UC-06 — View own progress, results and recognition

**Primary actor:** Trainee<br>
**Precondition:** The trainee is authenticated.<br>
**Trigger:** The trainee opens results, progress, achievements or leaderboard.

**Normal flow:**

1. RLS limits protected records to the signed-in trainee.
2. Progress uses non-cancelled assigned modules if any exist; cancelled assignments are excluded and otherwise published modules are used.
3. Attempts and achievements are displayed from stored data.
4. The leaderboard displays non-sensitive display names, points, completions and recognition, highlighting the current trainee.

**Alternatives:** No data produces a meaningful zero/empty state; an unavailable rank is not replaced with a fabricated value.<br>
**Postcondition:** No protected record belonging to another trainee is exposed.

## UC-07 — Monitor department training

**Primary actor:** Health & Safety Manager<br>
**Precondition:** The user is authenticated with trusted `manager` role and department.<br>
**Trigger:** The manager opens an allowed `/admin` monitoring view.

**Normal flow:**

1. Route authorisation verifies role before rendering the management shell.
2. Database policy/query scope limits trainees and records to the same department.
3. The manager searches/filters progress, status and results.
4. The manager inspects completion or assessment detail and, where authorised, assigns training.

**Alternatives:** A cross-department identifier or unsupported admin action is rejected; a missing department yields no broader access.<br>
**Postcondition:** Relevant monitoring is available without granting unrestricted administrator powers.

## UC-08 — Administer a user or assignment

**Primary actor:** Administrator<br>
**Precondition:** The user is authenticated with trusted `admin` role.<br>
**Trigger:** The administrator submits a validated user/role/status or assignment action.

**Normal flow:**

1. The interface presents affected data and any privilege implications.
2. The trusted boundary re-verifies the administrator role.
3. Inputs and record identifiers are validated.
4. Supabase applies the authorised change under RLS/function rules. Assignment repeats update due date/notes while preserving original audit/system state; cancellation preserves the row; new/reactivated assignments require a published module; authenticated deletion is unavailable.
5. The interface shows a genuine confirmation and refreshes relevant data.

**Alternatives:** Invalid, stale, out-of-scope or unauthorised changes return a safe error; a failed operation is not presented as successful. An idempotent duplicate assignment is an update, not a second row.<br>
**Postcondition:** The audited application record reflects the authorised change, or remains unchanged.

## UC-09 — Publish a module

**Primary actor:** Administrator<br>
**Precondition:** The administrator is authenticated and the target module exists.<br>
**Trigger:** The administrator changes module publication/status metadata.

**Normal flow:**

1. The UI validates title, duration, difficulty, order and status values.
2. The trusted layer verifies administrator authority.
3. The database serialises the change with assignment writes and rejects unpublish/archive while an assignment is `assigned` or `in_progress`.
4. If allowed, the module record is updated.
5. Trainee library availability reflects the published state.

**Alternatives:** Managers without publication authority, invalid values, missing modules or active assignments blocking withdrawal are rejected without changing availability.<br>
**Postcondition:** The module’s stored availability is authoritative for subsequent trainee queries.

## UC-10 — Review a report

**Primary actor:** Health & Safety Manager or Administrator<br>
**Precondition:** The actor is authenticated and authorised for the requested population.<br>
**Trigger:** The actor opens `/admin/reports` or applies filters.

**Normal flow:**

1. The trusted report function aggregates completion, latest-attempt quiz performance, non-cancelled overdue assignments and review indicators within scope.
2. The interface presents summaries with accessible text/table equivalents.
3. Filters recompute only within the actor’s authorised population.

**Alternatives:** No records produce an empty state; no latest attempts produce a null/unavailable average rather than zero; unsupported exports or metrics are not implied; query failures display a retry option.<br>
**Postcondition:** The actor can make a follow-up decision without receiving data outside their role/department scope.

## UC-11 — Sign out

**Primary actor:** Any authenticated role<br>
**Precondition:** An active Supabase session exists.<br>
**Trigger:** The user chooses sign out.

**Normal flow:** Supabase invalidates the local session, private UI state is discarded, and the application returns to public authentication.<br>
**Alternatives:** If the network call fails, the UI reports the problem and does not falsely confirm remote invalidation.<br>
**Postcondition:** Protected routes require authentication again after successful sign-out.
