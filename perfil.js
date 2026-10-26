const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraManaira === "function") return window.formatarDataHoraManaira(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.3 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================================================
   MEU PERFIL
========================================================= */

function obterSessao() {
    try {
        return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
    } catch {
        return null;
    }
}

const sessao = obterSessao();
if (!sessao || !sessao.token) {
    window.location.href = "login.html";
    throw new Error("Sessão não encontrada.");
}

// PERFIL V25.1.20: quando a página é aberta por duplo clique (file://),
// consulta diretamente o servidor central. Quando é aberta pelo servidor,
// permanece no mesmo host. Não depende de endereço antigo salvo no navegador.
function obterApiPerfil() {
    try {
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            return window.location.origin.replace(/\/$/, "");
        }
    } catch (_) {}

    try {
        const configurado = String(window.CA_CONFIGURED_SERVER || "").trim();
        if (configurado) return configurado.replace(/\/$/, "");
    } catch (_) {}

    return "http://10.10.70.163:3000";
}

const API = obterApiPerfil();

const $ = id => document.getElementById(id);
const formPerfil = $("formPerfil");
const formSenha = $("formSenha");
const toast = $("toast");
let toastTimer;

function mostrarToast(mensagem, erro = false) {
    toast.textContent = mensagem;
    toast.className = `toast ativo${erro ? " erro" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("ativo"), 3000);
}

function headers() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessao.token}`
    };
}

async function api(url, options = {}) {
    let resposta;
    try {
        resposta = await fetch(`${API}${url}`, {
            cache: "no-store",
            credentials: "include",
            ...options,
            headers: { ...headers(), ...(options.headers || {}) }
        });
    } catch (erro) {
        throw new Error("Não foi possível conectar ao servidor central. Confirme se o servidor está aberto e se o endereço 10.10.70.163:3000 está acessível.");
    }
    let dados = {};
    try { dados = await resposta.json(); } catch {}
    if (resposta.status === 401 || resposta.status === 403) {
        sessionStorage.removeItem("usuarioLogado");
        window.location.href = "login.html";
        throw new Error(dados.erro || "Sessão expirada.");
    }
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível concluir a operação.");
    return dados;
}

function formatarPerfil(perfil) {
    return String(perfil || "usuario").toLowerCase() === "admin" ? "Administrador" : "Usuário";
}

function formatarData(data) {
    if (!data) return "-";
    const d = new Date(data);
    return Number.isNaN(d.getTime()) ? "-" : formatarDataHoraSistema(d);
}

function preencherPerfil(dados) {
    $("nome").value = dados.nome || "";
    $("usuario").value = dados.usuario || "";
    $("perfil").value = formatarPerfil(dados.perfil);
    $("criadoEm").value = formatarData(dados.criadoEm);
    $("nomeHero").textContent = dados.nome || dados.usuario || "Usuário";
    $("usuarioHero").textContent = `@${dados.usuario || "-"}`;
    $("perfilHero").textContent = formatarPerfil(dados.perfil);
    $("avatarInicial").textContent = String(dados.nome || dados.usuario || "U").trim().charAt(0).toUpperCase();

    const sessaoAtualizada = { ...sessao, nome: dados.nome, usuario: dados.usuario, perfil: dados.perfil };
    sessionStorage.setItem("usuarioLogado", JSON.stringify(sessaoAtualizada));
}

async function carregarPerfil() {
    try {
        const dados = await api("/api/perfil");
        preencherPerfil(dados);
    } catch (erro) {
        mostrarToast(erro.message, true);
    }
}

formPerfil.addEventListener("submit", async event => {
    event.preventDefault();
    const nome = $("nome").value.trim();
    if (!nome) return mostrarToast("Informe o nome.", true);

    const botao = $("btnSalvarPerfil");
    botao.disabled = true;
    botao.textContent = "Salvando...";
    try {
        const dados = await api("/api/perfil", {
            method: "PATCH",
            body: JSON.stringify({ nome })
        });
        preencherPerfil(dados);
        mostrarToast("Perfil atualizado com sucesso.");
    } catch (erro) {
        mostrarToast(erro.message, true);
    } finally {
        botao.disabled = false;
        botao.textContent = "Salvar alterações";
    }
});

formSenha.addEventListener("submit", async event => {
    event.preventDefault();
    const senhaAtual = $("senhaAtual").value;
    const novaSenha = $("novaSenha").value;
    const confirmar = $("confirmarSenha").value;

    if (!senhaAtual || !novaSenha || !confirmar) return mostrarToast("Preencha todos os campos de senha.", true);
    if (novaSenha.length < 6) return mostrarToast("A nova senha precisa ter pelo menos 6 caracteres.", true);
    if (novaSenha !== confirmar) return mostrarToast("A confirmação da nova senha não confere.", true);

    const botao = $("btnAlterarSenha");
    botao.disabled = true;
    botao.textContent = "Alterando...";
    try {
        const dados = await api("/api/perfil", {
            method: "PATCH",
            body: JSON.stringify({
                nome: $("nome").value.trim(),
                senhaAtual,
                novaSenha
            })
        });
        preencherPerfil(dados);
        formSenha.reset();
        mostrarToast("Senha alterada com sucesso.");
    } catch (erro) {
        mostrarToast(erro.message, true);
    } finally {
        botao.disabled = false;
        botao.textContent = "Alterar senha";
    }
});

$("btnSair").addEventListener("click", () => {
    if (!confirm("Deseja sair do sistema?")) return;
    fetch(`${API}/api/logout`, {
        method: "POST",
        credentials: "include",
        keepalive: true
    }).catch(() => {});
    sessionStorage.removeItem("usuarioLogado");
    window.location.href = "login.html";
});

carregarPerfil();
