"use strict";

// Importacao segura por CABECALHO, sem inferencia pela posicao das colunas.
// Isso evita que colunas auxiliares do Excel desloquem os campos.
const ALIASES = Object.freeze({
    codigo: [
        "COD. PRODUTO", "COD PRODUTO", "CODIGO DO PRODUTO", "CODIGO DE PRODUTO", "CODIGO PRODUTO",
        "COD. DE BARRAS", "COD DE BARRAS", "CODIGO DE BARRAS", "CODIGO BARRAS", "COD. BARRAS",
        "COD BARRAS", "GTIN", "EAN", "EAN 13", "EAN13", "CODIGO", "COD."
    ],
    descricao: ["DESCRICAO", "PRODUTO", "NOME DO PRODUTO", "NOME PRODUTO"],
    fornecedor: ["FORNECEDOR", "EMPRESA", "EMPRESA FORNECEDOR", "NOME FORNECEDOR"],
    codigoFornecedor: ["COD. FORN", "COD FORN", "CODIGO FORN", "CODIGO DO FORNECEDOR", "CODIGO FORNECEDOR", "COD FORNECEDOR", "COD. FORNECEDOR"],
    estoque: ["ESTOQUE", "ESTOQUE ATUAL", "QTD ESTOQUE", "QUANTIDADE ESTOQUE"],
    valorCusto: ["V. CUSTO", "VALOR C", "VALOR CUSTO", "VALOR DE CUSTO", "CUSTO", "CUSTO UNITARIO"],
    valorVenda: ["VALOR. VEND", "VALOR V", "VALOR VENDA", "PRECO VENDA", "PRECO DE VENDA", "PRECO"],
    categoria: ["CATEGORIA", "DEPARTAMENTO", "GRUPO", "SECAO"],
    setorPadrao: ["SETOR", "SETOR PADRAO", "SETOR DO PRODUTO", "SETOR DE ORIGEM"]
});

function normalizarCabecalho(valor) {
    return String(valor ?? "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function identificarColunas(linha) {
    const chaves = Object.keys(linha || {});
    const porNome = new Map(chaves.map(chave => [normalizarCabecalho(chave), chave]));
    const campos = {};
    for (const [campo, aliases] of Object.entries(ALIASES)) {
        // Prioriza o alias especifico, nunca a ordem retornada por Object.keys.
        campos[campo] = aliases.map(normalizarCabecalho)
            .map(alias => porNome.get(alias)).find(chave => chave !== undefined) ?? null;
    }
    const ausentes = [
        ["codigo", "COD. PRODUTO / CODIGO DE BARRAS / EAN"],
        ["descricao", "DESCRICAO / PRODUTO"],
        ["valorCusto", "CUSTO / V. CUSTO"]
    ].filter(([campo]) => !campos[campo]).map(([, descricao]) => descricao);
    if (ausentes.length) {
        const err = new Error(`Coluna(s) obrigatoria(s) nao reconhecida(s): ${ausentes.join(", ")}. Confira os cabecalhos da primeira linha. A importacao foi cancelada sem gravar produtos.`);
        err.codigo = "COLUNAS_IMPORTACAO_INVALIDAS";
        err.status = 400;
        throw err;
    }
    return campos;
}

function lerColuna(linha, colunas, campo) {
    const chave = colunas[campo];
    return chave === null || chave === undefined ? "" : (linha?.[chave] ?? "");
}

module.exports = { ALIASES, normalizarCabecalho, identificarColunas, lerColuna };
