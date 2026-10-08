-- Run explicitly against a DISPOSABLE LOCAL Supabase database after baseline +
-- migration, as postgres: psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f <this file>
-- Kept in a subdirectory so this is not a deployable versioned migration.
-- All fixtures and test helpers are rolled back. Never run against production.
begin;

create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', message; end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'FAIL: expected SQLSTATE % for %', expected_state, statement;
end;
$$;

insert into auth.users (id, email, email_confirmed_at, is_anonymous, raw_user_meta_data)
values
 ('00000000-0000-4000-8000-000000000001', 'admin@approval.test', now(), false, '{}'),
 ('00000000-0000-4000-8000-000000000002', 'member@approval.test', now(), false,
  '{"full_name":"Member","approval_status":"approved","role":"admin"}'),
 ('00000000-0000-4000-8000-000000000003', 'unverified@approval.test', null, false, '{}'),
 ('00000000-0000-4000-8000-000000000004', null, null, true, '{}');

select pg_temp.assert_true((select count(*) = 4 from public.account_profiles
 where id::text like '00000000-0000-4000-8000-00000000000%' and approval_status = 'pending'),
 'new accounts pending, metadata cannot approve');
select pg_temp.assert_true((select count(*) = 3 from public.account_notification_outbox
 where user_id::text like '00000000-0000-4000-8000-00000000000%'), 'only durable accounts queued');

-- Trusted first-admin bootstrap and preexisting business data.
update public.account_profiles set approval_status = 'approved', approved_at = now()
where id = '00000000-0000-4000-8000-000000000001';
insert into public.account_admins values ('00000000-0000-4000-8000-000000000001');
insert into public.task_lists (user_id, app_id, title) values
 ('00000000-0000-4000-8000-000000000001', 'approval-test-admin', 'Admin'),
 ('00000000-0000-4000-8000-000000000002', 'approval-test-member', 'Member');

select pg_temp.assert_true((select count(*) = 9 from pg_policies
 where schemaname = 'public' and policyname = 'application_approval_required'
 and permissive = 'RESTRICTIVE' and cmd = 'ALL' and roles = array['public']::name[]
 and qual is not null and with_check is not null), 'nine restrictive ALL public gates');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(not public.has_application_access(), 'pending denied');
select pg_temp.assert_true(not public.is_account_admin(), 'metadata cannot grant admin');
select pg_temp.assert_true((select count(*) = 1 from public.account_profiles), 'own profile only');
select pg_temp.assert_true((select count(*) = 0 from public.task_lists), 'pending data hidden');
select pg_temp.expect_error($q$insert into public.task_lists (user_id,app_id,title)
 values ('00000000-0000-4000-8000-000000000002','blocked','Blocked')$q$, '42501');
select pg_temp.expect_error($q$update public.account_profiles set approval_status='approved'$q$, '42501');
select pg_temp.expect_error($q$insert into public.account_admins values (auth.uid())$q$, '42501');
select pg_temp.expect_error('select * from public.account_notification_outbox', '42501');
select pg_temp.expect_error('select public.claim_account_notifications(5)', '42501');
select pg_temp.expect_error($q$select public.review_account_request(auth.uid(),'approved')$q$, '42501');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(public.is_account_admin(), 'bootstrapped admin');
select pg_temp.assert_true((select count(*) = 4 from public.account_profiles
 where id::text like '00000000-0000-4000-8000-00000000000%'), 'admin sees requests');
select pg_temp.assert_true((select count(*) = 1 from public.task_lists), 'admin still owner isolated');
select pg_temp.expect_error($q$select public.review_account_request(auth.uid(),'rejected')$q$, '42501');
select pg_temp.expect_error($q$select public.review_account_request('00000000-0000-4000-8000-000000000002','pending')$q$, '22023');
select pg_temp.expect_error($q$select public.review_account_request('00000000-0000-4000-8000-000000000003','approved')$q$, '22023');
select pg_temp.expect_error($q$select public.review_account_request('00000000-0000-4000-8000-000000000004','approved')$q$, '22023');
select public.review_account_request('00000000-0000-4000-8000-000000000002', 'approved');
select pg_temp.assert_true((select approved_by = auth.uid() and reviewed_by = auth.uid()
 and approved_at is not null and reviewed_at is not null from public.account_profiles
 where id = '00000000-0000-4000-8000-000000000002'), 'review audit populated');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(public.has_application_access(), 'approved access');
select pg_temp.assert_true((select count(*) = 1 from public.task_lists), 'approved owner isolation');
insert into public.task_lists (user_id, app_id, title) values (auth.uid(), 'allowed', 'Allowed');
update public.task_lists set title = 'Updated' where app_id = 'allowed';
delete from public.task_lists where app_id = 'allowed';
select pg_temp.expect_error($q$insert into public.task_lists (user_id,app_id,title)
 values ('00000000-0000-4000-8000-000000000001','foreign','Foreign')$q$, '42501');

reset role;
update auth.users set email_confirmed_at = null,
 raw_user_meta_data = '{"full_name":"Changed","approval_status":"rejected","role":"admin"}'
where id = '00000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select full_name = 'Changed' and approval_status = 'approved'
 and email_verified_at is null from public.account_profiles
 where id = '00000000-0000-4000-8000-000000000002'), 'sync ignores status and mirrors verification');
set local role authenticated;
select pg_temp.assert_true(not public.has_application_access(), 'verification removal blocks immediately');
reset role;
update auth.users set email = 'upgraded@approval.test', is_anonymous = false,
 email_confirmed_at = now() where id = '00000000-0000-4000-8000-000000000004';
update auth.users set raw_user_meta_data = '{}' where id = '00000000-0000-4000-8000-000000000004';
select pg_temp.assert_true((select count(*) = 4 from public.account_notification_outbox
 where user_id::text like '00000000-0000-4000-8000-00000000000%'), 'upgrade queues once');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.review_account_request('00000000-0000-4000-8000-000000000002', 'rejected');
select pg_temp.assert_true((select approval_status = 'rejected' and approved_at is null
 and approved_by is null and reviewed_by = auth.uid() from public.account_profiles
 where id = '00000000-0000-4000-8000-000000000002'), 'rejection audit');
reset role;
update auth.users set email_confirmed_at = now()
where id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(not public.has_application_access(), 'verified rejected account denied');
select pg_temp.assert_true((select count(*) = 0 from public.task_lists), 'rejected data hidden');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.review_account_request('00000000-0000-4000-8000-000000000002', 'approved');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(public.has_application_access(), 'reconsidered account regains access');
select pg_temp.assert_true((select count(*) = 1 from public.task_lists), 'reconsidered data preserved');
reset role;
update public.account_profiles set approval_status = 'rejected'
where id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true(not public.is_account_admin(), 'rejected admin loses authority');
select pg_temp.expect_error($q$select public.review_account_request('00000000-0000-4000-8000-000000000004','approved')$q$, '42501');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(not public.has_application_access(), 'unauthenticated denied');
select pg_temp.expect_error('select * from public.account_profiles', '42501');
select pg_temp.expect_error($q$select public.review_account_request('00000000-0000-4000-8000-000000000002','approved')$q$, '42501');
reset role;
set local role service_role;
update public.account_notification_outbox set attempts = attempts + 1, sent_at = now()
where user_id = '00000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select attempts = 1 and sent_at is not null
 from public.account_notification_outbox where user_id = '00000000-0000-4000-8000-000000000002'),
 'service worker can record delivery');
select pg_temp.assert_true((select count(*) = 2 from public.claim_account_notifications(2)), 'worker claims bounded batch');
select pg_temp.assert_true((select count(*) = 1 from public.claim_account_notifications(2)), 'active leases exclude earlier batch');
select pg_temp.assert_true((select count(*) = 0 from public.claim_account_notifications(2)), 'sent and leased notifications excluded');
update public.account_notification_outbox set locked_until = now() - interval '1 second'
where sent_at is null;
select pg_temp.assert_true((select count(*) = 3 from public.claim_account_notifications(20)), 'expired leases retry');
reset role;
rollback;
