-- Run with: supabase test db
-- Requires migrations and supabase/seed.sql to have been applied.

begin;

create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
select extensions.plan(48);

select extensions.is(
  (select count(*) from public.training_modules),
  4::bigint,
  'four core modules are seeded'
);

select extensions.is(
  (select count(*) from public.quiz_questions),
  32::bigint,
  'eight questions are seeded for each core module'
);

select extensions.is(
  (select count(*) from private.quiz_answer_keys),
  32::bigint,
  'every seeded question has a private answer key'
);

select extensions.is(
  (select count(*) from private.activity_scenario_keys),
  15::bigint,
  'the fifteen decision scenarios have private server-side scoring keys'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'rls-trainee-a@example.invalid',
    now(),
    '{}'::jsonb,
    '{"full_name":"Test Trainee A"}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'rls-trainee-b@example.invalid',
    now(),
    '{}'::jsonb,
    '{"full_name":"Test Trainee B"}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'rls-manager-a@example.invalid',
    now(),
    '{}'::jsonb,
    '{"full_name":"Test Manager A"}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'rls-manager-b@example.invalid',
    now(),
    '{}'::jsonb,
    '{"full_name":"Test Manager B"}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'rls-admin@example.invalid',
    now(),
    '{}'::jsonb,
    '{"full_name":"Test Administrator"}'::jsonb,
    now(),
    now()
  );

select extensions.is(
  (
    select role::text from public.profiles
    where id = '30000000-0000-4000-8000-000000000001'
  ),
  'trainee',
  'the auth hook always creates a trainee profile'
);

update public.profiles
set department = case
      when id in (
        '30000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000003'
      ) then 'Receiving'
      else 'Assembly'
    end,
    role = case
      when id in (
        '30000000-0000-4000-8000-000000000003',
        '30000000-0000-4000-8000-000000000004'
      ) then 'manager'::public.app_role
      when id = '30000000-0000-4000-8000-000000000005'
        then 'admin'::public.app_role
      else 'trainee'::public.app_role
    end
where id::text like '30000000-0000-4000-8000-%';

create temporary table test_quiz_answers as
select
  question.module_id,
  jsonb_object_agg(question.id::text, answer_key.correct_answer) as answers
from public.quiz_questions as question
join private.quiz_answer_keys as answer_key on answer_key.question_id = question.id
group by question.module_id;

grant select on test_quiz_answers to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  true
);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'a trainee sees only their profile'
);

select extensions.throws_ok(
  $$
    update public.profiles
    set role = 'admin'
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'Only administrators can change protected profile fields',
  'a trainee cannot promote their own role'
);

select extensions.throws_ok(
  $$ select count(*) from private.quiz_answer_keys $$,
  '42501',
  'permission denied for schema private',
  'an authenticated trainee cannot query answer keys'
);

select extensions.throws_ok(
  $$ select count(*) from private.activity_scenario_keys $$,
  '42501',
  'permission denied for schema private',
  'an authenticated trainee cannot query activity scoring keys'
);

select extensions.throws_ok(
  $$ select count(*) from private.quiz_answer_locks $$,
  '42501',
  'permission denied for schema private',
  'an authenticated trainee cannot inspect checked-answer locks'
);

select extensions.throws_ok(
  $$ select explanation from public.quiz_questions limit 1 $$,
  '42501',
  'permission denied for table quiz_questions',
  'authored feedback cannot be selected before an answer'
);

select extensions.is(
  (
    select count(*)
    from public.quiz_questions_for_module(
      '10000000-0000-4000-8000-000000000001'
    )
  ),
  8::bigint,
  'the safe question RPC returns all eight active questions'
);

select extensions.is(
  (
    public.check_quiz_answer(
      '11000000-0000-4000-8100-000000000001',
      '["b"]'::jsonb
    ) ->> 'correct'
  )::boolean,
  true,
  'answer checking returns correctness without exposing the key table'
);

select extensions.throws_ok(
  $$
    select public.check_quiz_answer(
      '11000000-0000-4000-8100-000000000001',
      '["a"]'::jsonb
    )
  $$,
  '22023',
  'This question already has a checked answer for the active assessment',
  'a different answer cannot be enumerated after the first checked selection'
);

do $$
begin
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'module_started',
    90,
    null,
    '{}'::jsonb
  );
end
$$;

select extensions.is(
  (
    select progress_percent
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000002'
  ),
  5,
  'caller-supplied progress is ignored in favour of the server-derived stage'
);

do $$
declare
  hazard_id text;
begin
  foreach hazard_id in array array[
    'liquid-spill',
    'blocked-exit',
    'unsafe-lift',
    'vehicle-conflict',
    'unsafe-stacking',
    'unsafe-height',
    'missing-ppe'
  ]
  loop
    perform public.record_training_activity(
      '10000000-0000-4000-8000-000000000001',
      'activity_completed',
      null,
      hazard_id,
      '{}'::jsonb
    );
  end loop;

  -- A repeated hotspot is intentionally idempotent.
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000001',
    'activity_completed',
    null,
    'liquid-spill',
    '{}'::jsonb
  );
end
$$;

select extensions.is(
  (
    select count(*)
    from public.activity_log
    where event_type = 'activity_completed'
  ),
  7::bigint,
  'duplicate hazard events do not create duplicate score records'
);

select extensions.is(
  (
    select points_earned
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  700,
  'seven recognised hazards persist a 700-point activity score'
);

select extensions.is(
  (
    select activity_complete
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  true,
  'all seven hazards complete the immersive activity'
);

do $$
declare
  correct_answers jsonb;
  answer_entry record;
begin
  select answers
  into correct_answers
  from test_quiz_answers
  where module_id = '10000000-0000-4000-8000-000000000001';

  for answer_entry in select key, value from jsonb_each(correct_answers)
  loop
    perform public.check_quiz_answer(answer_entry.key::uuid, answer_entry.value);
  end loop;

  perform public.submit_quiz(
    '10000000-0000-4000-8000-000000000001',
    correct_answers
  );
end
$$;

select extensions.is(
  (
    select passed from public.quiz_attempts
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  true,
  'authoritative scoring records a passing result'
);

select extensions.is(
  (
    select activity_score from public.quiz_attempts
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  700,
  'quiz submission snapshots the server-derived activity score'
);

select extensions.is(
  (
    select started_at <= completed_at
    from public.quiz_attempts
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  true,
  'attempt timing starts from the earliest trusted checked-answer lock'
);

select extensions.is(
  (
    public.check_quiz_answer(
      '11000000-0000-4000-8100-000000000001',
      '["a"]'::jsonb
    ) ->> 'correct'
  )::boolean,
  false,
  'a submitted attempt clears locks so a new learning attempt may check another answer'
);

select extensions.is(
  (
    select status::text from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  'in_progress',
  'activity plus a passed quiz cannot complete a module without learning'
);

do $$
begin
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000001',
    'learning_completed'
  );
end
$$;

select extensions.is(
  (
    select status::text from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000001'
  ),
  'completed',
  'learning, activity completion and a passed quiz complete the module'
);

select extensions.is(
  (
    select count(*) from public.user_achievements
    where user_id = '30000000-0000-4000-8000-000000000001'
  ),
  3::bigint,
  'the first, perfect and hazard achievements are awarded once'
);

do $$
declare
  correct_answers jsonb;
  answer_entry record;
begin
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'learning_completed'
  );

  -- The first decision is wrong; replaying the same id with the right choice is
  -- an idempotent no-op. The remaining four decisions are correct.
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed',
    100,
    'mh-1',
    '{"selectedChoiceId":"a"}'::jsonb
  );
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed',
    0,
    'mh-1',
    '{"selectedChoiceId":"b"}'::jsonb
  );
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed', null, 'mh-2', '{"selectedChoiceId":"a"}'::jsonb
  );
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed', null, 'mh-3', '{"selectedChoiceId":"b"}'::jsonb
  );
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed', null, 'mh-4', '{"selectedChoiceId":"b"}'::jsonb
  );
  perform public.record_training_activity(
    '10000000-0000-4000-8000-000000000002',
    'activity_completed', null, 'mh-5', '{"selectedChoiceId":"a"}'::jsonb
  );

  select answers
  into correct_answers
  from test_quiz_answers
  where module_id = '10000000-0000-4000-8000-000000000002';

  for answer_entry in select key, value from jsonb_each(correct_answers)
  loop
    perform public.check_quiz_answer(answer_entry.key::uuid, answer_entry.value);
  end loop;

  perform public.submit_quiz(
    '10000000-0000-4000-8000-000000000002',
    correct_answers
  );
end
$$;

select extensions.is(
  (
    select points_earned
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000002'
  ),
  600,
  'decision points are server-derived from four correct choices plus quiz points'
);

select extensions.is(
  (
    select activity_complete
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000002'
  ),
  true,
  'all five distinct recognised scenarios complete the decision activity'
);

select extensions.is(
  (
    select activity_score
    from public.quiz_attempts
    where module_id = '10000000-0000-4000-8000-000000000002'
  ),
  400,
  'quiz submission snapshots the server-derived decision activity score'
);

select extensions.is(
  (
    select status::text
    from public.module_progress
    where module_id = '10000000-0000-4000-8000-000000000002'
  ),
  'completed',
  'a decision module completes only after learning, all scenarios and a passed quiz'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000003',
  true
);

select extensions.is(
  (select count(*) from public.module_progress),
  2::bigint,
  'a manager sees all progress for a trainee in the same department'
);

select extensions.is(
  (public.reports_summary() ->> 'totalTrainees')::integer,
  1,
  'a manager report is scoped to their department'
);

select extensions.is(
  public.reports_summary() ->> 'scope',
  'department',
  'manager report identifies its department scope'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000004',
  true
);

select extensions.is(
  (select count(*) from public.module_progress),
  0::bigint,
  'a manager cannot see progress from another department'
);

select extensions.is(
  public.reports_summary() ->> 'averageQuizPercentage',
  null::text,
  'a report with no quiz attempts returns a null average rather than zero'
);

insert into public.module_assignments (user_id, module_id, status, due_date)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'assigned',
  current_date + 20
);

select extensions.throws_ok(
  $$
    delete from public.module_assignments
    where user_id = '30000000-0000-4000-8000-000000000002'
      and module_id = '10000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'permission denied for table module_assignments',
  'a manager cannot hard-delete assignment history'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000005',
  true
);

select extensions.is(
  (select count(*) from public.profiles),
  5::bigint,
  'an administrator can read all test profiles'
);

select extensions.is(
  (select count(*) from public.leaderboard_snapshot()),
  2::bigint,
  'the leaderboard exposes active trainees only'
);

select extensions.is(
  (public.reports_summary() ->> 'totalTrainees')::integer,
  2,
  'administrator reports cover all active trainees'
);

insert into public.module_assignments (
  user_id,
  module_id,
  status,
  completed_at,
  due_date
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'completed',
  now() - interval '1 minute',
  current_date + 10
);

insert into public.module_assignments (
  user_id,
  module_id,
  status,
  due_date
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'assigned',
  current_date + 30
)
on conflict on constraint module_assignments_user_module_unique do update
set status = excluded.status,
    completed_at = excluded.completed_at,
    due_date = excluded.due_date;

select extensions.is(
  (
    select status::text || '|' || (completed_at = now() - interval '1 minute')::text
    from public.module_assignments
    where user_id = '30000000-0000-4000-8000-000000000001'
      and module_id = '10000000-0000-4000-8000-000000000001'
  ),
  'completed|true',
  'an administrator upsert preserves completed status and completion time'
);

select extensions.is(
  (
    select due_date
    from public.module_assignments
    where user_id = '30000000-0000-4000-8000-000000000001'
      and module_id = '10000000-0000-4000-8000-000000000001'
  ),
  current_date + 30,
  'an administrator may revise the due date without reopening completed work'
);

insert into public.module_assignments (user_id, module_id, status, due_date)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'in_progress',
  current_date + 10
);

insert into public.module_assignments (user_id, module_id, status, due_date)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'assigned',
  current_date + 30
)
on conflict on constraint module_assignments_user_module_unique do update
set status = excluded.status,
    completed_at = excluded.completed_at,
    due_date = excluded.due_date;

select extensions.is(
  (
    select status::text
    from public.module_assignments
    where user_id = '30000000-0000-4000-8000-000000000002'
      and module_id = '10000000-0000-4000-8000-000000000002'
  ),
  'in_progress',
  'an administrator upsert also preserves an in-progress assignment state'
);

insert into public.module_assignments (user_id, module_id, status, due_date)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  'assigned',
  current_date + 30
);

select extensions.throws_ok(
  $$
    select public.set_module_publication(
      '10000000-0000-4000-8000-000000000003',
      false
    )
  $$,
  '23514',
  'Module cannot be unpublished or archived while active assignments exist',
  'an actively assigned module cannot be unpublished'
);

select extensions.throws_ok(
  $$
    select public.manage_module(
      '10000000-0000-4000-8000-000000000003',
      false,
      'archived'
    )
  $$,
  '23514',
  'Module cannot be unpublished or archived while active assignments exist',
  'an actively assigned module cannot be archived'
);

create temporary table historical_attempt as
select id
from public.quiz_attempts
where user_id = '30000000-0000-4000-8000-000000000001'
  and module_id = '10000000-0000-4000-8000-000000000001';
grant select on historical_attempt to authenticated;

update public.module_assignments
set status = 'cancelled'
where user_id = '30000000-0000-4000-8000-000000000002'
  and module_id = '10000000-0000-4000-8000-000000000001';

do $$
begin
  perform public.manage_module(
    '10000000-0000-4000-8000-000000000001',
    false,
    'archived'
  );
end
$$;

select extensions.throws_ok(
  $$
    insert into public.module_assignments (user_id, module_id, status)
    values (
      '30000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'assigned'
    )
  $$,
  '23514',
  'Assignments can only be created for published modules',
  'an administrator cannot assign an archived module after the locked recheck'
);

select extensions.throws_ok(
  $$
    update public.module_assignments
    set status = 'assigned'
    where user_id = '30000000-0000-4000-8000-000000000002'
      and module_id = '10000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'Assignments can only be created for published modules',
  'a cancelled assignment cannot be reactivated after its module is archived'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000001',
  true
);

select extensions.is(
  public.quiz_attempt_result((select id from historical_attempt)) ->> 'module_title',
  'Hazard Perception & Unsafe Acts',
  'an owner can load a historical result after its module is archived'
);

select extensions.is(
  (
    public.quiz_attempt_result((select id from historical_attempt)) ? 'submitted_answers'
    or public.quiz_attempt_result((select id from historical_attempt)) ? 'feedback'
  ),
  false,
  'the historical result RPC omits submitted answers and detailed feedback'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-4000-8000-000000000002',
  true
);

select extensions.is(
  public.quiz_attempt_result((select id from historical_attempt)),
  null::jsonb,
  'an unrelated trainee cannot read another user historical result'
);

select * from extensions.finish();
rollback;
