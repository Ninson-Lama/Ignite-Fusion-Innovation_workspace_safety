# B1 System Flows

## Authentication flow

```mermaid
flowchart TD
    A["Open Safety360"] --> refresh["Next proxy refreshes Supabase session when possible"]
    refresh --> B{"Supabase session available?"}
    B -->|"No"| C["Public landing / sign-in"]
    C --> D["Submit validated email and password"]
    D --> E["Supabase Auth verification"]
    E -->|"Rejected"| F["Accessible generic error and retry"]
    E -->|"Accepted"| G["Load trusted profile and role"]
    B -->|"Yes"| G
    G -->|"Missing/inactive"| H["Safe access error / support path"]
    G -->|"trainee"| I["Protected trainee dashboard"]
    G -->|"manager"| J["Department-scoped management view"]
    G -->|"admin"| K["Authorised administration view"]
```

The client never submits an authoritative role. Page-level routing provides prompt feedback, while RLS/trusted database functions remain the data boundary.

## Registration and recovery

```mermaid
flowchart LR
    register["Register form"] --> validate["Validate fields"]
    validate --> signup["Supabase signUp"]
    signup --> confirm{"Email confirmation configured?"}
    confirm -->|"Yes"| email["User follows verification callback"]
    confirm -->|"No"| session["Session available"]
    email --> session
    session --> profile["Trusted trigger creates trainee profile"]
    profile --> dashboard["Authorised dashboard"]

    forgot["Forgot password"] --> request["Supabase recovery request"]
    request --> link["Recovery callback"]
    link --> reset["Validate replacement on /reset-password"]
    reset --> signin["Sign in / authorised continuation"]
```

Invalid or expired callbacks do not change a password and offer a new recovery request. The UI should not reveal whether an arbitrary email is registered.

## Training and scoring flow

```mermaid
flowchart TD
    A["Dashboard"] --> B["Assigned training / library"]
    B --> C["Module introduction"]
    C --> D["Read content and record trusted learning completion"]
    D --> E["Complete server-validated interactive activity"]
    E --> F["Quiz: select one question answer"]
    F --> G["Trusted check validates and locks first selection for 2 hours"]
    G -->|"changed answer"| H["Reject safely; keep first lock"]
    G -->|"valid / identical repeat"| I["Return this question's permitted feedback"]
    H --> F
    I --> J{"All active questions checked?"}
    J -->|"No"| F
    J -->|"Yes"| K["Submit complete answer map"]
    K --> L["Require exact unexpired locks and read protected keys"]
    L --> M["Calculate and store immutable attempt; clear locks"]
    M --> N{"Learning + activity + passed quiz?"}
    N -->|"Yes"| O["Set 100% complete and reconcile assignment/points"]
    N -->|"No"| P["Keep in progress or review state"]
    O --> Q["Evaluate genuine achievements"]
    P --> R["Permitted feedback and next/retry action"]
    Q --> S["Scoped answer-free result and next action"]
    R --> S
```

If the trainee has non-cancelled assignments, overall progress is completed assigned modules divided by those assigned modules. Cancelled assignments are excluded. If none remain, published modules form both numerator eligibility and denominator. A zero denominator produces an empty state.

## Decision-activity integrity flow

```mermaid
flowchart TD
    load["Open decision activity"] --> hydrate["Hydrate saved scenario choices from activity log"]
    hydrate --> scenario["Manual Handling / Working at Height scenario"]
    scenario --> choose["Trainee submits scenario ID + selected choice ID"]
    choose --> rpc["Trusted activity function ignores caller progress/score"]
    rpc --> key["Validate module/scenario/choice against private server key"]
    key -->|"invalid"| reject["Reject; no progress or points"]
    key -->|"valid first event"| derive["Derive correct/wrong and 100/0 points"]
    key -->|"duplicate canonical event"| existing["Keep first stored decision unchanged"]
    derive --> safe["Store sanitised metadata only"]
    safe --> attempted{"All 5 distinct scenarios attempted?"}
    existing --> attempted
    attempted -->|"No"| scenario
    attempted -->|"Yes"| complete["Set activity_complete; maximum activity score 500"]
```

Activity completion records participation in all five decisions, not a perfect score. Module completion still requires learning completion and a passed quiz. Manual Handling has a 700-point perfect combined activity/quiz total; Working at Height has 750.

## Hazard Perception flow

```mermaid
flowchart TD
    intro["Hazard module introduction"] --> choice{"Choose learning view"}
    choice --> hydrate["Hydrate previously saved hazard events"]
    hydrate -->|"360 scene"| lazy["Lazy-load Three.js and panorama"]
    lazy --> ready{"WebGL and asset ready?"}
    ready -->|"Yes"| scene["Inspect scene via pointer/touch/available keyboard control"]
    ready -->|"No"| offer["Explain failure and offer equivalent list"]
    hydrate -->|"Hazard List View"| list["Keyboard-operable seven-hazard list"]
    offer --> list
    scene --> select["Select a hazard"]
    list --> select
    select --> unique{"Already confirmed?"}
    unique -->|"Yes"| noPoints["Show reviewed state; award nothing again"]
    unique -->|"No"| save["Persist configured hazard ID at trusted boundary"]
    save -->|"failure"| retry["Do not confirm; show safe retry"]
    save -->|"success"| feedback["Hazard + risk + consequence + corrective action"]
    feedback --> mark["Confirm saved found state and unique credit"]
    noPoints --> all{"All seven confirmed?"}
    mark --> all
    all -->|"No"| hydrate
    retry --> hydrate
    all -->|"Yes"| quiz["Continue to quiz; server has marked activity complete"]
```

The two views have the same seven-hazard learning outcome. Visual hotspots are not required for completion when WebGL is inaccessible.

## Administration flow

```mermaid
flowchart TD
    A["Open /admin area"] --> B["Resolve Supabase session"]
    B --> C{"Trusted role"}
    C -->|"trainee / none"| D["Unauthorised state; no protected query"]
    C -->|"manager"| E["Apply same-department scope"]
    C -->|"admin"| F["Apply administrator policy scope"]
    E --> G["Dashboard / users / assignments / results / reports"]
    F --> G
    G --> H["Search, filter or choose authorised action"]
    H --> I["Validate identifiers and payload"]
    I --> guard{"Assignment / module lifecycle action?"}
    guard -->|"assignment"| history["Upsert or cancel; never client-delete history"]
    guard -->|"unpublish/archive"| active["Serialise with assignments; reject if active work exists"]
    guard -->|"other"| J["RLS / trusted function verifies actor again"]
    history --> J
    active --> J
    J -->|"Rejected"| K["Safe error; database unchanged"]
    J -->|"Accepted"| L["Supabase query/mutation"]
    L --> M["Genuine confirmation and refreshed data"]
```

Manager search/filter inputs cannot widen the department policy. A missing manager department must resolve to no relevant trainees, not global access.

## Reporting flow

```mermaid
flowchart LR
    actor["Authorised manager/admin"] --> scope["Resolve role and data scope"]
    scope --> filters["Validate module/status/date filters"]
    filters --> data["Assignments + progress + attempts"]
    data --> latest["Select latest attempt per relevant user/module"]
    latest --> aggregate["Completion, score, overdue and review aggregates"]
    aggregate --> output["Accessible summary + table equivalent"]
    aggregate -->|"no latest attempts"| unavailable["Average quiz percentage = null / unavailable"]
    data -->|"no rows"| empty["Honest empty state"]
    data -->|"query failure"| error["Error and retry; no fake metric"]
```

## Sign-out and route-protection flow

```mermaid
sequenceDiagram
    participant U as User
    participant N as Next application
    participant S as Supabase Auth
    participant D as PostgreSQL/RLS
    U->>N: Choose sign out
    N->>S: Invalidate session
    alt sign-out succeeds
      S-->>N: Session removed
      N-->>U: Return to public sign-in
      U->>N: Request protected route
      N-->>U: Redirect/unauthorised without private data
    else service error
      S-->>N: Failure
      N-->>U: State that sign-out did not complete; allow retry
    end
    Note over N,D: A later database request without a valid JWT is also denied by RLS.
```

## Error and recovery rules

- Loading states describe genuine work; the 360 scene uses real readiness or an indeterminate loader, never a fake percentage.
- Authentication, validation, network, not-found and unauthorised failures have distinct messages without leaking database detail.
- A UI success state appears only after the underlying operation returns success.
- Interrupted quiz/activity writes do not claim completion; the trainee receives a safe retry action.
- Reduced-motion mode changes presentation timing only, never the state-machine outcome.
