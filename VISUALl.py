import random
import time
from datetime import datetime

import pandas as pd
import streamlit as st

st.set_page_config(page_title="DASHBOARD TESTE", page_icon="🏫", layout="wide")

# ---------- VISUAL (CSS) ----------
# Só aparência: cores, bordas, espaçamentos. Nenhuma regra do sistema mexe aqui.
ESTILO = """<style>
.block-container {padding-top: 2rem; padding-bottom: 2rem; max-width: 1300px;}
.banner {background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #06b6d4 100%); color: #ffffff; padding: 22px 28px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; box-shadow: 0 6px 20px rgba(37, 99, 235, 0.25);}
.banner .titulo {font-size: 1.9rem; font-weight: 800; letter-spacing: 0.5px;}
.banner .subtitulo {opacity: 0.85; font-size: 0.95rem; margin-top: 2px;}
.banner .pills {display: flex; gap: 8px; flex-wrap: wrap;}
.banner .status {padding: 7px 14px; border-radius: 999px; font-weight: 600; font-size: 0.85rem; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35);}
div[data-testid="stMetricValue"] {font-size: 2rem; font-weight: 700;}
div[data-testid="stMetricLabel"] {opacity: 0.75;}
div[data-testid="stVerticalBlockBorderWrapper"] {border-radius: 14px;}
button[data-baseweb="tab"] {font-weight: 600; font-size: 1rem;}
.stButton > button, .stDownloadButton > button {border-radius: 10px; font-weight: 600;}
.pill {display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 0.85rem; margin-bottom: 10px;}
.pill.on {background: rgba(34, 197, 94, 0.15); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.4);}
.pill.off {background: rgba(148, 163, 184, 0.15); color: #64748b; border: 1px solid rgba(148, 163, 184, 0.4);}
.evento {padding: 8px 12px; border-left: 3px solid #2563eb; background: rgba(37, 99, 235, 0.07); border-radius: 6px; margin-bottom: 6px; font-size: 0.9rem;}
.evento b {color: #2563eb;}
</style>"""
st.markdown(ESTILO, unsafe_allow_html=True)

COR_GRAFICO = "#2563eb"
COR_GRAFICO_PESSOAS = "#06b6d4"

LIMITE_HISTORICO = 100   # leituras guardadas
LIMITE_EVENTOS = 15      # eventos guardados no registro
NOMES = {
    "ar_ligado": ("Ar-condicionado", "ligado", "desligado"),
    "luz_ligada": ("Luz", "ligada", "desligada"),
}

# ---------- barra lateral (configurações) ----------
st.sidebar.header("⚙️ Configurações")
st.sidebar.caption("Ajuste as regras da automação sem mexer no código.")
st.sidebar.slider("Temperatura para ligar o ar (°C)", 20, 32, 28, key="temp_alta")
st.sidebar.slider("Luminosidade para ligar a luz (%)", 10, 80, 40, key="lux_baixa")
st.sidebar.divider()
auto_refresh = st.sidebar.toggle("Atualização automática", key="auto_refresh")
st.sidebar.slider("Intervalo (segundos)", 2, 30, 5, key="intervalo",
                  disabled=not auto_refresh)


# ---------- funções ----------
def limitar(valor, minimo, maximo):
    """Não deixa o valor sair do intervalo [minimo, maximo]."""
    return max(minimo, min(maximo, valor))


def ler_sensores(anterior=None):
    """Simula sensores: cada leitura parte da anterior (variação pequena)."""
    if anterior is None:
        return {
            "temperatura": round(random.uniform(20, 30), 1),
            "umidade": random.randint(40, 70),
            "luminosidade": random.randint(30, 80),
            "pessoas": random.randint(0, 30),
        }
    return {
        "temperatura": round(limitar(anterior["temperatura"] + random.uniform(-1, 1), 16, 32), 1),
        "umidade": limitar(anterior["umidade"] + random.randint(-3, 3), 30, 90),
        "luminosidade": limitar(anterior["luminosidade"] + random.randint(-8, 8), 10, 100),
        "pessoas": limitar(anterior["pessoas"] + random.randint(-4, 4), 0, 40),
    }


def registrar_evento(texto):
    hora = datetime.now().strftime("%H:%M:%S")
    st.session_state.eventos.insert(0, f"{hora} - {texto}")
    del st.session_state.eventos[LIMITE_EVENTOS:]


def definir(chave, valor, motivo):
    """Muda o ar/luz e registra o evento, mas só se o estado realmente mudou."""
    if st.session_state[chave] != valor:
        st.session_state[chave] = valor
        nome, ligado, desligado = NOMES[chave]
        registrar_evento(f"{nome} {ligado if valor else desligado} ({motivo})")


def aplicar_automacao(leitura):
    alta = st.session_state.temp_alta
    baixa = st.session_state.lux_baixa
    tem_gente = leitura["pessoas"] > 0

    # Ar: liga acima do limite, só desliga 2 °C abaixo (evita liga/desliga toda hora)
    if not tem_gente:
        definir("ar_ligado", False, "sala vazia")
    elif leitura["temperatura"] > alta:
        definir("ar_ligado", True, "temperatura alta")
    elif leitura["temperatura"] < alta - 2:
        definir("ar_ligado", False, "temperatura ok")

    # Luz: liga abaixo do limite, só desliga 20 pontos acima
    if not tem_gente:
        definir("luz_ligada", False, "sala vazia")
    elif leitura["luminosidade"] < baixa:
        definir("luz_ligada", True, "pouca luz")
    elif leitura["luminosidade"] > baixa + 20:
        definir("luz_ligada", False, "luz suficiente")


def atualizar_sensores():
    nova = ler_sensores(st.session_state.sensores)
    st.session_state.sensores = nova
    st.session_state.ultima_leitura = time.time()
    st.session_state.historico.append({"hora": datetime.now(), **nova})
    del st.session_state.historico[:-LIMITE_HISTORICO]
    if st.session_state.modo_auto:
        aplicar_automacao(nova)


def alternar(chave):
    definir(chave, not st.session_state[chave], "manual")


def ao_mudar_modo_auto():
    if st.session_state.modo_auto:
        registrar_evento("Modo automático ligado")
        aplicar_automacao(st.session_state.sensores)
    else:
        registrar_evento("Modo automático desligado")


def limpar_historico():
    st.session_state.historico = st.session_state.historico[-1:]  # mantém a última leitura


def pill(ligado, texto_ligado, texto_desligado):
    """Etiqueta colorida de status (só visual)."""
    classe = "on" if ligado else "off"
    texto = f"🟢 {texto_ligado}" if ligado else f"⚫ {texto_desligado}"
    return f'<span class="pill {classe}">{texto}</span>'


# ---------- estado inicial ----------
estado_padrao = {
    "sensores": None,
    "historico": [],
    "eventos": [],
    "ar_ligado": False,
    "luz_ligada": False,
    "modo_auto": False,
    "ultima_leitura": 0.0,
}
for chave, valor in estado_padrao.items():
    if chave not in st.session_state:
        st.session_state[chave] = valor

if st.session_state.sensores is None:
    atualizar_sensores()


# ---------- painel (parte que pode atualizar sozinha) ----------
def painel():
    # No modo automático, só lê sensores se já passou o intervalo.
    # Assim, clicar num botão não gera leitura falsa.
    if st.session_state.auto_refresh:
        passou = time.time() - st.session_state.ultima_leitura
        if passou >= st.session_state.intervalo - 0.5:
            atualizar_sensores()

    s = st.session_state.sensores
    hist = st.session_state.historico
    variacao = round(s["temperatura"] - hist[-2]["temperatura"], 1) if len(hist) > 1 else None

    # alertas (calculados antes porque o banner mostra o resumo)
    alertas = []
    if s["temperatura"] > st.session_state.temp_alta:
        alertas.append("🌡️ Temperatura muito alta")
    if s["umidade"] < 40:
        alertas.append("💧 Ar muito seco")
    if s["umidade"] > 75:
        alertas.append("💧 Umidade muito alta")
    if s["pessoas"] == 0 and (st.session_state.ar_ligado or st.session_state.luz_ligada):
        alertas.append("⚡ Ar ou luz ligados com a sala vazia")

    # banner do topo
    status = f"🟠 {len(alertas)} alerta(s)" if alertas else "🟢 Tudo normal"
    modo = "🤖 Automático" if st.session_state.modo_auto else "🖐️ Manual"
    banner = (
        '<div class="banner"><div>'
        '<div class="titulo">🏫 DASHBOARD TESTE</div>'
        '<div class="subtitulo">Monitoramento da sala • dados simulados</div>'
        '</div><div class="pills">'
        f'<span class="status">{status}</span>'
        f'<span class="status">{modo}</span>'
        f'<span class="status">🕒 {hist[-1]["hora"]:%H:%M:%S}</span>'
        '</div></div>'
    )
    st.markdown(banner, unsafe_allow_html=True)

    # métricas
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        with st.container(border=True):
            st.metric(
                "🌡️ Temperatura",
                f"{s['temperatura']} °C",
                delta=f"{variacao:+} °C" if variacao is not None else None,
                delta_color="inverse",
            )
    with c2:
        with st.container(border=True):
            st.metric("💧 Umidade", f"{s['umidade']} %")
    with c3:
        with st.container(border=True):
            st.metric("💡 Luminosidade", f"{s['luminosidade']} %")
    with c4:
        with st.container(border=True):
            st.metric("👥 Presença", "Tem pessoas" if s["pessoas"] > 0 else "Não tem")

    st.button("🔄 Atualizar agora", on_click=atualizar_sensores)

    # alertas
    if alertas:
        for a in alertas:
            st.warning(a)
    else:
        st.success("Tudo normal")

    # abas
    df = pd.DataFrame(hist).set_index("hora")
    aba1, aba2, aba3 = st.tabs(["📈 Sensores", "🎛️ Controles", "👥 Verificação"])

    with aba1:
        st.subheader("Histórico")
        sensor = st.selectbox("Sensor", ["temperatura", "umidade", "luminosidade"],
                              key="sensor_grafico")
        st.line_chart(df[sensor], color=COR_GRAFICO)
        col_a, col_b = st.columns(2)
        col_a.download_button("⬇️ Baixar histórico (CSV)", df.to_csv().encode("utf-8"),
                              "historico.csv", "text/csv")
        col_b.button("🗑️ Limpar histórico", on_click=limpar_historico)

    with aba2:
        st.subheader("Controles da sala")
        st.toggle("🤖 Modo automático", key="modo_auto", on_change=ao_mudar_modo_auto)
        col_ar, col_luz = st.columns(2)

        with col_ar:
            with st.container(border=True):
                st.markdown("### ❄️ Ar-condicionado")
                st.markdown(pill(st.session_state.ar_ligado, "LIGADO", "DESLIGADO"),
                            unsafe_allow_html=True)
                st.button("Ligar/Desligar ar", on_click=alternar, args=("ar_ligado",),
                          disabled=st.session_state.modo_auto)

        with col_luz:
            with st.container(border=True):
                st.markdown("### 💡 Luz")
                st.markdown(pill(st.session_state.luz_ligada, "LIGADA", "DESLIGADA"),
                            unsafe_allow_html=True)
                st.button("Ligar/Desligar luz", on_click=alternar, args=("luz_ligada",),
                          disabled=st.session_state.modo_auto)

        st.markdown("#### 📋 Últimos eventos")
        if st.session_state.eventos:
            for evento in st.session_state.eventos:
                hora, _, texto = evento.partition(" - ")
                st.markdown(f'<div class="evento"><b>{hora}</b> &nbsp; {texto}</div>',
                            unsafe_allow_html=True)
        else:
            st.caption("Nenhum evento ainda.")

    with aba3:
        st.subheader("Verificação de Pessoas")
        antes = hist[-2]["pessoas"] if len(hist) > 1 else None
        st.metric("👥 Pessoas nesta sala", s["pessoas"],
                  delta=s["pessoas"] - antes if antes is not None else None)
        st.line_chart(df["pessoas"], color=COR_GRAFICO_PESSOAS)


# ---------- executa o painel ----------
# Com run_every, só o painel é redesenhado a cada X segundos (sem recarregar a página toda).
# Com run_every=None, funciona como um painel normal.
intervalo = st.session_state.intervalo if auto_refresh else None
st.fragment(run_every=intervalo)(painel)()
