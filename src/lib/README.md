# Camada de dados

`appRepository.js` mantem o estado geral de seguranca em `user_app_state`.

Os modulos principais ja possuem repositorios proprios no Supabase:

- `catalogSupabaseRepository.js`: produtos, estoque e ficha tecnica.
- `customerDeliverySupabaseRepository.js`: clientes, campanhas e delivery.
- `financeSupabaseRepository.js`: pagamentos, caderneta, despesas e fechamento.
- `operationSupabaseRepository.js`: mesas, comandas e cozinha.
- `realtimeSync.js`: escuta mudancas no Supabase Realtime e dispara recarga compartilhada entre devices.
- `tenantRepository.js`: identifica a loja compartilhada do usuario.

Quando o usuario pertence a uma loja, os repositorios usam o dono operacional da loja como chave dos dados. Assim administrador, atendimento, cozinha e garcom compartilham a mesma operacao com telas filtradas por perfil.

O `localStorage` fica apenas como fallback de seguranca caso o Supabase fique indisponivel durante uma gravacao.

A sincronizacao entre celulares, tablets e computadores usa Realtime primeiro e mantem consulta periodica como fallback.
