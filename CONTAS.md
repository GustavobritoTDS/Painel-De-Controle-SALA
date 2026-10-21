# Contas do Smart Class

Entre com uma conta ADM e abra **Conta ADM → Gerenciar contas**.
Preencha nome do usuário, e-mail, perfil e senha inicial. A série aparece
e é obrigatória apenas para alunos. O login continua usando e-mail e senha;
o nome identifica o usuário no painel.

- **ADM:** acesso administrativo, inclusive criação de contas.
- **Aluno:** acompanhamento do painel, com série no perfil.
- **Professor:** acompanhamento do painel, sem série.

O formulário não encerra nem troca a sessão do administrador. O servidor
confere a sessão e o perfil ADM ativo antes de criar qualquer acesso. As
chaves administrativas ficam exclusivamente no Supabase Edge Functions.
As contas criadas ficam prontas para login, sem envio automático de e-mail.

## Integração

O formulário chama a função `senai-admin`, ação `create`, com
`full_name`, `email`, `password`, `role` e `serie`. O tipo da conta é salvo
em `app_metadata.role`, e o trigger `app_private.create_user_profile`
cria a linha em `profiles` na mesma transação da conta Auth. O campo
`user_metadata.role` nunca autoriza acesso administrativo.

O código da função está em `supabase/functions/senai-admin/index.ts`.
O ajuste do trigger está em `supabase/account-profiles.sql`, aplicado
ao projeto existente sem modificar seus usuários.

## Atualizar a cópia local

No terminal da pasta deste projeto, execute `git pull origin main`.
Recarregue o Live Server e entre novamente como ADM.

## Testes

Use Node.js 24 ou superior. Execute `npm ci` e depois `npm test`.
Os testes validam autorização no servidor, campos condicionais, tratamento
de erros e envio dos três tipos de conta. As credenciais dos testes são
fictícias e nenhum teste automatizado cria contas persistentes.
