-- Apply only after identity preparation and reviewed legacy-account upgrades.
-- Abort rather than silently lock existing data owners out. Do not bypass this
-- preflight by deleting their data or automatically approving unknown accounts.
begin;
do $$
declare
  table_name text;
  blocked boolean;
begin
  foreach table_name in array array[
    'inventory_snapshots', 'inventory_items', 'task_lists', 'tasks',
    'task_history', 'customers', 'customer_interactions',
    'work_log_entries', 'activity_history_entries'
  ] loop
    execute format(
      'select exists (select 1 from public.%I b left join auth.users u on u.id=b.user_id left join public.account_profiles p on p.id=b.user_id where u.email_confirmed_at is null or u.is_anonymous is distinct from false or p.approval_status is distinct from ''approved'')',
      table_name
    ) into blocked;
    if blocked then
      raise exception 'Approval rollout stopped: % has an existing owner without verified, approved access. Review and upgrade the original identity before applying this migration.', table_name;
    end if;
  end loop;
  foreach table_name in array array[
    'inventory_snapshots', 'inventory_items', 'task_lists', 'tasks',
    'task_history', 'customers', 'customer_interactions',
    'work_log_entries', 'activity_history_entries'
  ] loop
    execute format('drop policy if exists application_approval_required on public.%I', table_name);
    execute format(
      'create policy application_approval_required on public.%I as restrictive for all to public using ((select public.has_application_access())) with check ((select public.has_application_access()))',
      table_name
    );
  end loop;
end;
$$;
commit;
