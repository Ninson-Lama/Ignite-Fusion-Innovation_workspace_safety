-- IFI Safety360 demonstration content
-- Idempotent content seed only: no auth users, email addresses or passwords.

begin;

insert into public.training_modules (
  id,
  slug,
  title,
  description,
  overview,
  category,
  estimated_minutes,
  difficulty,
  status,
  is_published,
  pass_mark,
  points_available,
  sort_order,
  learning_objectives,
  content,
  scene_config,
  hero_image_path,
  published_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'hazard-perception',
    'Hazard Perception & Unsafe Acts',
    'Practise spotting and responding to common hazards in an automotive warehouse.',
    'Move through a busy warehouse scene, inspect seven risk areas and choose a proportionate first response.',
    'Hazard awareness',
    35,
    'introductory',
    'published',
    true,
    70,
    250,
    10,
    '["Recognise vehicle and pedestrian interface risks","Identify unsafe storage and housekeeping","Choose immediate controls without putting yourself at risk"]'::jsonb,
    '{
      "sections": [
        {"id":"observe","title":"Pause, scan, predict","body":"Scan high and low, notice movement and consider what could change next."},
        {"id":"control","title":"Control the immediate risk","body":"Keep clear, warn others where safe and follow the local reporting procedure."},
        {"id":"report","title":"Report accurately","body":"Describe the location, hazard and immediate controls without including unnecessary personal information."}
      ],
      "accessibleAlternative": true,
      "hazardCount": 7
    }'::jsonb,
    '{
      "type":"threejs-webgl",
      "panoramaPath":"/warehouse-panorama.png",
      "accessibleListPath":"/training/hazard-perception/scene?mode=list",
      "hazards":[
        {"id":"liquid-spill","label":"Liquid spill on a marked walkway"},
        {"id":"blocked-exit","label":"Obstructed emergency exit"},
        {"id":"unsafe-lift","label":"Unsafe manual lift"},
        {"id":"vehicle-conflict","label":"Vehicle and pedestrian route conflict"},
        {"id":"unsafe-stacking","label":"Unsafe pallet stacking"},
        {"id":"unsafe-height","label":"Unsafe work at height"},
        {"id":"missing-ppe","label":"Missing task-specific PPE"}
      ]
    }'::jsonb,
    null,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'manual-handling',
    'Manual Handling',
    'Plan safer lifts and moves for components, cartons and workplace equipment.',
    'Use a simple task, individual, load and environment check before deciding whether to lift, change the method or get assistance.',
    'Manual handling',
    30,
    'introductory',
    'published',
    true,
    70,
    200,
    20,
    '["Assess a handling task before starting","Use stable movement principles","Recognise when equipment or team assistance is needed"]'::jsonb,
    '{
      "sections": [
        {"id":"assess","title":"Assess before moving","body":"Consider the task, your capability, the load and the route."},
        {"id":"prepare","title":"Prepare the route","body":"Remove obstructions, choose suitable equipment and check the destination has space."},
        {"id":"move","title":"Move with control","body":"Use a stable stance, keep the load close where practical and avoid twisting under load."}
      ],
      "activity":{"type":"decision-sequence","steps":5}
    }'::jsonb,
    '{}'::jsonb,
    null,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'working-at-height',
    'Working at Height',
    'Select safer access methods and recognise controls for warehouse work at height.',
    'Decide whether work at height can be avoided, select suitable equipment and check the area before use.',
    'Working at height',
    35,
    'intermediate',
    'published',
    true,
    70,
    250,
    30,
    '["Apply the avoid-prevent-minimise hierarchy","Recognise unsuitable access methods","Carry out basic pre-use and area checks"]'::jsonb,
    '{
      "sections": [
        {"id":"avoid","title":"Avoid height where possible","body":"Bring the task to ground level or use a suitable alternative method where reasonably practicable."},
        {"id":"select","title":"Select suitable equipment","body":"Match access equipment to the task, duration, load, surface and environment."},
        {"id":"inspect","title":"Check before use","body":"Follow local arrangements for pre-use checks, defects, exclusion zones and authorisation."}
      ],
      "activity":{"type":"equipment-selector","scenarios":5}
    }'::jsonb,
    '{}'::jsonb,
    null,
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'cyber-awareness',
    'Cyber Awareness',
    'Protect operational accounts, devices and data by recognising suspicious requests and reporting concerns quickly.',
    'Use a pause, verify and report routine for suspicious messages, unexpected authentication prompts, unknown devices and possible security incidents.',
    'Digital safety',
    25,
    'introductory',
    'published',
    true,
    75,
    200,
    40,
    '["Recognise phishing and social-engineering warning signs","Protect credentials, authentication prompts and shared devices","Handle links, attachments, removable media and operational data safely","Report suspicious activity quickly without destroying useful evidence"]'::jsonb,
    '{
      "sections": [
        {"id":"pause","title":"Pause before you trust","body":"Check the sender, context and route before responding to an unexpected request."},
        {"id":"protect","title":"Protect identity and access","body":"Keep credentials personal, reject unexpected approval prompts and lock shared workstations."},
        {"id":"handle","title":"Handle devices and data safely","body":"Use authorised systems and never connect unknown removable media."},
        {"id":"report","title":"Report quickly","body":"Preserve useful details and report mistakes or suspicious activity without delay."}
      ],
      "activity":{"type":"decision-sequence","steps":5}
    }'::jsonb,
    '{}'::jsonb,
    '/training-cyber-awareness.png',
    now()
  )
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    overview = excluded.overview,
    category = excluded.category,
    estimated_minutes = excluded.estimated_minutes,
    difficulty = excluded.difficulty,
    status = excluded.status,
    is_published = excluded.is_published,
    pass_mark = excluded.pass_mark,
    points_available = excluded.points_available,
    sort_order = excluded.sort_order,
    learning_objectives = excluded.learning_objectives,
    content = excluded.content,
    scene_config = excluded.scene_config,
    hero_image_path = excluded.hero_image_path,
    published_at = coalesce(public.training_modules.published_at, excluded.published_at);

-- Server-held activity decision keys. Clients submit only a recognised scenario
-- id and selected choice id; scores and completion are derived in the database.
insert into private.activity_scenario_keys (
  module_id,
  scenario_id,
  allowed_choice_ids,
  correct_choice_id,
  points,
  sort_order
)
values
  ('10000000-0000-4000-8000-000000000002', 'mh-1', array['a','b','c'], 'b', 100, 10),
  ('10000000-0000-4000-8000-000000000002', 'mh-2', array['a','b','c'], 'a', 100, 20),
  ('10000000-0000-4000-8000-000000000002', 'mh-3', array['a','b','c'], 'b', 100, 30),
  ('10000000-0000-4000-8000-000000000002', 'mh-4', array['a','b','c'], 'b', 100, 40),
  ('10000000-0000-4000-8000-000000000002', 'mh-5', array['a','b','c'], 'a', 100, 50),
  ('10000000-0000-4000-8000-000000000003', 'wh-1', array['a','b','c'], 'a', 100, 10),
  ('10000000-0000-4000-8000-000000000003', 'wh-2', array['a','b','c'], 'b', 100, 20),
  ('10000000-0000-4000-8000-000000000003', 'wh-3', array['a','b','c'], 'b', 100, 30),
  ('10000000-0000-4000-8000-000000000003', 'wh-4', array['a','b','c'], 'b', 100, 40),
  ('10000000-0000-4000-8000-000000000003', 'wh-5', array['a','b','c'], 'b', 100, 50),
  ('10000000-0000-4000-8000-000000000004', 'cy-1', array['a','b','c'], 'b', 100, 10),
  ('10000000-0000-4000-8000-000000000004', 'cy-2', array['a','b','c'], 'a', 100, 20),
  ('10000000-0000-4000-8000-000000000004', 'cy-3', array['a','b','c'], 'b', 100, 30),
  ('10000000-0000-4000-8000-000000000004', 'cy-4', array['a','b','c'], 'b', 100, 40),
  ('10000000-0000-4000-8000-000000000004', 'cy-5', array['a','b','c'], 'a', 100, 50)
on conflict (module_id, scenario_id) do update
set allowed_choice_ids = excluded.allowed_choice_ids,
    correct_choice_id = excluded.correct_choice_id,
    points = excluded.points,
    sort_order = excluded.sort_order;

delete from private.activity_scenario_keys as scenario
where scenario.module_id in (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004'
  )
  and (scenario.module_id, scenario.scenario_id) not in (
    ('10000000-0000-4000-8000-000000000002'::uuid, 'mh-1'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'mh-2'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'mh-3'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'mh-4'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'mh-5'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'wh-1'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'wh-2'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'wh-3'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'wh-4'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'wh-5'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'cy-1'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'cy-2'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'cy-3'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'cy-4'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'cy-5')
  );

insert into public.quiz_questions (
  id, module_id, question_type, prompt, options, explanation, points, sort_order, is_active
)
values
  (
    '11000000-0000-4000-8100-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'single_choice',
    'A forklift is approaching a pedestrian crossing. What should you do first?',
    '[{"id":"a","label":"Step into the crossing and signal the driver"},{"id":"b","label":"Wait in the safe area and make sure the driver has stopped"},{"id":"c","label":"Walk behind the moving forklift"},{"id":"d","label":"Use a phone while crossing quickly"}]'::jsonb,
    'Remain in the designated safe area and establish that the vehicle has stopped before using the crossing.',
    1, 1, true
  ),
  (
    '11000000-0000-4000-8100-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'multiple_choice',
    'Which details are useful when reporting damaged warehouse racking?',
    '[{"id":"a","label":"The exact location"},{"id":"b","label":"Visible damage or movement"},{"id":"c","label":"Unrelated personal information"},{"id":"d","label":"Any immediate isolation already in place"}]'::jsonb,
    'A clear location, description of the damage and immediate controls help the responsible team respond safely.',
    1, 2, true
  ),
  (
    '11000000-0000-4000-8100-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'single_choice',
    'You notice fluid across a marked pedestrian route. What is the safest immediate response?',
    '[{"id":"a","label":"Ignore it because the route is marked"},{"id":"b","label":"Walk through it to test whether it is slippery"},{"id":"c","label":"Keep people clear, warn others and report it using the local procedure"},{"id":"d","label":"Cover it with cardboard and leave"}]'::jsonb,
    'Prevent access if it is safe to do so, warn others and arrange the correct spill response through local procedures.',
    1, 3, true
  ),
  (
    '11000000-0000-4000-8100-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'true_false',
    'An obstructed emergency exit should be reported even if another exit is nearby.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Escape routes and exits must remain available; follow the local process to remove or report an obstruction promptly.',
    1, 4, true
  ),
  (
    '11000000-0000-4000-8100-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'single_choice',
    'A pallet appears unstable on high-level racking. What should you avoid?',
    '[{"id":"a","label":"Keeping clear of the area"},{"id":"b","label":"Reporting the precise location"},{"id":"c","label":"Trying to straighten the pallet from below"},{"id":"d","label":"Following the site isolation procedure"}]'::jsonb,
    'Do not work beneath or try to adjust an unstable load; keep clear and follow local isolation and reporting arrangements.',
    1, 5, true
  ),
  (
    '11000000-0000-4000-8100-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'multiple_choice',
    'Which behaviours support an effective hazard scan?',
    '[{"id":"a","label":"Look high and low"},{"id":"b","label":"Consider what may move or change"},{"id":"c","label":"Focus only on the task in your hands"},{"id":"d","label":"Check vehicle and pedestrian routes"}]'::jsonb,
    'A useful scan covers different levels, movement and the interfaces between people, vehicles, equipment and stored items.',
    1, 6, true
  ),
  (
    '11000000-0000-4000-8100-000000000007',
    '10000000-0000-4000-8000-000000000001',
    'single_choice',
    'A charging lead crosses a walkway. Which control is most appropriate?',
    '[{"id":"a","label":"Route or secure it away from the walkway and report any defect"},{"id":"b","label":"Paint the lead a brighter colour"},{"id":"c","label":"Ask pedestrians to jump over it"},{"id":"d","label":"Place loose paper beside it"}]'::jsonb,
    'Remove the trip hazard by routing or securing the lead correctly and report damage in line with local arrangements.',
    1, 7, true
  ),
  (
    '11000000-0000-4000-8100-000000000008',
    '10000000-0000-4000-8000-000000000001',
    'true_false',
    'Identifying a hazard means you should put yourself at risk to fix it immediately.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Keep yourself and others safe, apply only controls you are authorised and competent to use, and report the issue.',
    1, 8, true
  ),
  (
    '12000000-0000-4000-8200-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'single_choice',
    'What should happen before lifting an unfamiliar component crate?',
    '[{"id":"a","label":"Lift one corner quickly to guess its weight"},{"id":"b","label":"Assess the task, load, individual capability and environment"},{"id":"c","label":"Assume the printed weight is always correct"},{"id":"d","label":"Move it before checking the route"}]'::jsonb,
    'Assess the whole handling operation first, including the task, person, load and environment.',
    1, 1, true
  ),
  (
    '12000000-0000-4000-8200-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'multiple_choice',
    'Which load features may increase handling risk?',
    '[{"id":"a","label":"An unstable centre of gravity"},{"id":"b","label":"Poor handholds"},{"id":"c","label":"Sharp or hot surfaces"},{"id":"d","label":"A clear, verified label"}]'::jsonb,
    'Instability, poor grip and hazardous surfaces can all change the handling method or mean equipment is needed.',
    1, 2, true
  ),
  (
    '12000000-0000-4000-8200-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'single_choice',
    'Which movement principle is generally safer during a straightforward lift?',
    '[{"id":"a","label":"Twist while the load is raised"},{"id":"b","label":"Keep a stable stance and move the feet to turn"},{"id":"c","label":"Hold the load away from the body"},{"id":"d","label":"Jerk the load to start it moving"}]'::jsonb,
    'A stable stance and turning with the feet can reduce twisting; keep movements controlled and the load close where practical.',
    1, 3, true
  ),
  (
    '12000000-0000-4000-8200-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'true_false',
    'Using handling equipment removes the need for checks or training.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Equipment must be suitable, checked and used by people who have the required information, instruction and authorisation.',
    1, 4, true
  ),
  (
    '12000000-0000-4000-8200-000000000005',
    '10000000-0000-4000-8000-000000000002',
    'single_choice',
    'What is the best response if a load is beyond your capability?',
    '[{"id":"a","label":"Attempt it once to prove it is too heavy"},{"id":"b","label":"Change the method and obtain suitable equipment or assistance"},{"id":"c","label":"Drag it across a pedestrian route"},{"id":"d","label":"Hold your breath and lift quickly"}]'::jsonb,
    'Stop and change the plan. Suitable equipment, a different load size or properly coordinated assistance may be required.',
    1, 5, true
  ),
  (
    '12000000-0000-4000-8200-000000000006',
    '10000000-0000-4000-8000-000000000002',
    'multiple_choice',
    'What should you check along a manual-handling route?',
    '[{"id":"a","label":"Floor condition and level changes"},{"id":"b","label":"Space at the destination"},{"id":"c","label":"Doors, traffic and obstructions"},{"id":"d","label":"Only the shortest distance"}]'::jsonb,
    'The complete route and destination matter, including surfaces, access, traffic, obstructions and enough space to place the load.',
    1, 6, true
  ),
  (
    '12000000-0000-4000-8200-000000000007',
    '10000000-0000-4000-8000-000000000002',
    'single_choice',
    'When is a team lift a suitable choice?',
    '[{"id":"a","label":"Whenever no equipment is immediately available"},{"id":"b","label":"When the assessment supports it and the move can be coordinated clearly"},{"id":"c","label":"When everyone lifts at a different time"},{"id":"d","label":"For every bulky load regardless of shape"}]'::jsonb,
    'A team lift needs planning, enough space and one coordinated method; it is not a substitute for suitable equipment in every case.',
    1, 7, true
  ),
  (
    '12000000-0000-4000-8200-000000000008',
    '10000000-0000-4000-8000-000000000002',
    'true_false',
    'A change in the load or route is a reason to pause and reassess the move.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Reassess when conditions change; the original plan may no longer control the actual risks.',
    1, 8, true
  ),
  (
    '13000000-0000-4000-8300-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'single_choice',
    'What is the first consideration in the work-at-height hierarchy?',
    '[{"id":"a","label":"Use the tallest available ladder"},{"id":"b","label":"Avoid work at height where reasonably practicable"},{"id":"c","label":"Rely only on personal protective equipment"},{"id":"d","label":"Complete the task as quickly as possible"}]'::jsonb,
    'First consider whether the task can be completed from ground level or by another method that avoids work at height.',
    1, 1, true
  ),
  (
    '13000000-0000-4000-8300-000000000002',
    '10000000-0000-4000-8000-000000000003',
    'multiple_choice',
    'Which factors affect access-equipment selection?',
    '[{"id":"a","label":"Task duration and complexity"},{"id":"b","label":"Ground and environmental conditions"},{"id":"c","label":"People, tools and materials involved"},{"id":"d","label":"The equipment colour"}]'::jsonb,
    'Selection should reflect the task, duration, people, load, surface and surrounding environment rather than appearance.',
    1, 2, true
  ),
  (
    '13000000-0000-4000-8300-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'single_choice',
    'You find damage during a pre-use access-equipment check. What should you do?',
    '[{"id":"a","label":"Use it only for a short task"},{"id":"b","label":"Hide the damage with tape"},{"id":"c","label":"Take it out of use and follow the defect-reporting process"},{"id":"d","label":"Ask a colleague to hold the damaged part"}]'::jsonb,
    'Do not use defective equipment. Prevent unintended use and follow the local defect and replacement arrangements.',
    1, 3, true
  ),
  (
    '13000000-0000-4000-8300-000000000004',
    '10000000-0000-4000-8000-000000000003',
    'true_false',
    'Standing on a pallet raised by a forklift is an acceptable shortcut for a brief task.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Use equipment designed and authorised for access; improvised raised platforms can expose people to severe risks.',
    1, 4, true
  ),
  (
    '13000000-0000-4000-8300-000000000005',
    '10000000-0000-4000-8000-000000000003',
    'single_choice',
    'Why might an exclusion zone be needed below work at height?',
    '[{"id":"a","label":"To reserve floor space for storage"},{"id":"b","label":"To control access to an area exposed to falling objects or the work activity"},{"id":"c","label":"To make the task look more important"},{"id":"d","label":"To avoid checking tools and materials"}]'::jsonb,
    'A suitable exclusion zone can keep others away from the work and potential falling-object area; it does not replace other controls.',
    1, 5, true
  ),
  (
    '13000000-0000-4000-8300-000000000006',
    '10000000-0000-4000-8000-000000000003',
    'multiple_choice',
    'Which conditions should prompt a review before work at height starts?',
    '[{"id":"a","label":"Unexpected vehicle movement nearby"},{"id":"b","label":"A wet or uneven surface"},{"id":"c","label":"Equipment different from the planned selection"},{"id":"d","label":"The task starts at the planned time"}]'::jsonb,
    'Changes to traffic, surfaces, equipment or the task can invalidate the original assessment and should be reviewed.',
    1, 6, true
  ),
  (
    '13000000-0000-4000-8300-000000000007',
    '10000000-0000-4000-8000-000000000003',
    'single_choice',
    'Which statement about ladders is most appropriate?',
    '[{"id":"a","label":"They are suitable for every warehouse task"},{"id":"b","label":"Their suitability depends on the assessed task, duration and conditions"},{"id":"c","label":"They never require a pre-use check"},{"id":"d","label":"The top step is always a safe working platform"}]'::jsonb,
    'A ladder may be suitable only when the assessment, task duration, conditions and local arrangements support its use.',
    1, 7, true
  ),
  (
    '13000000-0000-4000-8300-000000000008',
    '10000000-0000-4000-8000-000000000003',
    'true_false',
    'Authorisation and local procedures still apply when access equipment appears simple to use.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Follow the organisation''s training, authorisation, inspection and task-control arrangements for the equipment and work involved.',
    1, 8, true
  ),
  (
    '14000000-0000-4000-8400-000000000001',
    '10000000-0000-4000-8000-000000000004',
    'single_choice',
    'An unexpected email pressures you to reset your warehouse password immediately. What should you do first?',
    '[{"id":"a","label":"Use the email link before the deadline"},{"id":"b","label":"Open the trusted sign-in page separately and report the message"},{"id":"c","label":"Forward the link to a colleague for testing"},{"id":"d","label":"Reply with your current password for verification"}]'::jsonb,
    'Use a known route to verify the account and report the suspicious message instead of following its link or instructions.',
    1, 1, true
  ),
  (
    '14000000-0000-4000-8400-000000000002',
    '10000000-0000-4000-8000-000000000004',
    'multiple_choice',
    'Which signs can indicate a phishing or social-engineering message?',
    '[{"id":"a","label":"Unexpected urgency or threats"},{"id":"b","label":"A sender address that does not match the claimed organisation"},{"id":"c","label":"A request to bypass the normal process"},{"id":"d","label":"A message you independently verified through a trusted channel"}]'::jsonb,
    'Unexpected urgency, mismatched identities and pressure to bypass a trusted process are common warning signs.',
    1, 2, true
  ),
  (
    '14000000-0000-4000-8400-000000000003',
    '10000000-0000-4000-8000-000000000004',
    'single_choice',
    'You receive a multi-factor approval prompt that you did not initiate. What is the safest response?',
    '[{"id":"a","label":"Approve it once to clear the notification"},{"id":"b","label":"Reject it and report the unexpected sign-in attempt"},{"id":"c","label":"Share the code with the support caller"},{"id":"d","label":"Disable all future authentication prompts"}]'::jsonb,
    'Reject and report an unsolicited approval prompt because it may indicate that another person has your password.',
    1, 3, true
  ),
  (
    '14000000-0000-4000-8400-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'true_false',
    'It is acceptable to share your account briefly when a colleague has an urgent operational task.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Accounts and verification codes must remain personal so access and actions stay controlled and attributable.',
    1, 4, true
  ),
  (
    '14000000-0000-4000-8400-000000000005',
    '10000000-0000-4000-8000-000000000004',
    'single_choice',
    'What should you do with an unlabelled USB drive found near a shared workstation?',
    '[{"id":"a","label":"Connect it briefly to identify the owner"},{"id":"b","label":"Keep it disconnected and follow the reporting process"},{"id":"c","label":"Test it on a personal computer"},{"id":"d","label":"Leave it for the next shift to investigate"}]'::jsonb,
    'Unknown removable media must remain disconnected and be handled through the approved reporting process.',
    1, 5, true
  ),
  (
    '14000000-0000-4000-8400-000000000006',
    '10000000-0000-4000-8000-000000000004',
    'multiple_choice',
    'Which actions help protect a shared warehouse workstation?',
    '[{"id":"a","label":"Lock the screen when leaving it"},{"id":"b","label":"Use only authorised software and storage"},{"id":"c","label":"Keep passwords and verification codes private"},{"id":"d","label":"Leave sensitive records visible for convenience"}]'::jsonb,
    'Lock the workstation, use approved systems and keep authentication information private.',
    1, 6, true
  ),
  (
    '14000000-0000-4000-8400-000000000007',
    '10000000-0000-4000-8000-000000000004',
    'single_choice',
    'You opened a suspicious attachment and the workstation began behaving differently. What should you do?',
    '[{"id":"a","label":"Continue working and wait for clearer symptoms"},{"id":"b","label":"Delete the email and tell nobody"},{"id":"c","label":"Report it immediately and follow the incident instructions"},{"id":"d","label":"Send the attachment to another device for comparison"}]'::jsonb,
    'Prompt reporting gives the responsible team the best opportunity to contain the issue and protect other systems.',
    1, 7, true
  ),
  (
    '14000000-0000-4000-8400-000000000008',
    '10000000-0000-4000-8000-000000000004',
    'true_false',
    'If you accidentally interact with a suspicious message, reporting it quickly is safer than hiding the mistake.',
    '[{"id":"true","label":"True"},{"id":"false","label":"False"}]'::jsonb,
    'Early, accurate reporting supports containment and is more useful than waiting or removing evidence.',
    1, 8, true
  )
on conflict (id) do update
set module_id = excluded.module_id,
    question_type = excluded.question_type,
    prompt = excluded.prompt,
    options = excluded.options,
    explanation = excluded.explanation,
    points = excluded.points,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

insert into private.quiz_answer_keys (question_id, correct_answer)
values
  ('11000000-0000-4000-8100-000000000001', '["b"]'::jsonb),
  ('11000000-0000-4000-8100-000000000002', '["a","b","d"]'::jsonb),
  ('11000000-0000-4000-8100-000000000003', '["c"]'::jsonb),
  ('11000000-0000-4000-8100-000000000004', '["true"]'::jsonb),
  ('11000000-0000-4000-8100-000000000005', '["c"]'::jsonb),
  ('11000000-0000-4000-8100-000000000006', '["a","b","d"]'::jsonb),
  ('11000000-0000-4000-8100-000000000007', '["a"]'::jsonb),
  ('11000000-0000-4000-8100-000000000008', '["false"]'::jsonb),
  ('12000000-0000-4000-8200-000000000001', '["b"]'::jsonb),
  ('12000000-0000-4000-8200-000000000002', '["a","b","c"]'::jsonb),
  ('12000000-0000-4000-8200-000000000003', '["b"]'::jsonb),
  ('12000000-0000-4000-8200-000000000004', '["false"]'::jsonb),
  ('12000000-0000-4000-8200-000000000005', '["b"]'::jsonb),
  ('12000000-0000-4000-8200-000000000006', '["a","b","c"]'::jsonb),
  ('12000000-0000-4000-8200-000000000007', '["b"]'::jsonb),
  ('12000000-0000-4000-8200-000000000008', '["true"]'::jsonb),
  ('13000000-0000-4000-8300-000000000001', '["b"]'::jsonb),
  ('13000000-0000-4000-8300-000000000002', '["a","b","c"]'::jsonb),
  ('13000000-0000-4000-8300-000000000003', '["c"]'::jsonb),
  ('13000000-0000-4000-8300-000000000004', '["false"]'::jsonb),
  ('13000000-0000-4000-8300-000000000005', '["b"]'::jsonb),
  ('13000000-0000-4000-8300-000000000006', '["a","b","c"]'::jsonb),
  ('13000000-0000-4000-8300-000000000007', '["b"]'::jsonb),
  ('13000000-0000-4000-8300-000000000008', '["true"]'::jsonb),
  ('14000000-0000-4000-8400-000000000001', '["b"]'::jsonb),
  ('14000000-0000-4000-8400-000000000002', '["a","b","c"]'::jsonb),
  ('14000000-0000-4000-8400-000000000003', '["b"]'::jsonb),
  ('14000000-0000-4000-8400-000000000004', '["false"]'::jsonb),
  ('14000000-0000-4000-8400-000000000005', '["b"]'::jsonb),
  ('14000000-0000-4000-8400-000000000006', '["a","b","c"]'::jsonb),
  ('14000000-0000-4000-8400-000000000007', '["c"]'::jsonb),
  ('14000000-0000-4000-8400-000000000008', '["true"]'::jsonb)
on conflict (question_id) do update
set correct_answer = excluded.correct_answer;

insert into public.achievements (
  id, code, title, description, icon, points, criteria, sort_order, is_active
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'first-assessment',
    'First Safety Check',
    'Submit your first Safety360 knowledge check.',
    'clipboard-check',
    20,
    '{"type":"attempt_count","minimum":1}'::jsonb,
    10,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'perfect-assessment',
    'Precision Result',
    'Achieve a full score in a module knowledge check.',
    'target',
    75,
    '{"type":"percentage","minimum":100}'::jsonb,
    20,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'hazard-aware',
    'Hazard Aware',
    'Complete the Hazard Perception learning, activity and assessment.',
    'scan-eye',
    50,
    '{"type":"module_complete","slug":"hazard-perception"}'::jsonb,
    30,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'handling-ready',
    'Handling Ready',
    'Complete the Manual Handling learning, activity and assessment.',
    'package-check',
    50,
    '{"type":"module_complete","slug":"manual-handling"}'::jsonb,
    40,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'height-aware',
    'Height Aware',
    'Complete the Working at Height learning, activity and assessment.',
    'shield-check',
    50,
    '{"type":"module_complete","slug":"working-at-height"}'::jsonb,
    50,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'core-safety-complete',
    'Core Safety Complete',
    'Complete all three core Safety360 training modules.',
    'award',
    150,
    '{"type":"module_set_complete","slugs":["hazard-perception","manual-handling","working-at-height"]}'::jsonb,
    60,
    true
  )
on conflict (id) do update
set code = excluded.code,
    title = excluded.title,
    description = excluded.description,
    icon = excluded.icon,
    points = excluded.points,
    criteria = excluded.criteria,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

commit;
