"use strict";

// ==========================================================
// SENAI Smart Class - Autenticação & Persistência Supabase RLS
// ==========================================================

const SENAI_URL = "https://xjmkftxvwsvxjujgaysd.supabase.co";
const SENAI_PUBLIC_KEY = "sb_publishable_maPRcTNjV8cCoC3ldwdlzg_cazswZCH";

let senaiClientInstance = null;

function obterClienteSupabase() {
  if (senaiClientInstance) return senaiClientInstance;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    senaiClientInstance = window.supabase.createClient(SENAI_URL, SENAI_PUBLIC_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return senaiClientInstance;
  }
  return null;
}

async function esperarSupabase(timeoutMs = 6000) {
  const inicio = Date.now();
  let client = obterClienteSupabase();
  while (!client) {
    if (Date.now() - inicio > timeoutMs) {
      throw new Error("Não foi possível carregar o serviço de autenticação. Verifique a conexão com a internet.");
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    client = obterClienteSupabase();
  }
  return client;
}

window.senaiAuth = (() => {
  let profile = null;
  let initialized = false;

  const isAdmin = () => profile?.role === "ADM" && profile?.status === "ATIVO";

  async function getProfile() {
    const client = await esperarSupabase();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      throw new Error("Sessão inválida ou não autenticada.");
    }

    let dadosPerfil = null;
    try {
      const { data, error } = await client
        .from("profiles")
        .select("id,role,status,full_name")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        dadosPerfil = data;
      }
    } catch (err) {
      console.warn("Consulta à tabela 'profiles' não disponível ou restrita via RLS:", err);
    }

    if (dadosPerfil && dadosPerfil.status && dadosPerfil.status !== "ATIVO") {
      throw new Error("Sua conta de acesso está inativa ou bloqueada.");
    }

    const role = (dadosPerfil?.role || user.user_metadata?.role || "ALUNO").toUpperCase();
    const status = dadosPerfil?.status || "ATIVO";
    const nomeCompleto = (dadosPerfil?.full_name || user.user_metadata?.full_name || user.email.split("@")[0]).trim();

    return {
      id: user.id,
      role: role,
      status: status,
      full_name: nomeCompleto,
      email: user.email || "E-mail não disponível"
    };
  }

  async function loadHistory(state, render) {
    if (!isAdmin()) return;

    try {
      const client = await esperarSupabase();
      const { data, error } = await client
        .from("sensor_readings")
        .select("temperature,humidity,luminosity,people,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        state.historico = data.reverse().map((item) => ({
          hora: new Date(item.recorded_at),
          temperatura: Number(item.temperature),
          umidade: Number(item.humidity),
          luminosidade: Number(item.luminosity),
          pessoas: Number(item.people)
        }));

        if (state.historico.length > 0) {
          state.sensores = { ...state.historico[state.historico.length - 1] };
        }
        if (typeof render === "function") render();
      }
    } catch (err) {
      console.warn("Não foi possível carregar o histórico de telemetria remoto:", err);
    }
  }

  async function saveReading(sensores) {
    if (!isAdmin() || !sensores) return;

    try {
      const client = await esperarSupabase();
      const { data: rooms, error: roomError } = await client
        .from("rooms")
        .select("id")
        .eq("name", "Sala SENAI Smart Class")
        .limit(1);

      if (roomError || !rooms?.length) return;

      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      await client.from("sensor_readings").insert({
        room_id: rooms[0].id,
        temperature: sensores.temperatura,
        humidity: sensores.umidade,
        luminosity: sensores.luminosidade,
        people: sensores.pessoas,
        source: "SIMULADO",
        created_by: user.id
      });
    } catch (err) {
      console.warn("Falha ao salvar telemetria remota:", err);
    }
  }

  async function saveEvent(texto) {
    if (!isAdmin() || !texto) return;

    try {
      const client = await esperarSupabase();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;

      await client.from("system_events").insert({
        category: "DASHBOARD",
        description: texto,
        actor_id: user.id
      });
    } catch (err) {
      console.warn("Falha ao salvar evento remoto:", err);
    }
  }

  async function manage(action, attrs = {}) {
    if (!isAdmin()) throw new Error("Acesso restrito a administradores.");
    const client = await esperarSupabase();
    const { data, error } = await client.functions.invoke("senai-admin", {
      body: { action, ...attrs }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function applyRole() {
    if (!profile) return;
    document.body.dataset.senaiRole = profile.role;
    const administrador = isAdmin();
    const tituloConta = administrador ? "Conta de Administrador" : "Conta de Aluno";
    const funcao = administrador ? "Administrador (ADM)" : "Aluno (Leitura)";
    const nome = profile.full_name || profile.email.split("@")[0];

    if (!administrador) {
      // Alunos usam o dashboard em modo de observação local
      for (const id of [
        "btn-baixar", "btn-limpar", "btn-toggle-voz", "btn-voz",
        "btn-desligar-tudo", "modo-auto", "temp-alta", "lux-baixa",
        "auto-refresh", "intervalo"
      ]) {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      }

      const configTab = document.getElementById("aba-btn-config");
      if (configTab) configTab.hidden = true;
    }

    const preencher = (seletor, valor) => {
      const elemento = document.querySelector(seletor);
      if (elemento) elemento.textContent = valor;
    };

    preencher("#aba-btn-conta .conta-rotulo", administrador ? "Conta ADM" : "Conta");
    preencher("#conta-tipo", tituloConta);
    preencher("#conta-nome", nome);
    preencher("#conta-resumo", administrador
      ? "Acesso administrativo com permissão de persistência e controle"
      : "Acesso de aluno com monitoramento em tempo real");
    preencher("#conta-funcao", funcao);
    preencher("#conta-email", profile.email);
    preencher("#conta-permissao", administrador ? "Acesso Total (ADM)" : "Observador (Aluno)");
    preencher("#conta-status", profile.status === "ATIVO" ? "Conta ativa e verificada" : profile.status);
  }

  async function start(init, state, render) {
    const overlay = document.getElementById("senai-login");
    const form = document.getElementById("senai-login-form");
    const statusEl = document.getElementById("senai-status");
    const emailInput = document.getElementById("senai-email");
    const passInput = document.getElementById("senai-password");
    const btnEntrar = document.getElementById("senai-btn-entrar");
    const btnToggleSenha = document.getElementById("btn-toggle-senha");

    // Garante que o overlay de login fique aberto, visível e limpo
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove("fechando");
    }
    if (emailInput) emailInput.value = "";
    if (passInput) passInput.value = "";

    // Força limpeza de qualquer sessão local anterior ao abrir o site
    try {
      for (const chave of Object.keys(localStorage)) {
        if (chave.startsWith("sb-") && chave.includes("-auth-token")) {
          localStorage.removeItem(chave);
        }
      }
      for (const chave of Object.keys(sessionStorage)) {
        if (chave.startsWith("sb-") && chave.includes("-auth-token")) {
          sessionStorage.removeItem(chave);
        }
      }
      esperarSupabase().then((client) => {
        if (client) client.auth.signOut({ scope: "local" }).catch(() => {});
      }).catch(() => {});
    } catch (e) {
      console.warn("Limpeza de sessão prévia:", e);
    }

    // Alternar visibilidade da senha
    if (btnToggleSenha && passInput) {
      btnToggleSenha.addEventListener("click", () => {
        const tipoAtual = passInput.getAttribute("type");
        const novoTipo = tipoAtual === "password" ? "text" : "password";
        passInput.setAttribute("type", novoTipo);
        btnToggleSenha.setAttribute("aria-label", novoTipo === "text" ? "Ocultar senha" : "Exibir senha");
      });
    }

    const avisar = (msg, tipo = "erro") => {
      if (!statusEl) return;
      if (!msg) {
        statusEl.textContent = "";
        statusEl.hidden = true;
        return;
      }
      statusEl.textContent = msg;
      statusEl.dataset.tipo = tipo;
      statusEl.hidden = false;
    };

    const setCarregando = (carregando) => {
      if (!btnEntrar) return;
      btnEntrar.disabled = carregando;
      const spinner = btnEntrar.querySelector(".senai-spinner");
      const texto = btnEntrar.querySelector(".btn-texto");
      if (spinner) spinner.hidden = !carregando;
      if (texto) texto.textContent = carregando ? "Verificando credenciais..." : "Entrar no painel";
    };

    const launch = async () => {
      profile = await getProfile();

      if (!initialized) {
        init();
        initialized = true;
      }

      if (overlay) {
        overlay.classList.add("fechando");
        setTimeout(() => {
          overlay.hidden = true;
          overlay.classList.remove("fechando");
        }, 320);
      }

      applyRole();

      const sair = document.getElementById("btn-sair");
      if (sair) {
        sair.onclick = async () => {
          try {
            const client = await esperarSupabase();
            await client.auth.signOut({ scope: "local" });
          } catch (e) {
            console.warn("Erro ao deslogar:", e);
          }
          location.reload();
        };
      }

      loadHistory(state, render).catch((error) =>
        console.warn("Histórico remoto ignorado:", error)
      );
    };

    // Sempre exige login: foca no e-mail e aguarda envio das credenciais
    avisar("");
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 150);
    }

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        avisar("");

        const email = emailInput?.value?.trim();
        const password = passInput?.value;

        if (!email || !password) {
          avisar("Por favor, preencha o e-mail e a senha de acesso.");
          return;
        }

        setCarregando(true);
        avisar("Autenticando...", "info");

        try {
          const client = await esperarSupabase();
          const { error } = await client.auth.signInWithPassword({ email, password });

          if (error) {
            avisar("E-mail ou senha incorretos. Verifique suas credenciais.");
            setCarregando(false);
            return;
          }

          avisar("Login efetuado com sucesso! Carregando painel...", "sucesso");
          await launch();
        } catch (error) {
          avisar(error.message || "Não foi possível realizar o login. Tente novamente.");
          setCarregando(false);
        }
      });
    }
  }

  return { start, saveReading, saveEvent, loadHistory, manage, isAdmin, getProfile };
})();
