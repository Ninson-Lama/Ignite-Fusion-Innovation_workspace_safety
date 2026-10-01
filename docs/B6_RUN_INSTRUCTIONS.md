# IFI Safety360 B6 Run Instructions

## Hosted access

**Production URL: not available — deployment has not yet been completed.**

After an authorised Vercel deployment succeeds, replace that line with the exact HTTPS URL and record the tested commit/date. Do not guess a Vercel address. Hosted use also requires Supabase migrations, auth redirects and environment variables to be configured.

## Local prerequisites

- Git working copy of the repository;
- Node.js satisfying the version in `package.json`;
- npm;
- for real database/auth behaviour, an authorised Supabase project or local Supabase CLI/Docker stack; and
- a modern WebGL-capable browser for the 360 scene (the Hazard List View remains the equivalent alternative).

## Quick local start

From the repository root:

```powershell
npm install
Copy-Item -LiteralPath .env.example -Destination .env.local
npm run dev
```

Edit `.env.local` before starting real auth/data flows:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then open the localhost URL printed by the development command (normally `http://localhost:3000`). Never commit `.env.local`.

Without valid Supabase values, the public presentation may render, but registration, sign-in, persistence, RLS, quizzes and role-protected administration cannot be genuinely demonstrated. There is no insecure local login bypass.

## Configure Supabase

Follow `docs/setup/SUPABASE_SETUP.md`. In summary:

1. create a Supabase test project or start the local stack;
2. configure the Project URL and publishable key;
3. apply, in order:
   - `202608150001_foundation.sql`;
   - `202608150002_security_and_rls.sql`;
   - `202608150003_training_rpcs.sql`;
4. apply `supabase/seed.sql` deliberately;
5. configure Site URL and callback/reset redirects;
6. register accounts through Supabase Auth; and
7. promote the first administrator through the privileged SQL setup procedure.

The seed contains no Auth users/passwords. It does contain 24 protected quiz keys and ten protected decision-scenario keys; temporary quiz-answer locks are created only during real authenticated attempts. Ordinary application roles must not receive direct access to any private relation.

For a local CLI stack (destructive to local database data):

```powershell
npx supabase start
npx supabase db reset
```

For a linked remote test project, review before applying:

```powershell
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push --include-seed
```

Do not use a service-role key in browser variables and do not run `db reset --linked` as a normal deployment command.

## Prepare demonstration accounts

Create fictitious accounts through the normal Auth flow for:

- trainee;
- manager with a non-empty department; and
- administrator.

Promote manager/admin only through the trusted setup/administration process. Store passwords outside Git and never display them in committed documentation. Use at least two departments to demonstrate that manager scope cannot cross departments.

## Run the production checks

Inspect the actual scripts first:

```powershell
npm run
```

Then run the relevant scripts that exist, typically:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Audit the production dependency set separately from the optional development tooling:

```powershell
npm audit --omit=dev
npm audit
```

At the 1 October 2026 release-readiness check, `npm audit --omit=dev` reported zero production vulnerabilities after Next.js and its ESLint plugin were updated to 16.3.8. The separate full audit can include advisories in development-only test and optional Sites/Cloudflare tooling; those packages are not part of the Vercel runtime bundle and should be updated only after validating both development adapters. Continue to review proposed dependency changes before applying them; never run a forced audit fix without validating the resulting application and build.

The release checks on 1 October 2026 passed `npm run lint`, `npm run typecheck`, `npm test` (18 files/92 tests under Vitest 4.1.10), `npm audit --omit=dev` and `npm run build` (Next.js 16.3.8/Turbopack, `proxy.ts` recognised, 40/40 build-time page generations), all with exit 0. The separate optional Sites/Vinext adapter is not the Vercel production command. Re-run every check after later changes or in a deployment candidate rather than carrying an old pass forward automatically. A successful local build does not verify remote Authentication or RLS; the exact SQL and hosted-test boundary is recorded in `docs/b1/testing-plan.md`.

To run the local production server, use the start script only after a successful build:

```powershell
npm run start
```

Use the URL/port printed by the command.

## Demo route checklist

### Public/authentication

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password` through a genuine recovery link
- `/auth/callback` through a genuine email/auth flow

### Trainee

- `/dashboard`
- `/training`
- `/training/hazard-perception`
- `/training/hazard-perception/scene`
- `/training/manual-handling` plus activity/quiz
- `/training/working-at-height` plus activity/quiz
- `/results/[attemptId]` with a real own attempt ID
- `/progress`, `/leaderboard`, `/achievements`, `/profile`, `/help`

### Management

- `/admin`
- `/admin/users`
- `/admin/training`
- `/admin/assignments`
- `/admin/results`
- `/admin/reports`

Demonstrate one allowed and one denied role action. Do not put a trainee/admin identifier in a URL merely for screenshots if the record does not exist.

## 360 scene notes

- The scene lazily loads Three.js/WebGL and `public/warehouse-panorama.png`; normal pages should not load the 360 dependency/asset.
- There are seven unique hazards. Trusted activity scoring derives 100 points per configured unique hazard, maximum 700; repeat selections must not increase it.
- Saved hazard IDs are hydrated on reopen, and a new hazard is not confirmed in the UI until its trusted database save succeeds.
- Manual Handling/Working at Height each restore five saved scenario choices. The server validates the first choice, ignores caller score/progress, awards 100/0 and caps activity at 500.
- Quiz selections are arrays (including multi-select); the first valid check is locked for two hours, changed checked answers are rejected and final submission must exactly match every active lock.
- If WebGL or the asset fails, choose the equivalent Hazard List View and complete the same content by keyboard.
- Reduced-motion preference disables non-essential pulse/transition effects but not the learning state.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Dependency install fails | Confirm Node/npm versions match `package.json`; preserve the first actual error; do not delete lockfiles casually. |
| Supabase configuration message | Check exact variable names/values and restart dev server. Publishable key is preferred; legacy anon is fallback. |
| Auth email returns to wrong URL | Configure Supabase Site URL/redirect allow-list for localhost or the real HTTPS host, then request a fresh link. |
| Profile/admin access missing | Confirm all migrations applied, Auth hook created the profile, and role promotion used the exact verified UUID. |
| A private scoring table is denied | Expected for browser roles. Use trusted activity/quiz RPCs; never grant answer-key, answer-lock or scenario-key access to fix the client. |
| Checked quiz answer cannot be changed | Expected first-answer integrity. Keep the checked selection or start a legitimate new attempt after submission/expiry; do not edit private locks. |
| Decision choice is rejected | Confirm the scenario belongs to the module and the submitted choice ID is allowed; never send or trust a caller-computed score. |
| Quiz RPC not found | Apply `202608150003_training_rpcs.sql` to the same project referenced by `.env.local`. |
| Scene cannot initialise | Check supported WebGL/browser/network, then use the Hazard List View. No user should be blocked from the learning outcome. |
| Values remain zero | Verify you are using the expected account/project and have genuinely stored assignments/activity. Do not seed fake user results. |
| Manager sees no data | Confirm active manager and trainees share the intended non-empty department. |
| Manager sees cross-department data | Stop and treat as a critical RLS/scope failure; do not continue a production demonstration. |
| Build passes but auth fails | Build is local/static evidence only; verify Vercel variables, Supabase redirects, migrations and email settings. |

## Manual completion actions

- Connect an authorised Supabase project and apply/verify migrations and seed.
- Configure email provider, Site URL and redirects.
- Create fictitious demo accounts and promote manager/admin securely.
- Execute and record all critical tests, especially RLS denials, private scoring-state denial, first-answer locks and server-derived activity scoring.
- Push the intended commit to an authorised GitHub repository.
- Import/deploy to Vercel and record the genuine URL.
- Capture B1-S01–B1-S18 from the configured application.
- Obtain and log genuine stakeholder feedback/acceptance.

Until these actions occur, do not claim remote authentication/RLS, production deployment, screenshots or stakeholder acceptance are complete.
