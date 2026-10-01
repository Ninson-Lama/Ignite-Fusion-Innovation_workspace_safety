-- IFI Safety360 - controlled training writes, scoring, leaderboard and reports

begin;

create or replace function private.normalise_answer(answer jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalised jsonb;
begin
  if answer is null or jsonb_typeof(answer) <> 'array' then
    return null;
  end if;

  select coalesce(jsonb_agg(items.value order by items.value), '[]'::jsonb)
  into normalised
  from (
    select distinct element #>> '{}' as value
    from jsonb_array_elements(answer) as selected(element)
    where jsonb_typeof(element) = 'string'
  ) as items;

  return normalised;
end;
$$;

create or replace function private.answer_is_valid(
  available_options jsonb,
  answer_type public.quiz_question_type,
  selected_answer jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(available_options) = 'array'
    and jsonb_typeof(selected_answer) = 'array'
    and jsonb_array_length(selected_answer) between 1 and 10
    and (
      (answer_type in ('single_choice', 'true_false') and jsonb_array_length(selected_answer) = 1)
      or (answer_type = 'multiple_choice' and jsonb_array_length(selected_answer) >= 1)
    )
    and not exists (
      select 1
      from jsonb_array_elements(selected_answer) as selected(value)
      where jsonb_typeof(selected.value) <> 'string'
    )
    and jsonb_array_length(selected_answer) = (
      select count(distinct selected.value #>> '{}')
      from jsonb_array_elements(selected_answer) as selected(value)
    )
    and not exists (
      select 1
      from jsonb_array_elements(selected_answer) as selected(value)
      where not exists (
        select 1
        from jsonb_array_elements(available_options) as option(value)
        where jsonb_typeof(option.value) = 'object'
          and option.value ? 'id'
          and option.value ->> 'id' = selected.value #>> '{}'
      )
    ),
    false
  )
$$;

revoke all on function private.normalise_answer(jsonb) from public, anon, authenticated;
revoke all on function private.answer_is_valid(jsonb, public.quiz_question_type, jsonb) from public, anon, authenticated;

create or replace function private.validate_question_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_key jsonb;
begin
  if exists (
    select 1
    from jsonb_array_elements(new.options) as option(value)
    where jsonb_typeof(option.value) <> 'object'
      or not (option.value ? 'id')
      or not (option.value ? 'label')
      or char_length(btrim(option.value ->> 'id')) not between 1 and 40
      or char_length(btrim(option.value ->> 'label')) not between 1 and 300
  ) then
    raise exception using errcode = '23514', message = 'Every quiz option needs a short id and label';
  end if;

  if jsonb_array_length(new.options) <> (
    select count(distinct option.value ->> 'id')
    from jsonb_array_elements(new.options) as option(value)
  ) then
    raise exception using errcode = '23514', message = 'Quiz option ids must be unique';
  end if;

  if new.question_type = 'true_false'
    and (
      jsonb_array_length(new.options) <> 2
      or not (new.options @> '[{"id":"true"}]'::jsonb)
      or not (new.options @> '[{"id":"false"}]'::jsonb)
    )
  then
    raise exception using errcode = '23514', message = 'True/false questions require true and false options';
  end if;

  select answer_key.correct_answer
  into configured_key
  from private.quiz_answer_keys as answer_key
  where answer_key.question_id = new.id;

  if configured_key is not null
    and not private.answer_is_valid(new.options, new.question_type, configured_key)
  then
    raise exception using errcode = '23514', message = 'Question changes would invalidate its answer key';
  end if;

  return new;
end;
$$;

create or replace function private.validate_answer_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_question record;
begin
  select question.options, question.question_type
  into configured_question
  from public.quiz_questions as question
  where question.id = new.question_id;

  if not found or not private.answer_is_valid(
    configured_question.options,
    configured_question.question_type,
    new.correct_answer
  ) then
    raise exception using errcode = '23514', message = 'Answer key is invalid for its quiz question';
  end if;

  new.correct_answer := private.normalise_answer(new.correct_answer);
  return new;
end;
$$;

revoke all on function private.validate_question_configuration() from public, anon, authenticated;
revoke all on function private.validate_answer_key() from public, anon, authenticated;

drop trigger if exists quiz_questions_validate_configuration on public.quiz_questions;
create trigger quiz_questions_validate_configuration
before insert or update of options, question_type on public.quiz_questions
for each row execute function private.validate_question_configuration();

drop trigger if exists quiz_answer_keys_validate on private.quiz_answer_keys;
create trigger quiz_answer_keys_validate
before insert or update on private.quiz_answer_keys
for each row execute function private.validate_answer_key();

-- Reconcile completion from server-verifiable quiz state plus the two explicit
-- learning/activity milestones. This is called after either side changes, so a
-- learner who passes before finishing an activity completes once the activity is done.
create or replace function private.reconcile_module_completion(
  target_user_id uuid,
  target_module_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  progress_row public.module_progress%rowtype;
  has_passed boolean;
begin
  select progress.*
  into progress_row
  from public.module_progress as progress
  where progress.user_id = target_user_id
    and progress.module_id = target_module_id
  for update;

  if not found then
    return false;
  end if;

  select exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.user_id = target_user_id
      and attempt.module_id = target_module_id
      and attempt.passed
  )
  into has_passed;

  if progress_row.learning_complete
    and progress_row.activity_complete
    and has_passed
  then
    update public.module_progress
    set status = 'completed',
        progress_percent = 100,
        completed_at = coalesce(completed_at, now()),
        last_activity_at = now()
    where user_id = target_user_id
      and module_id = target_module_id;

    update public.module_assignments
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where user_id = target_user_id
      and module_id = target_module_id
      and status <> 'cancelled';

    insert into public.activity_log (
      user_id,
      actor_id,
      module_id,
      event_type,
      event_key,
      metadata
    )
    values (
      target_user_id,
      target_user_id,
      target_module_id,
      'module_completed',
      'module-completed',
      '{}'::jsonb
    )
    on conflict (user_id, module_id, event_key) where event_key is not null
    do nothing;

    return true;
  end if;

  update public.module_assignments
  set status = 'in_progress'
  where user_id = target_user_id
    and module_id = target_module_id
    and status = 'assigned';

  return false;
end;
$$;

revoke all on function private.reconcile_module_completion(uuid, uuid) from public, anon, authenticated;

-- Achievement codes are stable seed identifiers. New rows can be added without
-- granting learners any write path to earned-achievement relationships.
create or replace function private.award_eligible_achievements(
  target_user_id uuid,
  target_module_id uuid,
  source_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  awarded jsonb;
begin
  with eligible as (
    select achievement.id
    from public.achievements as achievement
    where achievement.is_active
      and (
        (
          achievement.code = 'first-assessment'
          and exists (
            select 1 from public.quiz_attempts as attempt
            where attempt.user_id = target_user_id
          )
        )
        or (
          achievement.code = 'perfect-assessment'
          and exists (
            select 1 from public.quiz_attempts as attempt
            where attempt.user_id = target_user_id and attempt.percentage = 100
          )
        )
        or (
          achievement.code = 'hazard-aware'
          and exists (
            select 1
            from public.module_progress as progress
            join public.training_modules as module on module.id = progress.module_id
            where progress.user_id = target_user_id
              and progress.status = 'completed'
              and module.slug = 'hazard-perception'
          )
        )
        or (
          achievement.code = 'handling-ready'
          and exists (
            select 1
            from public.module_progress as progress
            join public.training_modules as module on module.id = progress.module_id
            where progress.user_id = target_user_id
              and progress.status = 'completed'
              and module.slug = 'manual-handling'
          )
        )
        or (
          achievement.code = 'height-aware'
          and exists (
            select 1
            from public.module_progress as progress
            join public.training_modules as module on module.id = progress.module_id
            where progress.user_id = target_user_id
              and progress.status = 'completed'
              and module.slug = 'working-at-height'
          )
        )
        or (
          achievement.code = 'core-safety-complete'
          and (
            select count(*)
            from public.module_progress as progress
            join public.training_modules as module on module.id = progress.module_id
            where progress.user_id = target_user_id
              and progress.status = 'completed'
              and module.slug in ('hazard-perception', 'manual-handling', 'working-at-height')
          ) = 3
        )
      )
  ),
  inserted as (
    insert into public.user_achievements (
      user_id,
      achievement_id,
      source_attempt_id
    )
    select target_user_id, eligible.id, source_attempt_id
    from eligible
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id, earned_at
  ),
  logged as (
    insert into public.activity_log (
      user_id,
      actor_id,
      module_id,
      attempt_id,
      event_type,
      event_key,
      metadata
    )
    select
      target_user_id,
      target_user_id,
      target_module_id,
      source_attempt_id,
      'achievement_earned',
      'achievement:' || inserted.achievement_id::text,
      jsonb_build_object('achievementId', inserted.achievement_id)
    from inserted
    on conflict (user_id, module_id, event_key) where event_key is not null
    do nothing
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', achievement.id,
        'code', achievement.code,
        'title', achievement.title,
        'description', achievement.description,
        'icon', achievement.icon,
        'points', achievement.points,
        'earnedAt', inserted.earned_at
      )
      order by achievement.sort_order, achievement.title
    ),
    '[]'::jsonb
  )
  into awarded
  from inserted
  join public.achievements as achievement on achievement.id = inserted.achievement_id;

  return awarded;
end;
$$;

revoke all on function private.award_eligible_achievements(uuid, uuid, uuid) from public, anon, authenticated;

-- Narrow progress mutation surface. Arbitrary points, quiz results and completed
-- status are not client-writeable; callers can record only recognised milestones.
create or replace function public.record_training_activity(
  module_id uuid,
  event_type text,
  progress_percent integer default null,
  event_key text default null,
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  actor_status public.profile_status;
  module_slug text;
  module_scene jsonb;
  event_enum public.activity_event_type;
  desired_progress integer;
  milestone_key text;
  logged_metadata jsonb;
  scenario_record record;
  selected_choice_id text;
  selected_is_correct boolean := false;
  configured_activity_count integer := 0;
  activity_event_count integer := 0;
  activity_score_total integer := 0;
  best_quiz_points integer := 0;
  has_learning boolean := false;
  has_quiz_attempt boolean := false;
  should_complete_activity boolean := false;
  completed boolean;
  progress_row public.module_progress%rowtype;
  latest_attempt_id uuid;
  new_achievements jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  select profile.status
  into actor_status
  from public.profiles as profile
  where profile.id = v_actor_id;

  if actor_status is distinct from 'active' then
    raise exception using errcode = '42501', message = 'An active profile is required';
  end if;

  select module.slug, module.scene_config
  into module_slug, module_scene
  from public.training_modules as module
  where module.id = record_training_activity.module_id
    and module.status = 'published'
    and module.is_published;

  if not found then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  case event_type
    when 'module_started' then
      event_enum := 'module_started';
    when 'learning_completed' then
      event_enum := 'learning_completed';
    when 'activity_completed' then
      event_enum := 'activity_completed';
    else
      raise exception using errcode = '22023', message = 'Unsupported training event';
  end case;

  -- Kept in the signature for backwards-compatible PostgREST calls. Client
  -- progress is deliberately ignored; the database derives every stage below.

  if metadata is null
    or jsonb_typeof(metadata) <> 'object'
    or octet_length(metadata::text) > 4096
  then
    raise exception using errcode = '22023', message = 'Activity metadata must be a small JSON object';
  end if;

  if event_key is not null and event_key !~ '^[a-z0-9][a-z0-9:_-]{0,79}$' then
    raise exception using errcode = '22023', message = 'Invalid activity event key';
  end if;

  if module_slug = 'hazard-perception'
    and jsonb_typeof(module_scene -> 'hazards') is distinct from 'array'
  then
    raise exception using errcode = '22023', message = 'Hazard scene configuration is invalid';
  end if;

  if event_type = 'activity_completed' then
    if module_slug = 'hazard-perception' then
      if event_key is null
        or not exists (
          select 1
          from jsonb_array_elements(module_scene -> 'hazards') as hazard(value)
          where hazard.value ->> 'id' = event_key
        )
      then
        raise exception using errcode = '22023', message = 'A recognised hazard id is required';
      end if;

      logged_metadata := jsonb_build_object('hazardId', event_key);
    elsif module_slug in ('manual-handling', 'working-at-height', 'cyber-awareness') then
      select scenario.allowed_choice_ids, scenario.correct_choice_id, scenario.points
      into scenario_record
      from private.activity_scenario_keys as scenario
      where scenario.module_id = record_training_activity.module_id
        and scenario.scenario_id = event_key;

      if not found then
        raise exception using errcode = '22023', message = 'A recognised activity scenario id is required';
      end if;

      selected_choice_id := metadata ->> 'selectedChoiceId';
      if selected_choice_id is null
        or not (selected_choice_id = any (scenario_record.allowed_choice_ids))
      then
        raise exception using errcode = '22023', message = 'A recognised selectedChoiceId is required';
      end if;

      selected_is_correct := selected_choice_id = scenario_record.correct_choice_id;
      logged_metadata := jsonb_build_object(
        'scenarioId', event_key,
        'selectedChoiceId', selected_choice_id,
        'correct', selected_is_correct,
        'pointsAwarded', case when selected_is_correct then scenario_record.points else 0 end
      );
    else
      raise exception using errcode = '22023', message = 'The module has no configured activity events';
    end if;
  else
    logged_metadata := metadata;
  end if;

  milestone_key := case event_type
    when 'module_started' then 'module_started'
    when 'learning_completed' then 'learning_completed'
    else 'activity_completed:' || event_key
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor_id::text || ':' || module_id::text, 0)
  );

  insert into public.activity_log (
    user_id,
    actor_id,
    module_id,
    event_type,
    event_key,
    metadata
  )
  values (
    v_actor_id,
    v_actor_id,
    module_id,
    event_enum,
    milestone_key,
    logged_metadata
  )
  on conflict do nothing;

  if module_slug = 'hazard-perception' then
    select count(distinct hazard.value ->> 'id')
    into configured_activity_count
    from jsonb_array_elements(module_scene -> 'hazards') as hazard(value);

    select count(distinct hazard.value ->> 'id')
    into activity_event_count
    from jsonb_array_elements(module_scene -> 'hazards') as hazard(value)
    where exists (
      select 1
      from public.activity_log as activity
      where activity.user_id = v_actor_id
        and activity.module_id = record_training_activity.module_id
        and activity.event_type = 'activity_completed'
        and activity.event_key = 'activity_completed:' || (hazard.value ->> 'id')
    );

    activity_score_total := least(activity_event_count, configured_activity_count) * 100;
  elsif module_slug in ('manual-handling', 'working-at-height', 'cyber-awareness') then
    select count(*)
    into configured_activity_count
    from private.activity_scenario_keys as scenario
    where scenario.module_id = record_training_activity.module_id;

    select
      count(*),
      coalesce(
        sum(
          case
            when activity.metadata ->> 'selectedChoiceId' = scenario.correct_choice_id
              then scenario.points
            else 0
          end
        ),
        0
      )
    into activity_event_count, activity_score_total
    from private.activity_scenario_keys as scenario
    join public.activity_log as activity
      on activity.user_id = v_actor_id
      and activity.module_id = scenario.module_id
      and activity.event_type = 'activity_completed'
      and activity.event_key = 'activity_completed:' || scenario.scenario_id
    where scenario.module_id = record_training_activity.module_id;
  end if;

  should_complete_activity := configured_activity_count > 0
    and activity_event_count >= configured_activity_count;

  select
    coalesce(progress.learning_complete, false)
      or exists (
        select 1
        from public.activity_log as activity
        where activity.user_id = v_actor_id
          and activity.module_id = record_training_activity.module_id
          and activity.event_type = 'learning_completed'
      )
  into has_learning
  from (values (1)) as singleton(value)
  left join public.module_progress as progress
    on progress.user_id = v_actor_id
    and progress.module_id = record_training_activity.module_id;

  select
    coalesce(max(attempt.points_earned), 0),
    count(*) > 0
  into best_quiz_points, has_quiz_attempt
  from public.quiz_attempts as attempt
  where attempt.user_id = v_actor_id
    and attempt.module_id = record_training_activity.module_id;

  desired_progress := least(
    90,
    5
      + case when has_learning then 40 else 0 end
      + case
          when configured_activity_count > 0
            then floor(
              30::numeric * activity_event_count / configured_activity_count
            )::integer
          else 0
        end
      + case when has_quiz_attempt then 15 else 0 end
  );

  insert into public.module_progress (
    user_id,
    module_id,
    progress_percent,
    status,
    learning_complete,
    activity_complete,
    points_earned,
    started_at,
    last_activity_at
  )
  values (
    v_actor_id,
    module_id,
    desired_progress,
    'in_progress',
    has_learning,
    should_complete_activity,
    activity_score_total + best_quiz_points,
    now(),
    now()
  )
  on conflict on constraint module_progress_user_module_unique do update
  set progress_percent = case
        when public.module_progress.status = 'completed' then 100
        else greatest(public.module_progress.progress_percent, excluded.progress_percent)
      end,
      status = case
        when public.module_progress.status = 'completed' then 'completed'::public.progress_status
        else 'in_progress'::public.progress_status
      end,
      learning_complete = public.module_progress.learning_complete or excluded.learning_complete,
      activity_complete = public.module_progress.activity_complete or excluded.activity_complete,
      points_earned = greatest(public.module_progress.points_earned, excluded.points_earned),
      started_at = coalesce(public.module_progress.started_at, now()),
      last_activity_at = now();

  completed := private.reconcile_module_completion(v_actor_id, module_id);

  select attempt.id
  into latest_attempt_id
  from public.quiz_attempts as attempt
  where attempt.user_id = v_actor_id and attempt.module_id = record_training_activity.module_id
  order by attempt.completed_at desc
  limit 1;

  new_achievements := private.award_eligible_achievements(
    v_actor_id,
    module_id,
    latest_attempt_id
  );

  select progress.*
  into progress_row
  from public.module_progress as progress
  where progress.user_id = v_actor_id and progress.module_id = record_training_activity.module_id;

  return jsonb_build_object(
    'moduleId', module_id,
    'progressPercent', progress_row.progress_percent,
    'status', progress_row.status,
    'learningComplete', progress_row.learning_complete,
    'activityComplete', progress_row.activity_complete,
    'activityScore', activity_score_total,
    'pointsEarned', progress_row.points_earned,
    'moduleCompleted', completed,
    'newAchievements', new_achievements
  );
end;
$$;

revoke all on function public.record_training_activity(uuid, text, integer, text, jsonb) from public, anon;
grant execute on function public.record_training_activity(uuid, text, integer, text, jsonb) to authenticated;

-- Immediate feedback without exposing private.quiz_answer_keys. This deliberately
-- returns only correctness and authored explanation; raw key values stay private.
create or replace function public.check_quiz_answer(
  question_id uuid,
  selected_answer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  question_record record;
  normalised_selection jsonb;
  locked_selection jsonb;
  is_correct boolean;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.id = v_actor_id and profile.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'An active profile is required';
  end if;

  select
    question.module_id,
    question.options,
    question.question_type,
    question.explanation,
    answer_key.correct_answer
  into question_record
  from public.quiz_questions as question
  join public.training_modules as module on module.id = question.module_id
  join private.quiz_answer_keys as answer_key on answer_key.question_id = question.id
  where question.id = check_quiz_answer.question_id
    and question.is_active
    and module.is_published
    and module.status = 'published';

  if not found then
    raise exception using errcode = '22023', message = 'Active quiz question was not found';
  end if;

  if not private.answer_is_valid(
    question_record.options,
    question_record.question_type,
    selected_answer
  ) then
    raise exception using errcode = '22023', message = 'Selected answer is invalid for this question';
  end if;

  normalised_selection := private.normalise_answer(selected_answer);

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor_id::text || ':' || question_record.module_id::text, 0)
  );

  delete from private.quiz_answer_locks as answer_lock
  where answer_lock.user_id = v_actor_id
    and answer_lock.module_id = question_record.module_id
    and answer_lock.expires_at <= now();

  insert into private.quiz_answer_locks (
    user_id,
    module_id,
    question_id,
    selected_answer,
    expires_at
  )
  values (
    v_actor_id,
    question_record.module_id,
    check_quiz_answer.question_id,
    normalised_selection,
    now() + interval '2 hours'
  )
  on conflict on constraint quiz_answer_locks_pkey do nothing;

  select answer_lock.selected_answer
  into locked_selection
  from private.quiz_answer_locks as answer_lock
  where answer_lock.user_id = v_actor_id
    and answer_lock.question_id = check_quiz_answer.question_id
  for update;

  if locked_selection is distinct from normalised_selection then
    raise exception using
      errcode = '22023',
      message = 'This question already has a checked answer for the active assessment';
  end if;

  is_correct := normalised_selection
    = private.normalise_answer(question_record.correct_answer);

  return jsonb_build_object(
    'correct', is_correct,
    'explanation', question_record.explanation
  );
end;
$$;

revoke all on function public.check_quiz_answer(uuid, jsonb) from public, anon;
grant execute on function public.check_quiz_answer(uuid, jsonb) to authenticated;

-- Stable question-loading contract for clients. Authored explanations are omitted
-- here and become available only through answer checking/final submission feedback.
do $$
begin
  create type public.quiz_question_public as (
    id uuid,
    module_id uuid,
    question_type public.quiz_question_type,
    prompt text,
    options jsonb,
    points smallint,
    sort_order integer
  );
exception when duplicate_object then null;
end
$$;

grant usage on type public.quiz_question_public to authenticated;

create or replace function public.quiz_questions_for_module(module_id uuid)
returns setof public.quiz_question_public
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is null then
    raise exception using errcode = '42501', message = 'An active authenticated profile is required';
  end if;

  if not exists (
    select 1
    from public.training_modules as module
    where module.id = quiz_questions_for_module.module_id
      and module.is_published
      and module.status = 'published'
  ) then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  return query
  select
    question.id,
    question.module_id,
    question.question_type,
    question.prompt,
    question.options,
    question.points,
    question.sort_order
  from public.quiz_questions as question
  where question.module_id = quiz_questions_for_module.module_id
    and question.is_active
  order by question.sort_order, question.id;
end;
$$;

revoke all on function public.quiz_questions_for_module(uuid) from public, anon;
grant execute on function public.quiz_questions_for_module(uuid) to authenticated;

-- Final authoritative scoring. All active questions must be answered exactly once.
-- Attempts, progress, assignments, activity, points and achievements commit together.
create or replace function public.submit_quiz(
  module_id uuid,
  submitted_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  module_record record;
  question_record record;
  selected jsonb;
  is_correct boolean;
  question_count integer;
  supplied_count integer;
  processed_count integer := 0;
  score_total integer := 0;
  max_total integer := 0;
  percentage_total numeric(5,2);
  passed_result boolean;
  attempt_points integer;
  activity_score_total integer := 0;
  next_attempt integer;
  attempt_id uuid;
  attempt_started_at timestamptz;
  feedback_items jsonb := '[]'::jsonb;
  completed boolean;
  progress_row public.module_progress%rowtype;
  new_achievements jsonb;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if not exists (
    select 1 from public.profiles as profile
    where profile.id = v_actor_id and profile.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'An active profile is required';
  end if;

  select module.id, module.slug, module.pass_mark, module.points_available, module.scene_config
  into module_record
  from public.training_modules as module
  where module.id = submit_quiz.module_id
    and module.is_published
    and module.status = 'published';

  if not found then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_actor_id::text || ':' || module_id::text, 0)
  );

  if submitted_answers is null or jsonb_typeof(submitted_answers) <> 'object' then
    raise exception using errcode = '22023', message = 'Submitted answers must be a JSON object';
  end if;

  select count(*)
  into question_count
  from public.quiz_questions as question
  where question.module_id = submit_quiz.module_id and question.is_active;

  select count(*)
  into supplied_count
  from jsonb_object_keys(submitted_answers);

  if question_count = 0 then
    raise exception using errcode = '22023', message = 'This module has no active quiz questions';
  end if;

  if supplied_count <> question_count
    or exists (
      select 1
      from jsonb_object_keys(submitted_answers) as supplied(question_key)
      where not exists (
        select 1
        from public.quiz_questions as question
        where question.module_id = submit_quiz.module_id
          and question.is_active
          and question.id::text = supplied.question_key
      )
    )
  then
    raise exception using errcode = '22023', message = 'Every active question must be answered exactly once';
  end if;

  delete from private.quiz_answer_locks as answer_lock
  where answer_lock.user_id = v_actor_id
    and answer_lock.module_id = submit_quiz.module_id
    and answer_lock.expires_at <= now();

  if exists (
    select 1
    from public.quiz_questions as question
    left join private.quiz_answer_locks as answer_lock
      on answer_lock.user_id = v_actor_id
      and answer_lock.module_id = question.module_id
      and answer_lock.question_id = question.id
      and answer_lock.expires_at > now()
    where question.module_id = submit_quiz.module_id
      and question.is_active
      and (
        answer_lock.question_id is null
        or answer_lock.selected_answer is distinct from private.normalise_answer(
          submitted_answers -> question.id::text
        )
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every submitted answer must match its first checked selection';
  end if;

  select least(coalesce(min(answer_lock.created_at), now()), now())
  into attempt_started_at
  from private.quiz_answer_locks as answer_lock
  join public.quiz_questions as question
    on question.id = answer_lock.question_id
    and question.module_id = answer_lock.module_id
    and question.is_active
  where answer_lock.user_id = v_actor_id
    and answer_lock.module_id = submit_quiz.module_id
    and answer_lock.expires_at > now()
    and answer_lock.selected_answer = private.normalise_answer(
      submitted_answers -> question.id::text
    );

  for question_record in
    select
      question.id,
      question.options,
      question.question_type,
      question.explanation,
      question.points,
      answer_key.correct_answer
    from public.quiz_questions as question
    join private.quiz_answer_keys as answer_key on answer_key.question_id = question.id
    where question.module_id = submit_quiz.module_id
      and question.is_active
    order by question.sort_order, question.id
  loop
    processed_count := processed_count + 1;
    selected := submitted_answers -> question_record.id::text;

    if not private.answer_is_valid(
      question_record.options,
      question_record.question_type,
      selected
    ) then
      raise exception using errcode = '22023', message = 'One or more selected answers are invalid';
    end if;

    is_correct := private.normalise_answer(selected)
      = private.normalise_answer(question_record.correct_answer);
    max_total := max_total + question_record.points;

    if is_correct then
      score_total := score_total + question_record.points;
    end if;

    feedback_items := feedback_items || jsonb_build_array(
      jsonb_build_object(
        'questionId', question_record.id,
        'correct', is_correct,
        'explanation', question_record.explanation
      )
    );
  end loop;

  if processed_count <> question_count then
    raise exception using errcode = '22023', message = 'One or more quiz answer keys are not configured';
  end if;

  if max_total <= 0 then
    raise exception using errcode = '22023', message = 'Quiz scoring configuration is invalid';
  end if;

  percentage_total := round((score_total::numeric / max_total::numeric) * 100, 2);
  passed_result := percentage_total >= module_record.pass_mark;
  attempt_points := round(
    module_record.points_available::numeric * percentage_total / 100
  )::integer;

  if module_record.slug = 'hazard-perception'
    and jsonb_typeof(module_record.scene_config -> 'hazards') = 'array'
  then
    select count(distinct hazard.value ->> 'id') * 100
    into activity_score_total
    from jsonb_array_elements(module_record.scene_config -> 'hazards') as hazard(value)
    where exists (
      select 1
      from public.activity_log as activity
      where activity.user_id = v_actor_id
        and activity.module_id = submit_quiz.module_id
        and activity.event_type = 'activity_completed'
        and activity.event_key = 'activity_completed:' || (hazard.value ->> 'id')
    );
  elsif module_record.slug in ('manual-handling', 'working-at-height') then
    select coalesce(
      sum(
        case
          when activity.metadata ->> 'selectedChoiceId' = scenario.correct_choice_id
            then scenario.points
          else 0
        end
      ),
      0
    )
    into activity_score_total
    from private.activity_scenario_keys as scenario
    join public.activity_log as activity
      on activity.user_id = v_actor_id
      and activity.module_id = scenario.module_id
      and activity.event_type = 'activity_completed'
      and activity.event_key = 'activity_completed:' || scenario.scenario_id
    where scenario.module_id = submit_quiz.module_id;
  end if;

  select coalesce(max(attempt.attempt_number), 0) + 1
  into next_attempt
  from public.quiz_attempts as attempt
  where attempt.user_id = v_actor_id and attempt.module_id = submit_quiz.module_id;

  insert into public.quiz_attempts (
    user_id,
    module_id,
    attempt_number,
    score,
    max_score,
    percentage,
    passed,
    activity_score,
    points_earned,
    submitted_answers,
    feedback,
    started_at
  )
  values (
    v_actor_id,
    module_id,
    next_attempt,
    score_total,
    max_total,
    percentage_total,
    passed_result,
    activity_score_total,
    attempt_points,
    submitted_answers,
    feedback_items,
    attempt_started_at
  )
  returning id into attempt_id;

  delete from private.quiz_answer_locks as answer_lock
  where answer_lock.user_id = v_actor_id
    and answer_lock.module_id = submit_quiz.module_id;

  insert into public.module_progress (
    user_id,
    module_id,
    progress_percent,
    status,
    points_earned,
    started_at,
    last_activity_at
  )
  values (
    v_actor_id,
    module_id,
    case when passed_result then 90 else 70 end,
    'in_progress',
    activity_score_total + attempt_points,
    now(),
    now()
  )
  on conflict on constraint module_progress_user_module_unique do update
  set progress_percent = case
        when public.module_progress.status = 'completed' then 100
        else greatest(
          public.module_progress.progress_percent,
          excluded.progress_percent
        )
      end,
      status = case
        when public.module_progress.status = 'completed' then 'completed'::public.progress_status
        else 'in_progress'::public.progress_status
      end,
      points_earned = greatest(public.module_progress.points_earned, excluded.points_earned),
      started_at = coalesce(public.module_progress.started_at, now()),
      last_activity_at = now();

  insert into public.activity_log (
    user_id,
    actor_id,
    module_id,
    attempt_id,
    event_type,
    event_key,
    metadata
  )
  values (
    v_actor_id,
    v_actor_id,
    module_id,
    attempt_id,
    'quiz_completed',
    'quiz-attempt:' || attempt_id::text,
    jsonb_build_object(
      'attemptNumber', next_attempt,
      'percentage', percentage_total,
      'passed', passed_result
    )
  );

  completed := private.reconcile_module_completion(v_actor_id, module_id);
  new_achievements := private.award_eligible_achievements(v_actor_id, module_id, attempt_id);

  select progress.*
  into progress_row
  from public.module_progress as progress
  where progress.user_id = v_actor_id and progress.module_id = submit_quiz.module_id;

  return jsonb_build_object(
    'attemptId', attempt_id,
    'attemptNumber', next_attempt,
    'score', score_total,
    'maxScore', max_total,
    'percentage', percentage_total,
    'passed', passed_result,
    'pointsEarned', attempt_points,
    'activityScore', activity_score_total,
    'moduleCompleted', completed,
    'progressPercent', progress_row.progress_percent,
    'feedback', feedback_items,
    'newAchievements', new_achievements
  );
end;
$$;

revoke all on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Historical results remain readable after a module is unpublished or archived.
-- The function bypasses catalogue RLS only after authorising the attempt owner or
-- a department-scoped manager/admin, and omits answers, feedback and private keys.
create or replace function public.quiz_attempt_result(attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  result jsonb;
begin
  if v_actor_id is null or public.current_app_role() is null then
    raise exception using errcode = '42501', message = 'An active authenticated profile is required';
  end if;

  select jsonb_build_object(
    'id', attempt.id,
    'user_id', attempt.user_id,
    'module_id', attempt.module_id,
    'attempt_number', attempt.attempt_number,
    'score', attempt.score,
    'max_score', attempt.max_score,
    'percentage', attempt.percentage,
    'passed', attempt.passed,
    'activity_score', attempt.activity_score,
    'points_earned', attempt.points_earned,
    'started_at', attempt.started_at,
    'completed_at', attempt.completed_at,
    'module_slug', module.slug,
    'module_title', module.title
  )
  into result
  from public.quiz_attempts as attempt
  join public.training_modules as module on module.id = attempt.module_id
  where attempt.id = quiz_attempt_result.attempt_id
    and (
      attempt.user_id = v_actor_id
      or public.can_manage_user(attempt.user_id)
      or public.is_admin()
    );

  return result;
end;
$$;

revoke all on function public.quiz_attempt_result(uuid) from public, anon;
grant execute on function public.quiz_attempt_result(uuid) to authenticated;

create or replace function private.leaderboard_display_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when full_name is null or btrim(full_name) = '' then 'Safety learner'
    when cardinality(regexp_split_to_array(btrim(full_name), '\s+')) = 1
      then left(btrim(full_name), 30)
    else
      left((regexp_split_to_array(btrim(full_name), '\s+'))[1], 30)
      || ' '
      || upper(left(
        (regexp_split_to_array(btrim(full_name), '\s+'))[
          cardinality(regexp_split_to_array(btrim(full_name), '\s+'))
        ],
        1
      ))
      || '.'
  end
$$;

revoke all on function private.leaderboard_display_name(text) from public, anon, authenticated;

-- Privacy-limited leaderboard: no email, employee number, department or raw profile.
create or replace function public.leaderboard_snapshot()
returns table (
  user_id uuid,
  display_name text,
  points bigint,
  completed_modules bigint,
  achievement text,
  rank bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is null then
    raise exception using errcode = '42501', message = 'An active authenticated profile is required';
  end if;

  return query
  with progress_totals as (
    select
      progress.user_id,
      coalesce(sum(progress.points_earned), 0)::bigint as points,
      count(*) filter (where progress.status = 'completed')::bigint as completions
    from public.module_progress as progress
    group by progress.user_id
  ),
  achievement_totals as (
    select
      earned.user_id,
      coalesce(sum(achievement.points), 0)::bigint as bonus,
      (array_agg(
        achievement.title
        order by achievement.points desc, earned.earned_at desc, achievement.title
      ))[1] as top_title
    from public.user_achievements as earned
    join public.achievements as achievement on achievement.id = earned.achievement_id
    group by earned.user_id
  ),
  scores as (
    select
      profile.id as user_id,
      private.leaderboard_display_name(profile.full_name) as display_name,
      coalesce(progress_totals.points, 0) + coalesce(achievement_totals.bonus, 0) as total_points,
      coalesce(progress_totals.completions, 0) as completed_modules,
      achievement_totals.top_title as top_achievement
    from public.profiles as profile
    left join progress_totals on progress_totals.user_id = profile.id
    left join achievement_totals on achievement_totals.user_id = profile.id
    where profile.role = 'trainee' and profile.status = 'active'
  )
  select
    scores.user_id,
    scores.display_name,
    scores.total_points,
    scores.completed_modules,
    scores.top_achievement,
    dense_rank() over (
      order by scores.total_points desc, scores.completed_modules desc
    )::bigint as rank
  from scores
  order by 6, scores.display_name, scores.user_id;
end;
$$;

revoke all on function public.leaderboard_snapshot() from public, anon;
grant execute on function public.leaderboard_snapshot() to authenticated;

-- Aggregated management data is calculated inside the caller's permitted scope.
-- Managers receive their department's trainees; administrators receive all trainees.
create or replace function public.reports_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_department text;
  result jsonb;
begin
  select profile.role::text, profile.department
  into actor_role, actor_department
  from public.profiles as profile
  where profile.id = actor_id and profile.status = 'active';

  if actor_role is null or actor_role not in ('manager', 'admin') then
    raise exception using errcode = '42501', message = 'Manager or administrator access is required';
  end if;

  with scoped_users as (
    select profile.id
    from public.profiles as profile
    where profile.role = 'trainee'
      and profile.status = 'active'
      and (
        actor_role = 'admin'
        or (
          actor_department is not null
          and profile.department is not null
          and lower(btrim(profile.department)) = lower(btrim(actor_department))
        )
      )
  ),
  scoped_assignments as (
    select assignment.*
    from public.module_assignments as assignment
    join scoped_users on scoped_users.id = assignment.user_id
    where assignment.status <> 'cancelled'
  ),
  latest_attempts as (
    select distinct on (attempt.user_id, attempt.module_id)
      attempt.user_id,
      attempt.module_id,
      attempt.percentage,
      attempt.passed
    from public.quiz_attempts as attempt
    join scoped_users on scoped_users.id = attempt.user_id
    order by attempt.user_id, attempt.module_id, attempt.completed_at desc
  ),
  figures as (
    select
      (select count(*) from scoped_users) as total_trainees,
      (select count(*) from scoped_assignments) as total_assignments,
      (select count(*) from scoped_assignments where status = 'completed') as completed_assignments,
      (
        select count(*) from scoped_assignments
        where due_date < current_date and status in ('assigned', 'in_progress')
      ) as overdue_assignments,
      (select round(avg(percentage), 2) from latest_attempts) as average_percentage,
      (
        select count(distinct scoped_users.id)
        from scoped_users
        where exists (
          select 1 from scoped_assignments
          where scoped_assignments.user_id = scoped_users.id
            and scoped_assignments.due_date < current_date
            and scoped_assignments.status in ('assigned', 'in_progress')
        )
        or exists (
          select 1 from latest_attempts
          where latest_attempts.user_id = scoped_users.id
            and not latest_attempts.passed
        )
      ) as users_requiring_review
  )
  select jsonb_build_object(
    'scope', case when actor_role = 'admin' then 'organisation' else 'department' end,
    'department', case when actor_role = 'manager' then actor_department else null end,
    'totalTrainees', figures.total_trainees,
    'totalAssignments', figures.total_assignments,
    'completedAssignments', figures.completed_assignments,
    'overdueAssignments', figures.overdue_assignments,
    'completionRate', case
      when figures.total_assignments = 0 then 0
      else round(figures.completed_assignments::numeric * 100 / figures.total_assignments, 2)
    end,
    'averageQuizPercentage', figures.average_percentage,
    'usersRequiringReview', figures.users_requiring_review,
    'generatedAt', now()
  )
  into result
  from figures;

  return result;
end;
$$;

revoke all on function public.reports_summary() from public, anon;
grant execute on function public.reports_summary() to authenticated;

-- Publishing requires a trusted admin role and updates the three linked fields
-- atomically, avoiding inconsistent status/is_published combinations.
create or replace function public.set_module_publication(
  module_id uuid,
  published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_module public.training_modules%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  if published is null then
    raise exception using errcode = '22023', message = 'Published flag is required';
  end if;

  if not published then
    perform pg_advisory_xact_lock(
      hashtextextended('module-assignment:' || module_id::text, 0)
    );
  end if;

  update public.training_modules as module
  set is_published = published,
      status = case when published then 'published'::public.module_status else 'draft'::public.module_status end,
      published_at = case when published then coalesce(module.published_at, now()) else null end,
      updated_by = auth.uid()
  where module.id = set_module_publication.module_id
  returning module.* into updated_module;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;

  return jsonb_build_object(
    'id', updated_module.id,
    'slug', updated_module.slug,
    'status', updated_module.status,
    'isPublished', updated_module.is_published,
    'publishedAt', updated_module.published_at
  );
end;
$$;

revoke all on function public.set_module_publication(uuid, boolean) from public, anon;
grant execute on function public.set_module_publication(uuid, boolean) to authenticated;

-- Administration helpers provide a smaller, auditable mutation contract than a
-- broad client-side profile update. The final active administrator cannot remove
-- their own last-admin protection accidentally.
create or replace function public.admin_update_profile(
  target_user_id uuid,
  new_role text,
  new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile public.profiles%rowtype;
  desired_role public.app_role;
  desired_status public.profile_status;
  other_active_admins integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  if new_role is null or lower(btrim(new_role)) not in ('trainee', 'manager', 'admin') then
    raise exception using errcode = '22023', message = 'Invalid application role';
  end if;

  if new_status is null or lower(btrim(new_status)) not in ('active', 'inactive', 'suspended') then
    raise exception using errcode = '22023', message = 'Invalid profile status';
  end if;

  desired_role := lower(btrim(new_role))::public.app_role;
  desired_status := lower(btrim(new_status))::public.profile_status;

  select profile.*
  into target_profile
  from public.profiles as profile
  where profile.id = admin_update_profile.target_user_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Profile was not found';
  end if;

  if target_profile.role = 'admin'
    and target_profile.status = 'active'
    and (desired_role <> 'admin' or desired_status <> 'active')
  then
    select count(*)
    into other_active_admins
    from public.profiles as profile
    where profile.id <> target_user_id
      and profile.role = 'admin'
      and profile.status = 'active';

    if other_active_admins = 0 then
      raise exception using errcode = '23514', message = 'The final active administrator cannot be demoted or disabled';
    end if;
  end if;

  update public.profiles as profile
  set role = desired_role,
      status = desired_status
  where profile.id = admin_update_profile.target_user_id
  returning profile.* into target_profile;

  return jsonb_build_object(
    'id', target_profile.id,
    'fullName', target_profile.full_name,
    'employeeNumber', target_profile.employee_number,
    'department', target_profile.department,
    'role', target_profile.role,
    'status', target_profile.status,
    'updatedAt', target_profile.updated_at
  );
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, text) from public, anon;
grant execute on function public.admin_update_profile(uuid, text, text) to authenticated;

create or replace function public.manage_module(
  module_id uuid,
  published boolean,
  status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_status public.module_status;
  updated_module public.training_modules%rowtype;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  if published is null then
    raise exception using errcode = '22023', message = 'Published flag is required';
  end if;

  if status is null then
    desired_status := case
      when published then 'published'::public.module_status
      else 'draft'::public.module_status
    end;
  elsif lower(btrim(status)) in ('draft', 'published', 'archived') then
    desired_status := lower(btrim(status))::public.module_status;
  else
    raise exception using errcode = '22023', message = 'Invalid module status';
  end if;

  if published is distinct from (desired_status = 'published') then
    raise exception using errcode = '22023', message = 'Published flag and module status are inconsistent';
  end if;

  if not published then
    perform pg_advisory_xact_lock(
      hashtextextended('module-assignment:' || module_id::text, 0)
    );
  end if;

  update public.training_modules as module
  set status = desired_status,
      is_published = published,
      published_at = case
        when published then coalesce(module.published_at, now())
        else null
      end,
      updated_by = auth.uid()
  where module.id = manage_module.module_id
  returning module.* into updated_module;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;

  return jsonb_build_object(
    'id', updated_module.id,
    'slug', updated_module.slug,
    'status', updated_module.status,
    'isPublished', updated_module.is_published,
    'publishedAt', updated_module.published_at,
    'updatedAt', updated_module.updated_at
  );
end;
$$;

revoke all on function public.manage_module(uuid, boolean, text) from public, anon;
grant execute on function public.manage_module(uuid, boolean, text) to authenticated;

commit;
