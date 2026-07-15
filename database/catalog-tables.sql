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
