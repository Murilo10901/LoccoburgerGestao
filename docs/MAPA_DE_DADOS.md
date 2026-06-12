# Mapa De Dados

Este mapa mostra onde cada modulo salva dados.

## Supabase

O Supabase e a fonte principal dos dados.

Projeto:

`https://vqentphbsvnyvambtzlx.supabase.co`

## Tabelas Principais

- `user_profiles`: usuarios e perfis.
- `user_stores`: loja compartilhada.
- `user_app_state`: estado geral de seguranca.
- `user_products`: produtos.
- `user_inventory_items`: insumos/estoque.
- `user_technical_sheets`: fichas tecnicas.
- `user_technical_sheet_ingredients`: ingredientes das fichas.
- `user_customers`: clientes.
- `user_customer_campaigns`: campanhas.
- `user_delivery_orders`: pedidos delivery.
- `user_delivery_order_items`: itens delivery.
- `user_restaurant_tables`: mesas/comandas.
- `user_kitchen_tickets`: cozinha.
- `user_payments`: pagamentos.
- `user_accounts_receivable`: caderneta/contas a receber.
- `user_expenses`: despesas.
- `user_cash_closings`: fechamento de caixa.
- `user_cash_closing_methods`: meios do fechamento.
- `user_whatsapp_messages`: mensagens recebidas do WhatsApp.

## Regra De Loja

Os dados sao vinculados ao dono da loja.

Usuarios como atendimento, cozinha e garcom acessam a mesma loja pelo `store_owner_id`.

## Fallback Local

O navegador pode manter uma copia de seguranca local se o Supabase falhar.

Arquivos relacionados:

- `src/lib/storage.js`
- `src/lib/appRepository.js`
- `src/lib/database.js`

## Onde Alterar Repositorios

- Catalogo: `src/lib/catalogSupabaseRepository.js`
- Clientes/delivery: `src/lib/customerDeliverySupabaseRepository.js`
- Financeiro: `src/lib/financeSupabaseRepository.js`
- Operacao: `src/lib/operationSupabaseRepository.js`
- WhatsApp: `src/lib/whatsappRepository.js`
- SEFAZ: `src/lib/fiscalCouponRepository.js`
