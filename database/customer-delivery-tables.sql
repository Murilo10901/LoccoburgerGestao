-- LoccoBurger Gestao - tabelas proprias de Clientes, Campanhas e Delivery
-- Execute no SQL Editor do Supabase.

create table if not exists public.user_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id bigint not null,
  name text not null,
  phone text not null,
  address text not null,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_customer_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id bigint not null,
  code text not null,
  customer_app_id bigint not null,
  customer_name text not null,
  promotion_id text,
  promotion_label text,
  type text,
  value numeric(12, 2) not null default 0,
  channel text,
  status text not null default 'enviada',
  message text,
  created_at_label text,
  created_at_iso date,
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_delivery_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  customer_app_id bigint not null,
  customer_name text not null,
  channel text not null,
  status text not null,
  total numeric(12, 2) not null default 0,
  eta text,
  address text,
  campaign text,
  discount numeric(12, 2) not null default 0,
  created_at_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_delivery_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_app_id text not null,
  line_index integer not null default 0,
  product_app_id bigint not null,
  product_name text not null,
  quantity numeric(14, 4) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  manual_notes text,
  modifiers jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, order_app_id, line_index)
);

create index if not exists idx_user_customers_user_id on public.user_customers(user_id);
create index if not exists idx_user_customer_campaigns_user_id on public.user_customer_campaigns(user_id);
create index if not exists idx_user_delivery_orders_user_id on public.user_delivery_orders(user_id);
create index if not exists idx_user_delivery_order_items_user_id on public.user_delivery_order_items(user_id);

drop trigger if exists set_user_customers_updated_at on public.user_customers;
create trigger set_user_customers_updated_at
before update on public.user_customers
for each row execute function public.set_updated_at();

drop trigger if exists set_user_customer_campaigns_updated_at on public.user_customer_campaigns;
create trigger set_user_customer_campaigns_updated_at
before update on public.user_customer_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists set_user_delivery_orders_updated_at on public.user_delivery_orders;
create trigger set_user_delivery_orders_updated_at
before update on public.user_delivery_orders
for each row execute function public.set_updated_at();

alter table public.user_customers enable row level security;
alter table public.user_customer_campaigns enable row level security;
alter table public.user_delivery_orders enable row level security;
alter table public.user_delivery_order_items enable row level security;

drop policy if exists user_customers_own_all on public.user_customers;
create policy user_customers_own_all on public.user_customers
for all to authenticated using(auth.uid() = user_id) with check(auth.uid() = user_id);

drop policy if exists user_customer_campaigns_own_all on public.user_customer_campaigns;
create policy user_customer_campaigns_own_all on public.user_customer_campaigns
for all to authenticated using(auth.uid() = user_id) with check(auth.uid() = user_id);

drop policy if exists user_delivery_orders_own_all on public.user_delivery_orders;
create policy user_delivery_orders_own_all on public.user_delivery_orders
for all to authenticated using(auth.uid() = user_id) with check(auth.uid() = user_id);

drop policy if exists user_delivery_order_items_own_all on public.user_delivery_order_items;
create policy user_delivery_order_items_own_all on public.user_delivery_order_items
for all to authenticated using(auth.uid() = user_id) with check(auth.uid() = user_id);

notify pgrst, 'reload schema';
