# IFI Safety360 Trainee User Guide

## About this guide

Safety360 provides interactive workplace health-and-safety learning for the client context **Logistics and Warehousing Company (Automotive Sector)**. It is a training application, not an accreditation, regulator approval or guarantee that incidents will be prevented. Follow the employer’s current risk assessments, procedures, supervision and emergency arrangements.

These instructions assume that an administrator has connected Supabase, applied the database migrations/seed and configured authentication redirects. Registration, sign-in, persistence and role-protected data require the documented local or canonical Vercel/Supabase setup.

## 1. Register

1. Open the final application URL supplied by the project administrator and choose **Register**, or open `/register`.
2. Enter the requested name, work email and password fields.
3. Review any password guidance, then submit once.
4. If email confirmation is enabled, open the Supabase verification email and follow its link in the same browser.
5. Continue to sign-in when prompted.

Every public registration becomes a `trainee`. You will never be asked to choose `manager` or `admin`. Contact an authorised administrator if your email is wrong or your role has a legitimate business reason to change; never share your password.

## 2. Sign in and recover a password

1. Open `/login`.
2. Enter the email used for registration and your password.
3. Choose **Sign in**. A valid trainee session opens the protected workspace.
4. If you have forgotten the password, use **Forgot password** or `/forgot-password`.
5. Submit your email and follow the recovery link. On `/reset-password`, enter and confirm the replacement.

For privacy, recovery may show the same confirmation whether or not an email is registered. An expired or used link requires a new request. Do not forward recovery links.

## 3. Understand the dashboard

The dashboard at `/dashboard` prioritises:

- the next assigned or available module;
- assigned training and due information where present;
- overall progress and completed modules;
- latest assessment;
- safety points, rank and earned achievements; and
- recent training activity.

A fresh account should show 0% progress, zero completions and zero points until real activity is stored. An empty area is not an error by itself. If you have non-cancelled assignments, progress is based on those modules. Cancelled assignments are excluded; if none remain, progress is based on the currently published modules.

Safety points use your privacy-limited leaderboard total when available, including genuinely earned achievement bonuses. If that snapshot is unavailable, the dashboard can fall back to stored module points; it does not invent a bonus.

## 4. Browse training

Open `/training` from the main navigation. The three core modules are:

1. **Hazard Perception & Unsafe Acts**;
2. **Manual Handling**; and
3. **Working at Height**.

An assigned module may show due/status information. Published modules may also be available in the library. A planned or unpublished module is not a completed product feature and may not be openable.

## 5. Start and complete a module

1. Open a module preview.
2. Review the objectives, estimated duration, difficulty and current progress.
3. Read the learning section in order.
4. Complete the interactive activity.
5. Complete the quiz and review the result.

A module becomes complete only when its required learning/activity is complete and its submitted quiz score reaches the project threshold of 70%. A result below 70% indicates review/retry within this application; it is not a formal pass/fail certification decision.

## 6. Use the Hazard Perception 360 scene

From the Hazard Perception module, open the 360 scene at `/training/hazard-perception/scene`.

### Controls

- **Mouse/trackpad:** drag or use the provided scene controls to look around; activate a hazard target to inspect it.
- **Touch:** drag to look where supported; tap a target once.
- **Keyboard:** use any on-screen, focusable hazard controls provided. If spatial controls are uncomfortable or unavailable, switch to **Hazard List View**.

The scene lazily loads Three.js/WebGL and `warehouse-panorama.png`, so a dedicated preparing state may appear. It uses real readiness or an indeterminate indicator, not a fake percentage.

### The seven hazards

You are looking for:

1. liquid spill;
2. obstructed emergency exit;
3. unsafe manual handling;
4. forklift/pedestrian conflict;
5. unsafe stacking;
6. unsafe working at height; and
7. missing PPE.

Open the feedback for each hazard and read its risk, possible consequence and safer corrective action. A hazard is marked confirmed only after the database accepts the save; confirmed hazards are restored when the activity is reopened. A hazard can be credited only once, so repeatedly selecting the same target does not award more points.

## 7. Use the Hazard List View

The list is an equivalent way to complete the seven-hazard learning activity. Use it when:

- you prefer keyboard/text interaction;
- WebGL or the panorama does not load;
- movement in the scene is uncomfortable; or
- a touch/pointer device makes targets difficult to select.

Choose **Hazard List View**, move through the seven labelled items with Tab/Shift+Tab, and activate each item with Enter or Space as supported by its native control. Read the full feedback and confirm the item. Text indicates found/reviewed state, so colour is not the only cue. Completing the list should satisfy the same activity requirement as the scene when persistence is configured.

## 8. Complete interactive decisions

Manual Handling and Working at Height each present five workplace decisions.

1. Read the entire scenario and every choice.
2. Select the safest response based on the module content and workplace procedure.
3. Submit the decision if a separate submit control is shown.
4. Read the immediate explanation, including why an option is safer or unsafe.
5. Continue only after you understand the feedback.

The first successfully stored choice for a scenario is authoritative and is restored when you reopen the activity. The server checks the scenario/choice against a private map and awards 100 points for a correct first choice or zero for a wrong first choice; selecting a different option later cannot rewrite the score. Attempting all five distinct scenarios completes the activity, while a perfect activity score is 500. Browser-supplied progress or point values are not trusted.

Your employer’s site procedure takes priority when a generic scenario differs from actual equipment, load, environment or supervision.

## 9. Complete a quiz

1. Open the module quiz, normally at `/training/[module-slug]/quiz`.
2. Read one question at a time and select an answer.
3. Use **Submit** to request authorised feedback. For a multi-select question, select every answer you intend before checking it.
4. Read the explanation before moving to the next question.
5. Complete all questions to create the final attempt/result.

Questions include single-choice, multi-select, true/false and scenarios. Correct keys are kept at a trusted database boundary rather than sent as a complete answer bank to the browser. The first valid checked selection for each question is locked for two hours: checking the same selection again is safe, but changing it after seeing feedback is rejected. The final attempt must exactly match every unexpired lock; after a successful attempt the locks clear so a legitimate retry can begin. Do not refresh while a submission is in progress. If an error appears, follow its retry guidance rather than assuming the attempt was saved.

## 10. Read a result

The result route `/results/[attemptId]` shows the module, server-derived activity points, quiz score/maximum/percentage, combined points, 70% threshold state, earned achievement where applicable and safe next actions.

Only your result should be accessible. Historical own results remain reviewable even if a module is later withdrawn; the scoped response does not include your submitted answer map, private feedback rows or keys. Possible next actions include reviewing learning, retrying where permitted, returning to progress/dashboard or starting the next module. A result is an internal learning record and should not be described as an externally accredited certificate.

## 11. Review progress and achievements

Open `/progress` to review module states and the overall calculation. Open `/achievements` for milestones genuinely stored against your account.

- `Not started` means no stored required activity.
- `In progress` or `Review` means one or more completion conditions remain.
- `Complete` means the required learning/activity and a quiz at or above 70% have been recorded.

If a value looks stale, refresh once after allowing a completed save to finish. Report persistent discrepancies rather than repeating actions to gain points.

## 12. Use the leaderboard

Open `/leaderboard` to see persisted rank, display name, points, completed modules and recognition. Your row should be highlighted. The board should not show email addresses or protected employee details.

The leaderboard is motivational only. It does not replace competence assessment, supervision or site safety performance. If you do not recognise a display name or believe private information is visible, stop and report it to the administrator.

## 13. Update the profile and find help

Open `/profile` to update your full display name. Work email is owned by the account provider. Employee number and department are read-only, administrator-managed fields; department is protected because it controls which manager can see your training records. Role, status and account ID are also read-only. Use `/help` for navigation, scene, accessibility and recovery guidance.

Never enter sensitive medical details, passwords, answer keys or unnecessary personal data into profile fields.

## 14. Sign out

1. Finish or safely leave any activity currently saving.
2. Use **Sign out** in the application navigation/profile menu.
3. Confirm that the public sign-in page appears.
4. On a shared device, close the browser after successful sign-out.

Do not treat simply closing a tab as equivalent to sign-out on a shared device.

## 15. Troubleshooting

| Problem | Safe next step |
| --- | --- |
| Registration/sign-in reports service configuration | Confirm the deployed app has Supabase variables and migrations; contact the administrator. There is no insecure demo-login bypass. |
| Confirmation/recovery link opens the wrong host | Request a new link after the administrator fixes Supabase Site URL and redirect allow-list. |
| Scene stays on preparing | Wait for genuine asset loading, then use the clearly available Hazard List View. Check WebGL/browser support and network without losing the learning route. |
| Motion causes discomfort | Enable **Reduce motion** in the operating system/browser, then reload. Use Hazard List View if scene movement remains unsuitable. |
| A target cannot be activated | Use the keyboard-visible control/list alternative; do not repeatedly tap. Record browser/device details for support. |
| Progress did not save | Keep the result/error visible, check connectivity, retry only when invited and report module/time. Do not claim completion without confirmation. |
| Another person’s data appears | Stop using the page, do not copy/share it, sign out and report it immediately as a privacy/security issue. |
| Health-and-safety advice conflicts with site procedure | Stop and follow the employer’s approved procedure/supervision; report the content discrepancy. |

For useful support, provide the route, approximate time, browser/device, visible error text and action taken. Never send a password, recovery link, session token or private answer data.
