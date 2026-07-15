-- LoccoBurger Gestao - SQL completo de producao
-- Execute este arquivo no Supabase SQL Editor.
-- Ele cria tabelas, indices, triggers, loja compartilhada, perfis e politicas RLS.


-- ============================================================
-- user-app-state.sql
-- ============================================================

-- LoccoBurger Gestao - estado do app por usuario
-- Execute este arquivo no SQL Editor do Supabase antes de testar login e persistencia.

create extension if not exists pgcrypto;

create table if not exists public.user_app_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_user_app_state_user_id
on public.user_app_state(user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_app_state_updated_at on public.user_app_state;

create trigger set_user_app_state_updated_at
before update on public.user_app_state
for each row
execute function public.set_updated_at();

alter table public.user_app_state enable row level security;

drop policy if exists "Users can select own app state" on public.user_app_state;
create policy "Users can select own app state"
on public.user_app_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own app state" on public.user_app_state;
create policy "Users can insert own app state"
on public.user_app_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own app state" on public.user_app_state;
create policy "Users can update own app state"
on public.user_app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own app state" on public.user_app_state;
create policy "Users can delete own app state"
on public.user_app_state
for delete
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- user-profiles.sql
-- ============================================================

-- LoccoBurger Gestao - perfis de acesso por usuario
-- Execute no SQL Editor do Supabase depois do script user-app-state.sql.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'atendimento' check (role in ('admin', 'atendimento', 'cozinha', 'garcom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_role
on public.user_profiles(role);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "Users can select own profile" on public.user_profiles;
create policy "Users can select own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile basics" on public.user_profiles;

-- ============================================================
-- user-profile-admin-functions.sql
-- ============================================================

-- LoccoBurger Gestao - funcoes administrativas de usuarios
-- Execute no SQL Editor do Supabase depois de user-profiles.sql.

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.admin_list_user_profiles()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Apenas administradores podem listar usuarios.';
  end if;

  return query
  select
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  order by profiles.created_at desc;
end;
$$;

create or replace function public.admin_update_user_role(target_user_id uuid, new_role text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Apenas administradores podem alterar perfis.';
  end if;

  if new_role not in ('admin', 'atendimento', 'cozinha', 'garcom') then
    raise exception 'Perfil invalido.';
  end if;

  return query
  update public.user_profiles profiles
  set role = new_role,
      updated_at = now()
  where profiles.user_id = target_user_id
  returning
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.created_at,
    profiles.updated_at;
end;
$$;

grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.admin_list_user_profiles() to authenticated;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

-- ============================================================
-- catalog-tables.sql
-- ============================================================

-- LoccoBurger Gestao - tabelas proprias de Produtos, Estoque e Ficha Tecnica
-- Execute no SQL Editor do Supabase.

create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id bigint not null,
  sku text not null,
  name text not null,
  category text not null,
  type text not null,
  description text not null default '',
  price numeric(12, 2) not null default 0,
  active boolean not null default true,
  recipe_app_id bigint,
  image_url text,
  available_delivery boolean not null default true,
  available_qr boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

alter table public.user_products add column if not exists description text not null default '';
alter table public.user_products add column if not exists image_url text;
alter table public.user_products add column if not exists available_delivery boolean not null default true;
alter table public.user_products add column if not exists available_qr boolean not null default true;

create table if not exists public.user_inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id bigint not null,
  name text not null,
  category text not null,
  unit text not null,
  current_stock numeric(14, 4) not null default 0,
  min_stock numeric(14, 4) not null default 0,
  average_cost numeric(14, 4) not null default 0,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_technical_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id bigint not null,
  product_app_id bigint not null,
  prep_time integer not null default 0,
  yield_quantity numeric(14, 4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_technical_sheet_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sheet_app_id bigint not null,
  inventory_app_id bigint not null,
  quantity numeric(14, 4) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, sheet_app_id, inventory_app_id)
);

create index if not exists idx_user_products_user_id on public.user_products(user_id);
create index if not exists idx_user_inventory_items_user_id on public.user_inventory_items(user_id);
create index if not exists idx_user_technical_sheets_user_id on public.user_technical_sheets(user_id);
create index if not exists idx_user_technical_sheet_ingredients_user_id on public.user_technical_sheet_ingredients(user_id);

drop trigger if exists set_user_products_updated_at on public.user_products;
create trigger set_user_products_updated_at
before update on public.user_products
for each row execute function public.set_updated_at();

drop trigger if exists set_user_inventory_items_updated_at on public.user_inventory_items;
create trigger set_user_inventory_items_updated_at
before update on public.user_inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists set_user_technical_sheets_updated_at on public.user_technical_sheets;
create trigger set_user_technical_sheets_updated_at
before update on public.user_technical_sheets
for each row execute function public.set_updated_at();

alter table public.user_products enable row level security;
alter table public.user_inventory_items enable row level security;
alter table public.user_technical_sheets enable row level security;
alter table public.user_technical_sheet_ingredients enable row level security;

drop policy if exists user_products_own_select on public.user_products;
create policy user_products_own_select on public.user_products
for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_products_own_insert on public.user_products;
create policy user_products_own_insert on public.user_products
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_products_own_update on public.user_products;
create policy user_products_own_update on public.user_products
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_products_own_delete on public.user_products;
create policy user_products_own_delete on public.user_products
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists user_inventory_own_select on public.user_inventory_items;
create policy user_inventory_own_select on public.user_inventory_items
for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_inventory_own_insert on public.user_inventory_items;
create policy user_inventory_own_insert on public.user_inventory_items
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_inventory_own_update on public.user_inventory_items;
create policy user_inventory_own_update on public.user_inventory_items
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_inventory_own_delete on public.user_inventory_items;
create policy user_inventory_own_delete on public.user_inventory_items
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists user_sheets_own_select on public.user_technical_sheets;
create policy user_sheets_own_select on public.user_technical_sheets
for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_sheets_own_insert on public.user_technical_sheets;
create policy user_sheets_own_insert on public.user_technical_sheets
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_sheets_own_update on public.user_technical_sheets;
create policy user_sheets_own_update on public.user_technical_sheets
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_sheets_own_delete on public.user_technical_sheets;
create policy user_sheets_own_delete on public.user_technical_sheets
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists user_sheet_ingredients_own_select on public.user_technical_sheet_ingredients;
create policy user_sheet_ingredients_own_select on public.user_technical_sheet_ingredients
for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_sheet_ingredients_own_insert on public.user_technical_sheet_ingredients;
create policy user_sheet_ingredients_own_insert on public.user_technical_sheet_ingredients
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists user_sheet_ingredients_own_update on public.user_technical_sheet_ingredients;
create policy user_sheet_ingredients_own_update on public.user_technical_sheet_ingredients
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_sheet_ingredients_own_delete on public.user_technical_sheet_ingredients;
create policy user_sheet_ingredients_own_delete on public.user_technical_sheet_ingredients
for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
-- customer-delivery-tables.sql
-- ============================================================

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

-- ============================================================
-- finance-tables.sql
-- ============================================================

create table if not exists public.user_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  source text not null default 'mesa',
  receivable_app_id text,
  table_app_id text,
  tab_app_id text,
  tab_name text,
  delivery_app_id text,
  customer_app_id numeric,
  customer_name text,
  method text not null,
  amount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  received_amount numeric(12,2) not null default 0,
  change_amount numeric(12,2) not null default 0,
  time_label text,
  paid_at_label text,
  paid_at_iso date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null,
  code text,
  customer_app_id numeric not null,
  customer_name text not null,
  description text not null,
  amount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  status text not null default 'aberto',
  created_at_label text,
  created_at_iso date,
  due_date_label text,
  time_label text,
  paid_at_label text,
  paid_at_iso date,
  paid_time_label text,
  paid_method text,
  payment_app_id text,
  table_app_id text,
  tab_app_id text,
  delivery_app_id text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id numeric not null,
  description text not null,
  category text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pendente',
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_cash_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id numeric not null,
  code text,
  expected_total numeric(12,2) not null default 0,
  counted_total numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  notes text,
  payments_count numeric not null default 0,
  created_at_label text,
  created_at_iso date,
  time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, app_id)
);

create table if not exists public.user_cash_closing_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  closing_app_id numeric not null,
  method text not null,
  label text not null,
  expected numeric(12,2) not null default 0,
  counted numeric(12,2) not null default 0,
  difference numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, closing_app_id, method)
);

create index if not exists idx_user_payments_user_id on public.user_payments(user_id);
create index if not exists idx_user_payments_paid_at_iso on public.user_payments(paid_at_iso);
create index if not exists idx_user_receivables_user_id on public.user_accounts_receivable(user_id);
create index if not exists idx_user_receivables_status on public.user_accounts_receivable(status);
create index if not exists idx_user_expenses_user_id on public.user_expenses(user_id);
create index if not exists idx_user_cash_closings_user_id on public.user_cash_closings(user_id);
create index if not exists idx_user_cash_closing_methods_user_id on public.user_cash_closing_methods(user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_payments_updated_at on public.user_payments;
create trigger set_user_payments_updated_at
before update on public.user_payments
for each row execute function public.set_updated_at();

drop trigger if exists set_user_accounts_receivable_updated_at on public.user_accounts_receivable;
create trigger set_user_accounts_receivable_updated_at
before update on public.user_accounts_receivable
for each row execute function public.set_updated_at();

drop trigger if exists set_user_expenses_updated_at on public.user_expenses;
create trigger set_user_expenses_updated_at
before update on public.user_expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_user_cash_closings_updated_at on public.user_cash_closings;
create trigger set_user_cash_closings_updated_at
before update on public.user_cash_closings
for each row execute function public.set_updated_at();

alter table public.user_payments enable row level security;
alter table public.user_accounts_receivable enable row level security;
alter table public.user_expenses enable row level security;
alter table public.user_cash_closings enable row level security;
alter table public.user_cash_closing_methods enable row level security;

drop policy if exists "Users can select own payments" on public.user_payments;
create policy "Users can select own payments" on public.user_payments
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own payments" on public.user_payments;
create policy "Users can insert own payments" on public.user_payments
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own payments" on public.user_payments;
create policy "Users can update own payments" on public.user_payments
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own payments" on public.user_payments;
create policy "Users can delete own payments" on public.user_payments
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own receivables" on public.user_accounts_receivable;
create policy "Users can select own receivables" on public.user_accounts_receivable
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own receivables" on public.user_accounts_receivable;
create policy "Users can insert own receivables" on public.user_accounts_receivable
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own receivables" on public.user_accounts_receivable;
create policy "Users can update own receivables" on public.user_accounts_receivable
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own receivables" on public.user_accounts_receivable;
create policy "Users can delete own receivables" on public.user_accounts_receivable
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own expenses" on public.user_expenses;
create policy "Users can select own expenses" on public.user_expenses
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own expenses" on public.user_expenses;
create policy "Users can insert own expenses" on public.user_expenses
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own expenses" on public.user_expenses;
create policy "Users can update own expenses" on public.user_expenses
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own expenses" on public.user_expenses;
create policy "Users can delete own expenses" on public.user_expenses
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own cash closings" on public.user_cash_closings;
create policy "Users can select own cash closings" on public.user_cash_closings
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own cash closings" on public.user_cash_closings;
create policy "Users can insert own cash closings" on public.user_cash_closings
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own cash closings" on public.user_cash_closings;
create policy "Users can update own cash closings" on public.user_cash_closings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own cash closings" on public.user_cash_closings;
create policy "Users can delete own cash closings" on public.user_cash_closings
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can select own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can select own cash closing methods" on public.user_cash_closing_methods
for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can insert own cash closing methods" on public.user_cash_closing_methods
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can update own cash closing methods" on public.user_cash_closing_methods
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete own cash closing methods" on public.user_cash_closing_methods;
create policy "Users can delete own cash closing methods" on public.user_cash_closing_methods
for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
-- operation-tables.sql
-- ============================================================

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

-- ============================================================
-- store-multiuser.sql
-- ============================================================

-- LoccoBurger Gestao - loja compartilhada e usuarios por perfil
-- Execute depois das tabelas principais.

create extension if not exists pgcrypto;

create table if not exists public.user_stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'LoccoBurger',
  invite_code text not null default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id),
  unique(invite_code)
);

alter table public.user_profiles
add column if not exists store_owner_id uuid references auth.users(id) on delete cascade;

update public.user_profiles
set store_owner_id = user_id
where store_owner_id is null;

insert into public.user_stores (owner_user_id, name, invite_code)
select
  profiles.store_owner_id,
  'LoccoBurger',
  upper(substr(replace(profiles.store_owner_id::text, '-', ''), 1, 8))
from public.user_profiles profiles
where profiles.store_owner_id = profiles.user_id
on conflict (owner_user_id) do nothing;

drop trigger if exists set_user_stores_updated_at on public.user_stores;
create trigger set_user_stores_updated_at
before update on public.user_stores
for each row
execute function public.set_updated_at();

create or replace function public.current_store_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select profiles.store_owner_id from public.user_profiles profiles where profiles.user_id = auth.uid()),
    auth.uid()
  );
$$;

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'admin'
      and profiles.store_owner_id = public.current_store_owner_id()
  );
$$;

drop function if exists public.ensure_user_profile(text, text, text);
create function public.ensure_user_profile(
  profile_email text,
  profile_full_name text default '',
  requested_store_code text default ''
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  store_owner_id uuid,
  store_name text,
  store_invite_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := nullif(upper(trim(requested_store_code)), '');
  target_owner_id uuid;
  existing_profile public.user_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  select * into existing_profile
  from public.user_profiles profiles
  where profiles.user_id = current_user_id;

  if normalized_code is not null then
    select stores.owner_user_id into target_owner_id
    from public.user_stores stores
    where upper(stores.invite_code) = normalized_code;

    if target_owner_id is null then
      raise exception 'Codigo da loja invalido.';
    end if;
  end if;

  if existing_profile.user_id is null then
    target_owner_id := coalesce(target_owner_id, current_user_id);

    if target_owner_id = current_user_id then
      insert into public.user_stores (owner_user_id, name)
      values (current_user_id, 'LoccoBurger')
      on conflict (owner_user_id) do nothing;
    end if;

    insert into public.user_profiles (user_id, email, full_name, role, store_owner_id)
    values (
      current_user_id,
      profile_email,
      profile_full_name,
      case when target_owner_id = current_user_id then 'admin' else 'atendimento' end,
      target_owner_id
    );
  else
    target_owner_id := coalesce(existing_profile.store_owner_id, existing_profile.user_id);

    if existing_profile.store_owner_id is null then
      update public.user_profiles profiles
      set store_owner_id = target_owner_id,
          role = case when target_owner_id = current_user_id then 'admin' else profiles.role end,
          updated_at = now()
      where profiles.user_id = current_user_id;
    end if;

    if target_owner_id = current_user_id then
      insert into public.user_stores (owner_user_id, name)
      values (current_user_id, 'LoccoBurger')
      on conflict (owner_user_id) do nothing;
    end if;
  end if;

  return query
  select
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.store_owner_id,
    coalesce(stores.name, 'LoccoBurger') as store_name,
    stores.invite_code as store_invite_code,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  left join public.user_stores stores
    on stores.owner_user_id = profiles.store_owner_id
  where profiles.user_id = current_user_id;
end;
$$;

drop function if exists public.admin_list_user_profiles();
create function public.admin_list_user_profiles()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  store_owner_id uuid,
  store_name text,
  store_invite_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.current_store_owner_id();
begin
  if not public.is_current_user_admin() then
    raise exception 'Apenas administradores podem listar usuarios.';
  end if;

  return query
  select
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.store_owner_id,
    coalesce(stores.name, 'LoccoBurger') as store_name,
    stores.invite_code as store_invite_code,
    profiles.created_at,
    profiles.updated_at
  from public.user_profiles profiles
  left join public.user_stores stores
    on stores.owner_user_id = profiles.store_owner_id
  where profiles.store_owner_id = owner_id
  order by profiles.created_at desc;
end;
$$;

drop function if exists public.admin_update_user_role(uuid, text);
create function public.admin_update_user_role(target_user_id uuid, new_role text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  store_owner_id uuid,
  store_name text,
  store_invite_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.current_store_owner_id();
begin
  if not public.is_current_user_admin() then
    raise exception 'Apenas administradores podem alterar perfis.';
  end if;

  if new_role not in ('admin', 'atendimento', 'cozinha', 'garcom') then
    raise exception 'Perfil invalido.';
  end if;

  return query
  update public.user_profiles profiles
  set role = new_role,
      updated_at = now()
  where profiles.user_id = target_user_id
    and profiles.store_owner_id = owner_id
  returning
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.store_owner_id,
    (select coalesce(stores.name, 'LoccoBurger') from public.user_stores stores where stores.owner_user_id = profiles.store_owner_id),
    (select stores.invite_code from public.user_stores stores where stores.owner_user_id = profiles.store_owner_id),
    profiles.created_at,
    profiles.updated_at;
end;
$$;

drop function if exists public.admin_attach_user_to_store(text, text);
create function public.admin_attach_user_to_store(target_email text, new_role text)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  store_owner_id uuid,
  store_name text,
  store_invite_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := public.current_store_owner_id();
begin
  if not public.is_current_user_admin() then
    raise exception 'Apenas administradores podem vincular usuarios.';
  end if;

  if new_role not in ('admin', 'atendimento', 'cozinha', 'garcom') then
    raise exception 'Perfil invalido.';
  end if;

  if not exists (select 1 from public.user_profiles profiles where lower(profiles.email) = lower(target_email)) then
    raise exception 'Usuario precisa criar cadastro antes de ser vinculado.';
  end if;

  return query
  update public.user_profiles profiles
  set store_owner_id = owner_id,
      role = new_role,
      updated_at = now()
  where lower(profiles.email) = lower(target_email)
  returning
    profiles.user_id,
    profiles.email,
    profiles.full_name,
    profiles.role,
    profiles.store_owner_id,
    (select coalesce(stores.name, 'LoccoBurger') from public.user_stores stores where stores.owner_user_id = profiles.store_owner_id),
    (select stores.invite_code from public.user_stores stores where stores.owner_user_id = profiles.store_owner_id),
    profiles.created_at,
    profiles.updated_at;
end;
$$;

grant execute on function public.current_store_owner_id() to authenticated;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.ensure_user_profile(text, text, text) to authenticated;
grant execute on function public.admin_list_user_profiles() to authenticated;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;
grant execute on function public.admin_attach_user_to_store(text, text) to authenticated;

alter table public.user_stores enable row level security;
alter table public.user_profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_stores', 'user_profiles')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end $$;

-- whatsapp-integration.sql
-- LoccoBurger Gestao - integracao WhatsApp Delivery

create table if not exists public.user_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  from_phone text not null,
  customer_name text,
  phone_number_id text,
  display_phone_number text,
  message_type text not null default 'text',
  body text,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_atendimento', 'convertido', 'ignorado')),
  received_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, message_id)
);

create index if not exists idx_user_whatsapp_messages_user_status
on public.user_whatsapp_messages(user_id, status, received_at desc);

create index if not exists idx_user_whatsapp_messages_from_phone
on public.user_whatsapp_messages(user_id, from_phone);

drop trigger if exists set_user_whatsapp_messages_updated_at on public.user_whatsapp_messages;
create trigger set_user_whatsapp_messages_updated_at
before update on public.user_whatsapp_messages
for each row execute function public.set_updated_at();

alter table public.user_whatsapp_messages enable row level security;

drop policy if exists store_select_user_whatsapp_messages on public.user_whatsapp_messages;
create policy store_select_user_whatsapp_messages
on public.user_whatsapp_messages
for select to authenticated
using (user_id = public.current_store_owner_id());

drop policy if exists store_update_user_whatsapp_messages on public.user_whatsapp_messages;
create policy store_update_user_whatsapp_messages
on public.user_whatsapp_messages
for update to authenticated
using (user_id = public.current_store_owner_id())
with check (user_id = public.current_store_owner_id());

drop policy if exists store_delete_user_whatsapp_messages on public.user_whatsapp_messages;
create policy store_delete_user_whatsapp_messages
on public.user_whatsapp_messages
for delete to authenticated
using (user_id = public.current_store_owner_id());

notify pgrst, 'reload schema';

create policy "Store members can select own store"
on public.user_stores
for select to authenticated
using (owner_user_id = public.current_store_owner_id());

create policy "Owners can insert own store"
on public.user_stores
for insert to authenticated
with check (owner_user_id = auth.uid());

create policy "Store admins can update own store"
on public.user_stores
for update to authenticated
using (owner_user_id = public.current_store_owner_id() and public.is_current_user_admin())
with check (owner_user_id = public.current_store_owner_id() and public.is_current_user_admin());

create policy "Store members can select same store profiles"
on public.user_profiles
for select to authenticated
using (store_owner_id = public.current_store_owner_id() or user_id = auth.uid());

create policy "Users can insert own profile"
on public.user_profiles
for insert to authenticated
with check (user_id = auth.uid() and (store_owner_id is null or store_owner_id = auth.uid()));

do $$
declare
  table_name text;
  policy_record record;
  table_names text[] := array[
    'user_app_state',
    'user_products',
    'user_inventory_items',
    'user_technical_sheets',
    'user_technical_sheet_ingredients',
    'user_customers',
    'user_customer_campaigns',
    'user_delivery_orders',
    'user_delivery_order_items',
    'user_payments',
    'user_accounts_receivable',
    'user_expenses',
    'user_cash_closings',
    'user_cash_closing_methods',
    'user_restaurant_tables',
    'user_kitchen_tickets'
  ];
begin
  foreach table_name in array table_names loop
    if to_regclass('public.' || table_name) is not null then
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;

      execute format('alter table public.%I enable row level security', table_name);
      execute format('create policy %I on public.%I for select to authenticated using (user_id = public.current_store_owner_id())', 'store_select_' || table_name, table_name);
      execute format('create policy %I on public.%I for insert to authenticated with check (user_id = public.current_store_owner_id())', 'store_insert_' || table_name, table_name);
      execute format('create policy %I on public.%I for update to authenticated using (user_id = public.current_store_owner_id()) with check (user_id = public.current_store_owner_id())', 'store_update_' || table_name, table_name);
      execute format('create policy %I on public.%I for delete to authenticated using (user_id = public.current_store_owner_id())', 'store_delete_' || table_name, table_name);
    end if;
  end loop;
end $$;

-- Sincronizacao em tempo real entre dispositivos.
do $$
declare
  realtime_table text;
  realtime_tables text[] := array[
    'user_app_state',
    'user_products',
    'user_inventory_items',
    'user_technical_sheets',
    'user_technical_sheet_ingredients',
    'user_customers',
    'user_customer_campaigns',
    'user_delivery_orders',
    'user_delivery_order_items',
    'user_payments',
    'user_accounts_receivable',
    'user_expenses',
    'user_cash_closings',
    'user_cash_closing_methods',
    'user_restaurant_tables',
    'user_kitchen_tickets',
    'user_whatsapp_messages'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicacao supabase_realtime nao encontrada. Ative o Realtime no projeto Supabase.';
    return;
  end if;

  foreach realtime_table in array realtime_tables loop
    if to_regclass('public.' || realtime_table) is not null then
      execute format('alter table public.%I replica identity full', realtime_table);

      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
