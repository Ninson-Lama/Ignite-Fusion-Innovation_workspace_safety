# IFI Safety360 Administrator and Manager User Guide

## Scope and prerequisites

This guide covers the role-filtered `/admin` workspace. A **Health & Safety Manager** is restricted to relevant trainees in the same department; a **manager is not an unrestricted administrator**. An **administrator** has the wider operations explicitly allowed by Supabase policies/functions.

Prerequisites:

- Supabase project created and environment variables configured;
- migrations and seed applied in order;
- the user registered normally through Supabase Auth;
- an existing authorised administrator/project owner promoted the user’s `profiles.role` through a trusted manual or administrative operation; and
- for managers, a valid department matching relevant trainee profiles.

There is no public manager/admin registration option and no frontend login bypass. On 20 August 2026 the hosted Supabase schema/catalogue and Auth redirects were configured and an authorised profile completed a real local application sign-in with the trusted `admin` role. The future canonical Vercel deployment remains a separate release step.

## 1. Sign in and access the workspace

1. Sign in through `/login` with your own account.
2. Open `/admin` from the permitted navigation or directly.
3. The application resolves your role from the trusted profile and the database applies RLS/function checks.

Expected outcomes:

- `manager` — allowed management views return same-department information only;
- `admin` — wider authorised views/actions are available;
- `trainee` or no valid session — private management data is not queried/rendered and an unauthorised/sign-in outcome appears.

A missing manager department should result in no relevant trainee scope. It must not default to organisation-wide access.

## 2. Read the administration dashboard

The `/admin` dashboard summarises only stored data, such as:

- active trainees within your scope;
- completion and average quiz performance;
- assigned and overdue training where due dates exist;
- recent training activity; and
- available modules.

If no relevant records exist, the dashboard should use an empty state, not sample counts. Confirm the active role/scope before interpreting a number.

## 3. Find trainees

Open `/admin/users`.

1. Search by supported name/employee identifier fields.
2. Apply role, account status and progress filters.
3. Review permitted columns such as name, employee number where used, department, role, status, progress and latest activity.
4. Clear filters before concluding that a user is missing.

Filters never expand underlying permission scope. A manager cannot retrieve another department merely by entering its user ID or filter value.

## 4. Review and manage modules

Open `/admin/training`.

The proportionate module controls may include:

- title and description;
- estimated duration and difficulty;
- catalogue ordering; and
- publish/unpublish state.

Only an authorised administrator should publish or unpublish module content. Review the full learning activity, quiz and answer configuration before publication. A module cannot be unpublished or archived while any assignment is `assigned` or `in_progress`; first cancel/reassign active work under the approved process. The database uses the same guard for trusted and direct updates and serialises assignment/withdrawal races. Prefer controlled unpublish/archive to deleting a module with history.

The three seeded published core modules are Hazard Perception & Unsafe Acts, Manual Handling and Working at Height. Any future module must remain clearly planned/unpublished until genuinely implemented and tested.

## 5. Assign training

Open `/admin/assignments`.

1. Choose a trainee within your authorised scope.
2. Choose a valid module.
3. Add an optional due date and the supported initial status.
4. Review the target and submit once.
5. Wait for genuine confirmation and verify the assignment appears.

The record stores the trainee, module, original assigning user/time, optional due date/notes and status. The user/module pair is unique: assigning the same pair again updates due date/notes in the existing row instead of adding a duplicate. The guard preserves original audit attribution and existing `in_progress`/`completed` state plus completion time. New/reactivated assignments require a currently published module for managers and administrators alike; cancelled work cannot be reactivated after withdrawal. Authenticated deletion is unavailable—cancel to preserve history. Invalid/out-of-scope actions are rejected. Do not interpret animation as confirmation.

## 6. Review progress

Use the user view or relevant progress/assignment area to inspect module state.

Safety360 applies this rule:

```text
module complete = required learning/activity complete
                  AND a submitted quiz percentage >= 70

overall denominator = non-cancelled assigned modules when any exist
                      otherwise published modules
```

When following up, distinguish `not started`, `in progress/review`, `complete` and overdue assignment state. Cancelled assignments are excluded from the active pathway/overdue interpretation. Do not edit a trainee’s score merely to clear an overdue status; investigate the underlying attempt/activity and use the defined retraining process.

## 7. Review assessments

Open `/admin/results`.

1. Filter by the supported user, module, status or period controls.
2. Review the stored server-derived activity score, quiz score/maximum/percentage, combined points, pass/review state, achievement where applicable and attempt time.
3. Retain earlier attempts when a trainee retries; they are historical learning records.
4. Use a follow-up/retraining decision appropriate to the employer’s policy.

The scoped result function permits the owning trainee, same-department manager or administrator and remains available for historical attempts after module withdrawal. It returns result/module identifiers, score/activity/points and times only; it omits submitted answers, feedback and keys. Managers should see same-department attempts only. Correct answer keys remain private and should not be copied into reports, browser tools or messages.

## 8. Use reports

Open `/admin/reports` for basic reporting:

- completion and module completion rate;
- quiz performance;
- overdue assignments; and
- users requiring review/retraining.

Apply filters deliberately and read the associated text/table equivalent, not colour alone. The report is generated through the trusted scoped summary function and quiz indicators use the latest attempt per relevant user/module rather than mixing every retry into the same current-state figure. With no latest attempts, average quiz percentage is unavailable/null rather than an invented zero. Cancelled assignments are excluded from overdue/active-assignment calculations. An empty result is valid. Safety360 reporting is operational training support; it does not prove legal compliance or replace risk assessment, competence assessment or incident reporting systems.

No production report export, client KPI history or stakeholder-approved threshold is claimed unless the live implementation and evidence explicitly add it.

## 9. Manage roles and status safely

Role changes are high-impact operations.

1. Confirm the person’s identity and business authorisation outside the application.
2. Review their current department, role and status.
3. Choose only the minimum role needed.
4. Confirm the change through an authorised administrator/trusted operation.
5. Ask the user to sign out/in if required and test one allowed and one denied route.

Never:

- share an administrator account;
- promote a user through browser developer tools or editable registration metadata;
- expose a Supabase service-role key in the application or any `NEXT_PUBLIC_` variable;
- grant manager access without a valid department under the current B6 scope model; or
- weaken/disable RLS to make an action appear to work.

The first administrator is promoted through the controlled setup procedure in `docs/setup/SUPABASE_SETUP.md`, after normal registration. Employee number and department are protected administrative fields, not trainee self-service; assign manager departments through an authorised administrative/bootstrap process because that value controls data scope. The current administrator user action covers trusted role/status changes. Record who authorised a production promotion according to organisational policy; do not commit credentials.

## 10. Sign out

1. Finish or cancel any pending management action.
2. Choose **Sign out**.
3. Confirm that the application returns to public authentication.
4. Directly revisiting `/admin` should require authentication again.

Use a personal account and sign out before leaving a shared device.

## Operational troubleshooting

| Problem | Action |
| --- | --- |
| `/admin` is unauthorised | Confirm the user registered successfully, has a linked profile, and was promoted through a trusted operation. Refresh after signing out/in. |
| Manager sees no trainees | Confirm the manager and intended trainees have the exact appropriate department value; missing department does not widen scope. |
| Manager sees another department | Treat as a security incident: stop, capture minimal non-sensitive evidence, disable affected access if authorised and investigate RLS before continuing. |
| Assignment/module action fails | Read the validation/permission message; check target scope, existing assignment, module state and migration version. Do not disable policy. |
| Dashboard values are zero | Clear filters and verify seed/accounts/activity exist. Do not replace zero with demonstration numbers. |
| Quiz result differs from expectation | Preserve the attempt ID and inputs privately; review seeded question/key and `submit_quiz` behaviour at the trusted boundary. Never expose the whole answer-key table to a trainee. |
| Recovery email returns to localhost/wrong site | Correct Supabase Site URL/redirect allow-list and Vercel environment URL, then request a new recovery link. |
| Reports fail remotely | Verify all three migrations, grants/functions and seed were applied to the same project referenced by environment variables. |

## Privacy and evidence practice

- Use dedicated non-production demo accounts and fictitious employee data for demonstrations.
- Do not commit passwords, recovery links, access tokens or service-role secrets.
- Keep screenshots free of unnecessary emails/employee numbers.
- Log real test results and client feedback only; an implementation decision is not client approval.
- Define production retention, offboarding and privacy procedures with the organisation before real employee use.
