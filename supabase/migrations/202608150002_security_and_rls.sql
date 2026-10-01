-- IFI Safety360 - trusted role helpers, write guards, grants and RLS

begin;

-- Roles are always read from public.profiles. JWT/user metadata is deliberately
-- not trusted for authorisation because users can control sign-up metadata.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
    and p.status = 'active'
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- A manager is intentionally limited to trainee profiles in the same,
-- non-empty department. Managers cannot use this helper to access managers,
-- administrators, or trainees in a different/blank department.
create or replace function public.can_manage_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.profiles as actor
      join public.profiles as target
        on target.id = target_user_id
      where actor.id = auth.uid()
        and actor.status = 'active'
        and actor.role = 'manager'
        and target.role = 'trainee'
        and actor.department is not null
        and target.department is not null
        and lower(btrim(actor.department)) = lower(btrim(target.department))
    ),
    false
  )
$$;

create or replace function public.can_access_training_module(target_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.training_modules as module
      where module.id = target_module_id
        and module.is_published
        and module.status = 'published'
    ),
    false
  )
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_manage_user(uuid) from public, anon;
revoke all on function public.can_access_training_module(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_user(uuid) to authenticated;
grant execute on function public.can_access_training_module(uuid) to authenticated;

-- Direct authenticated profile updates may only change the user's display name,
-- unless the trusted database role says the actor is an administrator.
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role text;
  actor_status text;
begin
  -- Internal migrations, auth hooks, and SECURITY DEFINER functions are trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  select p.role::text, p.status::text
  into actor_role, actor_status
  from public.profiles as p
  where p.id = auth.uid();

  if actor_status <> 'active' then
    raise exception using errcode = '42501', message = 'Active profile is required';
  end if;

  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception using errcode = '42501', message = 'Immutable profile fields cannot be changed';
  end if;

  if actor_role <> 'admin' and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.employee_number is distinct from old.employee_number
    or new.department is distinct from old.department
  ) then
    raise exception using errcode = '42501', message = 'Only administrators can change protected profile fields';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_update() from public, anon, authenticated;

drop trigger if exists profiles_guard_protected_fields on public.profiles;
create trigger profiles_guard_protected_fields
before update on public.profiles
for each row execute function private.guard_profile_update();

-- Preserve assignment ownership/audit fields. Managers may set a due date,
-- notes, or cancel an assignment, but completion is reconciled by trusted RPCs.
create or replace function private.guard_assignment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role public.app_role;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  select p.role
  into actor_role
  from public.profiles as p
  where p.id = auth.uid() and p.status = 'active';

  if actor_role is null then
    raise exception using errcode = '42501', message = 'Active profile is required';
  end if;

  -- Serialise assignment writes with module withdrawal RPCs so a newly assigned
  -- requirement cannot race an unpublish/archive transition.
  perform pg_advisory_xact_lock(
    hashtextextended('module-assignment:' || new.module_id::text, 0)
  );

  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.training_modules as module
      where module.id = new.module_id
        and module.is_published
        and module.status = 'published'
    ) then
      raise exception using
        errcode = '23514',
        message = 'Assignments can only be created for published modules';
    end if;

    new.assigned_by := auth.uid();
    if actor_role <> 'admin' and new.status <> 'assigned' then
      raise exception using errcode = '42501', message = 'New assignments must start in assigned status';
    end if;
    return new;
  end if;

  if new.id <> old.id
    or new.user_id <> old.user_id
    or new.module_id <> old.module_id
  then
    raise exception using errcode = '42501', message = 'Assignment identity cannot be changed';
  end if;

  -- Preserve original audit attribution when a client performs an idempotent
  -- upsert to revise a due date or notes.
  new.assigned_by := old.assigned_by;
  new.assigned_at := old.assigned_at;
  new.created_at := old.created_at;

  -- Progress-owned states are immutable through assignment upserts for every
  -- actor, including administrators. Due dates and notes may still be revised.
  if old.status in ('in_progress', 'completed') then
    new.status := old.status;
    new.completed_at := old.completed_at;
  elsif actor_role <> 'admin' then
    if new.status not in ('assigned', 'cancelled') then
      raise exception using errcode = '42501', message = 'Assignment completion is managed by training services';
    else
      new.completed_at := null;
    end if;
  elsif new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  if new.status in ('assigned', 'in_progress')
    and not exists (
      select 1
      from public.training_modules as module
      where module.id = new.module_id
        and module.is_published
        and module.status = 'published'
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Assignments can only be created for published modules';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_assignment_write() from public, anon, authenticated;

drop trigger if exists module_assignments_guard_write on public.module_assignments;
create trigger module_assignments_guard_write
before insert or update on public.module_assignments
for each row execute function private.guard_assignment_write();

-- Protect the assignment/catalogue invariant even if an administrator performs
-- a direct RLS-authorised module update rather than using the narrower RPCs.
create or replace function private.guard_module_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_published then
    perform pg_advisory_xact_lock(
      hashtextextended('module-assignment:' || new.id::text, 0)
    );

    if exists (
      select 1
      from public.module_assignments as assignment
      where assignment.module_id = new.id
        and assignment.status in ('assigned', 'in_progress')
    ) then
      raise exception using
        errcode = '23514',
        message = 'Module cannot be unpublished or archived while active assignments exist';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_module_withdrawal() from public, anon, authenticated;

drop trigger if exists training_modules_guard_withdrawal on public.training_modules;
create trigger training_modules_guard_withdrawal
before update of status, is_published on public.training_modules
for each row execute function private.guard_module_withdrawal();

-- Remove permissive defaults before granting the minimum table operations used
-- by PostgREST. RLS still authorises every granted operation row-by-row.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.training_modules from anon, authenticated;
revoke all on table public.module_assignments from anon, authenticated;
revoke all on table public.module_progress from anon, authenticated;
revoke all on table public.quiz_questions from anon, authenticated;
revoke all on table public.quiz_attempts from anon, authenticated;
revoke all on table public.achievements from anon, authenticated;
revoke all on table public.user_achievements from anon, authenticated;
revoke all on table public.activity_log from anon, authenticated;
revoke all on table private.quiz_answer_keys from public, anon, authenticated;
revoke all on table private.quiz_answer_locks from public, anon, authenticated;
revoke all on table private.activity_scenario_keys from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.training_modules to authenticated;
grant select, insert, update on table public.module_assignments to authenticated;
grant select, insert, update, delete on table public.module_progress to authenticated;
grant select (
  id,
  module_id,
  question_type,
  prompt,
  options,
  points,
  sort_order,
  is_active,
  created_at,
  updated_at
) on table public.quiz_questions to authenticated;
grant insert, update, delete on table public.quiz_questions to authenticated;
grant select on table public.quiz_attempts to authenticated;
grant select, insert, update, delete on table public.achievements to authenticated;
grant select on table public.user_achievements to authenticated;
grant select on table public.activity_log to authenticated;

alter table public.profiles enable row level security;
alter table public.training_modules enable row level security;
alter table public.module_assignments enable row level security;
alter table public.module_progress enable row level security;
alter table public.quiz_questions enable row level security;
alter table private.quiz_answer_keys enable row level security;
alter table private.quiz_answer_locks enable row level security;
alter table private.activity_scenario_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists profiles_read_authorised on public.profiles;
create policy profiles_read_authorised
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.can_manage_user(id)
  or public.is_admin()
);

drop policy if exists profiles_update_authorised on public.profiles;
create policy profiles_update_authorised
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists modules_read_authorised on public.training_modules;
create policy modules_read_authorised
on public.training_modules
for select
to authenticated
using (
  (is_published and status = 'published')
  or public.is_admin()
);

drop policy if exists modules_admin_insert on public.training_modules;
create policy modules_admin_insert
on public.training_modules
for insert
to authenticated
with check (public.is_admin());

drop policy if exists modules_admin_update on public.training_modules;
create policy modules_admin_update
on public.training_modules
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists modules_admin_delete on public.training_modules;
create policy modules_admin_delete
on public.training_modules
for delete
to authenticated
using (public.is_admin());

drop policy if exists assignments_read_authorised on public.module_assignments;
create policy assignments_read_authorised
on public.module_assignments
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_user(user_id)
  or public.is_admin()
);

drop policy if exists assignments_manager_admin_insert on public.module_assignments;
create policy assignments_manager_admin_insert
on public.module_assignments
for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.can_manage_user(user_id)
    and assigned_by = auth.uid()
    and public.can_access_training_module(module_id)
    and exists (
      select 1 from public.profiles as target
      where target.id = user_id and target.status = 'active'
    )
  )
);

drop policy if exists assignments_manager_admin_update on public.module_assignments;
create policy assignments_manager_admin_update
on public.module_assignments
for update
to authenticated
using (public.is_admin() or public.can_manage_user(user_id))
with check (public.is_admin() or public.can_manage_user(user_id));

drop policy if exists assignments_manager_admin_delete on public.module_assignments;
-- No authenticated DELETE grant or policy: assignment history is retained and
-- managers/admins use the cancelled state instead of erasing audit records.

drop policy if exists progress_read_authorised on public.module_progress;
create policy progress_read_authorised
on public.module_progress
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_user(user_id)
  or public.is_admin()
);

drop policy if exists progress_admin_insert on public.module_progress;
create policy progress_admin_insert
on public.module_progress
for insert
to authenticated
with check (public.is_admin());

drop policy if exists progress_admin_update on public.module_progress;
create policy progress_admin_update
on public.module_progress
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists progress_admin_delete on public.module_progress;
create policy progress_admin_delete
on public.module_progress
for delete
to authenticated
using (public.is_admin());

drop policy if exists questions_read_authorised on public.quiz_questions;
create policy questions_read_authorised
on public.quiz_questions
for select
to authenticated
using (
  (is_active and public.can_access_training_module(module_id))
  or public.is_admin()
);

drop policy if exists questions_admin_insert on public.quiz_questions;
create policy questions_admin_insert
on public.quiz_questions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists questions_admin_update on public.quiz_questions;
create policy questions_admin_update
on public.quiz_questions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists questions_admin_delete on public.quiz_questions;
create policy questions_admin_delete
on public.quiz_questions
for delete
to authenticated
using (public.is_admin());

-- Intentionally no policies on private answer/configuration tables. Even admins
-- consume them only through narrowly scoped, audited SECURITY DEFINER functions.

drop policy if exists attempts_read_authorised on public.quiz_attempts;
create policy attempts_read_authorised
on public.quiz_attempts
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_user(user_id)
  or public.is_admin()
);

drop policy if exists achievements_read_authorised on public.achievements;
create policy achievements_read_authorised
on public.achievements
for select
to authenticated
using (is_active or public.is_admin());

drop policy if exists achievements_admin_insert on public.achievements;
create policy achievements_admin_insert
on public.achievements
for insert
to authenticated
with check (public.is_admin());

drop policy if exists achievements_admin_update on public.achievements;
create policy achievements_admin_update
on public.achievements
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists achievements_admin_delete on public.achievements;
create policy achievements_admin_delete
on public.achievements
for delete
to authenticated
using (public.is_admin());

drop policy if exists user_achievements_read_authorised on public.user_achievements;
create policy user_achievements_read_authorised
on public.user_achievements
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_user(user_id)
  or public.is_admin()
);

drop policy if exists activity_read_authorised on public.activity_log;
create policy activity_read_authorised
on public.activity_log
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_user(user_id)
  or public.is_admin()
);

commit;
