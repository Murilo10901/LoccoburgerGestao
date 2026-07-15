-- LoccoBurger Gestao - campos extras do cardapio por canal
-- Execute no SQL Editor do Supabase se aparecer erro de coluna ausente em user_products.

alter table public.user_products add column if not exists description text not null default '';
alter table public.user_products add column if not exists image_url text;
alter table public.user_products add column if not exists available_delivery boolean not null default true;
alter table public.user_products add column if not exists available_qr boolean not null default true;
