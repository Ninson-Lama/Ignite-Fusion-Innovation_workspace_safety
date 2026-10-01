# B1 UI Design Specification

## Design intent

Safety360 should feel like a professional interactive safety-training product for automotive warehousing and logistics: precise, industrial, modern, spacious and practical. It is neither a generic card-heavy SaaS dashboard nor a game, student template or corporate brochure.

**The external logistics website was used only as general visual inspiration and its assets/design were not copied.**

No third-party Commonwealth photography, branding, layout, components, wording, HTML or CSS is included. The generated warehouse panorama and code-native industrial visuals are original project assets. The monochrome IFI flame and Ignite Fusion Innovation wordmark supplied by the user are used on the public landing page; Safety360 remains the product identity around that supplied organisation mark.

## Composition principles

The public/auth and module-introduction rhythm is:

```text
large industrial visual
→ concise high-impact heading
→ short practical explanation
→ one clear action
→ generous content space
```

Application views combine a dark stable navigation rail, stronger feature areas and restrained metric panels. Not every datum is placed in a floating card. Tables, split layouts, progress strips, image-led module previews and full-width states are chosen according to information type.

The implementation uses a hybrid styling model in `app/globals.css`: Tailwind CSS 4 `@theme` exposes shared product tokens and generated utilities used by live markup, while bespoke industrial component/layout selectors implement the richer application system. Neither layer should be described as the whole design architecture on its own.

## Colour system

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#071B2B` | Primary navigation, deep emphasis, loader |
| Deep navy | `#0B263D` | Industrial surfaces and scene UI |
| Industrial blue | `#0B5E96` | Secondary brand/action emphasis |
| Primary blue | `#087CB8` | Main buttons, links, active navigation |
| Bright interaction blue | `#18A7D8` | Focus-support accents, selected technology states |
| Pale blue | `#EAF5FA` | Informational surface |
| Off-white | `#F7F9FA` | Page background |
| Pure white | `#FFFFFF` | Content surface and inverse text |
| Graphite | `#18232D` | Main body text |
| Secondary text | `#63717C` | Supporting text; must retain contrast at use size |
| Steel border | `#D5DEE4` | Dividers and input boundaries |
| Safe | `#15803D` / `#DCFCE7` | Correct, completed, passed, safe |
| Warning | `#D97706` / `#FEF3C7` | Caution or attention required |
| Hazard | `#DC2626` / `#FEE2E2` | Actual danger or incorrect safety choice |
| Information | `#2563EB` | Non-hazard information |

Red is never decorative. Green, amber and red are paired with icons/text, so state is not communicated by colour alone.

## Typography

- Geist Sans is loaded through `next/font` for interface and learning copy.
- Geist Mono is reserved for small technical labels, scene status and selected numerical detail.
- Hero headings generally use weight 600–700 with tight but readable tracking; body copy uses 400–500 and generous line height.
- Interfaces use no more than these two families and avoid blanket 900-weight headings.
- Headings follow a logical document hierarchy regardless of visual size.

## Spacing, surfaces and shape

- A practical 4/8px rhythm informs gaps and padding, with larger 24, 32, 48, 64 and 96px intervals for section hierarchy.
- Content uses white/off-white/pale-blue areas, steel dividers and restrained shadows.
- Typical radius is 8–14px; pills are reserved for compact statuses rather than entire layouts.
- Touch controls target approximately 44px or more.
- Blur/glass effects and gradients, where present in an industrial hero/loader, remain restrained and do not reduce text contrast.

## Navigation

### Desktop

- A dark navy sidebar provides a stable application landmark.
- The current page has a textual and visual active state; transitions do not change layout width.
- Trainee and permitted administration areas are clearly separated.

### Mobile and tablet

- A compact top bar exposes an accessible menu trigger.
- The drawer backdrop fades and the drawer moves a short distance without delaying navigation.
- Focus moves into the drawer, remains contained while appropriate, returns to the trigger, and Escape closes it.

Public authentication pages use a lighter header and an industrial visual/form split that stacks on smaller screens.

## Page patterns

| Area | Hierarchy |
| --- | --- |
| Initial entry | IFI/Safety360 mark, concise product statement, industrial warehouse feature, sign-in/register actions. |
| Authentication | Industrial context on one side; labelled, focused form task on the other; generic safe errors. |
| Trainee dashboard | Greeting and next action first, then progress/assignment context, latest result, points/achievements/activity. Empty values remain zero/empty. |
| Training library | Large core-module previews, assignment/publication state, progress and one clear continuation action. |
| Module introduction | Visual, objectives, duration/difficulty, current state and learning/activity/quiz sequence. |
| Quiz | One question, explicit progress, grouped answer controls, submit, authorised feedback and explanation. |
| Results/progress | Outcome in text, percentage and criteria, next action; progress bars retain semantic labels. |
| Admin | Scope-aware headline values, strong filters, readable tables and honest empty/error states. |
| Reports | Accessible summary values plus text/table equivalents for any visual encoding. |

## Loading and motion system

| Token | Value | Typical use |
| --- | --- | --- |
| `--motion-fast` | `180ms` | Button, focus-support and small state response |
| `--motion-base` | `320ms` | Drawer, panel and route reveal |
| `--motion-slow` | `650ms` | Major image/section reveal or genuine initial loader sequence |
| `--ease-premium` | `cubic-bezier(0.22, 1, 0.36, 1)` | Primary entrance/exit easing |

- The initial Safety360 loader is shown only while genuine session/application state resolves. It uses dark navy, a static/animated brand mark, thin blue line and “Preparing your training environment”; it is not deliberately held and never shows fake progress.
- Ordinary route/data loading uses skeletons shaped like the eventual dashboard, module, progress, leaderboard or table content.
- Page reveals use a small opacity/vertical change; button hover is at most `translateY(-1px)`, press may use `scale(.98)`, and cards may rise about 2px.
- Numbers and progress animate only to values already known from real data, and only on appropriate initial presentation.
- Completion feedback uses a check/state panel. Excessive confetti, bouncing logos and rapidly flashing hotspots are excluded.

### Reduced motion

`prefers-reduced-motion: reduce` removes scroll behaviour, prolonged animation, stagger, scaling, hotspot pulse, image motion and animated counting. Final values and essential state changes appear immediately. Reduced motion must never postpone or block navigation or training completion.

## Immersive scene design

- The scene uses lazy-loaded Three.js/WebGL and the original generated 2:1 asset `public/warehouse-panorama.png`.
- The scene loader says that the warehouse environment is preparing and uses real readiness or an indeterminate indicator.
- Hotspots are stable, high-contrast targets with a slow non-flashing ring when motion is allowed. Selecting a hazard stops the pulse and opens feedback.
- Desktop feedback appears as a right-side panel; small screens use a bottom sheet/dialog pattern with focus handling and Escape support.
- A textual found/not-found label accompanies colour.
- The equivalent Hazard List View contains the same seven explanations, scoring uniqueness and completion outcome; it is clearly reachable without entering WebGL and offered after scene failure.

Three.js was selected instead of A-Frame after the A-Frame dependency tree introduced avoidable high-severity transitive advisories during implementation. The decision reduces dependency exposure while retaining the brief’s justified WebGL option. It is not a claim of perfect security.

## Industrial imagery

Visuals may depict warehouse racking, automotive component crates, pallets, forklifts, loading/inspection areas, pedestrian routes, floor markings, PPE, high-level storage and emergency egress. The visual must not imply it photographs the client’s actual site. Meaningful content imagery receives alt text; decorative grids/shapes are hidden from assistive technology.

## Responsive behaviour

| Viewport context | Expected adaptation |
| --- | --- |
| Wide desktop/laptop | Persistent sidebar, multi-column feature layouts, side feedback panel and full tables. |
| Tablet | Reduced gutters, fewer columns, scroll-safe tables or labelled row layout, touch scene control. |
| Mobile | Single-column content, compact header/drawer, bottom feedback sheet, full-width actions and no clipped form controls. |

Exact breakpoint behaviour is verified by content reflow rather than by device name alone. 360 interaction must not be the only route to its learning outcome.

## Accessibility checklist

- `lang="en"`, skip link, landmarks and logical headings.
- Native buttons, links, form labels/fieldsets and meaningful accessible names.
- Keyboard access and visible `:focus-visible` treatment.
- Errors associated with their fields and announced where appropriate.
- Dialog/drawer focus management and Escape behaviour.
- Contrast checked for actual sizes/states; no colour-only meaning.
- Meaningful alt text; decorative industrial shapes ignored.
- 44px-class touch targets and layouts usable at zoom/reflow.
- Reduced-motion support and no rapid flash.
- Equivalent keyboard Hazard List View.
- Charts/reports include text or table equivalents.

These are design requirements. The testing record remains **Not executed** until genuine browser/assistive-technology checks are documented.

## Screenshot evidence register

No screenshots have been supplied or captured. The following are identifiers and proposed filenames only; they are not evidence until a genuine configured application capture is placed in the evidence location and linked.

| ID | Required view | Proposed evidence filename | Status |
| --- | --- | --- | --- |
| B1-S01 | Login | `B1-S01-login.png` | Pending evidence |
| B1-S02 | Initial Loading Screen | `B1-S02-initial-loading-screen.png` | Pending evidence |
| B1-S03 | Trainee Dashboard | `B1-S03-trainee-dashboard.png` | Pending evidence |
| B1-S04 | Training Library | `B1-S04-training-library.png` | Pending evidence |
| B1-S05 | Hazard Module Intro | `B1-S05-hazard-module-intro.png` | Pending evidence |
| B1-S06 | 360 Scene | `B1-S06-360-scene.png` | Pending evidence |
| B1-S07 | Hazard Feedback | `B1-S07-hazard-feedback.png` | Pending evidence |
| B1-S08 | Manual Handling | `B1-S08-manual-handling.png` | Pending evidence |
| B1-S09 | Working at Height | `B1-S09-working-at-height.png` | Pending evidence |
| B1-S10 | Quiz | `B1-S10-quiz.png` | Pending evidence |
| B1-S11 | Results | `B1-S11-results.png` | Pending evidence |
| B1-S12 | Progress | `B1-S12-progress.png` | Pending evidence |
| B1-S13 | Leaderboard | `B1-S13-leaderboard.png` | Pending evidence |
| B1-S14 | Admin Dashboard | `B1-S14-admin-dashboard.png` | Pending evidence |
| B1-S15 | User Management | `B1-S15-user-management.png` | Pending evidence |
| B1-S16 | Reports | `B1-S16-reports.png` | Pending evidence |
| B1-S17 | Mobile Layout | `B1-S17-mobile-layout.png` | Pending evidence |
| B1-S18 | Accessible Hazard List | `B1-S18-accessible-hazard-list.png` | Pending evidence |

Each final capture should record date, application commit, route, role, viewport and data precondition. Test/demo email addresses or other personal data should be obscured where not relevant.
