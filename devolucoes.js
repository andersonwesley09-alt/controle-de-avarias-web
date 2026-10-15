const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraSistema === "function") return window.formatarDataHoraSistema(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.3 - base consolidada, sessão centralizada e histórico corrigido */
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


/* =========================
   DADOS
========================= */

let avarias =
    carregarAvarias();


/* =========================
   ELEMENTOS
========================= */

const totalPendentes =
    document.getElementById(
        "totalPendentes"
    );


const valorPendente =
    document.getElementById(
        "valorPendente"
    );


const totalDevolucoes =
    document.getElementById(
        "totalDevolucoes"
    );


const valorDevolucoes =
    document.getElementById(
        "valorDevolucoes"
    );


const buscaPendentes =
    document.getElementById(
        "buscaPendentes"
    );


const buscaHistorico =
    document.getElementById(
        "buscaHistorico"
    );


const tabelaPendentes =
    document.getElementById(
        "tabelaPendentes"
    );


const tabelaHistorico =
    document.getElementById(
        "tabelaHistorico"
    );


const btnSair =
    document.getElementById(
        "btnSair"
    );


const toastElemento =
    document.getElementById(
        "toast"
    );


/* =========================
   CARREGAR AVARIAS
========================= */

function carregarAvarias() {

    try {

        const dados =
            JSON.parse(
                localStorage.getItem(
                    "avarias"
                ) || "[]"
            );


        return Array.isArray(
            dados
        )
            ? dados
            : [];

    }

    catch (erro) {

        console.error(
            "Erro ao carregar avarias:",
            erro
        );


        return [];

    }

}


/* =========================
   SALVAR
========================= */

function salvarAvarias() {

    localStorage.setItem(

        "avarias",

        JSON.stringify(
            avarias
        )

    );

}


/* =========================
   NÚMEROS
========================= */

function numero(valor) {

    const convertido =
        Number(valor);


    return Number.isFinite(
        convertido
    )
        ? convertido
        : 0;

}


/* =========================
   TOTAL
========================= */

function calcularValorTotal(
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


/* =========================
   MOEDA
========================= */

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


/* =========================
   DATA
========================= */

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


/* =========================
   PROTEÇÃO HTML
========================= */

function esc(valor) {

    return String(
        valor ?? ""
    )
    .replace(

        /[&<>"']/g,

        caractere =>
            ({

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
   PENDENTES
========================= */

function obterPendentes() {

    return avarias.filter(

        avaria =>
            avaria.status ===
            "Pendente"

    );

}


/* =========================
   DEVOLUÇÕES
========================= */

function obterDevolucoes() {

    return avarias.filter(

        avaria =>
            avaria.status ===
            "Devolução"

    );

}


/* =========================
   RESUMO
========================= */

function atualizarResumo() {

    const pendentes =
        obterPendentes();


    const devolucoes =
        obterDevolucoes();


    const totalValorPendente =
        pendentes.reduce(

            (soma, avaria) =>

                soma +
                calcularValorTotal(
                    avaria
                ),

            0

        );


    const totalValorDevolucoes =
        devolucoes.reduce(

            (soma, avaria) =>

                soma +
                calcularValorTotal(
                    avaria
                ),

            0

        );


    totalPendentes.textContent =
        pendentes.length;


    valorPendente.textContent =
        moeda(
            totalValorPendente
        );


    totalDevolucoes.textContent =
        devolucoes.length;


    valorDevolucoes.textContent =
        moeda(
            totalValorDevolucoes
        );

}


/* =========================
   FILTRAR PENDENTES
========================= */

function pendentesFiltrados() {

    const termo =
        buscaPendentes.value
            .trim()
            .toLowerCase();


    return obterPendentes()
        .filter(

            avaria => {

                const conteudo =
                    [

                        avaria.produto,

                        avaria.fornecedor,

                        avaria.tipo,

                        avaria.setor,

                        avaria.caixa

                    ]

                    .join(" ")

                    .toLowerCase();


                return (
                    !termo ||
                    conteudo.includes(
                        termo
                    )
                );

            }

        );

}


/* =========================
   RENDER PENDENTES
========================= */

function renderizarPendentes() {

    const lista =
        pendentesFiltrados();


    if (!lista.length) {

        tabelaPendentes.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="vazio"
                >
                    Nenhuma avaria pendente.
                </td>

            </tr>

        `;


        return;

    }


    tabelaPendentes.innerHTML =

        lista.map(

            avaria => {

                const total =
                    calcularValorTotal(
                        avaria
                    );


                return `

                    <tr>

                        <td>
                            ${formatarData(
                                avaria.criadoEm
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.produto
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.fornecedor
                            )}
                        </td>


                        <td>
                            ${numero(
                                avaria.quantidade
                            )}
                        </td>


                        <td>
                            ${moeda(
                                avaria.valorUnitario
                            )}
                        </td>


                        <td>

                            <strong>
                                ${moeda(total)}
                            </strong>

                        </td>


                        <td>
                            ${esc(
                                avaria.tipo
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.setor
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.caixa ||
                                "-"
                            )}
                        </td>


                        <td>

                            <button
                                type="button"
                                class="btn-devolver"
                                onclick="registrarDevolucao('${avaria.id}')"
                            >
                                Devolver
                            </button>

                        </td>

                    </tr>

                `;

            }

        )

        .join("");

}


/* =========================
   HISTÓRICO FILTRADO
========================= */

function devolucoesFiltradas() {

    const termo =
        buscaHistorico.value
            .trim()
            .toLowerCase();


    return obterDevolucoes()
        .filter(

            avaria => {

                const conteudo =
                    [

                        avaria.produto,

                        avaria.fornecedor,

                        avaria.tipo,

                        avaria.setor,

                        avaria.caixa

                    ]

                    .join(" ")

                    .toLowerCase();


                return (
                    !termo ||
                    conteudo.includes(
                        termo
                    )
                );

            }

        );

}


/* =========================
   RENDER HISTÓRICO
========================= */

function renderizarHistorico() {

    const lista =
        devolucoesFiltradas();


    lista.sort(

        (a, b) => {

            const dataA =
                new Date(
                    a.movimentadoEm ||
                    a.criadoEm ||
                    0
                );


            const dataB =
                new Date(
                    b.movimentadoEm ||
                    b.criadoEm ||
                    0
                );


            return (
                dataB -
                dataA
            );

        }

    );


    if (!lista.length) {

        tabelaHistorico.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    class="vazio"
                >
                    Nenhuma devolução registrada.
                </td>

            </tr>

        `;


        return;

    }


    tabelaHistorico.innerHTML =

        lista.map(

            avaria => {

                const total =
                    calcularValorTotal(
                        avaria
                    );


                return `

                    <tr>

                        <td>
                            ${formatarData(
                                avaria.movimentadoEm
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.produto
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.fornecedor
                            )}
                        </td>


                        <td>
                            ${numero(
                                avaria.quantidade
                            )}
                        </td>


                        <td>
                            ${moeda(
                                avaria.valorUnitario
                            )}
                        </td>


                        <td>

                            <strong>
                                ${moeda(total)}
                            </strong>

                        </td>


                        <td>
                            ${esc(
                                avaria.tipo
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.setor
                            )}
                        </td>


                        <td>
                            ${esc(
                                avaria.caixa ||
                                "-"
                            )}
                        </td>

                    </tr>

                `;

            }

        )

        .join("");

}


/* =========================
   REGISTRAR DEVOLUÇÃO
========================= */

function registrarDevolucao(
    id
) {

    const avaria =
        avarias.find(

            item =>
                String(item.id) ===
                String(id)

        );


    if (!avaria) {

        mostrarToast(
            "Avaria não encontrada."
        );

        return;

    }


    if (
        avaria.status !==
        "Pendente"
    ) {

        mostrarToast(
            "Este registro já foi movimentado."
        );

        return;

    }


    const total =
        calcularValorTotal(
            avaria
        );


    const confirmar =
        confirm(

            `Confirmar devolução?\n\n` +

            `Produto: ${avaria.produto}\n` +

            `Fornecedor: ${avaria.fornecedor}\n` +

            `Quantidade: ${avaria.quantidade}\n` +

            `Valor: ${moeda(total)}`

        );


    if (!confirmar) {

        return;

    }


    avaria.status =
        "Devolução";


    avaria.movimentadoEm =
        new Date()
            .toISOString();


    salvarAvarias();


    renderizar();


    mostrarToast(
        "Devolução registrada com sucesso."
    );

}


/* =========================
   BUSCAS
========================= */

buscaPendentes.addEventListener(

    "input",

    renderizarPendentes

);


buscaHistorico.addEventListener(

    "input",

    renderizarHistorico

);


/* =========================
   TOAST
========================= */

let timerToast;


function mostrarToast(
    mensagem
) {

    toastElemento.textContent =
        mensagem;


    toastElemento.classList.add(
        "ativo"
    );


    clearTimeout(
        timerToast
    );


    timerToast =
        setTimeout(

            function () {

                toastElemento
                    .classList
                    .remove(
                        "ativo"
                    );

            },

            2500

        );

}


/* =========================
   SAIR
========================= */

btnSair.addEventListener(

    "click",

    function () {

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


/* =========================
   RENDER GERAL
========================= */

function renderizar() {

    avarias =
        carregarAvarias();


    atualizarResumo();


    renderizarPendentes();


    renderizarHistorico();

}


/* =========================
   ATUALIZAÇÃO ENTRE ABAS
========================= */

window.addEventListener(

    "storage",

    renderizar

);


/* =========================
   INICIAR
========================= */

renderizar();