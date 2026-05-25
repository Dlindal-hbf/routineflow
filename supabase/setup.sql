create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  inventory_type text not null check (inventory_type in ('bunner', 'ost')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_snapshots_user_app_id_idx
  on public.inventory_snapshots (user_id, app_id);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid references public.inventory_snapshots(id) on delete cascade,
  inventory_type text not null check (inventory_type in ('bunner', 'ost')),
  day_name text not null,
  category text,
  metric text not null,
  value text not null default '',
  signature text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  title text not null,
  description text,
  color text,
  metadata jsonb not null default '{}'::jsonb,
  reset_enabled boolean not null default false,
  frequency text not null default 'none' check (frequency in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  reset_time text not null default '06:00',
  reset_day_of_week integer check (reset_day_of_week between 1 and 7),
  reset_day_of_month integer check (reset_day_of_month between 1 and 31),
  timezone text not null default 'Europe/Oslo',
  current_period_start_at timestamptz,
  current_period_end_at timestamptz,
  last_archived_at timestamptz,
  next_reset_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists task_lists_user_app_id_idx
  on public.task_lists (user_id, app_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  task_list_id uuid not null references public.task_lists(id) on delete cascade,
  task_list_app_id text not null,
  title text not null,
  description text,
  frequency text,
  completed boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tasks_user_app_id_idx
  on public.tasks (user_id, app_id);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_list_app_id text not null,
  task_app_id text not null,
  task_title_snapshot text not null,
  period_start_at timestamptz not null,
  period_end_at timestamptz not null,
  period_start_date_key text,
  period_end_date_key text,
  archived_at timestamptz not null,
  status text not null check (status in ('complete', 'incomplete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  customer_reference text,
  latest_notes text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  case_number text not null,
  created_by text not null,
  assigned_to text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_reference text,
  issue_category text not null,
  issue_description text not null,
  related_product_name text,
  related_order_number text,
  internal_notes text,
  compensation_type text not null,
  compensation_value numeric,
  currency text not null default 'NOK',
  replacement_item_name text,
  gift_card_reference text,
  decision_note text,
  fulfillment_mode text not null check (fulfillment_mode in ('immediate', 'later_claim')),
  status text not null check (status in ('pending', 'approved', 'ready_for_claim', 'completed', 'cancelled', 'expired')),
  ready_for_claim_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  expiry_date timestamptz,
  fulfilled_by text,
  claim_note text,
  archived_at timestamptz,
  cancelled_at timestamptz,
  archive_reason text,
  activity_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_interactions_case_number_idx
  on public.customer_interactions (user_id, case_number);

create table if not exists public.work_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  entry_type text not null,
  title text not null,
  entry_date timestamptz not null,
  author text not null,
  details text not null default '',
  pills jsonb not null default '[]'::jsonb,
  compensation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists work_log_entries_user_app_id_idx
  on public.work_log_entries (user_id, app_id);

create table if not exists public.activity_history_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_timestamp timestamptz not null,
  day_key text not null,
  description text not null,
  category text not null,
  routine text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_inventory_snapshots_updated_at on public.inventory_snapshots;
create trigger set_inventory_snapshots_updated_at
before update on public.inventory_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists set_task_lists_updated_at on public.task_lists;
create trigger set_task_lists_updated_at
before update on public.task_lists
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_task_history_updated_at on public.task_history;
create trigger set_task_history_updated_at
before update on public.task_history
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_customer_interactions_updated_at on public.customer_interactions;
create trigger set_customer_interactions_updated_at
before update on public.customer_interactions
for each row execute function public.set_updated_at();

drop trigger if exists set_work_log_entries_updated_at on public.work_log_entries;
create trigger set_work_log_entries_updated_at
before update on public.work_log_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_activity_history_entries_updated_at on public.activity_history_entries;
create trigger set_activity_history_entries_updated_at
before update on public.activity_history_entries
for each row execute function public.set_updated_at();

alter table public.inventory_snapshots enable row level security;
alter table public.inventory_items enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
alter table public.customers enable row level security;
alter table public.customer_interactions enable row level security;
alter table public.work_log_entries enable row level security;
alter table public.activity_history_entries enable row level security;

drop policy if exists "Users can view own inventory snapshots" on public.inventory_snapshots;
create policy "Users can view own inventory snapshots"
on public.inventory_snapshots
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own inventory snapshots" on public.inventory_snapshots;
create policy "Users can insert own inventory snapshots"
on public.inventory_snapshots
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own inventory snapshots" on public.inventory_snapshots;
create policy "Users can update own inventory snapshots"
on public.inventory_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inventory snapshots" on public.inventory_snapshots;
create policy "Users can delete own inventory snapshots"
on public.inventory_snapshots
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own inventory" on public.inventory_items;
create policy "Users can view own inventory"
on public.inventory_items
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own inventory" on public.inventory_items;
create policy "Users can insert own inventory"
on public.inventory_items
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own inventory" on public.inventory_items;
create policy "Users can update own inventory"
on public.inventory_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inventory" on public.inventory_items;
create policy "Users can delete own inventory"
on public.inventory_items
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own task lists" on public.task_lists;
create policy "Users can view own task lists"
on public.task_lists
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own task lists" on public.task_lists;
create policy "Users can insert own task lists"
on public.task_lists
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own task lists" on public.task_lists;
create policy "Users can update own task lists"
on public.task_lists
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own task lists" on public.task_lists;
create policy "Users can delete own task lists"
on public.task_lists
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own tasks" on public.tasks;
create policy "Users can view own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can delete own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own task history" on public.task_history;
create policy "Users can view own task history"
on public.task_history
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own task history" on public.task_history;
create policy "Users can insert own task history"
on public.task_history
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own task history" on public.task_history;
create policy "Users can update own task history"
on public.task_history
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own task history" on public.task_history;
create policy "Users can delete own task history"
on public.task_history
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own customers" on public.customers;
create policy "Users can view own customers"
on public.customers
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own customers" on public.customers;
create policy "Users can insert own customers"
on public.customers
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers"
on public.customers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own customers" on public.customers;
create policy "Users can delete own customers"
on public.customers
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own customer interactions" on public.customer_interactions;
create policy "Users can view own customer interactions"
on public.customer_interactions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own customer interactions" on public.customer_interactions;
create policy "Users can insert own customer interactions"
on public.customer_interactions
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own customer interactions" on public.customer_interactions;
create policy "Users can update own customer interactions"
on public.customer_interactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own customer interactions" on public.customer_interactions;
create policy "Users can delete own customer interactions"
on public.customer_interactions
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own work log entries" on public.work_log_entries;
create policy "Users can view own work log entries"
on public.work_log_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own work log entries" on public.work_log_entries;
create policy "Users can insert own work log entries"
on public.work_log_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own work log entries" on public.work_log_entries;
create policy "Users can update own work log entries"
on public.work_log_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own work log entries" on public.work_log_entries;
create policy "Users can delete own work log entries"
on public.work_log_entries
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view own activity history entries" on public.activity_history_entries;
create policy "Users can view own activity history entries"
on public.activity_history_entries
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own activity history entries" on public.activity_history_entries;
create policy "Users can insert own activity history entries"
on public.activity_history_entries
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own activity history entries" on public.activity_history_entries;
create policy "Users can update own activity history entries"
on public.activity_history_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own activity history entries" on public.activity_history_entries;
create policy "Users can delete own activity history entries"
on public.activity_history_entries
for delete
using (auth.uid() = user_id);




