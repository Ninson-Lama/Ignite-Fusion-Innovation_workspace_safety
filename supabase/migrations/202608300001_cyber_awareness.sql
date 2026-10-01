-- Add the Cyber Awareness learning, practical decisions and protected assessment.
-- This migration is idempotent so it can also be used to repair a partial rollout.

begin;

insert into public.training_modules (
  id, slug, title, description, overview, category, estimated_minutes,
  difficulty, status, is_published, pass_mark, points_available, sort_order,
  learning_objectives, content, scene_config, hero_image_path, published_at
)
values (
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

insert into private.activity_scenario_keys (
  module_id, scenario_id, allowed_choice_ids, correct_choice_id, points, sort_order
)
values
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

insert into public.quiz_questions (
  id, module_id, question_type, prompt, options, explanation, points, sort_order, is_active
)
values
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

-- Extend the existing server-verified decision activity to the new module.
-- pg_get_functiondef keeps the complete audited implementation intact while the
-- two known decision-module allowlists are upgraded in place.
do $migration$
declare
  function_definition text;
  previous_allowlist constant text := 'module_slug in (''manual-handling'', ''working-at-height'')';
  expanded_allowlist constant text := 'module_slug in (''manual-handling'', ''working-at-height'', ''cyber-awareness'')';
begin
  select pg_get_functiondef(
    'public.record_training_activity(uuid,text,integer,text,jsonb)'::regprocedure
  )
  into function_definition;

  if position('cyber-awareness' in function_definition) = 0 then
    if position(previous_allowlist in function_definition) = 0 then
      raise exception 'Could not locate the expected activity-module allowlist';
    end if;

    execute replace(function_definition, previous_allowlist, expanded_allowlist);
  end if;
end
$migration$;

commit;
