# Banco de dados Supabase

Para deixar o LoccoBurger Gestao pronto para uso real, execute no Supabase SQL Editor:

1. Abra o projeto Supabase.
2. Entre em SQL Editor.
3. Cole todo o conteudo de `00-run-all-production.sql`.
4. Clique em Run.
5. Volte ao app, saia e entre novamente para recarregar os dados.

## Arquivo principal

- `00-run-all-production.sql`: script completo para producao.
- `realtime-sync.sql`: ativa a sincronizacao em tempo real caso voce queira rodar somente esta etapa em um banco ja criado.

## Modulos criados

- autenticacao e estado seguro por usuario;
- loja compartilhada e perfis de acesso;
- produtos, estoque e ficha tecnica;
- clientes, campanhas e delivery;
- pagamentos, caderneta, contas a receber, despesas e fechamento de caixa;
- mesas, comandas e cozinha.
- entrada de mensagens do WhatsApp para pedidos de delivery.

## WhatsApp Delivery

Para ativar a entrada automatica de pedidos por WhatsApp, execute tambem `whatsapp-integration.sql`, publique a Edge Function `supabase/functions/whatsapp-webhook` e configure estes segredos no Supabase:

- `WHATSAPP_VERIFY_TOKEN`: palavra-chave criada por voce para validar o webhook.
- `WHATSAPP_APP_SECRET`: segredo do aplicativo Meta, usado para validar a origem das mensagens.
- `LOCCO_STORE_OWNER_ID`: UUID do usuario administrador/dono da loja.

URL do webhook:

`https://vqentphbsvnyvambtzlx.supabase.co/functions/v1/whatsapp-webhook`

## Seguranca

Todas as tabelas operacionais usam RLS por loja. Cada usuario autenticado acessa somente os dados da loja em que esta vinculado.

## Fallback

O app ainda mantem um estado geral em `user_app_state` como seguranca de migracao. As tabelas proprias ja sao carregadas e salvas automaticamente quando existem no Supabase.

## Sincronizacao entre devices

O app usa Supabase Realtime para atualizar outros dispositivos quando detecta mudanca em produtos, estoque, delivery, mesas, cozinha, caixa, financeiro ou mensagens de WhatsApp. A consulta automatica a cada poucos segundos continua ativa como fallback de seguranca.

Para sincronizar, os usuarios precisam estar vinculados a mesma loja.

Se o banco ja estava criado antes desta melhoria, execute `realtime-sync.sql` no SQL Editor do Supabase uma vez.

## Como vincular usuarios

- Primeiro usuario sem codigo cria a loja e vira administrador.
- Novos usuarios entram pelo codigo da loja no cadastro.
- O administrador tambem pode vincular usuarios cadastrados pela tela `Usuarios`.
