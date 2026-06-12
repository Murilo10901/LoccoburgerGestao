-- LoccoBurger Gestao - sincronizacao em tempo real entre dispositivos
-- Execute no SQL Editor do Supabase depois das tabelas principais.

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
