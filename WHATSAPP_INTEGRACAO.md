# Integracao WhatsApp Delivery

Esta primeira versao deixa o LoccoBurger pronto para receber mensagens do WhatsApp Business Platform no Supabase e mostrar essas mensagens na tela Delivery.

## Como funciona

1. O cliente manda mensagem para o WhatsApp da loja.
2. A Meta envia a mensagem para a Edge Function do Supabase.
3. A Edge Function grava a mensagem em `user_whatsapp_messages`.
4. O painel Delivery mostra a mensagem em `Integracao WhatsApp > Entrada de mensagens`.
5. O operador clica em `Montar pedido`, confere os itens e finaliza o pedido.

## SQL

Execute no Supabase SQL Editor:

`database/whatsapp-integration.sql`

O script cria a tabela `user_whatsapp_messages`, indices, trigger de atualizacao e policies de seguranca por loja.

## Edge Function

Funcao criada:

`supabase/functions/whatsapp-webhook/index.ts`

Config:

`supabase/config.toml`

A funcao precisa ficar publica para a Meta conseguir validar e enviar webhooks.

## Segredos no Supabase

Configure em Edge Functions > Secrets:

- `WHATSAPP_VERIFY_TOKEN`: um texto secreto criado por voce, usado tambem no painel da Meta.
- `WHATSAPP_APP_SECRET`: App Secret do aplicativo Meta.
- `LOCCO_STORE_OWNER_ID`: UUID do usuario administrador/dono da loja.

URL do webhook:

`https://vqentphbsvnyvambtzlx.supabase.co/functions/v1/whatsapp-webhook`

## Pontos de atencao

- O site publicado na Hostinger nao deve guardar token do WhatsApp.
- A integracao oficial exige WhatsApp Business Platform / Cloud API, nao leitura direta do WhatsApp pessoal.
- A primeira leitura do pedido e assistida: o sistema carrega a mensagem, tenta identificar produtos pelo nome e deixa o operador conferir antes de enviar para a cozinha.
