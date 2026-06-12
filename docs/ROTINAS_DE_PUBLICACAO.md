# Rotinas De Publicacao

## Testar Localmente

Use:

`ABRIR_APP_LOCAL.bat`

Ele abre o servidor local em:

`http://127.0.0.1:5173`

## Gerar Versao De Producao

Use:

`GERAR_PACOTE_PRODUCAO.bat`

Ele recria:

- `dist`
- `LoccoBurger-producao-hostinger.zip`

## Publicar Site Na Hostinger

Use:

`PUBLICAR_LOCCOBURGER.bat`

Ele envia para:

`loccoburger.com`

## Publicacao Manual Rapida Pela Hostinger

Use quando o FTP ou o upload de ZIP estiver travando.

1. Rode `GERAR_PACOTE_PRODUCAO.bat`.
2. Rode `GERAR_INDEX_UNICO_HOSTINGER.bat`.
3. Abra `public_html/index.html` no File Manager da Hostinger.
4. Substitua todo o conteudo pelo arquivo `LoccoBurger-index-unico.html`.
5. Clique em `Save` e teste em `https://loccoburger.com/?v=YYYYMMDD`.

## Publicar Funcao SEFAZ No Supabase

Use:

`PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`

Ele publica:

`fiscal-coupon-import`

## Limpar Dados De Teste

Use:

`LIMPAR_TESTES_LOCCOBURGER.bat`

Leia antes:

`LEIA_LIMPEZA_TESTES.txt`

## Observacao

Quando mudar apenas produto, cliente, estoque ou ficha tecnica pelo proprio sistema, nao precisa publicar o site.

Quando mudar codigo, tela, estilo, funcao ou banco, precisa gerar pacote e/ou publicar.
