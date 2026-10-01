begin;

-- Authored module activities share the existing protected scenario scoring path,
-- but expose a bounded presentation kind so the trainee UI can choose the right
-- interaction. Existing drafts without this field remain decision activities.
create or replace function private.materialise_module_draft(module_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition jsonb;
  readiness jsonb;
  activity_kind text;
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

  activity_kind := coalesce(nullif(definition ->> 'activityKind', ''), 'decision');
  if activity_kind not in (
    'decision',
    'forklift_precheck',
    'ppe_dress_up',
    'sorting_zone',
    'load_stacking'
  ) then
    raise exception using errcode = '23514', message = 'Choose a supported module activity type';
  end if;

  -- Only trainee-safe labels are materialised. Correctness and feedback remain
  -- exclusively in the private schema populated below.
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
        'schemaVersion', 2,
        'activityKind', activity_kind,
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

commit;
