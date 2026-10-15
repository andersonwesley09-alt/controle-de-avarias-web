/* BUILD V20.1 - base consolidada, sessão centralizada e histórico corrigido */
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
if (dadosSessao.perfil !== "admin" || !dadosSessao.token) {
    window.location.href = "sistema.html";
    throw new Error("Acesso administrativo necessário.");
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


const arquivoProdutos =
    document.getElementById(
        "arquivoProdutos"
    );


const btnImportar =
    document.getElementById(
        "btnImportar"
    );


const totalProdutos =
    document.getElementById(
        "totalProdutos"
    );


const produtosAtivos =
    document.getElementById(
        "produtosAtivos"
    );


const carregando =
    document.getElementById(
        "carregando"
    );


const resultado =
    document.getElementById(
        "resultado"
    );


/* =========================
   RESUMO
========================= */

async function carregarResumo() {

    try {

        const resposta =
            await fetch(
                `${API}/api/produtos/resumo`,
                { headers: { "Authorization": `Bearer ${dadosSessao.token}` }, cache: "no-store" }
            );


        const dados =
            await resposta.json();


        totalProdutos.textContent =
            dados.total;


        produtosAtivos.textContent =
            dados.ativos;


    } catch (erro) {

        console.error(
            erro
        );

        totalProdutos.textContent =
            "Erro";

    }

}


/* =========================
   ARQUIVO
========================= */

arquivoProdutos.addEventListener(
    "change",

    function () {

        btnImportar.disabled =
            !arquivoProdutos.files.length;


        resultado.classList.add(
            "oculto"
        );

    }
);


/* =========================
   IMPORTAR
========================= */

btnImportar.addEventListener(
    "click",

    async function () {

        const arquivo =
            arquivoProdutos.files[0];


        if (!arquivo) {
            return;
        }


        const confirmar =
            confirm(
                "Deseja importar e atualizar a base de produtos?"
            );


        if (!confirmar) {
            return;
        }


        btnImportar.disabled =
            true;


        arquivoProdutos.disabled =
            true;


        carregando.classList.remove(
            "oculto"
        );


        resultado.classList.add(
            "oculto"
        );


        try {

            const dados =
                new FormData();


            dados.append(
                "arquivo",
                arquivo
            );


            const resposta =
                await fetch(
                    `${API}/api/produtos/importar`,
                    {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${dadosSessao.token}` },
                        body: dados,
                        cache: "no-store"
                    }
                );


            const retorno =
                await resposta.json();


            if (!resposta.ok) {

                throw new Error(
                    retorno.erro ||
                    "Erro na importação."
                );

            }


            let blocoDuplicados = "";

            if (Number(retorno.duplicados || 0) > 0) {

                const detalhes =
                    Array.isArray(retorno.duplicadosDetalhes)
                        ? retorno.duplicadosDetalhes
                        : [];

                const linhasTabela =
                    detalhes.map(item => `
                        <tr>
                            <td>${item.codigo}</td>
                            <td>${item.ocorrencias}</td>
                            <td>${item.linhas.join(", ")}</td>
                            <td>${item.escolhidoLinha}</td>
                            <td>R$ ${Number(item.custoEscolhido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td>${item.motivo}</td>
                        </tr>
                    `).join("");

                const avisoLimite =
                    Number(retorno.duplicadosDetalhesTotal || 0) > detalhes.length
                        ? `<p class="aviso-duplicados">Mostrando ${detalhes.length} de ${retorno.duplicadosDetalhesTotal} códigos duplicados.</p>`
                        : "";

                blocoDuplicados = `
                    <div class="relatorio-duplicados">
                        <h3>⚠️ Duplicados encontrados</h3>

                        <p>
                            Foram encontrados
                            <strong>${retorno.duplicados}</strong>
                            códigos com mais de uma ocorrência na planilha.
                            O sistema consolidou os duplicados e priorizou o registro
                            com <strong>custo válido</strong>.
                        </p>

                        <p>
                            Linhas duplicadas consolidadas:
                            <strong>${retorno.linhasDuplicadas}</strong>
                        </p>

                        <div class="tabela-duplicados-wrap">
                            <table class="tabela-duplicados">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Ocorrências</th>
                                        <th>Linhas</th>
                                        <th>Linha usada</th>
                                        <th>Custo usado</th>
                                        <th>Critério</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${linhasTabela}
                                </tbody>
                            </table>
                        </div>

                        ${avisoLimite}
                    </div>
                `;

            }

            resultado.innerHTML = `

                <h3>
                    Importação concluída ✅
                </h3>

                <p>
                    Linhas da planilha:
                    <strong>${retorno.planilha}</strong>
                </p>

                <p>
                    Produtos únicos após consolidação:
                    <strong>${retorno.produtosUnicos ?? "-"}</strong>
                </p>

                <p>
                    Produtos novos:
                    <strong>${retorno.novos}</strong>
                </p>

                <p>
                    Produtos atualizados:
                    <strong>${retorno.atualizados}</strong>
                </p>

                <p>
                    Linhas inválidas ignoradas:
                    <strong>${retorno.ignorados}</strong>
                </p>

                <p>
                    Total no banco:
                    <strong>${retorno.totalBanco}</strong>
                </p>

                ${blocoDuplicados}

            `;


            resultado.classList.remove(
                "oculto"
            );


            arquivoProdutos.value =
                "";


            await carregarResumo();


        } catch (erro) {

            resultado.innerHTML = `

                <h3>
                    Erro na importação
                </h3>

                <p>
                    ${erro.message}
                </p>

            `;


            resultado.classList.remove(
                "oculto"
            );

        } finally {

            carregando.classList.add(
                "oculto"
            );


            arquivoProdutos.disabled =
                false;


            btnImportar.disabled =
                true;

        }

    }
);


carregarResumo();

/* =========================================================
   TEMPO REAL ENTRE OS PCS
========================================================= */

if (typeof EventSource !== "undefined") {

    const eventosProdutos =
        new EventSource(
            `${API}/api/eventos`
        );

    eventosProdutos.addEventListener(
        "produtos-atualizados",
        () =>
            carregarResumo()
    );

}
