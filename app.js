"use strict";

// ==========================================
// DASHBOARD - SENSORES E COMANDOS DE VOZ
// ==========================================

const $ = (id) => document.getElementById(id);

const LIMITE_HISTORICO = 100;
const LIMITE_EVENTOS = 15;

const NOMES = {
  arLigado: ["Ar-condicionado", "ligado", "desligado"],
  luzLigada: ["Luz", "ligada", "desligada"]
};

const estado = {
  sensores: null,
  historico: [],
  eventos: [],
  arLigado: false,
  luzLigada: false,
  modoAuto: false,
  tempAlta: 28,
  luxBaixa: 40,
  autoRefresh: false,
  intervalo: 5
};

let temporizador = null;
let controleVoz = null;

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function limitar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

function aleatorio(min, max) {
  return min + Math.random() * (max - min);
}

function inteiroAleatorio(min, max) {
  return Math.floor(aleatorio(min, max + 1));
}

function arredondar(valor, casas = 1) {
  return Number(valor.toFixed(casas));
}

function corCss(nome, fallback) {
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nome)
    .trim();
  return valor || fallback;
}

// ==========================================
// SENSORES SIMULADOS
// ==========================================

function lerSensores(anterior = null) {
  if (!anterior) {
    return {
      temperatura: arredondar(aleatorio(20, 30)),
      umidade: inteiroAleatorio(40, 70),
      luminosidade: inteiroAleatorio(30, 80),
      pessoas: inteiroAleatorio(0, 30)
    };
  }

  return {
    temperatura: arredondar(
      limitar(anterior.temperatura + aleatorio(-1, 1), 16, 32)
    ),
    umidade: limitar(
      anterior.umidade + inteiroAleatorio(-3, 3),
      30,
      90
    ),
    luminosidade: limitar(
      anterior.luminosidade + inteiroAleatorio(-8, 8),
      10,
      100
    ),
    pessoas: limitar(
      anterior.pessoas + inteiroAleatorio(-4, 4),
      0,
      40
    )
  };
}

// Atualmente registra comandos simulados.
// A integração com Arduino pode ser adicionada aqui.
function enviarComando(chave, valor) {
  const prefixo = chave === "arLigado" ? "AR" : "LUZ";
  console.log(`[SIMULAÇÃO] ${prefixo}:${valor ? 1 : 0}`);
}

// ==========================================
// EVENTOS E CONTROLES
// ==========================================

function registrarEvento(texto) {
  const hora = new Date().toLocaleTimeString("pt-BR");

  estado.eventos.unshift({ hora, texto });
  estado.eventos.splice(LIMITE_EVENTOS);
}

function definir(chave, valor, motivo) {
  if (estado[chave] === valor) return;

  estado[chave] = valor;

  const [nome, ligado, desligado] = NOMES[chave];

  registrarEvento(
    `${nome} ${valor ? ligado : desligado} (${motivo})`
  );

  enviarComando(chave, valor);
}

function aplicarAutomacao(leitura) {
  const temGente = leitura.pessoas > 0;

  if (!temGente) {
    definir("arLigado", false, "sala vazia");
    definir("luzLigada", false, "sala vazia");
    return;
  }

  // Histerese: evita ligar e desligar sem parar.
  if (leitura.temperatura >= estado.tempAlta) {
    definir("arLigado", true, "temperatura alta");
  } else if (leitura.temperatura <= estado.tempAlta - 2) {
    definir("arLigado", false, "temperatura normal");
  }

  if (leitura.luminosidade <= estado.luxBaixa) {
    definir("luzLigada", true, "pouca luz");
  } else if (
    leitura.luminosidade >= Math.min(estado.luxBaixa + 20, 100)
  ) {
    definir("luzLigada", false, "luz suficiente");
  }
}

function atualizarSensores() {
  estado.sensores = lerSensores(estado.sensores);

  estado.historico.push({
    hora: new Date(),
    ...estado.sensores
  });

  if (estado.historico.length > LIMITE_HISTORICO) {
    estado.historico.shift();
  }

  if (estado.modoAuto) {
    aplicarAutomacao(estado.sensores);
  }
}

function inicializarHistorico(quantidade = 16) {
  const total = limitar(
    Math.trunc(quantidade),
    2,
    LIMITE_HISTORICO
  );
  const agora = Date.now();
  const intervaloMs = Math.max(estado.intervalo, 2) * 1000;

  estado.historico = [];
  let leitura = null;

  for (let indice = 0; indice < total; indice++) {
    leitura = lerSensores(leitura);
    estado.historico.push({
      hora: new Date(
        agora - (total - indice - 1) * intervaloMs
      ),
      ...leitura
    });
  }

  estado.sensores = leitura;

  if (estado.modoAuto && leitura) {
    aplicarAutomacao(leitura);
  }
}

function atualizarAgora() {
  atualizarSensores();
  desenhar();
}

function alternar(chave) {
  definir(chave, !estado[chave], "manual");
  desenhar();
}

function mudarModoAuto(ligado, motivo = "manual") {
  if (estado.modoAuto === ligado) {
    desenhar();
    return;
  }

  estado.modoAuto = ligado;

  registrarEvento(
    `Modo automático ${ligado ? "ligado" : "desligado"} (${motivo})`
  );

  if (ligado && estado.sensores) {
    aplicarAutomacao(estado.sensores);
  }

  desenhar();
}

function mudarAtualizacaoAutomatica(ligado, motivo = "manual") {
  if (estado.autoRefresh !== ligado) {
    estado.autoRefresh = ligado;

    registrarEvento(
      `Atualização automática ${ligado ? "ligada" : "desligada"} (${motivo})`
    );
  }

  const checkbox = $("auto-refresh");
  const intervalo = $("intervalo");

  if (checkbox) checkbox.checked = ligado;
  if (intervalo) intervalo.disabled = !ligado;

  configurarTemporizador();
  desenhar();
}

function desligarTudo() {
  if (estado.modoAuto) {
    mudarModoAuto(false, "desligar tudo");
  }

  definir("arLigado", false, "desligar tudo");
  definir("luzLigada", false, "desligar tudo");

  desenhar();
}

function limparHistorico() {
  // Mantém a leitura mais recente para preservar o estado atual do gráfico.
  estado.historico = estado.historico.slice(-1);

  registrarEvento("Histórico de sensores limpo");
  desenhar();
}

function baixarCsv() {
  const linhas = [
    "hora,temperatura,umidade,luminosidade,pessoas"
  ];

  for (const leitura of estado.historico) {
    linhas.push([
      leitura.hora.toISOString(),
      leitura.temperatura,
      leitura.umidade,
      leitura.luminosidade,
      leitura.pessoas
    ].join(","));
  }

  const blob = new Blob(
    [linhas.join("\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "historico.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  registrarEvento("Histórico baixado em CSV");
  desenhar();
}

function configurarTemporizador() {
  clearInterval(temporizador);
  temporizador = null;

  if (estado.autoRefresh) {
    temporizador = setInterval(
      atualizarAgora,
      estado.intervalo * 1000
    );
  }
}

// ==========================================
// ALERTAS
// ==========================================

function calcularAlertas(sensor) {
  const alertas = [];

  if (sensor.temperatura >= estado.tempAlta) {
    alertas.push("Temperatura muito alta");
  }

  if (sensor.umidade < 40) {
    alertas.push("Ar muito seco");
  }

  if (sensor.umidade > 75) {
    alertas.push("Umidade muito alta");
  }

  if (
    sensor.pessoas === 0 &&
    (estado.arLigado || estado.luzLigada)
  ) {
    alertas.push("Equipamentos ligados com sala vazia");
  }

  return alertas;
}

// ==========================================
// GRÁFICOS
// ==========================================

const geometriaGraficos = new WeakMap();
let redesenhoGraficosPendente = null;

function corComAlpha(cor, alpha) {
  const hex = cor.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    let valor = hex[1];
    if (valor.length === 3) {
      valor = valor.split("").map((parte) => parte + parte).join("");
    }
    const r = parseInt(valor.slice(0, 2), 16);
    const g = parseInt(valor.slice(2, 4), 16);
    const b = parseInt(valor.slice(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  const rgb = cor.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    return "rgba(" + rgb[1] + ", " + rgb[2] + ", " + rgb[3] + ", " + alpha + ")";
  }

  return cor;
}

function pontosBezierCatmull(pontos, tensao = 1) {
  const comandos = [];
  const fator = tensao / 6;

  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[Math.max(i - 1, 0)];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[Math.min(i + 2, pontos.length - 1)];

    const minimoY = Math.min(p1[1], p2[1]);
    const maximoY = Math.max(p1[1], p2[1]);

    comandos.push([
      limitar(
        p1[0] + (p2[0] - p0[0]) * fator,
        p1[0],
        p2[0]
      ),
      limitar(
        p1[1] + (p2[1] - p0[1]) * fator,
        minimoY,
        maximoY
      ),
      limitar(
        p2[0] - (p3[0] - p1[0]) * fator,
        p1[0],
        p2[0]
      ),
      limitar(
        p2[1] - (p3[1] - p1[1]) * fator,
        minimoY,
        maximoY
      ),
      p2[0],
      p2[1]
    ]);
  }

  return comandos;
}

function calcularEscala(valores, amplitudeMinima, somenteInteiros) {
  const menorDado = Math.min(...valores);
  const maiorDado = Math.max(...valores);
  const centro = (menorDado + maiorDado) / 2;
  const amplitude = Math.max(maiorDado - menorDado, amplitudeMinima);

  let minimo = Math.max(0, centro - amplitude / 2);
  let maximo = minimo + amplitude;

  if (maiorDado > maximo) {
    maximo = maiorDado;
    minimo = Math.max(0, maximo - amplitude);
  }

  if (somenteInteiros) {
    minimo = Math.floor(minimo);
    maximo = Math.ceil(maximo);
    if (maximo - minimo < amplitudeMinima) {
      maximo = minimo + amplitudeMinima;
    }
  }

  return { minimo, maximo };
}

function formatarHorario(data, mostrarSegundos = true) {
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: mostrarSegundos ? "2-digit" : undefined
  });
}

function desenharGrafico(canvas, registros, configuracao) {
  const {
    chave,
    cor,
    casas = 0,
    unidade = "",
    amplitudeMinima = 4
  } = configuracao;

  const valores = registros.map((registro) => registro[chave]);
  const horarios = registros.map((registro) => registro.hora);
  const retangulo = canvas.getBoundingClientRect();
  const largura = retangulo.width;
  const altura = retangulo.height;

  if (!largura || !altura || !valores.length) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(largura * dpr));
  canvas.height = Math.max(1, Math.round(altura * dpr));

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  const margem = {
    esquerda: largura < 520 ? 44 : 54,
    direita: 16,
    topo: 24,
    baixo: 34
  };
  const areaLargura = largura - margem.esquerda - margem.direita;
  const areaAltura = altura - margem.topo - margem.baixo;

  if (areaLargura <= 0 || areaAltura <= 0) return;

  const escala = calcularEscala(
    valores,
    amplitudeMinima,
    casas === 0
  );
  const minimo = escala.minimo;
  const maximo = escala.maximo;

  const xPos = (indice) => margem.esquerda +
    (valores.length === 1
      ? areaLargura / 2
      : (indice / (valores.length - 1)) * areaLargura);
  const yPos = (valor) => margem.topo + areaAltura -
    ((valor - minimo) / (maximo - minimo)) * areaAltura;

  const corGrade = corCss("--grade", "rgba(148,163,184,0.16)");
  const corSuave = corCss("--suave", "#64748b");

  ctx.fillStyle = corSuave;
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(unidade.trim(), margem.esquerda, 4);

  const quantidadeGrades = 4;
  ctx.lineWidth = 1;

  for (let i = 0; i <= quantidadeGrades; i++) {
    const valor = minimo + ((maximo - minimo) * i) / quantidadeGrades;
    const py = yPos(valor);

    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = corGrade;
    ctx.beginPath();
    ctx.moveTo(margem.esquerda, py);
    ctx.lineTo(largura - margem.direita, py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = corSuave;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(valor.toFixed(casas), margem.esquerda - 8, py);
  }

  if (horarios.length > 1) {
    const intervaloTotal = horarios[horarios.length - 1] - horarios[0];
    const mostrarSegundos = intervaloTotal < 60 * 60 * 1000;
    const quantidadeRotulos = Math.max(
      2,
      Math.min(5, Math.floor(areaLargura / 115), horarios.length - 1)
    );

    ctx.fillStyle = corSuave;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textBaseline = "top";

    for (let i = 0; i <= quantidadeRotulos; i++) {
      const indice = Math.round(
        (i / quantidadeRotulos) * (horarios.length - 1)
      );
      const px = xPos(indice);
      ctx.textAlign = i === 0
        ? "left"
        : i === quantidadeRotulos
          ? "right"
          : "center";
      ctx.fillText(
        formatarHorario(horarios[indice], mostrarSegundos),
        px,
        margem.topo + areaAltura + 9
      );
    }
  }

  const pontos = valores.map((valor, indice) => [
    xPos(indice),
    yPos(valor)
  ]);

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    margem.esquerda - 8,
    margem.topo - 8,
    areaLargura + 16,
    areaAltura + 16
  );
  ctx.clip();

  if (pontos.length > 1) {
    const comandos = pontosBezierCatmull(pontos);
    const gradienteArea = ctx.createLinearGradient(
      0,
      margem.topo,
      0,
      margem.topo + areaAltura
    );
    gradienteArea.addColorStop(0, corComAlpha(cor, 0.26));
    gradienteArea.addColorStop(0.65, corComAlpha(cor, 0.07));
    gradienteArea.addColorStop(1, corComAlpha(cor, 0));

    ctx.beginPath();
    ctx.moveTo(pontos[0][0], pontos[0][1]);
    comandos.forEach((comando) => {
      ctx.bezierCurveTo(...comando);
    });
    ctx.lineTo(pontos[pontos.length - 1][0], margem.topo + areaAltura);
    ctx.lineTo(pontos[0][0], margem.topo + areaAltura);
    ctx.closePath();
    ctx.fillStyle = gradienteArea;
    ctx.fill();

    const gradienteLinha = ctx.createLinearGradient(
      margem.esquerda,
      0,
      largura - margem.direita,
      0
    );
    gradienteLinha.addColorStop(0, corComAlpha(cor, 0.65));
    gradienteLinha.addColorStop(0.55, cor);
    gradienteLinha.addColorStop(1, cor);

    ctx.beginPath();
    ctx.moveTo(pontos[0][0], pontos[0][1]);
    comandos.forEach((comando) => {
      ctx.bezierCurveTo(...comando);
    });
    ctx.strokeStyle = gradienteLinha;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    const passoMarcador = Math.max(1, Math.ceil(pontos.length / 24));
    pontos.slice(0, -1).forEach((ponto, indice) => {
      if (indice % passoMarcador !== 0) return;
      ctx.beginPath();
      ctx.arc(ponto[0], ponto[1], 2, 0, Math.PI * 2);
      ctx.fillStyle = corComAlpha(cor, 0.72);
      ctx.fill();
    });
  }

  const ultimoPonto = pontos[pontos.length - 1];
  const halo = ctx.createRadialGradient(
    ultimoPonto[0],
    ultimoPonto[1],
    2,
    ultimoPonto[0],
    ultimoPonto[1],
    13
  );
  halo.addColorStop(0, corComAlpha(cor, 0.42));
  halo.addColorStop(1, corComAlpha(cor, 0));

  ctx.beginPath();
  ctx.arc(ultimoPonto[0], ultimoPonto[1], 13, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ultimoPonto[0], ultimoPonto[1], 4.5, 0, Math.PI * 2);
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  geometriaGraficos.set(canvas, {
    pontos,
    valores,
    horarios,
    margem,
    areaLargura,
    casas,
    unidade,
    cor
  });
}

function atualizarKpisGrafico(valores, sensor) {
  if (!valores.length) return;

  const casas = sensor === "temperatura" ? 1 : 0;
  const unidades = {
    temperatura: " °C",
    umidade: " %",
    luminosidade: " %"
  };
  const unidade = unidades[sensor] || "";
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
  const atual = valores[valores.length - 1];
  const anterior = valores.length > 1
    ? valores[valores.length - 2]
    : atual;
  const diferenca = atual - anterior;

  const preencher = (id, texto) => {
    const elemento = $(id);
    if (elemento) elemento.textContent = texto;
  };

  preencher("graf-kpi-atual", atual.toFixed(casas) + unidade);
  preencher("graf-kpi-min", minimo.toFixed(casas) + unidade);
  preencher("graf-kpi-med", media.toFixed(casas) + unidade);
  preencher("graf-kpi-max", maximo.toFixed(casas) + unidade);

  const tendencia = $("graf-kpi-tend-texto");
  const tendenciaPai = $("graf-kpi-tend");

  if (tendencia && tendenciaPai) {
    tendencia.textContent = diferenca > 0.05
      ? "Subindo"
      : diferenca < -0.05
        ? "Caindo"
        : "Estável";
    tendenciaPai.className = "kpi-valor kpi-tendencia " +
      (diferenca > 0.05
        ? "tend-subindo"
        : diferenca < -0.05
          ? "tend-caindo"
          : "tend-estavel");
  }
}

function desenharGraficos() {
  const seletor = $("sensor-grafico");
  const graficoSensor = $("grafico-sensor");
  const graficoPessoas = $("grafico-pessoas");

  if (!seletor || !graficoSensor || !graficoPessoas) return;

  const configuracoes = {
    temperatura: {
      chave: "temperatura",
      cor: corCss("--grafico-1", "#22d3ee"),
      casas: 1,
      unidade: "°C",
      amplitudeMinima: 4
    },
    umidade: {
      chave: "umidade",
      cor: corCss("--grafico-1", "#22d3ee"),
      casas: 0,
      unidade: "%",
      amplitudeMinima: 10
    },
    luminosidade: {
      chave: "luminosidade",
      cor: corCss("--grafico-1", "#22d3ee"),
      casas: 0,
      unidade: "%",
      amplitudeMinima: 10
    }
  };

  const sensor = seletor.value;
  const configuracao = configuracoes[sensor] || configuracoes.temperatura;
  const valoresSensor = estado.historico.map(
    (leitura) => leitura[configuracao.chave]
  );

  desenharGrafico(
    graficoSensor,
    estado.historico,
    configuracao
  );

  desenharGrafico(
    graficoPessoas,
    estado.historico,
    {
      chave: "pessoas",
      cor: corCss("--grafico-2", "#60a5fa"),
      casas: 0,
      unidade: "pessoas",
      amplitudeMinima: 6
    }
  );

  atualizarKpisGrafico(valoresSensor, sensor);

  if (valoresSensor.length) {
    graficoSensor.setAttribute(
      "aria-label",
      "Histórico de " + sensor + ". Atual: " +
        valoresSensor[valoresSensor.length - 1].toFixed(configuracao.casas) +
        configuracao.unidade + "."
    );
  }
}

function configurarTooltipGrafico(canvasId, tooltipId) {
  const canvas = $(canvasId);
  const tooltip = $(tooltipId);

  if (!canvas || !tooltip) return;

  const ocultar = () => {
    tooltip.hidden = true;
  };

  canvas.addEventListener("pointerleave", ocultar);
  canvas.addEventListener("pointercancel", ocultar);
  canvas.addEventListener("pointermove", (evento) => {
    const dados = geometriaGraficos.get(canvas);
    if (!dados || !dados.pontos.length) return;

    const retangulo = canvas.getBoundingClientRect();
    const x = evento.clientX - retangulo.left;
    const proporcao = limitar(
      (x - dados.margem.esquerda) / dados.areaLargura,
      0,
      1
    );
    const indice = Math.round(
      proporcao * (dados.pontos.length - 1)
    );
    const ponto = dados.pontos[indice];
    const horario = dados.horarios[indice];
    const valor = dados.valores[indice];

    const valorEl = document.createElement("strong");
    valorEl.textContent = valor.toFixed(dados.casas) +
      (dados.unidade ? " " + dados.unidade : "");

    const horaEl = document.createElement("span");
    horaEl.textContent = formatarHorario(horario, true);

    tooltip.replaceChildren(valorEl, horaEl);
    tooltip.hidden = false;
    tooltip.style.setProperty("--tooltip-cor", dados.cor);

    const larguraTooltip = tooltip.offsetWidth;
    const wrapper = tooltip.parentElement;
    const espacoTooltip = larguraTooltip + 16;
    const esquerda = wrapper.clientWidth <= espacoTooltip
      ? wrapper.clientWidth / 2
      : limitar(
        ponto[0],
        larguraTooltip / 2 + 8,
        wrapper.clientWidth - larguraTooltip / 2 - 8
      );
    const acima = ponto[1] > 72;

    tooltip.style.left = esquerda + "px";
    tooltip.style.top = ponto[1] + "px";
    tooltip.style.transform = acima
      ? "translate(-50%, calc(-100% - 12px))"
      : "translate(-50%, 12px)";
  });
}

function agendarRedesenhoGraficos() {
  if (redesenhoGraficosPendente !== null) {
    cancelAnimationFrame(redesenhoGraficosPendente);
  }

  redesenhoGraficosPendente = requestAnimationFrame(() => {
    redesenhoGraficosPendente = null;
    desenharGraficos();
  });
}

function configurarGraficos() {
  configurarTooltipGrafico("grafico-sensor", "grafico-tooltip");
  configurarTooltipGrafico(
    "grafico-pessoas",
    "grafico-pessoas-tooltip"
  );

  if ("ResizeObserver" in window) {
    const observador = new ResizeObserver(agendarRedesenhoGraficos);
    document.querySelectorAll(".grafico-canvas-wrapper").forEach(
      (wrapper) => observador.observe(wrapper)
    );
  }
}

// ==========================================
// ATUALIZAÇÃO VISUAL
// ==========================================

function mostrarDelta(id, valor, texto, inverso = false) {
  const elemento = $(id);
  if (!elemento) return;

  if (valor === null) {
    elemento.textContent = "";
    elemento.className = "delta";
    return;
  }

  const bom = inverso ? valor < 0 : valor > 0;

  elemento.textContent =
    `${valor > 0 ? "▲" : valor < 0 ? "▼" : "•"} ${texto}`;

  elemento.className = valor === 0
    ? "delta neutro"
    : `delta ${bom ? "bom" : "ruim"}`;
}

function mostrarPill(id, ligado, textoLigado, textoDesligado) {
  const elemento = $(id);
  if (!elemento) return;

  elemento.className = `pill ${ligado ? "on" : "off"}`;
  elemento.textContent = ligado ? textoLigado : textoDesligado;
}

function desenhar() {
  const s = estado.sensores;
  const hist = estado.historico;

  if (!s || hist.length === 0) return;

  const alertas = calcularAlertas(s);

  const bannerHoraTexto = $("banner-hora-texto");
  if (bannerHoraTexto) {
    bannerHoraTexto.textContent = hist[hist.length - 1].hora.toLocaleTimeString("pt-BR");
  }

  $("m-temp").textContent = `${s.temperatura.toFixed(1)} °C`;
  $("m-umid").textContent = `${s.umidade} %`;
  $("m-lux").textContent = `${s.luminosidade} %`;

  $("m-presenca").textContent =
    s.pessoas > 0 ? "Tem pessoas" : "Não tem";

  const anterior = hist.length > 1
    ? hist[hist.length - 2]
    : null;

  const difTemp = anterior
    ? arredondar(s.temperatura - anterior.temperatura)
    : null;

  mostrarDelta(
    "m-temp-delta",
    difTemp,
    difTemp === null ? "" : `${difTemp.toFixed(1)} °C`,
    true
  );

  $("m-pessoas").textContent = s.pessoas;

  const difPessoas = anterior
    ? s.pessoas - anterior.pessoas
    : null;

  mostrarDelta(
    "m-pessoas-delta",
    difPessoas,
    difPessoas === null ? "" : String(difPessoas)
  );

  // Alertas.
  const caixa = $("alertas");

  if (caixa) {
    caixa.replaceChildren();
    caixa.hidden = alertas.length === 0;

    alertas.forEach((texto) => {
      const div = document.createElement("div");
      div.className = "alerta aviso";
      div.textContent = texto;
      caixa.appendChild(div);
    });
  }

  // Controles.
  const modoAuto = $("modo-auto");
  if (modoAuto) modoAuto.checked = estado.modoAuto;

  const autoRefresh = $("auto-refresh");
  if (autoRefresh) autoRefresh.checked = estado.autoRefresh;

  const intervalo = $("intervalo");
  if (intervalo) intervalo.disabled = !estado.autoRefresh;

  mostrarPill(
    "pill-ar",
    estado.arLigado,
    "LIGADO",
    "DESLIGADO"
  );

  mostrarPill(
    "pill-luz",
    estado.luzLigada,
    "LIGADA",
    "DESLIGADA"
  );

  const btnAr = $("btn-ar");
  const btnLuz = $("btn-luz");

  if (btnAr) btnAr.disabled = estado.modoAuto;
  if (btnLuz) btnLuz.disabled = estado.modoAuto;

  // Registro de eventos.
  const lista = $("lista-eventos");

  if (lista) {
    lista.replaceChildren();

    if (estado.eventos.length === 0) {
      const p = document.createElement("p");
      p.className = "vazio";
      p.textContent = "Nenhum evento ainda.";
      lista.appendChild(p);
    } else {
      estado.eventos.forEach((evento) => {
        const div = document.createElement("div");
        div.className = "evento";

        const b = document.createElement("b");
        b.textContent = evento.hora;

        div.appendChild(b);
        div.appendChild(
          document.createTextNode(` ${evento.texto}`)
        );

        lista.appendChild(div);
      });
    }
  }

  agendarRedesenhoGraficos();
}

function mostrarAba(nome) {
  document.querySelectorAll(".aba-btn").forEach((botao) => {
    const selecionada = botao.dataset.aba === nome;
    botao.classList.toggle("ativa", selecionada);
    botao.setAttribute("aria-selected", String(selecionada));
    botao.tabIndex = selecionada ? 0 : -1;
  });

  document.querySelectorAll(".aba").forEach((secao) => {
    const selecionada = secao.id === `aba-${nome}`;
    secao.classList.toggle("ativa", selecionada);
    secao.hidden = !selecionada;
  });

  agendarRedesenhoGraficos();
}

// ==========================================
// RECONHECIMENTO DE VOZ
// ==========================================

class VozController {
  /**
   * Verifica se o navegador suporta a Web Speech API
   */
  static suportado() {
    return Boolean(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition
    );
  }

  /**
   * @param {Object} callbacks
   * @param {Function} callbacks.onStatus - Mensagens de status (ex: "Ouvindo...", "Erro...")
   * @param {Function} callbacks.onTranscript - Transcrição em tempo real do que está sendo falado
   * @param {Function} callbacks.onSpeech - Dispara true/false se está captando voz
   * @param {Function} callbacks.onCommand - Dispara a chave do comando reconhecido
   */
  constructor({ onStatus, onTranscript, onSpeech, onCommand } = {}) {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      throw new Error("Reconhecimento de voz não suportado neste navegador.");
    }

    this.reconhecimento = new Recognition();
    this.reconhecimento.lang = "pt-BR";
    this.reconhecimento.continuous = false;
    this.reconhecimento.interimResults = true;

    this.ativo = false;
    this.iniciando = false;
    this.preservarStatusNoFim = false;
    this.onStatus = onStatus || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onSpeech = onSpeech || (() => {});
    this.onCommand = onCommand || (() => {});

    // Eventos do Reconhecimento
    this.reconhecimento.onstart = () => {
      this.iniciando = false;
      this.ativo = true;
      this.onStatus("Ouvindo...");
      this.onSpeech(true);
    };

    this.reconhecimento.onend = () => {
      this.iniciando = false;
      this.ativo = false;
      this.onSpeech(false);
      if (!this.preservarStatusNoFim) {
        this.onStatus("Pronto para ouvir");
      } else {
        this.onStatus(null);
      }
    };

    this.reconhecimento.onerror = (evento) => {
      this.iniciando = false;
      this.ativo = false;
      this.preservarStatusNoFim = true;
      this.onSpeech(false);
      this.onStatus(`Erro no microfone: ${evento.error}`);
    };

    this.reconhecimento.onresult = (evento) => {
      const resultados = Array.from(evento.results);

      // Texto captado em tempo real
      const texto = resultados
        .map((resultado) => resultado[0].transcript)
        .join(" ");

      this.onTranscript(texto);

      // Só avalia comandos quando a fala for finalizada
      const inicio = Number.isInteger(evento.resultIndex)
        ? evento.resultIndex
        : 0;
      const finais = resultados
        .slice(inicio)
        .filter((resultado) => resultado.isFinal);
      if (!finais.length) return;

      const falaFinal = finais
        .map((resultado) => resultado[0].transcript)
        .join(" ");

      const comando = VozController.identificarComando(falaFinal);
      this.preservarStatusNoFim = true;

      if (comando) {
        this.onCommand(comando);
        this.onStatus(`Comando recebido: ${falaFinal.trim()}`);
      } else {
        this.onStatus("Comando não reconhecido");
      }
    };
  }

  /**
   * Normaliza o texto e mapeia para identificadores de ação
   */
  static identificarComando(texto) {
    const frase = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9\s]/g, " ")     // Remove pontuações
      .replace(/\s+/g, " ")
      .trim();

    // Compara palavras ou frases completas, evitando falsos positivos por substring.
    const fraseDelimitada = ` ${frase} `;
    const tem = (...termos) => termos.some(
      (termo) => fraseDelimitada.includes(` ${termo} `)
    );

    const desligar = tem(
      "desligar", "desliga", "desligue", "desative", "desativar",
      "apagar", "apaga", "apague", "parar", "pare", "desabilitar"
    );
    const ligar = tem(
      "ligar", "liga", "ligue", "ative", "ativar", "acender",
      "acenda", "acende", "habilitar", "iniciar"
    );
    const historico = tem("historico", "historia", "csv", "registros");
    const atualizacao = tem("atualizacao", "atualizacoes", "atualizar automaticamente", "atualizacao automatica");
    const modoAutomatico = tem("automatico", "automatica", "automacao") || (tem("modo") && tem("auto"));

    // Uma frase negada não deve acionar equipamentos por engano.
    if (tem("nao", "nunca") && (ligar || desligar)) return null;

    // Comandos de histórico
    if (historico && tem("baixar", "baixa", "exportar", "exporte", "download")) {
      return "baixar_historico";
    }

    if (historico && tem("limpar", "limpa", "apagar", "apague", "excluir", "remover")) {
      return "limpar_historico";
    }

    // Comandos de atualização
    if (atualizacao && desligar) return "desligar_atualizacao";
    if (atualizacao && ligar) return "ligar_atualizacao";

    // Modo automático
    if (modoAutomatico && desligar) return "desligar_modo_auto";
    if (modoAutomatico && ligar) return "ligar_modo_auto";

    if (desligar && tem("tudo", "todos", "equipamentos")) {
      return "desligar_tudo";
    }

    // Dispositivos
    const ar = tem("ar", "condicionado", "climatizacao");
    const luz = tem("luz", "luzes", "iluminacao");

    if (desligar && ar) return "desligar_ar";
    if (desligar && luz) return "desligar_luz";
    if (ligar && ar) return "ligar_ar";
    if (ligar && luz) return "ligar_luz";

    // Simulação manual
    if (tem("simular", "simule", "simulacao", "nova deteccao")) {
      return "simular";
    }

    return null;
  }

  iniciar() {
    if (this.ativo || this.iniciando) return;
    this.iniciando = true;
    this.preservarStatusNoFim = false;
    try {
      this.onStatus("Solicitando microfone...");
      this.reconhecimento.start();
    } catch (erro) {
      this.iniciando = false;
      this.preservarStatusNoFim = true;
      this.onStatus(`Não foi possível iniciar: ${erro.message}`);
    }
  }

  parar() {
    if (!this.ativo && !this.iniciando) return;
    try {
      this.reconhecimento.stop();
    } catch (erro) {
      this.onStatus(`Não foi possível parar: ${erro.message}`);
    }
  }
}

// ==========================================
// INTEGRAÇÃO DA VOZ COM O DASHBOARD
// ==========================================

function configurarVoz() {
  const widget = $("voz-widget");
  const botao = $("btn-voz");
  const status = $("voz-status");
  const transcricao = $("voz-texto");
  const botaoTexto = $("btn-voz-texto");
  const icoEstado = $("ico-voz-estado");
  const statusDot = $("voz-status-dot");

  if (!botao || !status || !transcricao) return;

  if (!VozController.suportado()) {
    botao.disabled = true;
    status.textContent = "Voz não suportada neste navegador";
    return;
  }

  controleVoz = new VozController({
    onStatus(mensagem) {
      if (mensagem) status.textContent = mensagem;

      const iniciando = controleVoz.iniciando;
      const ativo = controleVoz.ativo;

      botao.disabled = iniciando;

      // Atualiza texto do botão (sem emojis)
      if (botaoTexto) {
        botaoTexto.textContent = iniciando
          ? "Solicitando..."
          : ativo
            ? "Parar voz"
            : "Iniciar voz";
      }

      // Troca ícone: microfone → stop
      if (icoEstado) {
        icoEstado.querySelector("use").setAttribute(
          "href",
          ativo ? "#i-stop" : "#i-mic"
        );
      }

      // Ponto de status
      if (statusDot) {
        statusDot.className = "voz-status-dot " + (ativo ? "ativo" : "");
      }

      botao.setAttribute("aria-pressed", String(ativo));
    },

    onTranscript(texto) {
      transcricao.textContent = texto;
    },

    onSpeech(falando) {
      if (widget) {
        widget.classList.toggle("falando", falando);
      }
    },

    onCommand(comando) {
      const comandosManuais = [
        "ligar_ar",
        "desligar_ar",
        "ligar_luz",
        "desligar_luz"
      ];

      // Um comando manual interrompe o modo automático.
      if (
        comandosManuais.includes(comando) &&
        estado.modoAuto
      ) {
        mudarModoAuto(false, "comando de voz");
      }

      switch (comando) {
        case "ligar_ar":
          definir("arLigado", true, "comando de voz");
          desenhar();
          break;

        case "desligar_ar":
          definir("arLigado", false, "comando de voz");
          desenhar();
          break;

        case "ligar_luz":
          definir("luzLigada", true, "comando de voz");
          desenhar();
          break;

        case "desligar_luz":
          definir("luzLigada", false, "comando de voz");
          desenhar();
          break;

        case "ligar_modo_auto":
          mudarModoAuto(true, "comando de voz");
          break;

        case "desligar_modo_auto":
          mudarModoAuto(false, "comando de voz");
          break;

        case "ligar_atualizacao":
          mudarAtualizacaoAutomatica(true, "comando de voz");
          break;

        case "desligar_atualizacao":
          mudarAtualizacaoAutomatica(false, "comando de voz");
          break;

        case "desligar_tudo":
          desligarTudo();
          break;

        case "baixar_historico":
          baixarCsv();
          break;

        case "limpar_historico":
          limparHistorico();
          break;

        case "simular":
          atualizarAgora();
          break;
      }
    }
  });

  botao.addEventListener("click", () => {
    if (controleVoz.ativo) {
      controleVoz.parar();
    } else {
      controleVoz.iniciar();
    }
  });

}

function configurarTema() {
  const botao = $("btn-tema");
  const texto = $("tema-texto");

  if (!botao || !texto) return;

  const aplicarRotulo = () => {
    const temaAtual = document.documentElement.dataset.tema;
    const proximoTema = temaAtual === "claro" ? "escuro" : "claro";
    texto.textContent = proximoTema === "claro" ? "Modo claro" : "Modo escuro";
    botao.setAttribute("aria-label", `Ativar ${texto.textContent.toLowerCase()}`);
  };

  const temaInicial = document.documentElement.dataset.tema === "claro"
    ? "claro"
    : "escuro";
  document.documentElement.dataset.tema = temaInicial;
  aplicarRotulo();

  botao.addEventListener("click", () => {
    const novoTema = document.documentElement.dataset.tema === "claro"
      ? "escuro"
      : "claro";

    document.documentElement.dataset.tema = novoTema;
    try {
      localStorage.setItem("tema", novoTema);
    } catch (erro) {
      console.warn("Não foi possível salvar o tema.", erro);
    }

    aplicarRotulo();
    requestAnimationFrame(desenharGraficos);
  });
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

function iniciar() {
  $("temp-alta").addEventListener("input", (evento) => {
    estado.tempAlta = Number(evento.target.value);
    $("temp-alta-valor").textContent = estado.tempAlta;
    if (estado.modoAuto && estado.sensores) {
      aplicarAutomacao(estado.sensores);
    }
    desenhar();
  });

  $("lux-baixa").addEventListener("input", (evento) => {
    estado.luxBaixa = Number(evento.target.value);
    $("lux-baixa-valor").textContent = estado.luxBaixa;
    if (estado.modoAuto && estado.sensores) {
      aplicarAutomacao(estado.sensores);
    }
    desenhar();
  });

  $("auto-refresh").addEventListener("change", (evento) => {
    mudarAtualizacaoAutomatica(evento.target.checked);
  });

  $("intervalo").addEventListener("input", (evento) => {
    estado.intervalo = Number(evento.target.value);
    $("intervalo-valor").textContent = estado.intervalo;
    configurarTemporizador();
  });

  $("btn-atualizar").addEventListener(
    "click",
    atualizarAgora
  );

  $("btn-baixar").addEventListener(
    "click",
    baixarCsv
  );

  $("btn-limpar").addEventListener(
    "click",
    limparHistorico
  );

  $("btn-desligar-tudo").addEventListener(
    "click",
    desligarTudo
  );

  $("btn-ar").addEventListener("click", () => {
    alternar("arLigado");
  });

  $("btn-luz").addEventListener("click", () => {
    alternar("luzLigada");
  });

  $("modo-auto").addEventListener("change", (evento) => {
    mudarModoAuto(evento.target.checked);
  });

  $("sensor-grafico").addEventListener(
    "change",
    desenharGraficos
  );

  // Seletor de sensor em abas/pills (HTML novo)
  const btnsSensorTab = document.querySelectorAll(".btn-sensor-tab");
  btnsSensorTab.forEach((btn) => {
    btn.addEventListener("click", () => {
      btnsSensorTab.forEach((b) => {
        b.classList.remove("ativo");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("ativo");
      btn.setAttribute("aria-pressed", "true");

      const seletor = $("sensor-grafico");
      if (seletor) {
        seletor.value = btn.dataset.sensor;
        seletor.dispatchEvent(new Event("change"));
      }
    });
  });

  const botoesAba = Array.from(document.querySelectorAll(".aba-btn"));

  botoesAba.forEach((botao, indice) => {
    botao.addEventListener("click", () => {
      mostrarAba(botao.dataset.aba);
    });

    botao.addEventListener("keydown", (evento) => {
      const teclas = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
      if (!teclas.includes(evento.key)) return;

      evento.preventDefault();
      let proximoIndice = indice;
      if (evento.key === "Home") proximoIndice = 0;
      else if (evento.key === "End") proximoIndice = botoesAba.length - 1;
      else if (["ArrowDown", "ArrowRight"].includes(evento.key)) {
        proximoIndice = (indice + 1) % botoesAba.length;
      } else {
        proximoIndice = (indice - 1 + botoesAba.length) % botoesAba.length;
      }

      const proximaAba = botoesAba[proximoIndice];
      proximaAba.focus();
      mostrarAba(proximaAba.dataset.aba);
    });
  });

  window.addEventListener("resize", agendarRedesenhoGraficos);

  inicializarHistorico();
  configurarTema();
  configurarGraficos();
  desenhar();
  mostrarAba("sensores");
  configurarVoz();
}

document.addEventListener("DOMContentLoaded", iniciar);
