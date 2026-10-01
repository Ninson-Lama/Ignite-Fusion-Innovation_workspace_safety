-- Durable trainee resume checkpoints and assignment notification state.

begin;

alter table public.module_progress
  add column if not exists resume_stage text not null default 'overview',
  add column if not exists resume_position smallint not null default 0;

do $$
begin
  alter table public.module_progress
    add constraint module_progress_resume_stage_check
    check (resume_stage in ('overview', 'learning', 'activity', 'quiz', 'completed'));
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.module_progress
    add constraint module_progress_resume_position_check
    check (resume_position between 0 and 100);
exception when duplicate_object then null;
end
$$;

-- Derive a sensible resume point for progress created before checkpoints
-- existed. Activity and quiz pages restore the exact completed items.
update public.module_progress
set resume_stage = case
      when status = 'completed' then 'completed'
      when activity_complete then 'quiz'
      when learning_complete then 'activity'
      when progress_percent > 5 then 'learning'
      else 'overview'
    end,
    resume_position = case
      when status = 'completed' then 100
      when activity_complete or learning_complete then 0
      when progress_percent > 5 then least(
        100,
        greatest(1, round(((progress_percent - 5)::numeric / 40) * 100)::integer)
      )
      else 0
    end
where resume_stage = 'overview'
  and resume_position = 0
  and progress_percent > 0;

alter table public.module_assignments
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_read_at timestamptz;

-- Existing assignments pre-date the notification centre and should not appear
-- as a burst of new notifications when this migration is applied.
update public.module_assignments
set notification_sent_at = coalesce(notification_sent_at, assigned_at),
    notification_read_at = coalesce(notification_read_at, assigned_at)
where notification_sent_at is null or notification_read_at is null;

alter table public.module_assignments
  alter column notification_sent_at set default now(),
  alter column notification_sent_at set not null;

create index if not exists module_assignments_user_unread_notification_idx
  on public.module_assignments (user_id, notification_sent_at desc)
  where notification_read_at is null and status <> 'cancelled';

create or replace function private.keep_completed_resume_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.resume_stage := 'completed';
    new.resume_position := 100;
  elsif new.resume_stage = 'completed' then
    new.resume_stage := 'quiz';
    new.resume_position := 100;
  end if;
  return new;
end;
$$;

revoke all on function private.keep_completed_resume_state() from public, anon, authenticated;

drop trigger if exists module_progress_keep_completed_resume_state on public.module_progress;
create trigger module_progress_keep_completed_resume_state
before insert or update of status, resume_stage, resume_position on public.module_progress
for each row execute function private.keep_completed_resume_state();

create or replace function public.save_training_checkpoint(
  module_id uuid,
  stage text,
  checkpoint_position integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  module_slug text;
  desired_progress integer;
  learning_finished boolean;
  existing_progress public.module_progress%rowtype;
  saved_progress public.module_progress%rowtype;
begin
  if actor_id is null
    or public.current_app_role() is distinct from 'trainee'::public.app_role
  then
    raise exception using errcode = '42501', message = 'Active trainee access is required';
  end if;

  if stage is null
    or stage not in ('overview', 'learning', 'activity', 'quiz')
    or checkpoint_position is null
    or checkpoint_position not between 0 and 100
  then
    raise exception using errcode = '22023', message = 'The training checkpoint is invalid';
  end if;

  select module.slug
  into module_slug
  from public.training_modules as module
  where module.id = save_training_checkpoint.module_id
    and module.status = 'published'
    and module.is_published;

  if not found then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor_id::text || ':' || module_id::text, 0)
  );

  select progress.*
  into existing_progress
  from public.module_progress as progress
  where progress.user_id = actor_id
    and progress.module_id = save_training_checkpoint.module_id
  for update;

  if stage = 'quiz'
    and (not found or not coalesce(existing_progress.activity_complete, false))
  then
    raise exception using errcode = '23514', message = 'Complete the activity before starting the knowledge check';
  end if;

  learning_finished := stage in ('activity', 'quiz')
    or (stage = 'learning' and checkpoint_position = 100);

  desired_progress := case stage
    when 'overview' then 5
    when 'learning' then 5 + floor(40::numeric * checkpoint_position / 100)::integer
    when 'activity' then 45
    when 'quiz' then 75
  end;

  insert into public.activity_log (
    user_id, actor_id, module_id, event_type, event_key, metadata
  ) values (
    actor_id, actor_id, module_id, 'module_started', 'module_started',
    jsonb_build_object('source', 'safety360-web')
  ) on conflict do nothing;

  if learning_finished then
    insert into public.activity_log (
      user_id, actor_id, module_id, event_type, event_key, metadata
    ) values (
      actor_id, actor_id, module_id, 'learning_completed', 'learning_completed',
      jsonb_build_object('source', 'safety360-web')
    ) on conflict do nothing;
  end if;

  insert into public.module_progress (
    user_id,
    module_id,
    progress_percent,
    status,
    learning_complete,
    activity_complete,
    points_earned,
    started_at,
    last_activity_at,
    resume_stage,
    resume_position
  ) values (
    actor_id,
    module_id,
    desired_progress,
    'in_progress',
    learning_finished,
    false,
    0,
    now(),
    now(),
    stage,
    checkpoint_position
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
      started_at = coalesce(public.module_progress.started_at, now()),
      last_activity_at = now(),
      resume_stage = case
        when public.module_progress.status = 'completed' then 'completed'
        else excluded.resume_stage
      end,
      resume_position = case
        when public.module_progress.status = 'completed' then 100
        else excluded.resume_position
      end
  returning * into saved_progress;

  update public.module_assignments as assignment
  set status = 'in_progress'
  where assignment.user_id = actor_id
    and assignment.module_id = save_training_checkpoint.module_id
    and assignment.status = 'assigned';

  return jsonb_build_object(
    'moduleId', module_id,
    'moduleSlug', module_slug,
    'progressPercent', saved_progress.progress_percent,
    'status', saved_progress.status,
    'resumeStage', saved_progress.resume_stage,
    'resumePosition', saved_progress.resume_position
  );
end;
$$;

revoke all on function public.save_training_checkpoint(uuid, text, integer) from public, anon;
grant execute on function public.save_training_checkpoint(uuid, text, integer) to authenticated;

-- Keep a checked quiz answer long enough for a trainee to continue on another
-- day. The first checked selection remains immutable until final submission.
update private.quiz_answer_locks
set expires_at = greatest(expires_at, now() + interval '30 days')
where expires_at > now();

create or replace function private.extend_quiz_resume_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.expires_at := greatest(new.expires_at, now() + interval '30 days');
  return new;
end;
$$;

revoke all on function private.extend_quiz_resume_window() from public, anon, authenticated;

drop trigger if exists quiz_answer_locks_extend_resume_window on private.quiz_answer_locks;
create trigger quiz_answer_locks_extend_resume_window
before insert or update of expires_at on private.quiz_answer_locks
for each row execute function private.extend_quiz_resume_window();

create or replace function public.quiz_resume_state(module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
begin
  if actor_id is null
    or public.current_app_role() is distinct from 'trainee'::public.app_role
  then
    raise exception using errcode = '42501', message = 'Active trainee access is required';
  end if;

  if not exists (
    select 1
    from public.training_modules as module
    where module.id = quiz_resume_state.module_id
      and module.status = 'published'
      and module.is_published
  ) then
    raise exception using errcode = '22023', message = 'Published training module was not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'questionId', question.id,
        'selectedAnswer', answer_lock.selected_answer,
        'correct', private.normalise_answer(answer_lock.selected_answer)
          = private.normalise_answer(answer_key.correct_answer),
        'explanation', question.explanation,
        'sortOrder', question.sort_order
      ) order by question.sort_order, question.id
    ),
    '[]'::jsonb
  )
  into result
  from public.quiz_questions as question
  join private.quiz_answer_keys as answer_key on answer_key.question_id = question.id
  join private.quiz_answer_locks as answer_lock
    on answer_lock.question_id = question.id
    and answer_lock.module_id = question.module_id
    and answer_lock.user_id = actor_id
    and answer_lock.expires_at > now()
  where question.module_id = quiz_resume_state.module_id
    and question.is_active;

  return result;
end;
$$;

revoke all on function public.quiz_resume_state(uuid) from public, anon;
grant execute on function public.quiz_resume_state(uuid) to authenticated;

create or replace function public.mark_assignment_notifications_read(
  notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  affected_rows integer;
begin
  if actor_id is null
    or public.current_app_role() is distinct from 'trainee'::public.app_role
  then
    raise exception using errcode = '42501', message = 'Active trainee access is required';
  end if;

  if notification_ids is not null and cardinality(notification_ids) > 50 then
    raise exception using errcode = '22023', message = 'Too many notifications were supplied';
  end if;

  update public.module_assignments as assignment
  set notification_read_at = now()
  where assignment.user_id = actor_id
    and assignment.status <> 'cancelled'
    and assignment.notification_read_at is null
    and (
      notification_ids is null
      or assignment.id = any(notification_ids)
    );

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

revoke all on function public.mark_assignment_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_assignment_notifications_read(uuid[]) to authenticated;

commit;
