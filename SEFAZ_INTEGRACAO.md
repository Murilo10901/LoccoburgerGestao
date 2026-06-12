# Integracao SEFAZ NFC-e

Esta versao prepara a tela Compras para tentar importar itens de um cupom NFC-e a partir da URL do QR Code.

## O que foi feito

- Campo para colar URL/chave do QR Code.
- Botao `Consultar SEFAZ`.
- Leitura de imagem do QR Code quando o navegador suporta `BarcodeDetector`.
- Edge Function `fiscal-coupon-import` para buscar a pagina publica da NFC-e fora do navegador.
- Retorno dos itens para conferencia antes de sensibilizar o estoque.

## Arquivos

- `src/pages/Purchases.jsx`
- `src/lib/fiscalCouponRepository.js`
- `supabase/functions/fiscal-coupon-import/index.ts`
- `supabase/config.toml`

## Adequacao de seguranca

A funcao foi ajustada para:

- exigir usuario autenticado no LoccoBurger;
- bloquear URLs locais ou privadas;
- aceitar somente URLs com cara de consulta fiscal/SEFAZ;
- manter conferencia manual antes de lançar estoque.

## Publicacao da funcao

Use o arquivo:

`PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`

Ele usa o Supabase CLI portatil salvo em:

`ferramentas-publicacao/Supabase-CLI/supabase.exe`

Se preferir rodar manualmente:

`supabase functions deploy fiscal-coupon-import --project-ref vqentphbsvnyvambtzlx --use-api`

Depois de publicada, a tela Compras chama:

`https://vqentphbsvnyvambtzlx.supabase.co/functions/v1/fiscal-coupon-import`

## Pontos de atencao

- A NFC-e usa consulta publica via QR Code.
- Cada UF pode ter pagina/layout proprio.
- Algumas SEFAZ podem usar protecao contra consulta automatizada, captcha, instabilidade ou HTML diferente.
- Por isso o sistema sempre exige conferencia dos itens antes de lançar entrada no estoque.
