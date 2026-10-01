-- Run only against a disposable database with all migrations and seed applied.
begin;

create temporary table harness_checks (test text, passed boolean, observed jsonb);
grant select, insert on harness_checks to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('91000000-0000-4000-8000-000000000001', 'harness-admin@example.invalid', '{"full_name":"Harness Admin"}'),
 ('91000000-0000-4000-8000-000000000002', 'harness-trainee@example.invalid', '{"full_name":"Harness Trainee"}');
update public.profiles set role = 'admin' where id = '91000000-0000-4000-8000-000000000001';

insert into public.training_modules (id, slug, title, description, category, estimated_minutes, content) values
 ('92000000-0000-4000-8000-000000000001', 'harness-decision', 'Harness Decision', 'Ordinary training activity fixture', 'Testing', 10,
  '{"activityKind":"decision","scenarios":[{"id":"game-forklift-01"}]}'),
 ('92000000-0000-4000-8000-000000000002', 'harness-forklift', 'Harness Forklift', 'Actual mini-game activity fixture', 'Testing', 10,
  '{"activityKind":"forklift_precheck","scenarios":[{"id":"custom-round-01"}]}'),
 ('92000000-0000-4000-8000-000000000003', 'harness-legacy-game', 'Harness Legacy Game', 'Legacy inferred game activity fixture', 'Testing', 10,
  '{"scenarios":[{"id":"game-stack-01"}]}'),
 ('92000000-0000-4000-8000-000000000004', 'harness-complete-insert', 'Harness Complete Insert', 'Already complete insertion fixture', 'Testing', 10,
  '{"activityKind":"ppe_dress_up","scenarios":[{"id":"custom-ppe-01"}]}'),
 ('92000000-0000-4000-8000-000000000005', 'harness-deletion', 'Harness Deleted Title', 'Unused private draft deletion fixture', 'Testing', 10,
  '{}');

insert into private.module_authoring_drafts (module_id, definition)
values ('92000000-0000-4000-8000-000000000005', '{}');

insert into public.activity_log (user_id, module_id, event_type, event_key, metadata)
select '91000000-0000-4000-8000-000000000002', module.id, 'activity_completed',
  'activity_completed:' || round.number, jsonb_build_object('correct', round.number = 1, 'scenarioId', case module.slug
    when 'harness-decision' then 'game-forklift-01'
    when 'harness-forklift' then 'custom-round-01'
    when 'harness-legacy-game' then 'game-stack-01'
    else 'custom-ppe-01' end, 'pointsAwarded', case when round.number = 1 then 100 else 0 end)
from public.training_modules module cross join generate_series(1,2) as round(number)
where module.slug in ('harness-decision', 'harness-forklift', 'harness-legacy-game', 'harness-complete-insert');

insert into public.module_progress (user_id, module_id, progress_percent, status, learning_complete, started_at)
select '91000000-0000-4000-8000-000000000002', module.id, 45, 'in_progress', true, now()
from public.training_modules module
where module.slug in ('harness-decision', 'harness-forklift', 'harness-legacy-game');

update public.module_progress set progress_percent = 70, activity_complete = true
where user_id = '91000000-0000-4000-8000-000000000002';

insert into public.module_progress (user_id, module_id, progress_percent, status, learning_complete, activity_complete, started_at)
values ('91000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000004', 70, 'in_progress', true, true, now());

insert into harness_checks
select 'ordinary activity is training despite game-like scenario prefix',
  bool_and(category = 'training'), jsonb_agg(jsonb_build_object('category',category,'eventType',event_type,'metadata',metadata))
from public.admin_activity_events where module_id = '92000000-0000-4000-8000-000000000001' and event_type = 'activity_completed';

insert into harness_checks
select 'ordinary completion emits training progress and no game completion',
  count(*) filter (where event_type = 'game_completed') = 0 and
  count(*) filter (where event_type = 'progress_updated' and metadata ->> 'activityComplete' = 'true' and category = 'training') = 1,
  jsonb_agg(jsonb_build_object('category',category,'eventType',event_type,'metadata',metadata))
from public.admin_activity_events where module_id = '92000000-0000-4000-8000-000000000001' and event_type in ('progress_updated','game_completed');

insert into harness_checks
select 'explicit mini-game kind works without prefixed scenario ids',
  count(*) filter (where event_type = 'activity_completed' and category = 'games') = 2 and
  count(*) filter (where event_type = 'game_completed' and category = 'games' and metadata ->> 'score' = '50') = 1,
  jsonb_agg(jsonb_build_object('category',category,'eventType',event_type,'metadata',metadata))
from public.admin_activity_events where module_id = '92000000-0000-4000-8000-000000000002' and event_type in ('activity_completed','game_completed');

insert into harness_checks
select 'legacy inferred mini-game is classified as games',
  count(*) filter (where event_type = 'activity_completed' and category = 'games') = 2 and
  count(*) filter (where event_type = 'game_completed' and category = 'games') = 1,
  jsonb_agg(jsonb_build_object('category',category,'eventType',event_type))
from public.admin_activity_events where module_id = '92000000-0000-4000-8000-000000000003' and event_type in ('activity_completed','game_completed');

insert into harness_checks
select 'already completed mini-game INSERT emits completion',
  count(*) filter (where event_type = 'game_completed' and category = 'games') = 1,
  jsonb_agg(jsonb_build_object('category',category,'eventType',event_type,'metadata',metadata))
from public.admin_activity_events where module_id = '92000000-0000-4000-8000-000000000004' and event_type in ('progress_updated','game_completed');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare saved_result jsonb; error_detail text; error_context text;
begin
  begin
    saved_result := public.admin_delete_module('92000000-0000-4000-8000-000000000005', 'harness-deletion');
    insert into harness_checks values ('unused draft deletion succeeds', saved_result ->> 'deleted' = 'true', saved_result);
  exception when others then
    get stacked diagnostics error_detail = pg_exception_detail, error_context = pg_exception_context;
    insert into harness_checks values ('unused draft deletion succeeds', false,
      jsonb_build_object('code',sqlstate,'message',sqlerrm,'detail',error_detail,'context',error_context));
  end;
end;
$$;

insert into harness_checks
select 'deleted module audit snapshot retains title with null FK',
  count(*) = 1 and bool_and(module_id is null and module_title = 'Harness Deleted Title'),
  jsonb_agg(jsonb_build_object('moduleId',module_id,'moduleTitle',module_title,'metadata',metadata))
from public.admin_activity_events where event_type = 'module_deleted' and module_title = 'Harness Deleted Title';

insert into harness_checks
select 'active admin can read projection', count(*) > 0, jsonb_build_object('visibleRows',count(*))
from public.admin_activity_events;

reset role;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002', true);
set local role authenticated;

insert into harness_checks
select 'trainee cannot read projection', count(*) = 0, jsonb_build_object('visibleRows',count(*))
from public.admin_activity_events;

do $$
begin
  begin
    insert into public.admin_activity_events(category,event_type) values ('system','forged_event');
    insert into harness_checks values ('trainee cannot write projection', false, '{}');
  exception when insufficient_privilege then
    insert into harness_checks values ('trainee cannot write projection', true, jsonb_build_object('code',sqlstate,'message',sqlerrm));
  end;
end;
$$;

reset role;
do $$ begin
  if exists(select 1 from harness_checks where passed is distinct from true) then
    raise exception 'Safety360 database regression checks failed: %', (select string_agg(test, ', ') from harness_checks where passed is distinct from true);
  end if;
end; $$;
select test, passed, observed from harness_checks order by test;
rollback;
