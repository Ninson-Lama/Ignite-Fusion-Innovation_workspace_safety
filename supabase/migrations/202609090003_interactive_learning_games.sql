begin;

create table public.learning_game_runs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  context_key text not null,
  game_id text not null check(game_id in ('forklift','ppe','sorting','stacking')),
  module_id uuid references public.training_modules(id) on delete cascade,
  state jsonb not null default '{"moves":[],"placements":{}}',
  revision integer not null default 0,
  completed boolean not null default false,
  score integer check(score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key(user_id,context_key),
  check(octet_length(state::text) <= 16000)
);
alter table public.learning_game_runs enable row level security;
revoke all on public.learning_game_runs from public,anon,authenticated;
grant select on public.learning_game_runs to authenticated;
create policy learning_games_read on public.learning_game_runs for select to authenticated
  using(public.is_admin() or (user_id = auth.uid() and public.current_app_role() = 'trainee'));

-- Retain the hardened original implementation in a private, non-callable schema.
-- Keep the public function's OID so existing callers cannot bypass the new guard.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.record_training_activity(uuid,text,integer,text,jsonb)'::regprocedure) into definition;
  if position('configured_scenario.module_id = record_training_activity.module_id' in definition) = 0 then
    raise exception 'Apply all preceding module authoring migrations first';
  end if;
  execute replace(definition,'FUNCTION public.record_training_activity(', 'FUNCTION private.record_training_activity(');
end;
$$;
revoke all on function private.record_training_activity(uuid,text,integer,text,jsonb) from public,anon,authenticated;

create or replace function public.record_training_activity(module_id uuid,event_type text,progress_percent integer default null,event_key text default null,metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if event_type = 'activity_completed' and exists(select 1 from private.activity_scenario_keys k
    where k.module_id = record_training_activity.module_id and k.scenario_id like 'play-%-v1') then
    raise exception using errcode='22023',message='Interactive game evidence is required';
  end if;
  return private.record_training_activity(module_id,event_type,progress_percent,event_key,metadata);
end;
$$;

create or replace function private.check_game_context(game_id text,module_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'trainee'::public.app_role then
    raise exception using errcode='42501',message='Active trainee access required'; end if;
  if game_id is null or game_id not in ('forklift','ppe','sorting','stacking') then raise exception 'Invalid game'; end if;
  if module_id is not null and not exists(select 1 from public.training_modules m where m.id = module_id and m.is_published and m.status='published'
    and m.slug not in ('hazard-perception','manual-handling','working-at-height','cyber-awareness')
    and jsonb_array_length(m.content->'scenarios') = 1 and m.content#>>'{scenarios,0,id}' = 'play-' || game_id || '-v1') then
    raise exception using errcode='22023',message='Published interactive module not found'; end if;
  -- Replacing a module's game must not restore a different game's state/result.
  return case when module_id is null then 'practice:' || game_id
    else 'module:' || module_id::text || ':' || game_id || ':v1' end;
end;
$$;

-- All scores are recomputed here. Neither an API-supplied score nor a browser
-- correctness flag is accepted, including for direct authenticated RPC calls.
create or replace function private.evaluate_learning_game(game_id text,game_state jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  p jsonb := game_state->'placements'; moves jsonb := game_state->'moves';
  key text; val text; scene_key text; action text; required text[]; actual text[];
  x integer:=0; y integer:=4; nx integer; ny integer; brake boolean:=true; raised boolean:=false;
  horn boolean:=false; yielded boolean:=false; loaded boolean:=false; delivered boolean:=false;
  faults integer:=0; score integer:=0; done boolean:=false; hits integer:=0; errors integer:=0;
  bay text; level integer; count_here integer; weight_here integer; weight_below integer;
  weights jsonb := '{"motor":600,"parts":400,"boxes":250,"foam":100,"broken":300}';
  expected jsonb := '{"order":"stock","mismatch":"hold","solvent":"flammable","oxidizer":"oxidizer","carton":"recycle","battery":"incident"}';
begin
  if game_state is null or jsonb_typeof(game_state) <> 'object' or jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(moves) is distinct from 'array'
    or octet_length(game_state::text)>16000 or jsonb_array_length(moves)>300 or (select count(*) from jsonb_object_keys(p))>32 then raise exception 'Invalid game state'; end if;
  if game_id <> 'forklift' and jsonb_array_length(moves)>0 then raise exception 'Unexpected route actions'; end if;
  if game_id='forklift' then
    if p <> '{}'::jsonb then raise exception 'Unexpected placements'; end if;
    for action in select jsonb_array_elements_text(moves) loop
      if action='brake' then brake:=not brake;
      elsif action='forks' then if not brake then faults:=faults+1; else raised:=not raised; end if;
      elsif action='horn' then horn:=x in (2,4);
      elsif action='yield' then yielded:=brake and x in (2,4);
      elsif action in ('pickup','drop') then
        if brake and not raised and y=0 and ((action='pickup' and x=0 and not loaded and not delivered) or (action='drop' and x=6 and loaded)) then
          loaded:=action='pickup'; delivered:=action='drop';
        else faults:=faults+1; end if;
      elsif action in ('up','down','left','right') then
        nx:=x+case action when 'left' then -1 when 'right' then 1 else 0 end;
        ny:=y+case action when 'up' then -1 when 'down' then 1 else 0 end;
        if brake or raised or nx<0 or nx>6 or ny<0 or ny>4 or (nx in (1,5) and ny in (1,2)) or (nx=3 and x<>3 and (not horn or not yielded)) then faults:=faults+1;
        else x:=nx; y:=ny; if x<>3 then horn:=false; yielded:=false; end if; end if;
      else raise exception 'Invalid route action'; end if;
    end loop;
    done:=delivered and x=6 and y=4 and brake and not raised;
    score:=greatest(0,100-faults*10);
  elsif game_id='ppe' then
    for key,val in select * from jsonb_each_text(p) loop
      if key !~ '^(entry|splash|walk):(hat|boots|vest|ears|goggles|face|gloves|apron)$' or val not in ('','equipped') or val is null then raise exception 'Invalid PPE item'; end if;
    end loop;
    done:=true;
    foreach scene_key in array array['entry','splash','walk'] loop
      required:=case scene_key when 'entry' then array['boots','ears','hat','vest'] when 'splash' then array['apron','boots','face','gloves','goggles'] else array['boots','vest'] end;
      select coalesce(array_agg(split_part(e.key,':',2) order by split_part(e.key,':',2)),array[]::text[]) into actual
        from jsonb_each_text(p) e where split_part(e.key,':',1)=scene_key and e.value='equipped';
      if cardinality(actual)=0 then done:=false; end if;
      if actual=required then hits:=hits+1; end if;
    end loop;
    score:=round(hits::numeric/3*100);
  elsif game_id='sorting' then
    for key,val in select * from jsonb_each_text(p) loop
      if not (expected ? key) or val not in ('stock','hold','flammable','oxidizer','recycle','incident') or val is null then raise exception 'Invalid sorting placement'; end if;
    end loop;
    done:=(select count(*) from jsonb_object_keys(p))=6;
    select count(*) into hits from jsonb_each_text(expected) e where p->>e.key=e.value;
    score:=round(hits::numeric/6*100);
  elsif game_id='stacking' then
    for key,val in select * from jsonb_each_text(p) loop
      if not (weights ? key) or val not in ('a0','a1','a2','b0','b1','b2','hold') or val is null then raise exception 'Invalid rack placement'; end if;
    end loop;
    done:=(select count(*) from jsonb_object_keys(p))=5;
    for key in select jsonb_object_keys(weights) loop
      if not(p ? key) or ((key='broken') is distinct from (p->>key='hold')) then errors:=errors+1; end if;
    end loop;
    foreach bay in array array['a','b'] loop
      if (select coalesce(sum((weights->>e.key)::integer),0) from jsonb_each_text(p) e where left(e.value,1)=bay)>900 then errors:=errors+1; end if;
      for level in 0..2 loop
        select count(*),coalesce(max((weights->>e.key)::integer),0) into count_here,weight_here from jsonb_each_text(p) e where e.value=bay||level;
        if count_here>1 or weight_here>(array[700,450,200])[level+1] then errors:=errors+1; end if;
        if level>0 and count_here>0 then
          select coalesce(max((weights->>e.key)::integer),0) into weight_below from jsonb_each_text(p) e where e.value=bay||(level-1);
          if weight_below=0 or weight_below<weight_here then errors:=errors+1; end if;
        end if;
      end loop;
    end loop;
    score:=greatest(0,100-errors*20);
  else raise exception 'Invalid game'; end if;
  return jsonb_build_object('score',score,'complete',done);
end;
$$;

create or replace function public.learning_game_session(game_id text,module_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare context text; result jsonb;
begin
  context:=private.check_game_context(game_id,module_id);
  select jsonb_build_object('state',r.state,'revision',r.revision,'completed',r.completed,'score',r.score) into result
    from public.learning_game_runs r where r.user_id=auth.uid() and r.context_key=context;
  return result;
end;
$$;

create or replace function public.save_learning_game(game_id text,module_id uuid,game_state jsonb,expected_revision integer,finish boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare context text; previous public.learning_game_runs%rowtype; evaluation jsonb; output jsonb; module_slug text; name text;
begin
  context:=private.check_game_context(game_id,module_id);
  if expected_revision is null or expected_revision<0 or finish is null then raise exception 'Invalid revision'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||context,0));
  select * into previous from public.learning_game_runs r where r.user_id=auth.uid() and r.context_key=context for update;
  if previous.completed then return public.learning_game_session(game_id,module_id); end if;
  if coalesce(previous.revision,0)<>expected_revision then raise exception using errcode='40001',message='Game revision conflict'; end if;
  evaluation:=private.evaluate_learning_game(game_id,game_state);
  if finish and not (evaluation->>'complete')::boolean then raise exception 'Complete the challenge before submitting'; end if;
  if module_id is not null then perform public.save_training_checkpoint(module_id,'activity',0); end if;
  insert into public.learning_game_runs(user_id,context_key,game_id,module_id,state,revision,completed,score)
  values(auth.uid(),context,game_id,module_id,game_state,expected_revision+1,finish,case when finish then (evaluation->>'score')::integer else null end)
  on conflict(user_id,context_key) do update set state=excluded.state,revision=excluded.revision,completed=excluded.completed,score=excluded.score,updated_at=now();
  if finish and module_id is not null then
    select m.slug into module_slug from public.training_modules m where m.id=module_id;
    perform private.record_training_activity(module_id,'learning_completed',null,module_slug||':learning','{}');
    perform private.record_training_activity(module_id,'activity_completed',null,'play-'||game_id||'-v1',
      jsonb_build_object('selectedChoiceId',case when (evaluation->>'score')::integer=100 then 'pass' else 'review' end));
    perform public.save_training_checkpoint(module_id,'quiz',0);
  end if;
  if finish or previous.user_id is null then
    name:=case game_id when 'forklift' then 'Forklift Simulator' when 'ppe' then 'PPE Dress-Up' when 'sorting' then 'Sorting Zone' else 'Load Stacking Challenge' end;
    perform private.write_admin_activity_event('games',case when finish then 'game_completed' else 'game_started' end,auth.uid(),null,module_id,
      jsonb_build_object('gameName',name,'gameId',game_id,'score',case when finish then (evaluation->>'score')::integer else null end,'standalone',module_id is null));
  elsif previous.state is distinct from game_state then
    perform private.write_admin_activity_event('games','game_progress_saved',auth.uid(),null,module_id,jsonb_build_object('gameId',game_id,'revision',expected_revision+1));
  end if;
  return public.learning_game_session(game_id,module_id);
end;
$$;
revoke all on function private.check_game_context(text,uuid) from public,anon,authenticated;
revoke all on function private.evaluate_learning_game(text,jsonb) from public,anon,authenticated;
revoke all on function public.learning_game_session(text,uuid) from public,anon;
revoke all on function public.save_learning_game(text,uuid,jsonb,integer,boolean) from public,anon;
grant execute on function public.learning_game_session(text,uuid) to authenticated;
grant execute on function public.save_learning_game(text,uuid,jsonb,integer,boolean) to authenticated;
-- Apply the same immutable mission contract to direct admin RPC callers.
create or replace function private.validate_interactive_game_draft()
returns trigger language plpgsql security definer set search_path = '' as $$
declare definition jsonb := new.definition; marker text; kind text; choices jsonb;
begin
  if not exists(select 1 from jsonb_array_elements(definition->'scenarios') s where s->>'id' like 'play-%') then return new; end if;
  marker:=definition#>>'{scenarios,0,id}'; choices:=definition#>'{scenarios,0,choices}';
  kind:=case marker when 'play-forklift-v1' then 'forklift_precheck' when 'play-ppe-v1' then 'ppe_dress_up' when 'play-sorting-v1' then 'sorting_zone' when 'play-stacking-v1' then 'load_stacking' else null end;
  if kind is null or definition->>'activityKind' is distinct from kind or jsonb_array_length(definition->'scenarios')<>1
    or jsonb_array_length(choices)<>2
    or not exists(select 1 from jsonb_array_elements(choices) c where c->>'id'='pass' and c->'isCorrect'='true'::jsonb)
    or not exists(select 1 from jsonb_array_elements(choices) c where c->>'id'='review' and c->'isCorrect'='false'::jsonb) then
    raise exception using errcode='23514',message='Use the unchanged interactive mission template';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_interactive_game_draft() from public,anon,authenticated;
create trigger validate_interactive_game_draft before insert or update on private.module_authoring_drafts
  for each row execute function private.validate_interactive_game_draft();

create or replace function public.learning_games_status()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception using errcode='42501',message='Administrator access required'; end if;
  return true;
end;
$$;
revoke all on function public.learning_games_status() from public,anon;
grant execute on function public.learning_games_status() to authenticated;
notify pgrst, 'reload schema';
commit;
