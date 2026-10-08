-- Remove only business rows whose Auth identity was already deleted.
-- This is a one-time cleanup for pre-production test data. Existing users and
-- their data are preserved because every delete is guarded by auth.users.
begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_snapshots', 'inventory_items', 'task_lists', 'tasks',
    'task_history', 'customers', 'customer_interactions',
    'work_log_entries', 'activity_history_entries'
  ] loop
    execute format(
      'delete from public.%I b where not exists (select 1 from auth.users u where u.id = b.user_id)',
      table_name
    );
  end loop;
end;
$$;

commit;
