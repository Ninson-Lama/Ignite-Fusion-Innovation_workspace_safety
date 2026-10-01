-- Run only against a disposable database with all migrations and seed applied.
begin;
create temporary table harness_checks(test text, passed boolean, observed jsonb);
grant select,insert on harness_checks to authenticated,anon;
create temporary table game_states(game_id text primary key, good jsonb, bad jsonb, expected_bad integer);
grant select on game_states to authenticated,anon;
insert into game_states values
('forklift', '{"moves":["brake","up","up","up","up","brake","pickup","brake","right","right","brake","horn","yield","brake","right","right","right","right","brake","drop","brake","down","down","down","down","brake"],"placements":{}}',
 '{"moves":["up","brake","up","up","up","up","brake","pickup","brake","right","right","brake","horn","yield","brake","right","right","right","right","brake","drop","brake","down","down","down","down","brake"],"placements":{}}',90),
('ppe', '{"moves":[],"placements":{"entry:boots":"equipped","entry:ears":"equipped","entry:hat":"equipped","entry:vest":"equipped","splash:apron":"equipped","splash:boots":"equipped","splash:face":"equipped","splash:gloves":"equipped","splash:goggles":"equipped","walk:boots":"equipped","walk:vest":"equipped"}}',
 '{"moves":[],"placements":{"entry:boots":"equipped","entry:hat":"equipped","entry:vest":"equipped","splash:apron":"equipped","splash:boots":"equipped","splash:face":"equipped","splash:gloves":"equipped","splash:goggles":"equipped","walk:boots":"equipped","walk:vest":"equipped"}}',67),
('sorting','{"moves":[],"placements":{"order":"stock","mismatch":"hold","solvent":"flammable","oxidizer":"oxidizer","carton":"recycle","battery":"incident"}}',
 '{"moves":[],"placements":{"order":"stock","mismatch":"hold","solvent":"flammable","oxidizer":"oxidizer","carton":"recycle","battery":"hold"}}',83),
('stacking','{"moves":[],"placements":{"motor":"a0","foam":"a1","parts":"b0","boxes":"b1","broken":"hold"}}',
 '{"moves":[],"placements":{"motor":"hold","foam":"hold","parts":"hold","boxes":"hold","broken":"hold"}}',20);

insert into harness_checks
select game_id || ' evaluator accepts complete safe state',
 private.evaluate_learning_game(game_id,good) = '{"score":100,"complete":true}'::jsonb,
 private.evaluate_learning_game(game_id,good) from game_states;
insert into harness_checks
select game_id || ' evaluator computes reduced unsafe score',
 private.evaluate_learning_game(game_id,bad) = jsonb_build_object('score',expected_bad,'complete',true),
 private.evaluate_learning_game(game_id,bad) from game_states;
insert into harness_checks
select game_id || ' empty state is incomplete',
 private.evaluate_learning_game(game_id,'{"moves":[],"placements":{}}')->>'complete' = 'false',
 private.evaluate_learning_game(game_id,'{"moves":[],"placements":{}}') from game_states;

create function pg_temp.expect_error(test_name text, statement text, expected_code text default null)
returns void language plpgsql as $$
declare detail_text text; context_text text;
begin
 begin
  execute statement;
  insert into harness_checks values(test_name,false,jsonb_build_object('unexpected','statement succeeded'));
 exception when others then
  get stacked diagnostics detail_text=pg_exception_detail,context_text=pg_exception_context;
  insert into harness_checks values(test_name,expected_code is null or expected_code=sqlstate,
   jsonb_build_object('code',sqlstate,'message',sqlerrm,'detail',detail_text,'context',context_text));
 end;
end;
$$;
grant execute on function pg_temp.expect_error(text,text,text) to authenticated,anon;

select pg_temp.expect_error('forklift invalid action is rejected', $q$select private.evaluate_learning_game('forklift','{"moves":["teleport"],"placements":{}}')$q$);
select pg_temp.expect_error('ppe invalid item is rejected', $q$select private.evaluate_learning_game('ppe','{"moves":[],"placements":{"walk:cape":"equipped"}}')$q$);
select pg_temp.expect_error('sorting invalid destination is rejected', $q$select private.evaluate_learning_game('sorting','{"moves":[],"placements":{"battery":"stockroom"}}')$q$);
select pg_temp.expect_error('stacking invalid load is rejected', $q$select private.evaluate_learning_game('stacking','{"moves":[],"placements":{"unknown":"hold"}}')$q$);

insert into auth.users(id,email,raw_user_meta_data) values
 ('93000000-0000-4000-8000-000000000001','game-admin@example.invalid','{"full_name":"Game Admin"}'),
 ('93000000-0000-4000-8000-000000000002','game-one@example.invalid','{"full_name":"Game One"}'),
 ('93000000-0000-4000-8000-000000000003','game-two@example.invalid','{"full_name":"Game Two"}'),
 ('93000000-0000-4000-8000-000000000004','game-manager@example.invalid','{"full_name":"Game Manager"}'),
 ('93000000-0000-4000-8000-000000000005','game-inactive@example.invalid','{"full_name":"Game Inactive"}');
update public.profiles set role='admin' where id='93000000-0000-4000-8000-000000000001';
update public.profiles set role='manager' where id='93000000-0000-4000-8000-000000000004';
update public.profiles set status='inactive' where id='93000000-0000-4000-8000-000000000005';

insert into public.training_modules(id,slug,title,description,category,estimated_minutes,status,is_published,published_at,content) values
 ('94000000-0000-4000-8000-000000000001','harness-interactive-forklift','Interactive Forklift','A published interactive game fixture','Testing',10,'published',true,now(),'{"activityKind":"forklift_precheck","scenarios":[{"id":"play-forklift-v1"}]}'),
 ('94000000-0000-4000-8000-000000000002','harness-interactive-sorting','Interactive Sorting','A published interactive game fixture','Testing',10,'published',true,now(),'{"activityKind":"sorting_zone","scenarios":[{"id":"play-sorting-v1"}]}'),
 ('94000000-0000-4000-8000-000000000003','harness-unpublished-ppe','Unpublished PPE','A private interactive game fixture','Testing',10,'draft',false,null,'{"activityKind":"ppe_dress_up","scenarios":[{"id":"play-ppe-v1"}]}');
insert into private.activity_scenario_keys(module_id,scenario_id,allowed_choice_ids,correct_choice_id,points) values
 ('94000000-0000-4000-8000-000000000001','play-forklift-v1',array['pass','review'],'pass',100),
 ('94000000-0000-4000-8000-000000000002','play-sorting-v1',array['pass','review'],'pass',100),
 ('94000000-0000-4000-8000-000000000003','play-ppe-v1',array['pass','review'],'pass',100);

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into harness_checks values('new practice session is absent',public.learning_game_session('forklift') is null,to_jsonb(public.learning_game_session('forklift')));

do $$
declare result jsonb;
begin
 result:=public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false);
 insert into harness_checks values('first save persists revision one with no score',result->>'revision'='1' and result->>'completed'='false' and result->>'score' is null,result);
end;
$$;

select pg_temp.expect_error('stale revision fails with 40001',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false)$q$,'40001');
select pg_temp.expect_error('unfinished game cannot finish',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',1,true)$q$);

do $$
declare result jsonb; repeated jsonb;
begin
 result:=public.save_learning_game('forklift',null,(select good from game_states where game_id='forklift'),1,true);
 repeated:=public.save_learning_game('forklift',null,'{"moves":[],"placements":{},"score":999}',0,true);
 insert into harness_checks values('completion persists recomputed score and revision',result->>'score'='100' and result->>'completed'='true' and result->>'revision'='2',result);
 insert into harness_checks values('completion retry is idempotent despite old revision and different evidence',repeated=result,repeated);
end;
$$;

select pg_temp.expect_error('direct table update is denied',$q$update public.learning_game_runs set score=100$q$,'42501');
select pg_temp.expect_error('private evaluator direct call is denied',$q$select private.evaluate_learning_game('forklift','{"moves":[],"placements":{}}')$q$,'42501');
select pg_temp.expect_error('private legacy writer direct call is denied',$q$select private.record_training_activity('94000000-0000-4000-8000-000000000001','activity_completed',null,'play-forklift-v1','{"selectedChoiceId":"pass"}')$q$,'42501');
select pg_temp.expect_error('legacy training RPC cannot bypass interactive evidence',$q$select public.record_training_activity('94000000-0000-4000-8000-000000000001','activity_completed',null,'play-forklift-v1','{"selectedChoiceId":"pass"}')$q$,'22023');
select pg_temp.expect_error('decision RPC cannot bypass interactive evidence',$q$select public.record_decision_activity('94000000-0000-4000-8000-000000000001','play-forklift-v1','pass')$q$,'22023');
select pg_temp.expect_error('unpublished module cannot be played',$q$select public.save_learning_game('ppe','94000000-0000-4000-8000-000000000003','{"moves":[],"placements":{}}',0,false)$q$,'22023');
select pg_temp.expect_error('wrong module game context is rejected',$q$select public.save_learning_game('ppe','94000000-0000-4000-8000-000000000001','{"moves":[],"placements":{}}',0,false)$q$,'22023');

do $$
declare result jsonb; repeated jsonb;
begin
 begin
  result:=public.save_learning_game('sorting','94000000-0000-4000-8000-000000000002',(select bad from game_states where game_id='sorting'),0,true);
  repeated:=public.save_learning_game('sorting','94000000-0000-4000-8000-000000000002',(select good from game_states where game_id='sorting'),0,true);
  insert into harness_checks values('module game records exact partial score and immutable completion',result->>'score'='83' and result->>'completed'='true' and result=repeated,result);
 exception when others then
  insert into harness_checks values('module game records exact partial score and immutable completion',false,jsonb_build_object('code',sqlstate,'message',sqlerrm));
 end;
end;
$$;

insert into harness_checks
select 'module completion integrates learning and activity progress',
 count(*)=1 and bool_and(learning_complete and activity_complete and progress_percent=75),
 jsonb_agg(jsonb_build_object('learning',learning_complete,'activity',activity_complete,'progressPercent',progress_percent,'points',points_earned))
from public.module_progress where user_id=auth.uid() and module_id='94000000-0000-4000-8000-000000000002';

reset role;
insert into harness_checks
select 'practice completion emits one completion event',count(*)=1,jsonb_build_object('count',count(*))
from public.admin_activity_events where user_id='93000000-0000-4000-8000-000000000002' and module_id is null and event_type='game_completed';
insert into harness_checks
select 'module completion emits one exact-score completion event',count(*)=1 and bool_and(metadata->>'score'='83'),jsonb_agg(metadata)
from public.admin_activity_events where user_id='93000000-0000-4000-8000-000000000002' and module_id='94000000-0000-4000-8000-000000000002' and event_type='game_completed';
insert into harness_checks
select 'module result logs one server-computed review decision',count(*)=1 and bool_and(metadata->>'correct'='false' and metadata->>'selectedChoiceId'='review'),jsonb_agg(metadata)
from public.activity_log where user_id='93000000-0000-4000-8000-000000000002' and module_id='94000000-0000-4000-8000-000000000002' and event_type='activity_completed';

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
set local role authenticated;
insert into harness_checks select 'other trainee cannot see saved runs',count(*)=0,jsonb_build_object('visible',count(*)) from public.learning_game_runs;
insert into harness_checks values('other trainee has separate practice session',public.learning_game_session('forklift') is null,to_jsonb(public.learning_game_session('forklift')));
reset role;

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into harness_checks select 'admin can read saved runs',count(*)=2,jsonb_build_object('visible',count(*)) from public.learning_game_runs;
select pg_temp.expect_error('admin cannot create trainee game session',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false)$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_error('manager cannot save trainee game',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false)$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select pg_temp.expect_error('inactive trainee cannot save game',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false)$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_error('anonymous caller cannot save game',$q$select public.save_learning_game('forklift',null,'{"moves":[],"placements":{}}',0,false)$q$,'42501');
reset role;

-- Exercise the real admin authoring/materialisation path for every engine.
create temporary table authored_games(game_id text primary key,module_id uuid,definition jsonb);
grant select,insert on authored_games to authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into harness_checks values('admin game readiness status succeeds',public.learning_games_status(),'{}');
do $$
declare game text; kind text; definition jsonb; created jsonb; published jsonb; question_list jsonb;
begin
 foreach game in array array['forklift','ppe','sorting','stacking'] loop
  kind:=case game when 'forklift' then 'forklift_precheck' when 'ppe' then 'ppe_dress_up' when 'sorting' then 'sorting_zone' else 'load_stacking' end;
  select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'questionType','single_choice','prompt','Choose the safe action for test '||n,
    'explanation','The safe action protects everyone.','points',10,'options','[{"id":"safe","label":"Safe action","isCorrect":true},{"id":"unsafe","label":"Unsafe action","isCorrect":false}]'::jsonb))
   into question_list from generate_series(1,3) as n;
  definition:=jsonb_build_object('title','Authored test '||game,'slug','harness-authored-'||game,'description','An authored interactive module for validation.',
   'overview','Complete the practical challenge and verify learning through the quiz.','category','Testing','estimatedMinutes',10,'difficulty','introductory',
   'passMark',80,'pointsAvailable',300,'sortOrder',100,'heroImagePath','/training-hazard-perception.png','activityKind',kind,
   'learningObjectives','["Apply safety rules","Recognize workplace risks"]'::jsonb,
   'learning','[{"id":"prepare","title":"Prepare safely","summary":"Check the work area before beginning.","points":["Identify nearby hazards","Check all required equipment"]},{"id":"complete","title":"Complete safely","summary":"Follow every safety requirement during the task.","points":["Follow the safety instructions","Review your results carefully"]}]'::jsonb,
   'scenarios',jsonb_build_array(jsonb_build_object('id','play-'||game||'-v1','situation','Complete the interactive mission and review the results.','prompt','Complete the interactive challenge',
     'choices','[{"id":"pass","label":"All safety rules met","feedback":"All exercise rules were met.","isCorrect":true},{"id":"review","label":"Review the game result","feedback":"Review the feedback before continuing.","isCorrect":false}]'::jsonb)),
   'questions',question_list);
  begin
   created:=public.admin_create_module_draft(definition);
   published:=public.set_module_publication((created#>>'{module,id}')::uuid,true);
   insert into authored_games values(game,(created#>>'{module,id}')::uuid,definition);
   insert into harness_checks values(game||' admin can create and publish a ready interactive module',created#>>'{readiness,ready}'='true' and published->>'isPublished'='true',published);
  exception when others then
   insert into harness_checks values(game||' admin can create and publish a ready interactive module',false,jsonb_build_object('code',sqlstate,'message',sqlerrm));
  end;
 end loop;
end;
$$;
reset role;
insert into harness_checks
select a.game_id||' materialisation protects scoring keys and preserves engine marker',
 m.content->>'schemaVersion'='2' and m.content#>>'{scenarios,0,id}'='play-'||a.game_id||'-v1'
 and not ((m.content#>'{scenarios,0,choices,0}') ? 'isCorrect')
 and (select count(*)=1 and bool_and(k.correct_choice_id='pass') from private.activity_scenario_keys k where k.module_id=a.module_id),m.content
from authored_games a join public.training_modules m on m.id=a.module_id;

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare baseline jsonb; changed jsonb; created jsonb;
begin
 select definition||'{"slug":"harness-tampered-contract"}' into baseline from authored_games where game_id='forklift';
 changed:=jsonb_set(baseline,'{scenarios,0,choices,0,isCorrect}','false');
 perform pg_temp.expect_error('admin cannot change mission pass correctness',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios,0,choices,1,isCorrect}','true');
 perform pg_temp.expect_error('admin cannot change mission review correctness',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{activityKind}','"ppe_dress_up"');
 perform pg_temp.expect_error('admin cannot mismatch mission and activity kind',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios,0,id}','"play-forklift-v2"');
 perform pg_temp.expect_error('admin cannot introduce unknown mission version',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios,0,choices,1,id}','"skip"');
 perform pg_temp.expect_error('admin cannot replace reserved mission choice',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios,0,choices}',(baseline#>'{scenarios,0,choices}')||'[{"id":"skip","label":"Skip mission","feedback":"This is invalid feedback.","isCorrect":false}]');
 perform pg_temp.expect_error('admin cannot append a third mission choice',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios}',(baseline->'scenarios')||(baseline->'scenarios'));
 perform pg_temp.expect_error('admin cannot append another mission round',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios}',jsonb_build_array(jsonb_set(baseline#>'{scenarios,0}','{id}','"legacy-round"'),baseline#>'{scenarios,0}'));
 perform pg_temp.expect_error('admin cannot hide mission marker after a legacy round',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=baseline-'activityKind';
 perform pg_temp.expect_error('admin cannot omit activity kind for mission marker',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 changed:=jsonb_set(baseline,'{scenarios,0,choices,0,isCorrect}','"true"');
 perform pg_temp.expect_error('admin cannot use string correctness in mission contract',format('select public.admin_create_module_draft(%L::jsonb)',changed),'23514');
 -- A historic round marker retains its ordinary decision path.
 changed:=jsonb_set(jsonb_set(baseline,'{slug}','"harness-authored-legacy-round"'),'{scenarios,0,id}','"game-forklift-01"');
 changed:=jsonb_set(changed,'{questions}',(select jsonb_agg(jsonb_set(q,'{id}',to_jsonb(gen_random_uuid()::text))) from jsonb_array_elements(changed->'questions') q));
 created:=public.admin_create_module_draft(changed);
 perform public.set_module_publication((created#>>'{module,id}')::uuid,true);
 insert into harness_checks values('admin can still publish legacy round templates',created#>>'{readiness,ready}'='true',created);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare result jsonb;
begin
 result:=public.record_decision_activity((select id from public.training_modules where slug='harness-authored-legacy-round'),'game-forklift-01','pass');
 insert into harness_checks values('legacy authored round remains playable through decision RPC',result->>'correct'='true',result);
end;
$$;
select pg_temp.expect_error('trainee game readiness status is forbidden',$q$select public.learning_games_status()$q$,'42501');
select pg_temp.expect_error('negative revision is rejected',$q$select public.save_learning_game('ppe',null,'{"moves":[],"placements":{}}',-1,false)$q$,'P0001');
select pg_temp.expect_error('null revision is rejected',$q$select public.save_learning_game('ppe',null,'{"moves":[],"placements":{}}',null,false)$q$,'P0001');
select pg_temp.expect_error('null finish is rejected',$q$select public.save_learning_game('ppe',null,'{"moves":[],"placements":{}}',0,null)$q$,'P0001');
select pg_temp.expect_error('non-object game state is rejected',$q$select public.save_learning_game('ppe',null,'[]',0,false)$q$);
select pg_temp.expect_error('null game state is rejected',$q$select public.save_learning_game('ppe',null,null,0,false)$q$);
select pg_temp.expect_error('non-forklift move transcript is rejected',$q$select public.save_learning_game('ppe',null,'{"moves":["up"],"placements":{}}',0,false)$q$,'P0001');
select pg_temp.expect_error('null PPE placement is rejected',$q$select public.save_learning_game('ppe',null,'{"moves":[],"placements":{"walk:boots":null}}',0,false)$q$,'P0001');
select pg_temp.expect_error('direct table insert is denied',$q$insert into public.learning_game_runs(user_id,context_key,game_id) values(auth.uid(),'practice:ppe','ppe')$q$,'42501');
select pg_temp.expect_error('direct table delete is denied',$q$delete from public.learning_game_runs$q$,'42501');

do $$
declare fixture record; saved jsonb; finished jsonb; retried jsonb; answers jsonb; question jsonb; quiz jsonb;
begin
 for fixture in select a.*,g.good,g.bad from authored_games a join game_states g using(game_id) loop
  begin
   saved:=public.save_learning_game(fixture.game_id,fixture.module_id,fixture.bad,0,false);
   insert into harness_checks values(fixture.game_id||' authored module saves and resumes exact partial evidence',
    saved=public.learning_game_session(fixture.game_id,fixture.module_id) and saved->'state'=fixture.bad and saved->>'revision'='1' and saved->>'score' is null,saved);
   insert into harness_checks
    select fixture.game_id||' partial game resumes at activity checkpoint',
     count(*)=1 and bool_and(p.resume_stage='activity' and p.resume_position=0 and not p.activity_complete),
     jsonb_agg(jsonb_build_object('resumeStage',p.resume_stage,'resumePosition',p.resume_position,'activityComplete',p.activity_complete))
    from public.module_progress p where p.user_id=auth.uid() and p.module_id=fixture.module_id;
   perform pg_temp.expect_error(fixture.game_id||' authored module legacy completion bypass rejected',
    format('select public.record_training_activity(%L,''activity_completed'',null,%L,''{"selectedChoiceId":"pass","score":100}'')',fixture.module_id,'play-'||fixture.game_id||'-v1'),'22023');
   finished:=public.save_learning_game(fixture.game_id,fixture.module_id,fixture.good||'{"score":999,"correct":false}',1,true);
   retried:=public.save_learning_game(fixture.game_id,fixture.module_id,fixture.bad,0,false);
   insert into harness_checks values(fixture.game_id||' authored module score ignores client flags and completion is immutable',
    finished->>'score'='100' and finished->>'revision'='2' and finished->>'completed'='true' and retried=finished,finished);
   insert into harness_checks
    select fixture.game_id||' finished game resumes at quiz checkpoint',
     count(*)=1 and bool_and(p.resume_stage='quiz' and p.resume_position=0 and p.activity_complete and p.learning_complete),
     jsonb_agg(jsonb_build_object('resumeStage',p.resume_stage,'resumePosition',p.resume_position,'activityComplete',p.activity_complete))
    from public.module_progress p where p.user_id=auth.uid() and p.module_id=fixture.module_id;
   answers:='{}';
   for question in select jsonb_array_elements(fixture.definition->'questions') loop
    perform public.check_quiz_answer((question->>'id')::uuid,'["safe"]');
    answers:=answers||jsonb_build_object(question->>'id','["safe"]'::jsonb);
   end loop;
   quiz:=public.submit_quiz(fixture.module_id,answers);
   insert into harness_checks
    select fixture.game_id||' authored game and quiz complete module to 100 percent',
     count(*)=1 and bool_and(p.learning_complete and p.activity_complete and p.progress_percent=100 and p.status='completed' and p.resume_stage='completed' and p.resume_position=100),
     jsonb_agg(jsonb_build_object('progressPercent',p.progress_percent,'status',p.status,'resumeStage',p.resume_stage,'resumePosition',p.resume_position,'points',p.points_earned,'quiz',quiz))
    from public.module_progress p where p.user_id=auth.uid() and p.module_id=fixture.module_id;
  exception when others then
   insert into harness_checks values(fixture.game_id||' authored trainee lifecycle succeeds',false,jsonb_build_object('code',sqlstate,'message',sqlerrm));
  end;
 end loop;
end;
$$;
reset role;
insert into harness_checks
 select a.game_id||' authored module completion emits exactly one server score',
  count(*)=1 and bool_and(e.metadata->>'score'='100'),jsonb_agg(e.metadata)
 from authored_games a join public.admin_activity_events e on e.module_id=a.module_id and e.event_type='game_completed'
 where e.user_id='93000000-0000-4000-8000-000000000002' group by a.game_id;
insert into harness_checks
 select 'all four authored modules are exercised',count(*)=4,jsonb_build_object('modules',count(*)) from authored_games;

select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
set local role authenticated;
insert into harness_checks
 select a.game_id||' authored module session remains private to its trainee',public.learning_game_session(a.game_id,a.module_id) is null,'{}' from authored_games a;
reset role;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000005',true);
set local role authenticated;
select pg_temp.expect_error('inactive trainee cannot read session RPC',$q$select public.learning_game_session('forklift')$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_error('anonymous caller cannot read session RPC',$q$select public.learning_game_session('forklift')$q$,'42501');
reset role;

-- A replacement engine must not load a different game's saved result.
update public.training_modules set content=jsonb_set(jsonb_set(content,'{activityKind}','"ppe_dress_up"'),'{scenarios,0,id}','"play-ppe-v1"')
where id='94000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
set local role authenticated;
insert into harness_checks values('replacement game does not restore the previous game result',
 public.learning_game_session('ppe','94000000-0000-4000-8000-000000000002') is null,'{}');
do $$ declare saved jsonb; begin
 saved:=public.save_learning_game('ppe','94000000-0000-4000-8000-000000000002','{"moves":[],"placements":{"walk:boots":"equipped"}}',0,false);
 insert into harness_checks values('replacement game saves independently at revision one',
  saved->>'revision'='1' and saved->>'completed'='false' and saved->>'score' is null,saved);
end; $$;
reset role;
insert into harness_checks select 'previous game result is retained separately',
 count(*)=2 and count(*) filter(where game_id='sorting' and completed and score=83)=1,
 jsonb_agg(jsonb_build_object('game',game_id,'completed',completed,'score',score))
from public.learning_game_runs where module_id='94000000-0000-4000-8000-000000000002' and user_id='93000000-0000-4000-8000-000000000002';

do $$ begin
  if exists(select 1 from harness_checks where passed is distinct from true) then
    raise exception 'Safety360 database regression checks failed: %', (select string_agg(test, ', ') from harness_checks where passed is distinct from true);
  end if;
end; $$;
select test,passed,observed from harness_checks order by test;
rollback;
