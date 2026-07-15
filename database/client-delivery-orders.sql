-- LoccoBurger Gestao - pedidos feitos pelo delivery publico
-- Execute este arquivo no Supabase SQL Editor ou via CLI.
--
-- Objetivo:
-- - Cliente anonimo do delivery consegue INSERIR pedido novo.
-- - Cliente consegue consultar apenas pedidos relacionados a propria sessao/telefone/e-mail via RPC.
-- - Admin autenticado consegue ler e atualizar status para refletir no app do cliente.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.public_client_delivery_orders (
  id uuid primary key default gen_random_uuid(),
  store_id text not null default 'loccoburger',
  app_id text not null,
  status text not null default 'novo',
  session_id text,
  account_type text not null default 'guest',
  customer_name text not null,
  phone text,
  customer_email text,
  address text,
  complement text,
  payment_method text,
  payment_status text,
  payment_label text,
  pay_on_delivery boolean not null default true,
  cash_change_for numeric(12, 2) not null default 0,
  notes text,
  items jsonb not null default '[]'::jsonb,
  order_payload jsonb not null default '{}'::jsonb,
  subtotal numeric(12, 2) not null default 0,
  delivery_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  admin_delivery_id text,
  admin_message text,
  eta text,
  guest_visible_until_ms bigint,
  delivery_auto_complete_at_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  paid_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  unique(store_id, app_id)
);

create index if not exists idx_public_client_delivery_orders_store_status
on public.public_client_delivery_orders(store_id, status);

create index if not exists idx_public_client_delivery_orders_session
on public.public_client_delivery_orders(store_id, session_id);

create index if not exists idx_public_client_delivery_orders_phone
on public.public_client_delivery_orders(store_id, phone);

create index if not exists idx_public_client_delivery_orders_email
on public.public_client_delivery_orders(store_id, lower(customer_email));

create index if not exists idx_public_client_delivery_orders_created_at
on public.public_client_delivery_orders(created_at desc);

drop trigger if exists set_public_client_delivery_orders_updated_at on public.public_client_delivery_orders;
create trigger set_public_client_delivery_orders_updated_at
before update on public.public_client_delivery_orders
for each row execute function public.set_updated_at();

alter table public.public_client_delivery_orders enable row level security;

drop policy if exists public_client_delivery_orders_anon_insert on public.public_client_delivery_orders;
create policy public_client_delivery_orders_anon_insert
on public.public_client_delivery_orders
for insert
to anon
with check (
  store_id = 'loccoburger'
  and status = 'novo'
);

drop policy if exists public_client_delivery_orders_admin_all on public.public_client_delivery_orders;
create policy public_client_delivery_orders_admin_all
on public.public_client_delivery_orders
for all
to authenticated
using (store_id = 'loccoburger')
with check (store_id = 'loccoburger');

create or replace function public.get_client_delivery_orders(
  p_session_id text default '',
  p_phone text default '',
  p_email text default '',
  p_limit integer default 80
)
returns setof public.public_client_delivery_orders
language sql
security definer
set search_path = public
as $$
  select *
  from public.public_client_delivery_orders
  where store_id = 'loccoburger'
    and (
      (trim(coalesce(p_session_id, '')) <> '' and session_id = trim(coalesce(p_session_id, '')))
      or (regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> '' and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'))
      or (trim(coalesce(p_email, '')) <> '' and lower(customer_email) = lower(trim(coalesce(p_email, ''))))
    )
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 80), 1), 120);
$$;

grant execute on function public.get_client_delivery_orders(text, text, text, integer) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.public_client_delivery_orders;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
