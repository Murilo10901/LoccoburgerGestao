# Repositorio GitHub

Este projeto esta pronto para ser versionado no GitHub como:

`Murilo10901/LoccoburgerGestao`

## O Que Entra No GitHub

- Codigo do aplicativo em `src`
- Imagens e arquivos publicos em `public`
- Scripts SQL em `database`
- Funcoes Supabase em `supabase/functions`
- Documentacao em `docs`
- Arquivos de configuracao do Vite, Netlify e Vercel
- Scripts manuais `.bat` e `.ps1`

## O Que Nao Entra No GitHub

- `node_modules`
- `dist`
- `.tools`
- `ferramentas-publicacao`
- Arquivos `.zip`
- Logs
- Arquivos `.env`

Esses itens sao gerados localmente, contem ferramentas grandes ou podem conter dados sensiveis.

## Como Criar O Repositorio

1. Abra o GitHub.
2. Crie um novo repositorio chamado `LoccoburgerGestao`.
3. Recomendo marcar como `Private`.
4. Nao marque para criar README, `.gitignore` ou License, porque o projeto ja possui esses arquivos.
5. Depois de criado, informe o caminho completo do repositorio, por exemplo:

`Murilo10901/LoccoburgerGestao`

Com o repositorio existente, o conector GitHub consegue receber os arquivos do projeto.

## Validacao Automatica

Foi criada uma rotina em `.github/workflows/validar-app.yml`.

Sempre que houver alteracao no GitHub, ela instala as dependencias e executa o build do app. Se algo quebrar, o GitHub mostra o erro antes de publicar uma nova versao.

## Fluxo Recomendado

1. Fazer alteracoes no projeto.
2. Testar localmente.
3. Gerar a versao de producao quando necessario.
4. O Codex mostra o nome sugerido do commit e pede confirmacao.
5. Atualizar o GitHub somente depois da confirmacao.
6. Publicar na Hostinger ou no ambiente escolhido.
