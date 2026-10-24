const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const raiz = path.resolve(__dirname, "..");

const arquivosObrigatorios = [
    "server.js",
    "package.json",
    "index.html",
    "dashboard.js",
    "login.html",
    "login.js",
    "sistema.html",
    "sistema.js",
    "avarias.html",
    "avarias.js",
    "caixas.html",
    "caixas.js",
    "produtos.html",
    "produtos.js",
    "usuarios.html",
    "usuarios.js",
    "styleusuarios.css"
];

const htmls = [
    "index.html",
    "login.html",
    "sistema.html",
    "avarias.html",
    "caixas.html",
    "produtos.html",
    "usuarios.html"
];

const javascripts = [
    "server.js",
    "dashboard.js",
    "login.js",
    "sistema.js",
    "avarias.js",
    "caixas.js",
    "produtos.js",
    "usuarios.js",
    "scripts/criarUsuarioAdmin.js",
    "scripts/importarProdutos.js",
    "scripts/scripts.js"
];

let erros = 0;

function erro(mensagem) {
    erros++;
    console.error("ERRO:", mensagem);
}

console.log("\nVerificando arquivos obrigatórios...");
for (const arquivo of arquivosObrigatorios) {
    const completo = path.join(raiz, arquivo);
    if (!fs.existsSync(completo)) {
        erro(`Arquivo ausente: ${arquivo}`);
    }
}

console.log("Verificando referências locais dos HTMLs...");
for (const html of htmls) {
    const completo = path.join(raiz, html);
    if (!fs.existsSync(completo)) continue;

    const texto = fs.readFileSync(completo, "utf8");
    const regex = /(?:href|src)=["']([^"']+)["']/g;
    let match;

    while ((match = regex.exec(texto))) {
        const ref = match[1];
        if (
            ref.startsWith("http://") ||
            ref.startsWith("https://") ||
            ref.startsWith("#") ||
            ref.startsWith("mailto:") ||
            ref.startsWith("javascript:")
        ) {
            continue;
        }

        const destino = path.resolve(path.dirname(completo), ref.split("?")[0]);
        if (!fs.existsSync(destino)) {
            erro(`${html} referencia arquivo inexistente: ${ref}`);
        }
    }
}

console.log("Verificando sintaxe JavaScript...");
for (const arquivo of javascripts) {
    const completo = path.join(raiz, arquivo);
    if (!fs.existsSync(completo)) continue;

    const teste = spawnSync(process.execPath, ["--check", completo], {
        encoding: "utf8"
    });

    if (teste.status !== 0) {
        erro(`Sintaxe inválida em ${arquivo}\n${teste.stderr}`);
    }
}

if (erros) {
    console.error(`\nVerificação concluída com ${erros} erro(s).`);
    process.exit(1);
}

console.log("\nProjeto verificado com sucesso.");
console.log("Arquivos principais presentes, referências locais válidas e JavaScripts sem erro de sintaxe.\n");
