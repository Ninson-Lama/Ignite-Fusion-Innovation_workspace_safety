-- IFI Safety360 - foundational schema
-- Apply with the Supabase CLI. This migration contains no accounts or passwords.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  create type public.app_role as enum ('trainee', 'manager', 'admin');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.profile_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.difficulty_level as enum ('introductory', 'intermediate', 'advanced');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.module_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.assignment_status as enum ('assigned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.progress_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.quiz_question_type as enum ('single_choice', 'multiple_choice', 'true_false');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.activity_event_type as enum (
    'module_started',
    'learning_completed',
    'activity_completed',
    'quiz_completed',
    'module_completed',
    'achievement_earned'
  );
exception when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  employee_number text,
  department text,
  role public.app_role not null default 'trainee',
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_employee_number_length check (
    employee_number is null or char_length(btrim(employee_number)) between 1 and 40
  ),
  constraint profiles_department_length check (
    department is null or char_length(btrim(department)) between 1 and 100
  )
);

create unique index if not exists profiles_employee_number_unique_idx
  on public.profiles (lower(employee_number))
  where employee_number is not null;
create index if not exists profiles_department_role_idx
  on public.profiles (lower(department), role)
  where status = 'active';

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  overview text not null default '',
  category text not null,
  estimated_minutes smallint not null,
  difficulty public.difficulty_level not null default 'introductory',
  status public.module_status not null default 'draft',
  is_published boolean not null default false,
  pass_mark smallint not null default 80,
  points_available smallint not null default 200,
  sort_order integer not null default 0,
  learning_objectives jsonb not null default '[]'::jsonb,
  content jsonb not null default '{}'::jsonb,
  scene_config jsonb not null default '{}'::jsonb,
  hero_image_path text,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_modules_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint training_modules_title_length check (char_length(btrim(title)) between 3 and 120),
  constraint training_modules_description_length check (char_length(btrim(description)) between 10 and 800),
  constraint training_modules_category_length check (char_length(btrim(category)) between 2 and 80),
  constraint training_modules_estimated_minutes_range check (estimated_minutes between 5 and 240),
  constraint training_modules_pass_mark_range check (pass_mark between 1 and 100),
  constraint training_modules_points_range check (points_available between 0 and 5000),
  constraint training_modules_learning_objectives_array check (jsonb_typeof(learning_objectives) = 'array'),
  constraint training_modules_content_object check (jsonb_typeof(content) = 'object'),
  constraint training_modules_scene_config_object check (jsonb_typeof(scene_config) = 'object'),
  constraint training_modules_publication_consistent check (
    (status = 'published' and is_published and published_at is not null)
    or (status <> 'published' and not is_published)
  )
);

create index if not exists training_modules_catalogue_idx
  on public.training_modules (is_published, sort_order, title);

create table if not exists public.module_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.training_modules (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_assignments_user_module_unique unique (user_id, module_id),
  constraint module_assignments_due_after_assignment check (
    due_date is null or due_date >= assigned_at::date
  ),
  constraint module_assignments_notes_length check (notes is null or char_length(notes) <= 500),
  constraint module_assignments_completion_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index if not exists module_assignments_user_status_idx
  on public.module_assignments (user_id, status, due_date);
create index if not exists module_assignments_module_status_idx
  on public.module_assignments (module_id, status);
create index if not exists module_assignments_overdue_idx
  on public.module_assignments (due_date, user_id)
  where due_date is not null and status in ('assigned', 'in_progress');

create table if not exists public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.training_modules (id) on delete cascade,
  progress_percent smallint not null default 0,
  status public.progress_status not null default 'not_started',
  learning_complete boolean not null default false,
  activity_complete boolean not null default false,
  points_earned integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_progress_user_module_unique unique (user_id, module_id),
  constraint module_progress_percent_range check (progress_percent between 0 and 100),
  constraint module_progress_points_nonnegative check (points_earned >= 0),
  constraint module_progress_completion_consistent check (
    (status = 'completed' and progress_percent = 100 and completed_at is not null
      and learning_complete and activity_complete)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint module_progress_started_consistent check (
    status = 'not_started' or started_at is not null
  )
);

create index if not exists module_progress_user_status_idx
  on public.module_progress (user_id, status, last_activity_at desc);
create index if not exists module_progress_module_status_idx
  on public.module_progress (module_id, status);
create index if not exists module_progress_leaderboard_idx
  on public.module_progress (points_earned desc, completed_at)
  where status = 'completed';

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules (id) on delete cascade,
  question_type public.quiz_question_type not null default 'single_choice',
  prompt text not null,
  options jsonb not null,
  explanation text not null,
  points smallint not null default 1,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_module_order_unique unique (module_id, sort_order),
  constraint quiz_questions_prompt_length check (char_length(btrim(prompt)) between 8 and 500),
  constraint quiz_questions_explanation_length check (char_length(btrim(explanation)) between 8 and 1000),
  constraint quiz_questions_options_array check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10
  ),
  constraint quiz_questions_points_range check (points between 1 and 100),
  constraint quiz_questions_sort_order_positive check (sort_order > 0)
);

create index if not exists quiz_questions_module_active_idx
  on public.quiz_questions (module_id, sort_order)
  where is_active;

-- Kept outside the exposed public schema. Only audited SECURITY DEFINER functions
-- in later migrations may read these rows for scoring.
create table if not exists private.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_answer_keys_answer_array check (
    jsonb_typeof(correct_answer) = 'array' and jsonb_array_length(correct_answer) >= 1
  )
);

-- A first checked selection is locked for the active assessment. The lock is
-- private, expires safely if an assessment is abandoned, and is cleared only
-- after the matching immutable quiz attempt has been recorded.
create table if not exists private.quiz_answer_locks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.training_modules (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  selected_answer jsonb not null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_answer_locks_pkey primary key (user_id, question_id),
  constraint quiz_answer_locks_answer_array check (
    jsonb_typeof(selected_answer) = 'array'
      and jsonb_array_length(selected_answer) >= 1
  ),
  constraint quiz_answer_locks_expiry_order check (expires_at > created_at)
);

create index if not exists quiz_answer_locks_user_module_idx
  on private.quiz_answer_locks (user_id, module_id, expires_at);
create index if not exists quiz_answer_locks_expiry_idx
  on private.quiz_answer_locks (expires_at);

-- Decision activities use a server-held allowlist and answer map. Keeping this
-- relation in the private schema prevents a caller from supplying their own
-- scenario, answer or score while still allowing idempotent event recording.
create table if not exists private.activity_scenario_keys (
  module_id uuid not null references public.training_modules (id) on delete cascade,
  scenario_id text not null,
  allowed_choice_ids text[] not null,
  correct_choice_id text not null,
  points smallint not null default 100,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_scenario_keys_pkey primary key (module_id, scenario_id),
  constraint activity_scenario_keys_id_format check (
    scenario_id ~ '^[a-z0-9][a-z0-9-]{0,39}$'
  ),
  constraint activity_scenario_keys_choices_nonempty check (
    cardinality(allowed_choice_ids) >= 2
  ),
  constraint activity_scenario_keys_choice_ids_format check (
    array_to_string(allowed_choice_ids, ',') ~ '^[a-z0-9_-]+(?:,[a-z0-9_-]+)+$'
  ),
  constraint activity_scenario_keys_correct_choice_allowed check (
    correct_choice_id = any (allowed_choice_ids)
  ),
  constraint activity_scenario_keys_points_range check (points between 0 and 1000),
  constraint activity_scenario_keys_sort_order_nonnegative check (sort_order >= 0)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.training_modules (id) on delete cascade,
  attempt_number integer not null,
  score integer not null,
  max_score integer not null,
  percentage numeric(5,2) not null,
  passed boolean not null,
  activity_score integer not null default 0,
  points_earned integer not null default 0,
  submitted_answers jsonb not null,
  feedback jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint quiz_attempts_user_module_number_unique unique (user_id, module_id, attempt_number),
  constraint quiz_attempts_number_positive check (attempt_number > 0),
  constraint quiz_attempts_score_range check (max_score > 0 and score between 0 and max_score),
  constraint quiz_attempts_percentage_range check (percentage between 0 and 100),
  constraint quiz_attempts_activity_score_nonnegative check (activity_score >= 0),
  constraint quiz_attempts_points_nonnegative check (points_earned >= 0),
  constraint quiz_attempts_answers_object check (jsonb_typeof(submitted_answers) = 'object'),
  constraint quiz_attempts_feedback_array check (jsonb_typeof(feedback) = 'array'),
  constraint quiz_attempts_time_order check (completed_at >= started_at)
);

create index if not exists quiz_attempts_user_recent_idx
  on public.quiz_attempts (user_id, completed_at desc);
create index if not exists quiz_attempts_module_results_idx
  on public.quiz_attempts (module_id, passed, percentage desc);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  icon text not null default 'award',
  points integer not null default 0,
  criteria jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint achievements_code_format check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint achievements_title_length check (char_length(btrim(title)) between 3 and 100),
  constraint achievements_description_length check (char_length(btrim(description)) between 8 and 500),
  constraint achievements_points_nonnegative check (points >= 0),
  constraint achievements_criteria_object check (jsonb_typeof(criteria) = 'object')
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  source_attempt_id uuid references public.quiz_attempts (id) on delete set null,
  earned_at timestamptz not null default now(),
  constraint user_achievements_user_achievement_unique unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_recent_idx
  on public.user_achievements (user_id, earned_at desc);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  module_id uuid references public.training_modules (id) on delete cascade,
  attempt_id uuid references public.quiz_attempts (id) on delete set null,
  event_type public.activity_event_type not null,
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_event_key_length check (event_key is null or char_length(event_key) between 1 and 120),
  constraint activity_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists activity_log_idempotency_idx
  on public.activity_log (user_id, module_id, event_key)
  where event_key is not null;
create index if not exists activity_log_user_recent_idx
  on public.activity_log (user_id, created_at desc);
create index if not exists activity_log_module_recent_idx
  on public.activity_log (module_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists training_modules_set_updated_at on public.training_modules;
create trigger training_modules_set_updated_at
before update on public.training_modules
for each row execute function private.set_updated_at();

drop trigger if exists module_assignments_set_updated_at on public.module_assignments;
create trigger module_assignments_set_updated_at
before update on public.module_assignments
for each row execute function private.set_updated_at();

drop trigger if exists module_progress_set_updated_at on public.module_progress;
create trigger module_progress_set_updated_at
before update on public.module_progress
for each row execute function private.set_updated_at();

drop trigger if exists quiz_questions_set_updated_at on public.quiz_questions;
create trigger quiz_questions_set_updated_at
before update on public.quiz_questions
for each row execute function private.set_updated_at();

drop trigger if exists quiz_answer_keys_set_updated_at on private.quiz_answer_keys;
create trigger quiz_answer_keys_set_updated_at
before update on private.quiz_answer_keys
for each row execute function private.set_updated_at();

drop trigger if exists quiz_answer_locks_set_updated_at on private.quiz_answer_locks;
create trigger quiz_answer_locks_set_updated_at
before update on private.quiz_answer_locks
for each row execute function private.set_updated_at();

drop trigger if exists activity_scenario_keys_set_updated_at on private.activity_scenario_keys;
create trigger activity_scenario_keys_set_updated_at
before update on private.activity_scenario_keys
for each row execute function private.set_updated_at();

drop trigger if exists achievements_set_updated_at on public.achievements;
create trigger achievements_set_updated_at
before update on public.achievements
for each row execute function private.set_updated_at();

-- Auth owns credential data. The application profile is created server-side and
-- always defaults to trainee; role/status/department metadata from sign-up is ignored.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_name text;
begin
  safe_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if safe_name is null then
    safe_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  safe_name := left(coalesce(safe_name, 'Safety360 trainee'), 120);

  insert into public.profiles (id, full_name, role, status)
  values (new.id, safe_name, 'trainee', 'active')
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

commit;
