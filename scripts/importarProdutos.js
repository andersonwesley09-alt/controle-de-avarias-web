const XLSX = require("xlsx");
const { Pool } = require("pg");
const path = require("path");


/* =========================================
   CONEXÃO POSTGRESQL
========================================= */

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "controle_avarias",
    port: 5432

    // Como estamos temporariamente usando
    // autenticação "trust", não precisa senha.
});


/* =========================================
   CONVERTER NÚMERO
========================================= */





function normalizarTextoCategoria(valor) {
    return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function classificarCategoriaProduto(descricao) {
    const texto = normalizarTextoCategoria(descricao);
    if (["SABAO","DETERG","DESINF","AMACIANTE","ALVEJ","AGUA SANIT","LIMPA","ESPONJA","VASSOURA","RODO","CLORO","SACO LIXO","PANO","BALDE","DESENG","MULTIUSO","LUSTRA","INSETIC"].some(x=>texto.includes(x))) return "Limpeza";
    if (["QUEIJO","PRESUNTO","MORTADELA","SALAME","IOGURTE","REQUEIJAO","LINGUICA","SALSICHA","PEITO DE PERU","CREAM CHEESE"].some(x=>texto.includes(x))) return "Frios";
    if (["PAO","BOLO","TORTA","SALGADO","CROISS","BRIOCHE","BAGUETE","CUCA","SONHO","PIZZA"].some(x=>texto.includes(x))) return "Padaria";
    if (["REFRIGERANTE","REFRI","SUCO","AGUA MINERAL","AGUA COM GAS","ENERGETICO","ISOTONICO","CERVEJA","VINHO","ESPUMANTE","DESTILADO","BEBIDA","CHA GELADO","CAFE PRONTO"].some(x=>texto.includes(x))) return "Bebidas";
    return "Mercearia";
}

/* =========================================================
   LEITURA FLEXÍVEL DE COLUNAS DA PLANILHA
   Aceita variações como:
   CODIGO / COD. DE BARRAS / EAN
   V. CUSTO / VALOR C / VALOR CUSTO
========================================================= */
function normalizarCabecalho(valor) {

    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .trim();

}

function valorColuna(linha, aliases) {

    const desejados = aliases.map(
        alias => normalizarCabecalho(alias)
    );

    for (const [chave, valor] of Object.entries(linha || {})) {

        if (desejados.includes(normalizarCabecalho(chave))) {
            return valor;
        }

    }

    return "";

}


function valorColunaFlex(linha, aliases, posicaoFallback = null) {

    const encontrado = valorColuna(linha, aliases);

    if (
        encontrado !== null &&
        encontrado !== undefined &&
        String(encontrado).trim() !== ""
    ) {
        return encontrado;
    }

    if (
        posicaoFallback !== null &&
        linha &&
        typeof linha === "object"
    ) {
        const chaves = Object.keys(linha);
        const chave = chaves[posicaoFallback];

        if (chave !== undefined) {
            return linha[chave];
        }
    }

    return "";
}

function numero(valor) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return 0;
    }


    if (typeof valor === "number") {
        return valor;
    }


    const texto =
        String(valor)
            .trim()
            .replace(/\./g, "")
            .replace(",", ".");


    const convertido =
        Number(texto);


    return Number.isFinite(convertido)
        ? convertido
        : 0;
}


/* =========================================
   NORMALIZAR CÓDIGO
========================================= */

function codigoTexto(valor) {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }


    return String(valor)
        .trim()
        .replace(/\.0$/, "");
}


/* =========================================
   DEDUPLICAÇÃO DA IMPORTAÇÃO
========================================= */

function pontuarProdutoImportacao(item) {

    let score = 0;

    if (Number(item.valorCusto) > 0) score += 100;
    if (Number(item.valorVenda) > 0) score += 20;
    if (String(item.fornecedor || "").trim() !== "") score += 10;
    if (String(item.codigoFornecedor || "").trim() !== "") score += 10;
    if (Number(item.estoque) !== 0) score += 1;

    return score;
}


function escolherProdutoImportacao(atual, candidato) {

    return pontuarProdutoImportacao(candidato) >
        pontuarProdutoImportacao(atual)
        ? candidato
        : atual;
}


/* =========================================
   IMPORTAÇÃO
========================================= */

async function importarProdutos() {

    const cliente =
        await pool.connect();


    try {

        console.log("");
        console.log("==============================");
        console.log(" IMPORTAÇÃO DE PRODUTOS");
        console.log("==============================");
        console.log("");


        const caminhoArquivo =
            path.join(
                __dirname,
                "..",
                "Pasta3.xlsx"
            );


        console.log(
            "Lendo:",
            caminhoArquivo
        );


        const workbook =
            XLSX.readFile(
                caminhoArquivo
            );


        const nomeAba =
            workbook.SheetNames[0];


        console.log(
            "Aba encontrada:",
            nomeAba
        );


        const planilha =
            workbook.Sheets[nomeAba];


        const linhas =
            XLSX.utils.sheet_to_json(
                planilha,
                {
                    defval: ""
                }
            );


        console.log(
            "Linhas encontradas:",
            linhas.length
        );


        console.log("");
        console.log(
            "Iniciando importação..."
        );
        console.log("");


        await cliente.query("BEGIN");


        let importados = 0;
        let atualizados = 0;
        let ignorados = 0;


        const produtosConsolidados = new Map();
        let duplicados = 0;

        for (
            let i = 0;
            i < linhas.length;
            i++
        ) {

            const linha = linhas[i];

            const codigo =
                codigoTexto(
                    valorColunaFlex(
                        linha,
                        [
                            "CODIGO",
                            "CÓDIGO",
                            "COD. DE BARRAS",
                            "COD DE BARRAS",
                            "CODIGO DE BARRAS",
                            "EAN"
                        ],
                        2
                    )
                );

            const descricao =
                String(
                    valorColunaFlex(
                        linha,
                        ["DESCRIÇÃO", "DESCRICAO", "PRODUTO"],
                        3
                    ) || ""
                ).trim();

            const fornecedor =
                String(
                    valorColunaFlex(
                        linha,
                        [
                            "FORNECEDOR",
                            "EMPRESA",
                            "EMPRESA/FORNECEDOR",
                            "EMPRESA / FORNECEDOR"
                        ],
                        1
                    ) || ""
                ).trim();

            const codigoFornecedor =
                codigoTexto(
                    valorColunaFlex(
                        linha,
                        [
                            "COD. FORNECEDOR",
                            "COD FORNECEDOR",
                            "CODIGO FORNECEDOR",
                            "CÓD FORNECEDOR"
                        ],
                        0
                    )
                );

            const estoque =
                numero(
                    valorColunaFlex(
                        linha,
                        ["ESTOQUE", "QTD ESTOQUE", "QUANTIDADE ESTOQUE"],
                        4
                    )
                );

            const valorCusto =
                numero(
                    valorColunaFlex(
                        linha,
                        ["V. CUSTO", "VALOR C", "VALOR CUSTO", "VALOR DE CUSTO", "CUSTO"],
                        5
                    )
                );

            const valorVenda =
                numero(
                    valorColunaFlex(
                        linha,
                        ["VALOR. VEND", "VALOR V", "VALOR VENDA", "PREÇO VENDA", "PRECO VENDA"],
                        6
                    )
                );

            if (!codigo || !descricao) {
                ignorados++;
                continue;
            }

            const item = {
                codigo,
                descricao,
                fornecedor,
                codigoFornecedor,
                estoque,
                valorCusto,
                valorVenda
            };

            if (produtosConsolidados.has(codigo)) {
                duplicados++;
                produtosConsolidados.set(
                    codigo,
                    escolherProdutoImportacao(
                        produtosConsolidados.get(codigo),
                        item
                    )
                );
            } else {
                produtosConsolidados.set(codigo, item);
            }
        }

        const listaConsolidada =
            Array.from(produtosConsolidados.values());

        for (const item of listaConsolidada) {

            const existente =
                await cliente.query(
                    `
                    SELECT id
                    FROM produtos
                    WHERE codigo = $1
                    LIMIT 1
                    `,
                    [item.codigo]
                );

            if (existente.rowCount > 0) {

                await cliente.query(
                    `
                    UPDATE produtos
                    SET
                        descricao = $1,
                        fornecedor = COALESCE(NULLIF($2, ''), fornecedor),
                        codigo_fornecedor = COALESCE(NULLIF($3, ''), codigo_fornecedor),
                        estoque = $4,
                        valor_custo = $5,
                        valor_venda = $6,
                        ativo = TRUE,
                        atualizado_em = CURRENT_TIMESTAMP
                    WHERE codigo = $7
                    `,
                    [
                        item.descricao,
                        item.fornecedor,
                        item.codigoFornecedor,
                        item.estoque,
                        item.valorCusto,
                        item.valorVenda,
                        item.codigo
                    ]
                );

                atualizados++;

            } else {

                await cliente.query(
                    `
                    INSERT INTO produtos
                    (
                        codigo,
                        descricao,
                        fornecedor,
                        codigo_fornecedor,
                        estoque,
                        valor_custo,
                        valor_venda,
                        ativo
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                    `,
                    [
                        item.codigo,
                        item.descricao,
                        item.fornecedor,
                        item.codigoFornecedor,
                        item.estoque,
                        item.valorCusto,
                        item.valorVenda
                    ]
                );

                importados++;
            }
        }

        console.log("Duplicados consolidados:", duplicados);

        await cliente.query("COMMIT");


        const total =
            await cliente.query(
                `
                SELECT COUNT(*) AS quantidade
                FROM produtos
                `
            );


        console.log("");
        console.log("==============================");
        console.log(" IMPORTAÇÃO CONCLUÍDA");
        console.log("==============================");
        console.log("");

        console.log(
            "Novos:",
            importados
        );

        console.log(
            "Atualizados:",
            atualizados
        );

        console.log(
            "Ignorados:",
            ignorados
        );

        console.log(
            "Total no banco:",
            total.rows[0].quantidade
        );

        console.log("");


    } catch (erro) {

        await cliente.query(
            "ROLLBACK"
        );


        console.error("");
        console.error(
            "ERRO NA IMPORTAÇÃO:"
        );

        console.error(
            erro
        );


    } finally {

        cliente.release();

        await pool.end();

    }

}


importarProdutos();