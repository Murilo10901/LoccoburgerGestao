# Producao - LoccoBurger Gestao

## Situacao atual

O app esta integrado ao Supabase com login, perfis de usuario, persistencia por usuario e tabelas proprias para os principais modulos.

Agora os dados operacionais sao compartilhados por loja. O administrador cria a loja, recebe um codigo e os demais usuarios entram nessa mesma loja com perfis diferentes.

As telas abertas em dispositivos diferentes atualizam automaticamente a cada poucos segundos. Se uma mesa for aberta em um aparelho, os demais aparelhos da mesma loja devem refletir a alteracao sem precisar sair e entrar novamente.

## Banco de dados

Execute no Supabase SQL Editor:

`database/00-run-all-production.sql`

Esse arquivo cria:

- estado geral de seguranca por usuario;
- loja compartilhada, usuarios e perfis;
- produtos, estoque e ficha tecnica;
- clientes, campanhas e delivery;
- mesas, comandas e cozinha;
- pagamentos, caderneta, contas a receber, despesas e fechamento de caixa;
- politicas RLS para cada usuario ver somente seus proprios dados.
- politicas RLS para cada usuario acessar somente a propria loja.

## Usuarios da loja

1. O primeiro usuario criado sem codigo vira administrador da loja.
2. Na tela `Usuarios`, copie o codigo da loja.
3. Funcionarios podem criar cadastro usando esse codigo.
4. O administrador tambem pode vincular um usuario ja cadastrado pelo e-mail.
5. Perfis disponiveis:
   - Administrador: todas as telas.
   - Atendimento: mesas, delivery, clientes e caixa.
   - Cozinha: somente cozinha.
   - Garcom: somente mesas.

Se dois aparelhos nao sincronizarem, confira primeiro se os usuarios estao vinculados ao mesmo codigo de loja.

## Acesso em celulares, tablets e computadores na mesma rede

Para testar na loja ou na mesma Wi-Fi:

1. Inicie o app com `npm run dev`.
2. Descubra o IP do computador servidor na rede.
3. Em outro aparelho, abra `http://IP-DO-COMPUTADOR:5173`.

O script `npm run dev` ja esta preparado para aceitar conexoes de outros devices da rede.

## Publicacao externa

Para acesso fora da rede local, publique o conteudo gerado pelo build em um provedor como Vercel, Netlify, Hostinger/VPS ou outro servidor web.

Comando de build:

`npm run build`

Pasta publicada:

`dist`

Arquivos ja preparados:

- `vercel.json`: rotas para Vercel.
- `netlify.toml`: build e rotas para Netlify.
- `public/.htaccess`: rotas para Hostinger/Apache.

Variaveis de ambiente necessarias no provedor:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use somente a anon public key no front-end. Nunca use service_role no app.

## Checklist antes de operar

1. SQL completo executado no Supabase.
2. Cadastro/login testado.
3. Produtos, estoque e ficha tecnica salvos.
4. Cliente e pedido delivery criados.
5. Mesa aberta, item lancado e cozinha atualizada.
6. Recebimento no caixa testado.
7. Caderneta gerada e baixada.
8. Fechamento de caixa registrado.
9. Login testado em outro device.

## Novas versoes

1. Ajustar o app localmente.
2. Rodar `npm run build`.
3. Testar.
4. Publicar a nova pasta `dist`.
5. Se houver banco novo, rodar antes a migration SQL correspondente.
