-- LoccoBurger Gestao - Supabase schema v2
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text not null,
  type text not null,
  price numeric(12, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  current_stock numeric(14, 3) not null default 0,
  min_stock numeric(14, 3) not null default 0,
  average_cost numeric(14, 4) not null default 0,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technical_sheets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  prep_time integer not null default 0,
  yield_quantity numeric(14, 3) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id)
);

create table if not exists public.technical_sheet_items (
  id uuid primary key default gen_random_uuid(),
  technical_sheet_id uuid not null references public.technical_sheets(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  quantity numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  unique(technical_sheet_id, inventory_item_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  source text not null check (source in ('mesa', 'delivery')),
  table_number integer,
  customer_id uuid references public.customers(id),
  channel text,
  status text not null,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  address text,
  campaign text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(14, 3) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  tab_id text,
  tab_name text,
  notes text,
  manual_notes text,
  modifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  order_id uuid references public.orders(id) on delete set null,
  source text not null,
  item text not null,
  status text not null,
  priority text not null default 'normal',
  target_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finalized_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id),
  movement_type text not null check (movement_type in ('entrada', 'saida', 'ajuste', 'perda')),
  origin text not null,
  origin_id uuid,
  quantity numeric(14, 3) not null,
  unit_cost numeric(14, 4),
  total_cost numeric(12, 2),
  reason text,
  supplier text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  supplier text,
  status text not null default 'aberto',
  total numeric(12, 2) not null default 0,
  fiscal_key text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id),
  fiscal_name text,
  quantity numeric(14, 3) not null default 0,
  unit text,
  unit_cost numeric(14, 4) not null default 0,
  total numeric(12, 2) not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  table_number integer,
  tab_id text,
  tab_name text,
  method text not null,
  amount numeric(12, 2) not null,
  gross_amount numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  service_charge numeric(12, 2) not null default 0,
  received_amount numeric(12, 2) not null default 0,
  change_amount numeric(12, 2) not null default 0,
  customer_id uuid references public.customers(id),
  customer_name text,
  items jsonb not null default '[]'::jsonb,
  paid_at timestamptz not null default now()
);

create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid not null references public.customers(id),
  customer_name text not null,
  description text not null,
  amount numeric(12, 2) not null default 0,
  gross_amount numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  service_charge numeric(12, 2) not null default 0,
  status text not null default 'aberto' check (status in ('aberto', 'recebido', 'cancelado')),
  table_number integer,
  tab_id text,
  items jsonb not null default '[]'::jsonb,
  due_date date,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists public.customer_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid not null references public.customers(id),
  customer_name text not null,
  promotion_id text not null,
  promotion_label text not null,
  type text not null,
  value numeric(12, 2) not null default 0,
  channel text not null default 'WhatsApp',
  status text not null default 'enviada',
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null,
  amount numeric(12, 2) not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_orders_source_status on public.orders(source, status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_kitchen_tickets_status on public.kitchen_tickets(status);
create index if not exists idx_stock_movements_item on public.stock_movements(inventory_item_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);
create index if not exists idx_expenses_status on public.expenses(status);
create index if not exists idx_accounts_receivable_customer on public.accounts_receivable(customer_id);
create index if not exists idx_accounts_receivable_status on public.accounts_receivable(status);
create index if not exists idx_customer_campaigns_customer on public.customer_campaigns(customer_id);

alter table if exists public.order_items add column if not exists tab_id text;
alter table if exists public.order_items add column if not exists tab_name text;
alter table if exists public.order_items add column if not exists notes text;
alter table if exists public.order_items add column if not exists manual_notes text;
alter table if exists public.order_items add column if not exists modifiers jsonb not null default '{}'::jsonb;

alter table if exists public.stock_movements add column if not exists total_cost numeric(12, 2);
alter table if exists public.stock_movements add column if not exists reason text;
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'stock_movements'
      and constraint_name = 'stock_movements_movement_type_check'
  ) then
    alter table public.stock_movements drop constraint stock_movements_movement_type_check;
  end if;
end $$;
alter table if exists public.stock_movements
  add constraint stock_movements_movement_type_check
  check (movement_type in ('entrada', 'saida', 'ajuste', 'perda'));

alter table if exists public.payments add column if not exists tab_id text;
alter table if exists public.payments add column if not exists tab_name text;
alter table if exists public.payments add column if not exists gross_amount numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists net_amount numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists discount numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists service_charge numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists received_amount numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists change_amount numeric(12, 2) not null default 0;
alter table if exists public.payments add column if not exists customer_id uuid references public.customers(id);
alter table if exists public.payments add column if not exists customer_name text;
alter table if exists public.payments add column if not exists items jsonb not null default '[]'::jsonb;

drop trigger if exists products_set_updated_at on public.products;
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
drop trigger if exists technical_sheets_set_updated_at on public.technical_sheets;
drop trigger if exists customers_set_updated_at on public.customers;

create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger inventory_items_set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();
create trigger technical_sheets_set_updated_at before update on public.technical_sheets
  for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
