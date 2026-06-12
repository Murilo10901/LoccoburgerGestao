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
