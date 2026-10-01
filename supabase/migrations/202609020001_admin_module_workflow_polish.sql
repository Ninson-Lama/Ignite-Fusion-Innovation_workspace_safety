begin;

-- Keep full draft saves optimistic. The advisory lock serialises writers, while
-- the timestamp check prevents a stale browser tab from silently replacing a
-- newer definition.
drop function if exists public.admin_save_module_draft(uuid, jsonb);

create or replace function public.admin_save_module_draft(
  module_id uuid,
  definition jsonb,
  expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  readiness jsonb;
  cover_path text := definition ->> 'heroImagePath';
  current_updated_at timestamptz;
  saved_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  perform private.assert_module_authoring_definition(definition);

  if module_id is null then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('module-authoring:' || module_id::text, 0));
  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_save_module_draft.module_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;
  if target_module.id in (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000004'::uuid
    )
    or target_module.slug in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness')
  then
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

  select draft.updated_at into current_updated_at
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id
  for update;

  if expected_updated_at is not null
    and current_updated_at is distinct from expected_updated_at
  then
    raise exception using
      errcode = '40001',
      message = 'This draft changed in another window. Reload it before saving.';
  end if;

  if cover_path not in (
    '/training-hazard-perception.png',
    '/training-manual-handling.png',
    '/training-working-at-height.png',
    '/training-cyber-awareness.png'
  ) then
    if cover_path !~ ('^' || target_module.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'module-covers'
          and object.name = cover_path
      )
    then
      raise exception using
        errcode = '23514',
        message = 'The uploaded cover image does not belong to this module';
    end if;
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
      hero_image_path = cover_path,
      updated_by = auth.uid()
  where module.id = target_module.id;

  insert into private.module_authoring_drafts (module_id, definition, updated_by)
  values (target_module.id, definition, auth.uid())
  on conflict (module_id) do update
  set definition = excluded.definition,
      updated_by = excluded.updated_by
  returning updated_at into saved_updated_at;

  readiness := private.module_authoring_readiness(definition);
  return jsonb_build_object(
    'moduleId', target_module.id,
    'savedAt', saved_updated_at,
    'updatedAt', saved_updated_at,
    'readiness', readiness
  );
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A module with this URL slug already exists';
end;
$$;

revoke all on function public.admin_save_module_draft(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.admin_save_module_draft(uuid, jsonb, timestamptz) to authenticated;

-- Cover uploads patch only the cover field on the latest private definition.
-- This avoids re-saving a stale, full JSON draft after a slow file upload.
create or replace function public.admin_set_module_cover(
  module_id uuid,
  cover_path text,
  expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  current_definition jsonb;
  previous_cover_path text;
  current_updated_at timestamptz;
  saved_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  if module_id is null or cover_path is null then
    raise exception using errcode = '22023', message = 'A module and cover image are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('module-authoring:' || module_id::text, 0));
  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_set_module_cover.module_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;
  if target_module.id in (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000004'::uuid
    )
    or target_module.slug in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness')
  then
    raise exception using errcode = '23514', message = 'Built-in modules are maintained in the reviewed application catalogue';
  end if;
  if target_module.is_published or target_module.status <> 'draft' then
    raise exception using errcode = '23514', message = 'Unpublish the module before replacing its cover image';
  end if;
  if exists (select 1 from public.module_progress where public.module_progress.module_id = target_module.id)
    or exists (select 1 from public.activity_log where public.activity_log.module_id = target_module.id)
    or exists (select 1 from public.quiz_attempts where public.quiz_attempts.module_id = target_module.id)
  then
    raise exception using errcode = '23514', message = 'A module with learner history cannot be structurally edited; create a new module version instead';
  end if;
  if cover_path !~ ('^' || target_module.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'module-covers'
        and object.name = cover_path
    )
  then
    raise exception using errcode = '23514', message = 'The uploaded cover image does not belong to this module';
  end if;

  select draft.definition, draft.updated_at
  into current_definition, current_updated_at
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id
  for update;

  if current_definition is null then
    raise exception using errcode = '23514', message = 'This module does not have an editable private draft';
  end if;
  if expected_updated_at is not null
    and current_updated_at is distinct from expected_updated_at
  then
    raise exception using
      errcode = '40001',
      message = 'This draft changed in another window. Reload it before uploading a cover.';
  end if;

  previous_cover_path := current_definition ->> 'heroImagePath';
  current_definition := jsonb_set(current_definition, '{heroImagePath}', to_jsonb(cover_path), true);
  perform private.assert_module_authoring_definition(current_definition);

  update public.training_modules as module
  set hero_image_path = cover_path,
      updated_by = auth.uid()
  where module.id = target_module.id;

  update private.module_authoring_drafts as draft
  set definition = current_definition,
      updated_by = auth.uid()
  where draft.module_id = target_module.id
  returning updated_at into saved_updated_at;

  return jsonb_build_object(
    'moduleId', target_module.id,
    'heroImagePath', cover_path,
    'previousCoverPath', previous_cover_path,
    'savedAt', saved_updated_at,
    'updatedAt', saved_updated_at
  );
end;
$$;

revoke all on function public.admin_set_module_cover(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_module_cover(uuid, text, timestamptz) to authenticated;

-- Return editor state, authoritative deletion eligibility and the optimistic
-- revision in one round trip.
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
  draft_updated_at timestamptz;
  authored boolean := false;
  can_delete boolean := false;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_get_module_draft.module_id;
  if not found then return null; end if;

  select draft.definition, draft.updated_at
  into definition, draft_updated_at
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id;

  authored := definition is not null
    and target_module.id not in (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000004'::uuid
    )
    and target_module.slug not in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness');

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

  can_delete := authored
    and target_module.status = 'draft'
    and not target_module.is_published
    and not exists (select 1 from public.module_assignments as assignment where assignment.module_id = target_module.id)
    and not exists (select 1 from public.module_progress as progress where progress.module_id = target_module.id)
    and not exists (select 1 from public.activity_log as activity where activity.module_id = target_module.id)
    and not exists (select 1 from public.quiz_attempts as attempt where attempt.module_id = target_module.id);

  return jsonb_build_object(
    'moduleId', target_module.id,
    'status', target_module.status,
    'isPublished', target_module.is_published,
    'editable', definition is not null,
    'definition', definition,
    'readiness', readiness,
    'updatedAt', draft_updated_at,
    'canDelete', can_delete
  );
end;
$$;

revoke all on function public.admin_get_module_draft(uuid) from public, anon;
grant execute on function public.admin_get_module_draft(uuid) to authenticated;

-- Catalogue metadata, readiness and delete eligibility are evaluated inside a
-- single database snapshot. This removes broad table scans and N+1 HTTP calls.
create or replace function public.admin_list_modules_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', module.id,
      'slug', module.slug,
      'title', module.title,
      'description', module.description,
      'estimated_minutes', module.estimated_minutes,
      'difficulty', module.difficulty,
      'status', module.status,
      'is_published', module.is_published,
      'sort_order', module.sort_order,
      'is_authored', draft.module_id is not null
        and module.id not in (
          '10000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000003'::uuid,
          '10000000-0000-4000-8000-000000000004'::uuid
        )
        and module.slug not in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness'),
      'can_delete', draft.module_id is not null
        and module.status = 'draft'
        and not module.is_published
        and module.id not in (
          '10000000-0000-4000-8000-000000000001'::uuid,
          '10000000-0000-4000-8000-000000000002'::uuid,
          '10000000-0000-4000-8000-000000000003'::uuid,
          '10000000-0000-4000-8000-000000000004'::uuid
        )
        and module.slug not in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness')
        and not exists (select 1 from public.module_assignments as assignment where assignment.module_id = module.id)
        and not exists (select 1 from public.module_progress as progress where progress.module_id = module.id)
        and not exists (select 1 from public.activity_log as activity where activity.module_id = module.id)
        and not exists (select 1 from public.quiz_attempts as attempt where attempt.module_id = module.id),
      'updated_at', draft.updated_at,
      'readiness', public.admin_module_readiness(module.id)
    ) order by module.sort_order, module.title
  ), '[]'::jsonb)
  into result
  from public.training_modules as module
  left join private.module_authoring_drafts as draft on draft.module_id = module.id;

  return result;
end;
$$;

revoke all on function public.admin_list_modules_overview() from public, anon;
grant execute on function public.admin_list_modules_overview() to authenticated;

-- Deletion also checks the draft revision, preventing a stale editor or stale
-- catalogue row from deleting content that another administrator just changed.
drop function if exists public.admin_delete_module(uuid, text);

create or replace function public.admin_delete_module(
  module_id uuid,
  expected_slug text,
  expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  deleted_cover_path text;
  current_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Administrator access is required';
  end if;
  if module_id is null
    or expected_slug is null
    or expected_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception using errcode = '22023', message = 'A valid module identifier and URL slug are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('module-authoring:' || module_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('module-assignment:' || module_id::text, 0));

  select module.* into target_module
  from public.training_modules as module
  where module.id = admin_delete_module.module_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Training module was not found';
  end if;
  if target_module.slug <> expected_slug then
    raise exception using errcode = '23514', message = 'The module confirmation no longer matches this record';
  end if;
  if target_module.id in (
      '10000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000004'::uuid
    )
    or target_module.slug in ('hazard-perception', 'manual-handling', 'working-at-height', 'cyber-awareness')
  then
    raise exception using errcode = '23514', message = 'Built-in modules cannot be deleted';
  end if;
  if target_module.is_published or target_module.status <> 'draft' then
    raise exception using errcode = '23514', message = 'Only an unpublished private draft can be deleted';
  end if;

  select draft.updated_at into current_updated_at
  from private.module_authoring_drafts as draft
  where draft.module_id = target_module.id
  for update;
  if current_updated_at is null then
    raise exception using errcode = '23514', message = 'The private module draft is missing';
  end if;
  if expected_updated_at is not null
    and current_updated_at is distinct from expected_updated_at
  then
    raise exception using
      errcode = '40001',
      message = 'This draft changed in another window. Reload it before deleting.';
  end if;

  if exists (select 1 from public.module_assignments as assignment where assignment.module_id = target_module.id)
    or exists (select 1 from public.module_progress as progress where progress.module_id = target_module.id)
    or exists (select 1 from public.activity_log as activity where activity.module_id = target_module.id)
    or exists (select 1 from public.quiz_attempts as attempt where attempt.module_id = target_module.id)
  then
    raise exception using
      errcode = '23514',
      message = 'Modules with assignments or learner history must be retained';
  end if;

  deleted_cover_path := target_module.hero_image_path;
  delete from public.training_modules as module
  where module.id = target_module.id;

  return jsonb_build_object(
    'deleted', true,
    'id', target_module.id,
    'title', target_module.title,
    'slug', target_module.slug,
    'coverPath', deleted_cover_path
  );
end;
$$;

revoke all on function public.admin_delete_module(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_delete_module(uuid, text, timestamptz) to authenticated;

commit;
