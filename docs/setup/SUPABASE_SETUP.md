# Supabase Setup for IFI Safety360

## Current status

The repository contains the reviewed migration and seed artefacts. On 15 August 2026, the final backend SQL parsed and the migrations/seed executed successfully in temporary embedded PostgreSQL-compatible environments; selected RLS, private-state denial, first-answer locking, server-derived scoring, strict completion, cross-feature assignment/module guards, scoped result/report and administration paths passed there. The permanent 48-assertion pgTAP suite in `supabase/tests/database/security_and_training.sql` was authored but not run through Supabase CLI/Docker.

On 20 August 2026, the three migrations and seed were applied in order through the authorised SQL editor of the hosted IFI-360 Supabase project. Owner checks returned 3/3 published modules, 24 active questions, 24 private answer keys, 10 private decision scenarios, 6 active achievements, 24 public RLS policies, RLS enabled on `profiles` and the trusted activity RPC present. An anonymous REST catalogue request was denied with HTTP 401, the four exact local/owner-only-preview callback and reset URLs were saved, and one confirmed active profile signed into the local application through hosted Supabase Auth and was displayed with its trusted administrator role. This is partial hosted integration evidence only: the multi-account/department negative RLS matrix, email delivery/recovery, token rotation, full training persistence and independent load/concurrency checks remain unexecuted.

This procedure requires authorised access to create/manage the project. Never paste a database password, access token, session token or service-role key into source control, screenshots, issues or terminal output shared as evidence.

Current official references:

- [Supabase local CLI workflow (`link`, `db push`, seed and reset)](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase password authentication and recovery](https://supabase.com/docs/guides/auth/passwords)
- [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)

## 1. Create a project

1. Sign in to an authorised Supabase organisation.
2. Create a new project for the appropriate non-production environment first.
3. Select the region/data location according to the organisation’s requirements, not convenience alone.
4. Generate/store a strong database password in an approved password manager.
5. Wait for project provisioning, then record the project reference separately from source control.
6. Under project API settings, copy:
   - the Project URL; and
   - the publishable key (`sb_publishable_…`) for browser use.

The publishable key is intentionally public and relies on Authentication/RLS. It is not a replacement for correct policies. Legacy projects may show an `anon` key, which the application accepts only as a compatibility fallback.

Do **not** configure a service-role key in this frontend application. A service-role key bypasses RLS and must never use a `NEXT_PUBLIC_` name.

## 2. Configure local environment variables

From the repository root in PowerShell:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env.local
```

Edit `.env.local` locally:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

If and only if the project supplies a legacy anon key instead of a publishable key, omit the publishable variable and use:

```dotenv
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_LEGACY_ANON_KEY
```

Restart the development server after changing environment variables. `.env.local` is ignored by Git; verify with `git status` before any commit.

## 3. Review the SQL before applying it

Apply in filename order:

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `supabase/migrations/202608150001_foundation.sql` | Extensions, private schema, enums, public tables plus private answer keys/locks/scenario keys, constraints/indexes, timestamps and Auth profile hook. |
| 2 | `supabase/migrations/202608150002_security_and_rls.sql` | Trusted role/department helpers, protected-field guards, grants and RLS policies. |
| 3 | `supabase/migrations/202608150003_training_rpcs.sql` | Trusted activity/scoring/result/management functions including `record_training_activity`, `quiz_questions_for_module`, `check_quiz_answer`, `submit_quiz`, `quiz_attempt_result`, `leaderboard_snapshot`, `reports_summary`, `set_module_publication`, `admin_update_profile` and `manage_module`. |
| Seed | `supabase/seed.sql` | Exactly three published core modules, eight active questions/keys per module, ten private decision-scenario keys and achievement definitions; no Auth users/passwords. |

Review especially:

- `profiles.role` default and Auth hook;
- manager same-department logic;
- denial/no-policy posture for `private.quiz_answer_keys`, `private.quiz_answer_locks` and `private.activity_scenario_keys`;
- two-hour first-answer locks and private server-held decision maps;
- all `SECURITY DEFINER` functions, their explicit `search_path` and `auth.uid()` checks;
- direct write grants on progress/attempt/achievement relations;
- absence of authenticated assignment delete and history-preserving cancellation;
- shared assignment/module advisory locking and the guard blocking module withdrawal with active assignments;
- the reciprocal guard requiring a published module for every assignment insert/reactivation, including administrator actions;
- seed pass marks (the core project threshold is 70%); and
- any destructive or irreversible statement.

Do not disable RLS to resolve an application error.

## 4A. Apply to a local Supabase stack (recommended first)

The local stack requires Docker and the Supabase CLI. If the repository does not yet contain `supabase/config.toml`, initialise the CLI metadata once from the repository root; do not re-initialise over a reviewed configuration:

```powershell
npx supabase init
npx supabase start
npx supabase db reset
```

`db reset` is destructive to the **local Supabase database**: it recreates the local database, applies migrations and then runs the configured seed. Confirm that the CLI target is local before using it. The CLI output provides local Project URL/public keys and a local mail-capture URL; place the public values in `.env.local` and never commit them.

Inspect Supabase Studio as an authorised owner and confirm the expected public tables, all three private relations, functions, grants and policies exist. Ordinary application roles must not gain direct private-schema access. Use local captured emails to exercise confirmation/recovery flows.

Stop the local services when finished:

```powershell
npx supabase stop
```

## 4B. Apply to a linked remote test project

Use a dedicated test/staging project before production:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push --include-seed
```

Read the dry-run output before the push. `db push` uses migration history and applies migrations not already recorded. `--include-seed` intentionally applies the configured seed and is for a fresh development/staging environment, not a production database. For production, apply schema migrations and provision the reviewed core catalogue through an explicitly approved, repeatable production content process. Do not use `db reset --linked` for routine deployment: it can drop remote user-created objects.

If the CLI requests the database password, supply it interactively. Do not place it in a shell command, documentation or committed environment file.

After applying, confirm migration history and seed counts in the dashboard. Seed data must contain no Auth users or passwords.

## 5. Configure Authentication

In the Supabase dashboard:

1. Enable email/password authentication.
2. Decide whether email confirmation is required for the intended environment. Document the choice in the test evidence.
3. For production, configure an approved custom SMTP provider and sender identity; the default service is suitable only for limited testing/best-effort use.
4. Under Authentication URL Configuration, set local development:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
   - Redirect URL: `http://localhost:3000/reset-password`
5. After a real Vercel URL exists, replace the Site URL with the exact HTTPS production origin and add its callback/reset URLs. See `VERCEL_DEPLOYMENT.md`.
6. Review confirmation/recovery email templates so the links use the intended redirect destination.

Registration must not accept role/status/department as authoritative user metadata. The migration Auth hook creates the profile with `trainee` role and active status.

## 6. Create the first administrator

There is deliberately no public promotion flow. Bootstrap only after migrations are applied:

1. Register the intended administrator normally through the application/Auth dashboard.
2. Confirm the email if required and verify one matching `public.profiles` row exists.
3. In the Supabase SQL editor, retrieve and manually verify the exact Auth UUID/email.
4. Replace the placeholder UUID below and execute as the project database owner:

```sql
begin;

update public.profiles
set role = 'admin',
    updated_at = now()
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid
returning id, full_name, role, status;

commit;
```

The statement must return exactly the intended row. If it returns zero or an unexpected identity, roll back/revert before proceeding. Do not put a real email, UUID or password in this documentation or Git.

Then sign out/in and test both an allowed administrator action and a denied trainee action using separate accounts. Subsequent promotions should use the authorised administration mechanism and organisational approval record.

For a manager, set `role = 'manager'` and a valid `department` using the same privileged process. Under the B6 policy, a manager without a department has no broader trainee scope.

## 7. Verify RLS and role isolation

Use the application/client with distinct JWT sessions; SQL-editor queries run as an owner may bypass the same restrictions and are not sufficient RLS evidence.

Minimum negative and positive checks:

1. Trainee A can read their profile, assignments, progress, attempts and achievements.
2. Trainee A cannot read/update Trainee B’s protected rows.
3. A trainee cannot update `role`, `status`, `department`, employee identifier or Auth UUID.
4. A trainee can read available published module/question content but cannot directly select any of `private.quiz_answer_keys`, `private.quiz_answer_locks` or `private.activity_scenario_keys`.
5. A manager can read only active/relevant same-department trainee monitoring data and cannot widen it with a supplied ID/filter.
6. A manager cannot perform administrator-only publication/role operations.
7. An administrator can perform only the explicitly granted actions.
8. An unauthenticated request cannot retrieve protected application data.
9. Manager/administrator assignment cancellation preserves the row; an authenticated delete is denied.
10. Unpublish/archive is rejected while any assignment is `assigned` or `in_progress`, including a concurrent assignment/withdrawal attempt.
11. Assignment insert is rejected for an unpublished module, and a cancelled assignment cannot be reactivated after that module is withdrawn.

Also inspect `pg_policies`, table RLS flags and function grants, then attach genuine results to SEC-01–SEC-04 in the testing plan.

## 8. Verify trusted training functions

With a seeded core module and authenticated trainee:

- `record_training_activity` must derive the user from `auth.uid()`, ignore caller `progress_percent` and score values, validate allowed module/activity/event keys and remain idempotent for duplicate canonical event keys;
- Hazard Perception must accept only configured hazard IDs, derive 100 points per unique hazard and complete at all seven;
- Manual Handling/Working at Height must accept only a module-matching private scenario ID plus allowed `metadata.selectedChoiceId`, preserve the first choice for each scenario, derive 100/0 points for correct/wrong and complete after all five distinct scenarios are attempted;
- `quiz_questions_for_module` must omit `explanation` and every correct-answer value from the initial question payload;
- `check_quiz_answer` must normalise and lock the first valid selection for two hours, allow an identical repeat, reject a different selection and only then return permitted feedback for that question—not a future/complete answer bank;
- `submit_quiz` must require every active question and an exact unexpired lock for every submitted answer, read `private.quiz_answer_keys`, create a numbered immutable attempt, recompute/snapshot the server-derived activity score, calculate against the 70% seeded module pass mark, clear locks only after attempt insertion, update progress and award only eligible achievements;
- `quiz_attempt_result` must return null to an unauthorised/missing request and only the scoped result fields to self, same-department manager or administrator, even if the module is later unpublished; it must never return submitted answers, feedback or keys;
- completion must remain `learning_complete AND activity_complete AND passed quiz`; a caller-supplied progress value cannot bypass a missing gate;
- `leaderboard_snapshot` must omit email/private employee information; and
- `reports_summary` must deny trainees and preserve manager department scope.
- `reports_summary` must use latest attempts for current quiz indicators and return JSON null—not a fabricated zero—when no latest attempt exists.

Inspect browser network responses as well as database rows. Do not call functions with a service-role client during RLS verification.

## 9. Demo accounts

Create separate fictitious accounts through Supabase Auth for:

- trainee;
- manager; and
- administrator.

Use an approved password manager or private handover channel. Do not commit passwords, add hard-coded bypasses or seed Auth users in `seed.sql`. Add at least two departments for cross-scope testing.

## 10. Production readiness checks

Before using real employee data:

- execute every auth/RLS/quiz/privacy case in `docs/b1/testing-plan.md`;
- configure custom SMTP, HTTPS redirects and an organisational password/session policy;
- review data location, retention, deletion/offboarding, backup/recovery and privacy responsibilities;
- run dependency/build/static checks and respond to advisories proportionately;
- confirm migrations in a staging project and define a rollback/forward-fix plan;
- remove or segregate demo data; and
- complete an authorised security/privacy review.

Safety360 does not claim perfect security. The embedded checks and the dated hosted setup/admin-login observations are partial evidence only; unexecuted hosted RLS, recovery, persistence, concurrency and multi-role cases remain pending until the above tests produce genuine evidence.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| “Supabase is not configured” | Variable names, no quotes/trailing spaces, correct project URL/key, and development server restart. |
| Profile missing after registration | Foundation migration and Auth trigger/function; Auth user created after migration; inspect trigger error logs. |
| `permission denied for schema private` | Expected for ordinary clients. Use only trusted RPCs; do not grant answer-key, answer-lock or scenario-key tables to fix the UI. |
| Quiz says the checked answer changed/expired | Keep the first checked selection, or restart/check the question again after the two-hour lock expires; confirm client submissions use normalised answer arrays. Do not bypass the lock table. |
| Decision is not stored | Confirm the scenario belongs to that module and the choice ID is in the server-held allowlist; never accept a caller-supplied score as a workaround. |
| Manager sees nothing | Confirm manager/trainee active status and matching non-empty department values. |
| Manager sees too much | Stop testing as a production candidate and inspect helper/RLS policy with cross-department accounts. |
| Quiz call is missing | Confirm migration `202608150003_training_rpcs.sql` applied and execute grants match authenticated role. |
| Seed fails | Confirm all migrations succeeded first; inspect the first SQL error and seed idempotency instead of partially re-running arbitrary blocks. |
| Recovery link returns to the wrong site | Correct Site URL, redirect allow-list, application `NEXT_PUBLIC_SITE_URL` and email template destination; request a fresh link. |
