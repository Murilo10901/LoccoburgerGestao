# Guia GitHub E Publicacao

Este guia organiza como o projeto LoccoBurger Gestao deve ser mantido no GitHub e como publicar novas versoes em producao.

Repositorio oficial:

`Murilo10901/LoccoburgerGestao`

URL:

`https://github.com/Murilo10901/LoccoburgerGestao`

## Regra Para Toda Mudanca Nova

1. Fazer a mudanca no projeto local.
2. Testar localmente.
3. O Codex apresenta:
   - resumo do que mudou;
   - arquivos alterados;
   - nome sugerido do commit.
4. O usuario confirma se quer enviar para o GitHub.
5. Somente depois da confirmacao o commit e enviado.
6. Se a mudanca precisar ir para producao, gerar pacote e publicar na Hostinger.

## Nome De Commit Sugerido Para A Primeira Subida

`Organiza projeto LoccoBurger Gestao para GitHub`

## O Que Entra No GitHub

- Codigo fonte do aplicativo.
- Documentacao.
- SQL do banco Supabase.
- Funcoes Supabase.
- Scripts de apoio para teste, publicacao e limpeza.
- Configuracoes de build.
- Logo e imagens publicas.

## O Que Nao Entra No GitHub

- `node_modules`: dependencias instaladas localmente.
- `dist`: versao gerada para publicacao.
- `ferramentas-publicacao`: ferramentas portateis grandes.
- `.tools`: ferramentas locais.
- `*.zip`: pacotes gerados.
- `*.log` e `*.err`: logs locais.
- `.env`: variaveis privadas locais.
- `LoccoBurger-index-unico.html`: arquivo gerado para publicacao manual rapida.

## Publicacao Manual Mais Rapida

### Caminho 1: FTP automatico

Use quando o FTP da Hostinger estiver funcionando.

1. Rodar `GERAR_PACOTE_PRODUCAO.bat`.
2. Rodar `PUBLICAR_LOCCOBURGER_GUI.ps1` ou `PUBLICAR_LOCCOBURGER.bat`.
3. Informar a senha FTP quando a janela pedir.

Vantagem: publica `dist` completo.

### Caminho 2: Hostinger com index unico

Use quando o FTP ou upload de ZIP estiver bloqueando.

1. Rodar `GERAR_PACOTE_PRODUCAO.bat`.
2. Rodar `GERAR_INDEX_UNICO_HOSTINGER.bat`.
3. Abrir o File Manager da Hostinger.
4. Entrar em `domains/loccoburger.com/public_html`.
5. Abrir `index.html`.
6. Substituir todo o conteudo pelo conteudo de `LoccoBurger-index-unico.html`.
7. Clicar em `Save`.
8. Validar em `https://loccoburger.com/?v=YYYYMMDD`.

Vantagem: evita upload de pasta e ZIP.

## Resumo Dos Arquivos

### Raiz

- `.env.example`: exemplo de variaveis de ambiente para Supabase.
- `.gitignore`: lista arquivos que nao devem ir para o GitHub.
- `01_COMECE_AQUI.txt`: ponto de partida para quem for abrir o projeto.
- `ABRIR_APP_LOCAL.bat`: atalho Windows para abrir o app local.
- `ABRIR_APP_LOCAL.ps1`: script que inicia o servidor local.
- `ABRIR_FTP_LOCCOBURGER.bat`: abre o WinSCP no FTP da Hostinger.
- `GERAR_INDEX_UNICO_HOSTINGER.bat`: atalho para gerar index unico.
- `GERAR_INDEX_UNICO_HOSTINGER.ps1`: gera um HTML unico para publicacao manual.
- `GERAR_PACOTE_PRODUCAO.bat`: atalho para gerar pacote de producao.
- `GERAR_PACOTE_PRODUCAO.ps1`: executa build e cria ZIP para Hostinger.
- `index.html`: entrada do app no Vite.
- `LEIA_LIMPEZA_TESTES.txt`: orienta limpeza de dados de teste.
- `LEIA_PUBLICACAO_HOSTINGER.txt`: orienta publicacao na Hostinger.
- `LEIA_PUBLICAR_SEFAZ_SUPABASE.txt`: orienta publicacao da funcao SEFAZ.
- `LIMPAR_TESTES_LOCCOBURGER.bat`: atalho de limpeza de dados de teste.
- `LIMPAR_TESTES_LOCCOBURGER.ps1`: rotina de limpeza de testes no Supabase.
- `netlify.toml`: configuracao para publicar no Netlify.
- `package.json`: dependencias e scripts do projeto.
- `pnpm-lock.yaml`: trava versoes das dependencias.
- `PRODUCAO.md`: notas de ambiente publicado.
- `PUBLICAR_FUNCAO_SEFAZ_SUPABASE.bat`: atalho para publicar funcao SEFAZ.
- `PUBLICAR_FUNCAO_SEFAZ_SUPABASE.ps1`: publica edge function no Supabase.
- `PUBLICAR_LOCCOBURGER.bat`: atalho de publicacao FTP.
- `PUBLICAR_LOCCOBURGER.ps1`: publica `dist` na Hostinger via FTP.
- `PUBLICAR_LOCCOBURGER_GUI.ps1`: publica via FTP pedindo senha em janela.
- `README.md`: resumo principal do projeto.
- `SEFAZ_INTEGRACAO.md`: estrategia da integracao SEFAZ/NFC-e.
- `vercel.json`: configuracao para publicar no Vercel.
- `vite.config.js`: configuracao do Vite.
- `WHATSAPP_INTEGRACAO.md`: estrategia de integracao WhatsApp.

### .github

- `.github/workflows/validar-app.yml`: valida o build a cada push ou pull request.

### database

- `database/00-run-all-production.sql`: script completo para preparar producao.
- `database/catalog-tables.sql`: tabelas de produtos, estoque e ficha tecnica.
- `database/customer-delivery-tables.sql`: tabelas de clientes e delivery.
- `database/finance-tables.sql`: tabelas de financeiro, caixa e recebiveis.
- `database/operation-tables.sql`: tabelas de mesas, pedidos e cozinha.
- `database/README.md`: leitura rapida dos scripts SQL.
- `database/realtime-sync.sql`: ativa sincronizacao em tempo real.
- `database/store-multiuser.sql`: lojas, usuarios e vinculos multiusuario.
- `database/supabase-schema.sql`: schema consolidado.
- `database/user-app-state.sql`: estado geral por usuario.
- `database/user-profile-admin-functions.sql`: funcoes administrativas de perfil.
- `database/user-profiles.sql`: tabela de perfis de acesso.
- `database/whatsapp-integration.sql`: estrutura de mensagens WhatsApp.
- `database/migrations/001_initial_schema.sql`: migracao inicial.

### docs

- `docs/ESTRUTURA_DO_PROJETO.md`: mapa de pastas e arquivos.
- `docs/GITHUB_REPOSITORIO.md`: orientacao do repositorio GitHub.
- `docs/GUIA_DE_ALTERACOES_MANUAIS.md`: guia para alterar sem depender de automacao.
- `docs/GUIA_GITHUB_E_PUBLICACAO.md`: este guia.
- `docs/MAPA_DE_DADOS.md`: mapa dos dados e entidades.
- `docs/ROTINAS_DE_PUBLICACAO.md`: rotinas de teste e publicacao.

### public

- `public/assets/loccoburger-logo.jpg`: logo oficial usado na interface.

### scripts

- `scripts/README.md`: notas sobre scripts de apoio.

### src

- `src/main.jsx`: inicializa o React.
- `src/App.jsx`: estado central, navegacao, sincronizacao e regras principais.
- `src/styles.css`: estilos globais e responsividade.

### src/components

- `src/components/BrandLogo.jsx`: exibe o logo.
- `src/components/Card.jsx`: card reutilizavel.
- `src/components/Header.jsx`: topo do sistema e seletor de visual.
- `src/components/Layout.jsx`: estrutura geral da tela.
- `src/components/Sidebar.jsx`: menu lateral.
- `src/components/StatusBadge.jsx`: etiquetas de status.

### src/data

- `src/data/mockData.js`: dados iniciais e exemplos.

### src/lib

- `src/lib/appRepository.js`: persistencia do estado geral.
- `src/lib/auth.js`: login, cadastro, logout e mensagens de erro.
- `src/lib/catalogRepository.js`: regras locais de catalogo.
- `src/lib/catalogSupabaseRepository.js`: catalogo no Supabase.
- `src/lib/customerDeliverySupabaseRepository.js`: clientes e delivery no Supabase.
- `src/lib/customerRepository.js`: clientes, campanhas e cashback.
- `src/lib/database.js`: funcoes de carga e salvamento.
- `src/lib/deliveryRepository.js`: pedidos de delivery.
- `src/lib/financeSupabaseRepository.js`: caixa, pagamentos e financeiro.
- `src/lib/fiscalCouponRepository.js`: leitura e importacao de cupom fiscal.
- `src/lib/inventoryRepository.js`: estoque, perdas e entradas.
- `src/lib/marginSimulatorRepository.js`: simulador de margem.
- `src/lib/operationRepository.js`: operacao diaria e DRE.
- `src/lib/operationSupabaseRepository.js`: mesas e cozinha no Supabase.
- `src/lib/orderModifiers.js`: observacoes e personalizacoes de pedidos.
- `src/lib/purchaseRepository.js`: compras e sugestoes.
- `src/lib/README.md`: resumo da camada `lib`.
- `src/lib/realtimeSync.js`: sincronizacao entre dispositivos.
- `src/lib/storage.js`: fallback local de seguranca.
- `src/lib/supabase-config.js`: URL e chave publica anon do Supabase.
- `src/lib/supabaseClient.js`: cliente Supabase.
- `src/lib/supabaseTables.js`: nomes das tabelas Supabase.
- `src/lib/technicalSheetRepository.js`: fichas tecnicas.
- `src/lib/tenantRepository.js`: loja compartilhada e dono dos dados.
- `src/lib/userProfileRepository.js`: perfis e permissoes.
- `src/lib/whatsappRepository.js`: mensagens WhatsApp.

### src/pages

- `src/pages/AuthPage.jsx`: login e cadastro.
- `src/pages/Cashier.jsx`: PDV, mesas, delivery, pagamentos e caderneta.
- `src/pages/Customers.jsx`: clientes, historico, campanhas e cashback.
- `src/pages/DailyOperation.jsx`: resultado por dia e periodo.
- `src/pages/Dashboard.jsx`: indicadores principais.
- `src/pages/Delivery.jsx`: entrada e acompanhamento de pedidos delivery.
- `src/pages/Dre.jsx`: demonstrativo de resultado.
- `src/pages/Financial.jsx`: contas, recebimentos e despesas.
- `src/pages/Inventory.jsx`: estoque, entradas, perdas e ajustes.
- `src/pages/Kitchen.jsx`: fila de cozinha, prioridade e tempos.
- `src/pages/PlaceholderPage.jsx`: tela base para modulos futuros.
- `src/pages/Products.jsx`: cadastro e manutencao de produtos.
- `src/pages/Purchases.jsx`: compras, sugestoes e cupom fiscal.
- `src/pages/Tables.jsx`: mesas, comandas e pedidos.
- `src/pages/TechnicalSheet.jsx`: ficha tecnica de produtos.
- `src/pages/UserPermissions.jsx`: usuarios e perfis por funcao.

### supabase

- `supabase/config.toml`: configuracao local do Supabase CLI.
- `supabase/functions/fiscal-coupon-import/index.ts`: funcao de importacao NFC-e/SEFAZ.
- `supabase/functions/whatsapp-webhook/index.ts`: funcao webhook WhatsApp.

## Observacoes De Seguranca

- A chave `anon` do Supabase pode ficar no front-end, mas a seguranca real depende das policies RLS.
- Nunca colocar `service_role`, senha FTP, token WhatsApp ou token Supabase dentro do codigo.
- Scripts que pedem senha/token usam o valor apenas durante a execucao.
