/* BUILD V20.1 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================================================
   TAREFAS DIÁRIAS - CHECKLIST POR USUÁRIO
========================================================= */

const sessao = (() => {
    try {
        return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
    } catch {
        return null;
    }
})();

if (!sessao || !sessao.token) {
    window.location.href = "login.html";
    throw new Error("Sessão não encontrada.");
}

const API = (() => {
    const chave = "controleAvariasServidor";
    const configurado = (() => {
        try {
            const valor = localStorage.getItem(chave);
            if (!valor) return "";
            const u = new URL(valor);
            return /^https?:$/.test(u.protocol) && !/\.github\.io$/i.test(u.hostname) && !/\.pages\.dev$/i.test(u.hostname) ? u.origin : "";
        } catch { return ""; }
    })();
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const porta = window.location.port;
    const origemHttp = (protocolo === "http:" || protocolo === "https:") ? window.location.origin : "";

    // Se o servidor já está sendo executado na porta 3000, usa a própria origem.
    if (origemHttp && porta === "3000") return origemHttp;

    // Em GitHub Pages (ou outro frontend estático), nunca acrescente :3000 ao domínio público.
    // Use o servidor configurado ou, por padrão, o servidor local.
    if (/\.github\.io$/i.test(hostname) || /\.pages\.dev$/i.test(hostname)) {
        return configurado || "http://localhost:3000";
    }

    // Se houver um servidor configurado manualmente, ele tem prioridade.
    if (configurado) return configurado;

    // Frontend servido por outro host/porta: mantém compatibilidade com o servidor local da rede.
    if (origemHttp && hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${protocolo}//${hostname}:3000`;
    }

    return origemHttp || "http://localhost:3000";
})();

const dataMinha = document.getElementById("dataMinha");
const dataTarefa = document.getElementById("dataTarefa");
const dataAdmin = document.getElementById("dataAdmin");
const listaMinhasTarefas = document.getElementById("listaMinhasTarefas");
const tabelaAdminTarefas = document.getElementById("tabelaAdminTarefas");
const painelAdmin = document.getElementById("painelAdmin");
const formTarefa = document.getElementById("formTarefa");
const usuarioTarefa = document.getElementById("usuarioTarefa");
const filtroUsuarioAdmin = document.getElementById("filtroUsuarioAdmin");
const tituloTarefa = document.getElementById("tituloTarefa");
const descricaoTarefa = document.getElementById("descricaoTarefa");
const btnSair = document.getElementById("btnSair");
const toast = document.getElementById("toast");

const resumoPendentes = document.getElementById("resumoPendentes");
const resumoConcluidas = document.getElementById("resumoConcluidas");
const resumoTotal = document.getElementById("resumoTotal");
const resumoProgresso = document.getElementById("resumoProgresso");
const barraProgresso = document.getElementById("barraProgresso");
const textoProgresso = document.getElementById("textoProgresso");
const statusResumoMini = document.getElementById("statusResumoMini");
const adminTotal = document.getElementById("adminTotal");
const adminConcluidas = document.getElementById("adminConcluidas");
const adminPendentes = document.getElementById("adminPendentes");
const adminProgresso = document.getElementById("adminProgresso");
const adminDataResumo = document.getElementById("adminDataResumo");
const buscaAdmin = document.getElementById("buscaAdmin");
const filtroStatusAdmin = document.getElementById("filtroStatusAdmin");
const btnHojeMinha = document.getElementById("btnHojeMinha");
const btnHojeAdmin = document.getElementById("btnHojeAdmin");
const buscaMinhas = document.getElementById("buscaMinhas");
const btnConcluirPendentes = document.getElementById("btnConcluirPendentes");
const filtrosMinha = document.querySelectorAll("[data-filtro-minha]");
const contadorFiltroTodas = document.getElementById("contadorFiltroTodas");
const contadorFiltroPendentes = document.getElementById("contadorFiltroPendentes");
const contadorFiltroConcluidas = document.getElementById("contadorFiltroConcluidas");
const btnCopiarOntem = document.getElementById("btnCopiarOntem");

let minhasTarefas = [];
let tarefasAdmin = [];
let usuarios = [];
let filtroMinha = "todas";
let timerToast;

function hojeLocal() {
    return hojeSistema();
}

function adicionarDias(data, quantidade) {
    const [ano, mes, dia] = String(data || hojeLocal()).slice(0, 10).split("-").map(Number);
    const base = new Date(ano, (mes || 1) - 1, dia || 1);
    base.setDate(base.getDate() + quantidade);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function formatarData(data) {
    if (!data) return "-";
    const [ano, mes, dia] = String(data).slice(0, 10).split("-");
    if (!ano || !mes || !dia) return data;
    return `${dia}/${mes}/${ano}`;
}

function formatarHora(dataHora) {
    return formatarHoraSistema(dataHora);
}

function escapar(texto) {
    return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function headersJson() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessao.token}`
    };
}

async function respostaJson(resposta) {
    let dados = {};
    try { dados = await resposta.json(); } catch {}

    if (resposta.status === 401 || resposta.status === 403) {
        sessionStorage.removeItem("usuarioLogado");
        alert(dados.erro || "Sua sessão expirou. Faça login novamente.");
        window.location.href = "login.html";
        throw new Error(dados.erro || "Sessão inválida.");
    }

    if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível concluir a operação.");
    }

    return dados;
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("ativo");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove("ativo"), 3000);
}

function atualizarResumoComLista(lista) {
    const total = lista.length;
    const concluidas = lista.filter(item => item.concluida).length;
    const pendentes = total - concluidas;
    const progresso = total ? Math.round((concluidas / total) * 100) : 0;

    resumoPendentes.textContent = pendentes;
    resumoConcluidas.textContent = concluidas;
    resumoTotal.textContent = total;
    resumoProgresso.textContent = `${progresso}%`;
    barraProgresso.style.width = `${progresso}%`;
    textoProgresso.textContent = `${concluidas} de ${total} concluídas`;
    if (statusResumoMini) statusResumoMini.textContent = total ? `${progresso}% concluído` : "Nenhuma tarefa";
    if (barraProgresso) barraProgresso.classList.toggle("complete", total > 0 && progresso === 100);

    if (contadorFiltroTodas) contadorFiltroTodas.textContent = total;
    if (contadorFiltroPendentes) contadorFiltroPendentes.textContent = pendentes;
    if (contadorFiltroConcluidas) contadorFiltroConcluidas.textContent = concluidas;
    if (btnConcluirPendentes) btnConcluirPendentes.disabled = pendentes === 0;
}

function atualizarResumo() {
    atualizarResumoComLista(minhasTarefas);
}

function tarefasMinhasVisiveis() {
    const busca = String(buscaMinhas?.value || "").trim().toLowerCase();
    return minhasTarefas.filter(item => {
        if (filtroMinha === "pendentes" && item.concluida) return false;
        if (filtroMinha === "concluidas" && !item.concluida) return false;
        if (!busca) return true;
        return `${item.titulo || ""} ${item.descricao || ""} ${item.criadoPorNome || ""}`.toLowerCase().includes(busca);
    });
}

function renderizarMinhasTarefas() {
    atualizarResumo();
    const lista = tarefasMinhasVisiveis();

    if (!lista.length) {
        const temTarefas = minhasTarefas.length > 0;
        listaMinhasTarefas.innerHTML = `
            <div class="estado-vazio">
                <div class="estado-vazio-icone">${temTarefas ? "🔎" : "✓"}</div>
                <strong>${temTarefas ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa para este dia."}</strong><br>
                <span>${temTarefas ? "Ajuste o filtro ou a pesquisa para visualizar outras atividades." : "Se uma atividade for atribuída a você, ela aparecerá aqui."}</span>
            </div>
        `;
        return;
    }

    listaMinhasTarefas.innerHTML = lista.map(item => `
        <label class="tarefa-item ${item.concluida ? "concluida" : ""}">
            <input
                class="tarefa-check"
                type="checkbox"
                data-id="${escapar(item.id)}"
                aria-label="Marcar ${escapar(item.titulo)} como concluída"
                ${item.concluida ? "checked" : ""}
            >
            <div class="tarefa-texto">
                <div class="tarefa-titulo">${escapar(item.titulo)}</div>
                ${item.descricao ? `<div class="tarefa-descricao">${escapar(item.descricao)}</div>` : ""}
                ${item.criadoPorNome ? `<div class="tarefa-meta">Atribuída por ${escapar(item.criadoPorNome)}</div>` : ""}
            </div>
            ${item.concluida
                ? `<span class="tarefa-hora concluida-hora">✓ Concluída${item.concluidaEm ? ` às ${formatarHora(item.concluidaEm)}` : ""}</span>`
                : `<span class="tarefa-hora pendente-hora">Pendente</span>`}
        </label>
    `).join("");

    listaMinhasTarefas.querySelectorAll(".tarefa-check").forEach(input => {
        input.addEventListener("change", async () => {
            const id = input.dataset.id;
            input.disabled = true;
            try {
                await atualizarTarefa(id, input.checked);
                await carregarMinhasTarefas();
            } catch (erro) {
                input.checked = !input.checked;
                input.disabled = false;
                mostrarToast(erro.message);
            }
        });
    });
}

async function carregarMinhasTarefas() {
    try {
        const data = dataMinha.value || hojeLocal();
        const resposta = await fetch(
            `${API}/api/tarefas/minhas?data=${encodeURIComponent(data)}`,
            { headers: { "Authorization": `Bearer ${sessao.token}` }, cache: "no-store" }
        );
        minhasTarefas = await respostaJson(resposta);
        renderizarMinhasTarefas();
    } catch (erro) {
        console.error(erro);
        listaMinhasTarefas.innerHTML = `<div class="estado-vazio">${escapar(erro.message)}</div>`;
        atualizarResumo();
    }
}

async function atualizarTarefa(id, concluida) {
    const resposta = await fetch(`${API}/api/tarefas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: headersJson(),
        body: JSON.stringify({ concluida })
    });
    return respostaJson(resposta);
}

async function concluirPendentes() {
    const pendentes = minhasTarefas.filter(item => !item.concluida);
    if (!pendentes.length) {
        mostrarToast("Não há tarefas pendentes.");
        return;
    }

    if (!confirm(`Marcar ${pendentes.length} tarefa${pendentes.length === 1 ? "" : "s"} como concluída${pendentes.length === 1 ? "" : "s"}?`)) return;

    btnConcluirPendentes.disabled = true;
    try {
        const resposta = await fetch(`${API}/api/tarefas/minhas/concluir-todas`, {
            method: "PATCH",
            headers: headersJson(),
            body: JSON.stringify({ data: dataMinha.value || hojeLocal() })
        });
        const dados = await respostaJson(resposta);
        mostrarToast(`${dados.quantidade || 0} tarefa${Number(dados.quantidade) === 1 ? " concluída" : "s concluídas"}.`);
        await carregarMinhasTarefas();
    } catch (erro) {
        mostrarToast(erro.message);
        await carregarMinhasTarefas();
    } finally {
        btnConcluirPendentes.disabled = false;
    }
}

async function carregarUsuarios() {
    if (sessao.perfil !== "admin") return;

    try {
        const resposta = await fetch(`${API}/api/tarefas/usuarios`, {
            headers: { "Authorization": `Bearer ${sessao.token}` },
            cache: "no-store"
        });

        usuarios = await respostaJson(resposta);
    } catch (erro) {
        console.error("Erro ao carregar usuários das tarefas:", erro);
        usuarioTarefa.innerHTML = `<option value="">Erro ao carregar usuários</option>`;
        filtroUsuarioAdmin.innerHTML = `<option value="0">Erro ao carregar usuários</option>`;
        mostrarToast(erro.message);
        return;
    }

    const ativos = usuarios.filter(item => item.ativo !== false);

    usuarioTarefa.innerHTML = `
        <option value="">Selecione um usuário...</option>
        <option value="todos">Todos os usuários ativos</option>
        ${ativos.map(item => `<option value="${item.id}">${escapar(item.nome)} (${escapar(item.usuario)})</option>`).join("")}
    `;

    filtroUsuarioAdmin.innerHTML = `
        <option value="0">Todos os usuários</option>
        ${ativos.map(item => `<option value="${item.id}">${escapar(item.nome)}</option>`).join("")}
    `;
}

function tarefasAdminVisiveis() {
    const busca = String(buscaAdmin?.value || "").trim().toLowerCase();
    const status = filtroStatusAdmin?.value || "todos";

    return tarefasAdmin.filter(item => {
        if (status === "pendente" && item.concluida) return false;
        if (status === "concluida" && !item.concluida) return false;
        if (!busca) return true;
        return `${item.usuarioNome || ""} ${item.titulo || ""} ${item.descricao || ""}`.toLowerCase().includes(busca);
    });
}

function atualizarResumoAdmin() {
    if (sessao.perfil !== "admin") return;
    const total = tarefasAdmin.length;
    const concluidas = tarefasAdmin.filter(item => item.concluida).length;
    const pendentes = total - concluidas;
    const progresso = total ? Math.round((concluidas / total) * 100) : 0;

    if (adminTotal) adminTotal.textContent = total;
    if (adminConcluidas) adminConcluidas.textContent = concluidas;
    if (adminPendentes) adminPendentes.textContent = pendentes;
    if (adminProgresso) adminProgresso.textContent = `${progresso}%`;
    if (adminDataResumo) adminDataResumo.textContent = formatarData(dataAdmin.value || hojeLocal());
}

function renderizarAdmin() {
    atualizarResumoAdmin();
    const lista = tarefasAdminVisiveis();

    if (!lista.length) {
        const mensagem = tarefasAdmin.length
            ? "Nenhuma tarefa corresponde aos filtros."
            : "Nenhuma tarefa cadastrada para esta data.";
        tabelaAdminTarefas.innerHTML = `<tr><td colspan="6" class="estado-vazio">${mensagem}</td></tr>`;
        return;
    }

    tabelaAdminTarefas.innerHTML = lista.map(item => `
        <tr>
            <td><strong>${escapar(item.usuarioNome)}</strong></td>
            <td><strong>${escapar(item.titulo)}</strong></td>
            <td>${escapar(item.descricao || "-")}</td>
            <td>
                <span class="status-badge ${item.concluida ? "concluida" : "pendente"}">
                    ${item.concluida ? "✓ Concluída" : "Pendente"}
                </span>
            </td>
            <td class="conclusao-hora">${item.concluida ? formatarHora(item.concluidaEm) : "—"}</td>
            <td>
                <button class="btn-excluir" type="button" data-excluir="${escapar(item.id)}">Excluir</button>
            </td>
        </tr>
    `).join("");

    tabelaAdminTarefas.querySelectorAll("[data-excluir]").forEach(botao => {
        botao.addEventListener("click", async () => {
            const tarefa = tarefasAdmin.find(item => String(item.id) === String(botao.dataset.excluir));
            if (!tarefa) return;

            if (!confirm(`Excluir a tarefa "${tarefa.titulo}" de ${tarefa.usuarioNome}?`)) return;

            botao.disabled = true;
            try {
                const resposta = await fetch(`${API}/api/tarefas/${encodeURIComponent(tarefa.id)}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${sessao.token}` }
                });
                await respostaJson(resposta);
                mostrarToast("Tarefa excluída.");
                await carregarAdminTarefas();
                if (dataMinha.value === dataAdmin.value) await carregarMinhasTarefas();
            } catch (erro) {
                botao.disabled = false;
                mostrarToast(erro.message);
            }
        });
    });
}

async function carregarAdminTarefas() {
    if (sessao.perfil !== "admin") return;

    try {
        const data = dataAdmin.value || hojeLocal();
        const usuarioId = filtroUsuarioAdmin.value || "0";
        const resposta = await fetch(
            `${API}/api/tarefas/admin?data=${encodeURIComponent(data)}&usuarioId=${encodeURIComponent(usuarioId)}`,
            { headers: { "Authorization": `Bearer ${sessao.token}` }, cache: "no-store" }
        );
        tarefasAdmin = await respostaJson(resposta);
        renderizarAdmin();
    } catch (erro) {
        console.error(erro);
        tabelaAdminTarefas.innerHTML = `<tr><td colspan="5" class="estado-vazio">${escapar(erro.message)}</td></tr>`;
    }
}

async function copiarTarefasDeOntem() {
    if (sessao.perfil !== "admin") return;

    const destino = dataAdmin.value || hojeLocal();
    const origem = adicionarDias(destino, -1);
    const usuarioId = filtroUsuarioAdmin.value || "0";
    const nomeFiltro = usuarioId === "0" ? "todos os usuários" : (usuarios.find(item => String(item.id) === String(usuarioId))?.nome || "usuário selecionado");

    if (!confirm(`Copiar as tarefas de ${formatarData(origem)} para ${formatarData(destino)} de ${nomeFiltro}?

Tarefas que já existirem no destino não serão duplicadas.`)) return;

    btnCopiarOntem.disabled = true;
    try {
        const resposta = await fetch(`${API}/api/tarefas/copiar-dia`, {
            method: "POST",
            headers: headersJson(),
            body: JSON.stringify({ origem, destino, usuarioId })
        });
        const dados = await respostaJson(resposta);
        mostrarToast(dados.quantidade
            ? `${dados.quantidade} tarefa${dados.quantidade === 1 ? " copiada" : "s copiadas"}.`
            : "Nenhuma tarefa nova para copiar.");
        await carregarAdminTarefas();
        if (dataMinha.value === destino) await carregarMinhasTarefas();
    } catch (erro) {
        mostrarToast(erro.message);
    } finally {
        btnCopiarOntem.disabled = false;
    }
}

formTarefa.addEventListener("submit", async event => {
    event.preventDefault();

    const botao = document.getElementById("btnAdicionarTarefa");
    botao.disabled = true;

    try {
        const resposta = await fetch(`${API}/api/tarefas`, {
            method: "POST",
            headers: headersJson(),
            body: JSON.stringify({
                usuarioId: usuarioTarefa.value,
                data: dataTarefa.value,
                titulo: tituloTarefa.value,
                descricao: descricaoTarefa.value
            })
        });

        const dados = await respostaJson(resposta);
        mostrarToast(
            dados.quantidade === 1
                ? "Tarefa adicionada ao checklist."
                : `${dados.quantidade} checklists atualizados.`
        );

        tituloTarefa.value = "";
        descricaoTarefa.value = "";
        usuarioTarefa.value = "";
        await carregarAdminTarefas();
        if (dataMinha.value === dataTarefa.value) await carregarMinhasTarefas();
    } catch (erro) {
        mostrarToast(erro.message);
    } finally {
        botao.disabled = false;
    }
});

filtrosMinha.forEach(botao => {
    botao.addEventListener("click", () => {
        filtroMinha = botao.dataset.filtroMinha || "todas";
        filtrosMinha.forEach(item => item.classList.toggle("ativo", item === botao));
        renderizarMinhasTarefas();
    });
});

buscaMinhas?.addEventListener("input", renderizarMinhasTarefas);
btnConcluirPendentes?.addEventListener("click", concluirPendentes);
btnCopiarOntem?.addEventListener("click", copiarTarefasDeOntem);

dataMinha.addEventListener("change", carregarMinhasTarefas);
dataAdmin.addEventListener("change", carregarAdminTarefas);
filtroUsuarioAdmin.addEventListener("change", carregarAdminTarefas);
buscaAdmin?.addEventListener("input", renderizarAdmin);
filtroStatusAdmin?.addEventListener("change", renderizarAdmin);
btnHojeMinha?.addEventListener("click", () => {
    dataMinha.value = hojeLocal();
    carregarMinhasTarefas();
});
btnHojeAdmin?.addEventListener("click", () => {
    dataAdmin.value = hojeLocal();
    dataTarefa.value = hojeLocal();
    carregarAdminTarefas();
});

document.getElementById("btnLimparTarefa").addEventListener("click", () => {
    setTimeout(() => {
        dataTarefa.value = dataAdmin.value || hojeLocal();
    }, 0);
});

btnSair.addEventListener("click", () => {
    if (!confirm("Deseja sair do sistema?")) return;
    fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true
    }).catch(() => {});
    sessionStorage.removeItem("usuarioLogado");
    window.location.href = "login.html";
});

async function iniciar() {
    const hoje = hojeLocal();
    dataMinha.value = hoje;
    dataTarefa.value = hoje;
    dataAdmin.value = hoje;

    if (sessao.perfil === "admin") {
        painelAdmin.classList.remove("oculto");
        await carregarUsuarios();
        await carregarAdminTarefas();
    }

    await carregarMinhasTarefas();

    const eventos = new EventSource(`${API}/api/eventos`);
    eventos.addEventListener("tarefas-atualizadas", async () => {
        await carregarMinhasTarefas();
        if (sessao.perfil === "admin") await carregarAdminTarefas();
    });
}

iniciar();
