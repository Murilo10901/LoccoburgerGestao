# Guia De Alteracoes Manuais

Use este guia quando quiser fazer pequenas mudancas sem depender do Codex.

## Fluxo Seguro

1. Altere o arquivo em `src`, `public`, `database` ou `supabase`.
2. Rode `ABRIR_APP_LOCAL.bat`.
3. Teste no navegador.
4. Rode `GERAR_PACOTE_PRODUCAO.bat`.
5. Rode `PUBLICAR_LOCCOBURGER.bat`.

## Alterar Textos De Uma Tela

Abra o arquivo da tela em `src/pages`.

Exemplos:

- Texto da cozinha: `src/pages/Kitchen.jsx`
- Texto de compras: `src/pages/Purchases.jsx`
- Texto do caixa: `src/pages/Cashier.jsx`
- Texto de delivery: `src/pages/Delivery.jsx`

Procure o texto atual, altere e salve.

## Alterar Cores, Tamanhos e Layout

Abra:

`src/styles.css`

Procure pelo nome da classe. Exemplos:

- `.kitchen-ticket`: card da cozinha.
- `.delivery-grid`: layout do delivery.
- `.purchases-grid`: layout de compras.
- `.status-atrasado`: status atrasado.
- `.primary-button`: botao principal.

## Alterar Logo

Substitua a imagem:

`public/assets/loccoburger-logo.jpg`

Mantenha o mesmo nome do arquivo para nao precisar mexer no codigo.

Depois rode `GERAR_PACOTE_PRODUCAO.bat` e publique.

## Alterar Produtos Pelo Codigo

Preferencialmente altere produtos pelo proprio sistema, na tela Produtos.

O arquivo de dados iniciais fica em:

`src/data/mockData.js`

Use esse arquivo apenas para mudar a base inicial de novos ambientes. Dados reais ja ficam no Supabase.

## Alterar Ficha Tecnica Pelo Codigo

Preferencialmente altere no sistema, na tela Ficha Tecnica.

Base inicial:

`src/data/mockData.js`

Regras da ficha:

- produto aponta para `recipeId`;
- ficha tecnica aponta para `productId`;
- ingredientes usam `inventoryItemId`;
- quantidades seguem a unidade do insumo.

## Alterar Regras De Estoque

Arquivos principais:

- `src/lib/inventoryRepository.js`
- `src/pages/Inventory.jsx`
- `src/pages/Purchases.jsx`

## Alterar Fluxo De Mesa

Arquivos principais:

- `src/pages/Tables.jsx`
- `src/App.jsx`
- `src/lib/operationSupabaseRepository.js`

## Alterar Fluxo De Cozinha

Arquivos principais:

- `src/pages/Kitchen.jsx`
- `src/App.jsx`
- `src/lib/operationSupabaseRepository.js`

## Alterar Fluxo De Caixa

Arquivos principais:

- `src/pages/Cashier.jsx`
- `src/App.jsx`
- `src/lib/financeSupabaseRepository.js`

## Alterar Delivery e Clientes

Arquivos principais:

- `src/pages/Delivery.jsx`
- `src/pages/Customers.jsx`
- `src/lib/deliveryRepository.js`
- `src/lib/customerRepository.js`
- `src/lib/customerDeliverySupabaseRepository.js`

## Alterar Banco De Dados

Scripts ficam em `database`.

Para producao, use:

`database/00-run-all-production.sql`

Para alteracoes pontuais, prefira criar um novo arquivo SQL em `database`, com nome claro, por exemplo:

`database/2026-06-estoque-ajustes.sql`

## Alterar Integracao SEFAZ

Arquivos:

- `src/lib/fiscalCouponRepository.js`
- `supabase/functions/fiscal-coupon-import/index.ts`
- `SEFAZ_INTEGRACAO.md`

Depois de mudar a funcao, rode:

`PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`

## Alterar Integracao WhatsApp

Arquivos:

- `src/lib/whatsappRepository.js`
- `supabase/functions/whatsapp-webhook/index.ts`
- `WHATSAPP_INTEGRACAO.md`

## O Que Nao Editar Manualmente

Evite alterar:

- `dist`: e gerado automaticamente.
- `node_modules`: dependencias do app.
- `pnpm-lock.yaml`: travamento de dependencias.
- arquivos `.zip`: pacotes gerados.
- `vite-server.log` e `vite-server.err`: logs.

## Checklist Antes De Publicar

- A tela abre localmente.
- Login funciona.
- Menu lateral aparece.
- Modulo alterado funciona.
- Nao apareceu tela branca.
- Foi gerado novo pacote.
- Publicacao na Hostinger terminou com sucesso.
