-- LoccoBurger Gestao - pedidos feitos pelo QR Code das mesas
-- Execute este arquivo no Supabase SQL Editor.
--
-- Objetivo:
-- - Cliente anonimo do QR Code consegue INSERIR pedido/fechamento.
-- - Cliente anonimo consegue CANCELAR fechamento pendente se tiver o id do pedido.
-- - Admin autenticado consegue ler, aprovar, recusar e fechar.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.public_client_qr_orders (
  id uuid primary key default gen_random_uuid(),
  store_id text not null default 'loccoburger',
  app_id text not null,
  order_type text not null default 'pedido',
  status text not null default 'novo',
  table_number text not null,
  session_id text,
  session_identity text,
  customer_name text not null,
  phone text,
  notes text,
  items jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  tab_id text,
  admin_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  paid_at timestamptz,
  unique(store_id, app_id)
);

create index if not exists idx_public_client_qr_orders_store_status
on public.public_client_qr_orders(store_id, status);

create index if not exists idx_public_client_qr_orders_table
on public.public_client_qr_orders(store_id, table_number);

create index if not exists idx_public_client_qr_orders_session
on public.public_client_qr_orders(store_id, session_identity);

create index if not exists idx_public_client_qr_orders_created_at
on public.public_client_qr_orders(created_at desc);

drop trigger if exists set_public_client_qr_orders_updated_at on public.public_client_qr_orders;
create trigger set_public_client_qr_orders_updated_at
before update on public.public_client_qr_orders
for each row execute function public.set_updated_at();

alter table public.public_client_qr_orders enable row level security;

drop policy if exists public_client_qr_orders_anon_insert on public.public_client_qr_orders;
create policy public_client_qr_orders_anon_insert
on public.public_client_qr_orders
for insert
to anon
with check (
  store_id = 'loccoburger'
  and status = 'novo'
  and order_type in ('pedido', 'fechamento')
);

drop policy if exists public_client_qr_orders_anon_cancel on public.public_client_qr_orders;
create policy public_client_qr_orders_anon_cancel
on public.public_client_qr_orders
for update
to anon
using (
  store_id = 'loccoburger'
  and status = 'novo'
)
with check (
  store_id = 'loccoburger'
  and status = 'cancelado'
);

drop policy if exists public_client_qr_orders_admin_all on public.public_client_qr_orders;
create policy public_client_qr_orders_admin_all
on public.public_client_qr_orders
for all
to authenticated
using (store_id = 'loccoburger')
with check (store_id = 'loccoburger');

create or replace function public.get_client_qr_orders(
  p_table_number text,
  p_session_identity text,
  p_limit integer default 80
)
returns setof public.public_client_qr_orders
language sql
security definer
set search_path = public
as $$
  select *
  from public.public_client_qr_orders
  where store_id = 'loccoburger'
    and table_number = trim(coalesce(p_table_number, ''))
    and session_identity = trim(coalesce(p_session_identity, ''))
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 80), 1), 120);
$$;

grant execute on function public.get_client_qr_orders(text, text, integer) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.public_client_qr_orders;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
