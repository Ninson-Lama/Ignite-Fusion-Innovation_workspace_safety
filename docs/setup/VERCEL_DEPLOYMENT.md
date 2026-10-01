# Vercel Deployment Preparation

## Present status

Vercel is the intended production host, but no GitHub/Vercel connection, project, deployment date or hosted URL is claimed. The release-readiness check on 1 October 2026 passed lint, TypeScript, 92 automated tests, the production dependency audit and `npm run build` with Next.js 16.3.8/Turbopack. The build recognised `proxy.ts` and generated all 40 build-time pages. Complete this guide only with authorised access and repeat the build in the final deployment candidate.

Current official references:

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Supabase redirect URLs, including Vercel guidance](https://supabase.com/docs/guides/auth/redirect-urls)

## Prerequisites

- Git repository with the intended B6 commit pushed to an authorised GitHub repository;
- supported Node.js version matching `package.json`;
- locally successful lint/type/tests/build scripts that actually exist in the project;
- a reviewed production dependency audit (`npm audit --omit=dev` reported zero at handover; re-run because advisory data changes);
- a staging/production Supabase project with migrations and seed deliberately applied;
- Supabase Project URL and publishable key;
- verified authentication callback/reset routes; and
- authority to configure Vercel and Supabase redirects.

Do not deploy merely to create an evidence URL while critical auth/RLS/security tests are failing.

## 1. Import from GitHub

1. Sign in to Vercel and choose **Add New → Project**.
2. Connect the authorised GitHub account/organisation with the minimum repository scope required.
3. Import the Safety360 repository.
4. Confirm the repository root is the application root (the folder containing `package.json`), not `docs/`, `app/` or a nested folder.
5. Confirm Vercel detects Next.js and uses the repository’s canonical install/build commands (`npm install` and `npm run build`).
6. Select the Node.js version that satisfies the `engines` field.

The project uses a canonical Next.js App Router architecture for production. Before first deployment confirm `npm run build` succeeds against the locked handover dependencies and that Vercel uses that same lockfile. A separate local preview adapter, if retained for development tooling, is not the Vercel production command.

## 2. Add environment variables

In **Project Settings → Environment Variables**, add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
NEXT_PUBLIC_SITE_URL=https://YOUR_REAL_PRODUCTION_DOMAIN
```

Use the project’s publishable key. If a legacy project supplies only an anon key, use `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the compatibility fallback and omit the publishable variable.

Apply the correct values to **Preview** and **Production** deliberately. Ideally, previews use a separate Supabase branch/test project so they do not mutate production training data. Environment-variable changes affect new deployments, so redeploy after edits.

Never add `SUPABASE_SERVICE_ROLE_KEY` or a database password to this browser application. The client needs only the Project URL and publishable/legacy anon key; RLS and trusted functions enforce access.

## 3. Make an initial preview deployment

1. Deploy a non-production branch/preview.
2. Read build logs for the exact commit and confirm the build completed.
3. Record the actual preview URL privately for configuration/testing; do not write a guessed URL into documentation.
4. Verify public routes render before configuring email links.
5. Add only the required preview callback/reset origins to Supabase.

Supabase supports wildcard redirect patterns, but a broad wildcard increases redirect risk. Prefer exact controlled preview URLs or the narrowest documented pattern for the authorised Vercel team/repository.

## 4. Configure Supabase production URLs

After the real production domain exists, open Supabase **Authentication → URL Configuration**:

- **Site URL:** `https://YOUR_REAL_PRODUCTION_DOMAIN`
- **Additional Redirect URL:** `https://YOUR_REAL_PRODUCTION_DOMAIN/auth/callback`
- **Additional Redirect URL:** `https://YOUR_REAL_PRODUCTION_DOMAIN/reset-password`
- retain local URLs only if local development is still required:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`

Use `https://` and the exact final host. If a custom domain replaces the default Vercel domain, update `NEXT_PUBLIC_SITE_URL`, Site URL, redirect allow-list and any email templates, then redeploy and request new confirmation/recovery links.

The application routes are:

- `/auth/callback` for the authorised authentication code/session continuation;
- `/reset-password` for entering a replacement password in a valid recovery context.

Do not allow an arbitrary `next` or redirect parameter to send users off-origin.

## 5. Production deployment

1. Ensure the intended production branch/commit passed the local and preview gates.
2. Promote the verified preview or deploy the production branch according to the repository policy.
3. Confirm the exact deployment commit and environment selection.
4. Record the real URL in README/run instructions only after it returns the application successfully.
5. Avoid exposing demo credentials in the deployment description, screenshots or source.

## 6. Production verification

Use fictitious test accounts and record genuine results for:

### Public/auth

- landing, register, email confirmation, sign-in, sign-out;
- `proxy.ts` session refresh, profile fail-closed behaviour, session persistence and direct protected-route denial;
- forgot/reset password and expired-link handling; and
- secure redirect back to the intended domain.

### Trainee

- empty dashboard and real assignments;
- database publication/metadata/current progress on all three core modules; saved-choice hydration and server-derived scoring for both five-decision activities;
- eight-question array/multi-select quizzes, first-selection locking, trusted feedback, 70% threshold and stored attempts;
- strict learning + activity + passed-quiz completion, activity/quiz/combined result breakdown, achievements and privacy-aware leaderboard; and
- profile/help/sign-out.

### 360 and accessibility

- Three.js/panorama loads only on the scene route;
- seven hazards, no duplicate points, pointer/touch and available keyboard controls;
- WebGL-failure/user-selected Hazard List equivalence;
- visible focus, semantic labels, scene feedback focus and reduced motion; and
- desktop, tablet and mobile reflow.

### Management/security

- administrator pages/actions and genuine empty/data states;
- same-department manager scope and cross-department denial;
- trainee denial from `/admin` and privileged functions;
- direct denial of all private answer-key, answer-lock and scenario-key relations;
- latest-attempt/scoped report accuracy and cancelled-assignment exclusion;
- no service-role/database secret in browser output; and
- report accuracy/text equivalents.

Do not mark the deployment production-ready until critical tests in `docs/b1/testing-plan.md` have actual pass evidence. A successful Vercel build alone does not verify Supabase RLS or application security.

## 7. Operations and rollback

- Vercel can redeploy a known application commit, but a frontend rollback does not automatically roll back a database migration.
- Prefer forward-compatible, reviewed migrations and stage them before the frontend that depends on them.
- If a release exposes data or crosses role scope, disable/rollback the affected application and correct database policies immediately under the incident process.
- Rotate any credential that appears in logs/source, remove it from history where authorised and redeploy.
- Monitor Supabase/Vercel errors without logging passwords, access tokens, recovery links, answer keys or unnecessary employee data.

## Known deployment limitations

- No Vercel/GitHub project or URL has been created in this work.
- Domain, SMTP, preview branching, retention, monitoring and incident ownership require organisational decisions.
- Remote migrations, RLS, auth email delivery and role flows remain unverified.
- Future WebXR/headset behaviour is not a deployment acceptance criterion for B6 browser 360.
