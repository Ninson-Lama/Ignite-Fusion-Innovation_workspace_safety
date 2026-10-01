begin;

-- Work-in-progress definitions remain private until an administrator explicitly
-- publishes them. This lets authors save incomplete drafts without exposing
-- answer keys, scenario feedback or unfinished copy to trainees.
create table if not exists private.module_authoring_drafts (
  module_id uuid primary key references public.training_modules (id) on delete cascade,
  definition jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_authoring_drafts_definition_object check (jsonb_typeof(definition) = 'object'),
  constraint module_authoring_drafts_definition_size check (octet_length(definition::text) <= 262144)
);

alter table private.module_authoring_drafts enable row level security;
revoke all on table private.module_authoring_drafts from public, anon, authenticated;

drop trigger if exists module_authoring_drafts_set_updated_at on private.module_authoring_drafts;
create trigger module_authoring_drafts_set_updated_at
before update on private.module_authoring_drafts
for each row execute function private.set_updated_at();

alter table private.activity_scenario_keys
  add column if not exists choice_feedback jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activity_scenario_keys_feedback_object'
      and conrelid = 'private.activity_scenario_keys'::regclass
  ) then
    alter table private.activity_scenario_keys
      add constraint activity_scenario_keys_feedback_object
      check (jsonb_typeof(choice_feedback) = 'object');
  end if;
end
$$;

create or replace function private.assert_module_authoring_definition(definition jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if definition is null
    or jsonb_typeof(definition) <> 'object'
    or octet_length(definition::text) > 262144
  then
    raise exception using errcode = '22023', message = 'The module definition must be a bounded JSON object';
  end if;

  if char_length(btrim(coalesce(definition ->> 'title', ''))) not between 3 and 120
    or coalesce(definition ->> 'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or char_length(definition ->> 'slug') > 80
    or char_length(btrim(coalesce(definition ->> 'description', ''))) not between 10 and 800
    or char_length(btrim(coalesce(definition ->> 'overview', ''))) not between 20 and 2000
    or char_length(btrim(coalesce(definition ->> 'category', ''))) not between 2 and 80
  then
    raise exception using errcode = '22023', message = 'Review the module overview details';
  end if;

  if coalesce(definition ->> 'estimatedMinutes', '') !~ '^\d+$'
    or (definition ->> 'estimatedMinutes')::integer not between 5 and 240
    or coalesce(definition ->> 'passMark', '') !~ '^\d+$'
    or (definition ->> 'passMark')::integer not between 1 and 100
    or coalesce(definition ->> 'pointsAvailable', '') !~ '^\d+$'
    or (definition ->> 'pointsAvailable')::integer not between 0 and 5000
    or coalesce(definition ->> 'sortOrder', '') !~ '^\d+$'
    or (definition ->> 'sortOrder')::integer not between 0 and 10000
  then
    raise exception using errcode = '22023', message = 'Review the module scoring, duration and order';
  end if;

  if coalesce(definition ->> 'difficulty', '') not in ('introductory', 'intermediate', 'advanced')
    or coalesce(definition ->> 'heroImagePath', '') not in (
      '/training-hazard-perception.png',
      '/training-manual-handling.png',
      '/training-working-at-height.png',
      '/training-cyber-awareness.png'
    )
  then
    raise exception using errcode = '22023', message = 'Choose a supported difficulty and cover image';
  end if;

  if jsonb_typeof(definition -> 'learningObjectives') is distinct from 'array'
    or jsonb_array_length(definition -> 'learningObjectives') > 8
    or jsonb_typeof(definition -> 'learning') is distinct from 'array'
    or jsonb_array_length(definition -> 'learning') > 12
    or jsonb_typeof(definition -> 'scenarios') is distinct from 'array'
    or jsonb_array_length(definition -> 'scenarios') > 12
    or jsonb_typeof(definition -> 'questions') is distinct from 'array'
    or jsonb_array_length(definition -> 'questions') > 20
  then
    raise exception using errcode = '22023', message = 'The module definition contains an invalid collection';
  end if;
end;
$$;

revoke all on function private.assert_module_authoring_definition(jsonb) from public, anon, authenticated;

create or replace function private.module_authoring_readiness(definition jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  issues jsonb := '[]'::jsonb;
  objectives jsonb := coalesce(definition -> 'learningObjectives', '[]'::jsonb);
  learning_sections jsonb := coalesce(definition -> 'learning', '[]'::jsonb);
  scenarios jsonb := coalesce(definition -> 'scenarios', '[]'::jsonb);
  questions jsonb := coalesce(definition -> 'questions', '[]'::jsonb);
  objective_count integer := 0;
  learning_count integer := 0;
  scenario_count integer := 0;
  question_count integer := 0;
  invalid_learning boolean := true;
  invalid_scenarios boolean := true;
  invalid_questions boolean := true;
begin
  if definition is null or jsonb_typeof(definition) <> 'object' then
    return jsonb_build_object(
      'ready', false,
      'issues', jsonb_build_array('The private module draft is missing.'),
      'counts', jsonb_build_object('objectives', 0, 'learningSections', 0, 'scenarios', 0, 'questions', 0)
    );
  end if;

  if jsonb_typeof(objectives) = 'array' then
    select count(*) into objective_count
    from jsonb_array_elements_text(objectives) as objective(value)
    where char_length(btrim(objective.value)) >= 5;
  end if;
  if objective_count < 2 then
    issues := issues || jsonb_build_array('Add at least two clear learning objectives.');
  end if;

  if jsonb_typeof(learning_sections) = 'array' then
    learning_count := jsonb_array_length(learning_sections);
    select exists (
      select 1
      from jsonb_array_elements(learning_sections) as section(value)
      where coalesce(section.value ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,39}$'
        or char_length(btrim(coalesce(section.value ->> 'title', ''))) < 3
        or char_length(btrim(coalesce(section.value ->> 'summary', ''))) < 10
        or jsonb_typeof(section.value -> 'points') is distinct from 'array'
        or jsonb_array_length(coalesce(section.value -> 'points', '[]'::jsonb)) < 2
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(section.value -> 'points', '[]'::jsonb)) as point(value)
          where char_length(btrim(point.value)) < 5
        )
    ) or (
      select count(*) <> count(distinct section.value ->> 'id')
      from jsonb_array_elements(learning_sections) as section(value)
    ) into invalid_learning;
  end if;
  if learning_count < 2 or invalid_learning then
    issues := issues || jsonb_build_array('Complete at least two learning sections with two useful key points each.');
  end if;

  if jsonb_typeof(scenarios) = 'array' then
    scenario_count := jsonb_array_length(scenarios);
    select exists (
      select 1
      from jsonb_array_elements(scenarios) as scenario(value)
      where coalesce(scenario.value ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{0,39}$'
        or char_length(btrim(coalesce(scenario.value ->> 'situation', ''))) < 10
        or char_length(btrim(coalesce(scenario.value ->> 'prompt', ''))) < 8
        or jsonb_typeof(scenario.value -> 'choices') is distinct from 'array'
        or jsonb_array_length(coalesce(scenario.value -> 'choices', '[]'::jsonb)) not between 2 and 4
        or (
          select count(*) from jsonb_array_elements(coalesce(scenario.value -> 'choices', '[]'::jsonb)) as choice(value)
          where choice.value ->> 'isCorrect' = 'true'
        ) <> 1
        or exists (
          select 1
          from jsonb_array_elements(coalesce(scenario.value -> 'choices', '[]'::jsonb)) as choice(value)
          where coalesce(choice.value ->> 'id', '') !~ '^[a-z0-9][a-z0-9_-]{0,19}$'
            or char_length(btrim(coalesce(choice.value ->> 'label', ''))) < 3
            or char_length(btrim(coalesce(choice.value ->> 'feedback', ''))) < 8
            or coalesce(choice.value ->> 'isCorrect', '') not in ('true', 'false')
        )
        or (
          select count(*) <> count(distinct choice.value ->> 'id')
          from jsonb_array_elements(coalesce(scenario.value -> 'choices', '[]'::jsonb)) as choice(value)
        )
    ) or (
      select count(*) <> count(distinct scenario.value ->> 'id')
      from jsonb_array_elements(scenarios) as scenario(value)
    ) into invalid_scenarios;
  end if;
  if scenario_count < 1 or invalid_scenarios then
    issues := issues || jsonb_build_array('Complete at least one scenario with one safest answer and feedback for every choice.');
  end if;

  if jsonb_typeof(questions) = 'array' then
    question_count := jsonb_array_length(questions);
    select exists (
      select 1
      from jsonb_array_elements(questions) as question(value)
      where coalesce(question.value ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or coalesce(question.value ->> 'questionType', '') not in ('single_choice', 'multiple_choice', 'true_false')
        or char_length(btrim(coalesce(question.value ->> 'prompt', ''))) < 8
        or char_length(btrim(coalesce(question.value ->> 'explanation', ''))) < 8
        or coalesce(question.value ->> 'points', '') !~ '^\d+$'
        or (question.value ->> 'points')::integer not between 1 and 100
        or jsonb_typeof(question.value -> 'options') is distinct from 'array'
        or jsonb_array_length(coalesce(question.value -> 'options', '[]'::jsonb)) not between 2 and 6
        or exists (
          select 1
          from jsonb_array_elements(coalesce(question.value -> 'options', '[]'::jsonb)) as option(value)
          where coalesce(option.value ->> 'id', '') !~ '^[a-z0-9][a-z0-9_-]{0,19}$'
            or char_length(btrim(coalesce(option.value ->> 'label', ''))) < 1
            or coalesce(option.value ->> 'isCorrect', '') not in ('true', 'false')
        )
        or (
          select count(*) <> count(distinct option.value ->> 'id')
          from jsonb_array_elements(coalesce(question.value -> 'options', '[]'::jsonb)) as option(value)
        )
        or case
          when question.value ->> 'questionType' = 'multiple_choice' then (
            select count(*) < 1 from jsonb_array_elements(coalesce(question.value -> 'options', '[]'::jsonb)) as option(value)
            where option.value ->> 'isCorrect' = 'true'
          )
          else (
            select count(*) <> 1 from jsonb_array_elements(coalesce(question.value -> 'options', '[]'::jsonb)) as option(value)
            where option.value ->> 'isCorrect' = 'true'
          )
        end
    ) or (
      select count(*) <> count(distinct question.value ->> 'id')
      from jsonb_array_elements(questions) as question(value)
    ) into invalid_questions;
  end if;
  if question_count < 3 or invalid_questions then
    issues := issues || jsonb_build_array('Complete at least three assessment questions with protected answer keys and explanations.');
  end if;

  return jsonb_build_object(
    'ready', jsonb_array_length(issues) = 0,
    'issues', issues,
    'counts', jsonb_build_object(
      'objectives', objective_count,
      'learningSections', learning_count,
      'scenarios', scenario_count,
      'questions', question_count
    )
  );
end;
$$;

revoke all on function private.module_authoring_readiness(jsonb) from public, anon, authenticated;

create or replace function public.admin_create_module_draft(definition jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_module public.training_modules%rowtype;
  readiness jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  perform private.assert_module_authoring_definition(definition);

  insert into public.training_modules (
    slug, title, description, overview, category, estimated_minutes, difficulty,
    pass_mark, points_available, sort_order, learning_objectives, content,
    scene_config, hero_image_path, status, is_published, created_by, updated_by
  ) values (
    definition ->> 'slug',
    btrim(definition ->> 'title'),
    btrim(definition ->> 'description'),
    btrim(definition ->> 'overview'),
    btrim(definition ->> 'category'),
    (definition ->> 'estimatedMinutes')::smallint,
    (definition ->> 'difficulty')::public.difficulty_level,
    (definition ->> 'passMark')::smallint,
    (definition ->> 'pointsAvailable')::smallint,
    (definition ->> 'sortOrder')::integer,
    coalesce(definition -> 'learningObjectives', '[]'::jsonb),
    '{}'::jsonb,
    '{}'::jsonb,
    definition ->> 'heroImagePath',
    'draft', false, auth.uid(), auth.uid()
  ) returning * into created_module;

  insert into private.module_authoring_drafts (module_id, definition, updated_by)
  values (created_module.id, definition, auth.uid());

  readiness := private.module_authoring_readiness(definition);
  return jsonb_build_object(
    'module', jsonb_build_object(
      'id', created_module.id,
      'slug', created_module.slug,
      'title', created_module.title,
      'description', created_module.description,
      'estimated_minutes', created_module.estimated_minutes,
      'difficulty', created_module.difficulty,
      'status', created_module.status,
      'is_published', created_module.is_published,
      'sort_order', created_module.sort_order,
      'is_authored', true
    ),
    'readiness', readiness
  );
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A module with this URL slug already exists';
end;
$$;

revoke all on function public.admin_create_module_draft(jsonb) from public, anon;
grant execute on function public.admin_create_module_draft(jsonb) to authenticated;

create or replace function public.admin_save_module_draft(module_id uuid, definition jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  readiness jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  perform private.assert_module_authoring_definition(definition);

  perform pg_advisory_xact_lock(hashtextextended('module-authoring:' || module_id::text, 0));
  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_save_module_draft.module_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;
  if target_module.slug in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness') then
    raise exception using errcode = '23514', message = 'Built-in modules are maintained in the reviewed application catalogue';
  end if;
  if target_module.is_published or target_module.status = 'published' then
    raise exception using errcode = '23514', message = 'Unpublish this module before editing its content';
  end if;
  if exists (select 1 from public.module_progress where public.module_progress.module_id = target_module.id)
    or exists (select 1 from public.activity_log where public.activity_log.module_id = target_module.id)
    or exists (select 1 from public.quiz_attempts where public.quiz_attempts.module_id = target_module.id)
  then
    raise exception using errcode = '23514', message = 'A module with learner history cannot be structurally edited; create a new module version instead';
  end if;

  update public.training_modules as module
  set slug = definition ->> 'slug',
      title = btrim(definition ->> 'title'),
      description = btrim(definition ->> 'description'),
      overview = btrim(definition ->> 'overview'),
      category = btrim(definition ->> 'category'),
      estimated_minutes = (definition ->> 'estimatedMinutes')::smallint,
      difficulty = (definition ->> 'difficulty')::public.difficulty_level,
      pass_mark = (definition ->> 'passMark')::smallint,
      points_available = (definition ->> 'pointsAvailable')::smallint,
      sort_order = (definition ->> 'sortOrder')::integer,
      learning_objectives = definition -> 'learningObjectives',
      hero_image_path = definition ->> 'heroImagePath',
      updated_by = auth.uid()
  where module.id = target_module.id;

  insert into private.module_authoring_drafts (module_id, definition, updated_by)
  values (target_module.id, definition, auth.uid())
  on conflict (module_id) do update
  set definition = excluded.definition,
      updated_by = excluded.updated_by;

  readiness := private.module_authoring_readiness(definition);
  return jsonb_build_object('moduleId', target_module.id, 'savedAt', now(), 'readiness', readiness);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A module with this URL slug already exists';
end;
$$;

revoke all on function public.admin_save_module_draft(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_module_draft(uuid, jsonb) to authenticated;

create or replace function public.admin_get_module_draft(module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  definition jsonb;
  readiness jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_get_module_draft.module_id;
  if not found then return null; end if;

  select draft.definition into definition
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id;

  if definition is null and target_module.slug not in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness') then
    definition := jsonb_build_object(
      'title', target_module.title,
      'slug', target_module.slug,
      'description', target_module.description,
      'overview', target_module.overview,
      'category', target_module.category,
      'estimatedMinutes', target_module.estimated_minutes,
      'difficulty', target_module.difficulty,
      'passMark', target_module.pass_mark,
      'pointsAvailable', target_module.points_available,
      'sortOrder', target_module.sort_order,
      'heroImagePath', coalesce(target_module.hero_image_path, '/training-hazard-perception.png'),
      'learningObjectives', target_module.learning_objectives,
      'learning', '[]'::jsonb,
      'scenarios', '[]'::jsonb,
      'questions', '[]'::jsonb
    );
  end if;

  readiness := case when definition is null
    then jsonb_build_object('ready', target_module.is_published, 'issues', jsonb_build_array('Built-in content is reviewed in the application catalogue.'), 'counts', '{}'::jsonb)
    else private.module_authoring_readiness(definition)
  end;

  return jsonb_build_object(
    'moduleId', target_module.id,
    'status', target_module.status,
    'isPublished', target_module.is_published,
    'editable', definition is not null,
    'definition', definition,
    'readiness', readiness
  );
end;
$$;

revoke all on function public.admin_get_module_draft(uuid) from public, anon;
grant execute on function public.admin_get_module_draft(uuid) to authenticated;

create or replace function public.admin_module_readiness(module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_module record;
  definition jsonb;
  question_count integer := 0;
  keyed_question_count integer := 0;
  activity_count integer := 0;
  built_in_ready boolean := false;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  select module.id, module.slug, module.learning_objectives, module.content, module.scene_config, module.is_published
  into target_module
  from public.training_modules as module
  where module.id = admin_module_readiness.module_id;
  if not found then return null; end if;

  select draft.definition into definition
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id;
  if definition is not null then return private.module_authoring_readiness(definition); end if;

  select count(*), count(answer_key.question_id)
  into question_count, keyed_question_count
  from public.quiz_questions as question
  left join private.quiz_answer_keys as answer_key on answer_key.question_id = question.id
  where question.module_id = target_module.id and question.is_active;

  if target_module.slug = 'hazard-perception' then
    activity_count := case when jsonb_typeof(target_module.scene_config -> 'hazards') = 'array'
      then jsonb_array_length(target_module.scene_config -> 'hazards') else 0 end;
  else
    select count(*) into activity_count
    from private.activity_scenario_keys as scenario where scenario.module_id = target_module.id;
  end if;

  built_in_ready := target_module.slug in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness')
    and jsonb_typeof(target_module.learning_objectives) = 'array'
    and jsonb_array_length(target_module.learning_objectives) > 0
    and question_count > 0
    and keyed_question_count = question_count
    and activity_count > 0;

  return jsonb_build_object(
    'ready', built_in_ready,
    'issues', case when built_in_ready then '[]'::jsonb else jsonb_build_array('Add reviewed learning, activity and assessment content before publishing.') end,
    'counts', jsonb_build_object('objectives', jsonb_array_length(target_module.learning_objectives), 'learningSections', 0, 'scenarios', activity_count, 'questions', question_count)
  );
end;
$$;

revoke all on function public.admin_module_readiness(uuid) from public, anon;
grant execute on function public.admin_module_readiness(uuid) to authenticated;

create or replace function private.materialise_module_draft(module_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition jsonb;
  readiness jsonb;
  public_scenarios jsonb;
  scenario_record record;
  question_record record;
  allowed_choices text[];
  correct_choice text;
  feedback_map jsonb;
  public_options jsonb;
  correct_answers jsonb;
begin
  select draft.definition into definition
  from private.module_authoring_drafts as draft
  where draft.module_id = materialise_module_draft.module_id
  for update;
  if definition is null then
    raise exception using errcode = '23514', message = 'The private module draft is missing';
  end if;

  readiness := private.module_authoring_readiness(definition);
  if not coalesce((readiness ->> 'ready')::boolean, false) then
    raise exception using errcode = '23514', message = coalesce(readiness -> 'issues' ->> 0, 'Complete the module before publishing');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', scenario.value ->> 'id',
      'situation', scenario.value ->> 'situation',
      'prompt', scenario.value ->> 'prompt',
      'choices', (
        select coalesce(jsonb_agg(jsonb_build_object('id', choice.value ->> 'id', 'label', choice.value ->> 'label') order by choice.ordinality), '[]'::jsonb)
        from jsonb_array_elements(scenario.value -> 'choices') with ordinality as choice(value, ordinality)
      )
    ) order by scenario.ordinality
  ), '[]'::jsonb)
  into public_scenarios
  from jsonb_array_elements(definition -> 'scenarios') with ordinality as scenario(value, ordinality);

  update public.training_modules as module
  set slug = definition ->> 'slug',
      title = btrim(definition ->> 'title'),
      description = btrim(definition ->> 'description'),
      overview = btrim(definition ->> 'overview'),
      category = btrim(definition ->> 'category'),
      estimated_minutes = (definition ->> 'estimatedMinutes')::smallint,
      difficulty = (definition ->> 'difficulty')::public.difficulty_level,
      pass_mark = (definition ->> 'passMark')::smallint,
      points_available = (definition ->> 'pointsAvailable')::smallint,
      sort_order = (definition ->> 'sortOrder')::integer,
      learning_objectives = definition -> 'learningObjectives',
      content = jsonb_build_object(
        'schemaVersion', 1,
        'learning', definition -> 'learning',
        'scenarios', public_scenarios
      ),
      hero_image_path = definition ->> 'heroImagePath',
      updated_by = auth.uid()
  where module.id = materialise_module_draft.module_id;

  delete from private.activity_scenario_keys as scenario
  where scenario.module_id = materialise_module_draft.module_id;
  delete from public.quiz_questions as question
  where question.module_id = materialise_module_draft.module_id;

  for scenario_record in
    select scenario.value, scenario.ordinality
    from jsonb_array_elements(definition -> 'scenarios') with ordinality as scenario(value, ordinality)
  loop
    select
      array_agg(choice.value ->> 'id' order by choice.ordinality),
      max(choice.value ->> 'id') filter (where choice.value ->> 'isCorrect' = 'true'),
      jsonb_object_agg(choice.value ->> 'id', choice.value ->> 'feedback')
    into allowed_choices, correct_choice, feedback_map
    from jsonb_array_elements(scenario_record.value -> 'choices') with ordinality as choice(value, ordinality);

    insert into private.activity_scenario_keys (
      module_id, scenario_id, allowed_choice_ids, correct_choice_id, points, sort_order, choice_feedback
    ) values (
      materialise_module_draft.module_id,
      scenario_record.value ->> 'id',
      allowed_choices,
      correct_choice,
      100,
      scenario_record.ordinality::integer * 10,
      feedback_map
    );
  end loop;

  for question_record in
    select question.value, question.ordinality
    from jsonb_array_elements(definition -> 'questions') with ordinality as question(value, ordinality)
  loop
    select
      jsonb_agg(jsonb_build_object('id', option.value ->> 'id', 'label', option.value ->> 'label') order by option.ordinality),
      jsonb_agg(option.value ->> 'id' order by option.ordinality) filter (where option.value ->> 'isCorrect' = 'true')
    into public_options, correct_answers
    from jsonb_array_elements(question_record.value -> 'options') with ordinality as option(value, ordinality);

    insert into public.quiz_questions (
      id, module_id, question_type, prompt, options, explanation, points, sort_order, is_active
    ) values (
      (question_record.value ->> 'id')::uuid,
      materialise_module_draft.module_id,
      (question_record.value ->> 'questionType')::public.quiz_question_type,
      btrim(question_record.value ->> 'prompt'),
      public_options,
      btrim(question_record.value ->> 'explanation'),
      (question_record.value ->> 'points')::smallint,
      question_record.ordinality::integer,
      true
    );
    insert into private.quiz_answer_keys (question_id, correct_answer)
    values ((question_record.value ->> 'id')::uuid, correct_answers);
  end loop;
end;
$$;

revoke all on function private.materialise_module_draft(uuid) from public, anon, authenticated;

create or replace function public.set_module_publication(module_id uuid, published boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  readiness jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  if published is null then
    raise exception using errcode = '22023', message = 'Published flag is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('module-authoring:' || module_id::text, 0));
  select module.* into target_module
  from public.training_modules as module
  where module.id = set_module_publication.module_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;

  if published then
    readiness := public.admin_module_readiness(target_module.id);
    if not coalesce((readiness ->> 'ready')::boolean, false) then
      raise exception using errcode = '23514', message = coalesce(readiness -> 'issues' ->> 0, 'Complete the module before publishing');
    end if;
    if target_module.slug not in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness') then
      perform private.materialise_module_draft(target_module.id);
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('module-assignment:' || module_id::text, 0));
  end if;

  update public.training_modules as module
  set is_published = published,
      status = case when published then 'published'::public.module_status else 'draft'::public.module_status end,
      published_at = case when published then coalesce(module.published_at, now()) else null end,
      updated_by = auth.uid()
  where module.id = set_module_publication.module_id
  returning module.* into target_module;

  return jsonb_build_object(
    'id', target_module.id,
    'slug', target_module.slug,
    'status', target_module.status,
    'isPublished', target_module.is_published,
    'publishedAt', target_module.published_at
  );
end;
$$;

revoke all on function public.set_module_publication(uuid, boolean) from public, anon;
grant execute on function public.set_module_publication(uuid, boolean) to authenticated;

create or replace function public.manage_module(module_id uuid, published boolean, status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if status is not null and lower(btrim(status)) not in ('draft', 'published', 'archived') then
    raise exception using errcode = '22023', message = 'Invalid module status';
  end if;
  if published is distinct from (coalesce(lower(btrim(status)), case when published then 'published' else 'draft' end) = 'published') then
    raise exception using errcode = '22023', message = 'Published flag and module status are inconsistent';
  end if;
  result := public.set_module_publication(module_id, published);
  if not published and lower(btrim(coalesce(status, 'draft'))) = 'archived' then
    update public.training_modules as module
    set status = 'archived', updated_by = auth.uid()
    where module.id = manage_module.module_id;
    result := result || jsonb_build_object('status', 'archived');
  end if;
  return result;
end;
$$;

revoke all on function public.manage_module(uuid, boolean, text) from public, anon;
grant execute on function public.manage_module(uuid, boolean, text) to authenticated;

-- Upgrade the existing audited activity/scoring functions so any module with
-- private scenario keys follows the same protected decision path. The hazard
-- panorama remains the only special content type.
do $migration$
declare
  function_definition text;
  old_allowlist text := 'module_slug in (''manual-handling'', ''working-at-height'', ''cyber-awareness'')';
  keyed_scenarios text := 'exists (select 1 from private.activity_scenario_keys as configured_scenario where configured_scenario.module_id = record_training_activity.module_id)';
begin
  select pg_get_functiondef('public.record_training_activity(uuid,text,integer,text,jsonb)'::regprocedure)
  into function_definition;
  if position(old_allowlist in function_definition) > 0 then
    execute replace(function_definition, old_allowlist, keyed_scenarios);
  elsif position('configured_scenario.module_id = record_training_activity.module_id' in function_definition) = 0 then
    raise exception 'Could not locate the expected decision-module activity checks';
  end if;

  select pg_get_functiondef('public.submit_quiz(uuid,jsonb)'::regprocedure)
  into function_definition;
  function_definition := replace(
    function_definition,
    'module_record.slug in (''manual-handling'', ''working-at-height'', ''cyber-awareness'')',
    'exists (select 1 from private.activity_scenario_keys as configured_scenario where configured_scenario.module_id = submit_quiz.module_id)'
  );
  function_definition := replace(
    function_definition,
    'module_record.slug in (''manual-handling'', ''working-at-height'')',
    'exists (select 1 from private.activity_scenario_keys as configured_scenario where configured_scenario.module_id = submit_quiz.module_id)'
  );
  if position('configured_scenario.module_id = submit_quiz.module_id' in function_definition) = 0 then
    raise exception 'Could not locate the expected quiz activity-score check';
  end if;
  execute function_definition;
end
$migration$;

create or replace function public.record_decision_activity(
  module_id uuid,
  scenario_id text,
  selected_choice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  module_record record;
  scenario_record record;
  progress_result jsonb;
  persisted_record record;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'trainee'::public.app_role then
    raise exception using errcode = '42501', message = 'Active trainee access is required';
  end if;
  if scenario_id !~ '^[a-z0-9][a-z0-9-]{0,39}$'
    or selected_choice_id !~ '^[a-z0-9][a-z0-9_-]{0,19}$'
  then
    raise exception using errcode = '22023', message = 'The activity selection is invalid';
  end if;

  select module.slug into module_record
  from public.training_modules as module
  where module.id = record_decision_activity.module_id
    and module.is_published and module.status = 'published';
  if not found or module_record.slug = 'hazard-perception' then
    raise exception using errcode = '22023', message = 'Published decision module was not found';
  end if;

  select scenario.allowed_choice_ids, scenario.correct_choice_id, scenario.choice_feedback
  into scenario_record
  from private.activity_scenario_keys as scenario
  where scenario.module_id = record_decision_activity.module_id
    and scenario.scenario_id = record_decision_activity.scenario_id;
  if not found or not (selected_choice_id = any (scenario_record.allowed_choice_ids)) then
    raise exception using errcode = '22023', message = 'A recognised activity choice is required';
  end if;

  perform public.record_training_activity(
    module_id,
    'learning_completed',
    null,
    module_record.slug || ':learning',
    jsonb_build_object('source', 'safety360-web')
  );
  progress_result := public.record_training_activity(
    module_id,
    'activity_completed',
    null,
    scenario_id,
    jsonb_build_object('source', 'safety360-web', 'selectedChoiceId', selected_choice_id)
  );

  select activity.metadata ->> 'selectedChoiceId' as selected_choice,
         coalesce((activity.metadata ->> 'correct')::boolean, false) as correct
  into persisted_record
  from public.activity_log as activity
  where activity.user_id = auth.uid()
    and activity.module_id = record_decision_activity.module_id
    and activity.event_type = 'activity_completed'
    and activity.event_key = 'activity_completed:' || scenario_id;

  return progress_result || jsonb_build_object(
    'selectedChoiceId', persisted_record.selected_choice,
    'correct', persisted_record.correct,
    'feedback', coalesce(scenario_record.choice_feedback ->> persisted_record.selected_choice, '')
  );
end;
$$;

revoke all on function public.record_decision_activity(uuid, text, text) from public, anon;
grant execute on function public.record_decision_activity(uuid, text, text) to authenticated;

create or replace function public.decision_activity_progress(module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'trainee'::public.app_role then
    raise exception using errcode = '42501', message = 'Active trainee access is required';
  end if;
  if not exists (
    select 1 from public.training_modules as module
    where module.id = decision_activity_progress.module_id
      and module.is_published and module.status = 'published'
  ) then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'scenarioId', scenario.scenario_id,
      'selectedChoiceId', activity.metadata ->> 'selectedChoiceId',
      'correct', coalesce((activity.metadata ->> 'correct')::boolean, false),
      'feedback', coalesce(scenario.choice_feedback ->> (activity.metadata ->> 'selectedChoiceId'), '')
    ) order by scenario.sort_order)
    from private.activity_scenario_keys as scenario
    join public.activity_log as activity
      on activity.user_id = auth.uid()
      and activity.module_id = scenario.module_id
      and activity.event_type = 'activity_completed'
      and activity.event_key = 'activity_completed:' || scenario.scenario_id
    where scenario.module_id = decision_activity_progress.module_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.decision_activity_progress(uuid) from public, anon;
grant execute on function public.decision_activity_progress(uuid) to authenticated;

-- All authoring mutations now travel through the audited atomic RPCs above.
revoke insert, update, delete on table public.training_modules from authenticated;
revoke insert, update, delete on table public.quiz_questions from authenticated;

commit;
