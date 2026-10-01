# B1 Testing Plan

## Evidence position

This document is both the verification specification and the honest execution record available at handover. Continuation verification on 20 August 2026 passed lint, repeatable generated-route type-checking, automated tests, both dependency audits and the canonical production build. Final hardened SQL had already parsed and executed in temporary embedded PostgreSQL-compatible environments on 15 August 2026 and was unchanged by the continuation work. Later on 20 August, the reviewed schema/seed was applied to the authorised hosted Supabase project and a genuine local browser sign-in exercised hosted Auth, profile lookup and administrator-role rendering. The exact committed source is pushed to the private Sites source repository and published owner-only. These partial hosted observations do not constitute the full RLS, accessibility, penetration-test, canonical Vercel or stakeholder-acceptance matrix. No screenshot, Lighthouse number, user study or stakeholder approval is fabricated; the user-supplied login screenshot is not committed because it contains personal account information.

Local rendering can be tested without Supabase, but remote email authentication, session callbacks, PostgreSQL persistence, trusted quiz scoring and RLS/role behaviour require all of the following:

- a configured Supabase project;
- the repository migrations and seed applied;
- valid public environment variables;
- separate trainee, manager and administrator test accounts;
- at least two departments and at least two trainees for negative-scope tests.

The project, migrations, seed and first administrator now exist, but separate trainee/manager/department accounts do not. Cases beyond the recorded initial Auth/admin observation therefore remain **Not executed** or explicitly **Partial**, not passed.

## Recorded local execution — 15 and 20 August 2026

| Scope | Command/check | Recorded result | Evidence boundary |
| --- | --- | --- | --- |
| Lint | `npm run lint` | Pass; exit 0. | Command result from the final post-update working tree; no separate retained log artefact. |
| TypeScript | `npm run typecheck` | Pass; the script regenerated route types and type-check exited 0. | This repeatable workflow prevents a prior vinext build from leaving stale `.next` declarations; no separate retained log artefact. |
| Automated tests | `npm test` | Pass; 18 files and 92 tests under Vitest 4.1.10. | Source cases include authentication, route, activity, module and progress boundaries; hosted browser acceptance remains separate. |
| Canonical production build | `npm run build` | Pass; Next.js 16.3.8/Turbopack compiled, TypeScript completed, `proxy.ts` was recognised and 40/40 build-time pages were generated; exit 0. | Validates local compilation and route generation only, not hosted configuration or every user journey. |
| Hosted Supabase setup and initial Auth | Apply three reviewed migrations plus seed; verify counts/RLS; save exact redirects; sign in through the local application with a confirmed active profile | Partial pass: SQL runs succeeded; 3/3 modules, 24 questions/keys, 10 private scenarios, 6 achievements, 24 policies and profile RLS were observed; anonymous catalogue access returned 401; local browser sign-in displayed the trusted administrator role. | Authorised project-owner SQL/browser observation on 20 August 2026. It does not cover the separate-account RLS matrix, app self-registration, recovery email, token rotation or complete training persistence. |
| Local production-start smoke | Start the built Next application and issue HTTP requests without Supabase variables | `/` 200; `/login` 200; unauthenticated `/dashboard` 307 to login; activity/quiz APIs 503 because Supabase configuration was intentionally absent; admin module API 401. | Confirms basic serving and fail-closed no-configuration/auth responses only; no browser rendering, Auth service or database behaviour was exercised. |
| Production dependency audit | `npm audit --omit=dev --json` | Pass; 0 vulnerabilities across the production dependency set. | Registry audit at the recorded time; new advisories may appear later. |
| Full dependency audit | `npm audit` | Pass; 0 vulnerabilities after updating vinext to 1.0.0-beta.7 removed the vulnerable transitive `image-size` package. | Registry audit on 20 August 2026; new advisories may appear later. |
| SQL syntax | Static parsing of the three final migrations, seed and permanent pgTAP file | Pass; final `FINAL_BACKEND_SQL_PARSE_OK`. | PostgreSQL parser evidence only. |
| Embedded database behaviour | Final migrations and seed executed in temporary PGlite/PostgreSQL-compatible harnesses | Pass; cross-feature `CROSS_FEATURE_DATABASE_VALIDATION_OK` plus final focused `UNPUBLISHED_ASSIGNMENT_GUARD_OK`. | Temporary harness files were deliberately deleted and are not deliverables. This is partial local database evidence, not a Supabase CLI, Docker or hosted-project result. |
| Permanent database suite | `supabase/tests/database/security_and_training.sql` | 48 pgTAP assertions authored. | **Not executed** with `supabase test db`, because Supabase CLI/Docker was unavailable. |

The final embedded checks exercised migration/seed/Auth-hook setup; RLS and denial of all private answer/scenario/lock reads; safe question loading; first quiz-answer lock, identical repeat, changed-selection rejection, missing-lock rejection, exact-lock submission, lock-derived/bounded attempt start time and lock clearing for a retry; all seven hazards; caller progress/score spoof rejection; five keyed Manual Handling decisions with immutable first choices, a wrong-first outcome and server-derived 400/500 activity score; strict learning + activity + passed-quiz completion; quiz activity snapshot/combined points; cross-department manager isolation; assignment upsert/cancellation and module-withdrawal race guards; scoped publication-independent attempt results; latest-attempt/null-empty reporting; the exact leaderboard output shape; and administration RPCs. Hosted schema installation plus one Auth/profile/admin-browser path are now partially verified; email delivery, token rotation, the hosted multi-account grants/RLS matrix, complete training persistence and independent load/concurrency testing remain unverified.

## Test levels

| Level | Purpose | Candidate tooling |
| --- | --- | --- |
| Static/build | TypeScript, lint rules and production compilation. | Project scripts (`lint`, `typecheck` when present, `build`) |
| Unit | Pure scoring, progress, validation, duplicate protection, role and achievement utilities. | Repository test runner |
| Integration | Supabase functions, triggers, grants, RLS and application/data boundaries. | Supabase local stack or isolated remote test project |
| Functional/E2E | User journeys through public, trainee and administrator routes. | Browser automation plus manual exploratory checks |
| Accessibility | Semantic/keyboard/focus/reduced-motion/reflow and assistive-technology behaviour. | axe where available, keyboard, browser accessibility tree, screen reader spot checks |
| Performance/compatibility | Route bundles, scene lazy loading, asset readiness and supported browsers/devices. | Browser devtools, production build, real browsers |
| Acceptance | Fitness for the stakeholder’s agreed training/demo tasks. | Scripted stakeholder session with genuine signed evidence |

## Status values

- `Not executed` — the default in this plan.
- `Blocked` — a named environmental prerequisite is absent.
- `Pass` — actual behaviour matched expected behaviour and its execution result/evidence boundary is identified.
- `Fail` — actual behaviour differed; an issue reference is linked.
- `Partial` — only explicitly identified steps were completed.

## Static, build and unit cases

| ID | Requirement | Precondition | Steps | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | Code quality | Dependencies installed | Run `npm run lint`. | Command exits 0 with no unresolved lint errors. | Final post-update run exited 0. | Pass | Recorded local execution above |
| QA-02 | Strict typing | A typecheck script or documented `tsc --noEmit` command exists | Run the project typecheck. | Command exits 0 without TypeScript errors. | Exited 0. | Pass | Recorded local execution above |
| QA-03 | Production readiness | Production environment shape documented; dependencies installed | Run `npm run build`. | Production build completes successfully; no secret is printed. | Next.js 16.3.1/Turbopack compiled, recognised proxy and generated 29/29 pages; exit 0. | Pass | Recorded local execution above |
| QA-04 | Automated suite | Dependencies installed | Run `npm test`. | All included automated cases pass and report their count. | 5 files and 19 tests passed under Vitest 4.1.10. | Pass | `tests/*.test.ts`; recorded local execution above |
| QA-05 | Production dependency audit | Locked dependencies installed | Run `npm audit --omit=dev`. | No known production dependency vulnerability is reported at execution time. | 0 vulnerabilities reported. | Pass | Recorded local execution above |
| QA-06 | Full dependency audit | Locked dependencies installed | Run `npm audit`; review rather than force a breaking change. | Findings are triaged by reachability/scope and fixed safely or recorded with mitigation. | 0 vulnerabilities reported after the safe vinext update. | Pass | Recorded local execution above |
| QA-07 | Production-start/no-config smoke | Passing build; Supabase variables intentionally absent | Start the production server; request public/protected routes and representative protected APIs. | Public pages serve; protected page redirects; data APIs fail closed without exposing data or inventing success. | Root/login 200; dashboard 307 to login; activity/quiz 503 configuration response; admin module API 401. | Pass | Recorded local execution above |
| UNIT-01 | FR8 quiz calculation | Pure scoring test data with 8–10 questions | Test zero, below threshold, exactly 70%, full score and malformed answers. | Score/max/percentage/pass are correct; malformed input is rejected. | Bounded percentage and 69%/70% threshold cases passed; the complete malformed-answer matrix was not covered. | Partial | `tests/scoring.test.ts` |
| UNIT-02 | FR9 progress denominator | Pure assignment/published fixtures | Calculate with active/cancelled assignments, without assignments and with zero modules. | Non-cancelled assigned modules take precedence; cancelled assignments are excluded; otherwise published; zero is handled safely. | Percentage calculation including zero denominator passed; assignment/cancellation-versus-published pathway selection was not independently unit-tested. | Partial | `tests/scoring.test.ts` |
| UNIT-03 | FR5 duplicate hazard protection | Seven configured stable hazard IDs | Submit each ID, then repeat one or more and try an unconfigured ID. | Each configured unique hazard contributes 100 once, maximum remains 700, and an unknown ID is rejected. | Pure duplicate scoring and recognised-ID validation passed; embedded DB check also confirmed seven unique IDs, idempotency and 700 points. Hosted RPC remains untested. | Partial | `tests/scoring.test.ts`, `tests/validation.test.ts`; local DB record above |
| UNIT-04 | Validation | Valid and invalid email, password, UUID, slug, answers and admin payload fixtures | Exercise validation utilities at boundaries. | Invalid values fail with safe field/action errors; valid values are normalised as designed. | Module slug, hazard record, module-matching scenario/choice, array-shaped quiz answer and scalar-answer rejection cases passed; full email/password/admin boundary matrix was not executed. | Partial | `tests/validation.test.ts` |
| UNIT-05 | Role/scope utilities | Role and department fixtures including missing department | Evaluate trainee/manager/admin cases and cross-department input. | Manager scope is same department only; missing department never becomes global; trainee has no admin capability. | Known/unknown role normalisation passed; department scope was covered only by the embedded DB check, not the full pure-unit matrix. | Partial | `tests/roles.test.ts`; local DB record above |
| UNIT-06 | Module completion | Learning/activity/quiz combinations around 70% | Evaluate every incomplete/complete combination. | Complete only when required learning and activity are complete and quiz is submitted at >=70%. | Positive completion and representative missing-activity/failed-quiz cases passed; not every Boolean combination was enumerated. | Partial | `tests/scoring.test.ts` |
| UNIT-07 | Achievement rules | Progress/score/point fixtures | Evaluate each configured criterion twice. | Only genuinely met achievements award and duplicate awards are prevented. | Embedded DB check exercised achievement awards after valid completion; the complete criterion and repeat matrix was not run. | Partial | Local DB record above |

## Authentication and security cases

| ID | Requirement | Precondition | Steps | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | FR1 registration | Configured Supabase; unused email | Register with valid fields; inspect Auth user and profile. | Auth behaviour follows email policy; profile exists with role `trainee`; no privileged role was accepted. | Not recorded | Not executed | Pending evidence |
| AUTH-02 | FR1 validation | Auth form available | Submit empty, malformed and rejected credentials. | Accessible generic errors; no session and no sensitive detail. | Not recorded | Not executed | Pending evidence |
| AUTH-03 | FR1 sign-in/session | Confirmed active trainee | Sign in, refresh, open dashboard; remove/inactivate the trusted profile in an isolated test. | `proxy.ts` refreshes valid session state; own dashboard persists; missing/inactive profile fails closed rather than inventing access. | Not recorded | Not executed | Pending evidence |
| AUTH-04 | FR1 sign-out/protection | Signed-in account | Sign out, then directly request protected trainee/admin routes. | Session is removed; private content is not rendered and user receives sign-in/unauthorised outcome. | Not recorded | Not executed | Pending evidence |
| AUTH-05 | FR1 recovery/reset | Email provider and redirects configured | Request recovery; use valid link; set password; try reused/expired link. | Valid reset works; invalid links do not; errors offer safe retry and do not disclose account existence. | Not recorded | Not executed | Pending evidence |
| AUTH-06 | FR1 role routing | One account per role | Sign in as each and request trainee/management routes. | Trainee cannot access admin; manager receives allowed scoped views; admin receives authorised wider views. | Not recorded | Not executed | Pending evidence |
| SEC-01 | RLS own-data isolation | Two trainee accounts | As trainee A, select/update A then attempt B’s profile/progress/attempt IDs. | Own allowed operation succeeds; B’s protected rows are absent/denied. | Embedded DB check exercised own-profile visibility and scoped progress; hosted JWT/RLS retest remains required. | Partial | Local DB record above; permanent pgTAP source |
| SEC-02 | Role and department enforcement | Trainee, two departments, manager, admin | Attempt self-promotion; manager queries/mutates other department; trainee invokes admin actions. | All unauthorised operations are denied at database/trusted boundary, not merely hidden in UI. | Embedded DB check denied self-promotion and cross-department manager visibility; hosted role/action matrix remains required. | Partial | Local DB record above; permanent pgTAP source |
| SEC-03 | Private scoring state | Trainee JWT and anon key | Directly select `private.quiz_answer_keys`, `private.quiz_answer_locks` and `private.activity_scenario_keys`; inspect question/check/submit responses. | Direct private reads are denied; permitted feedback does not return keys, locks or future answers. | Embedded DB checks denied all three private relations and direct explanation reads, and verified safe question/check responses; no browser-network or hosted anon/JWT check was run. | Partial | Local DB record above; permanent pgTAP source |
| SEC-04 | Trusted RPC identity/input | Configured scoring/activity RPCs | Spoof identity/progress/score, invalid IDs/choices, duplicate decisions, changed checked answers and malformed JSON. | Functions derive `auth.uid()` and server progress/points, validate access/input and cannot be redirected or used as a feedback oracle. | Embedded checks confirmed caller progress/score values are ignored, unknown scenarios denied, first decision immutable, quiz first selection locked and a changed selection/missing lock rejected. Complete hosted spoof/malformed-input coverage remains required. | Partial | Local DB record above; permanent pgTAP source |
| SEC-05 | Environment/client bundle | Production build | Search built/browser assets and network traffic for service-role values/secrets. | No service-role key or non-public secret appears in browser-accessible output. | Not recorded | Not executed | Pending evidence |
| SEC-06 | Safe rendering/errors | Test profile names/module input and forced service errors | Attempt script-like text and trigger errors. | Text is escaped; no arbitrary script executes; UI does not expose SQL, stack, keys or private data. | Not recorded | Not executed | Pending evidence |

## Database and integration cases

| ID | Requirement | Precondition | Steps | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INT-01 | Schema/migration | Clean Supabase local/test project | Apply `202608150001_foundation.sql`, `202608150002_security_and_rls.sql`, `202608150003_training_rpcs.sql`, then seed. | Migration completes in order; expected schemas/tables/functions/grants/policies, three published modules, 24 questions/keys and 10 scenario keys exist. | Final files parsed and migrations/seed executed in PGlite with the catalogue/private scoring state asserted; not run in Supabase CLI/Docker/remote. | Partial | Recorded local execution above |
| INT-02 | New profile hook | Migration applied | Create a normal Auth account. | One linked active trainee profile is created; no privileged metadata can override role. | Embedded DB check inserted Auth-compatible test users and confirmed the hook creates trainee profiles; hosted Auth signup was not used. | Partial | Local DB record above; permanent pgTAP source |
| INT-03 | FR7 activity persistence | Authenticated trainee with available module | Invoke learning/hazard/decision states, include spoofed progress/score and repeats, then read progress/log. | Server derives progress/points; unique valid events are immutable/idempotent; five recognised decision attempts complete that activity; minimal sanitised activity is logged. | Embedded checks confirmed seven-hazard idempotency/700, ignored supplied progress and activity score, rejected unknown scenario, preserved a wrong first choice on duplicate, completed all five decisions and derived 400/500. Hosted persistence was not tested. | Partial | Local DB record above; permanent pgTAP source |
| INT-04 | FR8 trusted quiz | Seeded module and authenticated trainee | Load safe questions; check/recheck/change selections; submit with missing/matching locks; read attempt/progress. | Initial payload omits explanations/keys; first checked answer is locked for two hours; changed answer/missing lock is rejected; exact complete locks permit server-scored immutable attempt and are then cleared. | Embedded DB check confirmed safe reads, identical check replay, changed-answer and missing-lock rejection, successful exact-lock submission, lock clearing/retry, server activity snapshot and strict completion. Browser/hosted flow remains unexecuted. | Partial | Local DB record above; permanent pgTAP source |
| INT-05 | FR9 attempts/retry | One failed then one passed submission | Submit both and read history/current progress. | Both attempts remain; passed state updates current progress without rewriting historical attempt. | Not recorded | Not executed | Pending evidence |
| INT-06 | Leaderboard privacy | Multiple test trainees with points | Invoke/read leaderboard snapshot as trainee. | Rank/allowed display name/points/completions are returned; emails and private employee data are absent. | Final embedded DB check confirmed output fields `user_id`, `display_name`, `points`, `completed_modules`, `achievement`, `rank` and active-trainee filtering; hosted/client privacy inspection remains required. | Partial | Local DB record above |
| INT-07 | FR11 reporting scope | Data in two departments | Invoke reports summary as each role/filter. | Manager aggregates only own department; admin follows authorised wider scope; trainee call is denied. | Embedded DB check confirmed same-department manager and organisation-wide admin report scope plus cross-department isolation; complete hosted filter/denial matrix remains required. | Partial | Local DB record above; permanent pgTAP source |
| INT-08 | Scoped attempt result | Stored attempt; owner, same/other department manager and admin identities | Call `quiz_attempt_result` before/after module withdrawal and with missing/foreign IDs. | Owner/same-department manager/admin receive only approved result/module fields regardless of publication; others/missing receive null; no answers/feedback/keys. | Final embedded cross-feature path passed; browser/hosted consumption remains unexecuted. | Partial | Local DB record above; permanent pgTAP source |

## Functional cases

| ID | Requirement | Precondition | Steps | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FUNC-01 | FR2 dashboard | New and progressed trainee accounts | Open dashboard for each. | New user shows zero/empty values; progressed user values match database and next action is clear. | Not recorded | Not executed | Pending evidence |
| FUNC-02 | FR3 Manual Handling | Authenticated trainee | Read content; complete each of five decisions; reopen; continue to quiz/result. | Five decisions give immediate explanation; saved first choices hydrate; server-derived activity score/result matches the choices and required topics are covered. | Not recorded | Not executed | Pending evidence |
| FUNC-03 | FR4 Working at Height | Authenticated trainee | Read content; complete each of five decisions; reopen; continue to quiz/result. | Five decisions give immediate explanation; saved first choices hydrate; server-derived activity score/result matches the choices and required topics are covered. | Not recorded | Not executed | Pending evidence |
| ACT-01 | FR3/FR4 trusted decisions | Authenticated trainee and seeded decision module | Submit valid/wrong choices, repeat a scenario with a different choice, send spoofed score/progress and finish all five. | Private key validates module/scenario/choice; first decision remains authoritative; caller score/progress is ignored; correct choices alone score; five distinct attempts complete activity. | Embedded DB path passed for Manual Handling, including wrong-first immutability and 400/500 server score; UI/hosted Working at Height path remains unexecuted. | Partial | Local DB record above; permanent pgTAP source |
| HAZ-01 | FR5/FR6 360 scene | Supported WebGL browser | Enter scene, wait for asset, inspect/look/touch hotspots. | Scene uses generated warehouse panorama; seven hazards are selectable; loader never uses fake percent. | Not recorded | Not executed | Pending evidence |
| HAZ-02 | FR5 hazard feedback/score | Scene or list available | Select every hazard, read feedback, repeat selections. | Hazard/risk/consequence/corrective action appears; found state is textual; maximum unique credit only. | Not recorded | Not executed | Pending evidence |
| HAZ-03 | FR6 fallback | Disable/fail WebGL or choose alternative | Enter scene, activate list, operate all hazards by keyboard. | Clear equivalent list is available, supports same content/completion and does not require WebGL. | Not recorded | Not executed | Pending evidence |
| HAZ-04 | FR5 persistence | Configured Supabase; complete hazard activity | Trigger a failed save, then valid saves; refresh/sign out/in and reopen. | Failed save does not confirm a hazard; persisted IDs hydrate; no duplicate award occurs. | Not recorded | Not executed | Pending evidence |
| QUIZ-01 | FR8 quiz UX | Available core module quiz | Complete 8 single/multi-select questions with keyboard/pointer; inspect progress/feedback/result. | One-at-a-time array-answer flow, explicit check/submit, first-lock integrity, authorised explanation and final result work. | Not recorded | Not executed | Pending evidence |
| QUIZ-02 | FR8 threshold | Controlled answer sets | Produce 69%/below and 70%/above outcomes where question count permits. | Below threshold is review; at/above 70% passes; wording does not claim accreditation. | Not recorded | Not executed | Pending evidence |
| QUIZ-03 | FR8 answer privacy | Browser network tools | Inspect initial question payloads and all check/submit responses. | Unanswered/future correct keys are not disclosed. | Not recorded | Not executed | Pending evidence |
| QUIZ-04 | FR8 interruption | Start a quiz, refresh/disconnect during submission | Resume/retry according to UI. | No false successful attempt/completion; error provides safe next action. | Not recorded | Not executed | Pending evidence |
| QUIZ-05 | FR8 first-answer integrity | Seeded questions and authenticated trainee | Check an answer, repeat it, try a different answer, submit without every lock, then check all and submit. | Identical repeat is allowed; changed selection and incomplete/unlocked submission are rejected; exact locked answers create one immutable attempt; locks clear for a new attempt. | Embedded DB path passed; two-hour browser expiry/interruption and hosted concurrency remain unexecuted. | Partial | Local DB record above; permanent pgTAP source |
| PROG-01 | FR9 assigned denominator | Trainee with two assignments and additional published module | Complete one assigned module. | Overall progress is 1/2, not 1/all published. | Not recorded | Not executed | Pending evidence |
| PROG-02 | FR9 published fallback | Trainee with no assignments; three published modules | Complete one module. | Overall progress is 1/3. | Not recorded | Not executed | Pending evidence |
| PROG-02A | FR9 cancelled fallback | Trainee with only cancelled assignments and three published modules | Open dashboard/progress. | Cancelled assignments are excluded and published modules form the pathway denominator. | Not recorded | Not executed | Pending evidence |
| PROG-03 | FR9 completion gate | Manipulate valid learning/activity/quiz states through flows | Review progress after each state. | Completion occurs only after required learning/activity plus passing submission. | Embedded DB check kept activity + passed quiz without learning in progress, ignored spoofed learning progress, then completed only after valid learning. Browser/hosted flow remains unexecuted. | Partial | Local DB record above; permanent pgTAP source |
| PROG-04 | Results/actions | Stored attempt | Open `/results/[attemptId]`; use retry/progress/dashboard/next links. | Own result accurately separates activity points, quiz score/maximum/percentage, combined points and achievement; another user’s ID is denied; actions navigate correctly. | Not recorded | Not executed | Pending evidence |
| ADMIN-01 | FR10 admin dashboard | Admin with data and admin with empty test project | Review KPIs/activity/modules. | Values match data; empty project uses empty states rather than invented values. | Not recorded | Not executed | Pending evidence |
| ADMIN-02 | FR10 user filters | Authorised manager/admin | Search and filter by role/status/progress. | Results are correct and never exceed actor scope. | Not recorded | Not executed | Pending evidence |
| ADMIN-03 | Assignment workflow | Relevant trainee/module | Create/reassign/cancel; repeat after progress/completion; try unpublished, withdrawn, invalid and out-of-scope targets. | Upsert preserves audit/system state while due/notes remain editable; cancellation preserves history; no client delete; only published modules accept/reactivate assignments. | Embedded checks exercised upsert, cancellation, withdrawn-module and publication guards; the full UI/scope matrix remains unexecuted. | Partial | Local DB record above |
| ADMIN-04 | Module controls | Admin and manager accounts | Change metadata/publication; try withdrawal during active/concurrent assignment and assignment after withdrawal; view library. | Valid admin changes persist; manager denied; active work blocks withdrawal; unpublished target blocks insert/reactivation; trainee pages enforce DB publication/current metadata/progress. | Embedded cross-feature/focused checks passed module/assignment guards; browser propagation and independent concurrency load remain unexecuted. | Partial | Local DB record above |
| ADMIN-05 | Assessment review | Stored attempts across departments | Open/filter results as manager/admin. | Manager sees own department only; admin sees authorised wider set; fields match attempts. | Not recorded | Not executed | Pending evidence |
| REPORT-01 | FR11 report correctness | Known controlled dataset with retries and a cancelled assignment | Compare scoped completion, latest-attempt score and overdue summary to hand calculation. | Every figure matches scoped source rows; current quiz metrics use latest attempts; cancelled assignments are excluded from active/overdue counts. | Not recorded | Not executed | Pending evidence |
| REPORT-02 | FR11 filters/empty | Report page | Apply valid/empty filter sets and reset. | Correct scoped recalculation; empty state; no stale invented metric. | Not recorded | Not executed | Pending evidence |
| REPORT-03 | FR11 accessible equivalent | Report summaries present | Navigate summary and tables by keyboard/screen reader spot check. | The same material information is available without a purely visual chart. | Not recorded | Not executed | Pending evidence |

## Accessibility, responsive, compatibility and performance cases

| ID | Requirement | Precondition | Steps | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A11Y-01 | Global keyboard/structure | Representative routes | Use only keyboard; inspect landmarks/headings/skip link/focus order. | All tasks reachable; visible focus; no trap except managed modal; skip link works. | Not recorded | Not executed | Pending evidence |
| A11Y-02 | Forms/quiz/activity | Auth and module forms | Inspect names/labels/groups/errors; submit errors; zoom text. | Controls have programmatic labels; errors are associated/announced; state is not colour-only. | Not recorded | Not executed | Pending evidence |
| A11Y-03 | Equivalent 360 learning | Hazard List View | Complete all seven with keyboard and screen-reader spot check. | Equivalent content and completion; found state and feedback are announced meaningfully. | Not recorded | Not executed | Pending evidence |
| A11Y-04 | Admin/report tables | Management pages with data | Navigate filters/table and any visual summary without pointer. | Headers/names/order are meaningful and text/table equivalent exists. | Not recorded | Not executed | Pending evidence |
| A11Y-05 | Reduced motion | OS/browser prefers reduced motion | Load public, dashboard, progress and scene; trigger panels/completion. | No prolonged loader/reveal/pulse/count/scale; content/state remains usable immediately. | Not recorded | Not executed | Pending evidence |
| RESP-01 | Desktop/laptop | Production build at wide widths | Inspect public, trainee, admin and scene at representative wide widths. | No overlap/clipping; sidebar/table/scene panel remain usable. | Not recorded | Not executed | Pending evidence |
| RESP-02 | Tablet/mobile | Representative touch widths and orientation | Inspect same routes; open/close drawer and scene feedback. | Content reflows; controls meet practical touch size; bottom feedback and drawer manage focus. | Not recorded | Not executed | Pending evidence |
| RESP-03 | Reflow/zoom | Browser 200% and narrow CSS viewport | Complete auth, module, quiz and report tasks. | No essential two-dimensional scrolling or hidden controls except legitimate data table/scene surfaces. | Not recorded | Not executed | Pending evidence |
| BROWSER-01 | Compatibility | Current supported Chrome, Edge, Firefox and Safari/WebKit environments | Run critical auth/module/list flows; run scene where WebGL supported. | Critical flow works or provides documented fallback; no browser-specific blocker. | Not recorded | Not executed | Pending evidence |
| PERF-01 | Route loading | Production build/browser network tools | Load auth/dashboard before ever opening scene. | Three.js and panorama are absent from ordinary initial route requests/bundles. | Not recorded | Not executed | Pending evidence |
| PERF-02 | Scene loading | Throttled network and cache-off | Enter scene, observe loader/asset/interaction readiness. | Genuine/indeterminate loader persists only while needed; controls appear when usable; failure offers list. | Not recorded | Not executed | Pending evidence |
| PERF-03 | Motion/rendering | Browser performance tools | Navigate and interact with hover/progress/hotspot states. | Animation primarily uses transform/opacity and does not block input; no fake delay. | Not recorded | Not executed | Pending evidence |
| USAB-01 | Task clarity | Representative users and consented script | Ask users to sign in, find next training, complete one decision and locate progress; observe without coaching. | Completion/hesitation observations and direct comments are recorded verbatim/anonymously. | Not recorded | Not executed | Pending evidence |
| UAT-01 | Stakeholder acceptance | Agreed client representative, deployed/configured demo and acceptance script | Demonstrate core modules, scene/list, results/progress and management/reporting; record decision. | Genuine acceptance, requested changes or rejection is documented with date/evidence. | Not recorded | Not executed | Pending evidence |
| VR-01 | FR12 architecture | Scene source and dependency design available | Review separation of panorama/hazard data/input/rendering and Three.js WebXR path. | B6 browser code does not hard-code progress to pointer-only coordinates; future headset work is feasible but unclaimed. | Not recorded | Not executed | Pending evidence |

## Test data and privacy

Create dedicated non-production accounts through Supabase Auth:

- one trainee with no progress;
- a second trainee with controlled progress in Department A;
- one trainee in Department B;
- one manager in each relevant department as needed;
- one administrator.

Do not commit passwords or use real employee information. Seed content contains modules/questions/achievements only and no Auth users. Remove or clearly isolate test data before any production use.

## Evidence capture format

For each executed case record:

```text
Test ID:
Date/time and timezone:
Tester:
Commit:
Environment/browser/viewport:
Data/account precondition:
Actual result:
Status:
Evidence path or issue:
```

Console logs should be redacted for tokens, emails and private identifiers. Screenshot IDs B1-S01–B1-S18 are defined in `ui-design.md`; a placeholder filename is not evidence.

## Defect handling and exit criteria

1. A failed security, privacy, authentication, RLS, answer-key or cross-user test blocks production readiness.
2. A failed core module, quiz, progress, accessible Hazard List or build test blocks the B6 definition of done.
3. Record each defect with reproduction, severity, environment and expected/actual behaviour.
4. Re-run the failed case and appropriate regression cases after a fix; retain both original failure and later pass evidence.
5. Production readiness requires genuine results for build/type/lint/tests, critical browser flows, RLS negative cases, accessibility checks and stakeholder acceptance where the project requires it.
