# SENAI Smart Class

Painel de monitoramento e automação de sala desenvolvido com HTML, CSS e JavaScript, com autenticação e persistência no Supabase.

As leituras de ocupação, DHT11 (temperatura e umidade) e LDR (luminosidade) são **simuladas**. A ocupação representa de 0 a 40 pessoas na sala. Os controles do servo SG90, motor DC do ventilador e LEDs também operam a simulação; ainda não há acionamento de equipamentos físicos.

## Acesso online

- Sistema: https://senai-smart-class-one.vercel.app
- Código do painel: https://github.com/GustavobritoTDS/Painel-De-Controle-SALA
- Backend e scripts SQL: repositório privado `GustavobritoTDS/Banco-de-dados-`.

A Vercel publica automaticamente os commits enviados à branch `main` deste repositório.

## Funcionalidades

- Indicadores, gráficos interativos e histórico de sensores simulados.
- Controles do servo SG90, ventilador DC e LEDs, regras automáticas, exportação de histórico e assistente de voz.
- Temas escuro e claro. O tema claro usa superfícies brancas, texto escuro e acentos roxos.
- Layout para computador, tablet e celular.
- Área de perfil separada do painel da sala.
- Criação, edição, busca e filtros de contas na área administrativa.

## Perfis de acesso

| Perfil | Acesso |
| --- | --- |
| Aluno | Observação do painel e acesso ao próprio perfil. |
| Professor | Operação do painel e persistência de leituras e eventos, sem gestão de contas. |
| Administrador | Operação do painel e gerenciamento de contas. |

As permissões são validadas em `public.profiles` e nas políticas RLS do Supabase. Dados de nome e série não concedem permissões. O cadastro público está desativado; novas contas são criadas por administradores pela função `senai-admin`.

## Executar localmente

1. Clone ou atualize este repositório.
2. Abra a pasta no VS Code e use **Open with Live Server** em `index.html`, ou execute `python -m http.server 5500` e acesse http://localhost:5500.
3. Entre com uma conta cadastrada. O login exige conexão com o Supabase.

Não é necessário instalar dependências para servir o painel. As dependências de desenvolvimento são usadas apenas nos testes.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura, abas, formulário de login e gerenciamento de contas. |
| `visual.css` | Layout, gráficos, temas e responsividade. |
| `senai-auth.css` | Tela de login e área de contas. |
| `app.js` | Sensores simulados, automação, gráficos e voz. |
| `senai-auth.js` | Login, validação de perfil e chamadas ao Supabase. |
| `theme-init.js` | Aplica o tema salvo antes de desenhar a página. |
| `vercel.json` | Cabeçalhos de segurança da publicação. |
| `tests/` | Testes da interface e das proteções do frontend. |

## Validação

Com Node.js 22 ou superior:

```sh
npm ci
npm test
```

Os testes usam serviços simulados e não criam nem alteram contas reais. Os testes da função administrativa ficam junto ao backend no repositório privado.

Consulte [SECURITY.md](SECURITY.md) para detalhes de CSP, integridade do SDK e autorização. Nunca inclua senhas, chaves secretas ou `service_role` no frontend.
