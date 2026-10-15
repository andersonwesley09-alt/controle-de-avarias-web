/* BUILD V20.1 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================================================
   MAPEAMENTO - CONTROLE DE AVARIAS
   V13.25 - identificação por linha A-E e coluna local 1-20
========================================================= */

const sessao = sessionStorage.getItem("usuarioLogado");

if (!sessao) {
    window.location.href = "login.html";
}

let usuarioLogado = null;
try {
    usuarioLogado = JSON.parse(sessao || "null");
} catch {
    fetch("/api/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true
    }).catch(() => {});
    sessionStorage.removeItem("usuarioLogado");
    window.location.href = "login.html";
}

const API = (() => {
    const origin = window.location.origin;

    // Quando o sistema é aberto pelo servidor Node, usa o próprio endereço.
    if (
        origin &&
        origin !== "null" &&
        (window.location.protocol === "http:" || window.location.protocol === "https:")
    ) {
        return origin;
    }

    // Fallback para computadores que abriram um HTML localmente.
    return "http://localhost:3000";
})();

const mapa = document.getElementById("mapa");
const modal = document.getElementById("modalEditar");
const nomePosicao = document.getElementById("nomePosicao");
const posicaoEditar = document.getElementById("posicaoEditar");
const usuarioAtualMapa = document.getElementById("usuarioAtualMapa");
const toast = document.getElementById("toast");
const btnSalvarNome = document.getElementById("btnSalvarNome");
const btnLimparNome = document.getElementById("btnLimparNome");
const btnExcluirNome = document.getElementById("btnExcluirNome");
const btnCancelar = document.getElementById("btnCancelar");
const btnFecharModal = document.getElementById("btnFecharModal");
const btnSair = document.getElementById("btnSair");
const pesquisaMapa = document.getElementById("pesquisaMapa");
const btnLimparPesquisa = document.getElementById("btnLimparPesquisa");
const resultadoPesquisa = document.getElementById("resultadoPesquisa");

let posicaoSelecionada = null;
let itensMapa = [];
let timerToast = null;
const ehAdmin = usuarioLogado?.perfil === "admin";

/*
    Quantidade exata de quadrados conforme solicitado:
    linha 1 = 20
    linha 2 = 16
    linha 3 = 16
    linha 4 = 14
    linha 5 = 14

    Os grupos preservam as divisões grossas do desenho:
    L1: 4 | 2 | 6 | 6 | 2
    L2: 2 | 6 | 6 | 2
    L3: 2 | 6 | 6 | 2
    L4: 2 | 6 | 6 (sem quadrados abaixo da SÃO BRAZ)
    L5: 2 | 6 | 6 (sem quadrados abaixo da SÃO BRAZ)
*/
const CONFIG_LINHAS = [
    { linha: 1, quantidade: 20, grupos: [4, 2, 6, 6, 2] },
    { linha: 2, quantidade: 16, grupos: [2, 6, 6, 2] },
    { linha: 3, quantidade: 16, grupos: [2, 6, 6, 2] },
    { linha: 4, quantidade: 14, grupos: [2, 6, 6] },
    { linha: 5, quantidade: 14, grupos: [2, 6, 6] }
];

usuarioAtualMapa.textContent =
    usuarioLogado?.nome
        ? `Usuário: ${usuarioLogado.nome}${ehAdmin ? " • Administrador" : " • Somente leitura"}`
        : "Usuário: -";

function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.add("ativo");
    clearTimeout(timerToast);
    timerToast = setTimeout(() => toast.classList.remove("ativo"), 2600);
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function aplicarPesquisaMapa() {
    const termo = normalizarTexto(pesquisaMapa?.value || "");
    const posicoes = mapa.querySelectorAll(".posicao");
    let encontrados = 0;
    let primeiroEncontrado = null;

    posicoes.forEach(posicao => {
        const nome = normalizarTexto(posicao.dataset.nome || "");
        const corresponde = Boolean(termo) && nome.includes(termo);

        posicao.classList.toggle("busca-encontrada", corresponde);

        if (corresponde) {
            encontrados += 1;
            if (!primeiroEncontrado) primeiroEncontrado = posicao;
        }
    });

    if (resultadoPesquisa) {
        if (!termo) {
            resultadoPesquisa.textContent = "";
        } else if (encontrados === 0) {
            resultadoPesquisa.textContent = "Nenhuma posição encontrada";
        } else {
            resultadoPesquisa.textContent = encontrados === 1
                ? "1 posição encontrada"
                : `${encontrados} posições encontradas`;
        }
    }

    return primeiroEncontrado;
}

function limparPesquisaMapa() {
    if (!pesquisaMapa) return;
    pesquisaMapa.value = "";
    aplicarPesquisaMapa();
    pesquisaMapa.focus();
}

function abrirModal(item) {
    if (!ehAdmin) {
        mostrarToast("Somente o administrador pode editar o mapeamento.");
        return;
    }

    posicaoSelecionada = item;
    posicaoEditar.textContent = `Posição ${rotuloPosicao(item)}`;
    nomePosicao.value = item.nome || "";
    btnExcluirNome.disabled = false;
    modal.classList.remove("oculto");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => nomePosicao.focus(), 50);
}

function fecharModal() {
    posicaoSelecionada = null;
    modal.classList.add("oculto");
    modal.setAttribute("aria-hidden", "true");
}


function ajustarTextosPosicoes() {
    const nomes = mapa.querySelectorAll(".nome-posicao-mapa");

    nomes.forEach(elemento => {
        const texto = elemento.textContent.trim();

        if (!texto || texto === "—") return;

        // Começa com o tamanho normal e reduz somente quando necessário.
        elemento.style.fontSize = "";
        elemento.style.lineHeight = "1.02";

        let tamanho = parseFloat(getComputedStyle(elemento).fontSize) || 11;
        const tamanhoMinimo = 5.5;

        elemento.style.fontSize = `${tamanho}px`;

        // O próprio quadrado continua com exatamente o mesmo tamanho.
        // Só reduzimos a fonte até o texto caber dentro dele.
        let tentativas = 0;
        while (
            (elemento.scrollHeight > elemento.clientHeight + 1 ||
             elemento.scrollWidth > elemento.clientWidth + 1) &&
            tamanho > tamanhoMinimo &&
            tentativas < 30
        ) {
            tamanho -= 0.25;
            elemento.style.fontSize = `${tamanho}px`;
            tentativas += 1;
        }

        // Se ainda for um nome excepcionalmente longo, o usuário pode
        // passar o mouse e ver o nome completo sem alterar o layout.
        elemento.title = texto;
    });
}

function rotuloPosicao(item) {
    const linha = Number(item?.linha || 0);
    const coluna = Number(item?.coluna || 0);

    if (linha >= 1 && linha <= 5 && coluna > 0) {
        // A linha 1 começa na coluna física 1.
        // As linhas 2 a 5 começam na coluna física 6 no desenho,
        // mas a identificação visual reinicia em 1 para cada linha.
        const colunaInicialFisica = linha === 1 ? 1 : 6;
        const colunaVisual = coluna - colunaInicialFisica + 1;

        if (colunaVisual >= 1 && colunaVisual <= 20) {
            const letraLinha = String.fromCharCode(64 + linha);
            return `${letraLinha}${colunaVisual}`;
        }
    }

    return item?.id || "";
}

function criarBotaoPosicao(item) {
    const botao = document.createElement(ehAdmin ? "button" : "div");

    if (ehAdmin) botao.type = "button";

    botao.className = `posicao${item.nome ? "" : " vazia"}${ehAdmin ? " editavel" : " somente-leitura"}`;
    botao.title = ehAdmin
        ? (item.nome ? `Editar: ${item.nome}` : "Adicionar nome")
        : "Somente administrador pode editar";

    botao.dataset.nome = item.nome || "";
    botao.innerHTML = `
        <span class="numero-posicao">${esc(rotuloPosicao(item))}</span>
        <span class="nome-posicao-mapa">${item.nome ? esc(item.nome) : "—"}</span>
        ${ehAdmin ? '<span class="editar-icone">✎</span>' : ""}
    `;

    if (ehAdmin) {
        botao.addEventListener("click", () => abrirModal(item));
    }

    return botao;
}

function criarGrupo(itens, indiceGrupo, quantidade, colunaInicial) {
    const grupo = document.createElement("div");
    grupo.className = `mapa-grupo grupo-${indiceGrupo + 1}`;

    const celulas = document.createElement("div");
    celulas.className = "mapa-grupo-celulas";

    for (let offset = 0; offset < quantidade; offset += 1) {
        const coluna = colunaInicial + offset;
        const id = `r${itens.linha || 0}c${coluna}`;
        const item = itens.lista.find(x => Number(x.coluna) === coluna);

        if (item && item.ativo !== false) {
            celulas.appendChild(criarBotaoPosicao(item));
        } else {
            // Espaço vazio: mantém a geometria da planta sem criar um novo quadrado.
            const vazio = document.createElement("div");
            vazio.className = "posicao-espaco-vazio";
            vazio.setAttribute("aria-hidden", "true");
            celulas.appendChild(vazio);
        }
    }

    grupo.appendChild(celulas);
    return grupo;
}

function criarLinha(config, itens) {
    const linha = document.createElement("div");
    linha.className = `mapa-linha mapa-linha-${config.linha}`;

    if (config.linha > 1) {
        const areaEsquerda = document.createElement("div");
        areaEsquerda.className = "mapa-area-esquerda";
        linha.appendChild(areaEsquerda);
    }

    const contexto = { linha: config.linha, lista: itens };
    let colunaAtual = config.linha === 1 ? 1 : 6;

    config.grupos.forEach((quantidade, indiceGrupo) => {
        linha.appendChild(criarGrupo(contexto, indiceGrupo, quantidade, colunaAtual));
        colunaAtual += quantidade;
    });

    // Nas linhas 4 e 5, a área correspondente aos quadrados abaixo da SÃO BRAZ
    // permanece vazia, exatamente como no desenho físico.
    if (config.linha >= 4) {
        const areaDireita = document.createElement("div");
        areaDireita.className = "mapa-area-direita-vazia";
        linha.appendChild(areaDireita);
    }

    return linha;
}

function renderizarMapa() {
    mapa.innerHTML = "";

    const ordenados = [...itensMapa].sort((a, b) => {
        if (Number(a.linha) !== Number(b.linha)) {
            return Number(a.linha) - Number(b.linha);
        }
        return Number(a.coluna) - Number(b.coluna);
    });

    CONFIG_LINHAS.forEach(config => {
        const itensLinha = ordenados
            .filter(item => Number(item.linha) === config.linha);

        linhaComEspacos(config, itensLinha);
    });

    criarZonasInferiores();

    requestAnimationFrame(() => {
        ajustarTextosPosicoes();
        aplicarPesquisaMapa();
    });
}

function linhaComEspacos(config, itensLinha) {
    mapa.appendChild(criarLinha(config, itensLinha));
}

function criarZonasInferiores() {
    const zonas = document.createElement("div");
    zonas.className = "mapa-zonas";

    const esquerda = document.createElement("div");
    esquerda.className = "mapa-zona-esquerda";
    zonas.appendChild(esquerda);

    const grupo2 = document.createElement("div");
    grupo2.className = "mapa-zona-grupo2";
    zonas.appendChild(grupo2);

    const grupo3 = document.createElement("div");
    grupo3.className = "mapa-zona-grupo3";
    zonas.appendChild(grupo3);

    const grupo4 = document.createElement("div");
    grupo4.className = "mapa-zona-grupo4";

    const acucar = document.createElement("span");
    acucar.textContent = "AÇÚCAR";
    grupo4.appendChild(acucar);

    const limpeza = document.createElement("span");
    limpeza.textContent = "LIMPEZA";
    grupo4.appendChild(limpeza);

    zonas.appendChild(grupo4);

    const direita = document.createElement("div");
    direita.className = "mapa-zona-direita";
    zonas.appendChild(direita);

    mapa.appendChild(zonas);
}

async function carregarMapa() {
    try {
        const resposta = await fetch(`${API}/api/mapeamento`, {
            headers: {
                "Authorization": `Bearer ${usuarioLogado?.token || ""}`
            }
        });

        if (!resposta.ok) throw new Error("Falha ao carregar mapeamento.");

        itensMapa = await resposta.json();
        renderizarMapa();
    } catch (erro) {
        console.error(erro);
        mostrarToast("Não foi possível carregar o mapeamento.");
    }
}

async function excluirQuadrado() {
    if (!posicaoSelecionada || !ehAdmin) return;

    const confirmado = confirm(
        `Deseja excluir o quadrado da posição ${rotuloPosicao(posicaoSelecionada)}?

O quadrado será removido do mapa para todos os PCs.`
    );

    if (!confirmado) return;

    try {
        btnExcluirNome.disabled = true;

        const resposta = await fetch(
            `${API}/api/mapeamento/${encodeURIComponent(posicaoSelecionada.id)}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${usuarioLogado.token || ""}`
                }
            }
        );

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível excluir.");
        }

        itensMapa = itensMapa.filter(x => x.id !== posicaoSelecionada.id);

        renderizarMapa();
        fecharModal();
        mostrarToast("Quadrado excluído do mapa.");
    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message || "Erro ao excluir o quadrado.");
    } finally {
        btnExcluirNome.disabled = false;
    }
}

async function salvarNome() {
    if (!posicaoSelecionada || !ehAdmin) return;

    const nome = nomePosicao.value.trim();

    try {
        btnSalvarNome.disabled = true;

        const resposta = await fetch(
            `${API}/api/mapeamento/${encodeURIComponent(posicaoSelecionada.id)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${usuarioLogado.token || ""}`
                },
                body: JSON.stringify({ nome })
            }
        );

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(dados.erro || "Não foi possível salvar.");
        }

        const item = itensMapa.find(x => x.id === posicaoSelecionada.id);
        if (item) item.nome = dados.nome || "";

        renderizarMapa();
        fecharModal();
        mostrarToast("Nome da posição atualizado.");
    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message || "Erro ao salvar o nome.");
    } finally {
        btnSalvarNome.disabled = false;
    }
}

btnSalvarNome.addEventListener("click", salvarNome);
btnExcluirNome.addEventListener("click", excluirQuadrado);
btnLimparNome.addEventListener("click", () => {
    nomePosicao.value = "";
    nomePosicao.focus();
});
btnCancelar.addEventListener("click", fecharModal);
btnFecharModal.addEventListener("click", fecharModal);

modal.addEventListener("click", event => {
    if (event.target === modal) fecharModal();
});

nomePosicao.addEventListener("keydown", event => {
    if (event.key === "Enter") salvarNome();
    if (event.key === "Escape") fecharModal();
});

pesquisaMapa?.addEventListener("input", aplicarPesquisaMapa);
btnLimparPesquisa?.addEventListener("click", limparPesquisaMapa);

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

/* =========================================================
   TEMPO REAL
========================================================= */

function conectarEventos() {
    try {
        const eventos = new EventSource(`${API}/api/eventos`);

        eventos.addEventListener("mapeamento-atualizado", () => {
            carregarMapa();
        });

        eventos.addEventListener("error", () => {
            // O EventSource tenta reconectar automaticamente.
        });
    } catch (erro) {
        console.error("SSE do mapeamento:", erro);
    }
}

window.addEventListener("resize", () => {
    requestAnimationFrame(ajustarTextosPosicoes);
});

carregarMapa();
conectarEventos();
