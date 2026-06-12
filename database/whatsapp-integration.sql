-- LoccoBurger Gestao - integracao WhatsApp Delivery
-- Execute no SQL Editor do Supabase.

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
