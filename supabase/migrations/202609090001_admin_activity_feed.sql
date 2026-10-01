begin;

-- A display-safe, append-only projection gives administrators one Realtime
-- stream without broadening trainee access to the underlying activity tables.
create table if not exists public.admin_activity_events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('training', 'games', 'system')),
  event_type text not null check (char_length(event_type) between 1 and 80),
  user_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  module_id uuid references public.training_modules(id) on delete set null,
  subject_name text,
  actor_name text,
  module_title text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_events_recent_idx
  on public.admin_activity_events (created_at desc, id desc);

revoke all on table public.admin_activity_events from anon, authenticated;
grant select on table public.admin_activity_events to authenticated;
alter table public.admin_activity_events enable row level security;
drop policy if exists admin_activity_events_read on public.admin_activity_events;
create policy admin_activity_events_read
on public.admin_activity_events
for select
to authenticated
using (public.is_admin());

create or replace function private.write_admin_activity_event(
  event_category text,
  event_name text,
  subject_id uuid default null,
  actor_id uuid default null,
  module_id uuid default null,
  event_metadata jsonb default '{}'::jsonb,
  event_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject_label text;
  actor_label text;
  module_label text;
begin
  if event_category not in ('training', 'games', 'system')
    or event_name is null
    or event_name !~ '^[a-z][a-z0-9_:-]{0,79}$'
  then
    raise exception using errcode = '22023', message = 'Invalid administrator event';
  end if;
  select profile.full_name into subject_label from public.profiles as profile where profile.id = subject_id;
  select profile.full_name into actor_label from public.profiles as profile where profile.id = write_admin_activity_event.actor_id;
  select module.title into module_label from public.training_modules as module where module.id = write_admin_activity_event.module_id;
  insert into public.admin_activity_events (category, event_type, user_id, actor_id, module_id, subject_name, actor_name, module_title, metadata, created_at)
  values (event_category, event_name, subject_id, write_admin_activity_event.actor_id, write_admin_activity_event.module_id,
    nullif(btrim(subject_label), ''), nullif(btrim(actor_label), ''), nullif(btrim(module_label), ''),
    case when jsonb_typeof(event_metadata) = 'object' then event_metadata else '{}'::jsonb end, coalesce(event_created_at, now()));
end;
$$;

create or replace function private.capture_activity_log_admin_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_category text := case when new.event_type = 'activity_completed' then 'games' else 'training' end;
  safe_metadata jsonb := jsonb_build_object('sourceLogId', new.id);
begin
  if new.event_type = 'activity_completed' then
    safe_metadata := safe_metadata
      || jsonb_build_object('correct', new.metadata -> 'correct', 'pointsAwarded', new.metadata -> 'pointsAwarded', 'scenarioId', new.metadata -> 'scenarioId');
  elsif new.event_type = 'quiz_completed' then
    safe_metadata := safe_metadata
      || jsonb_build_object('percentage', new.metadata -> 'percentage', 'passed', new.metadata -> 'passed', 'attemptNumber', new.metadata -> 'attemptNumber');
  end if;
  perform private.write_admin_activity_event(event_category, new.event_type::text, new.user_id, new.actor_id, new.module_id, safe_metadata, new.created_at);
  return new;
end;
$$;

create or replace function private.capture_progress_admin_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_total integer := 0;
  activity_safe integer := 0;
begin
  if tg_op = 'INSERT' then
    perform private.write_admin_activity_event('training', 'progress_updated', new.user_id, null, new.module_id,
      jsonb_build_object('progressPercent', new.progress_percent, 'status', new.status, 'activityComplete', new.activity_complete), now());
  elsif old.status is distinct from new.status
    or old.progress_percent is distinct from new.progress_percent
    or old.activity_complete is distinct from new.activity_complete
  then
    if new.activity_complete and not coalesce(old.activity_complete, false) then
      select count(*)::integer,
        count(*) filter (where (activity.metadata ->> 'correct')::boolean is true)::integer
      into activity_total, activity_safe
      from public.activity_log as activity
      where activity.user_id = new.user_id and activity.module_id = new.module_id and activity.event_type = 'activity_completed';
    end if;
    perform private.write_admin_activity_event(
      case when new.activity_complete and not coalesce(old.activity_complete, false) then 'games' else 'training' end,
      case when new.activity_complete and not coalesce(old.activity_complete, false) then 'game_completed' else 'progress_updated' end,
      new.user_id, null, new.module_id,
      jsonb_build_object('progressPercent', new.progress_percent, 'status', new.status, 'activityComplete', new.activity_complete,
        'score', case when activity_total > 0 then round(activity_safe::numeric / activity_total * 100)::integer else null end), now());
  end if;
  return new;
end;
$$;

create or replace function private.capture_assignment_admin_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_admin_activity_event('system', 'assignment_created', new.user_id, new.assigned_by, new.module_id,
      jsonb_build_object('status', new.status, 'dueDate', new.due_date), coalesce(new.assigned_at, now()));
  elsif old.status is distinct from new.status or old.due_date is distinct from new.due_date then
    perform private.write_admin_activity_event('system', case when tg_op = 'INSERT' then 'assignment_created' else 'assignment_updated' end,
      new.user_id, new.assigned_by, new.module_id, jsonb_build_object('status', new.status, 'dueDate', new.due_date), coalesce(new.assigned_at, now()));
  end if;
  return new;
end;
$$;

create or replace function private.capture_profile_admin_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_admin_activity_event('system', 'account_created', new.id, null, null,
      jsonb_build_object('role', new.role, 'status', new.status), coalesce(new.updated_at, now()));
  elsif old.role is distinct from new.role or old.status is distinct from new.status then
    perform private.write_admin_activity_event('system', case when tg_op = 'INSERT' then 'account_created' else 'profile_updated' end,
      new.id, null, null, jsonb_build_object('role', new.role, 'status', new.status), coalesce(new.updated_at, now()));
  end if;
  return new;
end;
$$;

create or replace function private.capture_module_admin_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_admin_activity_event('system', 'module_created', null, new.updated_by, new.id,
      jsonb_build_object('status', new.status, 'published', new.is_published), now());
  elsif tg_op = 'DELETE' then
    perform private.write_admin_activity_event('system', 'module_deleted', null, old.updated_by, old.id,
      jsonb_build_object('status', old.status, 'published', old.is_published), now());
  elsif old.status is distinct from new.status or old.is_published is distinct from new.is_published then
    perform private.write_admin_activity_event('system', 'module_publication_changed', null, new.updated_by, new.id,
      jsonb_build_object('status', new.status, 'published', new.is_published), now());
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists admin_activity_log_capture on public.activity_log;
create trigger admin_activity_log_capture after insert on public.activity_log
for each row execute function private.capture_activity_log_admin_event();
drop trigger if exists admin_progress_capture on public.module_progress;
create trigger admin_progress_capture after insert or update on public.module_progress
for each row execute function private.capture_progress_admin_event();
drop trigger if exists admin_assignment_capture on public.module_assignments;
create trigger admin_assignment_capture after insert or update on public.module_assignments
for each row execute function private.capture_assignment_admin_event();
drop trigger if exists admin_profile_capture on public.profiles;
create trigger admin_profile_capture after insert or update on public.profiles
for each row execute function private.capture_profile_admin_event();
drop trigger if exists admin_module_capture on public.training_modules;
create trigger admin_module_capture after insert or update or delete on public.training_modules
for each row execute function private.capture_module_admin_event();

revoke all on function private.write_admin_activity_event(text, text, uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function private.capture_activity_log_admin_event() from public, anon, authenticated;
revoke all on function private.capture_progress_admin_event() from public, anon, authenticated;
revoke all on function private.capture_assignment_admin_event() from public, anon, authenticated;
revoke all on function private.capture_profile_admin_event() from public, anon, authenticated;
revoke all on function private.capture_module_admin_event() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_activity_events'
  ) then
    alter publication supabase_realtime add table public.admin_activity_events;
  end if;
end;
$$;

commit;
