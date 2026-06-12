# LoccoBurger Gestao

Sistema web de gestao operacional da hamburgueria LoccoBurger.

## Visao Rapida

O sistema foi feito em React + Vite, com Supabase para login, banco de dados e integracoes. A publicacao atual usa Hostinger para hospedar o site.

Modulos principais:

- Dashboard
- Operacao do dia
- Mesas e comandas
- Delivery
- Clientes e campanhas
- Cozinha
- Caixa PDV
- Produtos
- Estoque
- Compras
- Ficha tecnica
- Financeiro
- DRE
- Usuarios e permissoes

## Arquivos Para Uso Manual

- `01_COMECE_AQUI.txt`: primeiro arquivo para abrir.
- `docs/ESTRUTURA_DO_PROJETO.md`: mapa completo do projeto.
- `docs/GUIA_DE_ALTERACOES_MANUAIS.md`: como mexer manualmente.
- `docs/GUIA_GITHUB_E_PUBLICACAO.md`: fluxo GitHub, commits e publicacao.
- `docs/GITHUB_REPOSITORIO.md`: como criar e manter o repositorio no GitHub.
- `ABRIR_APP_LOCAL.bat`: abre o sistema local para teste.
- `GERAR_PACOTE_PRODUCAO.bat`: gera a versao final.
- `GERAR_INDEX_UNICO_HOSTINGER.bat`: gera um `index.html` unico para publicacao manual rapida.
- `PUBLICAR_LOCCOBURGER.bat`: publica na Hostinger.
- `PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`: publica a funcao SEFAZ no Supabase.
- `LIMPAR_TESTES_LOCCOBURGER.bat`: limpa dados de teste.

## Pastas Principais

- `src`: codigo do aplicativo.
- `src/pages`: telas do sistema.
- `src/components`: componentes reutilizaveis.
- `src/lib`: regras de negocio, calculos, Supabase e repositorios.
- `src/data`: dados iniciais/mockados.
- `public/assets`: imagens publicas, como logo.
- `database`: scripts SQL do Supabase.
- `supabase/functions`: funcoes externas, como WhatsApp e SEFAZ.
- `dist`: versao gerada para publicacao.
- `ferramentas-publicacao`: ferramentas portateis de publicacao.
- `docs`: documentacao para manutencao manual.

## Regra De Ouro

Edite arquivos em `src`, `database`, `supabase` ou `public`.

Nao edite manualmente `dist`, `node_modules` ou arquivos `.zip`, porque eles sao gerados automaticamente.
