-- Account lifecycle hardening. Apply after the existing approval migrations.
-- This migration never promotes a user automatically. The first administrator
-- is provisioned by the trusted bootstrap script documented in AUTH_SETUP.md.
begin;

alter table public.account_profiles
  drop constraint if exists account_profiles_approval_status_check;

alter table public.account_profiles
  add constraint account_profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));

create table if not exists public.account_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'approved', 'rejected', 'suspended', 'reactivated',
    'administrator_granted', 'administrator_revoked'
  )),
  created_at timestamptz not null default now()
);

create index if not exists account_admin_audit_target_idx
  on public.account_admin_audit_log (target_user_id, created_at desc);

alter table public.account_admin_audit_log enable row level security;
revoke all on public.account_admin_audit_log from public, anon, authenticated;
grant select on public.account_admin_audit_log to authenticated;

drop policy if exists account_admin_audit_read on public.account_admin_audit_log;
create policy account_admin_audit_read on public.account_admin_audit_log
for select to authenticated
using ((select public.is_account_admin()));

create or replace function public.record_account_admin_action(
  target_user_id uuid,
  action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.is_account_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id is null or action is null then
    raise exception 'Target and action are required' using errcode = '22023';
  end if;
  insert into public.account_admin_audit_log(actor_user_id, target_user_id, action)
  values (actor, target_user_id, action);
end;
$$;

revoke all on function public.record_account_admin_action(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_account_admin_action(uuid, text)
  to authenticated;

create or replace function public.set_account_status(
  target_user_id uuid,
  next_status text
)
returns public.account_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.account_profiles%rowtype;
  previous_status text;
begin
  if actor is null or not public.is_account_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id is null or next_status not in ('approved', 'rejected', 'suspended') then
    raise exception 'Invalid account status' using errcode = '22023';
  end if;
  if target_user_id = actor then
    raise exception 'Cannot change your own account status' using errcode = '42501';
  end if;

  select approval_status into previous_status
  from public.account_profiles
  where id = target_user_id
  for update;
  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;

  update public.account_profiles
  set approval_status = next_status,
      reviewed_at = now(),
      reviewed_by = actor,
      approved_at = case when next_status = 'approved' then now() else null end,
      approved_by = case when next_status = 'approved' then actor else null end
  where id = target_user_id
  returning * into result;

  insert into public.account_admin_audit_log(actor_user_id, target_user_id, action)
  values (
    actor,
    target_user_id,
    case
      when next_status = 'approved' and previous_status = 'suspended' then 'reactivated'
      when next_status = 'approved' then 'approved'
      when next_status = 'rejected' then 'rejected'
      else 'suspended'
    end
  );
  return result;
end;
$$;

revoke all on function public.set_account_status(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_account_status(uuid, text) to authenticated;

create or replace function public.set_account_administrator(
  target_user_id uuid,
  should_be_admin boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  admin_count integer;
begin
  if actor is null or not public.is_account_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = actor then
    raise exception 'Cannot change your own administrator role' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users u
    join public.account_profiles p on p.id = u.id
    where u.id = target_user_id
      and u.email_confirmed_at is not null
      and u.is_anonymous = false
      and p.approval_status = 'approved'
  ) then
    raise exception 'Administrator must be an approved account' using errcode = '22023';
  end if;

  if should_be_admin then
    insert into public.account_admins(user_id) values (target_user_id)
    on conflict (user_id) do nothing;
    insert into public.account_admin_audit_log(actor_user_id, target_user_id, action)
    values (actor, target_user_id, 'administrator_granted');
  else
    select count(*) into admin_count from public.account_admins;
    if admin_count <= 1 then
      raise exception 'Cannot remove the last administrator' using errcode = '42501';
    end if;
    delete from public.account_admins where user_id = target_user_id;
    insert into public.account_admin_audit_log(actor_user_id, target_user_id, action)
    values (actor, target_user_id, 'administrator_revoked');
  end if;
  return should_be_admin;
end;
$$;

revoke all on function public.set_account_administrator(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_account_administrator(uuid, boolean) to authenticated;

commit;
