# Segurança e validação

O painel usa Supabase Auth e autorização em `public.profiles`, protegida por RLS.
As chaves publishable do frontend são públicas; nunca adicionar service_role ou segredos ao cliente.

## Correções do relatório de 23/10/2026

- Cadastro público desativado no projeto Supabase; a criação administrativa continua pela função `senai-admin`.
- SDK Supabase fixado em 2.57.0, com SRI SHA-384 e crossorigin.
- CSP aplicada no HTML e nos cabeçalhos Vercel; scripts inline foram movidos para `theme-init.js`.
- Estilos inline continuam permitidos porque o gráfico posiciona tooltips dinamicamente.
- Testes de interface restaurados de Banco-de-dados-; executar `npm ci` e `npm test`.
- Backend, testes administrativos e fotografia das políticas ficam no repositório privado `GustavobritoTDS/Banco-de-dados-`.

Os testes locais usam serviços simulados e não substituem testes autenticados no ambiente publicado.
O cabeçalho frame-ancestors exige Vercel ou configuração equivalente no provedor de hospedagem.
Integração com ESP32/Arduino, acionamento físico e projeto piloto dependem de hardware e não fazem parte destas correções.
