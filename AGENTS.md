# Regras para agentes de desenvolvimento

## Objetivo

Trabalhe em uma tarefa por vez. Toda alteração deve terminar em uma pull request; nunca faça *merge*, *deploy*, alteração de segredos ou de configurações remotas sem autorização humana explícita.

## Fluxo obrigatório

1. Leia a issue/tarefa e os arquivos relacionados antes de alterar código.
2. Atualize `main` e crie uma branch `tipo/resumo-curto` (`feat/`, `fix/`, `chore/` ou `docs/`). Nunca trabalhe diretamente em `main`.
3. Faça a menor alteração que resolve a tarefa. Não reformate arquivos sem necessidade.
4. Execute `npm ci` e `npm test`. Se alterar a função Supabase, mantenha ou crie testes em `tests/admin-accounts.test.mjs`.
5. Revise o diff para conferir que não há senhas, tokens, arquivos `.env`, chaves de serviço ou dados pessoais.
6. Faça um commit descritivo, envie somente a branch e abra uma PR usando o modelo do repositório. Pare para revisão humana.

## Segurança Supabase

- `SUPABASE_SERVICE_ROLE_KEY` só pode existir nos Secrets/variáveis do ambiente da Edge Function; nunca no front-end, em commits, logs ou testes.
- A chave pública/publishable do cliente não substitui as políticas RLS. Não enfraqueça RLS ou a validação da função `senai-admin` para resolver uma tarefa rapidamente.
- Não execute SQL de `supabase/` em produção e não use comandos de deploy sem confirmação explícita.

## Limites

- Não faça `git push` para `main`, `git merge`, `gh pr merge`, `supabase db push` ou `supabase functions deploy`.
- Não altere workflows, dependências ou permissões do GitHub fora da tarefa solicitada.
- Pergunte quando a tarefa exigir uma decisão de produto, uma credencial, ou acesso a dados reais.
