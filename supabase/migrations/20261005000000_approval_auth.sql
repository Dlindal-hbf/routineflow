-- Apply AFTER supabase/setup.sql as the trusted database owner (postgres).
-- PREPARATION ONLY: every existing account starts pending; existing business rows
-- and user IDs are preserved. Business policies are unchanged in this stage.
-- Before public rollout, apply 20261005001000_enforce_approval.sql after all
-- existing data owners have been upgraded and approved. Upgrade anonymous
-- identities in place to retain ownership; creating a new identity does not
-- transfer data. Never interpret an empty RLS-filtered result as data deletion.
-- Bootstrap the FIRST admin manually in a trusted SQL session: verify the target
-- auth.users row has email_confirmed_at and is_anonymous = false, then set its
-- profile approval_status='approved', approved_at/reviewed_at=now() and insert
-- its id into account_admins(user_id). Bootstrap actor fields may remain NULL.
-- No automatic approvals or metadata-based roles. Subsequent reviews use RPC.
-- Provision a service_role worker separately for the outbox: it must retry,
-- record attempts/errors/sent_at and use user_id as the delivery idempotency key.
-- Backfill queues existing nonanonymous accounts too (potential notification
-- burst). Retain sent rows to preserve deduplication. Delivery is not implemented
-- here. service_role/database owners are trusted and bypass RLS; never expose keys.
-- RPC contract: decision is exactly 'approved' or 'rejected'; returns the updated
-- profile. reviewed_* describes the latest decision; approved_* is cleared on
-- rejection. This is latest-review audit, not an append-only review history.
-- Tests: migrations/tests/approval_auth.sql (explicit local execution only).

begin;

create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  email_verified_at timestamptz
);

create table public.account_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.account_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text
);

alter table public.account_profiles enable row level security;
alter table public.account_admins enable row level security;
alter table public.account_notification_outbox enable row level security;
revoke all on public.account_profiles, public.account_admins,
  public.account_notification_outbox from public, anon, authenticated;
grant select on public.account_profiles to authenticated;
grant all on public.account_profiles, public.account_admins,
  public.account_notification_outbox to service_role;

create function public.has_application_access()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join public.account_profiles p on p.id = u.id
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and u.is_anonymous = false
      and p.approval_status = 'approved'
  );
$$;

create function public.is_account_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_application_access() and exists (
    select 1 from public.account_admins a where a.user_id = auth.uid()
  );
$$;

-- anon needs the access predicate for TO public business policies to deny rows
-- cleanly. Neither predicate accepts an arbitrary identity to probe.
revoke all on function public.has_application_access() from public, anon, authenticated;
revoke all on function public.is_account_admin() from public, anon, authenticated;
grant execute on function public.has_application_access() to anon, authenticated, service_role;
grant execute on function public.is_account_admin() to authenticated, service_role;

create policy account_profiles_read on public.account_profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_account_admin()));

create function public.sync_account_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.account_profiles (id, full_name, email, email_verified_at)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, new.email_confirmed_at)
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    email_verified_at = excluded.email_verified_at;

  -- Also handles an anonymous identity being upgraded in place. Metadata never
  -- controls approval or administrator membership. One request per identity.
  if new.is_anonymous = false then
    insert into public.account_notification_outbox (user_id)
    values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_account_profile() from public, anon, authenticated, service_role;

create trigger sync_account_profile_after_auth_change
after insert or update of email, email_confirmed_at, raw_user_meta_data, is_anonymous
on auth.users for each row execute function public.sync_account_profile();

insert into public.account_profiles (id, full_name, email, created_at, email_verified_at)
select id, raw_user_meta_data ->> 'full_name', email, coalesce(created_at, now()), email_confirmed_at
from auth.users
on conflict (id) do nothing;

insert into public.account_notification_outbox (user_id)
select id from auth.users where is_anonymous = false
on conflict (user_id) do nothing;

create function public.review_account_request(target_user_id uuid, decision text)
returns public.account_profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  target_user auth.users%rowtype;
  result public.account_profiles%rowtype;
  actor uuid := auth.uid();
begin
  if not public.is_account_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id = actor then
    raise exception 'Cannot review your own account' using errcode = '42501';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  -- Match the auth-trigger lock order and serialize concurrent target reviews
  -- with changes to verification/anonymous state.
  select * into target_user from auth.users where id = target_user_id for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if decision = 'approved' and
     (target_user.email_confirmed_at is null or target_user.is_anonymous is distinct from false) then
    raise exception 'Approval requires a verified nonanonymous account' using errcode = '22023';
  end if;
  update public.account_profiles set
    approval_status = decision,
    reviewed_at = now(), reviewed_by = actor,
    approved_at = case when decision = 'approved' then now() else null end,
    approved_by = case when decision = 'approved' then actor else null end
  where id = target_user_id returning * into result;
  if not found then
    raise exception 'Account profile not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;
revoke all on function public.review_account_request(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.review_account_request(uuid, text) to authenticated;

commit;
