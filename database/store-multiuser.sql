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
