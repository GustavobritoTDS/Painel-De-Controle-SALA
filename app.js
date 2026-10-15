// ==========================================
// MÓDULO DE RECONHECIMENTO DE VOZ (Web Speech API)
// Arquivo: voz.js
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
    this.onStatus = onStatus || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onSpeech = onSpeech || (() => {});
    this.onCommand = onCommand || (() => {});

    // Eventos do Reconhecimento
    this.reconhecimento.onstart = () => {
      this.ativo = true;
      this.onStatus("Ouvindo...");
      this.onSpeech(true);
    };

    this.reconhecimento.onend = () => {
      this.ativo = false;
      this.onSpeech(false);
      this.onStatus("Microfone desligado");
    };

    this.reconhecimento.onerror = (evento) => {
      this.ativo = false;
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
      const finais = resultados.filter((resultado) => resultado.isFinal);
      if (!finais.length) return;

      const falaFinal = finais
        .map((resultado) => resultado[0].transcript)
        .join(" ");

      const comando = VozController.identificarComando(falaFinal);

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

    // Auxiliares de busca
    const tem = (...termos) => termos.some((termo) => frase.includes(termo));
    const temPalavra = (termo) => new RegExp(`(?<![a-z])${termo}(?![a-z])`).test(frase);

    const desligar = tem("desligar", "desliga", "desative", "desativar", "parar", "pare", "desabilitar");
    const ligar = tem("ligar", "liga", "ative", "ativar", "habilitar", "iniciar");
    const historico = tem("historico", "historia", "csv", "registros");
    const atualizacao = tem("atualizacao", "atualizacoes", "atualizar automaticamente", "atualizacao automatica");
    const modoAutomatico = tem("automatico", "automatica", "automacao") || (tem("modo") && tem("auto"));

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

    // Dispositivos (usa temPalavra para evitar colisão com "ligar"/"desligar")
    const ar = temPalavra("ar") || tem("condicionado", "climatizacao");
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
    if (this.ativo) return;
    try {
      this.reconhecimento.start();
      this.onStatus("Solicitando microfone...");
    } catch (erro) {
      this.onStatus(`Não foi possível iniciar: ${erro.message}`);
    }
  }

  parar() {
    if (!this.ativo) return;
    try {
      this.reconhecimento.stop();
    } catch (erro) {
      this.onStatus(`Não foi possível parar: ${erro.message}`);
    }
  }
}
