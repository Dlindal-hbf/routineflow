-- Pre-production cleanup: retain business data only for the designated owner.
-- No Auth users or designated-owner rows are deleted.
begin;

do $$
declare
  owner_id uuid;
  table_name text;
begin
  select id into owner_id
  from auth.users
  where lower(email) = lower('dennis.lindal@live.no')
    and email_confirmed_at is not null
    and is_anonymous is false;

  if owner_id is null then
    raise exception 'Designated owner was not found or is not eligible';
  end if;

  foreach table_name in array array[
    'inventory_snapshots', 'inventory_items', 'task_lists', 'tasks',
    'task_history', 'customers', 'customer_interactions',
    'work_log_entries', 'activity_history_entries'
  ] loop
    execute format(
      'delete from public.%I b where b.user_id <> $1',
      table_name
    ) using owner_id;
  end loop;
end;
$$;

commit;
