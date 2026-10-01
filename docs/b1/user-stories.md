# B1 User Stories

## Scope and conventions

These stories describe IFI Safety360 for the client context **Logistics and Warehousing Company (Automotive Sector)**. “Manager” means a Health & Safety Manager whose management views are restricted to relevant trainees in the same department. An administrator has wider authorised management capability. Acceptance criteria are specifications, not recorded test results.

## Authentication and account stories

### US-01 — Register as a trainee

**As a** new employee, **I want** to register with my email and password **so that** I can use assigned safety training.

Acceptance criteria:

- Given valid registration data, when the form is submitted, then Supabase Auth creates or begins verification of the account according to the configured email policy.
- A new application profile defaults to `trainee`; no registration control offers `manager` or `admin`.
- Invalid input and service errors are announced in clear text and do not expose secrets.

### US-02 — Sign in, persist a session and sign out

**As a** registered user, **I want** secure sign-in and sign-out **so that** my training area remains personal.

Acceptance criteria:

- Valid credentials establish a Supabase session and send the user to an area allowed by their trusted role.
- A valid session survives an ordinary refresh; an expired or missing session returns the user to sign-in.
- Sign-out clears the application session and protected routes no longer render private content.

### US-03 — Recover access

**As a** registered user, **I want** a password-recovery flow **so that** I can regain access without staff seeing my password.

Acceptance criteria:

- The recovery form requests a Supabase recovery link without confirming whether an arbitrary address belongs to an account.
- A valid recovery callback can open `/reset-password` and accept a policy-compliant replacement.
- Used, invalid and expired links produce a safe recovery option.

## Trainee training stories

### US-04 — Understand my dashboard

**As a** trainee, **I want** a concise dashboard **so that** I can see what to do next.

Acceptance criteria:

- The dashboard shows assigned training, progress, next action, latest assessment, points, rank, achievements and recent activity when data exists.
- A new trainee sees genuine zero/empty states, never invented activity or percentages.
- Only the signed-in trainee’s protected records are requested.

### US-05 — View assigned training and the library

**As a** trainee, **I want** to distinguish assigned and published modules **so that** I can prioritise required work.

Acceptance criteria:

- Assigned modules show due/status information when present; published modules remain discoverable as permitted.
- Overall progress uses non-cancelled assigned modules as its denominator when any exist; cancelled assignments are excluded and otherwise published modules are used.
- Unpublished modules are not available to ordinary trainees.

### US-06 — Complete Hazard Perception

**As a** trainee, **I want** to identify realistic warehouse hazards **so that** I can practise recognising risk and corrective action.

Acceptance criteria:

- The activity covers the seven specified hazards and explains hazard, risk, consequence and safer action.
- A hazard awards points only once in an attempt/session and persisted completion prevents duplicate credit.
- Completion feedback is professional and does not imply accreditation.

### US-07 — Use the immersive 360 scene

**As a** trainee, **I want** to inspect a 360° warehouse **so that** hazard recognition has spatial context.

Acceptance criteria:

- The Three.js/WebGL code and panorama load only when the scene is entered.
- Pointer, touch and practical keyboard controls are supported without rapid flashing.
- A scene loading state uses real readiness or an indeterminate indicator, not a fake percentage.

### US-08 — Use the equivalent Hazard List View

**As a** trainee who cannot or does not wish to use WebGL, **I want** an accessible list **so that** I can achieve equivalent learning and completion.

Acceptance criteria:

- Every one of the seven hazards is reachable by keyboard and exposes the same explanation.
- The list can record the same learning completion without requiring use of the panorama.
- The alternative is clearly available and offered when WebGL cannot initialise.

### US-09 — Practise Manual Handling

**As a** trainee, **I want** scenario decisions about lifting and moving loads **so that** I can rehearse safer choices.

Acceptance criteria:

- Content covers assessment, planning, posture, lifting, carrying, setting down and mechanical/team assistance.
- Five decisions provide immediate choice-specific feedback and an explanation.
- The trusted boundary validates the scenario/choice against a private answer map, preserves the first recorded choice and derives 100/0 points; caller-supplied scores/progress are ignored.
- A quiz and result follow the activity.

### US-10 — Practise Working at Height

**As a** trainee, **I want** scenario decisions about access equipment and work areas **so that** I can rehearse safer choices.

Acceptance criteria:

- Content covers equipment selection/inspection, stable placement, overreach, exclusion areas, falling objects and defect reporting.
- Five decisions provide immediate feedback and explanation.
- The trusted boundary validates the scenario/choice against a private answer map, preserves the first recorded choice and derives 100/0 points; caller-supplied scores/progress are ignored.
- A quiz and result follow the activity.

### US-11 — Complete a protected quiz

**As a** trainee, **I want** immediate authorised quiz feedback **so that** I understand mistakes without the answer bank being exposed.

Acceptance criteria:

- Questions appear one at a time with progress, selected state and an explicit submit action.
- Questions load without authored explanations. The first valid checked selection is privately locked for two hours; an identical repeat is safe, a changed answer is rejected, and only then is that question’s authorised correctness/explanation returned.
- A complete submission must match every unexpired lock before trusted scoring stores the immutable attempt and clears its locks. The client does not receive answer keys or lock rows.
- The result uses the project threshold of 70% and is described as an application outcome, not certification.

### US-12 — Review results and progress

**As a** trainee, **I want** persisted results and progress **so that** I can understand my next action across sessions.

Acceptance criteria:

- A result identifies module, activity/quiz outcome where available, percentage, pass/review state and next action.
- A module completes only after its required learning/activity and a submitted quiz at or above 70%.
- Retrying does not erase the integrity of stored attempts.

### US-13 — View achievements and leaderboard

**As a** trainee, **I want** restrained recognition **so that** I can see milestones without exposing personal information.

Acceptance criteria:

- Achievements appear only after their stored criteria are met.
- The leaderboard derives from persisted points/completions and identifies the current trainee.
- Public rows use display names and never reveal email addresses or protected employee details.

### US-14 — Maintain my profile and get help

**As a** trainee, **I want** to edit safe profile fields and read guidance **so that** the application remains useful and understandable.

Acceptance criteria:

- A trainee can update only `full_name`. Email is owned by the account provider, while employee number, department, role, status and account ID are read-only/protected; department cannot be self-edited because it controls manager visibility.
- Help explains navigation, the 360 controls, the list alternative and recovery options.
- Errors provide an actionable next step.

## Management and administration stories

### US-15 — Monitor relevant trainees

**As a** Health & Safety Manager, **I want** a department-scoped view of completion and results **so that** I can follow up relevant training.

Acceptance criteria:

- The manager’s trusted role and department are checked before protected data is returned.
- Search and role/status/progress filters cannot widen the manager beyond their department.
- The manager is not silently treated as an unrestricted administrator.

### US-16 — Manage users securely

**As an** administrator, **I want** to search and maintain relevant user information **so that** account status and responsibilities remain accurate.

Acceptance criteria:

- The user view supports name, employee number where used, department, role, status, progress and last activity; the current in-application mutation contract changes role/status only.
- Role/status changes are authorised at a trusted boundary; employee number/department provisioning remains a separate authorised administrative/bootstrap process and no browser-only check is relied upon.
- Destructive or privileged changes require clear confirmation and return a success/error result.

### US-17 — Assign training

**As an** authorised manager or administrator, **I want** to assign modules with due dates **so that** trainees have a clear training plan.

Acceptance criteria:

- An assignment records trainee, published module, assigning user/date, optional due date/notes and status.
- A trainee can read only their own assignment records.
- The `(user,module)` pair remains unique. Reassigning updates due date/notes while preserving original attribution and in-progress/completed system state. Cancellation preserves history; authenticated deletion is unavailable. Insert/reactivation against an unpublished module and invalid/out-of-scope targets are rejected.

### US-18 — Manage module availability

**As an** administrator, **I want** proportionate module controls **so that** only ready training is published.

Acceptance criteria:

- Authorised controls cover metadata, duration, difficulty, order and published status without becoming a general CMS.
- Unpublished material is withheld from ordinary trainee library queries and cannot receive/reactivate assignments.
- Unpublish/archive is rejected while assigned/in-progress work exists, under a shared transactional module lock.
- Changes are validated and recorded appropriately.

### US-19 — Review assessments and reports

**As an** authorised manager or administrator, **I want** completion, assessment, overdue and review summaries **so that** I can identify follow-up needs.

Acceptance criteria:

- Metrics come from non-cancelled assignments, progress and latest attempts; no latest attempt yields an unavailable/null average rather than an invented zero.
- Manager results are department-scoped; administrator results follow the wider authorised policy.
- Result detail is publication-independent and omits submitted answers, feedback and keys.
- Every chart-like summary has a meaningful text/table equivalent.

## Cross-cutting accessibility story

### US-20 — Operate Safety360 accessibly

**As a** keyboard, touch or reduced-motion user, **I want** equivalent access **so that** presentation choices do not block training.

Acceptance criteria:

- Pages use logical headings, labelled controls, visible focus, sufficient contrast, useful errors and suitable touch targets.
- Dialogs/drawers manage focus and close by appropriate keyboard controls; important state is not communicated by colour alone.
- `prefers-reduced-motion` disables non-essential movement, stagger, pulse and counting while leaving immediate state changes.
