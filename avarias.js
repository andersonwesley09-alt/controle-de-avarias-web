/* BUILD V21.5 - setores de origem da avaria e filtros por setor */
/* =========================================================
   AVARIAS E BAIXAS
   PostgreSQL + API
========================================================= */


/* =========================
   PROTEGER PÁGINA
========================= */

const sessao =
    sessionStorage.getItem(
        "usuarioLogado"
    );


if (!sessao) {

    window.location.href =
        "login.html";

}


let dadosSessao =
    null;


try {

    dadosSessao =
        JSON.parse(
            sessao || "null"
        );

} catch {

    dadosSessao =
        null;

}


let usuarioEhAdmin =
    dadosSessao?.perfil ===
    "admin";


if (usuarioEhAdmin) {

    document.body.classList.add(
        "perfil-admin"
    );

}


/* =========================
   API
========================= */

const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraSistema === "function") {
        return window.formatarDataHoraSistema(valor);
    }
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short"
    }).format(d);
};


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


async function sincronizarPermissaoAdminHistorico() {
    try {
        const resposta = await fetch(`${API}/api/sessao`, {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        if (!resposta.ok) return;

        const sessaoServidor = await resposta.json();
        usuarioEhAdmin = sessaoServidor?.perfil === "admin";

        dadosSessao = {
            ...(dadosSessao || {}),
            ...sessaoServidor
        };

        try {
            sessionStorage.setItem("usuarioLogado", JSON.stringify(dadosSessao));
        } catch {}

        document.body.classList.toggle("perfil-admin", usuarioEhAdmin);

        if (typeof atualizarResumoHistorico === "function") {
            atualizarResumoHistorico();
        }
    } catch (erro) {
        console.warn("Não foi possível sincronizar a permissão do histórico:", erro);
    }
}


/* =========================
   DADOS
========================= */

let produtoAtual =
    null;


let avarias =
    [];


/* =========================
   ELEMENTOS CADASTRO
========================= */

const formAvaria =
    document.getElementById(
        "formAvaria"
    );


const codigoProduto =
    document.getElementById(
        "codigoProduto"
    );


const quantidade =
    document.getElementById(
        "quantidade"
    );


const produtoInfo =
    document.getElementById(
        "produtoInfo"
    );


const codigoProdutoInfo =
    document.getElementById(
        "codigoProdutoInfo"
    );


const nomeProduto =
    document.getElementById(
        "nomeProduto"
    );


const nomeFornecedor =
    document.getElementById(
        "nomeFornecedor"
    );


const codigoFornecedorInfo =
    document.getElementById(
        "codigoFornecedorInfo"
    );


const valorProduto =
    document.getElementById(
        "valorProduto"
    );


const categoriaProdutoInfo =
    document.getElementById(
        "categoriaProdutoInfo"
    );


const filtroCategoriaCadastro =
    document.getElementById(
        "filtroCategoriaCadastro"
    );


const valorTotal =
    document.getElementById(
        "valorTotal"
    );


const produtoNaoEncontrado =
    document.getElementById(
        "produtoNaoEncontrado"
    );


const mensagemProdutoNaoEncontrado =
    document.getElementById(
        "mensagemProdutoNaoEncontrado"
    );


const produtoSemCusto =
    document.getElementById(
        "produtoSemCusto"
    );


const tipo =
    document.getElementById(
        "tipo"
    );


const setor =
    document.getElementById(
        "setor"
    );

if (setor) {
    setor.value = "Loja";
}

const categoriaAvaria =
    document.getElementById(
        "categoriaAvaria"
    );


const obs =
    document.getElementById(
        "obs"
    );


const btnSalvar =
    document.getElementById(
        "btnSalvar"
    );


const ultimosLancamentos =
    document.getElementById(
        "ultimosLancamentos"
    );


/* =========================
   REGISTROS
========================= */

const tabelaRegistros =
    document.getElementById(
        "tabelaRegistros"
    );


const contadorRegistros =
    document.getElementById(
        "contadorRegistros"
    );


const buscaRegistros =
    document.getElementById(
        "buscaRegistros"
    );




const campoPesquisa =
    document.getElementById(
        "campoPesquisa"
    );


const filtroTipo =
    document.getElementById(
        "filtroTipo"
    );


const filtroCategoriaRegistros =
    document.getElementById(
        "filtroCategoriaRegistros"
    );

const filtroFornecedorRegistros =
    document.getElementById(
        "filtroFornecedorRegistros"
    );


const filtroSetorRegistros =
    document.getElementById(
        "filtroSetorRegistros"
    );


const filtroStatusRegistros =
    document.getElementById(
        "filtroStatusRegistros"
    );


const filtroCaixaRegistros =
    document.getElementById(
        "filtroCaixaRegistros"
    );


const dataInicial =
    document.getElementById(
        "dataInicial"
    );


const dataFinal =
    document.getElementById(
        "dataFinal"
    );

const ordemRegistros =
    document.getElementById(
        "ordemRegistros"
    );

const direcaoRegistros =
    document.getElementById(
        "direcaoRegistros"
    );

const btnFiltrosRegistros =
    document.getElementById(
        "btnFiltrosRegistros"
    );

const btnFiltrosBaixas =
    document.getElementById(
        "btnFiltrosBaixas"
    );

const painelFiltrosRegistros =
    document.getElementById(
        "painelFiltrosRegistros"
    );

const painelFiltrosBaixas =
    document.getElementById(
        "painelFiltrosBaixas"
    );

const btnLimparFiltros =
    document.getElementById(
        "btnLimparFiltros"
    );


const btnExcluirSelecionados =
    document.getElementById(
        "btnExcluirSelecionados"
    );


const qtdSelecionados =
    document.getElementById(
        "qtdSelecionados"
    );


const selecionarTodos =
    document.getElementById(
        "selecionarTodos"
    );


const btnCompartilhar =
    document.getElementById(
        "btnCompartilhar"
    );

const menuCompartilhar =
    document.getElementById(
        "menuCompartilhar"
    );

const btnCompartilharXlsx =
    document.getElementById(
        "btnCompartilharXlsx"
    );

const btnCompartilharPdf =
    document.getElementById(
        "btnCompartilharPdf"
    );


let registrosFiltrados =
    [];


let selecionados =
    new Set();


/* =========================
   HISTÓRICO / BAIXAS
========================= */

const tabelaHistorico =
    document.getElementById(
        "tabelaHistorico"
    );


const contadorHistorico =
    document.getElementById(
        "contadorHistorico"
    );


const buscaHistorico =
    document.getElementById(
        "buscaHistorico"
    );


const filtroHistoricoFornecedor =
    document.getElementById(
        "filtroHistoricoFornecedor"
    );


const filtroHistoricoCodigoFornecedor =
    document.getElementById(
        "filtroHistoricoCodigoFornecedor"
    );


const filtroHistoricoCodigoProduto =
    document.getElementById(
        "filtroHistoricoCodigoProduto"
    );


const filtroHistoricoCategoria =
    document.getElementById(
        "filtroHistoricoCategoria"
    );


const filtroHistoricoSetor =
    document.getElementById(
        "filtroHistoricoSetor"
    );


const filtroHistoricoDataInicial =
    document.getElementById(
        "filtroHistoricoDataInicial"
    );


const filtroHistoricoDataFinal =
    document.getElementById(
        "filtroHistoricoDataFinal"
    );


const btnLimparFiltrosHistorico =
    document.getElementById(
        "btnLimparFiltrosHistorico"
    );


const filtroHistoricoStatus =
    document.getElementById(
        "filtroHistoricoStatus"
    );


const filtroHistoricoTipo =
    document.getElementById(
        "filtroHistoricoTipo"
    );


const filtroHistoricoCaixa =
    document.getElementById(
        "filtroHistoricoCaixa"
    );


const ordemHistorico =
    document.getElementById(
        "ordemHistorico"
    );


const direcaoHistorico =
    document.getElementById(
        "direcaoHistorico"
    );


const avisoHistoricoSomenteAdmin =
    document.getElementById(
        "avisoHistoricoSomenteAdmin"
    );


const selecionarTodosHistorico =
    document.getElementById(
        "selecionarTodosHistorico"
    );


const btnExcluirHistoricoSelecionados =
    document.getElementById(
        "btnExcluirHistoricoSelecionados"
    );


const btnExportarBaixasXlsx =
    document.getElementById(
        "btnExportarBaixasXlsx"
    );


const btnExportarBaixasPdf =
    document.getElementById(
        "btnExportarBaixasPdf"
    );


const qtdHistoricoSelecionados =
    document.getElementById(
        "qtdHistoricoSelecionados"
    );


const totalBaixas =
    document.getElementById(
        "totalBaixas"
    );


const quantidadeBaixada =
    document.getElementById(
        "quantidadeBaixada"
    );


const valorPerdido =
    document.getElementById(
        "valorPerdido"
    );


const resumoRegistrosFiltrados =
    document.getElementById(
        "resumoRegistrosFiltrados"
    );


const resumoQuantidadeRegistros =
    document.getElementById(
        "resumoQuantidadeRegistros"
    );


const resumoValorRegistros =
    document.getElementById(
        "resumoValorRegistros"
    );


const paginacaoRegistros =
    document.getElementById(
        "paginacaoRegistros"
    );


const paginacaoHistorico =
    document.getElementById(
        "paginacaoHistorico"
    );


let historicoAvarias =
    [];


let historicoFiltrado =
    [];


let historicoSelecionados =
    new Set();


/* =========================
   PAGINAÇÃO / ORDENAÇÃO
========================= */

const PAGINACAO_TAMANHOS = [10, 25, 50, 100];

let paginaRegistros = 1;
let tamanhoPaginaRegistros = 25;
let registrosPaginaAtual = [];
let ordenacaoCabecalhoRegistros = { campo: "", direcao: "desc" };

let paginaHistorico = 1;
let tamanhoPaginaHistorico = 25;
let historicoPaginaAtual = [];
let ordenacaoCabecalhoHistorico = { campo: "data", direcao: "desc" };


/* =========================
   MODAL - EDITAR BAIXA
========================= */

const modalEditarBaixa =
    document.getElementById("modalEditarBaixa");

const formEditarBaixa =
    document.getElementById("formEditarBaixa");

const editarBaixaId =
    document.getElementById("editarBaixaId");

const editarBaixaCodigo =
    document.getElementById("editarBaixaCodigo");

const editarBaixaProduto =
    document.getElementById("editarBaixaProduto");

const editarBaixaFornecedor =
    document.getElementById("editarBaixaFornecedor");

const editarBaixaCodigoFornecedor =
    document.getElementById("editarBaixaCodigoFornecedor");

const editarBaixaCategoria =
    document.getElementById("editarBaixaCategoria");

const editarBaixaQuantidade =
    document.getElementById("editarBaixaQuantidade");

const editarBaixaValorUnitario =
    document.getElementById("editarBaixaValorUnitario");

const editarBaixaValorTotal =
    document.getElementById("editarBaixaValorTotal");

const editarBaixaSetor =
    document.getElementById("editarBaixaSetor");

const editarBaixaMotivo =
    document.getElementById("editarBaixaMotivo");

const editarBaixaCaixa =
    document.getElementById("editarBaixaCaixa");

const editarBaixaData =
    document.getElementById("editarBaixaData");

const editarBaixaUsuario =
    document.getElementById("editarBaixaUsuario");

const editarBaixaObservacao =
    document.getElementById("editarBaixaObservacao");

const btnFecharEditarBaixa =
    document.getElementById("btnFecharEditarBaixa");

const btnCancelarEditarBaixa =
    document.getElementById("btnCancelarEditarBaixa");

const btnExcluirBaixaModal =
    document.getElementById("btnExcluirBaixaModal");

const btnSalvarEditarBaixa =
    document.getElementById("btnSalvarEditarBaixa");


/* =========================
   OUTROS
========================= */

const toast =
    document.getElementById(
        "toast"
    );

const statusConexao =
    document.getElementById(
        "statusConexao"
    );


const btnSair =
    document.getElementById(
        "btnSair"
    );


const botoesAbas =
    document.querySelectorAll(
        ".aba-btn"
    );


const conteudosAbas =
    document.querySelectorAll(
        ".aba-conteudo"
    );


/* =========================================================
   UTILITÁRIOS
========================================================= */

function numero(valor) {

    const resultado =
        Number(valor);


    return Number.isFinite(
        resultado
    )
        ? resultado
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


function valorDaAvaria(
    avaria
) {

    return (
        numero(
            avaria.quantidade
        )
        *
        numero(
            avaria.valorUnitario
        )
    );

}


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


/* =========================
   SOMENTE STATUS USADOS
========================= */

function avariaVisivel(
    avaria
) {

    return (
        avaria.status ===
        "Pendente"

        ||

        avaria.status ===
        "Baixa"
    );

}


/* =========================================================
   TOAST
========================================================= */

let timerToast;


function mostrarToast(
    mensagem
) {

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
   ABAS
========================================================= */

botoesAbas.forEach(

    botao => {

        botao.addEventListener(

            "click",

            function() {

                abrirAba(
                    botao.dataset.aba
                );

            }

        );

    }

);


function atualizarBotoesFiltroAba(aba) {
    if (btnFiltrosRegistros) btnFiltrosRegistros.style.display = aba === "registros" ? "inline-flex" : "none";
    if (btnFiltrosBaixas) btnFiltrosBaixas.style.display = aba === "baixas" ? "inline-flex" : "none";
}

function abrirAba(
    aba
) {

    atualizarBotoesFiltroAba(aba);

    botoesAbas.forEach(

        botao => {

            botao.classList.toggle(

                "ativo",

                botao.dataset.aba ===
                    aba

            );

        }

    );


    conteudosAbas.forEach(

        conteudo => {

            conteudo.classList.remove(
                "ativo"
            );

        }

    );


    if (
        aba === "cadastro"
    ) {

        document
            .getElementById(
                "abaCadastro"
            )
            .classList.add(
                "ativo"
            );


        setTimeout(
            () =>
                codigoProduto.focus(),
            50
        );

    }


    if (
        aba === "registros"
    ) {

        document
            .getElementById(
                "abaRegistros"
            )
            .classList.add(
                "ativo"
            );


        renderizarRegistros();

    }


    if (
        aba === "baixas"
    ) {

        document
            .getElementById(
                "abaBaixas"
            )
            .classList.add(
                "ativo"
            );


        renderizarHistorico();
        carregarHistorico();

    }

}


/* =========================================================
   BUSCAR PRODUTO
========================================================= */

async function buscarProduto(
    codigo
) {

    try {

        const resposta =
            await fetch(

                `${API}/api/produtos/${encodeURIComponent(codigo)}`

            );


        if (
            resposta.status ===
            404
        ) {

            return null;

        }


        if (!resposta.ok) {

            throw new Error(
                "Erro ao consultar produto."
            );

        }


        return await resposta.json();


    } catch (erro) {

        console.error(
            "Erro ao buscar produto:",
            erro
        );


        mostrarToast(
            "Não foi possível consultar o servidor."
        );


        return null;

    }

}


/* =========================================================
   CARREGAR AVARIAS
========================================================= */

async function carregarAvarias() {

    try {
        const sessaoAtual = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
        const headers = sessaoAtual?.token ? { Authorization: `Bearer ${sessaoAtual.token}` } : {};
        const resposta = await fetch(`${API}/api/avarias`, {
            cache: "no-store",
            credentials: "include",
            headers
        });

        if (!resposta.ok) {
            const corpo = await resposta.text().catch(() => "");
            throw new Error(`HTTP ${resposta.status}${corpo ? ` - ${corpo.slice(0, 180)}` : ""}`);
        }

        const dados = await resposta.json();
        if (!Array.isArray(dados)) throw new Error("A API de avarias não retornou uma lista.");

        avarias = dados.map(item => ({
            ...item,
            status: String(item.status || "").toLowerCase() === "pendente"
                ? "Pendente"
                : String(item.status || "").toLowerCase() === "baixa"
                    ? "Baixa"
                    : item.status
        }));

        renderizarTudo();

    } catch (erro) {
        console.error("V21.5: erro ao carregar avarias:", erro);

        // IMPORTANTE: histórico NÃO é fonte de dados da aba Registros.
        // O histórico preserva registros excluídos e não pode repovoar
        // a lista de avarias atuais, senão o item volta após uma exclusão.
        // Mantemos somente os dados atuais já carregados, se houver.
        if (!Array.isArray(avarias) || !avarias.length) {
            avarias = [];
            renderizarTudo();
        }

        mostrarToast(`Não foi possível carregar as avarias atuais: ${erro.message || "erro desconhecido"}`);
    }

}


/* =========================================================
   CARREGAR HISTÓRICO
========================================================= */

function renderizarHistoricoMinimo() {
    const tbody = document.getElementById("tabelaHistorico");
    const contador = document.getElementById("contadorHistorico");
    if (!tbody) return;

    const lista = Array.isArray(historicoAvarias) ? historicoAvarias : [];
    if (contador) contador.textContent = String(lista.length);

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="vazio">Nenhum registro encontrado no histórico.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    for (const registro of lista) {
        const tr = document.createElement("tr");
        const valores = [
            "",
            formatarData(registro.movimentadoEm || registro.criadoEm),
            registro.codigo || "-",
            registro.produto || "-",
            registro.fornecedor || "-",
            registro.categoria || "Mercearia",
            registro.codigoFornecedor || "-",
            formatarQuantidade(registro.quantidade),
            moeda(valorDaAvaria(registro)),
            registro.setor || "-",
            registro.tipo || "-",
            registro.usuarioLancamento || "-"
        ];
        for (const valor of valores) {
            const td = document.createElement("td");
            td.textContent = String(valor ?? "-");
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

async function carregarHistorico() {
    let erroApi = null;
    try {
        const sessaoAtual = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
        const headers = sessaoAtual?.token ? { Authorization: `Bearer ${sessaoAtual.token}` } : {};
        const resposta = await fetch(`${API}/api/historico-avarias`, {
            cache: "no-store",
            credentials: "include",
            headers
        });

        const texto = await resposta.text();
        let dados = null;
        try { dados = JSON.parse(texto || "null"); } catch (_) {
            throw new Error(`A API retornou conteúdo que não é JSON (HTTP ${resposta.status}).`);
        }

        if (!resposta.ok) {
            throw new Error(dados?.detalhe || dados?.erro || `Erro ao carregar histórico (HTTP ${resposta.status}).`);
        }
        if (!Array.isArray(dados)) {
            throw new Error("A API de histórico respondeu, mas não retornou uma lista de registros.");
        }

        historicoAvarias = dados.map(item => ({
            ...item,
            categoria: item.categoria || "Mercearia",
            quantidade: Number(item.quantidade) || 0,
            valorUnitario: Number(item.valorUnitario) || 0
        }));

        try {
            renderizarHistorico();
        } catch (erroRender) {
            console.error("V20.1: histórico recebido, mas a renderização normal falhou:", erroRender);
            renderizarHistoricoMinimo();
            mostrarToast(`Histórico carregado (${historicoAvarias.length} registros). A tela foi recuperada automaticamente.`);
        }

        // O histórico é usado apenas para o módulo Histórico/Baixas.
        // Ele não deve preencher a aba Registros, pois pode conter itens
        // que já foram excluídos da tabela avarias.
        return historicoAvarias;

    } catch (erro) {
        erroApi = erro;
        console.error("V20.1: erro ao carregar histórico:", erro);

        // O histórico deve permanecer independente da tabela avarias.
        // Não usamos /api/avarias como fallback aqui para evitar misturar
        // registros atuais com o histórico de itens já excluídos.
        mostrarToast(`Não foi possível carregar o histórico: ${erroApi?.message || "erro desconhecido"}`);
        return [];
    }
}


/* =========================================================
   PRODUTO
========================================================= */

function limparProduto() {

    produtoAtual =
        null;


    codigoProdutoInfo.textContent =
        "-";


    nomeProduto.textContent =
        "-";


    nomeFornecedor.textContent =
        "-";


    codigoFornecedorInfo.textContent =
        "-";


    valorProduto.textContent =
        "R$ 0,00";


    if (categoriaProdutoInfo) {
        categoriaProdutoInfo.textContent = "-";
    }


    valorTotal.textContent =
        "R$ 0,00";


    quantidade.value =
        "";

    if (categoriaAvaria) {
        categoriaAvaria.value = "Mercearia";
    }


    quantidade.disabled =
        true;


    btnSalvar.disabled =
        true;


    produtoInfo.classList.add(
        "oculto"
    );


    produtoNaoEncontrado?.classList.add(
        "oculto"
    );


    produtoSemCusto?.classList.add(
        "oculto"
    );

}


function mostrarProduto(
    produto
) {

    produtoAtual =
        produto;


    codigoProdutoInfo.textContent =
        produto.codigo || "-";


    nomeProduto.textContent =
        produto.produto || "-";


    nomeFornecedor.textContent =
        produto.fornecedor || "-";


    codigoFornecedorInfo.textContent =
        produto.codigoFornecedor || "-";


    valorProduto.textContent =
        moeda(
            produto.valorCusto
        );


    if (categoriaProdutoInfo) {
        categoriaProdutoInfo.textContent =
            produto.categoria || "Mercearia";
    }

    if (categoriaAvaria) {
        const categoria = produto.categoria || "Mercearia";
        categoriaAvaria.value = ["Frios", "Mercearia", "Padaria", "Limpeza", "Bebidas"].includes(categoria)
            ? categoria
            : "Mercearia";
    }


    produtoInfo.classList.remove(
        "oculto"
    );


    quantidade.disabled =
        false;


    const custoValido =
        numero(
            produto.valorCusto
        ) > 0;


    btnSalvar.disabled =
        !custoValido;


    produtoSemCusto?.classList.toggle(
        "oculto",
        custoValido
    );


    quantidade.value =
        "";


    atualizarValorTotal();


    quantidade.focus();

}


/* =========================================================
   CONSULTAR CÓDIGO
========================================================= */

async function consultarCodigo() {

    const codigo =
        codigoProduto.value
            .trim();


    if (!codigo) {

        mostrarToast(
            "Digite ou bipe o código."
        );


        codigoProduto.focus();


        return;

    }


    limparProduto();


    const produto =
        await buscarProduto(
            codigo
        );


    if (!produto) {

        produtoNaoEncontrado?.classList.remove(
            "oculto"
        );

        if (mensagemProdutoNaoEncontrado) {
            mensagemProdutoNaoEncontrado.textContent =
                `Código consultado: ${codigo}. Verifique se ele está na base de produtos.`;
        }


        mostrarToast(
            "Produto não encontrado. O lançamento está bloqueado."
        );


        codigoProduto.select();


        return;

    }


    mostrarProduto(
        produto
    );


    mostrarToast(
        "Produto encontrado."
    );

}


/* =========================
   ENTER CÓDIGO
========================= */

codigoProduto.addEventListener(

    "keydown",

    async function(event) {

        if (
            event.key !==
            "Enter"
        ) {

            return;

        }


        event.preventDefault();


        await consultarCodigo();

    }

);


/* =========================
   ALTERAÇÃO CÓDIGO
========================= */

codigoProduto.addEventListener(

    "input",

    function() {

        if (!produtoAtual) {

            return;

        }


        if (

            codigoProduto.value
                .trim()

            !==

            String(
                produtoAtual.codigo
            )

        ) {

            limparProduto();

        }

    }

);


/* =========================================================
   VALOR TOTAL
========================================================= */

function atualizarValorTotal() {

    if (!produtoAtual) {

        valorTotal.textContent =
            "R$ 0,00";


        return;

    }


    const qtd =
        numero(
            quantidade.value
        );


    const custo =
        numero(
            produtoAtual.valorCusto
        );


    valorTotal.textContent =
        moeda(
            qtd * custo
        );

}


quantidade.addEventListener(

    "input",

    atualizarValorTotal

);


/* =========================
   ENTER QUANTIDADE
========================= */

quantidade.addEventListener(

    "keydown",

    function(event) {

        if (
            event.key !==
            "Enter"
        ) {

            return;

        }


        event.preventDefault();


        formAvaria.requestSubmit();

    }

);


/* =========================================================
   SALVAR
========================================================= */

formAvaria.addEventListener(

    "submit",

    async function(event) {

        event.preventDefault();


        if (!produtoAtual) {

            mostrarToast(
                "Primeiro informe um produto válido."
            );


            codigoProduto.focus();


            return;

        }


        const qtd =
            numero(
                quantidade.value
            );


        if (qtd <= 0) {

            mostrarToast(
                "Informe a quantidade ou peso."
            );


            quantidade.focus();


            return;

        }


        const valorCusto =
            numero(
                produtoAtual.valorCusto
            );


        const nomeProdutoSalvo =
            produtoAtual.produto || "Produto";


        const codigoFornecedorSalvo =
            produtoAtual.codigoFornecedor || "";


        const valorTotalSalvo =
            qtd * valorCusto;
const novaAvaria = {

            codigo:
                String(
                    produtoAtual.codigo
                ),


            produto:
                produtoAtual.produto,


            fornecedor:
                produtoAtual.fornecedor || "",


            categoria:
                categoriaAvaria?.value || produtoAtual.categoria || "Mercearia",


            quantidade:
                qtd,


            valorUnitario:
                valorCusto,


            setor:
                String(setor?.value || "Loja").trim() || "Loja",


            tipo:
                tipo.value,


            observacao:
                obs.value.trim()

        };


        btnSalvar.disabled =
            true;


        try {

            const resposta =
                await fetch(

                    `${API}/api/avarias`,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${dadosSessao?.token || ""}`

                        },

                        body:
                            JSON.stringify(
                                novaAvaria
                            )

                    }

                );


            const dados =
                await resposta.json();


            if (!resposta.ok) {

                throw new Error(

                    dados.erro

                    ||

                    "Erro ao cadastrar avaria."

                );

            }


            dados.codigoFornecedor =
                dados.codigoFornecedor ||
                codigoFornecedorSalvo;


            avarias.unshift(
                dados
            );


            renderizarTudo();


            mostrarToast(
                `✓ ${formatarQuantidade(qtd)} de ${nomeProdutoSalvo} cadastrado(s) — ${moeda(valorTotalSalvo)}`
            );


            resetarCadastro();


            await carregarHistorico();


        } catch (erro) {

            console.error(
                "Erro ao cadastrar avaria:",
                erro
            );


            mostrarToast(
                erro.message
            );


            btnSalvar.disabled =
                false;

        }

    }

);


/* =========================================================
   RESET
========================================================= */

function resetarCadastro() {

    const tipoSelecionado =
        tipo.value;


    const setorSelecionado =
        setor.value;


    codigoProduto.value =
        "";


    obs.value =
        "";


    limparProduto();


    tipo.value =
        tipoSelecionado;


    setor.value =
        setorSelecionado || "Loja";


    codigoProduto.focus();

}


/* =========================================================
   BUSCA
========================================================= */

function correspondeBusca(
    avaria,
    pesquisa
) {

    if (!pesquisa) {

        return true;

    }


    const termo =
        pesquisa
            .toLowerCase()
            .trim();


    const campo =
        campoPesquisa.value;


    const valores = {

        codigo:
            avaria.codigo || "",

        produto:
            avaria.produto || "",

        fornecedor:
            avaria.fornecedor || "",

        codigoFornecedor:
            avaria.codigoFornecedor || "",

        tipo:
            avaria.tipo || "",

        setor:
            avaria.setor || "",

        usuarioLancamento:
            avaria.usuarioLancamento || "",

        categoria:
            avaria.categoria || ""

    };


    /* =========================
       TODOS OS CAMPOS
    ========================= */

    if (
        campo === "todos"
    ) {

        const texto =
            Object
                .values(
                    valores
                )
                .join(" ")
                .toLowerCase();


        return texto.includes(
            termo
        );

    }


    /* =========================
       CAMPO ESPECÍFICO
    ========================= */

    return String(
        valores[campo] || ""
    )
    .toLowerCase()
    .includes(
        termo
    );

}


/* =========================================================
   FILTRO POR DATA
========================================================= */

function correspondeData(
    avaria
) {

    if (
        !dataInicial.value &&
        !dataFinal.value
    ) {

        return true;

    }


    if (!avaria.criadoEm) {

        return false;

    }


    const dataRegistro =
        new Date(
            avaria.criadoEm
        );


    if (
        Number.isNaN(
            dataRegistro.getTime()
        )
    ) {

        return false;

    }


    if (dataInicial.value) {

        const inicio =
            inicioDiaSistema(dataInicial.value);


        if (
            dataRegistro <
            inicio
        ) {

            return false;

        }

    }


    if (dataFinal.value) {

        const fim =
            fimDiaSistema(dataFinal.value);


        if (
            dataRegistro >
            fim
        ) {

            return false;

        }

    }


    return true;

}


/* =========================================================
   SELEÇÃO
========================================================= */

function atualizarResumoSelecao() {

    qtdSelecionados.textContent =
        `(${selecionados.size})`;


    btnExcluirSelecionados.disabled =
        selecionados.size === 0;

}


function atualizarCheckboxMestre() {

    if (
        !registrosFiltrados.length
    ) {

        selecionarTodos.checked =
            false;

        selecionarTodos.indeterminate =
            false;

        return;

    }


    const idsVisiveis =
        registrosPaginaAtual.map(
            item =>
                String(
                    item.id
                )
        );


    const quantidadeSelecionada =
        idsVisiveis.filter(
            id =>
                selecionados.has(
                    id
                )
        ).length;


    selecionarTodos.checked =
        quantidadeSelecionada ===
        idsVisiveis.length;


    selecionarTodos.indeterminate =
        quantidadeSelecionada > 0 &&
        quantidadeSelecionada <
            idsVisiveis.length;

}


/* =========================================================
   REGISTROS
========================================================= */

function compararListas(a, b, campo, direcao = "asc") {
    let va;
    let vb;

    if (campo === "data") {
        va = new Date(a.movimentadoEm || a.criadoEm || 0).getTime();
        vb = new Date(b.movimentadoEm || b.criadoEm || 0).getTime();
        va = Number.isFinite(va) ? va : 0;
        vb = Number.isFinite(vb) ? vb : 0;
    } else if (campo === "quantidade") {
        va = numero(a.quantidade);
        vb = numero(b.quantidade);
    } else if (campo === "valor") {
        va = valorDaAvaria(a);
        vb = valorDaAvaria(b);
    } else {
        const campos = {
            codigo: "codigo",
            produto: "produto",
            fornecedor: "fornecedor",
            categoria: "categoria",
            codigoFornecedor: "codigoFornecedor",
            setor: "setor",
            tipo: "tipo",
            usuario: "usuarioLancamento"
        };
        va = String(a[campos[campo] || campo] || "");
        vb = String(b[campos[campo] || campo] || "");
        const comparacao = va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" });
        return direcao === "asc" ? comparacao : -comparacao;
    }

    if (va === vb) return 0;
    const resultado = va < vb ? -1 : 1;
    return direcao === "asc" ? resultado : -resultado;
}


function ordenarLista(lista, campo, direcao = "desc") {
    if (!campo) return lista;
    return lista.sort((a, b) => compararListas(a, b, campo, direcao));
}


function renderizarPaginacao(container, total, pagina, tamanho, onChange) {
    if (!container) return;

    const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
    const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
    const inicio = total ? ((paginaAtual - 1) * tamanho) + 1 : 0;
    const fim = total ? Math.min(paginaAtual * tamanho, total) : 0;

    if (!total) {
        container.innerHTML = "";
        return;
    }

    const botoes = [];
    const adicionar = (numeroPagina, texto, classe = "") => {
        botoes.push(`<button type="button" class="pagina-btn ${classe}" data-pagina="${numeroPagina}" ${numeroPagina === paginaAtual ? 'aria-current="page"' : ''}>${texto}</button>`);
    };

    adicionar(1, "«", paginaAtual === 1 ? "desabilitado" : "",);
    adicionar(Math.max(1, paginaAtual - 1), "‹", paginaAtual === 1 ? "desabilitado" : "");

    let paginas = [];
    if (totalPaginas <= 7) {
        paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);
    } else if (paginaAtual <= 4) {
        paginas = [1, 2, 3, 4, 5, "…", totalPaginas];
    } else if (paginaAtual >= totalPaginas - 3) {
        paginas = [1, "…", totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
    } else {
        paginas = [1, "…", paginaAtual - 1, paginaAtual, paginaAtual + 1, "…", totalPaginas];
    }

    paginas.forEach(item => {
        if (item === "…") {
            botoes.push('<span class="pagina-reticencias">…</span>');
        } else {
            adicionar(item, String(item), item === paginaAtual ? "ativo" : "");
        }
    });

    adicionar(Math.min(totalPaginas, paginaAtual + 1), "›", paginaAtual === totalPaginas ? "desabilitado" : "");
    adicionar(totalPaginas, "»", paginaAtual === totalPaginas ? "desabilitado" : "");

    container.innerHTML = `
        <div class="paginacao-info">Mostrando <strong>${inicio}–${fim}</strong> de <strong>${total}</strong></div>
        <div class="paginacao-controles">
            <label>Por página
                <select class="paginacao-tamanho">${PAGINACAO_TAMANHOS.map(opcao => `<option value="${opcao}" ${opcao === tamanho ? "selected" : ""}>${opcao}</option>`).join("")}</select>
            </label>
            <div class="paginacao-botoes">${botoes.join("")}</div>
        </div>`;

    container.querySelector(".paginacao-tamanho")?.addEventListener("change", event => {
        onChange(1, Number(event.target.value) || 25);
    });

    container.querySelectorAll(".pagina-btn").forEach(button => {
        button.addEventListener("click", () => {
            if (button.classList.contains("desabilitado")) return;
            onChange(Number(button.dataset.pagina) || 1, tamanho);
        });
    });
}


function atualizarResumoRegistros(lista) {
    const registros = Array.isArray(lista) ? lista : [];
    const quantidade = registros.reduce((soma, item) => soma + numero(item.quantidade), 0);
    const valor = registros.reduce((soma, item) => soma + valorDaAvaria(item), 0);
    if (resumoRegistrosFiltrados) resumoRegistrosFiltrados.textContent = registros.length;
    if (resumoQuantidadeRegistros) resumoQuantidadeRegistros.textContent = formatarQuantidade(quantidade);
    if (resumoValorRegistros) resumoValorRegistros.textContent = moeda(valor);
}


function configurarCabecalhosOrdenaveis(seletor, tipoTabela) {
    document.querySelectorAll(`${seletor} .th-ordenavel`).forEach(th => {
        if (th.dataset.ordenacaoConfigurada === "true") return;
        th.dataset.ordenacaoConfigurada = "true";
        th.addEventListener("click", () => {
            const campo = th.dataset.sortKey || "";
            const estado = tipoTabela === "registros" ? ordenacaoCabecalhoRegistros : ordenacaoCabecalhoHistorico;
            if (estado.campo === campo) {
                estado.direcao = estado.direcao === "asc" ? "desc" : "asc";
            } else {
                estado.campo = campo;
                estado.direcao = campo === "data" ? "desc" : "asc";
            }
            if (tipoTabela === "registros") {
                if (ordemRegistros) ordemRegistros.value = campo === "data" ? "data" : campo === "valor" || campo === "quantidade" || campo === "codigo" ? campo : "";
                if (direcaoRegistros) direcaoRegistros.value = estado.direcao;
                paginaRegistros = 1;
                renderizarRegistros();
            } else {
                if (ordemHistorico) ordemHistorico.value = campo || "data";
                if (direcaoHistorico) direcaoHistorico.value = estado.direcao;
                paginaHistorico = 1;
                renderizarHistorico();
            }
        });
    });
}


function atualizarIndicadoresOrdenacao(seletor, campo, direcao) {
    document.querySelectorAll(`${seletor} .th-ordenavel`).forEach(th => {
        const ativo = (th.dataset.sortKey || "") === campo;
        th.classList.toggle("ordenado", ativo);
        th.setAttribute("aria-sort", ativo ? (direcao === "asc" ? "ascending" : "descending") : "none");
    });
}


function atualizarFornecedoresRegistros() {
    if (!filtroFornecedorRegistros) return;
    const atual = filtroFornecedorRegistros.value || "Todos";
    const fornecedores = [...new Set(avarias.map(item => String(item.fornecedor || "").trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    filtroFornecedorRegistros.innerHTML = `<option value="Todos">Todos os fornecedores</option>` + fornecedores.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    if (fornecedores.includes(atual)) filtroFornecedorRegistros.value = atual;
}

function renderizarRegistros() {

    atualizarFornecedoresRegistros();

    const pesquisa = buscaRegistros.value.trim();
    const tipoSelecionado = filtroTipo.value;
    const statusSelecionado = filtroStatusRegistros?.value || "Todos";
    const caixaSelecionada = filtroCaixaRegistros?.value || "Todos";

    registrosFiltrados = avarias
        .filter(avariaVisivel)
        .filter(avaria => statusSelecionado === "Todos" || avaria.status === statusSelecionado)
        .filter(avaria => tipoSelecionado === "Todos" || avaria.tipo === tipoSelecionado)
        .filter(avaria => {
            const cat = filtroCategoriaRegistros?.value || "Todos";
            return cat === "Todos" || (avaria.categoria || "Mercearia") === cat;
        })
        .filter(avaria => {
            const fornecedor = filtroFornecedorRegistros?.value || "Todos";
            return fornecedor === "Todos" || String(avaria.fornecedor || "") === fornecedor;
        })
        .filter(avaria => {
            const setorSelecionado = filtroSetorRegistros?.value || "Todos";
            return setorSelecionado === "Todos" || String(avaria.setor || "") === setorSelecionado;
        })
        .filter(avaria => {
            if (caixaSelecionada === "com-caixa") return String(avaria.caixa || "").trim() !== "";
            if (caixaSelecionada === "sem-caixa") return String(avaria.caixa || "").trim() === "";
            return true;
        })
        .filter(correspondeData)
        .filter(avaria => correspondeBusca(avaria, pesquisa));

    const campoOrdem = ordemRegistros?.value || ordenacaoCabecalhoRegistros.campo || "";
    const direcaoOrdem = direcaoRegistros?.value || ordenacaoCabecalhoRegistros.direcao || "desc";
    if (campoOrdem) ordenarLista(registrosFiltrados, campoOrdem, direcaoOrdem);

    atualizarResumoRegistros(registrosFiltrados);
    contadorRegistros.textContent = registrosFiltrados.length;

    const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPaginaRegistros));
    paginaRegistros = Math.min(Math.max(1, paginaRegistros), totalPaginas);
    const inicio = (paginaRegistros - 1) * tamanhoPaginaRegistros;
    registrosPaginaAtual = registrosFiltrados.slice(inicio, inicio + tamanhoPaginaRegistros);

    atualizarResumoSelecao();
    atualizarIndicadoresOrdenacao(".tabela-registros", campoOrdem, direcaoOrdem);
    configurarCabecalhosOrdenaveis(".tabela-registros", "registros");
    renderizarPaginacao(
        paginacaoRegistros,
        registrosFiltrados.length,
        paginaRegistros,
        tamanhoPaginaRegistros,
        (novaPagina, novoTamanho) => {
            paginaRegistros = novaPagina;
            tamanhoPaginaRegistros = novoTamanho;
            renderizarRegistros();
        }
    );

    if (!registrosFiltrados.length) {
        tabelaRegistros.innerHTML = `
            <tr><td colspan="13" class="vazio">Nenhum registro encontrado.</td></tr>`;
        atualizarCheckboxMestre();
        return;
    }

    tabelaRegistros.innerHTML = registrosPaginaAtual.map(avaria => {
        const id = String(avaria.id);
        const marcado = selecionados.has(id) ? "checked" : "";
        return `
            <tr>
                <td class="col-selecao"><input type="checkbox" class="checkbox-registro" data-id="${esc(id)}" ${marcado} aria-label="Selecionar registro"></td>
                <td>${formatarData(avaria.criadoEm)}</td>
                <td>${esc(avaria.codigo || "-")}</td>
                <td>${esc(avaria.produto)}</td>
                <td>${esc(avaria.fornecedor || "-")}</td>
                <td>${usuarioEhAdmin ? `<select class="categoria-registro-select" data-id="${esc(id)}" aria-label="Alterar categoria do produto">${["Frios","Mercearia","Padaria","Limpeza","Bebidas"].map(cat => `<option value="${cat}" ${String(avaria.categoria || "Mercearia") === cat ? "selected" : ""}>${cat}</option>`).join("")}</select>` : esc(avaria.categoria || "Mercearia")}</td>
                <td>${esc(avaria.codigoFornecedor || "-")}</td>
                <td>${formatarQuantidade(avaria.quantidade)}</td>
                <td><strong>${moeda(valorDaAvaria(avaria))}</strong></td>
                <td>${esc(avaria.setor || "-")}</td>
                <td>${esc(avaria.tipo || "-")}</td>
                <td>${esc(avaria.usuarioLancamento || "-")}</td>
                <td><button type="button" class="btn-editar-baixa btn-editar-registro" onclick="excluirAvaria('${id}')">🗑 Excluir</button></td>
            </tr>`;
    }).join("");

    document.querySelectorAll(".checkbox-registro").forEach(checkbox => {
        checkbox.addEventListener("change", function() {
            const id = String(checkbox.dataset.id);
            if (checkbox.checked) selecionados.add(id);
            else selecionados.delete(id);
            atualizarResumoSelecao();
            atualizarCheckboxMestre();
        });
    });

    document.querySelectorAll(".categoria-registro-select").forEach(select => {
        select.addEventListener("change", async event => {
            await alterarCategoriaRegistro(select.dataset.id, event.target.value);
        });
    });

    atualizarCheckboxMestre();

}


/* =========================================================
   V13 - ALTERAR CATEGORIA PERMANENTE
========================================================= */

async function alterarCategoriaRegistro(id, categoria) {

    if (!usuarioEhAdmin) {
        mostrarToast("Somente o administrador pode alterar a categoria do produto.");
        return;
    }

    const registro = avarias.find(
        item => String(item.id) === String(id)
    );

    if (!registro || !registro.codigo) {
        mostrarToast("Não foi possível identificar o produto.");
        return;
    }

    try {
        const resposta = await fetch(
            `${API}/api/produtos/${encodeURIComponent(registro.codigo)}/categoria`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...headersAdminHistorico()
                },
                body: JSON.stringify({ categoria })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || "Erro ao alterar a categoria.");
        }

        avarias = avarias.map(item =>
            String(item.codigo) === String(registro.codigo)
                ? { ...item, categoria: dados.categoria }
                : item
        );

        historicoAvarias = historicoAvarias.map(item =>
            String(item.codigo) === String(registro.codigo)
                ? { ...item, categoria: dados.categoria }
                : item
        );

        renderizarTudo();
        mostrarToast(`Categoria de ${registro.produto} alterada para ${dados.categoria}.`);

    } catch (erro) {
        console.error("Erro ao alterar categoria:", erro);
        mostrarToast(erro.message);
    }
}

/* =========================================================
   HISTÓRICO DE REGISTROS
========================================================= */

function headersUsuarioAutenticado() {

    const headers = {};
    const token = dadosSessao?.token || "";

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;

}


function headersAdminHistorico() {

    return headersUsuarioAutenticado();

}


function normalizarTextoHistorico(
    valor
) {

    return String(
        valor || ""
    )
    .trim()
    .toLowerCase();

}


function atualizarOpcoesFornecedoresHistorico() {

    const selecionado =
        filtroHistoricoFornecedor.value;


    const fornecedores =
        Array.from(
            new Set(
                historicoAvarias
                    .map(
                        item =>
                            String(
                                item.fornecedor || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        )
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "pt-BR",
                    {
                        sensitivity:
                            "base"
                    }
                )
        );


    filtroHistoricoFornecedor.innerHTML =
        `
            <option value="">
                Todos os fornecedores
            </option>
        ` +
        fornecedores
            .map(
                fornecedor =>
                    `<option value="${esc(fornecedor)}">${esc(fornecedor)}</option>`
            )
            .join("");


    if (
        fornecedores.includes(
            selecionado
        )
    ) {

        filtroHistoricoFornecedor.value =
            selecionado;

    }

}


function atualizarOpcoesHistoricoInteligentes() {
    const atual = filtroHistoricoTipo?.value || "";
    const tipos = Array.from(new Set(historicoAvarias.map(item => String(item.tipo || "").trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    if (filtroHistoricoTipo) {
        filtroHistoricoTipo.innerHTML = `<option value="">Todos os motivos</option>` + tipos.map(tipo => `<option value="${esc(tipo)}">${esc(tipo)}</option>`).join("");
        if (tipos.includes(atual)) filtroHistoricoTipo.value = atual;
    }
}


function correspondeFiltrosHistorico(
    registro
) {

    const pesquisa = normalizarTextoHistorico(buscaHistorico.value);
    if (!correspondeBuscaHistorico(registro, pesquisa)) return false;

    const fornecedor = normalizarTextoHistorico(filtroHistoricoFornecedor.value);
    if (fornecedor && normalizarTextoHistorico(registro.fornecedor) !== fornecedor) return false;

    const codigoFornecedor = normalizarTextoHistorico(filtroHistoricoCodigoFornecedor.value);
    if (codigoFornecedor && !normalizarTextoHistorico(registro.codigoFornecedor).includes(codigoFornecedor)) return false;

    const codigoProduto = normalizarTextoHistorico(filtroHistoricoCodigoProduto.value);
    if (codigoProduto && !normalizarTextoHistorico(registro.codigo).includes(codigoProduto)) return false;

    const status = normalizarTextoHistorico(filtroHistoricoStatus?.value);
    if (status && normalizarTextoHistorico(registro.status) !== status) return false;

    const tipo = normalizarTextoHistorico(filtroHistoricoTipo?.value);
    if (tipo && normalizarTextoHistorico(registro.tipo) !== tipo) return false;

    const caixa = filtroHistoricoCaixa?.value || "";
    const possuiCaixa = String(registro.caixa || "").trim() !== "";
    if (caixa === "com-caixa" && !possuiCaixa) return false;
    if (caixa === "sem-caixa" && possuiCaixa) return false;

    const categoriaHistorico = normalizarTextoHistorico(filtroHistoricoCategoria?.value);
    if (categoriaHistorico && normalizarTextoHistorico(registro.categoria || "Mercearia") !== categoriaHistorico) return false;

    const setorHistorico = normalizarTextoHistorico(filtroHistoricoSetor?.value);
    if (setorHistorico && normalizarTextoHistorico(registro.setor) !== setorHistorico) return false;

    const dataRegistroValor = registro.movimentadoEm || registro.criadoEm;
    if (filtroHistoricoDataInicial.value || filtroHistoricoDataFinal.value) {
        const dataRegistro = new Date(dataRegistroValor);
        if (Number.isNaN(dataRegistro.getTime())) return false;
        if (filtroHistoricoDataInicial.value && dataRegistro < inicioDiaSistema(filtroHistoricoDataInicial.value)) return false;
        if (filtroHistoricoDataFinal.value && dataRegistro > fimDiaSistema(filtroHistoricoDataFinal.value)) return false;
    }

    return true;
}


function correspondeBuscaHistorico(
    registro,
    pesquisa
) {

    if (!pesquisa) {

        return true;

    }


    const termo =
        pesquisa
            .toLowerCase()
            .trim();


    const texto =
        [
            registro.codigo,
            registro.produto,
            registro.fornecedor,
            registro.codigoFornecedor,
            registro.tipo,
            registro.setor,
            registro.usuarioLancamento,
            registro.caixa,
            registro.observacao
        ]
        .map(
            valor =>
                String(
                    valor || ""
                )
                .toLowerCase()
        )
        .join(" ");


    return texto.includes(
        termo
    );

}


function atualizarResumoHistorico() {

    qtdHistoricoSelecionados.textContent =
        `(${historicoSelecionados.size})`;


    btnExcluirHistoricoSelecionados.disabled =
        !usuarioEhAdmin ||
        historicoSelecionados.size === 0;

}


function atualizarCheckboxMestreHistorico() {

    if (!historicoFiltrado.length) {

        selecionarTodosHistorico.checked =
            false;

        selecionarTodosHistorico.indeterminate =
            false;

        return;

    }


    const idsVisiveis =
        historicoPaginaAtual.map(
            item =>
                String(
                    item.id
                )
        );


    const quantidadeSelecionada =
        idsVisiveis.filter(
            id =>
                historicoSelecionados.has(
                    id
                )
        ).length;


    selecionarTodosHistorico.checked =
        quantidadeSelecionada ===
        idsVisiveis.length;


    selecionarTodosHistorico.indeterminate =
        quantidadeSelecionada > 0 &&
        quantidadeSelecionada <
            idsVisiveis.length;

}


function atualizarCardsBaixasHistorico(lista = historicoFiltrado) {

    const registros =
        Array.isArray(lista)
            ? lista
            : [];


    const quantidadeTotal =
        registros.reduce(
            (soma, registro) =>
                soma +
                numero(
                    registro.quantidade
                ),
            0
        );


    const valorTotal =
        registros.reduce(
            (soma, registro) =>
                soma +
                valorDaAvaria(
                    registro
                ),
            0
        );


    totalBaixas.textContent =
        registros.length;


    quantidadeBaixada.textContent =
        formatarQuantidade(
            quantidadeTotal
        );


    valorPerdido.textContent =
        moeda(
            valorTotal
        );

}


function renderizarHistorico() {

    const idsExistentes = new Set(historicoAvarias.map(item => String(item.id)));
    Array.from(historicoSelecionados).forEach(id => {
        if (!idsExistentes.has(id)) historicoSelecionados.delete(id);
    });

    atualizarOpcoesFornecedoresHistorico();
    atualizarOpcoesHistoricoInteligentes();

    historicoFiltrado = historicoAvarias.filter(registro => correspondeFiltrosHistorico(registro));

    const campoOrdem = ordemHistorico?.value || ordenacaoCabecalhoHistorico.campo || "data";
    const direcaoOrdem = direcaoHistorico?.value || ordenacaoCabecalhoHistorico.direcao || "desc";
    ordenarLista(historicoFiltrado, campoOrdem, direcaoOrdem);

    contadorHistorico.textContent = historicoFiltrado.length;
    atualizarCardsBaixasHistorico(historicoFiltrado);

    const totalPaginas = Math.max(1, Math.ceil(historicoFiltrado.length / tamanhoPaginaHistorico));
    paginaHistorico = Math.min(Math.max(1, paginaHistorico), totalPaginas);
    const inicio = (paginaHistorico - 1) * tamanhoPaginaHistorico;
    historicoPaginaAtual = historicoFiltrado.slice(inicio, inicio + tamanhoPaginaHistorico);

    atualizarResumoHistorico();
    atualizarIndicadoresOrdenacao(".tabela-historico", campoOrdem, direcaoOrdem);
    configurarCabecalhosOrdenaveis(".tabela-historico", "historico");
    renderizarPaginacao(
        paginacaoHistorico,
        historicoFiltrado.length,
        paginaHistorico,
        tamanhoPaginaHistorico,
        (novaPagina, novoTamanho) => {
            paginaHistorico = novaPagina;
            tamanhoPaginaHistorico = novoTamanho;
            renderizarHistorico();
        }
    );

    if (!historicoFiltrado.length) {
        tabelaHistorico.innerHTML = `<tr><td colspan="13" class="vazio">Nenhum registro encontrado no histórico.</td></tr>`;
        atualizarCheckboxMestreHistorico();
        return;
    }

    tabelaHistorico.innerHTML = historicoPaginaAtual.map(registro => {
        const id = String(registro.id);
        const marcado = historicoSelecionados.has(id) ? "checked" : "";
        const dataRegistro = registro.movimentadoEm || registro.criadoEm;
        return `
            <tr>
                <td class="col-selecao"><input type="checkbox" class="checkbox-historico" data-id="${esc(id)}" ${marcado} aria-label="Selecionar registro do histórico"></td>
                <td>${formatarData(dataRegistro)}</td>
                <td>${esc(registro.codigo || "-")}</td>
                <td>${esc(registro.produto || "-")}</td>
                <td>${esc(registro.fornecedor || "-")}</td>
                <td>${esc(registro.categoria || "Mercearia")}</td>
                <td>${esc(registro.codigoFornecedor || "-")}</td>
                <td>${formatarQuantidade(registro.quantidade)}</td>
                <td><strong>${moeda(valorDaAvaria(registro))}</strong></td>
                <td>${esc(registro.setor || "-")}</td>
                <td>${esc(registro.tipo || "-")}</td>
                <td>${esc(registro.usuarioLancamento || "-")}</td>
                <td class="somente-admin-historico">${usuarioEhAdmin ? `<button type="button" class="btn-editar-baixa" onclick="abrirModalEditarBaixa('${esc(id)}')">✏️ Editar</button>` : ""}</td>
            </tr>`;
    }).join("");

    document.querySelectorAll(".checkbox-historico").forEach(checkbox => {
        checkbox.addEventListener("change", function() {
            const id = String(checkbox.dataset.id);
            if (checkbox.checked) historicoSelecionados.add(id);
            else historicoSelecionados.delete(id);
            atualizarResumoHistorico();
            atualizarCheckboxMestreHistorico();
        });
    });

    atualizarCheckboxMestreHistorico();

}


function formatarDataParaInput(valor) {

    if (!valor) {
        return "";
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return "";
    }

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: SISTEMA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(data);
    const get = tipo => partes.find(item => item.type === tipo)?.value || "00";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}


function atualizarValorTotalEditarBaixa() {

    const quantidadeValor =
        Number(editarBaixaQuantidade?.value || 0);

    const unitarioValor =
        Number(editarBaixaValorUnitario?.value || 0);

    const total =
        (Number.isFinite(quantidadeValor) ? quantidadeValor : 0) *
        (Number.isFinite(unitarioValor) ? unitarioValor : 0);

    if (editarBaixaValorTotal) {
        editarBaixaValorTotal.textContent = moeda(total);
    }
}


function fecharModalEditarBaixa() {

    if (!modalEditarBaixa) {
        return;
    }

    modalEditarBaixa.classList.remove("ativo");
    modalEditarBaixa.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-aberto");
}


function abrirModalEditarBaixa(id) {

    if (!usuarioEhAdmin) {
        mostrarToast("Somente o administrador pode editar baixas.");
        return;
    }

    const registro =
        historicoAvarias.find(
            item => String(item.id) === String(id)
        );

    if (!registro) {
        mostrarToast("Registro da baixa não encontrado.");
        return;
    }

    editarBaixaId.value = String(registro.id || "");
    editarBaixaCodigo.value = registro.codigo || "";
    editarBaixaProduto.value = registro.produto || "";
    editarBaixaFornecedor.value = registro.fornecedor || "";
    editarBaixaCodigoFornecedor.value = registro.codigoFornecedor || "";
    editarBaixaCategoria.value = registro.categoria || "Mercearia";
    editarBaixaQuantidade.value = numero(registro.quantidade);
    editarBaixaValorUnitario.value = numero(registro.valorUnitario).toFixed(4);
    editarBaixaSetor.value = registro.setor || "";
    editarBaixaMotivo.value = registro.tipo || "Produto avariado";
    editarBaixaCaixa.value = registro.caixa || "";
    editarBaixaData.value = formatarDataParaInput(
        registro.movimentadoEm || registro.criadoEm
    );
    editarBaixaUsuario.value = registro.usuarioLancamento || "";
    editarBaixaObservacao.value = registro.observacao || "";

    // Mantém o campo de motivo utilizável mesmo quando existe um valor antigo
    // que não pertence à lista padrão.
    if (
        registro.tipo &&
        !Array.from(editarBaixaMotivo.options).some(
            option => option.value === registro.tipo
        )
    ) {
        const option = document.createElement("option");
        option.value = registro.tipo;
        option.textContent = registro.tipo;
        editarBaixaMotivo.appendChild(option);
        editarBaixaMotivo.value = registro.tipo;
    }

    atualizarValorTotalEditarBaixa();

    modalEditarBaixa.classList.add("ativo");
    modalEditarBaixa.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-aberto");

    setTimeout(() => {
        editarBaixaProduto?.focus();
        editarBaixaProduto?.select();
    }, 80);
}


async function salvarEdicaoBaixa(event) {

    event.preventDefault();

    if (!usuarioEhAdmin) {
        mostrarToast("Somente o administrador pode editar baixas.");
        return;
    }

    const id = String(editarBaixaId.value || "").trim();

    if (!id) {
        mostrarToast("Registro da baixa não informado.");
        return;
    }

    const quantidadeValor = Number(editarBaixaQuantidade.value);
    const valorUnitarioValor = Number(editarBaixaValorUnitario.value);

    if (!editarBaixaCodigo.value.trim() || !editarBaixaProduto.value.trim()) {
        mostrarToast("Informe o código e o produto.");
        return;
    }

    if (!Number.isFinite(quantidadeValor) || quantidadeValor <= 0) {
        mostrarToast("Informe uma quantidade válida.");
        return;
    }

    if (!Number.isFinite(valorUnitarioValor) || valorUnitarioValor < 0) {
        mostrarToast("Informe um valor de custo válido.");
        return;
    }

    btnSalvarEditarBaixa.disabled = true;
    btnSalvarEditarBaixa.textContent = "Salvando...";

    try {

        const resposta = await fetch(
            `${API}/api/historico-avarias/${encodeURIComponent(id)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...headersAdminHistorico()
                },
                cache: "no-store",
                body: JSON.stringify({
                    codigo: editarBaixaCodigo.value.trim(),
                    produto: editarBaixaProduto.value.trim(),
                    fornecedor: editarBaixaFornecedor.value.trim(),
                    codigoFornecedor: editarBaixaCodigoFornecedor.value.trim(),
                    categoria: editarBaixaCategoria.value,
                    quantidade: quantidadeValor,
                    valorUnitario: valorUnitarioValor,
                    setor: editarBaixaSetor.value.trim(),
                    tipo: editarBaixaMotivo.value.trim(),
                    caixa: editarBaixaCaixa.value.trim(),
                    observacao: editarBaixaObservacao.value.trim(),
                    dataBaixa: editarBaixaData.value || ""
                })
            }
        );

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.erro || "Erro ao salvar as alterações."
            );
        }

        // Atualização imediata na tela; o SSE também sincronizará os outros PCs.
        historicoAvarias = historicoAvarias.map(item =>
            String(item.id) === String(id)
                ? { ...item, ...dados }
                : item
        );

        fecharModalEditarBaixa();
        renderizarHistorico();

        await Promise.allSettled([
            carregarAvarias(),
            carregarHistorico()
        ]);

        mostrarToast("Baixa atualizada com sucesso.");

    } catch (erro) {

        console.error("Erro ao editar baixa:", erro);
        mostrarToast(erro.message || "Erro ao editar baixa.");

    } finally {

        btnSalvarEditarBaixa.disabled = false;
        btnSalvarEditarBaixa.textContent = "💾 Salvar alterações";

    }
}


function prepararModalEditarBaixa() {

    editarBaixaQuantidade?.addEventListener(
        "input",
        atualizarValorTotalEditarBaixa
    );

    editarBaixaValorUnitario?.addEventListener(
        "input",
        atualizarValorTotalEditarBaixa
    );

    formEditarBaixa?.addEventListener(
        "submit",
        salvarEdicaoBaixa
    );

    btnFecharEditarBaixa?.addEventListener(
        "click",
        fecharModalEditarBaixa
    );

    btnCancelarEditarBaixa?.addEventListener(
        "click",
        fecharModalEditarBaixa
    );

    modalEditarBaixa?.addEventListener(
        "click",
        event => {
            if (event.target?.dataset?.fecharModalEditar === "true") {
                fecharModalEditarBaixa();
            }
        }
    );

    btnExcluirBaixaModal?.addEventListener(
        "click",
        async () => {

            if (!usuarioEhAdmin) {
                mostrarToast("Somente o administrador pode excluir baixas.");
                return;
            }

            const id = String(editarBaixaId.value || "").trim();

            if (!id) {
                mostrarToast("Registro da baixa não informado.");
                return;
            }

            fecharModalEditarBaixa();
            await excluirHistorico(id);

        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                modalEditarBaixa?.classList.contains("ativo")
            ) {
                fecharModalEditarBaixa();
            }
        }
    );
}


async function excluirHistorico(
    id
) {

    if (!usuarioEhAdmin) {

        mostrarToast(
            "Somente o administrador pode excluir registros do histórico."
        );

        return;

    }


    const registro =
        historicoAvarias.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    id
                )
        );


    if (!registro) {

        mostrarToast(
            "Registro do histórico não encontrado."
        );

        return;

    }


    const confirmar =
        confirm(
            `Excluir definitivamente do histórico "${registro.produto}"?`
        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `${API}/api/historico-avarias/${encodeURIComponent(id)}`,
                {
                    method:
                        "DELETE",

                    headers:
                        headersAdminHistorico()
                }
            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(
                dados.erro ||
                "Erro ao excluir do histórico."
            );

        }


        historicoAvarias =
            historicoAvarias.filter(
                item =>
                    String(
                        item.id
                    ) !==
                    String(
                        id
                    )
            );


        historicoSelecionados.delete(
            String(id)
        );


        renderizarHistorico();


        mostrarToast(
            "Registro excluído do histórico."
        );


    } catch (erro) {

        console.error(
            "Erro ao excluir do histórico:",
            erro
        );


        mostrarToast(
            erro.message
        );

    }

}


/* =========================================================
   ÚLTIMOS LANÇAMENTOS
========================================================= */

function renderizarUltimosLancamentos() {

    const categoriaSelecionada =
        filtroCategoriaCadastro?.value || "Todos";


    const ultimos =
        [...avarias]

        .filter(
            avariaVisivel
        )

        .filter(
            avaria =>
                categoriaSelecionada === "Todos" ||
                (avaria.categoria || "Mercearia") === categoriaSelecionada
        )

        .sort(

            (a, b) =>

                new Date(
                    b.criadoEm || 0
                ).getTime()

                -

                new Date(
                    a.criadoEm || 0
                ).getTime()

        )

        .slice(
            0,
            5
        );


    if (!ultimos.length) {

        ultimosLancamentos.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="vazio"
                >
                    Nenhum lançamento realizado.
                </td>

            </tr>

        `;


        return;

    }


    ultimosLancamentos.innerHTML =

        ultimos

        .map(

            avaria => `

                <tr>

                    <td>
                        ${formatarData(
                            avaria.criadoEm
                        )}
                    </td>

                    <td class="codigo-ultimo">
                        ${esc(
                            avaria.codigo || "-"
                        )}
                    </td>

                    <td>
                        ${esc(
                            avaria.produto || "-"
                        )}
                    </td>

                    <td>
                        ${formatarQuantidade(
                            avaria.quantidade
                        )}
                    </td>

                    <td>
                        <strong>
                            ${moeda(
                                valorDaAvaria(
                                    avaria
                                )
                            )}
                        </strong>
                    </td>

                </tr>

            `

        )

        .join("");

}


/* =========================================================
   STATUS
========================================================= */

function classeStatus(
    valor
) {

    if (
        valor ===
        "Baixa"
    ) {

        return "baixa";

    }


    return "pendente";

}


/* =========================================================
   RENDERIZAR TUDO
========================================================= */

function renderizarTudo() {

    renderizarRegistros();

    renderizarHistorico();

    renderizarUltimosLancamentos();

}


/* =========================================================
   FILTROS
========================================================= */

function aplicarFiltrosRegistros() {

    selecionados.clear();
    paginaRegistros = 1;
    atualizarResumoSelecao();
    renderizarRegistros();

}


buscaRegistros.addEventListener(
    "input",
    aplicarFiltrosRegistros
);


campoPesquisa.addEventListener(
    "change",
    aplicarFiltrosRegistros
);



filtroTipo.addEventListener(
    "change",
    aplicarFiltrosRegistros
);

filtroFornecedorRegistros?.addEventListener("change", aplicarFiltrosRegistros);
filtroSetorRegistros?.addEventListener("change", aplicarFiltrosRegistros);
filtroStatusRegistros?.addEventListener("change", aplicarFiltrosRegistros);
filtroCaixaRegistros?.addEventListener("change", aplicarFiltrosRegistros);
filtroCategoriaRegistros?.addEventListener("change", aplicarFiltrosRegistros);


dataInicial.addEventListener(
    "change",
    aplicarFiltrosRegistros
);


dataFinal.addEventListener(
    "change",
    aplicarFiltrosRegistros
);

ordemRegistros?.addEventListener("change", renderizarRegistros);
direcaoRegistros?.addEventListener("change", renderizarRegistros);


selecionarTodos.addEventListener(

    "change",

    function() {

        registrosPaginaAtual.forEach(

            avaria => {

                const id =
                    String(
                        avaria.id
                    );


                if (
                    selecionarTodos.checked
                ) {

                    selecionados.add(
                        id
                    );

                } else {

                    selecionados.delete(
                        id
                    );

                }

            }

        );


        renderizarRegistros();

    }

);


function aplicarFiltrosHistorico() {

    historicoSelecionados.clear();
    paginaHistorico = 1;
    renderizarHistorico();

}


buscaHistorico.addEventListener(
    "input",
    aplicarFiltrosHistorico
);


filtroHistoricoFornecedor.addEventListener(
    "change",
    aplicarFiltrosHistorico
);


filtroHistoricoCodigoFornecedor.addEventListener(
    "input",
    aplicarFiltrosHistorico
);


filtroHistoricoCodigoProduto.addEventListener(
    "input",
    aplicarFiltrosHistorico
);


filtroHistoricoCategoria?.addEventListener(
    "change",
    aplicarFiltrosHistorico
);


filtroHistoricoSetor?.addEventListener(
    "change",
    aplicarFiltrosHistorico
);

filtroHistoricoStatus?.addEventListener(
    "change",
    aplicarFiltrosHistorico
);

filtroHistoricoTipo?.addEventListener(
    "change",
    aplicarFiltrosHistorico
);

filtroHistoricoCaixa?.addEventListener(
    "change",
    aplicarFiltrosHistorico
);


filtroHistoricoDataInicial.addEventListener(
    "change",
    aplicarFiltrosHistorico
);


filtroHistoricoDataFinal.addEventListener(
    "change",
    aplicarFiltrosHistorico
);

ordemHistorico?.addEventListener("change", () => {
    ordenacaoCabecalhoHistorico.campo = ordemHistorico.value || "data";
    paginaHistorico = 1;
    renderizarHistorico();
});

direcaoHistorico?.addEventListener("change", () => {
    ordenacaoCabecalhoHistorico.direcao = direcaoHistorico.value || "desc";
    paginaHistorico = 1;
    renderizarHistorico();
});


btnLimparFiltrosHistorico.addEventListener(

    "click",

    function() {

        buscaHistorico.value =
            "";

        filtroHistoricoFornecedor.value =
            "";

        filtroHistoricoCodigoFornecedor.value =
            "";

        filtroHistoricoCodigoProduto.value =
            "";

        if (filtroHistoricoCategoria) {
            filtroHistoricoCategoria.value = "";
        }

        if (filtroHistoricoSetor) {
            filtroHistoricoSetor.value = "";
        }

        filtroHistoricoDataInicial.value =
            "";

        filtroHistoricoDataFinal.value =
            "";

        if (filtroHistoricoStatus) filtroHistoricoStatus.value = "";
        if (filtroHistoricoTipo) filtroHistoricoTipo.value = "";
        if (filtroHistoricoCaixa) filtroHistoricoCaixa.value = "";
        if (ordemHistorico) ordemHistorico.value = "data";
        if (direcaoHistorico) direcaoHistorico.value = "desc";
        ordenacaoCabecalhoHistorico = { campo: "data", direcao: "desc" };
        paginaHistorico = 1;

        aplicarFiltrosHistorico();

    }

);


selecionarTodosHistorico.addEventListener(

    "change",

    function() {

        historicoPaginaAtual.forEach(

            registro => {

                const id =
                    String(
                        registro.id
                    );


                if (selecionarTodosHistorico.checked) {

                    historicoSelecionados.add(
                        id
                    );

                } else {

                    historicoSelecionados.delete(
                        id
                    );

                }

            }

        );


        renderizarHistorico();

    }

);


btnExcluirHistoricoSelecionados.addEventListener(

    "click",

    async function() {

        if (!usuarioEhAdmin) {

            mostrarToast(
                "Somente o administrador pode excluir registros do histórico."
            );

            return;

        }


        // A seleção visual é a fonte de verdade.
        const ids = Array.from(
            document.querySelectorAll(".checkbox-historico:checked")
        )
        .map(checkbox => String(checkbox.dataset.id || "").trim())
        .filter(Boolean);


        if (!ids.length) {

            historicoSelecionados.clear();
            atualizarResumoHistorico();

            mostrarToast(
                "Nenhum registro do histórico selecionado."
            );

            return;

        }


        historicoSelecionados = new Set(ids);
        atualizarResumoHistorico();


        const confirmar = confirm(
            `Excluir definitivamente ${ids.length} registro(s) do histórico?`
        );


        if (!confirmar) {
            return;
        }


        const textoOriginal =
            btnExcluirHistoricoSelecionados.innerHTML;

        btnExcluirHistoricoSelecionados.disabled = true;
        btnExcluirHistoricoSelecionados.textContent = "Excluindo...";

        const excluidos = [];
        const falhas = [];

        try {

            for (const id of ids) {

                try {

                    const resposta = await fetch(
                        `${API}/api/historico-avarias/${encodeURIComponent(id)}`,
                        {
                            method: "DELETE",
                            headers: {
                                ...headersAdminHistorico()
                            },
                            credentials: "include",
                            cache: "no-store"
                        }
                    );

                    const texto = await resposta.text();
                    let dados = null;
                    try { dados = JSON.parse(texto || "null"); } catch (_) {}

                    if (!resposta.ok) {
                        throw new Error(
                            dados?.erro ||
                            dados?.detalhe ||
                            `HTTP ${resposta.status}`
                        );
                    }

                    excluidos.push(id);

                } catch (erro) {

                    falhas.push({
                        id,
                        erro: erro.message || "Erro desconhecido"
                    });

                }

            }

            historicoSelecionados.clear();
            selecionarTodosHistorico.checked = false;
            selecionarTodosHistorico.indeterminate = false;

            // Recarrega a fonte oficial. O servidor agora respeita a marcação removido=TRUE.
            await carregarHistorico();

            if (falhas.length) {

                const detalhe = falhas[0]?.erro
                    ? ` Motivo: ${falhas[0].erro}`
                    : "";

                mostrarToast(
                    `${excluidos.length} excluído(s) e ${falhas.length} não pôde/puderam ser excluído(s) do histórico.${detalhe}`
                );

            } else {

                mostrarToast(
                    `${excluidos.length} registro(s) excluído(s) do histórico.`
                );

            }

        } finally {

            btnExcluirHistoricoSelecionados.innerHTML =
                textoOriginal;

            atualizarResumoHistorico();
            atualizarCheckboxMestreHistorico();

        }

    }

);


/* =========================================================
   EXCLUIR
========================================================= */

async function excluirAvaria(
    id
) {

    const registro =
        avarias.find(

            item =>

                String(
                    item.id
                )

                ===

                String(
                    id
                )

        );


    if (!registro) {

        mostrarToast(
            "Registro não encontrado."
        );


        return;

    }


    const confirmar =
        confirm(

            `Excluir "${registro.produto}"?`

        );


    if (!confirmar) {

        return;

    }


    try {

        const resposta =
            await fetch(

                `${API}/api/avarias/${encodeURIComponent(id)}`,

                {

                    method:
                        "DELETE",
                    headers:
                        headersUsuarioAutenticado(),
                    cache: "no-store"

                }

            );


        const dados =
            await resposta.json();


        if (!resposta.ok) {

            throw new Error(

                dados.erro

                ||

                "Erro ao excluir avaria."

            );

        }


        avarias =
            avarias.filter(

                item =>

                    String(
                        item.id
                    )

                    !==

                    String(
                        id
                    )

            );


        selecionados.delete(
            String(id)
        );


        renderizarTudo();


        await carregarHistorico();


        mostrarToast(
            "Registro excluído. Ele continua salvo no histórico."
        );


    } catch (erro) {

        console.error(
            "Erro ao excluir avaria:",
            erro
        );


        mostrarToast(
            erro.message
        );

    }

}

/* =========================================================
   EXCLUIR SELECIONADOS
========================================================= */

btnExcluirSelecionados.addEventListener(

    "click",

    async function() {

        // A seleção visual da tabela é a fonte de verdade.
        // Isso evita IDs antigos ficarem no Set após uma atualização em tempo real.
        const ids = Array.from(
            document.querySelectorAll(".checkbox-registro:checked")
        )
        .map(checkbox => String(checkbox.dataset.id || "").trim())
        .filter(Boolean);


        if (!ids.length) {

            selecionados.clear();
            atualizarResumoSelecao();

            mostrarToast(
                "Nenhum registro selecionado."
            );

            return;

        }


        selecionados = new Set(ids);
        atualizarResumoSelecao();


        const confirmar =
            confirm(
                `Deseja excluir ${ids.length} registro(s) selecionado(s)?`
            );


        if (!confirmar) {

            return;

        }


        const textoOriginal =
            btnExcluirSelecionados.innerHTML;


        btnExcluirSelecionados.disabled =
            true;


        btnExcluirSelecionados.textContent =
            "Excluindo...";


        const excluidos = [];
        const falhas = [];


        try {

            for (const id of ids) {

                try {

                    const resposta = await fetch(
                        `${API}/api/avarias/${encodeURIComponent(id)}`,
                        {
                            method: "DELETE",
                            headers: {
                                ...headersUsuarioAutenticado()
                            },
                            credentials: "include",
                            cache: "no-store"
                        }
                    );


                    const texto = await resposta.text();
                    let dados = null;

                    try {
                        dados = JSON.parse(texto || "null");
                    } catch (_) {}


                    if (!resposta.ok) {
                        throw new Error(
                            dados?.erro ||
                            dados?.detalhe ||
                            `HTTP ${resposta.status}`
                        );
                    }


                    excluidos.push(id);


                } catch (erro) {

                    falhas.push({
                        id,
                        erro: erro.message || "Erro desconhecido"
                    });

                }

            }


            // Não dependemos de renderização otimista. Recarregamos a fonte oficial.
            selecionados.clear();
            selecionarTodos.checked = false;
            selecionarTodos.indeterminate = false;

            await Promise.allSettled([
                carregarAvarias(),
                carregarHistorico()
            ]);


            if (falhas.length) {

                const detalhe = falhas[0]?.erro
                    ? ` Motivo: ${falhas[0].erro}`
                    : "";

                mostrarToast(
                    `${excluidos.length} excluído(s) e ${falhas.length} não pôde/puderam ser excluído(s).${detalhe}`
                );

            } else {

                mostrarToast(
                    `${excluidos.length} registro(s) excluído(s). O histórico foi preservado.`
                );

            }


        } finally {

            btnExcluirSelecionados.innerHTML =
                textoOriginal;

            atualizarResumoSelecao();
            atualizarCheckboxMestre();

        }

    }

);

/* =========================================================
   LIMPAR FILTROS
========================================================= */

filtroCategoriaCadastro?.addEventListener(
    "change",
    renderizarUltimosLancamentos
);


btnLimparFiltros.addEventListener(

    "click",

    function() {

        buscaRegistros.value =
            "";


        campoPesquisa.value =
            "todos";



        filtroTipo.value =
            "Todos";

        if (filtroFornecedorRegistros) filtroFornecedorRegistros.value = "Todos";
        if (filtroSetorRegistros) filtroSetorRegistros.value = "Todos";


        dataInicial.value =
            "";


        dataFinal.value =
            "";

        if (ordemRegistros) ordemRegistros.value = "";
        if (direcaoRegistros) direcaoRegistros.value = "desc";
        if (filtroStatusRegistros) filtroStatusRegistros.value = "Todos";
        if (filtroCaixaRegistros) filtroCaixaRegistros.value = "Todos";
        if (filtroCategoriaRegistros) filtroCategoriaRegistros.value = "Todos";
        paginaRegistros = 1;
        ordenacaoCabecalhoRegistros = { campo: "", direcao: "desc" };

        selecionados.clear();


        atualizarResumoSelecao();


        renderizarRegistros();


        buscaRegistros.focus();

    }

);



/* =========================================================
   V13 - EXPORTAÇÃO DAS BAIXAS
========================================================= */

function obterBaixasParaExportacao() {
    const selecionadosFiltrados = historicoFiltrado.filter(
        registro => historicoSelecionados.has(String(registro.id))
    );
    return selecionadosFiltrados.length ? selecionadosFiltrados : historicoFiltrado;
}

function consolidarRegistrosExportacao(lista) {
    const mapa = new Map();

    for (const registro of lista) {
        const chave = String(
            registro.codigo || registro.produto || ""
        ).trim().toLowerCase();

        if (!chave) continue;

        if (!mapa.has(chave)) {
            mapa.set(chave, {
                data: formatarData(registro.movimentadoEm || registro.criadoEm),
                codigo: registro.codigo || "",
                produto: registro.produto || "",
                fornecedor: registro.fornecedor || "",
                categoria: registro.categoria || "Mercearia",
                codigoFornecedor: registro.codigoFornecedor || "",
                quantidade: numero(registro.quantidade),
                valorUnitario: numero(registro.valorUnitario),
                valorTotal: valorDaAvaria(registro),
                setor: registro.setor || "",
                tipo: registro.tipo || "",
                usuario: registro.usuarioLancamento || "",
                caixa: registro.caixa || "",
                status: registro.status || ""
            });
        } else {
            const atual = mapa.get(chave);
            atual.quantidade += numero(registro.quantidade);
            atual.valorTotal += valorDaAvaria(registro);
        }
    }

    return Array.from(mapa.values());
}

async function exportarBaixasXlsx() {
    const base = obterBaixasParaExportacao();
    if (!base.length) {
        mostrarToast("Selecione os itens que deseja exportar.");
        return;
    }

    try {
        btnExportarBaixasXlsx.disabled = true;
        btnExportarBaixasXlsx.textContent = "Gerando Excel...";

        const resposta = await fetch(
            `${API}/api/avarias/exportar`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headersUsuarioAutenticado()
                },
                body: JSON.stringify({
                    registros: consolidarRegistrosExportacao(base)
                })
            }
        );

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            throw new Error(erro.erro || "Erro ao gerar Excel.");
        }

        const arquivo = await resposta.blob();
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = `baixas_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        mostrarToast("Excel das baixas exportado com sucesso.");

    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message);
    } finally {
        btnExportarBaixasXlsx.disabled = false;
        btnExportarBaixasXlsx.textContent = "📊 Exportar Excel";
    }
}

async function exportarBaixasPdf() {
    const base = obterBaixasParaExportacao();
    if (!base.length) {
        mostrarToast("Selecione os itens que deseja exportar.");
        return;
    }

    try {
        btnExportarBaixasPdf.disabled = true;
        btnExportarBaixasPdf.textContent = "Gerando PDF...";

        const resposta = await fetch(
            `${API}/api/avarias/exportar-pdf`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headersUsuarioAutenticado()
                },
                body: JSON.stringify({
                    registros: consolidarRegistrosExportacao(base)
                })
            }
        );

        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}));
            throw new Error(erro.erro || "Erro ao gerar PDF.");
        }

        const arquivo = await resposta.blob();
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = `baixas_${new Date().toISOString().slice(0,10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        mostrarToast("PDF das baixas exportado com sucesso.");

    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message);
    } finally {
        btnExportarBaixasPdf.disabled = false;
        btnExportarBaixasPdf.textContent = "📄 Exportar PDF";
    }
}

btnExportarBaixasXlsx?.addEventListener("click", exportarBaixasXlsx);
btnExportarBaixasPdf?.addEventListener("click", exportarBaixasPdf);


/* =========================================================
   COMPARTILHAR REGISTROS
   Excel + PDF
========================================================= */

function obterRegistrosSelecionadosParaCompartilhar() {
    renderizarRegistros();

    const selecionadosParaCompartilhar = registrosFiltrados.filter(
        avaria => selecionados.has(String(avaria.id))
    );

    return selecionadosParaCompartilhar.length
        ? selecionadosParaCompartilhar
        : registrosFiltrados;
}

function fecharMenuCompartilhar() {
    if (!menuCompartilhar || !btnCompartilhar) return;
    menuCompartilhar.hidden = true;
    btnCompartilhar.setAttribute("aria-expanded", "false");
}

btnCompartilhar?.addEventListener("click", (evento) => {
    evento.stopPropagation();
    if (!menuCompartilhar) return;
    const aberto = !menuCompartilhar.hidden;
    menuCompartilhar.hidden = aberto;
    btnCompartilhar.setAttribute("aria-expanded", String(!aberto));
});

document.addEventListener("click", (evento) => {
    if (!evento.target.closest?.(".compartilhar-registros")) {
        fecharMenuCompartilhar();
    }
});

async function exportarRegistrosXlsx() {
    const selecionadosParaExportar = obterRegistrosSelecionadosParaCompartilhar();
    if (!selecionadosParaExportar) return;

    const textoOriginal = btnCompartilharXlsx?.textContent || "📊 Excel (XLSX)";
    if (btnCompartilharXlsx) {
        btnCompartilharXlsx.disabled = true;
        btnCompartilharXlsx.textContent = "Gerando Excel...";
    }

    try {
        const registros = selecionadosParaExportar.map(avaria => ({
            data: formatarData(avaria.criadoEm),
            codigo: avaria.codigo || "",
            produto: avaria.produto || "",
            fornecedor: avaria.fornecedor || "",
            categoria: avaria.categoria || "Mercearia",
            codigoFornecedor: avaria.codigoFornecedor || "",
            quantidade: numero(avaria.quantidade),
            valorUnitario: numero(avaria.valorUnitario),
            valorTotal: valorDaAvaria(avaria),
            setor: avaria.setor || "",
            tipo: avaria.tipo || "",
            usuario: avaria.usuarioLancamento || "",
            caixa: avaria.caixa || "",
            status: avaria.status || "",
            observacao: avaria.observacao || ""
        }));

        const agrupados = new Map();
        for (const registro of registros) {
            const chave = String(registro.codigo || registro.produto || "").trim().toLowerCase();
            if (!chave) continue;
            if (!agrupados.has(chave)) {
                agrupados.set(chave, {
                    ...registro,
                    quantidade: numero(registro.quantidade),
                    valorTotal: numero(registro.valorTotal)
                });
            } else {
                const atual = agrupados.get(chave);
                atual.quantidade += numero(registro.quantidade);
                atual.valorTotal += numero(registro.valorTotal);
            }
        }

        const registrosAgrupados = Array.from(agrupados.values());
        const resposta = await fetch(`${API}/api/avarias/exportar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headersUsuarioAutenticado()
            },
            credentials: "include",
            body: JSON.stringify({ registros: registrosAgrupados })
        });

        if (!resposta.ok) {
            let mensagem = "Erro ao gerar XLSX.";
            try {
                const erro = await resposta.json();
                mensagem = erro.erro || mensagem;
            } catch {}
            throw new Error(mensagem);
        }

        const arquivo = await resposta.blob();
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = `avarias_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        mostrarToast(`${registrosAgrupados.length} item(ns) compartilhado(s) em Excel.`);
        fecharMenuCompartilhar();
    } catch (erro) {
        console.error("Erro ao compartilhar em Excel:", erro);
        mostrarToast(erro.message || "Erro ao gerar Excel.");
    } finally {
        if (btnCompartilharXlsx) {
            btnCompartilharXlsx.disabled = false;
            btnCompartilharXlsx.textContent = textoOriginal;
        }
    }
}

async function exportarRegistrosPdf() {
    const selecionadosParaExportar = obterRegistrosSelecionadosParaCompartilhar();
    if (!selecionadosParaExportar) return;

    const textoOriginal = btnCompartilharPdf?.textContent || "📄 PDF";
    if (btnCompartilharPdf) {
        btnCompartilharPdf.disabled = true;
        btnCompartilharPdf.textContent = "Gerando PDF...";
    }

    try {
        const registros = selecionadosParaExportar.map(avaria => ({
            data: formatarData(avaria.criadoEm),
            codigo: avaria.codigo || "",
            produto: avaria.produto || "",
            fornecedor: avaria.fornecedor || "",
            categoria: avaria.categoria || "Mercearia",
            codigoFornecedor: avaria.codigoFornecedor || "",
            quantidade: numero(avaria.quantidade),
            valorUnitario: numero(avaria.valorUnitario),
            valorTotal: valorDaAvaria(avaria),
            setor: avaria.setor || "",
            tipo: avaria.tipo || "",
            usuario: avaria.usuarioLancamento || "",
            caixa: avaria.caixa || "",
            status: avaria.status || "",
            observacao: avaria.observacao || ""
        }));

        const resposta = await fetch(`${API}/api/avarias/exportar-pdf-registros`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headersUsuarioAutenticado()
            },
            credentials: "include",
            body: JSON.stringify({ registros })
        });

        if (!resposta.ok) {
            let mensagem = "Erro ao gerar PDF.";
            try {
                const erro = await resposta.json();
                mensagem = erro.erro || mensagem;
            } catch {}
            throw new Error(mensagem);
        }

        const arquivo = await resposta.blob();
        const url = URL.createObjectURL(arquivo);
        const link = document.createElement("a");
        link.href = url;
        link.download = `avarias_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);

        mostrarToast(`${registros.length} registro(s) compartilhado(s) em PDF.`);
        fecharMenuCompartilhar();
    } catch (erro) {
        console.error("Erro ao compartilhar em PDF:", erro);
        mostrarToast(erro.message || "Erro ao gerar PDF.");
    } finally {
        if (btnCompartilharPdf) {
            btnCompartilharPdf.disabled = false;
            btnCompartilharPdf.textContent = textoOriginal;
        }
    }
}

btnCompartilharXlsx?.addEventListener("click", exportarRegistrosXlsx);
btnCompartilharPdf?.addEventListener("click", exportarRegistrosPdf);


/* =========================================================
   PAINÉIS DE FILTROS FLUTUANTES
========================================================= */

function alternarPainelFiltros(botao, painel) {
    if (!botao || !painel) return;
    const aberto = painel.classList.toggle("aberto");
    botao.classList.toggle("ativo", aberto);
    botao.setAttribute("aria-expanded", String(aberto));
}

function fecharPainelFiltros(painel, botao) {
    if (!painel || !botao) return;
    painel.classList.remove("aberto");
    botao.classList.remove("ativo");
    botao.setAttribute("aria-expanded", "false");
}

btnFiltrosRegistros?.addEventListener("click", () => alternarPainelFiltros(btnFiltrosRegistros, painelFiltrosRegistros));
btnFiltrosBaixas?.addEventListener("click", () => alternarPainelFiltros(btnFiltrosBaixas, painelFiltrosBaixas));

botoesAbas.forEach(botao => {
    botao.addEventListener("click", () => {
        setTimeout(() => {
            if (botao.dataset.aba !== "registros") fecharPainelFiltros(painelFiltrosRegistros, btnFiltrosRegistros);
            if (botao.dataset.aba !== "baixas") fecharPainelFiltros(painelFiltrosBaixas, btnFiltrosBaixas);
        }, 0);
    });
});

function atualizarStatusConexao(estado, texto) {
    if (!statusConexao) return;
    statusConexao.classList.remove("status-online", "status-offline", "status-reconectando");
    statusConexao.classList.add(`status-${estado}`);
    statusConexao.textContent = `● ${texto}`;
}


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
   ATALHOS DO CADASTRO
========================================================= */

document.addEventListener(

    "keydown",

    function(event) {

        if (
            event.key === "F2"
        ) {

            event.preventDefault();


            abrirAba(
                "cadastro"
            );


            codigoProduto.focus();

            codigoProduto.select();


            return;

        }


        if (
            event.key !== "Escape"
        ) {

            return;

        }


        const cadastroAtivo =
            document
                .getElementById(
                    "abaCadastro"
                )
                .classList
                .contains(
                    "ativo"
                );


        if (!cadastroAtivo) {

            return;

        }


        event.preventDefault();


        resetarCadastro();


        mostrarToast(
            "Lançamento limpo. Digite ou bipe o próximo código."
        );

    }

);


/* =========================================================
   ATUALIZAÇÃO EM TEMPO REAL ENTRE OS PCS
========================================================= */

let timerAtualizacaoTempoReal =
    null;


function agendarAtualizacaoTempoReal() {

    clearTimeout(
        timerAtualizacaoTempoReal
    );


    timerAtualizacaoTempoReal =
        setTimeout(

            async () => {

                await Promise.allSettled([
                    carregarAvarias(),
                    carregarHistorico()
                ]);

            },

            120

        );

}


function iniciarTempoReal() {

    if (typeof EventSource === "undefined") {
        atualizarStatusConexao("offline", "Tempo real indisponível");
        return;
    }

    const eventos = new EventSource(`${API}/api/eventos`);

    eventos.addEventListener("open", () => {
        atualizarStatusConexao("online", "Tempo real conectado");
    });

    eventos.addEventListener("conectado", () => {
        atualizarStatusConexao("online", "Tempo real conectado");
    });

    eventos.addEventListener("error", () => {
        atualizarStatusConexao("reconectando", "Reconectando...");
    });

    [
        "avarias-atualizadas",
        "historico-atualizado",
        "produtos-atualizados"
    ].forEach(tipoEvento => {
        eventos.addEventListener(tipoEvento, agendarAtualizacaoTempoReal);
    });

}


/* =========================================================
   INICIAR
========================================================= */

prepararModalEditarBaixa();


async function iniciar() {

    limparProduto();


    await Promise.allSettled([
        carregarAvarias(),
        carregarHistorico()
    ]);


    abrirAba(
        "cadastro"
    );


    iniciarTempoReal();

}


iniciar();

// V20.9: confirma a permissão real no servidor.
sincronizarPermissaoAdminHistorico();
