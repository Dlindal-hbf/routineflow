begin;
alter table public.account_notification_outbox
  add column locked_until timestamptz,
  add column lease_token uuid;
create index account_notifications_unsent_idx
  on public.account_notification_outbox (created_at) where sent_at is null;

-- Only the server worker can claim mail. SKIP LOCKED prevents overlapping
-- invocations claiming the same request; crashed workers release after 2 minutes.
create function public.claim_account_notifications(batch_size integer default 5)
returns setof public.account_notification_outbox
language sql security definer
set search_path = ''
as $$
  with candidates as (
    select id from public.account_notification_outbox
    where sent_at is null and (locked_until is null or locked_until < now())
    order by created_at, id
    limit greatest(1, least(coalesce(batch_size, 5), 20))
    for update skip locked
  )
  update public.account_notification_outbox o
  set locked_until = now() + interval '2 minutes',
      lease_token = gen_random_uuid(), attempts = attempts + 1
  from candidates c where c.id = o.id returning o.*;
$$;
revoke all on function public.claim_account_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_account_notifications(integer) to service_role;
commit;
