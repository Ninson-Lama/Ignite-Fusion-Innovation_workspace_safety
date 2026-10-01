begin;

-- Administrators may upload one-off module covers to a private bucket. Object
-- names are deliberately immutable and module-scoped:
--   <module uuid>/<object uuid>.(jpg|png|webp)
-- The application serves these objects through authenticated Storage requests.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'module-covers',
  'module-covers',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists module_covers_authenticated_read on storage.objects;
create policy module_covers_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'module-covers'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and (
    public.is_admin()
    or (
      public.current_app_role() is not null
      and exists (
        select 1
        from public.training_modules as module
        where module.id = case
            when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
              then split_part(name, '/', 1)::uuid
            else null
          end
          and module.hero_image_path = name
          and public.can_access_training_module(module.id)
      )
    )
  )
);

drop policy if exists module_covers_admin_insert on storage.objects;
create policy module_covers_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'module-covers'
  and public.is_admin()
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and exists (
    select 1
    from public.training_modules as module
    where module.id = case
        when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
          then split_part(name, '/', 1)::uuid
        else null
      end
      and module.status = 'draft'
      and not module.is_published
      and module.slug not in (
        'hazard-perception',
        'manual-handling',
        'working-at-height',
        'cyber-awareness'
      )
  )
);

-- Covers are immutable: replacement uses a fresh object UUID. No UPDATE policy
-- is granted. Administrators may remove a strictly shaped object even after its
-- module row has been deleted, which permits best-effort post-delete cleanup.
drop policy if exists module_covers_admin_update on storage.objects;
drop policy if exists module_covers_admin_delete on storage.objects;
create policy module_covers_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'module-covers'
  and public.is_admin()
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and not exists (
    select 1
    from public.training_modules as module
    where module.hero_image_path = name
  )
);

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
    or not (
      coalesce(definition ->> 'heroImagePath', '') in (
        '/training-hazard-perception.png',
        '/training-manual-handling.png',
        '/training-working-at-height.png',
        '/training-cyber-awareness.png'
      )
      or coalesce(definition ->> 'heroImagePath', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
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

  if definition ->> 'heroImagePath' not in (
    '/training-hazard-perception.png',
    '/training-manual-handling.png',
    '/training-working-at-height.png',
    '/training-cyber-awareness.png'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Create the module before uploading a device cover image';
  end if;

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
  cover_path text := definition ->> 'heroImagePath';
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
      updated_by = excluded.updated_by;

  readiness := private.module_authoring_readiness(definition);
  return jsonb_build_object('moduleId', target_module.id, 'savedAt', now(), 'readiness', readiness);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'A module with this URL slug already exists';
end;
$$;

revoke all on function public.admin_save_module_draft(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_module_draft(uuid, jsonb) to authenticated;

create or replace function public.admin_delete_module(module_id uuid, expected_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_module public.training_modules%rowtype;
  deleted_cover_path text;
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
  if exists (
      select 1 from public.module_assignments as assignment
      where assignment.module_id = target_module.id
    )
    or exists (
      select 1 from public.module_progress as progress
      where progress.module_id = target_module.id
    )
    or exists (
      select 1 from public.activity_log as activity
      where activity.module_id = target_module.id
    )
    or exists (
      select 1 from public.quiz_attempts as attempt
      where attempt.module_id = target_module.id
    )
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

revoke all on function public.admin_delete_module(uuid, text) from public, anon;
grant execute on function public.admin_delete_module(uuid, text) to authenticated;

commit;
