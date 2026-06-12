create table if not exists public.user_restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id numeric not null,
  guests numeric not null default 0,
  status text not null default 'livre',
  attendant text,
  total numeric(12,2) not null default 0,
  order_items jsonb not null default '[]'::jsonb,
  tabs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  source text not null,
  item text not null,
  modifiers jsonb,
  notes text,
  status text not null default 'em preparo',
  priority text not null default 'normal',
  created_at_ms numeric not null default 0,
  started_at_ms numeric,
  finalized_at_ms numeric,
  completed_at_ms numeric,
  delivered_at_ms numeric,
  target_minutes numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create index if not exists idx_user_restaurant_tables_user_id on public.user_restaurant_tables(user_id);
create index if not exists idx_user_restaurant_tables_status on public.user_restaurant_tables(status);
create index if not exists idx_user_kitchen_tickets_user_id on public.user_kitchen_tickets(user_id);
create index if not exists idx_user_kitchen_tickets_status on public.user_kitchen_tickets(status);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_restaurant_tables_updated_at on public.user_restaurant_tables;
create trigger set_user_restaurant_tables_updated_at
before update on public.user_restaurant_tables
for each row execute function public.set_updated_at();

drop trigger if exists set_user_kitchen_tickets_updated_at on public.user_kitchen_tickets;
create trigger set_user_kitchen_tickets_updated_at
before update on public.user_kitchen_tickets
for each row execute function public.set_updated_at();

alter table public.user_restaurant_tables enable row level security;
alter table public.user_kitchen_tickets enable row level security;

drop policy if exists "Users can select own restaurant tables" on public.user_restaurant_tables;
create policy "Users can select own restaurant tables"
on public.user_restaurant_tables
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own restaurant tables" on public.user_restaurant_tables;
create policy "Users can insert own restaurant tables"
on public.user_restaurant_tables
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own restaurant tables" on public.user_restaurant_tables;
create policy "Users can update own restaurant tables"
on public.user_restaurant_tables
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own restaurant tables" on public.user_restaurant_tables;
create policy "Users can delete own restaurant tables"
on public.user_restaurant_tables
for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own kitchen tickets" on public.user_kitchen_tickets;
create policy "Users can select own kitchen tickets"
on public.user_kitchen_tickets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own kitchen tickets" on public.user_kitchen_tickets;
create policy "Users can insert own kitchen tickets"
on public.user_kitchen_tickets
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own kitchen tickets" on public.user_kitchen_tickets;
create policy "Users can update own kitchen tickets"
on public.user_kitchen_tickets
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own kitchen tickets" on public.user_kitchen_tickets;
create policy "Users can delete own kitchen tickets"
on public.user_kitchen_tickets
for delete to authenticated
using (auth.uid() = user_id);
