# Estrutura do Projeto

Este documento mostra onde cada parte do LoccoBurger fica.

## Raiz do Projeto

Arquivos na raiz sao atalhos, configuracoes e documentos importantes.

- `01_COMECE_AQUI.txt`: orientacao inicial.
- `README.md`: resumo geral.
- `package.json`: lista scripts e dependencias do app.
- `vite.config.js`: configuracao do Vite.
- `.env.example`: exemplo de variaveis do Supabase.
- `PRODUCAO.md`: orientacoes de ambiente publicado.
- `WHATSAPP_INTEGRACAO.md`: orientacoes da integracao WhatsApp.
- `SEFAZ_INTEGRACAO.md`: orientacoes da integracao SEFAZ.

## Botoes e Rotinas

- `ABRIR_APP_LOCAL.bat`: inicia o app localmente.
- `GERAR_PACOTE_PRODUCAO.bat`: gera `dist` e `LoccoBurger-producao-hostinger.zip`.
- `PUBLICAR_LOCCOBURGER.bat`: envia `dist` para a Hostinger.
- `PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`: publica a funcao da SEFAZ.
- `LIMPAR_TESTES_LOCCOBURGER.bat`: limpa dados de teste.

## src

Codigo principal do app.

- `src/main.jsx`: entrada do React.
- `src/App.jsx`: estado central, navegacao e conexao entre telas.
- `src/styles.css`: estilos gerais.

## src/pages

Cada arquivo representa uma tela:

- `Dashboard.jsx`: painel inicial.
- `DailyOperation.jsx`: visao por dia.
- `Tables.jsx`: mesas e comandas.
- `Delivery.jsx`: delivery, clientes e entrada WhatsApp.
- `Kitchen.jsx`: fila da cozinha.
- `Cashier.jsx`: caixa PDV.
- `Products.jsx`: cadastro de produtos.
- `Inventory.jsx`: estoque e perdas.
- `Purchases.jsx`: compras e NFC-e/SEFAZ.
- `TechnicalSheet.jsx`: fichas tecnicas.
- `Financial.jsx`: financeiro.
- `Dre.jsx`: DRE.
- `Customers.jsx`: clientes, campanhas e cashback.
- `UserPermissions.jsx`: usuarios e perfis.
- `AuthPage.jsx`: login/cadastro.

## src/components

Componentes reutilizaveis:

- `Layout.jsx`: estrutura geral.
- `Sidebar.jsx`: menu lateral.
- `Header.jsx`: topo.
- `Card.jsx`: card padrao.
- `StatusBadge.jsx`: etiquetas de status.
- `BrandLogo.jsx`: logo.

## src/lib

Regras de negocio e comunicacao com Supabase:

- `auth.js`: login, cadastro e logout.
- `supabaseClient.js`: cliente Supabase.
- `supabase-config.js`: URL e chave publica.
- `appRepository.js`: estado geral de seguranca.
- `catalogRepository.js`: produtos, estoque e ficha tecnica no app.
- `catalogSupabaseRepository.js`: produtos/estoque/fichas no Supabase.
- `customerRepository.js`: clientes e campanhas.
- `customerDeliverySupabaseRepository.js`: clientes/delivery no Supabase.
- `deliveryRepository.js`: criacao e avanco de pedidos delivery.
- `financeSupabaseRepository.js`: pagamentos, caixa e financeiro.
- `operationSupabaseRepository.js`: mesas e cozinha.
- `inventoryRepository.js`: estoque, perdas e compras.
- `purchaseRepository.js`: compras manuais.
- `fiscalCouponRepository.js`: consulta NFC-e/SEFAZ.
- `whatsappRepository.js`: mensagens WhatsApp.
- `operationRepository.js`: resumo diario e DRE operacional.
- `marginSimulatorRepository.js`: simulador de margem.
- `orderModifiers.js`: adicionais, remocoes e observacoes.
- `technicalSheetRepository.js`: ficha tecnica.
- `tenantRepository.js`: loja compartilhada e dono dos dados.
- `storage.js`: fallback local de seguranca.

## database

Scripts SQL para criar/ajustar tabelas no Supabase.

- `00-run-all-production.sql`: script completo.
- `catalog-tables.sql`: produtos, estoque e ficha tecnica.
- `customer-delivery-tables.sql`: clientes, campanhas e delivery.
- `finance-tables.sql`: financeiro, pagamentos e caixa.
- `operation-tables.sql`: mesas e cozinha.
- `store-multiuser.sql`: loja compartilhada e perfis.
- `whatsapp-integration.sql`: mensagens WhatsApp.
- `user-app-state.sql`: estado geral de seguranca.

## supabase/functions

Funcoes externas:

- `whatsapp-webhook`: recebe mensagens do WhatsApp.
- `fiscal-coupon-import`: consulta QR Code NFC-e/SEFAZ.

## public/assets

Imagens estaticas. O logo atual fica em:

- `public/assets/loccoburger-logo.jpg`

## dist

Versao gerada para publicar.

Nao edite manualmente esta pasta. Ela e recriada pelo build.

## ferramentas-publicacao

Ferramentas portateis:

- WinSCP para FTP Hostinger.
- Supabase CLI para publicar funcoes.

Nao precisa instalar nada como administrador.
