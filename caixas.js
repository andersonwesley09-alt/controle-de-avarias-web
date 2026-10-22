const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraSistema === "function") return window.formatarDataHoraSistema(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.3 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================================================
   PROTEGER PÁGINA
========================================================= */

const sessao =
    sessionStorage.getItem(
        "usuarioLogado"
    );


if (!sessao) {

    window.location.href =
        "login.html";

}

const dadosSessao = JSON.parse(sessao);

function headersAutorizacao() {
    return dadosSessao.token
        ? { "Authorization": `Bearer ${dadosSessao.token}` }
        : {};
}


/* =========================================================
   API
========================================================= */

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


/* =========================================================
   DADOS
========================================================= */

let caixas = [];

let caixaModalAtualId =
    null;

let caixaProdutosModalId =
    null;

let produtosCaixaModal = [];

let produtoModalConsultado = null;
let produtoBuscaTimer = null;
let produtoBuscaAbortController = null;


/* =========================================================
   ELEMENTOS
========================================================= */

const formCaixa =
    document.getElementById(
        "formCaixa"
    );

const nomeCaixa =
    document.getElementById(
        "nomeCaixa"
    );

const localCaixa =
    document.getElementById(
        "localCaixa"
    );

const fornecedorCaixa =
    document.getElementById(
        "fornecedorCaixa"
    );

const fornecedorProdutoCaixa =
    document.getElementById(
        "fornecedorProdutoCaixa"
    );

const caixaProdutoSelecionada =
    document.getElementById(
        "caixaProdutoSelecionada"
    );

const totalCaixas =
    document.getElementById(
        "totalCaixas"
    );

const caixasEmUso =
    document.getElementById(
        "caixasEmUso"
    );

const avariasPendentes =
    document.getElementById(
        "avariasPendentes"
    );

const busca =
    document.getElementById(
        "busca"
    );

const tabelaCaixas =
    document.getElementById(
        "tabelaCaixas"
    );

const btnSair =
    document.getElementById(
        "btnSair"
    );

const toast =
    document.getElementById(
        "toast"
    );


/* =========================================================
   MODAL
========================================================= */

const modalConteudo =
    document.getElementById(
        "modalConteudo"
    );

const tituloModalCaixa =
    document.getElementById(
        "tituloModalCaixa"
    );

const subtituloModalCaixa =
    document.getElementById(
        "subtituloModalCaixa"
    );

const modalTotalRegistros =
    document.getElementById(
        "modalTotalRegistros"
    );

const modalQuantidade =
    document.getElementById(
        "modalQuantidade"
    );

const modalValor =
    document.getElementById(
        "modalValor"
    );

const modalPendentes =
    document.getElementById(
        "modalPendentes"
    );

const tabelaConteudoCaixa =
    document.getElementById(
        "tabelaConteudoCaixa"
    );

const btnFecharModal =
    document.getElementById(
        "btnFecharModal"
    );

const btnFecharModalRodape =
    document.getElementById(
        "btnFecharModalRodape"
    );

const modalProdutos =
    document.getElementById(
        "modalProdutos"
    );

const tituloModalProdutos =
    document.getElementById(
        "tituloModalProdutos"
    );

const subtituloModalProdutos =
    document.getElementById(
        "subtituloModalProdutos"
    );

const produtoBuscaModal =
    document.getElementById(
        "produtoBuscaModal"
    );

const quantidadeProdutoModal =
    document.getElementById(
        "quantidadeProdutoModal"
    );

const motivoProdutoModal =
    document.getElementById(
        "motivoProdutoModal"
    );

const categoriaProdutoModal =
    document.getElementById(
        "categoriaProdutoModal"
    );

const setorProdutoModal =
    document.getElementById(
        "setorProdutoModal"
    );

if (setorProdutoModal) {
    setorProdutoModal.value = "Loja";
}

const btnAdicionarProdutoModal =
    document.getElementById(
        "btnAdicionarProdutoModal"
    );

const produtoPreviewModal =
    document.getElementById(
        "produtoPreviewModal"
    );

const tabelaProdutosCaixa =
    document.getElementById(
        "tabelaProdutosCaixa"
    );

const contadorProdutosModal =
    document.getElementById(
        "contadorProdutosModal"
    );

const btnExcluirProdutosMarcados =
    document.getElementById(
        "btnExcluirProdutosMarcados"
    );

const checkboxTodosProdutos =
    document.getElementById(
        "checkboxTodosProdutos"
    );

const modalProdutosItens =
    document.getElementById(
        "modalProdutosItens"
    );

const modalProdutosQuantidade =
    document.getElementById(
        "modalProdutosQuantidade"
    );

const modalProdutosValor =
    document.getElementById(
        "modalProdutosValor"
    );

let produtosSelecionadosModal = new Set();

const btnFecharModalProdutos =
    document.getElementById(
        "btnFecharModalProdutos"
    );

const btnFecharModalProdutosRodape =
    document.getElementById(
        "btnFecharModalProdutosRodape"
    );


definirBotaoAdicionarProduto(false);


/* =========================================================
   UTILITÁRIOS
========================================================= */

function esc(valor) {

    return String(
        valor ?? ""
    )
    .replace(
        /[&<>"']/g,

        caractere => ({

            "&":
                "&amp;",

            "<":
                "&lt;",

            ">":
                "&gt;",

            '"':
                "&quot;",

            "'":
                "&#39;"

        })[caractere]
    );

}


function numero(valor) {

    const n =
        Number(valor);

    return Number.isFinite(n)
        ? n
        : 0;

}


function moeda(valor) {

    return new Intl.NumberFormat(

        "pt-BR",

        {
            style:
                "currency",

            currency:
                "BRL"
        }

    ).format(
        numero(valor)
    );

}


function formatarQuantidade(valor) {

    const qtd =
        numero(valor);


    if (
        Number.isInteger(qtd)
    ) {

        return String(qtd);

    }


    return qtd.toLocaleString(

        "pt-BR",

        {
            minimumFractionDigits:
                0,

            maximumFractionDigits:
                3
        }

    );

}


function formatarData(valor) {

    if (!valor) {

        return "-";

    }


    const data =
        new Date(valor);


    if (
        Number.isNaN(
            data.getTime()
        )
    ) {

        return "-";

    }


    return formatarDataHoraSistema(data);

}


/* =========================================================
   TOAST
========================================================= */

let timerToast;


function mostrarToast(
    mensagem
) {

    if (!toast) {

        console.log(
            mensagem
        );

        return;

    }


    toast.textContent =
        mensagem;


    toast.classList.add(
        "ativo"
    );


    clearTimeout(
        timerToast
    );


    timerToast =
        setTimeout(

            () => {

                toast.classList.remove(
                    "ativo"
                );

            },

            2500

        );

}


/* =========================================================
   SELEÇÃO DE FORNECEDOR / CAIXA PARA LANÇAMENTO
========================================================= */

function normalizarFornecedor(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function caixaSelecionadaParaProduto() {
    if (!caixaProdutosModalId) return null;
    return caixas.find(
        caixa => String(caixa.id) === String(caixaProdutosModalId)
    ) || null;
}

function fornecedorDoProdutoCompativel(produto) {
    const caixa = caixaSelecionadaParaProduto();
    if (!caixa || !caixa.responsavel || !produto) return false;
    return normalizarFornecedor(caixa.responsavel) === normalizarFornecedor(produto.fornecedor);
}

function limparDestinoProduto() {
    caixaProdutosModalId = null;

    if (fornecedorProdutoCaixa) {
        fornecedorProdutoCaixa.innerHTML = '<option value="">Aguardando EAN...</option>';
        fornecedorProdutoCaixa.value = "";
        fornecedorProdutoCaixa.disabled = true;
    }

    if (caixaProdutoSelecionada) {
        caixaProdutoSelecionada.innerHTML = '<option value="">Aguardando identificação do produto...</option>';
        caixaProdutoSelecionada.value = "";
        caixaProdutoSelecionada.disabled = true;
    }
}

function configurarDestinoPeloProduto(produto) {
    const fornecedorProduto = String(produto?.fornecedor || "").trim();

    caixaProdutosModalId = null;

    if (!fornecedorProduto) {
        limparDestinoProduto();
        mostrarStatusProdutoModal(
            "erro",
            "✕ Este produto não possui fornecedor cadastrado. O lançamento foi bloqueado."
        );
        return { ok: false, caixas: [] };
    }

    const caixasFornecedor = caixas.filter(caixa =>
        normalizarFornecedor(caixa.responsavel) === normalizarFornecedor(fornecedorProduto)
    );

    if (fornecedorProdutoCaixa) {
        fornecedorProdutoCaixa.innerHTML = `<option value="${esc(fornecedorProduto)}">${esc(fornecedorProduto)}</option>`;
        fornecedorProdutoCaixa.value = fornecedorProduto;
        fornecedorProdutoCaixa.disabled = true;
    }

    if (!caixasFornecedor.length) {
        if (caixaProdutoSelecionada) {
            caixaProdutoSelecionada.innerHTML = '<option value="">Nenhuma caixa cadastrada para este fornecedor.</option>';
            caixaProdutoSelecionada.value = "";
            caixaProdutoSelecionada.disabled = true;
        }
        mostrarStatusProdutoModal(
            "erro",
            `✕ Nenhuma caixa cadastrada para o fornecedor "${fornecedorProduto}". Cadastre a caixa desse fornecedor antes de lançar o produto.`
        );
        return { ok: false, caixas: [] };
    }

    if (caixaProdutoSelecionada) {
        caixaProdutoSelecionada.innerHTML = `
            <option value="">Selecione a caixa...</option>
            ${caixasFornecedor.map(caixa => `
                <option value="${esc(caixa.id)}">
                    ${esc(caixa.numero)}${caixa.local ? ` — ${esc(caixa.local)}` : ""}
                </option>
            `).join("")}
        `;
    }

    if (caixasFornecedor.length === 1) {
        const caixa = caixasFornecedor[0];
        caixaProdutosModalId = String(caixa.id);
        if (caixaProdutoSelecionada) {
            caixaProdutoSelecionada.value = String(caixa.id);
            caixaProdutoSelecionada.disabled = true;
        }
        return { ok: true, caixas: caixasFornecedor, caixa };
    }

    if (caixaProdutoSelecionada) {
        caixaProdutoSelecionada.disabled = false;
    }

    return { ok: false, caixas: caixasFornecedor, multiplas: true };
}

function atualizarOpcoesFornecedorProduto() {
    // O fornecedor agora é identificado automaticamente pelo EAN.
    limparDestinoProduto();
}

function atualizarOpcoesCaixaProduto() {
    // Mantido apenas para compatibilidade com versões anteriores.
    if (!produtoModalConsultado) return;
    configurarDestinoPeloProduto(produtoModalConsultado);
}

function selecionarCaixaParaProduto(id) {
    const idSelecionado = String(id || "").trim();
    caixaProdutosModalId = idSelecionado || null;

    if (produtoModalConsultado && caixaProdutosModalId) {
        const caixa = caixaSelecionadaParaProduto();
        const fornecedorOk = caixa && fornecedorDoProdutoCompativel(produtoModalConsultado);
        if (!fornecedorOk) {
            caixaProdutosModalId = null;
            mostrarStatusProdutoModal(
                "erro",
                "✕ A caixa selecionada não pertence ao fornecedor identificado pelo produto."
            );
            definirBotaoAdicionarProduto(false);
            return;
        }
        atualizarPreviewProdutoModal(produtoModalConsultado);
        atualizarEstadoFormularioLancamento();
        quantidadeProdutoModal?.focus();
        quantidadeProdutoModal?.select();
    }
}

/* =========================================================
   BUSCAR CAIXAS NO POSTGRESQL
========================================================= */

async function carregarCaixas() {

    try {

        const resposta =
            await fetch(
                `${API}/api/caixas`
            );


        if (!resposta.ok) {

            throw new Error(
                "Erro ao carregar caixas."
            );

        }


        caixas =
            await resposta.json();


        atualizarResumo();
        atualizarOpcoesFornecedorProduto();

        renderizarCaixas();


    } catch (erro) {

        console.error(
            "Erro ao carregar caixas:",
            erro
        );


        mostrarToast(
            "Não foi possível carregar as caixas."
        );


        tabelaCaixas.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="vazio"
                >
                    Erro ao carregar caixas.
                </td>

            </tr>

        `;

    }

}


/* =========================================================
   RESUMO
========================================================= */

function atualizarResumo() {

    const total =
        caixas.length;


    const emUso =
        caixas.filter(

            caixa =>
                numero(
                    caixa.avariasPendentes
                ) > 0

        ).length;


    const pendentes =
        caixas.reduce(

            (total, caixa) =>

                total +
                numero(
                    caixa.avariasPendentes
                ),

            0

        );


    totalCaixas.textContent =
        total;


    caixasEmUso.textContent =
        emUso;


    avariasPendentes.textContent =
        pendentes;

}


/* =========================================================
   FILTRO
========================================================= */

function obterCaixasFiltradas() {

    const termo =
        busca.value
            .trim()
            .toLowerCase();


    if (!termo) {

        return caixas;

    }


    return caixas.filter(

        caixa => {

            const texto =
                [
                    caixa.numero,
                    caixa.local,
                    caixa.responsavel
                ]
                .join(" ")
                .toLowerCase();


            return texto.includes(
                termo
            );

        }

    );

}


/* =========================================================
   RENDERIZAR CAIXAS
========================================================= */

function renderizarCaixas() {

    const lista =
        obterCaixasFiltradas();


    if (!lista.length) {

        tabelaCaixas.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="vazio"
                >
                    Nenhuma caixa encontrada.
                </td>

            </tr>

        `;

        return;

    }


    tabelaCaixas.innerHTML =

        lista.map(

            caixa => {

                const quantidadeItens =
                    numero(
                        caixa.quantidadeItens
                    );


                const valorItens =
                    numero(
                        caixa.valorItens
                    );


                return `

                    <tr>

                        <td class="caixa-nome">
                            ${esc(
                                caixa.numero
                            )}
                        </td>


                        <td>
                            ${esc(
                                caixa.local || "-"
                            )}
                        </td>


                        <td>
                            ${esc(
                                caixa.responsavel || "-"
                            )}
                        </td>


                        <td class="numero-centro">
                            ${formatarQuantidade(
                                quantidadeItens
                            )}
                        </td>


                        <td class="valor-caixa">
                            ${moeda(
                                valorItens
                            )}
                        </td>


                        <td>

                            <div class="acoes-linha">




                                <button
                                    type="button"
                                    class="btn-conteudo"
                                    data-acao="conteudo"
                                    data-id="${esc(caixa.id)}"
                                >
                                    Ver conteúdo
                                </button>


                                <button
                                    type="button"
                                    class="btn-excluir"
                                    data-acao="excluir"
                                    data-id="${esc(caixa.id)}"
                                >
                                    Excluir
                                </button>

                            </div>

                        </td>

                    </tr>

                `;

            }

        )
        .join("");


    tabelaCaixas
        .querySelectorAll(
            '[data-acao="conteudo"]'
        )
        .forEach(

            botao => {

                botao.addEventListener(

                    "click",

                    () =>
                        abrirCaixa(
                            botao.dataset.id
                        )

                );

            }

        );


    tabelaCaixas
        .querySelectorAll(
            '[data-acao="excluir"]'
        )
        .forEach(

            botao => {

                botao.addEventListener(

                    "click",

                    () =>
                        excluirCaixa(
                            botao.dataset.id
                        )

                );

            }

        );

}


/* =========================================================
   CADASTRAR CAIXA
========================================================= */

formCaixa.addEventListener(

    "submit",

    async function(event) {

        event.preventDefault();

        const numeroCaixa = nomeCaixa.value.trim();
        const local = localCaixa.value.trim();
        const responsavel = fornecedorCaixa.value.trim();

        if (!numeroCaixa) {
            mostrarToast("Informe o nome da caixa.");
            nomeCaixa.focus();
            return;
        }

        try {
            const resposta = await fetch(
                `${API}/api/caixas`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...headersAutorizacao()
                    },
                    body: JSON.stringify({
                        numero: numeroCaixa,
                        local,
                        responsavel
                    })
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(
                    dados.erro || "Erro ao cadastrar caixa."
                );
            }

            formCaixa.reset();

            mostrarToast(
                "Caixa cadastrada com sucesso. Abra a caixa na lista para adicionar os produtos."
            );

            await carregarCaixas();
            nomeCaixa.focus();

        } catch (erro) {
            console.error(erro);
            mostrarToast(erro.message);
        }

    }

);

/* =========================================================
   CONSULTAR CONTEÚDO DA CAIXA
========================================================= */

async function carregarProdutosCaixa(id) {
    const resposta = await fetch(
        `${API}/api/caixas/${encodeURIComponent(id)}/produtos`
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
        throw new Error(
            dados.erro || "Erro ao carregar os produtos da caixa."
        );
    }

    produtosCaixaModal = dados.itens || [];
    atualizarContadorProdutosModal();
    return dados;
}


function atualizarResumoProdutosModal() {
    if (!modalProdutosItens || !modalProdutosQuantidade || !modalProdutosValor) return;

    const quantidadeItens = produtosCaixaModal.length;
    const quantidadeTotal = produtosCaixaModal.reduce(
        (total, item) => total + numero(item.quantidade),
        0
    );
    const valorTotal = produtosCaixaModal.reduce(
        (total, item) => total + numero(item.quantidade) * numero(item.valorUnitario),
        0
    );

    modalProdutosItens.textContent = String(quantidadeItens);
    modalProdutosQuantidade.textContent = formatarQuantidade(quantidadeTotal);
    modalProdutosValor.textContent = moeda(valorTotal);
}

function atualizarContadorProdutosModal() {
    if (!contadorProdutosModal) return;

    const total = produtosCaixaModal.length;
    contadorProdutosModal.textContent =
        `${total} ${total === 1 ? "item" : "itens"}`;

    atualizarResumoProdutosModal();
    atualizarControlesSelecaoProdutos();
}

function obterIdsProdutosSelecionados() {
    return [...produtosSelecionadosModal].filter(id =>
        produtosCaixaModal.some(item => String(item.id) === String(id))
    );
}

function atualizarControlesSelecaoProdutos() {
    const ids = obterIdsProdutosSelecionados();
    const total = produtosCaixaModal.length;

    if (btnExcluirProdutosMarcados) {
        btnExcluirProdutosMarcados.disabled = ids.length === 0;
        btnExcluirProdutosMarcados.textContent = `Excluir marcados (${ids.length})`;
    }

    if (checkboxTodosProdutos) {
        checkboxTodosProdutos.checked = total > 0 && ids.length === total;
        checkboxTodosProdutos.indeterminate = ids.length > 0 && ids.length < total;
    }
}

function renderizarProdutosCaixaModal() {
    atualizarContadorProdutosModal();

    if (!produtosCaixaModal.length) {
        tabelaProdutosCaixa.innerHTML = `
            <tr>
                <td colspan="11" class="vazio">Nenhum produto cadastrado nesta caixa.</td>
            </tr>
        `;
        return;
    }

    tabelaProdutosCaixa.innerHTML = produtosCaixaModal.map(item => {
        const id = String(item.id);
        const marcado = produtosSelecionadosModal.has(id) ? "checked" : "";
        const valorTotal = numero(item.quantidade) * numero(item.valorUnitario);
        return `
            <tr>
                <td class="col-selecao">
                    <input
                        type="checkbox"
                        class="checkbox-produto-caixa"
                        data-produto-id="${esc(id)}"
                        ${marcado}
                        aria-label="Selecionar ${esc(item.produto)}"
                    >
                </td>
                <td class="codigo-produto">${esc(item.codigo)}</td>
                <td class="produto-conteudo">${esc(item.produto)}</td>
                <td>${esc(item.categoria || "Mercearia")}</td>
                <td>${esc(item.motivo || "-")}</td>
                <td>${esc(item.setorOrigem || "-")}</td>
                <td class="numero-centro">${formatarQuantidade(item.quantidade)}</td>
                <td>${moeda(item.valorUnitario)}</td>
                <td><strong>${moeda(valorTotal)}</strong></td>
                <td>
                    <span class="badge disponivel">${esc(item.status || "Armazenado")}</span>
                </td>
                <td>
                    <button
                        type="button"
                        class="btn-remover-item"
                        data-remover-produto-id="${esc(id)}"
                    >
                        Remover
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    tabelaProdutosCaixa
        .querySelectorAll(".checkbox-produto-caixa")
        .forEach(checkbox => {
            checkbox.addEventListener("change", () => {
                const id = String(checkbox.dataset.produtoId);
                if (checkbox.checked) {
                    produtosSelecionadosModal.add(id);
                } else {
                    produtosSelecionadosModal.delete(id);
                }
                atualizarControlesSelecaoProdutos();
            });
        });

    // O clique de remoção também é tratado por delegação no modal.
    // Mantemos a renderização dos botões simples para evitar listeners frágeis após re-render.
    atualizarControlesSelecaoProdutos();
}


async function abrirCaixa(id) {
    caixaProdutosModalId = id;
    produtosSelecionadosModal.clear();

    const caixaAtual = caixas.find(
        item => String(item.id) === String(id)
    );

    tituloModalProdutos.textContent = caixaAtual
        ? `Conteúdo da caixa: ${caixaAtual.numero}`
        : "Conteúdo da caixa";

    subtituloModalProdutos.textContent = "Carregando...";
    tabelaProdutosCaixa.innerHTML = `
        <tr><td colspan="11" class="vazio">Carregando produtos...</td></tr>
    `;

    abrirModalProdutos();

    try {
        const dados = await carregarProdutosCaixa(id);
        tituloModalProdutos.textContent = `Conteúdo da caixa: ${dados.caixa.numero}`;
        subtituloModalProdutos.textContent = [
            dados.caixa.local ? `Local: ${dados.caixa.local}` : "",
            dados.caixa.responsavel ? `Fornecedor: ${dados.caixa.responsavel}` : ""
        ].filter(Boolean).join(" • ") || "Gerencie os produtos cadastrados nesta caixa.";
        renderizarProdutosCaixaModal();
    } catch (erro) {
        console.error(erro);
        tabelaProdutosCaixa.innerHTML = `
            <tr><td colspan="11" class="vazio">Não foi possível carregar os produtos.</td></tr>
        `;
        mostrarToast(erro.message);
    }
}


function limparStatusProdutoModal() {
    if (!produtoPreviewModal) return;

    produtoPreviewModal.classList.add("oculto");
    produtoPreviewModal.classList.remove(
        "sucesso",
        "erro",
        "carregando"
    );
    produtoPreviewModal.textContent = "";
}


function mostrarStatusProdutoModal(tipo, mensagem) {
    if (!produtoPreviewModal) return;

    produtoPreviewModal.classList.remove(
        "oculto",
        "sucesso",
        "erro",
        "carregando"
    );

    produtoPreviewModal.classList.add(tipo);
    produtoPreviewModal.textContent = mensagem;
}

function atualizarPreviewProdutoModal(produto) {
    if (!produtoPreviewModal) return;

    const quantidade = numero(quantidadeProdutoModal?.value || 0);
    const valorCusto = numero(produto.valorCusto);
    const valorTotal = quantidade * valorCusto;
    const custoValido = valorCusto > 0;
    const caixa = caixaSelecionadaParaProduto();
    const fornecedorCompativel = Boolean(caixa) && fornecedorDoProdutoCompativel(produto);
    const destinoValido = Boolean(caixa);
    const podeAdicionar = custoValido && fornecedorCompativel && destinoValido;

    produtoPreviewModal.classList.remove(
        "oculto",
        "sucesso",
        "erro",
        "carregando",
        "aviso"
    );

    let tipo = "sucesso";
    let titulo = "✓ Produto localizado";
    let mensagem = caixa
        ? `Fornecedor identificado e caixa ${caixa.numero} selecionada.`
        : "Fornecedor identificado. Selecione a caixa correspondente para continuar.";

    if (!custoValido) {
        tipo = "erro";
        titulo = "⚠ Produto sem custo válido";
        mensagem = "O lançamento está bloqueado até existir um valor de custo válido.";
    } else if (!caixa) {
        tipo = "aviso";
        titulo = "✓ Fornecedor identificado";
        mensagem = `Fornecedor: ${produto.fornecedor || "não informado"}. Selecione a caixa correspondente.`;
    } else if (!fornecedorCompativel) {
        tipo = "erro";
        titulo = "✕ Fornecedor incompatível";
        mensagem = "A caixa selecionada não pertence ao fornecedor identificado pelo produto.";
    }

    produtoPreviewModal.classList.add(tipo);

    produtoPreviewModal.innerHTML = `
        <div class="produto-info-caixa-titulo">
            <strong>${titulo}</strong>
            <span>${mensagem}</span>
        </div>

        <div class="produto-info-caixa-grid">
            <div class="produto-dado-caixa">
                <span>Código do produto</span>
                <strong class="codigo-produto-caixa">${esc(produto.codigo || "-")}</strong>
            </div>

            <div class="produto-dado-caixa produto-dado-caixa-principal">
                <span>Produto</span>
                <strong>${esc(produto.produto || "-")}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Empresa / Fornecedor</span>
                <strong>${esc(produto.fornecedor || "-")}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Caixa destino</span>
                <strong>${esc(caixa ? caixa.numero : "Selecione a caixa")}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Cód. fornecedor</span>
                <strong class="codigo-produto-caixa">${esc(produto.codigoFornecedor || "-")}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Categoria</span>
                <strong>${esc(produto.categoria || "Mercearia")}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Estoque atual</span>
                <strong>${formatarQuantidade(produto.estoque)}</strong>
            </div>

            <div class="produto-dado-caixa">
                <span>Valor de custo</span>
                <strong>${moeda(valorCusto)}</strong>
            </div>

            <div class="produto-dado-caixa destaque-total-caixa">
                <span>Valor do lançamento</span>
                <strong>${moeda(valorTotal)}</strong>
            </div>
        </div>
    `;

    return podeAdicionar;
}


function definirBotaoAdicionarProduto(disponivel) {
    const quantidadeValida = Number(quantidadeProdutoModal?.value || 0) > 0;
    const motivoValido = Boolean(motivoProdutoModal?.value);
    const categoriaValida = Boolean(categoriaProdutoModal?.value);
    const setorValido = Boolean(setorProdutoModal?.value);
    const caixaValida = Boolean(caixaProdutosModalId);
    const fornecedorValido = Boolean(produtoModalConsultado) && fornecedorDoProdutoCompativel(produtoModalConsultado);
    const pronto = Boolean(disponivel) && caixaValida && fornecedorValido && quantidadeValida && motivoValido && categoriaValida && setorValido;

    if (btnAdicionarProdutoModal) {
        btnAdicionarProdutoModal.disabled = !pronto;
    }

    if (quantidadeProdutoModal) {
        quantidadeProdutoModal.disabled = !disponivel;
    }

    [motivoProdutoModal, categoriaProdutoModal, setorProdutoModal].forEach(campo => {
        if (campo) campo.disabled = !disponivel;
    });
}

function atualizarEstadoFormularioLancamento() {
    definirBotaoAdicionarProduto(Boolean(produtoModalConsultado));
}


async function buscarProdutoPorCodigo(codigo, signal) {
    const valor = String(codigo || "").trim();

    if (!valor) {
        throw new Error("Bipe ou digite o EAN do produto.");
    }

    const resposta = await fetch(
        `${API}/api/produtos/${encodeURIComponent(valor)}`,
        {
            headers: headersAutorizacao(),
            signal
        }
    );

    let dados = {};

    try {
        dados = await resposta.json();
    } catch (_) {
        dados = {};
    }

    if (!resposta.ok) {
        throw new Error(
            dados.erro || "Produto não encontrado para este EAN."
        );
    }

    return dados;
}


async function consultarProdutoModal() {
    const codigo = produtoBuscaModal.value.trim();

    produtoModalConsultado = null;
    definirBotaoAdicionarProduto(false);
    limparDestinoProduto();

    if (!codigo) {
        limparStatusProdutoModal();
        return null;
    }

    if (produtoBuscaAbortController) {
        produtoBuscaAbortController.abort();
    }

    produtoBuscaAbortController = new AbortController();
    const controladorAtual = produtoBuscaAbortController;

    mostrarStatusProdutoModal("carregando", "Consultando produto e identificando o fornecedor...");

    try {
        const produto = await buscarProdutoPorCodigo(codigo, controladorAtual.signal);

        if (controladorAtual !== produtoBuscaAbortController) {
            return null;
        }

        produtoModalConsultado = produto;

        const custoValido = numero(produto.valorCusto) > 0;
        const destino = configurarDestinoPeloProduto(produto);

        if (motivoProdutoModal) {
            motivoProdutoModal.value = "Produto avariado";
        }

        if (categoriaProdutoModal) {
            const categoriaProduto = String(produto.categoria || "Mercearia");
            categoriaProdutoModal.value = ["Frios", "Mercearia", "Padaria", "Limpeza", "Bebidas"].includes(categoriaProduto)
                ? categoriaProduto
                : "Mercearia";
        }

        if (setorProdutoModal) {
            setorProdutoModal.value = "Loja";
        }

        atualizarPreviewProdutoModal(produto);

        if (!custoValido) {
            quantidadeProdutoModal.disabled = true;
            mostrarStatusProdutoModal(
                "erro",
                "✕ Produto sem custo válido. O lançamento foi bloqueado."
            );
            return produto;
        }

        if (!destino.ok && !destino.multiplas) {
            quantidadeProdutoModal.disabled = true;
            return produto;
        }

        if (destino.multiplas) {
            quantidadeProdutoModal.disabled = true;
            mostrarStatusProdutoModal(
                "aviso",
                `✓ Fornecedor identificado: ${produto.fornecedor}. Selecione a caixa correspondente para continuar.`
            );
            caixaProdutoSelecionada?.focus();
            return produto;
        }

        // Após localizar o produto e a caixa única do fornecedor,
        // libera a quantidade. O lançamento continua manual para
        // evitar que o bip adicione o item automaticamente.
        quantidadeProdutoModal.disabled = false;
        [motivoProdutoModal, categoriaProdutoModal, setorProdutoModal].forEach(campo => {
            if (campo) campo.disabled = false;
        });
        atualizarPreviewProdutoModal(produto);
        atualizarEstadoFormularioLancamento();
        quantidadeProdutoModal.focus();
        quantidadeProdutoModal.select();

        return produto;

    } catch (erro) {
        if (erro.name === "AbortError") {
            return null;
        }

        console.error("Erro ao consultar produto da caixa:", erro);

        produtoModalConsultado = null;
        limparDestinoProduto();
        definirBotaoAdicionarProduto(false);

        mostrarStatusProdutoModal(
            "erro",
            `✕ ${erro.message}`
        );

        return null;
    }
}


async function adicionarProdutoModal() {
    if (!caixaProdutosModalId) {
        mostrarToast("Selecione o fornecedor e a caixa.");
        return;
    }

    try {
        const codigo = produtoBuscaModal.value.trim();
        const quantidade = Number(quantidadeProdutoModal.value);

        if (!codigo) {
            mostrarStatusProdutoModal(
                "erro",
                "✕ Bipe ou digite o EAN do produto."
            );
            produtoBuscaModal.focus();
            return;
        }

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
            mostrarToast("Informe uma quantidade maior que zero.");
            quantidadeProdutoModal.focus();
            return;
        }

        const motivo = String(motivoProdutoModal?.value || "").trim();
        const categoria = String(categoriaProdutoModal?.value || "").trim();
        const setorOrigem = String(setorProdutoModal?.value || "Loja").trim() || "Loja";

        if (!motivo) {
            mostrarToast("Selecione o motivo do lançamento.");
            motivoProdutoModal?.focus();
            return;
        }

        if (!categoria) {
            mostrarToast("Selecione a categoria.");
            categoriaProdutoModal?.focus();
            return;
        }

        let produto = produtoModalConsultado;

        const mesmoCodigo = produto &&
            String(produto.codigo).trim() === codigo;

        if (!mesmoCodigo) {
            produto = await consultarProdutoModal();
        }

        if (!produto) {
            produtoBuscaModal.focus();
            return;
        }

        if (!fornecedorDoProdutoCompativel(produto)) {
            mostrarStatusProdutoModal(
                "erro",
                "✕ O fornecedor do produto não corresponde ao fornecedor da caixa selecionada."
            );
            definirBotaoAdicionarProduto(false);
            return;
        }

        if (numero(produto.valorCusto) <= 0) {
            mostrarStatusProdutoModal(
                "erro",
                "✕ Produto sem custo válido. O lançamento foi bloqueado."
            );
            definirBotaoAdicionarProduto(false);
            return;
        }

        mostrarStatusProdutoModal(
            "sucesso",
            `✓ ${produto.codigo} • ${produto.produto} — adicionando...`
        );

        const resposta = await fetch(
            `${API}/api/caixas/${encodeURIComponent(caixaProdutosModalId)}/produtos`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headersAutorizacao()
                },
                body: JSON.stringify({
                    codigo: produto.codigo,
                    quantidade,
                    motivo,
                    categoria,
                    setorOrigem
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.erro || "Erro ao adicionar produto à caixa."
            );
        }

        const caixaIdAtual = caixaProdutosModalId;
        produtoBuscaModal.value = "";
        quantidadeProdutoModal.value = "1";
        produtoModalConsultado = null;
        produtosSelecionadosModal.clear();
        if (motivoProdutoModal) motivoProdutoModal.value = "";
        if (categoriaProdutoModal) categoriaProdutoModal.value = "";
        if (setorProdutoModal) setorProdutoModal.value = "";
        limparDestinoProduto();
        definirBotaoAdicionarProduto(false);
        limparStatusProdutoModal();

        if (caixaIdAtual) {
            await carregarProdutosCaixa(caixaIdAtual);
            renderizarProdutosCaixaModal();
        }
        await carregarCaixas();
        produtoBuscaModal.focus();

        mostrarToast(`Produto adicionado: ${produto.produto}.`);

    } catch (erro) {
        console.error(erro);
        mostrarStatusProdutoModal(
            "erro",
            `✕ ${erro.message}`
        );
        mostrarToast(erro.message);
    }
}


async function removerProdutoDaCaixa(itemId) {
    if (!caixaProdutosModalId) return;

    const item = produtosCaixaModal.find(
        produto => String(produto.id) === String(itemId)
    );

    if (!item) return;

    const confirmar = confirm(
        `Remover "${item.produto}" da caixa?`
    );

    if (!confirmar) return;

    try {
        const resposta = await fetch(
            `${API}/api/caixas/${encodeURIComponent(caixaProdutosModalId)}/produtos/${encodeURIComponent(itemId)}/remover`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headersAutorizacao()
                }
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.erro || "Erro ao remover produto da caixa."
            );
        }

        produtosSelecionadosModal.delete(String(itemId));
        await carregarProdutosCaixa(caixaProdutosModalId);
        renderizarProdutosCaixaModal();
        await carregarCaixas();
        mostrarToast("Produto removido da caixa.");

    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message);
    }
}



async function excluirProdutosMarcados() {
    if (!caixaProdutosModalId) return;

    const ids = obterIdsProdutosSelecionados();
    if (!ids.length) {
        mostrarToast("Selecione pelo menos um produto.");
        return;
    }

    const itens = produtosCaixaModal.filter(item => ids.includes(String(item.id)));
    const confirmar = confirm(
        `Excluir ${ids.length} produto(s) marcado(s) desta caixa?\n\n${itens.map(item => `• ${item.produto}`).join("\n")}`
    );

    if (!confirmar) return;

    try {
        const resposta = await fetch(
            `${API}/api/caixas/${encodeURIComponent(caixaProdutosModalId)}/produtos/excluir`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...headersAutorizacao()
                },
                body: JSON.stringify({ ids })
            }
        );

        const dados = await resposta.json();
        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro ao excluir os produtos marcados.");
        }

        produtosSelecionadosModal.clear();
        await carregarProdutosCaixa(caixaProdutosModalId);
        renderizarProdutosCaixaModal();
        await carregarCaixas();
        mostrarToast(`${dados.removidos || ids.length} produto(s) excluído(s) da caixa.`);
    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message);
    }
}

function limparPreviewProdutoModal() {
    produtoModalConsultado = null;
    definirBotaoAdicionarProduto(false);
    limparStatusProdutoModal();
}


function abrirModalProdutos() {
    modalProdutos.classList.remove("oculto");
    modalProdutos.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-aberto");
}


function fecharModalProdutos() {
    caixaProdutosModalId = null;
    produtosCaixaModal = [];
    produtosSelecionadosModal.clear();
    atualizarContadorProdutosModal();
    limparPreviewProdutoModal();
    modalProdutos.classList.add("oculto");
    modalProdutos.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-aberto");
}


btnAdicionarProdutoModal.addEventListener(
    "click",
    adicionarProdutoModal
);

produtoBuscaModal.addEventListener(
    "input",
    () => {
        // Digitação e leitura do EAN não fazem consulta parcial.
        // A consulta só acontece quando o código estiver completo
        // e o usuário/leitor confirmar com Enter.
        produtoModalConsultado = null;
        limparDestinoProduto();
        definirBotaoAdicionarProduto(false);

        if (produtoBuscaTimer) {
            clearTimeout(produtoBuscaTimer);
            produtoBuscaTimer = null;
        }

        if (!produtoBuscaModal.value.trim()) {
            limparStatusProdutoModal();
            return;
        }

        limparStatusProdutoModal();
    }
);

// Não consultar no blur. Isso evita que uma troca de campo
// provoque uma busca com um EAN incompleto.

quantidadeProdutoModal.addEventListener(
    "input",
    () => {
        if (produtoModalConsultado) {
            atualizarPreviewProdutoModal(produtoModalConsultado);
        }
        atualizarEstadoFormularioLancamento();
    }
);

[motivoProdutoModal, categoriaProdutoModal, setorProdutoModal].forEach(campo => {
    if (!campo) return;
    campo.addEventListener("change", atualizarEstadoFormularioLancamento);
});

quantidadeProdutoModal.addEventListener(
    "keydown",
    async event => {
        if (event.key === "Enter") {
            event.preventDefault();
            await adicionarProdutoModal();
        }
    }
);

produtoBuscaModal.addEventListener(
    "keydown",
    async event => {
        if (event.key === "Enter") {
            event.preventDefault();

            if (produtoBuscaTimer) {
                clearTimeout(produtoBuscaTimer);
            }

            // O Enter enviado pelo leitor de código serve apenas
            // para consultar o produto. O lançamento só acontece
            // depois que a quantidade for informada.
            const produto = await consultarProdutoModal();

            if (produto) {
                quantidadeProdutoModal.focus();
                quantidadeProdutoModal.select();
            }
        }
    }
);

if (btnExcluirProdutosMarcados) {
    btnExcluirProdutosMarcados.addEventListener(
        "click",
        excluirProdutosMarcados
    );
}

if (checkboxTodosProdutos) {
    checkboxTodosProdutos.addEventListener(
        "change",
        () => {
            if (checkboxTodosProdutos.checked) {
                produtosCaixaModal.forEach(item => produtosSelecionadosModal.add(String(item.id)));
            } else {
                produtosSelecionadosModal.clear();
            }
            renderizarProdutosCaixaModal();
        }
    );
}

btnFecharModalProdutos.addEventListener(
    "click",
    fecharModalProdutos
);

btnFecharModalProdutosRodape.addEventListener(
    "click",
    fecharModalProdutos
);

modalProdutos.addEventListener(
    "click",
    event => {
        if (event.target === modalProdutos) {
            fecharModalProdutos();
        }
    }
);

modalProdutos.addEventListener(
    "click",
    event => {
        const botao = event.target.closest("[data-remover-produto-id]");
        if (!botao || !modalProdutos.contains(botao)) return;
        event.preventDefault();
        removerProdutoDaCaixa(botao.dataset.removerProdutoId);
    }
);

/* =========================================================
   ADICIONAR PRODUTO — SELEÇÃO DE FORNECEDOR/CAIXA
========================================================= */

if (fornecedorProdutoCaixa) {
    fornecedorProdutoCaixa.addEventListener("change", () => {
        atualizarOpcoesCaixaProduto();
    });
}

if (caixaProdutoSelecionada) {
    caixaProdutoSelecionada.addEventListener("change", () => {
        selecionarCaixaParaProduto(caixaProdutoSelecionada.value);
    });
}

/* =========================================================
   EXCLUIR CAIXA
========================================================= */

async function excluirCaixa(
    id
) {

    const caixaAtual =
        caixas.find(

            item =>
                String(item.id) ===
                String(id)

        );


    if (!caixaAtual) {

        mostrarToast(
            "Caixa não encontrada."
        );

        return;

    }


    const confirmar =
        confirm(

            `Deseja excluir a caixa "${caixaAtual.numero}"?`

        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(

                `${API}/api/caixas/${encodeURIComponent(id)}`,

                {
                    method:
                        "DELETE",
                    headers:
                        headersAutorizacao()
                }

            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(

                dados.erro ||
                "Erro ao excluir caixa."

            );

        }


        mostrarToast(
            "Caixa excluída."
        );


        await carregarCaixas();


    } catch (erro) {

        console.error(
            erro
        );


        mostrarToast(
            erro.message
        );

    }

}


/* =========================================================
   CONTEÚDO DA CAIXA
========================================================= */

async function abrirConteudoCaixa(
    id
) {

    caixaModalAtualId =
        id;


    const caixaAtual =
        caixas.find(

            item =>
                String(item.id) ===
                String(id)

        );


    tituloModalCaixa.textContent =
        caixaAtual
            ? `Conteúdo da caixa: ${caixaAtual.numero}`
            : "Conteúdo da caixa";


    subtituloModalCaixa.textContent =
        "Carregando...";


    modalTotalRegistros.textContent =
        "0";

    modalQuantidade.textContent =
        "0";

    modalValor.textContent =
        "R$ 0,00";

    modalPendentes.textContent =
        "0";


    tabelaConteudoCaixa.innerHTML = `

        <tr>

            <td
                colspan="8"
                class="vazio"
            >
                Carregando conteúdo...
            </td>

        </tr>

    `;


    abrirModal();


    try {

        const resposta =
            await fetch(

                `${API}/api/caixas/${encodeURIComponent(id)}/conteudo`

            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(

                dados.erro ||
                "Erro ao carregar conteúdo da caixa."

            );

        }


        tituloModalCaixa.textContent =
            `Conteúdo da caixa: ${dados.caixa.numero}`;


        const detalhes =
            [
                dados.caixa.local
                    ? `Local: ${dados.caixa.local}`
                    : "",

                dados.caixa.responsavel
                    ? `Fornecedor: ${dados.caixa.responsavel}`
                    : "",

                dados.resumo.ultimoLancamento
                    ? `Último lançamento: ${formatarData(
                        dados.resumo.ultimoLancamento
                    )}`
                    : "Sem lançamentos"
            ]
            .filter(Boolean)
            .join(" • ");


        subtituloModalCaixa.textContent =
            detalhes;


        modalTotalRegistros.textContent =
            numero(
                dados.resumo.totalRegistros
            );


        modalQuantidade.textContent =
            formatarQuantidade(
                dados.resumo.quantidadeTotal
            );


        modalValor.textContent =
            moeda(
                dados.resumo.valorAcumulado
            );


        modalPendentes.textContent =
            numero(
                dados.resumo.avariasPendentes
            );


        renderizarConteudoCaixa(
            dados.registros || []
        );


    } catch (erro) {

        console.error(
            "Erro ao carregar conteúdo da caixa:",
            erro
        );


        tabelaConteudoCaixa.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="vazio"
                >
                    Não foi possível carregar o conteúdo.
                </td>

            </tr>

        `;


        mostrarToast(
            erro.message
        );

    }

}


function renderizarConteudoCaixa(
    registros
) {

    if (!registros.length) {

        tabelaConteudoCaixa.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="vazio"
                >
                    Nenhum produto vinculado a esta caixa.
                </td>

            </tr>

        `;

        return;

    }


    tabelaConteudoCaixa.innerHTML =

        registros.map(

            registro => {

                const total =
                    numero(
                        registro.quantidade
                    )
                    *
                    numero(
                        registro.valorUnitario
                    );


                return `

                    <tr>

                        <td>
                            ${formatarData(
                                registro.criadoEm
                            )}
                        </td>


                        <td class="codigo-produto">
                            ${esc(
                                registro.codigo || "-"
                            )}
                        </td>


                        <td class="produto-conteudo">
                            ${esc(
                                registro.produto || "-"
                            )}
                        </td>


                        <td class="numero-centro">
                            ${formatarQuantidade(
                                registro.quantidade
                            )}
                        </td>


                        <td>
                            ${moeda(
                                registro.valorUnitario
                            )}
                        </td>


                        <td>
                            <strong>
                                ${moeda(
                                    total
                                )}
                            </strong>
                        </td>


                        <td>
                            ${esc(
                                registro.tipo || "-"
                            )}
                        </td>


                        <td>

                            <span
                                class="badge ${
                                    registro.status === "Pendente"
                                        ? "em-uso"
                                        : "disponivel"
                                }"
                            >
                                ${esc(
                                    registro.status || "-"
                                )}
                            </span>

                        </td>

                    </tr>

                `;

            }

        )
        .join("");

}


/* =========================================================
   MODAL
========================================================= */

function abrirModal() {

    modalConteudo.classList.remove(
        "oculto"
    );


    modalConteudo.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-aberto"
    );

}


function fecharModal() {

    caixaModalAtualId =
        null;


    modalConteudo.classList.add(
        "oculto"
    );


    modalConteudo.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-aberto"
    );

}


btnFecharModal.addEventListener(
    "click",
    fecharModal
);


btnFecharModalRodape.addEventListener(
    "click",
    fecharModal
);


modalConteudo.addEventListener(

    "click",

    function(event) {

        if (
            event.target ===
            modalConteudo
        ) {

            fecharModal();

        }

    }

);


document.addEventListener(

    "keydown",

    function(event) {

        if (event.key !== "Escape") {
            return;
        }

        if (!modalProdutos.classList.contains("oculto")) {
            fecharModalProdutos();
            return;
        }

        if (!modalConteudo.classList.contains("oculto")) {
            fecharModal();
        }

    }

);


/* =========================================================
   PESQUISA
========================================================= */

busca.addEventListener(

    "input",

    renderizarCaixas

);


/* =========================================================
   SAIR
========================================================= */

btnSair.addEventListener(

    "click",

    function() {

        const confirmar =
            confirm(
                "Deseja sair do sistema?"
            );


        if (!confirmar) {

            return;

        }


        fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include",
                keepalive: true
            }
        ).catch(() => {});

        sessionStorage.removeItem(
            "usuarioLogado"
        );


        window.location.href =
            "login.html";

    }

);


/* =========================================================
   INICIAR
========================================================= */

carregarCaixas();


/* =========================================================
   TEMPO REAL ENTRE OS PCS
========================================================= */

if (typeof EventSource !== "undefined") {

    const eventosCaixas =
        new EventSource(
            `${API}/api/eventos`
        );

    let timerCaixas =
        null;

    const atualizarCaixasTempoReal =
        () => {

            clearTimeout(
                timerCaixas
            );

            timerCaixas =
                setTimeout(

                    async () => {

                        await carregarCaixas();

                        if (
                            caixaModalAtualId &&
                            !modalConteudo.classList.contains(
                                "oculto"
                            )
                        ) {

                            await abrirConteudoCaixa(
                                caixaModalAtualId
                            );

                        }

                        if (
                            caixaProdutosModalId &&
                            !modalProdutos.classList.contains("oculto")
                        ) {
                            try {
                                await carregarProdutosCaixa(caixaProdutosModalId);
                                renderizarProdutosCaixaModal();
                            } catch {}
                        }

                    },

                    120

                );

        };

    [
        "avarias-atualizadas",
        "caixas-atualizadas"
    ].forEach(
        tipo =>
            eventosCaixas.addEventListener(
                tipo,
                atualizarCaixasTempoReal
            )
    );

}
