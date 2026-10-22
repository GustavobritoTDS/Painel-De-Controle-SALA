# Fluxo seguro com Antigravity, GitHub e Ollama

## Preparação única

1. Abra o repositório no Antigravity IDE e conecte sua conta do GitHub somente com permissão para criar branches e pull requests.
2. Nas configurações do repositório no GitHub, proteja a branch `main`: exija uma pull request e a verificação **Testes** antes do merge. Desative *force push*.
3. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no IDE, no GitHub Actions ou em um arquivo do projeto. Configure-a apenas no painel/CLI do Supabase durante um deploy manual.

## Para cada melhoria

Crie uma issue com o modelo **Melhoria**. No terminal integrado, execute:

```powershell
.\scripts\nova-branch.ps1 feat/nome-da-melhoria
```

No chat do agente do Antigravity, envie:

```text
Leia AGENTS.md e a issue atual. Implemente somente os critérios de aceite. Trabalhe nesta branch, crie ou ajuste testes, execute .\scripts\verificar.ps1 e revise o git diff. Não faça deploy, merge, push para main, nem use ou exponha segredos. Ao terminar, mostre um resumo, os testes e a sugestão de commit; espere minha confirmação antes de enviar a branch e abrir a PR.
```

Depois de conferir o resumo e o diff, autorize o agente a criar o commit, enviar a branch e abrir a PR. Revise a PR e aguarde a CI verde antes de fazer o merge manualmente no GitHub.

## Revisão local opcional com Ollama

No notebook de 8 GB, prefira um modelo de código pequeno, por exemplo `qwen2.5-coder:3b`. Com o Ollama já instalado e o modelo baixado, após editar rode:

```powershell
python .\scripts\revisar-com-ollama.py qwen2.5-coder:3b
```

O script só envia o `git diff` ao serviço local em `127.0.0.1`; ele não edita arquivos, não faz commit e não chama serviços externos. Use a saída como revisão complementar, nunca como aprovação automática.

## O que fica automático e o que continua humano

- Automático: testes a cada PR e push em `main`; modelo de issue/PR; criação padronizada de branch; revisão local opcional.
- Humano: confirmação do escopo, autorização de commit/push/PR, validação dos checks e merge/deploy.
