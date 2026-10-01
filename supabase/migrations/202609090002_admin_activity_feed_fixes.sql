begin;

create or replace function private.module_game_kind(module_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case
    when m.slug in ('hazard-perception','manual-handling','working-at-height','cyber-awareness') then 'decision'
    when m.content->>'activityKind' in ('decision','forklift_precheck','ppe_dress_up','sorting_zone','load_stacking') then m.content->>'activityKind'
    when m.content#>>'{scenarios,0,id}' like 'game-forklift-%' then 'forklift_precheck'
    when m.content#>>'{scenarios,0,id}' like 'game-ppe-%' then 'ppe_dress_up'
    when m.content#>>'{scenarios,0,id}' like 'game-sort-%' then 'sorting_zone'
    when m.content#>>'{scenarios,0,id}' like 'game-stack-%' then 'load_stacking'
    else 'decision' end from public.training_modules m where m.id = module_id), 'decision');
$$;

create or replace function private.capture_module_admin_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    insert into public.admin_activity_events(category,event_type,actor_id,actor_name,module_title,metadata)
    select 'system','module_deleted',p.id,p.full_name,old.title,
      jsonb_build_object('deletedModuleId',old.id,'status',old.status,'published',old.is_published)
    from (select 1) placeholder left join public.profiles p on p.id = auth.uid();
    return old;
  elsif tg_op = 'INSERT' then
    perform private.write_admin_activity_event('system','module_created',null,new.updated_by,new.id,jsonb_build_object('status',new.status,'published',new.is_published));
  elsif old.status is distinct from new.status or old.is_published is distinct from new.is_published then
    perform private.write_admin_activity_event('system','module_publication_changed',null,new.updated_by,new.id,jsonb_build_object('status',new.status,'published',new.is_published));
  end if;
  return new;
end;
$$;

create or replace function private.capture_activity_log_admin_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare kind text := private.module_game_kind(new.module_id);
begin
  perform private.write_admin_activity_event(
    case when new.event_type = 'activity_completed' and kind <> 'decision' then 'games' else 'training' end,
    new.event_type::text,new.user_id,new.actor_id,new.module_id,
    jsonb_build_object('sourceLogId',new.id,'activityKind',kind,'correct',new.metadata->'correct',
      'percentage',new.metadata->'percentage','passed',new.metadata->'passed','pointsAwarded',new.metadata->'pointsAwarded'),new.created_at);
  return new;
end;
$$;

create or replace function private.capture_progress_admin_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  kind text := private.module_game_kind(new.module_id);
  became_complete boolean := false;
  game_completion boolean := false;
  total integer := 0; correct_count integer := 0;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status
    and old.progress_percent is not distinct from new.progress_percent
    and old.activity_complete is not distinct from new.activity_complete then return new; end if;
  became_complete := new.activity_complete and (tg_op = 'INSERT' or not coalesce(old.activity_complete,false));
  -- Interactive v1 games emit their exact server-scored result themselves.
  game_completion := became_complete and kind <> 'decision' and not exists (
    select 1 from private.activity_scenario_keys k where k.module_id = new.module_id and k.scenario_id like 'play-%-v1');
  if game_completion then
    select count(*),count(*) filter(where a.metadata->'correct' = 'true'::jsonb) into total,correct_count
    from public.activity_log a where a.user_id = new.user_id and a.module_id = new.module_id and a.event_type = 'activity_completed';
  end if;
  perform private.write_admin_activity_event(case when game_completion then 'games' else 'training' end,
    case when game_completion then 'game_completed' else 'progress_updated' end,new.user_id,null,new.module_id,
    jsonb_build_object('activityKind',kind,'progressPercent',new.progress_percent,'status',new.status,'activityComplete',new.activity_complete,
      'score',case when total > 0 then round(correct_count::numeric / total * 100) else null end));
  return new;
end;
$$;

create or replace function private.capture_assignment_admin_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.due_date is distinct from new.due_date then
    perform private.write_admin_activity_event('system',case when tg_op = 'INSERT' then 'assignment_created' else 'assignment_updated' end,
      new.user_id,new.assigned_by,new.module_id,jsonb_build_object('status',new.status,'dueDate',new.due_date),now());
  end if;
  return new;
end;
$$;

update public.admin_activity_events e set category = 'training',
  event_type = case when e.event_type = 'game_completed' then 'progress_updated' else e.event_type end,
  metadata = (e.metadata - 'score') || jsonb_build_object('activityKind','decision')
where e.event_type in ('activity_completed','game_completed') and e.module_id is not null
  and private.module_game_kind(e.module_id) = 'decision';

create or replace function public.admin_activity_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Administrator access required'; end if;
  return jsonb_build_object('ready',exists(select 1 from pg_catalog.pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='admin_activity_events')
    and (select count(*) from pg_catalog.pg_trigger where tgname in ('admin_activity_log_capture','admin_progress_capture','admin_assignment_capture','admin_profile_capture','admin_module_capture') and tgenabled <> 'D') = 5);
end;
$$;
revoke all on function private.module_game_kind(uuid) from public,anon,authenticated;
revoke all on function public.admin_activity_status() from public,anon;
grant execute on function public.admin_activity_status() to authenticated;
commit;
