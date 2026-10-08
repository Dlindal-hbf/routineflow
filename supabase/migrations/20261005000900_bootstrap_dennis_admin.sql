-- One-time pre-production bootstrap for the explicitly designated owner.
-- The exact verified Auth identity is selected by email and never created here.
begin;

do $$
declare
  account_id uuid;
  account_email text;
  account_confirmed timestamptz;
  anonymous boolean;
begin
  select id, email, email_confirmed_at, is_anonymous
    into account_id, account_email, account_confirmed, anonymous
  from auth.users
  where lower(email) = lower('dennis.lindal@live.no');

  if account_id is null then
    raise exception 'Bootstrap account dennis.lindal@live.no was not found';
  end if;
  if account_confirmed is null or anonymous is distinct from false then
    raise exception 'Bootstrap account must be confirmed and non-anonymous';
  end if;

  update public.account_profiles
  set approval_status = 'approved',
      email_verified_at = account_confirmed,
      approved_at = coalesce(approved_at, now())
  where id = account_id;

  if not found then
    raise exception 'Bootstrap account profile was not found';
  end if;

  insert into public.account_admins(user_id)
  values (account_id)
  on conflict (user_id) do nothing;
end;
$$;

commit;
