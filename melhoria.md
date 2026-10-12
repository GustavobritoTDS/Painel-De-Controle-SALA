# 🏫 Dashboard de Sala — Streamlit

Dashboard feito em **Python + Streamlit** para monitorar uma sala (temperatura, umidade, luminosidade e presença) e controlar o ar-condicionado e a luz. Os dados são **simulados**, e a função `ler_sensores()` está preparada para ser trocada por sensores reais (Arduino/ESP32).

Este repositório documenta duas versões:

- **Projeto antigo:** o primeiro código, com monitoramento e controles manuais.
- **Melhoria do dashboard:** a versão nova, com leitura controlada, modo automático, registro de eventos e visual renovado.

---

## ▶️ Como rodar

```bash
pip install streamlit pandas
streamlit run dashboard.py
```

Depois abra `http://localhost:8501` no navegador.

> **Requisito:** Streamlit **1.37 ou mais novo** (a melhoria usa `st.fragment`).
> Para atualizar: `pip install -U streamlit`

---

## 📌 Projeto antigo

Painel de **monitoramento com controles manuais**.

**Como funciona**

1. A cada clique, o Streamlit roda o script inteiro e `ler_sensores()` sorteia valores novos.
2. Mostra 4 cartões (temperatura, umidade, luminosidade, presença), um alerta de temperatura e 3 abas: gráfico de temperatura, botões de ar e luz, e verificação de pessoas.
3. O `st.session_state` guarda a lista de temperaturas e o estado do ar, da luz e das pessoas.

**Limitações**

- Qualquer clique gera uma leitura falsa, que entra no gráfico.
- Presença duplicada: `presenca` não é usada, `verificar_presenca` faz o trabalho e a métrica aparece duas vezes.
- O histórico cresce sem limite.
- Os valores dão saltos irreais (por exemplo, de 17 °C para 31 °C numa leitura).
- Ar e luz só funcionam por clique, sem relação com os sensores.

---

## 🚀 Melhoria do dashboard

Mantém a estrutura do projeto antigo (cartões, abas, controles de ar e luz) e melhora o **funcionamento** e o **visual**.

### Comparação

| Assunto | Projeto antigo | Melhoria do dashboard |
|---|---|---|
| Quando lê os sensores | A cada clique em qualquer coisa | Só ao pedir ("Atualizar agora") ou no intervalo automático |
| Valores | Sorteio total (saltos grandes) | Variação pequena a partir da leitura anterior |
| Presença | `presenca` sem uso + `verificar_presenca`, métrica duplicada | Só `pessoas` |
| Histórico | Só temperatura, cresce sem limite | Todos os sensores com hora, limitado a 100 leituras |
| Ar e luz | Só manual | Manual ou automático (modo automático) |
| Limites (28 °C, 40%) | Fixos no código | Sliders na barra lateral |
| Alertas | Só temperatura | Temperatura, umidade e ar/luz ligados com a sala vazia |
| Registro | Não existe | Lista de eventos com hora e motivo |
| Atualização | Só quando você interage | Também automática, com `st.fragment` |
| Exportar dados | Não | Baixar CSV e limpar histórico |
| Botões | `if st.button(...)` | `on_click` com funções (`alternar`, `definir`) |
| Visual | Cartões simples | Banner, cartões com emojis, etiquetas de status e eventos estilizados |

### O que mudou no funcionamento

- **Leitura controlada:** os sensores ficam guardados em `st.session_state.sensores` e só mudam quando `atualizar_sensores()` é chamada. Clicar em outros botões não gera leitura falsa.
- **Sensores realistas:** cada leitura parte da anterior com variação pequena, e a função `limitar()` impede valores fora da faixa.
- **Presença unificada:** existe só a variável `pessoas`.
- **Histórico completo:** guarda todos os sensores com a hora, limitado a `LIMITE_HISTORICO` (100), com gráfico por sensor, exportação em CSV e botão de limpar.
- **Modo automático:** `aplicar_automacao()` decide sozinha.
  - **Ar:** liga com gente na sala e temperatura acima do limite. Só desliga 2 °C abaixo (**histerese**, que evita ligar e desligar sem parar).
  - **Luz:** liga com gente na sala e pouca luz. Só desliga 20 pontos acima.
  - **Sala vazia:** desliga os dois.
  - Os botões manuais ficam desativados enquanto o modo está ligado.
- **Registro de eventos:** toda mudança de ar ou luz passa por `definir()`, que só age se o estado realmente mudou e anota hora e motivo (ex.: *"Ar-condicionado ligado (temperatura alta)"*).
- **Configurações na barra lateral:** sliders para os limites de temperatura e luminosidade, e controle da atualização automática, sem editar o código.
- **Atualização automática:** `st.fragment(run_every=...)` redesenha só o painel a cada X segundos, sem recarregar a página inteira.
- **Alertas ampliados:** temperatura alta, ar muito seco, umidade muito alta e ar/luz ligados com a sala vazia.

### O que mudou no visual

- **Banner no topo** com degradê, título e etiquetas (status geral, modo e hora da última leitura).
- **Cartões de métricas** com emojis, número maior e cantos arredondados.
- **Ar e luz** com etiqueta verde (LIGADO) ou cinza (DESLIGADO).
- **Eventos** em faixas com a hora destacada.
- **Gráficos** com cor própria, abas com ícones e botões arredondados.

Todo o CSS fica no bloco `ESTILO`, no começo do `dashboard.py`.

### Organização do código

- Botões com `on_click` e funções, no lugar de `if st.button(...)`, para o estado mudar antes de a tela ser redesenhada.
- Estado inicial em um dicionário (`estado_padrao`) percorrido por um `for`, em vez de vários `if` repetidos.
- Constantes no topo do arquivo (`LIMITE_HISTORICO`, `LIMITE_EVENTOS`, `NOMES`).
- Pequenas correções de texto ("DASHBORD" e "Prenseça").

---

## 🔄 Como a melhoria funciona (passo a passo)

1. **Ao abrir a página**, o código cria o `st.session_state` e faz a primeira leitura.
2. **A cada leitura nova**, `atualizar_sensores()` gera valores a partir da anterior, guarda no histórico (cortando o que passar de 100) e, com o modo automático ligado, chama `aplicar_automacao()`.
3. **Com a atualização automática ligada**, o painel se redesenha sozinho no intervalo escolhido. Um clique em botão não conta como leitura nova.
4. **O painel mostra:** banner, 4 cartões, alertas e 3 abas.
   - **Sensores:** gráfico por sensor, download do CSV e limpar histórico.
   - **Controles:** modo automático, ar, luz e últimos eventos.
   - **Verificação:** número de pessoas e gráfico de presença.

---

## 🧩 Próximos passos

- Trocar `ler_sensores()` por leitura de sensores reais (Arduino/ESP32 via porta serial, MQTT ou API).
- Salvar o histórico em arquivo ou banco de dados (CSV ou SQLite), para não perder os dados ao recarregar a página.
- Dividir o código em arquivos (`sensores.py`, `automacao.py`) e criar um `requirements.txt`.

---

## 📝 Resumo

> O **projeto antigo** mostra os dados e deixa você controlar na mão. A **melhoria do dashboard** também **guarda** o histórico, **decide** sozinha (modo automático) e **registra** o que aconteceu, com uma aparência mais profissional.













