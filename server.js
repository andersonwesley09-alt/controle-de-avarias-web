/* =========================================================
   BOOTSTRAP DE DEPENDENCIAS
   Se o projeto for copiado para outro computador sem node_modules,
   instala automaticamente as dependencias uma unica vez.
========================================================= */
const fsInicial = require("fs");
const pathInicial = require("path");
const { spawnSync: spawnSyncInicial } = require("child_process");

const DEPENDENCIAS_INICIAIS = [
    "dotenv",
    "express",
    "cors",
    "pg",
    "multer",
    "xlsx",
    "bcryptjs"
];

function dependenciasInstaladas() {
    try {
        for (const modulo of DEPENDENCIAS_INICIAIS) {
            require.resolve(modulo);
        }
        return true;
    } catch (_) {
        return false;
    }
}

if (!dependenciasInstaladas()) {
    const raizProjetoInicial = __dirname;
    const packageJsonInicial = pathInicial.join(raizProjetoInicial, "package.json");

    if (!fsInicial.existsSync(packageJsonInicial)) {
        console.error("ERRO: package.json nao encontrado na pasta do projeto.");
        process.exit(1);
    }

    console.log("Dependencias do projeto nao encontradas.");
    console.log("Instalando automaticamente. Isso normalmente acontece apenas na primeira execucao...\n");

    const comandoNpm = process.platform === "win32" ? "npm.cmd" : "npm";
    const instalacao = spawnSyncInicial(
        comandoNpm,
        ["install", "--no-audit", "--no-fund"],
        {
            cwd: raizProjetoInicial,
            stdio: "inherit",
            shell: false
        }
    );

    if (instalacao.error || instalacao.status !== 0 || !dependenciasInstaladas()) {
        console.error("\nERRO: nao foi possivel instalar as dependencias do projeto.");
        console.error("Verifique a conexao com a internet e execute novamente.");
        process.exit(instalacao.status || 1);
    }

    console.log("\nDependencias instaladas com sucesso.\n");
}

require("dotenv").config();

// Horário oficial do sistema: Brasília (UTC-3).
process.env.TZ = "America/Sao_Paulo";
const TIME_ZONE_SISTEMA = "America/Sao_Paulo";

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const multer = require("multer");
const XLSX = require("xlsx");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();

const APP_VERSION = "V25";
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString("hex");

const DURACAO_SESSAO_MS =
    12 * 60 * 60 * 1000;

const COOKIE_SESSAO =
    process.env.SESSION_COOKIE_NAME ||
    "controle_avarias_sessao";

const COOKIE_SECURE =
    String(process.env.SESSION_SECURE_COOKIE || "false").toLowerCase() === "true";

const BACKUP_HORA = Number(process.env.BACKUP_HORA || 23);
const BACKUP_MINUTO = Number(process.env.BACKUP_MINUTO || 55);
const BACKUP_RETENCAO = Math.max(Number(process.env.BACKUP_RETENCAO || 30), 3);
const BACKUP_DIR = path.join(__dirname, "backups");
let ultimoBackupDia = "";
let ultimoBackupStatus = {
    status: "nao_executado",
    arquivo: "",
    geradoEm: null,
    tipo: "",
    erro: ""
};


/* =========================================================
   POSTGRESQL
========================================================= */

const pool = new Pool({
    user: process.env.DB_USER || process.env.PGUSER || "postgres",
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    database: process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    ...(process.env.DB_PASSWORD || process.env.PGPASSWORD
        ? { password: process.env.DB_PASSWORD || process.env.PGPASSWORD }
        : {}),
    options: `-c timezone=${TIME_ZONE_SISTEMA}`
});

/* =========================================================
   BACKUP AUTOMÁTICO
   Tenta gerar um dump nativo com pg_dump. Se o executável não
   estiver disponível, salva um snapshot JSON das tabelas do sistema.
========================================================= */

function chaveDiaLocal(data = new Date()) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function carimboArquivo(data = new Date()) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    const d = String(data.getDate()).padStart(2, "0");
    const h = String(data.getHours()).padStart(2, "0");
    const min = String(data.getMinutes()).padStart(2, "0");
    const sec = String(data.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}_${h}-${min}-${sec}`;
}

function localizarPgDump() {
    const candidatos = [
        process.env.PG_DUMP_PATH,
        "pg_dump",
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PostgreSQL", "18", "bin", "pg_dump.exe") : null,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PostgreSQL", "17", "bin", "pg_dump.exe") : null,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PostgreSQL", "16", "bin", "pg_dump.exe") : null,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PostgreSQL", "15", "bin", "pg_dump.exe") : null,
        process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "PostgreSQL", "14", "bin", "pg_dump.exe") : null
    ].filter(Boolean);

    return candidatos.find(item => item === "pg_dump" || fs.existsSync(item)) || "pg_dump";
}

async function gerarSnapshotJsonBackup(caminho) {
    const tabelas = [
        "usuarios",
        "produtos",
        "avarias",
        "historico_avarias",
        "caixas",
        "mapeamento_caixas",
        "auditoria_alteracoes",
        "caixa_produtos",
        "tarefas_diarias",
        "notificacoes",
        "recuperacoes_produtos",
        "doacoes_produtos"
    ];

    const dados = {
        geradoEm: new Date().toISOString(),
        banco: "controle_avarias",
        tabelas: {}
    };

    for (const tabela of tabelas) {
        try {
            const resultado = await pool.query(`SELECT * FROM ${tabela}`);
            dados.tabelas[tabela] = resultado.rows;
        } catch (erro) {
            dados.tabelas[tabela] = { erro: erro.message };
        }
    }

    await fs.promises.writeFile(
        caminho,
        JSON.stringify(dados, null, 2),
        "utf8"
    );
}

async function garantirFusoHorarioBrasil() {
    const controleTabela = `
        CREATE TABLE IF NOT EXISTS sistema_fuso_horario (
            chave VARCHAR(100) PRIMARY KEY,
            valor VARCHAR(255) NOT NULL,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await pool.query(controleTabela);
    await pool.query(`SET TIME ZONE '${TIME_ZONE_SISTEMA}'`);

    const controle = await pool.query(`
        SELECT chave, valor
        FROM sistema_fuso_horario
        WHERE chave = 'horario_brasilia_v1'
        LIMIT 1
    `);

    if (controle.rowCount) {
        console.log(`Fuso horário do sistema: ${TIME_ZONE_SISTEMA}. Migração histórica já aplicada.`);
        return;
    }

    // Guarda uma cópia de segurança antes de alterar timestamps legados.
    try {
        await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
        const caminhoPreMigracao = path.join(
            BACKUP_DIR,
            `controle_avarias_pre_fuso_brasilia_${carimboArquivo(new Date())}.json`
        );
        await gerarSnapshotJsonBackup(caminhoPreMigracao);
        console.log(`Backup pré-migração de horário criado: ${caminhoPreMigracao}`);
    } catch (erro) {
        console.warn("Não foi possível criar o backup pré-migração de horário. A migração continuará:", erro.message);
    }

    const alvos = [
        ["usuarios", "criado_em"],
        ["auditoria_alteracoes", "criado_em"],
        ["notificacoes", "criado_em"],
        ["tarefas_diarias", "concluida_em"],
        ["tarefas_diarias", "criado_em"],
        ["historico_avarias", "criado_em"],
        ["historico_avarias", "movimentado_em"],
        ["historico_avarias", "historico_criado_em"],
        ["mapeamento_caixas", "atualizado_em"],
        ["caixa_produtos", "criado_em"],
        ["caixa_produtos", "atualizado_em"],
        ["avarias", "criado_em"],
        ["avarias", "movimentado_em"],
        ["caixas", "criado_em"],
        ["produtos", "atualizado_em"]
    ];

    const cliente = await pool.connect();
    try {
        await cliente.query("BEGIN");
        await cliente.query(`SET LOCAL TIME ZONE '${TIME_ZONE_SISTEMA}'`);

        for (const [tabela, coluna] of alvos) {
            const existente = await cliente.query(`
                SELECT data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                  AND column_name = $2
                LIMIT 1
            `, [tabela, coluna]);

            if (!existente.rowCount) continue;

            const tipo = existente.rows[0].data_type;
            if (tipo !== "timestamp without time zone") continue;

            // Os registros antigos foram gravados como relógio UTC em colunas
            // sem fuso. Corrigimos a parede UTC (-3h) e depois armazenamos o
            // instante real como TIMESTAMPTZ. Valores NULL permanecem NULL.
            await cliente.query(`
                ALTER TABLE "${tabela}"
                ALTER COLUMN "${coluna}"
                TYPE TIMESTAMPTZ
                USING (
                    CASE
                        WHEN "${coluna}" IS NULL THEN NULL
                        ELSE (("${coluna}" - INTERVAL '3 hours') AT TIME ZONE '${TIME_ZONE_SISTEMA}')
                    END
                )
            `);

            console.log(`Timestamp convertido: ${tabela}.${coluna}`);
        }

        await cliente.query(`
            INSERT INTO sistema_fuso_horario (chave, valor)
            VALUES ('horario_brasilia_v1', $1)
            ON CONFLICT (chave) DO NOTHING
        `, [TIME_ZONE_SISTEMA]);

        await cliente.query("COMMIT");
        console.log(`Fuso horário do sistema padronizado para ${TIME_ZONE_SISTEMA}.`);
    } catch (erro) {
        try { await cliente.query("ROLLBACK"); } catch {}
        throw erro;
    } finally {
        cliente.release();
    }
}


async function limparBackupsAntigos() {
    try {
        const nomes = (await fs.promises.readdir(BACKUP_DIR))
            .filter(nome =>
                /^controle_avarias_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\.(dump|json)$/.test(nome)
            );

        const ordenados = nomes.sort((a, b) => b.localeCompare(a));
        const remover = ordenados.slice(BACKUP_RETENCAO);

        for (const nome of remover) {
            try {
                await fs.promises.unlink(path.join(BACKUP_DIR, nome));
            } catch {}
        }
    } catch (erro) {
        console.warn("Não foi possível limpar backups antigos:", erro.message);
    }
}


async function executarBackupAutomatico(forcar = false) {
    try {
        await fs.promises.mkdir(BACKUP_DIR, { recursive: true });

        const agora = new Date();
        const dia = chaveDiaLocal(agora);
        if (!forcar && ultimoBackupDia === dia) return;

        if (forcar) {
            const arquivosHoje = (await fs.promises.readdir(BACKUP_DIR))
                .filter(nome => nome.startsWith(`controle_avarias_${dia}_`));
            if (arquivosHoje.length) {
                ultimoBackupDia = dia;
                return;
            }
        }

        if (!forcar && (agora.getHours() < BACKUP_HORA ||
            (agora.getHours() === BACKUP_HORA && agora.getMinutes() < BACKUP_MINUTO))) {
            return;
        }

        const carimbo = carimboArquivo(agora);
        const dumpPath = path.join(BACKUP_DIR, `controle_avarias_${carimbo}.dump`);
        const jsonPath = path.join(BACKUP_DIR, `controle_avarias_${carimbo}.json`);
        const pgDump = localizarPgDump();

        await new Promise((resolve) => {
            const env = { ...process.env };
            const senha = process.env.PGPASSWORD || process.env.DB_PASSWORD;
            if (senha) env.PGPASSWORD = senha;

            const processo = spawn(pgDump, [
                "-h", process.env.DB_HOST || process.env.PGHOST || "localhost",
                "-p", String(process.env.DB_PORT || process.env.PGPORT || 5432),
                "-U", process.env.DB_USER || process.env.PGUSER || "postgres",
                "-d", process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
                "-F", "c",
                "-f", dumpPath,
                "-w"
            ], { env, windowsHide: true });

            let stderr = "";
            processo.stderr.on("data", chunk => { stderr += String(chunk); });

            processo.on("error", async (erroProcesso) => {
                try {
                    await gerarSnapshotJsonBackup(jsonPath);
                    ultimoBackupStatus = {
                        status: "sucesso",
                        arquivo: jsonPath,
                        geradoEm: new Date().toISOString(),
                        tipo: "json",
                        erro: `pg_dump indisponível: ${erroProcesso.message || "erro ao iniciar"}`
                    };
                    console.warn(`pg_dump indisponível. Snapshot JSON concluído: ${jsonPath}`);
                } catch (erro) {
                    ultimoBackupStatus = {
                        status: "erro",
                        arquivo: "",
                        geradoEm: new Date().toISOString(),
                        tipo: "",
                        erro: erro.message
                    };
                    console.error("Backup JSON também falhou:", erro);
                }
                resolve();
            });

            processo.on("close", async (codigo) => {
                if (codigo === 0) {
                    try { if (fs.existsSync(jsonPath)) await fs.promises.unlink(jsonPath); } catch {}
                    ultimoBackupStatus = {
                        status: "sucesso",
                        arquivo: dumpPath,
                        geradoEm: new Date().toISOString(),
                        tipo: "pg_dump",
                        erro: ""
                    };
                    console.log(`Backup automático concluído: ${dumpPath}`);
                } else {
                    console.warn("pg_dump não conseguiu gerar o dump. Criando snapshot JSON.", stderr.trim());
                    try {
                        await gerarSnapshotJsonBackup(jsonPath);
                        ultimoBackupStatus = {
                            status: "sucesso",
                            arquivo: jsonPath,
                            geradoEm: new Date().toISOString(),
                            tipo: "json",
                            erro: stderr.trim()
                        };
                        console.log(`Snapshot JSON concluído: ${jsonPath}`);
                    } catch (erro) {
                        ultimoBackupStatus = {
                            status: "erro",
                            arquivo: "",
                            geradoEm: new Date().toISOString(),
                            tipo: "",
                            erro: erro.message
                        };
                        console.error("Backup automático falhou:", erro);
                    }
                }
                resolve();
            });
        });

        await limparBackupsAntigos();
        ultimoBackupDia = dia;
    } catch (erro) {
        ultimoBackupStatus = {
            status: "erro",
            arquivo: "",
            geradoEm: new Date().toISOString(),
            tipo: "",
            erro: erro.message
        };
        console.error("Erro no backup automático:", erro);
    }
}

const timerBackupAutomatico = setInterval(
    () => executarBackupAutomatico(false),
    60 * 1000
);
timerBackupAutomatico.unref?.();


/* =========================================================
   UPLOAD DO EXCEL
========================================================= */

const upload = multer({

    storage:
        multer.memoryStorage(),

    limits: {
        fileSize:
            25 * 1024 * 1024
    }

});


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

// CORS robusto para o modo normal (HTTP) e para HTML aberto por duplo clique (file://).
// O navegador envia Origin: null para file://. Não dependemos de .env para isso.
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

// Identifica sem ambiguidade qual build está respondendo.
app.use((req, res, next) => {
    res.setHeader("X-Controle-Avarias-Version", APP_VERSION);
    next();
});

app.get("/api/asset-check", (req, res) => {
    const arquivos = ["timezone.js", "avarias.js", "dashboard.js", "rodape.js", "rodape.css"];
    const resultado = Object.fromEntries(arquivos.map(nome => [nome, fs.existsSync(path.join(__dirname, nome))]));
    return res.json({ ok: Object.values(resultado).every(Boolean), versao: APP_VERSION, arquivos: resultado });
});

app.get("/api/versao", (req, res) => {
    return res.json({
        ok: true,
        versao: APP_VERSION,
        servidor: os.hostname(),
        porta: PORT
    });
});

// Diagnóstico simples de rede. Não exige login e confirma rapidamente
// se o PC cliente está alcançando o servidor central.
app.get("/api/saude", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        return res.json({ ok: true, servidor: os.hostname(), porta: PORT });
    } catch (erro) {
        console.error("Erro no diagnóstico do servidor:", erro);
        return res.status(503).json({ ok: false, erro: "Servidor alcançado, mas o PostgreSQL não está disponível." });
    }
});


/* =========================================================
   EVENTOS EM TEMPO REAL - SSE
   Mantém os PCs conectados atualizados sem recarregar a página.
========================================================= */

const clientesEventos =
    new Set();


function emitirEventoSistema(
    tipo,
    dados = {}
) {

    const mensagem =
        `event: ${tipo}\n` +
        `data: ${JSON.stringify({
            ...dados,
            em:
                new Date().toISOString()
        })}\n\n`;


    for (
        const cliente of
        clientesEventos
    ) {

        try {

            cliente.write(
                mensagem
            );

        } catch {}

    }

}


app.get(
    "/api/eventos",

    
    exigirUsuario,
    (req, res) => {

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache, no-transform"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.flushHeaders?.();


        clientesEventos.add(
            res
        );


        res.write(
            `event: conectado\ndata: ${JSON.stringify({ ok: true })}\n\n`
        );


        req.on(
            "close",
            () => {

                clientesEventos.delete(
                    res
                );

            }
        );

    }
);


const timerPingEventos =
    setInterval(

        () => {

            for (
                const cliente of
                clientesEventos
            ) {

                try {

                    cliente.write(
                        ": ping\n\n"
                    );

                } catch {}

            }

        },

        25000

    );


timerPingEventos.unref?.();


/* =========================================================
   ARQUIVOS PÚBLICOS DO SISTEMA
   Permite abrir o sistema pelo servidor Node, inclusive
   em outros computadores da mesma rede.
========================================================= */

const ARQUIVOS_PUBLICOS =
    new Set([
        "index.html",
        "styledash.css",
        "dashboard.js",
        "bootstrap-server.js",
        "login.html",
        "stylelogin.css",
        "login.js",
        "sistema.html",
        "stylesistema.css",
        "sistema.js",
        "avarias.html",
        "styleavarias.css",
        "avarias.js",
        "caixas.html",
        "stylecaixas.css",
        "caixas.js",
        "mapeamento.html",
        "styleMapeamento.css",
        "mapeamento.js",
        "produtos.html",
        "styleprodutos.css",
        "produtos.js",
        "usuarios.html",
        "styleusuarios.css",
        "usuarios.js",
        "tarefas.html",
        "styletarefas.css",
        "tarefas.js",
        "auditoria.html",
        "auditoria.css",
        "auditoria.js",
        "logo-controle.svg",
        "timezone.js",
        "devolucoes.js",
        "perfil.html",
        "perfil.js",
        "rodape.css",
        "rodape.js",
        "styledevolucoes.css",
        "stylenotificacoes.css",
        "styleperfil.css",
        "notificacoes.js",
        "recuperacao.html",
        "stylerecuperacao.css",
        "recuperacao.js"
    ]);


app.get(
    "/",

    (req, res) => {

        // Evita que o navegador reutilize HTML/JS antigo.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        return res.sendFile(
            path.join(
                __dirname,
                "login.html"
            )
        );

    }
);


app.get(
    "/:arquivo",

    (req, res, next) => {

        const arquivo =
            String(
                req.params.arquivo || ""
            );


        if (
            !ARQUIVOS_PUBLICOS.has(
                arquivo
            )
        ) {

            return next();

        }


        // Arquivos do frontend nunca devem ficar presos em cache entre versões.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        return res.sendFile(
            path.join(
                __dirname,
                arquivo
            )
        );

    }
);


/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function codigoTexto(valor) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "";

    }


    return String(valor)
        .trim()
        .replace(/\.0$/, "");

}





/* =========================================================
   V12 - CATEGORIA AUTOMÁTICA DO PRODUTO
========================================================= */

function normalizarTextoCategoria(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

function classificarCategoriaProduto(descricao) {
    const texto = normalizarTextoCategoria(descricao);

    const limpeza = [
        "SABAO", "DETERG", "DESINF", "AMACIANTE", "ALVEJ",
        "AGUA SANIT", "LIMPA", "ESPONJA", "VASSOURA", "RODO",
        "CLORO", "SACO LIXO", "PANO", "BALDE", "DESENG",
        "MULTIUSO", "LUSTRA", "INSETIC"
    ];

    const frios = [
        "QUEIJO", "PRESUNTO", "MORTADELA", "SALAME", "IOGURTE",
        "REQUEIJAO", "LINGUICA", "SALSICHA", "PEITO DE PERU",
        "CREAM CHEESE"
    ];

    const padaria = [
        "PAO", "BOLO", "TORTA", "SALGADO", "CROISS", "BRIOCHE",
        "BAGUETE", "CUCA", "SONHO", "PIZZA"
    ];

    const bebidas = [
        "REFRIGERANTE", "REFRI", "SUCO", "AGUA MINERAL", "AGUA COM GAS",
        "ENERGETICO", "ISOTONICO", "CERVEJA", "VINHO", "ESPUMANTE",
        "DESTILADO", "BEBIDA", "CHA GELADO", "CAFE PRONTO"
    ];

    if (limpeza.some(x => texto.includes(x))) return "Limpeza";
    if (frios.some(x => texto.includes(x))) return "Frios";
    if (padaria.some(x => texto.includes(x))) return "Padaria";
    if (bebidas.some(x => texto.includes(x))) return "Bebidas";
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


    if (
        typeof valor === "number"
    ) {

        return Number.isFinite(valor)
            ? valor
            : 0;

    }


    let texto =
        String(valor)
            .trim();


    /*
        Aceita:
        17.184
        17,184
        1.234,56
    */

    if (
        texto.includes(",") &&
        texto.includes(".")
    ) {

        texto =
            texto
                .replace(/\./g, "")
                .replace(",", ".");

    }

    else if (
        texto.includes(",")
    ) {

        texto =
            texto.replace(",", ".");

    }


    const valorNumerico =
        Number(texto);


    return Number.isFinite(
        valorNumerico
    )
        ? valorNumerico
        : 0;

}


/* =========================================================
   DEDUPLICAÇÃO SEGURA DA IMPORTAÇÃO DE PRODUTOS
========================================================= */

function pontuarProdutoImportacao(item) {

    let score = 0;

    /*
        Regra principal:
        produto com custo válido sempre vence produto
        com custo zerado. Depois usamos a completude dos
        demais campos para desempatar.
    */

    if (Number(item.valorCusto) > 0) {
        score += 100;
    }

    if (Number(item.valorVenda) > 0) {
        score += 20;
    }

    if (String(item.fornecedor || "").trim() !== "") {
        score += 10;
    }

    if (String(item.codigoFornecedor || "").trim() !== "") {
        score += 10;
    }

    if (Number(item.estoque) !== 0) {
        score += 1;
    }

    return score;
}


function escolherProdutoImportacao(atual, candidato) {

    const scoreAtual =
        pontuarProdutoImportacao(atual);

    const scoreCandidato =
        pontuarProdutoImportacao(candidato);

    if (scoreCandidato > scoreAtual) {
        return candidato;
    }

    return atual;
}


function motivoEscolhaProdutoImportacao(item) {

    if (Number(item.valorCusto) > 0) {
        return "Preferido: possui custo válido";
    }

    return "Mantido: nenhum duplicado apresentou custo válido";
}


/* =========================================================
   USUÁRIOS E SESSÃO ADMINISTRATIVA
========================================================= */

async function garantirTabelaUsuarios() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (

            id SERIAL PRIMARY KEY,

            usuario VARCHAR(100)
                UNIQUE
                NOT NULL,

            senha_hash VARCHAR(255)
                NOT NULL,

            nome VARCHAR(255)
                NOT NULL,

            perfil VARCHAR(50)
                NOT NULL
                DEFAULT 'usuario',

            ativo BOOLEAN
                NOT NULL
                DEFAULT TRUE,

            criado_em TIMESTAMPTZ
                NOT NULL
                DEFAULT CURRENT_TIMESTAMP
        )
    `);

}


/* =========================================================
   V19 - SESSÃO CENTRALIZADA NO SERVIDOR
   Cookie HttpOnly + sessão persistida no PostgreSQL.
   O token legado continua aceito somente para compatibilidade
   com clientes antigos; novos logins usam token opaco revogável.
========================================================= */

async function garantirTabelaSessoes() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessoes (
            id BIGSERIAL PRIMARY KEY,
            token_hash CHAR(64) NOT NULL UNIQUE,
            usuario_id INTEGER NOT NULL
                REFERENCES usuarios(id)
                ON DELETE CASCADE,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expira_em TIMESTAMPTZ NOT NULL,
            ultimo_acesso_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revogada_em TIMESTAMPTZ,
            ip VARCHAR(100),
            user_agent TEXT
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sessoes_usuario
        ON sessoes(usuario_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sessoes_expira
        ON sessoes(expira_em)
    `);
}

function hashTokenSessao(token) {
    return crypto
        .createHash("sha256")
        .update(String(token || ""), "utf8")
        .digest("hex");
}

function lerCookie(req, nome) {
    const cabecalho = String(req.headers.cookie || "");

    if (!cabecalho) {
        return "";
    }

    const partes = cabecalho.split(";");

    for (const parte of partes) {
        const indice = parte.indexOf("=");

        if (indice < 0) {
            continue;
        }

        const chave = parte.slice(0, indice).trim();

        if (chave !== nome) {
            continue;
        }

        return decodeURIComponent(
            parte.slice(indice + 1).trim()
        );
    }

    return "";
}

function definirCookieSessao(res, token) {
    const atributos = [
        `${COOKIE_SESSAO}=${encodeURIComponent(token)}`,
        "Path=/",
        `Max-Age=${Math.floor(DURACAO_SESSAO_MS / 1000)}`,
        "HttpOnly",
        "SameSite=Lax"
    ];

    if (COOKIE_SECURE) {
        atributos.push("Secure");
    }

    res.setHeader(
        "Set-Cookie",
        atributos.join("; ")
    );
}

function limparCookieSessao(res) {
    const atributos = [
        `${COOKIE_SESSAO}=`,
        "Path=/",
        "Max-Age=0",
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        "HttpOnly",
        "SameSite=Lax"
    ];

    if (COOKIE_SECURE) {
        atributos.push("Secure");
    }

    res.setHeader(
        "Set-Cookie",
        atributos.join("; ")
    );
}

function extrairBearer(req) {
    const cabecalho =
        String(req.headers.authorization || "");

    return cabecalho.startsWith("Bearer ")
        ? cabecalho.slice(7).trim()
        : "";
}

async function criarSessaoServidor(usuario, req, res) {
    await garantirTabelaSessoes();

    const token =
        crypto.randomBytes(48).toString("base64url");

    const hash =
        hashTokenSessao(token);

    await pool.query(`
        INSERT INTO sessoes
        (
            token_hash,
            usuario_id,
            expira_em,
            ip,
            user_agent
        )
        VALUES
        (
            $1,
            $2,
            CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
            $4,
            $5
        )
    `, [
        hash,
        Number(usuario.id),
        DURACAO_SESSAO_MS,
        String(req.ip || "").slice(0, 100),
        String(req.headers["user-agent"] || "").slice(0, 1000)
    ]);

    definirCookieSessao(res, token);

    return token;
}

async function buscarSessaoServidor(token) {
    if (!token) {
        return null;
    }

    await garantirTabelaSessoes();

    const resultado = await pool.query(`
        SELECT
            s.id AS sessao_id,
            s.usuario_id,
            u.usuario,
            u.nome,
            u.perfil,
            u.ativo,
            s.expira_em
        FROM sessoes s
        INNER JOIN usuarios u
            ON u.id = s.usuario_id
        WHERE s.token_hash = $1
          AND s.revogada_em IS NULL
          AND s.expira_em > CURRENT_TIMESTAMP
        LIMIT 1
    `, [
        hashTokenSessao(token)
    ]);

    if (!resultado.rowCount) {
        return null;
    }

    const sessao = resultado.rows[0];

    await pool.query(`
        UPDATE sessoes
        SET ultimo_acesso_em = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [
        sessao.sessao_id
    ]);

    return sessao;
}

async function autenticarRequisicao(req, res) {
    const cookieToken =
        lerCookie(req, COOKIE_SESSAO);

    const bearerToken =
        extrairBearer(req);

    const token =
        cookieToken || bearerToken;

    if (token) {
        const sessao =
            await buscarSessaoServidor(token);

        if (sessao && sessao.ativo === true) {
            req.sessaoAtual = sessao;

            // Migração silenciosa: quem ainda usa Bearer recebe
            // também o cookie HttpOnly.
            if (!cookieToken) {
                definirCookieSessao(
                    res,
                    token
                );
            }

            return sessao;
        }
    }

    // Compatibilidade com tokens assinados da V17.
    const tokenLegado =
        validarTokenSessao(
            bearerToken
        );

    if (!tokenLegado) {
        return null;
    }

    const resultado =
        await pool.query(`
            SELECT
                id AS usuario_id,
                usuario,
                nome,
                perfil,
                ativo
            FROM usuarios
            WHERE id = $1
            LIMIT 1
        `, [
            tokenLegado.id
        ]);

    if (
        !resultado.rowCount ||
        resultado.rows[0].ativo !== true
    ) {
        return null;
    }

    return {
        ...resultado.rows[0],
        sessao_id: null,
        expira_em: new Date(
            Number(tokenLegado.exp)
        )
    };
}

async function revogarSessaoAtual(req) {
    const cookieToken =
        lerCookie(req, COOKIE_SESSAO);

    const bearerToken =
        extrairBearer(req);

    const token =
        cookieToken || bearerToken;

    if (!token) {
        return;
    }

    await garantirTabelaSessoes();

    await pool.query(`
        UPDATE sessoes
        SET revogada_em = CURRENT_TIMESTAMP
        WHERE token_hash = $1
          AND revogada_em IS NULL
    `, [
        hashTokenSessao(token)
    ]);
}

async function limparSessoesExpiradas() {
    try {
        await garantirTabelaSessoes();

        await pool.query(`
            DELETE FROM sessoes
            WHERE expira_em <= CURRENT_TIMESTAMP
               OR revogada_em < CURRENT_TIMESTAMP - INTERVAL '7 days'
        `);
    } catch (erro) {
        console.warn(
            "Não foi possível limpar sessões expiradas:",
            erro.message
        );
    }
}

const timerLimpezaSessoes =
    setInterval(
        limparSessoesExpiradas,
        30 * 60 * 1000
    );

timerLimpezaSessoes.unref?.();

/* =========================================================
   AUDITORIA ADMINISTRATIVA
========================================================= */

async function garantirTabelaAuditoria() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS auditoria_alteracoes (
            id BIGSERIAL PRIMARY KEY,
            acao VARCHAR(50) NOT NULL,
            entidade VARCHAR(80) NOT NULL,
            registro_id VARCHAR(100),
            usuario VARCHAR(100) NOT NULL,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            antes JSONB,
            depois JSONB,
            detalhes TEXT
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em
        ON auditoria_alteracoes(criado_em DESC)
    `);
}

async function registrarAuditoria({ acao, entidade, registroId = "", usuario, antes = null, depois = null, detalhes = "" }) {
    try {
        await garantirTabelaAuditoria();
        await pool.query(`
            INSERT INTO auditoria_alteracoes
            (acao, entidade, registro_id, usuario, antes, depois, detalhes)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
        `, [
            String(acao || "").trim(),
            String(entidade || "").trim(),
            String(registroId || "").trim(),
            String(usuario || "sistema").trim(),
            antes == null ? null : JSON.stringify(antes),
            depois == null ? null : JSON.stringify(depois),
            String(detalhes || "").trim()
        ]);
    } catch (erro) {
        console.error("Erro ao registrar auditoria:", erro);
    }
}



/* =========================================================
   V21.7 - RECUPERAÇÃO DE PRODUTOS E DOAÇÕES
========================================================= */
async function garantirTabelasRecuperacaoDoacao() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS recuperacoes_produtos (
            id VARCHAR(100) PRIMARY KEY,
            codigo VARCHAR(50),
            produto VARCHAR(255) NOT NULL,
            fornecedor VARCHAR(255),
            codigo_fornecedor VARCHAR(50),
            categoria VARCHAR(50),
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
            quantidade_recuperada NUMERIC(15,3) NOT NULL DEFAULT 0,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            setor VARCHAR(100),
            observacao TEXT,
            usuario_lancamento VARCHAR(100),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_recuperacoes_criado_em
        ON recuperacoes_produtos(criado_em DESC)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_recuperacoes_fornecedor
        ON recuperacoes_produtos(fornecedor)
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS doacoes_produtos (
            id VARCHAR(100) PRIMARY KEY,
            codigo VARCHAR(50),
            produto VARCHAR(255) NOT NULL,
            fornecedor VARCHAR(255),
            codigo_fornecedor VARCHAR(50),
            categoria VARCHAR(50),
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            beneficiario VARCHAR(255) NOT NULL,
            data_doacao DATE NOT NULL DEFAULT CURRENT_DATE,
            observacao TEXT,
            usuario_lancamento VARCHAR(100),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_doacoes_data
        ON doacoes_produtos(data_doacao DESC)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_doacoes_beneficiario
        ON doacoes_produtos(beneficiario)
    `);
}

/* =========================================================
   NOTIFICAÇÕES POR USUÁRIO
========================================================= */

app.get(
    "/api/notificacoes",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaNotificacoes();

            const resultado = await pool.query(`
                SELECT id, tipo, titulo, mensagem, tarefa_id, lida, criado_em
                FROM notificacoes
                WHERE usuario_id = $1
                ORDER BY criado_em DESC, id DESC
                LIMIT 50
            `, [req.usuarioAtual.id]);

            const naoLidas = await pool.query(`
                SELECT COUNT(*)::int AS total
                FROM notificacoes
                WHERE usuario_id = $1 AND lida = FALSE
            `, [req.usuarioAtual.id]);

            return res.json({
                notificacoes: resultado.rows.map(item => ({
                    id: String(item.id),
                    tipo: item.tipo,
                    titulo: item.titulo,
                    mensagem: item.mensagem || "",
                    tarefaId: item.tarefa_id == null ? null : String(item.tarefa_id),
                    lida: item.lida === true,
                    criadoEm: item.criado_em
                })),
                naoLidas: Number(naoLidas.rows[0]?.total || 0)
            });
        } catch (erro) {
            console.error("Erro ao carregar notificações:", erro);
            return res.status(500).json({ erro: "Erro ao carregar notificações." });
        }
    }
);

app.patch(
    "/api/notificacoes/lidas",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaNotificacoes();
            await pool.query(`
                UPDATE notificacoes
                SET lida = TRUE
                WHERE usuario_id = $1 AND lida = FALSE
            `, [req.usuarioAtual.id]);
            return res.json({ ok: true });
        } catch (erro) {
            console.error("Erro ao marcar notificações como lidas:", erro);
            return res.status(500).json({ erro: "Erro ao atualizar notificações." });
        }
    }
);

app.delete(
    "/api/notificacoes/lidas",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaNotificacoes();
            const resultado = await pool.query(`
                DELETE FROM notificacoes
                WHERE usuario_id = $1 AND lida = TRUE
            `, [req.usuarioAtual.id]);
            return res.json({ ok: true, removidas: Number(resultado.rowCount || 0) });
        } catch (erro) {
            console.error("Erro ao limpar notificações lidas:", erro);
            return res.status(500).json({ erro: "Erro ao limpar notificações lidas." });
        }
    }
);


app.patch(
    "/api/notificacoes/:id/lida",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaNotificacoes();
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ erro: "Notificação inválida." });
            }
            const resultado = await pool.query(`
                UPDATE notificacoes
                SET lida = TRUE
                WHERE id = $1 AND usuario_id = $2
                RETURNING id
            `, [id, req.usuarioAtual.id]);
            if (!resultado.rowCount) {
                return res.status(404).json({ erro: "Notificação não encontrada." });
            }
            return res.json({ ok: true, id });
        } catch (erro) {
            console.error("Erro ao marcar notificação como lida:", erro);
            return res.status(500).json({ erro: "Erro ao atualizar notificação." });
        }
    }
);


/* =========================================================
   TAREFAS DIÁRIAS / CHECKLIST POR USUÁRIO
========================================================= */

async function garantirTabelaNotificacoes() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificacoes (
            id BIGSERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            tipo VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            mensagem TEXT,
            tarefa_id BIGINT,
            lida BOOLEAN NOT NULL DEFAULT FALSE,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida_criado
        ON notificacoes(usuario_id, lida, criado_em DESC)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_notificacoes_tarefa
        ON notificacoes(tarefa_id)
    `);
}

async function criarNotificacao({ usuarioId, tipo, titulo, mensagem = "", tarefaId = null }) {
    try {
        await garantirTabelaNotificacoes();
        await pool.query(`
            INSERT INTO notificacoes
            (usuario_id, tipo, titulo, mensagem, tarefa_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            Number(usuarioId),
            String(tipo || "tarefa"),
            String(titulo || "Notificação"),
            String(mensagem || ""),
            tarefaId == null ? null : Number(tarefaId)
        ]);
    } catch (erro) {
        console.error("Erro ao criar notificação:", erro);
    }
}

async function garantirTabelaTarefas() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tarefas_diarias (
            id BIGSERIAL PRIMARY KEY,
            usuario_id INTEGER,
            usuario_nome VARCHAR(255) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            descricao TEXT,
            data_tarefa DATE NOT NULL,
            concluida BOOLEAN NOT NULL DEFAULT FALSE,
            concluida_em TIMESTAMPTZ,
            criado_por INTEGER,
            criado_por_nome VARCHAR(255),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tarefas_diarias_usuario_data
        ON tarefas_diarias(usuario_id, data_tarefa)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_tarefas_diarias_data
        ON tarefas_diarias(data_tarefa)
    `);
}

function dataTarefaValida(valor) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "").trim());
}

function normalizarDataTarefa(valor) {
    const data = String(valor || "").trim();
    return dataTarefaValida(data) ? data : "";
}

function tarefaParaJson(item) {
    return {
        id: String(item.id),
        usuarioId: item.usuario_id == null ? null : Number(item.usuario_id),
        usuarioNome: item.usuario_nome || "",
        titulo: item.titulo || "",
        descricao: item.descricao || "",
        dataTarefa: item.data_tarefa,
        concluida: item.concluida === true,
        concluidaEm: item.concluida_em || null,
        criadoPor: item.criado_por == null ? null : Number(item.criado_por),
        criadoPorNome: item.criado_por_nome || "",
        criadoEm: item.criado_em
    };
}

app.get(
    "/api/tarefas/usuarios",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaUsuarios();

            const resultado = await pool.query(`
                SELECT id, usuario, nome, perfil, ativo
                FROM usuarios
                WHERE ativo = TRUE
                ORDER BY nome ASC
            `);

            return res.json(resultado.rows.map(item => ({
                id: Number(item.id),
                usuario: item.usuario,
                nome: item.nome,
                perfil: item.perfil,
                ativo: item.ativo === true
            })));
        } catch (erro) {
            console.error("Erro ao listar usuários das tarefas:", erro);
            return res.status(500).json({ erro: "Erro ao carregar os usuários disponíveis para tarefas." });
        }
    }
);


app.get(
    "/api/tarefas/minhas",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const data = normalizarDataTarefa(req.query.data) ||
                chaveDiaLocal(new Date());

            const resultado = await pool.query(`
                SELECT
                    id,
                    usuario_id,
                    usuario_nome,
                    titulo,
                    descricao,
                    data_tarefa,
                    concluida,
                    concluida_em,
                    criado_por,
                    criado_por_nome,
                    criado_em
                FROM tarefas_diarias
                WHERE usuario_id = $1
                  AND data_tarefa = $2::date
                ORDER BY concluida ASC, id ASC
            `, [req.usuarioAtual.id, data]);

            return res.json(resultado.rows.map(tarefaParaJson));
        } catch (erro) {
            console.error("Erro ao listar minhas tarefas:", erro);
            return res.status(500).json({ erro: "Erro ao carregar suas tarefas." });
        }
    }
);

app.get(
    "/api/tarefas/admin",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const data = normalizarDataTarefa(req.query.data) ||
                chaveDiaLocal(new Date());
            const usuarioId = Number(req.query.usuarioId || 0);

            const params = [data];
            let filtroUsuario = "";

            if (Number.isInteger(usuarioId) && usuarioId > 0) {
                params.push(usuarioId);
                filtroUsuario = "AND t.usuario_id = $2";
            }

            const resultado = await pool.query(`
                SELECT
                    t.id,
                    t.usuario_id,
                    t.usuario_nome,
                    t.titulo,
                    t.descricao,
                    t.data_tarefa,
                    t.concluida,
                    t.concluida_em,
                    t.criado_por,
                    t.criado_por_nome,
                    t.criado_em
                FROM tarefas_diarias t
                WHERE t.data_tarefa = $1::date
                ${filtroUsuario}
                ORDER BY t.usuario_nome ASC, t.concluida ASC, t.id ASC
            `, params);

            return res.json(resultado.rows.map(tarefaParaJson));
        } catch (erro) {
            console.error("Erro ao listar tarefas administrativas:", erro);
            return res.status(500).json({ erro: "Erro ao carregar as tarefas." });
        }
    }
);

app.post(
    "/api/tarefas",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const titulo = String(req.body.titulo || "").trim();
            const descricao = String(req.body.descricao || "").trim();
            const data = normalizarDataTarefa(req.body.data);
            const usuarioId = String(req.body.usuarioId || "").trim();

            if (!titulo) {
                return res.status(400).json({ erro: "Informe a tarefa." });
            }

            if (titulo.length > 255) {
                return res.status(400).json({ erro: "A tarefa deve ter no máximo 255 caracteres." });
            }

            if (!data) {
                return res.status(400).json({ erro: "Informe uma data válida." });
            }

            if (descricao.length > 1000) {
                return res.status(400).json({ erro: "A descrição deve ter no máximo 1000 caracteres." });
            }

            let usuarios = [];

            if (usuarioId === "todos") {
                const resultadoUsuarios = await pool.query(`
                    SELECT id, nome
                    FROM usuarios
                    WHERE ativo = TRUE
                    ORDER BY nome ASC
                `);
                usuarios = resultadoUsuarios.rows;
            } else {
                const id = Number(usuarioId);
                if (!Number.isInteger(id) || id <= 0) {
                    return res.status(400).json({ erro: "Selecione um usuário." });
                }

                const resultadoUsuario = await pool.query(`
                    SELECT id, nome, ativo
                    FROM usuarios
                    WHERE id = $1
                    LIMIT 1
                `, [id]);

                if (!resultadoUsuario.rowCount || resultadoUsuario.rows[0].ativo !== true) {
                    return res.status(400).json({ erro: "Usuário selecionado não está ativo." });
                }

                usuarios = [resultadoUsuario.rows[0]];
            }

            if (!usuarios.length) {
                return res.status(400).json({ erro: "Não há usuários ativos para receber a tarefa." });
            }

            const criadas = [];

            for (const usuario of usuarios) {
                const resultado = await pool.query(`
                    INSERT INTO tarefas_diarias
                    (
                        usuario_id,
                        usuario_nome,
                        titulo,
                        descricao,
                        data_tarefa,
                        criado_por,
                        criado_por_nome
                    )
                    VALUES ($1, $2, $3, $4, $5::date, $6, $7)
                    RETURNING
                        id,
                        usuario_id,
                        usuario_nome,
                        titulo,
                        descricao,
                        data_tarefa,
                        concluida,
                        concluida_em,
                        criado_por,
                        criado_por_nome,
                        criado_em
                `, [
                    usuario.id,
                    usuario.nome,
                    titulo,
                    descricao,
                    data,
                    req.usuarioAdmin.id,
                    req.usuarioAdmin.nome
                ]);

                const tarefa = resultado.rows[0];
                criadas.push(tarefaParaJson(tarefa));

                await registrarAuditoria({
                    acao: "criado",
                    entidade: "tarefa_diaria",
                    registroId: tarefa.id,
                    usuario: req.usuarioAdmin.usuario,
                    depois: tarefa,
                    detalhes: `Tarefa diária criada para ${usuario.nome} em ${data}.`
                });

                await criarNotificacao({
                    usuarioId: usuario.id,
                    tipo: "tarefa_nova",
                    titulo: "Nova tarefa atribuída",
                    mensagem: `${req.usuarioAdmin.nome} atribuiu a tarefa "${titulo}" para você.`,
                    tarefaId: tarefa.id
                });
            }

            emitirEventoSistema("tarefas-atualizadas", {
                acao: "criada",
                data,
                usuarioId: usuarioId === "todos" ? "todos" : Number(usuarioId)
            });

            return res.status(201).json({
                ok: true,
                quantidade: criadas.length,
                tarefas: criadas
            });
        } catch (erro) {
            console.error("Erro ao criar tarefa:", erro);
            return res.status(500).json({ erro: "Erro ao criar a tarefa." });
        }
    }
);

app.post(
    "/api/tarefas/copiar-dia",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const origem = normalizarDataTarefa(req.body.origem);
            const destino = normalizarDataTarefa(req.body.destino);
            const usuarioId = Number(req.body.usuarioId || 0);

            if (!origem || !destino) {
                return res.status(400).json({ erro: "Informe as datas de origem e destino." });
            }

            if (origem === destino) {
                return res.status(400).json({ erro: "A data de origem e a data de destino precisam ser diferentes." });
            }

            const params = [origem];
            let filtro = "";
            if (Number.isInteger(usuarioId) && usuarioId > 0) {
                params.push(usuarioId);
                filtro = "AND usuario_id = $2";
            }

            const origemResult = await pool.query(`
                SELECT *
                FROM tarefas_diarias
                WHERE data_tarefa = $1::date
                ${filtro}
                ORDER BY usuario_nome ASC, id ASC
            `, params);

            let quantidade = 0;
            for (const tarefa of origemResult.rows) {
                const existe = await pool.query(`
                    SELECT id
                    FROM tarefas_diarias
                    WHERE usuario_id = $1
                      AND data_tarefa = $2::date
                      AND LOWER(TRIM(titulo)) = LOWER(TRIM($3))
                      AND COALESCE(descricao, '') = COALESCE($4, '')
                    LIMIT 1
                `, [tarefa.usuario_id, destino, tarefa.titulo, tarefa.descricao]);

                if (existe.rowCount) continue;

                const criada = await pool.query(`
                    INSERT INTO tarefas_diarias
                    (usuario_id, usuario_nome, titulo, descricao, data_tarefa, criado_por, criado_por_nome)
                    VALUES ($1, $2, $3, $4, $5::date, $6, $7)
                    RETURNING id
                `, [
                    tarefa.usuario_id,
                    tarefa.usuario_nome,
                    tarefa.titulo,
                    tarefa.descricao,
                    destino,
                    req.usuarioAdmin.id,
                    req.usuarioAdmin.nome
                ]);

                quantidade += 1;
                const novoId = criada.rows[0].id;

                await criarNotificacao({
                    usuarioId: tarefa.usuario_id,
                    tipo: "tarefa_nova",
                    titulo: "Nova tarefa atribuída",
                    mensagem: `${req.usuarioAdmin.nome} copiou a tarefa "${tarefa.titulo}" para ${destino}.`,
                    tarefaId: novoId
                });

                await registrarAuditoria({
                    acao: "copiado",
                    entidade: "tarefa_diaria",
                    registroId: novoId,
                    usuario: req.usuarioAdmin.usuario,
                    depois: { origem, destino, tarefaOriginalId: tarefa.id, titulo: tarefa.titulo },
                    detalhes: `Tarefa copiada de ${origem} para ${destino}.`
                });
            }

            emitirEventoSistema("tarefas-atualizadas", {
                acao: "copiadas",
                origem,
                destino,
                usuarioId: usuarioId > 0 ? usuarioId : "todos"
            });

            return res.json({ ok: true, quantidade, origem, destino });
        } catch (erro) {
            console.error("Erro ao copiar tarefas:", erro);
            return res.status(500).json({ erro: "Erro ao copiar as tarefas." });
        }
    }
);


app.patch(
    "/api/tarefas/minhas/concluir-todas",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();
            const data = normalizarDataTarefa(req.body.data) || chaveDiaLocal(new Date());

            const resultado = await pool.query(`
                UPDATE tarefas_diarias
                SET concluida = TRUE,
                    concluida_em = CURRENT_TIMESTAMP
                WHERE usuario_id = $1
                  AND data_tarefa = $2::date
                  AND concluida = FALSE
                RETURNING *
            `, [req.usuarioAtual.id, data]);

            const administradores = await pool.query(`
                SELECT id
                FROM usuarios
                WHERE ativo = TRUE
                  AND perfil = 'admin'
                  AND id <> $1
            `, [req.usuarioAtual.id]);

            for (const tarefa of resultado.rows) {
                await registrarAuditoria({
                    acao: "concluido",
                    entidade: "tarefa_diaria",
                    registroId: tarefa.id,
                    usuario: req.usuarioAtual.usuario,
                    depois: tarefa,
                    detalhes: `Checklist concluído em lote: ${tarefa.titulo}.`
                });

                for (const administrador of administradores.rows) {
                    await criarNotificacao({
                        usuarioId: administrador.id,
                        tipo: "tarefa_concluida",
                        titulo: "Tarefa concluída",
                        mensagem: `${req.usuarioAtual.nome} concluiu a tarefa "${tarefa.titulo}".`,
                        tarefaId: tarefa.id
                    });
                }
            }

            emitirEventoSistema("tarefas-atualizadas", {
                acao: "concluidas-em-lote",
                data,
                usuarioId: req.usuarioAtual.id,
                quantidade: resultado.rowCount
            });

            return res.json({
                ok: true,
                quantidade: resultado.rowCount
            });
        } catch (erro) {
            console.error("Erro ao concluir tarefas em lote:", erro);
            return res.status(500).json({ erro: "Erro ao concluir as tarefas pendentes." });
        }
    }
);


app.patch(
    "/api/tarefas/:id",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const id = Number(req.params.id);
            const concluida = req.body.concluida === true;

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ erro: "Tarefa inválida." });
            }

            const antesResultado = await pool.query(`
                SELECT *
                FROM tarefas_diarias
                WHERE id = $1
                  AND usuario_id = $2
                LIMIT 1
            `, [id, req.usuarioAtual.id]);

            if (!antesResultado.rowCount) {
                return res.status(404).json({ erro: "Tarefa não encontrada para este usuário." });
            }

            const antes = antesResultado.rows[0];

            const resultado = await pool.query(`
                UPDATE tarefas_diarias
                SET
                    concluida = $1,
                    concluida_em = CASE
                        WHEN $1 = TRUE THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
                WHERE id = $2
                  AND usuario_id = $3
                RETURNING
                    id,
                    usuario_id,
                    usuario_nome,
                    titulo,
                    descricao,
                    data_tarefa,
                    concluida,
                    concluida_em,
                    criado_por,
                    criado_por_nome,
                    criado_em
            `, [concluida, id, req.usuarioAtual.id]);

            const depois = resultado.rows[0];

            await registrarAuditoria({
                acao: concluida ? "concluido" : "reaberto",
                entidade: "tarefa_diaria",
                registroId: id,
                usuario: req.usuarioAtual.usuario,
                antes,
                depois,
                detalhes: `Checklist ${concluida ? "concluído" : "reaberto"}: ${depois.titulo}.`
            });

            const administradores = await pool.query(`
                SELECT id
                FROM usuarios
                WHERE ativo = TRUE
                  AND perfil = 'admin'
                  AND id <> $1
            `, [req.usuarioAtual.id]);

            for (const administrador of administradores.rows) {
                await criarNotificacao({
                    usuarioId: administrador.id,
                    tipo: concluida ? "tarefa_concluida" : "tarefa_reaberta",
                    titulo: concluida ? "Tarefa concluída" : "Tarefa reaberta",
                    mensagem: `${req.usuarioAtual.nome} ${concluida ? "concluiu" : "reabriu"} a tarefa "${depois.titulo}".`,
                    tarefaId: depois.id
                });
            }

            emitirEventoSistema("tarefas-atualizadas", {
                acao: concluida ? "concluida" : "reaberta",
                id,
                usuarioId: req.usuarioAtual.id
            });

            return res.json(tarefaParaJson(depois));
        } catch (erro) {
            console.error("Erro ao atualizar tarefa:", erro);
            return res.status(500).json({ erro: "Erro ao atualizar a tarefa." });
        }
    }
);

app.delete(
    "/api/tarefas/:id",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaTarefas();

            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ erro: "Tarefa inválida." });
            }

            const antesResultado = await pool.query(`
                SELECT *
                FROM tarefas_diarias
                WHERE id = $1
                LIMIT 1
            `, [id]);

            if (!antesResultado.rowCount) {
                return res.status(404).json({ erro: "Tarefa não encontrada." });
            }

            const antes = antesResultado.rows[0];

            await pool.query(`
                DELETE FROM tarefas_diarias
                WHERE id = $1
            `, [id]);

            await registrarAuditoria({
                acao: "excluido",
                entidade: "tarefa_diaria",
                registroId: id,
                usuario: req.usuarioAdmin.usuario,
                antes,
                detalhes: `Tarefa diária excluída: ${antes.titulo}.`
            });

            emitirEventoSistema("tarefas-atualizadas", {
                acao: "excluida",
                id,
                data: antes.data_tarefa
            });

            return res.json({ ok: true, id });
        } catch (erro) {
            console.error("Erro ao excluir tarefa:", erro);
            return res.status(500).json({ erro: "Erro ao excluir a tarefa." });
        }
    }
);

app.get(
    "/api/auditoria",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaAuditoria();
            const limite = Math.min(Math.max(Number(req.query.limite) || 1000, 1), 2000);
            const resultado = await pool.query(`
                SELECT id, acao, entidade, registro_id, usuario, criado_em, antes, depois, detalhes
                FROM auditoria_alteracoes
                ORDER BY criado_em DESC, id DESC
                LIMIT $1
            `, [limite]);

            return res.json(resultado.rows.map(item => ({
                id: String(item.id),
                acao: item.acao,
                entidade: item.entidade,
                registroId: item.registro_id || "",
                usuario: item.usuario,
                criadoEm: item.criado_em,
                antes: item.antes || null,
                depois: item.depois || null,
                detalhes: item.detalhes || ""
            })));
        } catch (erro) {
            console.error("Erro ao listar auditoria:", erro);
            return res.status(500).json({ erro: "Erro ao carregar o histórico de alterações." });
        }
    }
);


app.delete(
    "/api/auditoria",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaAuditoria();
            const ids = Array.isArray(req.body?.ids)
                ? Array.from(new Set(req.body.ids.map(id => String(id).trim()).filter(id => /^\d+$/.test(id))))
                : [];

            if (!ids.length) {
                return res.status(400).json({ erro: "Selecione pelo menos um registro do histórico." });
            }

            if (ids.length > 2000) {
                return res.status(400).json({ erro: "Você pode excluir no máximo 2000 registros por vez." });
            }

            const resultado = await pool.query(
                `DELETE FROM auditoria_alteracoes WHERE id = ANY($1::bigint[]) RETURNING id`,
                [ids]
            );

            emitirEventoSistema("historico-atualizado", {
                acao: "excluido",
                quantidade: resultado.rowCount
            });

            return res.json({ ok: true, excluidos: resultado.rowCount });
        } catch (erro) {
            console.error("Erro ao excluir histórico de alterações:", erro);
            return res.status(500).json({ erro: "Erro ao excluir os registros selecionados." });
        }
    }
);


function gerarTokenSessao(
    usuario
) {

    const payload = {

        id:
            Number(usuario.id),

        usuario:
            usuario.usuario,

        perfil:
            usuario.perfil,

        exp:
            Date.now() +
            DURACAO_SESSAO_MS

    };


    const corpo =
        Buffer
            .from(
                JSON.stringify(payload)
            )
            .toString(
                "base64url"
            );


    const assinatura =
        crypto
            .createHmac(
                "sha256",
                SESSION_SECRET
            )
            .update(corpo)
            .digest(
                "base64url"
            );


    return `${corpo}.${assinatura}`;

}


function validarTokenSessao(
    token
) {

    try {

        const partes =
            String(token || "")
                .split(".");


        if (partes.length !== 2) {

            return null;

        }


        const [
            corpo,
            assinaturaRecebida
        ] = partes;


        const assinaturaEsperada =
            crypto
                .createHmac(
                    "sha256",
                    SESSION_SECRET
                )
                .update(corpo)
                .digest(
                    "base64url"
                );


        const recebidaBuffer =
            Buffer.from(
                assinaturaRecebida
            );


        const esperadaBuffer =
            Buffer.from(
                assinaturaEsperada
            );


        if (
            recebidaBuffer.length !==
            esperadaBuffer.length
        ) {

            return null;

        }


        if (
            !crypto.timingSafeEqual(
                recebidaBuffer,
                esperadaBuffer
            )
        ) {

            return null;

        }


        const payload =
            JSON.parse(
                Buffer
                    .from(
                        corpo,
                        "base64url"
                    )
                    .toString(
                        "utf8"
                    )
            );


        if (
            !payload.exp ||
            Date.now() >
                Number(payload.exp)
        ) {

            return null;

        }


        return payload;


    } catch (erro) {

        return null;

    }

}


async function exigirUsuario(
    req,
    res,
    next
) {
    try {
        const sessao =
            await autenticarRequisicao(
                req,
                res
            );

        if (!sessao) {
            return res
                .status(401)
                .json({
                    erro:
                        "Sessão inválida ou expirada. Faça login novamente."
                });
        }

        req.usuarioAtual = {
            id: Number(sessao.usuario_id),
            usuario: sessao.usuario,
            nome: sessao.nome,
            perfil: sessao.perfil,
            ativo: sessao.ativo
        };

        return next();

    } catch (erro) {
        console.error(
            "Erro ao validar usuário:",
            erro
        );

        return res
            .status(500)
            .json({
                erro:
                    "Erro ao validar sessão do usuário."
            });
    }
}


async function exigirAdmin(
    req,
    res,
    next
) {
    try {
        const sessao =
            await autenticarRequisicao(
                req,
                res
            );

        if (!sessao) {
            return res
                .status(401)
                .json({
                    erro:
                        "Sessão inválida ou expirada. Faça login novamente."
                });
        }

        if (
            sessao.perfil !== "admin"
        ) {
            return res
                .status(403)
                .json({
                    erro:
                        "Acesso permitido somente ao administrador."
                });
        }

        req.usuarioAdmin = {
            id: Number(sessao.usuario_id),
            usuario: sessao.usuario,
            nome: sessao.nome,
            perfil: sessao.perfil,
            ativo: sessao.ativo
        };

        return next();

    } catch (erro) {
        console.error(
            "Erro ao validar administrador:",
            erro
        );

        return res
            .status(500)
            .json({
                erro:
                    "Erro ao validar acesso administrativo."
            });
    }
}


/* =========================================================
   HISTÓRICO PERMANENTE DE AVARIAS
========================================================= */

async function garantirTabelaHistorico() {

    /*
       V20.1 - MIGRAÇÃO COMPATÍVEL COM BANCOS ANTIGOS
       -----------------------------------------------
       O problema encontrado em produção era que a tabela
       historico_avarias já existia de versões anteriores.
       CREATE TABLE IF NOT EXISTS não altera uma tabela existente,
       então colunas novas como removido/categoria poderiam não existir
       ou possuir NULL nos registros antigos.

       Esta rotina cria a tabela quando necessário e, depois, garante
       individualmente todas as colunas usadas pelo sistema atual.
    */

    await pool.query(`
        CREATE TABLE IF NOT EXISTS historico_avarias (
            id VARCHAR(100) PRIMARY KEY,
            codigo VARCHAR(50),
            produto VARCHAR(255) NOT NULL,
            fornecedor VARCHAR(255),
            codigo_fornecedor VARCHAR(50),
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            setor VARCHAR(100),
            tipo VARCHAR(100),
            caixa VARCHAR(255),
            status VARCHAR(50) NOT NULL DEFAULT 'Pendente',
            observacao TEXT,
            usuario_lancamento VARCHAR(100),
            criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            movimentado_em TIMESTAMPTZ,
            historico_criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            removido BOOLEAN NOT NULL DEFAULT FALSE,
            categoria VARCHAR(50)
        )
    `);

    const colunas = [
        ['codigo', 'VARCHAR(50)'],
        ['produto', 'VARCHAR(255)'],
        ['fornecedor', 'VARCHAR(255)'],
        ['codigo_fornecedor', 'VARCHAR(50)'],
        ['quantidade', 'NUMERIC(15,3)'],
        ['valor_unitario', 'NUMERIC(15,4)'],
        ['setor', 'VARCHAR(100)'],
        ['tipo', 'VARCHAR(100)'],
        ['caixa', 'VARCHAR(255)'],
        ['status', 'VARCHAR(50)'],
        ['observacao', 'TEXT'],
        ['usuario_lancamento', 'VARCHAR(100)'],
        ['criado_em', 'TIMESTAMPTZ'],
        ['movimentado_em', 'TIMESTAMPTZ'],
        ['historico_criado_em', 'TIMESTAMPTZ'],
        ['removido', 'BOOLEAN'],
        ['categoria', 'VARCHAR(50)']
    ];

    for (const [nome, tipo] of colunas) {
        await pool.query(`
            ALTER TABLE historico_avarias
            ADD COLUMN IF NOT EXISTS ${nome} ${tipo}
        `);
    }

    // Corrige registros antigos que ficaram com NULL nas colunas novas.
    await pool.query(`
        UPDATE historico_avarias
        SET removido = FALSE
        WHERE removido IS NULL
    `);

    await pool.query(`
        UPDATE historico_avarias
        SET historico_criado_em = COALESCE(historico_criado_em, criado_em, CURRENT_TIMESTAMP)
        WHERE historico_criado_em IS NULL
    `);

    await pool.query(`
        UPDATE historico_avarias
        SET criado_em = COALESCE(criado_em, historico_criado_em, CURRENT_TIMESTAMP)
        WHERE criado_em IS NULL
    `);

    await pool.query(`
        UPDATE historico_avarias
        SET quantidade = 0
        WHERE quantidade IS NULL
    `);

    await pool.query(`
        UPDATE historico_avarias
        SET valor_unitario = 0
        WHERE valor_unitario IS NULL
    `);

    await pool.query(`
        UPDATE historico_avarias
        SET status = 'Pendente'
        WHERE COALESCE(TRIM(status), '') = ''
    `);

    await pool.query(`
        ALTER TABLE historico_avarias
        ALTER COLUMN removido SET DEFAULT FALSE
    `);

    await pool.query(`
        ALTER TABLE historico_avarias
        ALTER COLUMN historico_criado_em SET DEFAULT CURRENT_TIMESTAMP
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_historico_avarias_criado_em
        ON historico_avarias(criado_em)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_historico_avarias_status
        ON historico_avarias(status)
    `);

}



/* =========================================================
   MAPEAMENTO - POSIÇÕES FÍSICAS
   Mantém a ordem do modelo enviado pelo setor e permite
   alterar os nomes sem alterar a posição das células.
========================================================= */

const MAPA_PADRAO = [
    ["r1c1", 1, 1, "MULTI PEL / SECAR"],
    ["r1c2", 1, 2, "FRAN... / RIO GRANDE"],
    ["r1c3", 1, 3, "SIV / GR"],
    ["r1c4", 1, 4, "GR SELI"],
    ["r1c5", 1, 5, ""],
    ["r1c6", 1, 6, "GRÃOS / TERRA"],
    ["r1c7", 1, 7, "CIA DA TERRA"],
    ["r1c8", 1, 8, ""],
    ["r1c9", 1, 9, "CIA DA TERRA"],
    ["r1c10", 1, 10, "CIA DA TERRA / NATURA"],
    ["r1c11", 1, 11, "NATURA"],
    ["r1c12", 1, 12, "NATURA"],
    ["r1c13", 1, 13, "MG"],
    ["r1c14", 1, 14, "PB PLAST / TIA SÔNIA"],
    ["r1c15", 1, 15, "POZAU / TIO PACO"],
    ["r1c16", 1, 16, "COIS PAPA / VITAMINA"],
    ["r1c17", 1, 17, "PEQUENA MARIA / DELLA"],
    ["r1c18", 1, 18, "GOLD MEC / PER LINEA"],
    ["r1c19", 1, 19, "JAMPS / CRISTAL"],
    ["r1c20", 1, 20, "PEPSICO"],

    ["r2c6", 2, 6, "PÃO DE MEL"],
    ["r2c7", 2, 7, ""],
    ["r2c8", 2, 8, ""],
    ["r2c9", 2, 9, ""],
    ["r2c10", 2, 10, ""],
    ["r2c11", 2, 11, "PÃO BR... IGUAL"],
    ["r2c12", 2, 12, "MARFIM"],
    ["r2c13", 2, 13, "MEC... S.A."],
    ["r2c14", 2, 14, "BIO EXTRATO"],
    ["r2c15", 2, 15, "MAFIM"],
    ["r2c16", 2, 16, "VITO BOL..."],
    ["r2c17", 2, 17, "BRASOR"],
    ["r2c18", 2, 18, "MARIA FOOD"],
    ["r2c19", 2, 19, "TROPI... MAST"],
    ["r2c20", 2, 20, "SÃO BRAZ"],
    ["r2c21", 2, 21, "SÃO BRAZ"],

    ["r3c6", 3, 6, "DIVINA BOLEIRA"],
    ["r3c7", 3, 7, "NOVO PÃO PÃO DE HAME"],
    ["r3c8", 3, 8, "SERENA"],
    ["r3c9", 3, 9, "ARCO VERDE"],
    ["r3c10", 3, 10, "JD NO COMÉRCIO"],
    ["r3c11", 3, 11, "IGUAL"],
    ["r3c12", 3, 12, "FARINHA SÃO JOSÉ / ST MARIA"],
    ["r3c13", 3, 13, "FORMIGA DA VIOLETA"],
    ["r3c14", 3, 14, "SOUZA"],
    ["r3c15", 3, 15, "DOCE SÃO JOSÉ / CORINGA"],
    ["r3c16", 3, 16, "B&A"],
    ["r3c17", 3, 17, "DA TERRA"],
    ["r3c18", 3, 18, "EBBA DA FRUTA"],
    ["r3c19", 3, 19, "NAT..."],
    ["r3c20", 3, 20, ""],
    ["r3c21", 3, 21, ""],
    ["r3c22", 3, 22, ""],

    ["r4c6", 4, 6, "BOLO CÉLIA / NOVOZINHO"],
    ["r4c7", 4, 7, "GARAMPO"],
    ["r4c8", 4, 8, "POLY BALAD ALIMENTOS"],
    ["r4c9", 4, 9, "COMETA"],
    ["r4c10", 4, 10, ""],
    ["r4c11", 4, 11, ""],
    ["r4c12", 4, 12, "ROSA BRANCA"],
    ["r4c13", 4, 13, "ARCO VERDE"],
    ["r4c14", 4, 14, "GOMES DA COSTA"],
    ["r4c15", 4, 15, "REI DE OURO"],
    ["r4c16", 4, 16, "ZAYTO SOR..."],
    ["r4c17", 4, 17, "URBANO"],
    ["r4c18", 4, 18, "U..."],
    ["r4c19", 4, 19, "U..."],

    ["r5c6", 5, 6, "CITRUS / CARO..."],
    ["r5c7", 5, 7, "VELHO DO AÇÚCAR / TOCOS"],
    ["r5c8", 5, 8, "KICALDO"],
    ["r5c9", 5, 9, "KICALDO"],
    ["r5c10", 5, 10, "CO GRÃO"],
    ["r5c11", 5, 11, "LA POSTINA"],
    ["r5c12", 5, 12, ""],
    ["r5c13", 5, 13, ""],
    ["r5c14", 5, 14, ""],
    ["r5c15", 5, 15, ""],
    ["r5c16", 5, 16, ""],
    ["r5c17", 5, 17, ""],
    ["r5c18", 5, 18, ""],
    ["r5c19", 5, 19, ""]
];


async function migrarMapaV114ParaV115() {
    const resultado = await pool.query(`
        SELECT id, nome
        FROM mapeamento_caixas
        WHERE linha = 1 AND coluna BETWEEN 13 AND 22
        ORDER BY coluna ASC
    `);

    const atual = Object.fromEntries(
        resultado.rows.map(item => [item.id, String(item.nome || "")])
    );

    // Se a base ainda possui r1c21/r1c22, ela está no layout antigo.
    // Movemos as posições 14..21 uma casa para a esquerda, preservando
    // inclusive nomes personalizados que o administrador já tenha editado.
    if (!Object.prototype.hasOwnProperty.call(atual, "r1c21")) {
        return;
    }

    const novos = [
        ["r1c13", atual.r1c14 || ""],
        ["r1c14", atual.r1c15 || ""],
        ["r1c15", atual.r1c16 || ""],
        ["r1c16", atual.r1c17 || ""],
        ["r1c17", atual.r1c18 || ""],
        ["r1c18", atual.r1c19 || ""],
        ["r1c19", atual.r1c20 || ""],
        ["r1c20", atual.r1c21 || ""]
    ];

    await pool.query("BEGIN");
    try {
        // Primeiro usamos valores temporários para evitar conflito de chave/posição.
        for (const [id] of novos) {
            await pool.query(`
                UPDATE mapeamento_caixas
                SET nome = $1
                WHERE id = $2
            `, [`__V115_TEMP__${id}`, id]);
        }

        for (const [id, nome] of novos) {
            await pool.query(`
                UPDATE mapeamento_caixas
                SET
                    nome = $1,
                    atualizado_em = CURRENT_TIMESTAMP,
                    atualizado_por = 'migração V11.5'
                WHERE id = $2
            `, [nome, id]);
        }

        await pool.query(`
            DELETE FROM mapeamento_caixas
            WHERE id IN ('r1c21', 'r1c22')
        `);

        await pool.query("COMMIT");
        console.log("Mapeamento V11.4 -> V11.5 aplicado: linha 1 normalizada para 20 posições.");
    } catch (erro) {
        await pool.query("ROLLBACK");
        throw erro;
    }
}

async function garantirTabelaMapeamento() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS mapeamento_caixas (
            id VARCHAR(30) PRIMARY KEY,
            linha INTEGER NOT NULL,
            coluna INTEGER NOT NULL,
            nome VARCHAR(120) NOT NULL DEFAULT '',
            ativo BOOLEAN NOT NULL DEFAULT TRUE,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_por VARCHAR(100)
        )
    `);

    await pool.query(`
        ALTER TABLE mapeamento_caixas
        ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE
    `);

    const total = await pool.query(`
        SELECT COUNT(*) AS total
        FROM mapeamento_caixas
    `);

    if (Number(total.rows[0].total) === 0) {
        for (const item of MAPA_PADRAO) {
            await pool.query(`
                INSERT INTO mapeamento_caixas
                (id, linha, coluna, nome, ativo, atualizado_por)
                VALUES ($1, $2, $3, $4, TRUE, $5)
                ON CONFLICT (id) DO NOTHING
            `, [
                item[0],
                item[1],
                item[2],
                item[3],
                "sistema"
            ]);
        }
    }    await migrarMapaV114ParaV115();
}

/* =========================================================
   MAPEAMENTO - LISTAR
========================================================= */

app.get(
    "/api/mapeamento",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaMapeamento();

            const resultado = await pool.query(`
                SELECT
                    id,
                    linha,
                    coluna,
                    nome,
                    ativo,
                    atualizado_em,
                    atualizado_por
                FROM mapeamento_caixas
                WHERE ativo = TRUE
                ORDER BY linha ASC, coluna ASC
            `);

            return res.json(resultado.rows.map(item => ({
                id: item.id,
                linha: Number(item.linha),
                coluna: Number(item.coluna),
                nome: item.nome || "",
                atualizadoEm: item.atualizado_em,
                atualizadoPor: item.atualizado_por || "",
                ativo: item.ativo !== false
            })));
        } catch (erro) {
            console.error("Erro ao listar mapeamento:", erro);
            return res.status(500).json({
                erro: "Erro ao carregar o mapeamento."
            });
        }
    }
);

/* =========================================================
   MAPEAMENTO - ALTERAR NOME
========================================================= */

app.put(
    "/api/mapeamento/:id",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaMapeamento();

            const id = String(req.params.id || "").trim();
            const nome = String(req.body.nome || "").trim().slice(0, 120);

            const resultado = await pool.query(`
                UPDATE mapeamento_caixas
                SET
                    nome = $1,
                    atualizado_em = CURRENT_TIMESTAMP,
                    atualizado_por = $2
                WHERE id = $3 AND ativo = TRUE
                RETURNING id, linha, coluna, nome, ativo, atualizado_em, atualizado_por
            `, [
                nome,
                req.usuarioAdmin.usuario,
                id
            ]);

            if (resultado.rowCount === 0) {
                return res.status(404).json({
                    erro: "Posição do mapeamento não encontrada."
                });
            }

            const item = resultado.rows[0];

            emitirEventoSistema("mapeamento-atualizado", {
                id: item.id,
                nome: item.nome,
                usuario: item.atualizado_por
            });

            return res.json({
                id: item.id,
                linha: Number(item.linha),
                coluna: Number(item.coluna),
                nome: item.nome || "",
                atualizadoEm: item.atualizado_em,
                atualizadoPor: item.atualizado_por || "",
                ativo: item.ativo !== false
            });
        } catch (erro) {
            console.error("Erro ao atualizar mapeamento:", erro);
            return res.status(500).json({
                erro: "Erro ao salvar o nome da posição."
            });
        }
    }
);

/* =========================================================
   MAPEAMENTO - EXCLUIR QUADRADO (ADMIN)
========================================================= */

app.delete(
    "/api/mapeamento/:id",
    exigirAdmin,
    async (req, res) => {
        try {
            await garantirTabelaMapeamento();
            const id = String(req.params.id || "").trim();
            const resultado = await pool.query(`
                UPDATE mapeamento_caixas
                SET
                    ativo = FALSE,
                    atualizado_em = CURRENT_TIMESTAMP,
                    atualizado_por = $1
                WHERE id = $2 AND ativo = TRUE
                RETURNING id, linha, coluna, nome, ativo, atualizado_em, atualizado_por
            `, [req.usuarioAdmin.usuario, id]);

            if (resultado.rowCount === 0) {
                return res.status(404).json({ erro: "Quadrado do mapeamento não encontrado ou já excluído." });
            }

            const item = resultado.rows[0];
            emitirEventoSistema("mapeamento-atualizado", {
                id: item.id,
                nome: item.nome,
                usuario: item.atualizado_por,
                acao: "exclusao-quadrado"
            });

            return res.json({
                id: item.id,
                linha: Number(item.linha),
                coluna: Number(item.coluna),
                nome: item.nome || "",
                ativo: false,
                atualizadoEm: item.atualizado_em,
                atualizadoPor: item.atualizado_por || ""
            });
        } catch (erro) {
            console.error("Erro ao excluir quadrado do mapeamento:", erro);
            return res.status(500).json({ erro: "Erro ao excluir o nome da posição." });
        }
    }
);

async function garantirEstruturaV10() {

    await garantirTabelaHistorico();


    await pool.query(`
        ALTER TABLE avarias
        ADD COLUMN IF NOT EXISTS usuario_lancamento VARCHAR(100)
    `);


    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS usuario_lancamento VARCHAR(100)
    `);

}


/* =========================================================
   V12 - CATEGORIAS
========================================================= */

async function garantirEstruturaV12() {

    await pool.query(`
        ALTER TABLE produtos
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);

    await pool.query(`
        ALTER TABLE avarias
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);

    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);


    await pool.query(`
        UPDATE produtos
        SET categoria = CASE
            WHEN translate(upper(descricao), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC') LIKE ANY (ARRAY[
                '%SABAO%', '%DETERG%', '%DESINF%', '%AMACIANTE%', '%ALVEJ%',
                '%AGUA SANIT%', '%LIMPA%', '%ESPONJA%', '%VASSOURA%', '%RODO%',
                '%CLORO%', '%SACO LIXO%', '%PANO%', '%BALDE%', '%DESENG%',
                '%MULTIUSO%', '%LUSTRA%', '%INSETIC%'
            ]) THEN 'Limpeza'
            WHEN translate(upper(descricao), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC') LIKE ANY (ARRAY[
                '%QUEIJO%', '%PRESUNTO%', '%MORTADELA%', '%SALAME%', '%IOGURTE%',
                '%REQUEIJAO%', '%LINGUICA%', '%SALSICHA%', '%PEITO DE PERU%',
                '%CREAM CHEESE%'
            ]) THEN 'Frios'
            WHEN translate(upper(descricao), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC') LIKE ANY (ARRAY[
                '%PAO%', '%BOLO%', '%TORTA%', '%SALGADO%', '%CROISS%', '%BRIOCHE%',
                '%BAGUETE%', '%CUCA%', '%SONHO%', '%PIZZA%'
            ]) THEN 'Padaria'
            WHEN translate(upper(descricao), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC') LIKE ANY (ARRAY[
                '%REFRIGERANTE%', '%REFRI%', '%SUCO%', '%AGUA MINERAL%', '%AGUA COM GAS%',
                '%ENERGETICO%', '%ISOTONICO%', '%CERVEJA%', '%VINHO%', '%ESPUMANTE%',
                '%DESTILADO%', '%BEBIDA%', '%CHA GELADO%', '%CAFE PRONTO%'
            ]) THEN 'Bebidas'
            ELSE 'Mercearia'
        END
        WHERE COALESCE(TRIM(categoria), '') = ''
    `);

    await pool.query(`
        UPDATE avarias a
        SET categoria = COALESCE(NULLIF(a.categoria, ''), p.categoria, 'Mercearia')
        FROM produtos p
        WHERE p.codigo = a.codigo
          AND COALESCE(TRIM(a.categoria), '') = ''
    `);

    await pool.query(`
        UPDATE historico_avarias h
        SET categoria = COALESCE(NULLIF(h.categoria, ''), p.categoria, 'Mercearia')
        FROM produtos p
        WHERE p.codigo = h.codigo
          AND COALESCE(TRIM(h.categoria), '') = ''
    `);

}


/* =========================================================
   V13 - CATEGORIA PERMANENTE POR PRODUTO
========================================================= */

async function garantirTabelaCaixaProdutos() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS caixa_produtos (
            id VARCHAR(100) PRIMARY KEY,
            caixa_id VARCHAR(100) NOT NULL,
            codigo VARCHAR(50) NOT NULL,
            produto VARCHAR(255) NOT NULL,
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 1,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            categoria VARCHAR(50),
            motivo VARCHAR(100),
            setor_origem VARCHAR(100),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_caixa_produto UNIQUE (caixa_id, codigo)
        )
    `);

    await pool.query(`
        ALTER TABLE caixa_produtos
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);

    await pool.query(`
        ALTER TABLE caixa_produtos
        ADD COLUMN IF NOT EXISTS motivo VARCHAR(100)
    `);

    await pool.query(`
        ALTER TABLE caixa_produtos
        ADD COLUMN IF NOT EXISTS setor_origem VARCHAR(100)
    `);

    await pool.query(`
        UPDATE caixa_produtos cp
        SET categoria = COALESCE(NULLIF(TRIM(cp.categoria), ''), p.categoria, 'Mercearia')
        FROM produtos p
        WHERE p.codigo = cp.codigo
          AND COALESCE(TRIM(cp.categoria), '') = ''
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_produtos_caixa
        ON caixa_produtos(caixa_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_produtos_codigo
        ON caixa_produtos(codigo)
    `);
}


async function garantirSetorOrigemPadrao() {
    const atualizacoes = [
        ["avarias", "setor"],
        ["historico_avarias", "setor"],
        ["caixa_produtos", "setor_origem"]
    ];

    for (const [tabela, coluna] of atualizacoes) {
        try {
            await pool.query(`
                UPDATE ${tabela}
                SET ${coluna} = 'Loja'
                WHERE COALESCE(TRIM(${coluna}), '') = ''
            `);
        } catch (erro) {
            console.error(`Erro ao padronizar setor de origem em ${tabela}:`, erro.message);
        }
    }
}


async function garantirEstruturaV13() {

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_avarias_codigo
        ON avarias(codigo)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_historico_avarias_codigo
        ON historico_avarias(codigo)
    `);
}


/* =========================================================
   V19 - ÍNDICES DE DESEMPENHO
========================================================= */

async function garantirIndicesV19() {
    const indices = [
        ["idx_avarias_status_criado", "avarias(status, criado_em DESC)"],
        ["idx_avarias_fornecedor_criado", "avarias(fornecedor, criado_em DESC)"],
        ["idx_avarias_categoria_criado", "avarias(categoria, criado_em DESC)"],
        ["idx_historico_status_criado", "historico_avarias(status, criado_em DESC)"],
        ["idx_historico_fornecedor_criado", "historico_avarias(fornecedor, criado_em DESC)"],
        ["idx_historico_categoria_criado", "historico_avarias(categoria, criado_em DESC)"],
        ["idx_historico_ativo_criado", "historico_avarias(criado_em DESC) WHERE removido = FALSE"],
        ["idx_caixas_criado", "caixas(criado_em DESC)"],
        ["idx_caixas_numero", "caixas(numero)"],
        ["idx_produtos_fornecedor", "produtos(fornecedor)"],
        ["idx_produtos_categoria_ativo", "produtos(categoria, ativo)"],
        ["idx_caixa_produtos_caixa_categoria", "caixa_produtos(caixa_id, categoria)"],
        ["idx_caixa_produtos_setor", "caixa_produtos(setor_origem)"],
        ["idx_auditoria_usuario_criado", "auditoria_alteracoes(usuario, criado_em DESC)"],
        ["idx_auditoria_entidade_criado", "auditoria_alteracoes(entidade, criado_em DESC)"]
    ];

    for (const [nome, definicao] of indices) {
        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS ${nome}
                ON ${definicao}
            `);
        } catch (erro) {
            console.warn(
                `Índice V19 não aplicado (${nome}):`,
                erro.message
            );
        }
    }

    await garantirTabelaSessoes();
}


async function sincronizarHistoricoAvaria(id) {

    await garantirTabelaHistorico();


    await pool.query(
        `
        INSERT INTO historico_avarias
        (
            id,
            codigo,
            produto,
            fornecedor,
            codigo_fornecedor,
            quantidade,
            valor_unitario,
            setor,
            tipo,
            caixa,
            status,
            observacao,
            usuario_lancamento,
            criado_em,
            movimentado_em,
            categoria
        )

        SELECT
            a.id,
            a.codigo,
            a.produto,
            a.fornecedor,
            p.codigo_fornecedor,
            a.quantidade,
            a.valor_unitario,
            a.setor,
            a.tipo,
            a.caixa,
            a.status,
            a.observacao,
            a.usuario_lancamento,
            a.criado_em,
            a.movimentado_em,
            COALESCE(a.categoria, p.categoria, 'Mercearia')

        FROM avarias a

        LEFT JOIN produtos p
            ON p.codigo = a.codigo

        WHERE a.id = $1

        ON CONFLICT (id)
        DO UPDATE SET
            codigo = EXCLUDED.codigo,
            produto = EXCLUDED.produto,
            fornecedor = EXCLUDED.fornecedor,
            codigo_fornecedor = COALESCE(
                EXCLUDED.codigo_fornecedor,
                historico_avarias.codigo_fornecedor
            ),
            quantidade = EXCLUDED.quantidade,
            valor_unitario = EXCLUDED.valor_unitario,
            setor = EXCLUDED.setor,
            tipo = EXCLUDED.tipo,
            caixa = EXCLUDED.caixa,
            status = EXCLUDED.status,
            observacao = EXCLUDED.observacao,
            usuario_lancamento = COALESCE(
                NULLIF(EXCLUDED.usuario_lancamento, ''),
                historico_avarias.usuario_lancamento
            ),
            criado_em = EXCLUDED.criado_em,
            movimentado_em = EXCLUDED.movimentado_em
        `,
        [id]
    );


    await pool.query(`
        UPDATE historico_avarias h
        SET categoria = COALESCE(NULLIF(a.categoria, ''), p.categoria, 'Mercearia')
        FROM avarias a
        LEFT JOIN produtos p ON p.codigo = a.codigo
        WHERE h.id = a.id
          AND h.id = $1
    `, [id]);

}


async function sincronizarHistoricoExistente() {

    await garantirTabelaHistorico();


    await pool.query(`
        INSERT INTO historico_avarias
        (
            id,
            codigo,
            produto,
            fornecedor,
            codigo_fornecedor,
            quantidade,
            valor_unitario,
            setor,
            tipo,
            caixa,
            status,
            observacao,
            usuario_lancamento,
            criado_em,
            movimentado_em,
            categoria
        )

        SELECT
            a.id,
            a.codigo,
            a.produto,
            a.fornecedor,
            p.codigo_fornecedor,
            a.quantidade,
            a.valor_unitario,
            a.setor,
            a.tipo,
            a.caixa,
            a.status,
            a.observacao,
            a.usuario_lancamento,
            a.criado_em,
            a.movimentado_em,
            COALESCE(a.categoria, p.categoria, 'Mercearia')

        FROM avarias a

        LEFT JOIN produtos p
            ON p.codigo = a.codigo

        ON CONFLICT (id)
        DO UPDATE SET
            codigo = EXCLUDED.codigo,
            produto = EXCLUDED.produto,
            fornecedor = EXCLUDED.fornecedor,
            codigo_fornecedor = COALESCE(
                EXCLUDED.codigo_fornecedor,
                historico_avarias.codigo_fornecedor
            ),
            quantidade = EXCLUDED.quantidade,
            valor_unitario = EXCLUDED.valor_unitario,
            setor = EXCLUDED.setor,
            tipo = EXCLUDED.tipo,
            caixa = EXCLUDED.caixa,
            status = EXCLUDED.status,
            observacao = EXCLUDED.observacao,
            usuario_lancamento = COALESCE(
                NULLIF(EXCLUDED.usuario_lancamento, ''),
                historico_avarias.usuario_lancamento
            ),
            criado_em = EXCLUDED.criado_em,
            movimentado_em = EXCLUDED.movimentado_em,
            removido = COALESCE(historico_avarias.removido, FALSE),
            categoria = COALESCE(EXCLUDED.categoria, historico_avarias.categoria, 'Mercearia')
    `);


    await pool.query(`
        UPDATE historico_avarias h
        SET categoria = COALESCE(NULLIF(a.categoria, ''), p.categoria, 'Mercearia')
        FROM avarias a
        LEFT JOIN produtos p ON p.codigo = a.codigo
        WHERE h.id = a.id
    `);

}


/* =========================================================
   STATUS DA API
========================================================= */

app.get(
    "/api/status",

    (req, res) => {

        res.json({
            ok: true,
            mensagem:
                "API Controle de Avarias funcionando"
        });

    }
);


/* =========================================================
   RESUMO DA BASE
========================================================= */

app.get(
    "/api/produtos/resumo",
    exigirAdmin,

    async (req, res) => {

        try {

            const resultado =
                await pool.query(`
                    SELECT
                        COUNT(*) AS total,
                        COUNT(*)
                            FILTER (
                                WHERE ativo = TRUE
                            )
                            AS ativos

                    FROM produtos
                `);


            return res.json({

                ok: true,

                total:
                    Number(
                        resultado.rows[0]
                            .total
                    ),

                ativos:
                    Number(
                        resultado.rows[0]
                            .ativos
                    )

            });


        } catch (erro) {

            console.error(
                "Erro no resumo:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao consultar produtos."
                });

        }

    }
);


/* =========================================================
   BUSCAR PRODUTO PELO EAN
========================================================= */

app.get(
    "/api/produtos/:codigo",

    
    exigirUsuario,
    async (req, res) => {

        try {

            const codigo =
                String(
                    req.params.codigo
                ).trim();


            console.log(
                "Consultando EAN:",
                codigo
            );


            const resultado =
                await pool.query(
                    `
                    SELECT
                        codigo,
                        descricao,
                        fornecedor,
                        codigo_fornecedor,
                        estoque,
                        valor_custo,
                        valor_venda,
                        categoria

                    FROM produtos

                    WHERE ativo = TRUE
                    AND (
                        codigo = $1
                        OR (
                            length($1) = 13
                            AND lpad(codigo, 13, '0') = $1
                        )
                    )

                    ORDER BY
                        CASE
                            WHEN codigo = $1 THEN 0
                            ELSE 1
                        END

                    LIMIT 1
                    `,
                    [codigo]
                );


            if (
                resultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Produto não encontrado."
                    });

            }


            const item =
                resultado.rows[0];


            console.log(
                "Produto encontrado:",
                item.descricao
            );


            return res.json({

                codigo:
                    item.codigo,

                produto:
                    item.descricao,

                fornecedor:
                    item.fornecedor || "",

                codigoFornecedor:
                    item.codigo_fornecedor || "",

                valorCusto:
                    Number(
                        item.valor_custo
                    ) || 0,

                valorVenda:
                    Number(
                        item.valor_venda
                    ) || 0,

                categoria:
                    item.categoria || "Mercearia",

                estoque:
                    Number(
                        item.estoque
                    ) || 0

            });


        } catch (erro) {

            console.error(
                "Erro ao buscar produto:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro interno ao consultar produto."
                });

        }

    }
);



/* =========================================================
   V13 - ALTERAR CATEGORIA PERMANENTE DO PRODUTO
========================================================= */

app.put(
    "/api/produtos/:codigo/categoria",
    exigirAdmin,
    async (req, res) => {
        try {
            const codigo = String(req.params.codigo || "").trim();
            const categoria = String(req.body.categoria || "").trim();
            const permitidas = ["Frios", "Mercearia", "Padaria", "Limpeza", "Bebidas"];

            if (!codigo) {
                return res.status(400).json({ erro: "Código do produto não informado." });
            }

            if (!permitidas.includes(categoria)) {
                return res.status(400).json({ erro: "Categoria inválida." });
            }

            const produto = await pool.query(
                `
                SELECT codigo, descricao
                FROM produtos
                WHERE ativo = TRUE
                  AND (
                      codigo = $1
                      OR (length($1) = 13 AND lpad(codigo, 13, '0') = $1)
                  )
                ORDER BY CASE WHEN codigo = $1 THEN 0 ELSE 1 END
                LIMIT 1
                `,
                [codigo]
            );

            if (!produto.rowCount) {
                return res.status(404).json({ erro: "Produto não encontrado." });
            }

            const codigoBanco = produto.rows[0].codigo;
            const categoriaAnterior = await pool.query(`
                SELECT categoria
                FROM produtos
                WHERE codigo = $1
                LIMIT 1
            `, [codigoBanco]);
            const categoriaAntes = categoriaAnterior.rows[0]?.categoria || "Mercearia";

            await pool.query("BEGIN");

            try {
                await pool.query(
                    `UPDATE produtos\n                     SET categoria = $1, atualizado_em = CURRENT_TIMESTAMP\n                     WHERE codigo = $2`,
                    [categoria, codigoBanco]
                );

                await pool.query(
                    `UPDATE avarias SET categoria = $1 WHERE codigo = $2`,
                    [categoria, codigoBanco]
                );

                await pool.query(
                    `UPDATE historico_avarias SET categoria = $1 WHERE codigo = $2`,
                    [categoria, codigoBanco]
                );

                await pool.query("COMMIT");
            } catch (erro) {
                await pool.query("ROLLBACK");
                throw erro;
            }

            await registrarAuditoria({
                acao: "categoria-alterada",
                entidade: "produto",
                registroId: codigoBanco,
                usuario: req.usuarioAdmin.usuario,
                antes: { categoria: categoriaAntes },
                depois: { categoria },
                detalhes: `Categoria do produto ${produto.rows[0].descricao} alterada.`
            });

            emitirEventoSistema("produtos-atualizados", {
                acao: "categoria-alterada", codigo: codigoBanco, categoria
            });
            emitirEventoSistema("avarias-atualizadas", {
                acao: "categoria-alterada", codigo: codigoBanco, categoria
            });
            emitirEventoSistema("historico-atualizado", {
                acao: "categoria-alterada", codigo: codigoBanco, categoria
            });

            return res.json({
                ok: true,
                codigo: codigoBanco,
                produto: produto.rows[0].descricao,
                categoria,
                atualizadoPor: req.usuarioAdmin.usuario
            });

        } catch (erro) {
            console.error("Erro ao alterar categoria:", erro);
            return res.status(500).json({
                erro: "Erro ao alterar a categoria do produto."
            });
        }
    }
);


/* =========================================================
   IMPORTAR / ATUALIZAR PLANILHA
========================================================= */

app.post(
    "/api/produtos/importar",
    exigirAdmin,

    upload.single("arquivo"),

    async (req, res) => {

        let cliente;

        try {

            if (!req.file) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Nenhum arquivo enviado."
                    });

            }

            const nome =
                req.file.originalname.toLowerCase();

            if (
                !nome.endsWith(".xlsx") &&
                !nome.endsWith(".xls")
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Selecione um arquivo Excel."
                    });

            }

            console.log("");
            console.log("Importando:", req.file.originalname);

            const workbook =
                XLSX.read(
                    req.file.buffer,
                    { type: "buffer" }
                );

            const nomeAba =
                workbook.SheetNames[0];

            const planilha =
                workbook.Sheets[nomeAba];

            const linhas =
                XLSX.utils.sheet_to_json(
                    planilha,
                    {
                        defval: "",
                        raw: true
                    }
                );

            if (!linhas.length) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "A planilha está vazia."
                    });

            }

            /* =====================================================
               VALIDAR COLUNA DE CUSTO
            ===================================================== */

            const aliasesCusto = [
                "V. CUSTO",
                "VALOR C",
                "VALOR CUSTO",
                "VALOR DE CUSTO",
                "CUSTO"
            ];

            const primeiraLinha =
                linhas[0] || {};

            const temColunaCusto =
                Object.keys(primeiraLinha).some(
                    chave =>
                        aliasesCusto.includes(
                            normalizarCabecalho(chave)
                        )
                );

            if (!temColunaCusto) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "A planilha não possui uma coluna de valor de custo reconhecida. Use V. CUSTO, VALOR C, VALOR CUSTO ou CUSTO."
                    });

            }

            /* =====================================================
               LER E CONSOLIDAR POR CÓDIGO
            ===================================================== */

            const produtos = new Map();
            const duplicadosMap = new Map();
            let invalidos = 0;

            linhas.forEach((linha, indice) => {

                const numeroLinha = indice + 2;

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
                            [
                                "DESCRIÇÃO",
                                "DESCRICAO",
                                "PRODUTO"
                            ],
                            3
                        ) || ""
                    ).trim();

                if (!codigo || !descricao) {
                    invalidos++;
                    return;
                }

                const item = {

                    codigo,

                    descricao,

                    fornecedor:
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
                        ).trim(),

                    codigoFornecedor:
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
                        ),

                    estoque:
                        numero(
                            valorColunaFlex(
                                linha,
                                [
                                    "ESTOQUE",
                                    "QTD ESTOQUE",
                                    "QUANTIDADE ESTOQUE"
                                ],
                                4
                            )
                        ),

                    valorCusto:
                        numero(
                            valorColunaFlex(
                                linha,
                                aliasesCusto,
                                5
                            )
                        ),

                    valorVenda:
                        numero(
                            valorColunaFlex(
                                linha,
                                [
                                    "VALOR. VEND",
                                    "VALOR V",
                                    "VALOR VENDA",
                                    "PREÇO VENDA",
                                    "PRECO VENDA"
                                ],
                                6
                            )
                        ),

                    categoria:
                        String(
                            valorColunaFlex(
                                linha,
                                [
                                    "CATEGORIA",
                                    "DEPARTAMENTO",
                                    "GRUPO",
                                    "SECAO",
                                    "SEÇÃO"
                                ]
                            ) || ""
                        ).trim() ||
                        classificarCategoriaProduto(descricao),

                    linhaPlanilha: numeroLinha

                };

                if (produtos.has(codigo)) {

                    const anterior =
                        produtos.get(codigo);

                    let relatorio =
                        duplicadosMap.get(codigo);

                    if (!relatorio) {

                        relatorio = {
                            codigo,
                            ocorrencias: [anterior]
                        };

                        duplicadosMap.set(
                            codigo,
                            relatorio
                        );

                    }

                    relatorio.ocorrencias.push(item);

                    const escolhido =
                        escolherProdutoImportacao(
                            anterior,
                            item
                        );

                    produtos.set(
                        codigo,
                        escolhido
                    );

                } else {

                    produtos.set(
                        codigo,
                        item
                    );

                }

            });

            const lista =
                Array.from(
                    produtos.values()
                );

            const duplicadosDetalhes =
                Array.from(
                    duplicadosMap.values()
                )
                .map(relatorio => {

                    const escolhido =
                        produtos.get(
                            relatorio.codigo
                        );

                    return {
                        codigo:
                            relatorio.codigo,
                        ocorrencias:
                            relatorio.ocorrencias.length,
                        linhas:
                            relatorio.ocorrencias.map(
                                item => item.linhaPlanilha
                            ),
                        escolhidoLinha:
                            escolhido.linhaPlanilha,
                        custoEscolhido:
                            Number(
                                escolhido.valorCusto
                            ) || 0,
                        vendaEscolhida:
                            Number(
                                escolhido.valorVenda
                            ) || 0,
                        estoqueEscolhido:
                            Number(
                                escolhido.estoque
                            ) || 0,
                        fornecedorEscolhido:
                            escolhido.fornecedor || "",
                        codigoFornecedorEscolhido:
                            escolhido.codigoFornecedor || "",
                        motivo:
                            motivoEscolhaProdutoImportacao(
                                escolhido
                            )
                    };

                })
                .sort(
                    (a, b) =>
                        String(a.codigo)
                            .localeCompare(
                                String(b.codigo),
                                undefined,
                                { numeric: true }
                            )
                );

            const duplicados =
                duplicadosDetalhes.length;

            const linhasDuplicadas =
                duplicadosDetalhes.reduce(
                    (total, item) =>
                        total +
                        Math.max(
                            0,
                            item.ocorrencias - 1
                        ),
                    0
                );

            const produtosComFornecedor =
                lista.filter(
                    item =>
                        String(
                            item.fornecedor || ""
                        ).trim() !== ""
                ).length;

            const produtosComCodigoFornecedor =
                lista.filter(
                    item =>
                        String(
                            item.codigoFornecedor || ""
                        ).trim() !== ""
                ).length;

            console.log(
                `Produtos únicos após consolidação: ${lista.length}`
            );

            console.log(
                `Códigos duplicados encontrados: ${duplicados}`
            );

            console.log(
                `Linhas duplicadas descartadas: ${linhasDuplicadas}`
            );

            console.log(
                `Dados de fornecedor lidos: ${produtosComFornecedor}/${lista.length}`
            );

            console.log(
                `Códigos de fornecedor lidos: ${produtosComCodigoFornecedor}/${lista.length}`
            );

            cliente =
                await pool.connect();

            await cliente.query("BEGIN");

            let novos = 0;
            let atualizados = 0;

            const TAMANHO_LOTE = 500;

            for (
                let inicio = 0;
                inicio < lista.length;
                inicio += TAMANHO_LOTE
            ) {

                const lote =
                    lista.slice(
                        inicio,
                        inicio + TAMANHO_LOTE
                    );

                const codigos =
                    lote.map(
                        item => item.codigo
                    );

                const existentes =
                    await cliente.query(
                        `
                        SELECT codigo
                        FROM produtos
                        WHERE codigo = ANY($1::text[])
                        `,
                        [codigos]
                    );

                const existentesSet =
                    new Set(
                        existentes.rows.map(
                            item => item.codigo
                        )
                    );

                for (const item of lote) {

                    if (
                        existentesSet.has(item.codigo)
                    ) {
                        atualizados++;
                    } else {
                        novos++;
                    }

                }

                const valores = [];
                const parametros = [];

                lote.forEach(
                    (item, indice) => {

                        const base =
                            indice * 8;

                        parametros.push(
                            `(
                                $${base + 1},
                                $${base + 2},
                                $${base + 3},
                                $${base + 4},
                                $${base + 5},
                                $${base + 6},
                                $${base + 7},
                                $${base + 8},
                                TRUE,
                                CURRENT_TIMESTAMP
                            )`
                        );

                        valores.push(
                            item.codigo,
                            item.descricao,
                            item.fornecedor,
                            item.codigoFornecedor,
                            item.estoque,
                            item.valorCusto,
                            item.valorVenda,
                            item.categoria
                        );

                    }
                );

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
                        categoria,
                        ativo,
                        atualizado_em
                    )

                    VALUES
                    ${parametros.join(",")}

                    ON CONFLICT (codigo)
                    DO UPDATE SET
                        descricao = EXCLUDED.descricao,
                        fornecedor = COALESCE(
                            NULLIF(EXCLUDED.fornecedor, ''),
                            produtos.fornecedor
                        ),
                        codigo_fornecedor = COALESCE(
                            NULLIF(EXCLUDED.codigo_fornecedor, ''),
                            produtos.codigo_fornecedor
                        ),
                        estoque = EXCLUDED.estoque,
                        valor_custo = EXCLUDED.valor_custo,
                        valor_venda = EXCLUDED.valor_venda,
                        categoria = COALESCE(NULLIF(produtos.categoria, ''), EXCLUDED.categoria),
                        ativo = TRUE,
                        atualizado_em = CURRENT_TIMESTAMP
                    `,
                    valores
                );

                console.log(
                    `${Math.min(
                        inicio + TAMANHO_LOTE,
                        lista.length
                    )} / ${lista.length}`
                );

            }

            await cliente.query("COMMIT");

            await registrarAuditoria({
                acao: "importacao",
                entidade: "produtos",
                registroId: "",
                usuario: req.usuarioAdmin.usuario,
                antes: null,
                depois: {
                    planilha: linhas.length,
                    produtosUnicos: lista.length,
                    novos,
                    atualizados,
                    duplicados,
                    linhasDuplicadas
                },
                detalhes: `Importação/atualização da base de produtos: ${lista.length} produtos únicos.`
            });

            const totalBanco =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM produtos
                `);

            emitirEventoSistema(
                "produtos-atualizados",
                {
                    totalBanco:
                        Number(
                            totalBanco.rows[0].total
                        ),
                    duplicados,
                    linhasDuplicadas
                }
            );

            return res.json({

                ok: true,

                planilha:
                    linhas.length,

                produtosUnicos:
                    lista.length,

                novos,

                atualizados,

                ignorados:
                    invalidos,

                totalBanco:
                    Number(
                        totalBanco.rows[0].total
                    ),

                duplicados,

                linhasDuplicadas,

                duplicadosDetalhes:
                    duplicadosDetalhes.slice(0, 100),

                duplicadosDetalhesTotal:
                    duplicadosDetalhes.length

            });

        } catch (erro) {

            if (cliente) {

                try {
                    await cliente.query("ROLLBACK");
                } catch {}

            }

            console.error(
                "Erro na importação:",
                erro
            );

            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao importar a planilha."
                });

        } finally {

            if (cliente) {
                cliente.release();
            }

        }

    }
);

/* =========================================================
   CAIXAS - LISTAR COM RESUMO AUTOMÁTICO
========================================================= */

app.get(
    "/api/caixas",

    
    exigirUsuario,
    async (req, res) => {

        try {

            const resultado =
                await pool.query(`
                    SELECT
                        c.id,
                        c.numero,
                        c.local,
                        c.responsavel,
                        c.criado_em,

                        COUNT(a.id)
                            AS total_registros,

                        COALESCE(
                            SUM(a.quantidade),
                            0
                        )
                            AS quantidade_total,

                        COALESCE(
                            SUM(
                                a.quantidade *
                                a.valor_unitario
                            ),
                            0
                        )
                            AS valor_acumulado,

                        COUNT(a.id)
                        FILTER (
                            WHERE a.status = 'Pendente'
                        )
                            AS avarias_pendentes,

                        MAX(a.criado_em)
                            AS ultimo_lancamento,

                        (
                            SELECT COUNT(*)
                            FROM caixa_produtos cp
                            WHERE cp.caixa_id = c.id
                        ) AS total_itens,

                        (
                            SELECT COALESCE(SUM(cp.quantidade), 0)
                            FROM caixa_produtos cp
                            WHERE cp.caixa_id = c.id
                        ) AS quantidade_itens,

                        (
                            SELECT COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0)
                            FROM caixa_produtos cp
                            WHERE cp.caixa_id = c.id
                        ) AS valor_itens

                    FROM caixas c

                    LEFT JOIN avarias a
                        ON a.caixa = c.numero

                    GROUP BY
                        c.id,
                        c.numero,
                        c.local,
                        c.responsavel,
                        c.criado_em

                    ORDER BY
                        c.criado_em DESC
                `);


            const caixas =
                resultado.rows.map(
                    item => ({

                        id:
                            item.id,

                        numero:
                            item.numero,

                        local:
                            item.local || "",

                        responsavel:
                            item.responsavel || "",

                        criadoEm:
                            item.criado_em,

                        totalRegistros:
                            Number(
                                item.total_registros
                            ) || 0,

                        quantidadeTotal:
                            Number(
                                item.quantidade_total
                            ) || 0,

                        valorAcumulado:
                            Number(
                                item.valor_acumulado
                            ) || 0,

                        avariasPendentes:
                            Number(
                                item.avarias_pendentes
                            ) || 0,

                        ultimoLancamento:
                            item.ultimo_lancamento,

                        totalItens:
                            Number(
                                item.total_itens
                            ) || 0,

                        quantidadeItens:
                            Number(
                                item.quantidade_itens
                            ) || 0,

                        valorItens:
                            Number(
                                item.valor_itens
                            ) || 0

                    })
                );


            return res.json(
                caixas
            );


        } catch (erro) {

            console.error(
                "Erro ao listar caixas:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao listar caixas."
                });

        }

    }
);


/* =========================================================
   CAIXAS - PRODUTOS CADASTRADOS
========================================================= */

app.get(
    "/api/caixas/:id/produtos",

    
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaCaixaProdutos();

            const id = String(req.params.id || "").trim();

            const caixaResultado = await pool.query(
                `
                SELECT id, numero, local, responsavel, criado_em
                FROM caixas
                WHERE id = $1
                LIMIT 1
                `,
                [id]
            );

            if (!caixaResultado.rowCount) {
                return res.status(404).json({ erro: "Caixa não encontrada." });
            }

            const resultado = await pool.query(
                `
                SELECT
                    cp.id,
                    cp.caixa_id,
                    cp.codigo,
                    cp.produto,
                    COALESCE(NULLIF(TRIM(cp.categoria), ''), p.categoria, 'Mercearia') AS categoria,
                    cp.motivo,
                    cp.setor_origem,
                    cp.quantidade,
                    cp.valor_unitario,
                    cp.criado_em,
                    cp.atualizado_em
                FROM caixa_produtos cp
                LEFT JOIN produtos p
                    ON p.codigo = cp.codigo
                WHERE cp.caixa_id = $1
                ORDER BY cp.produto ASC, cp.codigo ASC
                `,
                [id]
            );

            return res.json({
                caixa: {
                    id: caixaResultado.rows[0].id,
                    numero: caixaResultado.rows[0].numero,
                    local: caixaResultado.rows[0].local || "",
                    responsavel: caixaResultado.rows[0].responsavel || ""
                },
                itens: resultado.rows.map(item => ({
                    id: item.id,
                    codigo: item.codigo,
                    produto: item.produto,
                    categoria: item.categoria || "Mercearia",
                    motivo: item.motivo || "",
                    setorOrigem: item.setor_origem || "",
                    quantidade: Number(item.quantidade) || 0,
                    valorUnitario: Number(item.valor_unitario) || 0,
                    criadoEm: item.criado_em,
                    atualizadoEm: item.atualizado_em
                }))
            });
        } catch (erro) {
            console.error("Erro ao listar produtos da caixa:", erro);
            return res.status(500).json({ erro: "Erro ao carregar os produtos da caixa." });
        }
    }
);


app.post(
    "/api/caixas/:id/produtos",
    exigirUsuario,

    async (req, res) => {
        try {
            await garantirTabelaCaixaProdutos();

            const caixaId = String(req.params.id || "").trim();
            const codigoInformado = String(req.body.codigo || "").trim();
            const quantidade = Number(req.body.quantidade);
            const motivo = String(req.body.motivo || "").trim();
            const categoria = String(req.body.categoria || "").trim();
            const setorOrigem = String(req.body.setorOrigem || "Loja").trim() || "Loja";

            const motivosPermitidos = [
                "Produto avariado",
                "Degustação de cliente",
                "Fermentado",
                "Vencido",
                "Próximo do vencimento",
                "Embalagem danificada",
                "Quebra",
                "Outro"
            ];

            const categoriasPermitidas = [
                "Frios",
                "Mercearia",
                "Padaria",
                "Limpeza",
                "Bebidas"
            ];

            const setoresPermitidos = [
                "CD",
                "Online",
                "Estoque",
                "Loja",
                "Câmara"
            ];

            if (!caixaId || !codigoInformado) {
                return res.status(400).json({ erro: "Informe o produto." });
            }

            if (!Number.isFinite(quantidade) || quantidade <= 0) {
                return res.status(400).json({ erro: "Informe uma quantidade maior que zero." });
            }

            if (!motivosPermitidos.includes(motivo)) {
                return res.status(400).json({ erro: "Selecione um motivo válido." });
            }

            if (!categoriasPermitidas.includes(categoria)) {
                return res.status(400).json({ erro: "Selecione uma categoria válida." });
            }

            if (!setoresPermitidos.includes(setorOrigem)) {
                return res.status(400).json({ erro: "Selecione o setor de origem." });
            }

            const caixaResultado = await pool.query(
                `SELECT id, numero, responsavel FROM caixas WHERE id = $1 LIMIT 1`,
                [caixaId]
            );

            if (!caixaResultado.rowCount) {
                return res.status(404).json({ erro: "Caixa não encontrada." });
            }

            const produtoResultado = await pool.query(
                `
                SELECT codigo, descricao, fornecedor, codigo_fornecedor, estoque, valor_custo, categoria
                FROM produtos
                WHERE ativo = TRUE
                  AND (
                      codigo = $1
                      OR (length($1) = 13 AND lpad(codigo, 13, '0') = $1)
                  )
                ORDER BY CASE WHEN codigo = $1 THEN 0 ELSE 1 END
                LIMIT 1
                `,
                [codigoInformado]
            );

            if (!produtoResultado.rowCount) {
                return res.status(404).json({ erro: "Produto não encontrado." });
            }

            const produto = produtoResultado.rows[0];
            const codigoBanco = produto.codigo;

            const normalizarFornecedor = valor => String(valor || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase();

            const fornecedorCaixa = String(caixaResultado.rows[0].responsavel || "").trim();
            const fornecedorProduto = String(produto.fornecedor || "").trim();

            if (!fornecedorCaixa) {
                return res.status(400).json({
                    erro: "Esta caixa não possui fornecedor definido. Cadastre o fornecedor da caixa antes de adicionar produtos."
                });
            }

            if (!fornecedorProduto || normalizarFornecedor(fornecedorCaixa) !== normalizarFornecedor(fornecedorProduto)) {
                return res.status(400).json({
                    erro: `Produto vinculado ao fornecedor "${fornecedorProduto || "não informado"}". A caixa selecionada pertence ao fornecedor "${fornecedorCaixa}".`
                });
            }

            const id = crypto.randomUUID();

            const resultado = await pool.query(
                `
                INSERT INTO caixa_produtos
                (
                    id,
                    caixa_id,
                    codigo,
                    produto,
                    quantidade,
                    valor_unitario,
                    categoria,
                    motivo,
                    setor_origem,
                    criado_em,
                    atualizado_em
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (caixa_id, codigo)
                DO UPDATE SET
                    quantidade = caixa_produtos.quantidade + EXCLUDED.quantidade,
                    produto = EXCLUDED.produto,
                    valor_unitario = EXCLUDED.valor_unitario,
                    categoria = EXCLUDED.categoria,
                    motivo = EXCLUDED.motivo,
                    setor_origem = EXCLUDED.setor_origem,
                    atualizado_em = CURRENT_TIMESTAMP
                RETURNING id, caixa_id, codigo, produto, quantidade, valor_unitario, categoria, motivo, setor_origem, criado_em, atualizado_em
                `,
                [
                    id,
                    caixaId,
                    codigoBanco,
                    produto.descricao,
                    quantidade,
                    Number(produto.valor_custo) || 0,
                    categoria,
                    motivo,
                    setorOrigem
                ]
            );

            const item = resultado.rows[0];

            await registrarAuditoria({
                acao: "caixa-produto-adicionado",
                entidade: "caixa_produto",
                registroId: item.id,
                usuario: req.usuarioAtual.usuario,
                depois: {
                    caixaId,
                    caixa: caixaResultado.rows[0].numero,
                    codigo: item.codigo,
                    produto: item.produto,
                    quantidadeAdicionada: quantidade,
                    quantidadeTotal: Number(item.quantidade) || 0,
                    motivo: item.motivo || motivo,
                    categoria: item.categoria || categoria,
                    setorOrigem: item.setor_origem || setorOrigem
                },
                detalhes: `Produto ${item.produto} adicionado à caixa ${caixaResultado.rows[0].numero}. Motivo: ${motivo}; Categoria: ${categoria}; Setor de origem: ${setorOrigem}.`
            });

            emitirEventoSistema("caixas-atualizadas", {
                acao: "produto-adicionado",
                caixaId,
                produtoId: item.id
            });

            return res.status(201).json({
                ok: true,
                item: {
                    id: item.id,
                    codigo: item.codigo,
                    produto: item.produto,
                    quantidade: Number(item.quantidade) || 0,
                    valorUnitario: Number(item.valor_unitario) || 0,
                    categoria: item.categoria || categoria,
                    motivo: item.motivo || motivo,
                    setorOrigem: item.setor_origem || setorOrigem,
                    criadoEm: item.criado_em,
                    atualizadoEm: item.atualizado_em
                }
            });
        } catch (erro) {
            console.error("Erro ao adicionar produto à caixa:", erro);
            return res.status(500).json({ erro: "Erro ao adicionar produto à caixa." });
        }
    }
);



app.post(
    "/api/caixas/:id/produtos/excluir",
    exigirUsuario,
    async (req, res) => {
        let cliente;
        try {
            await garantirTabelaCaixaProdutos();
            const caixaId = String(req.params.id || "").trim();
            const ids = Array.isArray(req.body?.ids)
                ? [...new Set(req.body.ids.map(id => String(id || "").trim()).filter(Boolean))]
                : [];

            if (!caixaId) return res.status(400).json({ erro: "Caixa não informada." });
            if (!ids.length) return res.status(400).json({ erro: "Selecione pelo menos um produto." });

            const caixaResultado = await pool.query(
                `SELECT id, numero FROM caixas WHERE id = $1 LIMIT 1`,
                [caixaId]
            );
            if (!caixaResultado.rowCount) return res.status(404).json({ erro: "Caixa não encontrada." });

            cliente = await pool.connect();
            await cliente.query("BEGIN");
            const resultado = await cliente.query(
                `
                DELETE FROM caixa_produtos
                WHERE caixa_id = $1
                  AND id = ANY($2::text[])
                RETURNING id, caixa_id, codigo, produto, quantidade, valor_unitario
                `,
                [caixaId, ids]
            );

            if (!resultado.rowCount) {
                await cliente.query("ROLLBACK");
                return res.status(404).json({ erro: "Nenhum produto selecionado foi encontrado nesta caixa." });
            }
            await cliente.query("COMMIT");

            const numeroCaixa = caixaResultado.rows[0].numero;
            for (const item of resultado.rows) {
                await registrarAuditoria({
                    acao: "caixa-produto-removido",
                    entidade: "caixa_produto",
                    registroId: item.id,
                    usuario: req.usuarioAtual.usuario,
                    antes: {
                        caixaId,
                        caixa: numeroCaixa,
                        codigo: item.codigo,
                        produto: item.produto,
                        quantidade: Number(item.quantidade) || 0
                    },
                    detalhes: `Produto ${item.produto} removido da caixa ${numeroCaixa} por exclusão em lote.`
                });
            }

            emitirEventoSistema("caixas-atualizadas", {
                acao: "produtos-removidos",
                caixaId,
                quantidade: resultado.rowCount
            });

            return res.json({ ok: true, removidos: resultado.rowCount });
        } catch (erro) {
            if (cliente) {
                try { await cliente.query("ROLLBACK"); } catch (_) {}
            }
            console.error("Erro ao excluir produtos marcados da caixa:", erro);
            return res.status(500).json({ erro: "Erro ao excluir os produtos marcados." });
        } finally {
            if (cliente) cliente.release();
        }
    }
);

app.post(
    "/api/caixas/:id/produtos/:itemId/remover",
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaCaixaProdutos();
            const caixaId = String(req.params.id || "").trim();
            const itemId = String(req.params.itemId || "").trim();
            const resultado = await pool.query(
                `
                DELETE FROM caixa_produtos
                WHERE id = $1 AND caixa_id = $2
                RETURNING id, caixa_id, codigo, produto, quantidade, valor_unitario
                `,
                [itemId, caixaId]
            );
            if (!resultado.rowCount) return res.status(404).json({ erro: "Produto não encontrado nesta caixa." });

            const item = resultado.rows[0];
            const caixaResultado = await pool.query(`SELECT numero FROM caixas WHERE id = $1 LIMIT 1`, [caixaId]);
            const numeroCaixa = caixaResultado.rows[0]?.numero || caixaId;

            await registrarAuditoria({
                acao: "caixa-produto-removido",
                entidade: "caixa_produto",
                registroId: item.id,
                usuario: req.usuarioAtual.usuario,
                antes: {
                    caixaId,
                    caixa: numeroCaixa,
                    codigo: item.codigo,
                    produto: item.produto,
                    quantidade: Number(item.quantidade) || 0
                },
                detalhes: `Produto ${item.produto} removido da caixa ${numeroCaixa}.`
            });

            emitirEventoSistema("caixas-atualizadas", {
                acao: "produto-removido",
                caixaId,
                produtoId: item.id
            });

            return res.json({ ok: true, removido: item.id });
        } catch (erro) {
            console.error("Erro ao remover produto da caixa:", erro);
            return res.status(500).json({ erro: "Erro ao remover produto da caixa." });
        }
    }
);

app.delete(
    "/api/caixas/:id/produtos",
    exigirUsuario,

    async (req, res) => {
        let cliente;
        try {
            await garantirTabelaCaixaProdutos();

            const caixaId = String(req.params.id || "").trim();
            const ids = Array.isArray(req.body?.ids)
                ? [...new Set(req.body.ids.map(id => String(id || "").trim()).filter(Boolean))]
                : [];

            if (!caixaId) {
                return res.status(400).json({ erro: "Caixa não informada." });
            }

            if (!ids.length) {
                return res.status(400).json({ erro: "Selecione pelo menos um produto." });
            }

            const caixaResultado = await pool.query(
                `SELECT id, numero FROM caixas WHERE id = $1 LIMIT 1`,
                [caixaId]
            );

            if (!caixaResultado.rowCount) {
                return res.status(404).json({ erro: "Caixa não encontrada." });
            }

            cliente = await pool.connect();
            await cliente.query("BEGIN");

            const resultado = await cliente.query(
                `
                DELETE FROM caixa_produtos
                WHERE caixa_id = $1
                  AND id = ANY($2::text[])
                RETURNING id, caixa_id, codigo, produto, quantidade, valor_unitario
                `,
                [caixaId, ids]
            );

            if (!resultado.rowCount) {
                await cliente.query("ROLLBACK");
                return res.status(404).json({ erro: "Nenhum produto selecionado foi encontrado nesta caixa." });
            }

            await cliente.query("COMMIT");

            const numeroCaixa = caixaResultado.rows[0].numero;
            for (const item of resultado.rows) {
                await registrarAuditoria({
                    acao: "caixa-produto-removido",
                    entidade: "caixa_produto",
                    registroId: item.id,
                    usuario: req.usuarioAtual.usuario,
                    antes: {
                        caixaId,
                        caixa: numeroCaixa,
                        codigo: item.codigo,
                        produto: item.produto,
                        quantidade: Number(item.quantidade) || 0
                    },
                    detalhes: `Produto ${item.produto} removido da caixa ${numeroCaixa} por exclusão em lote.`
                });
            }

            emitirEventoSistema("caixas-atualizadas", {
                acao: "produtos-removidos",
                caixaId,
                quantidade: resultado.rowCount
            });

            return res.json({
                ok: true,
                removidos: resultado.rowCount
            });
        } catch (erro) {
            if (cliente) {
                try { await cliente.query("ROLLBACK"); } catch (_) {}
            }
            console.error("Erro ao excluir produtos marcados da caixa:", erro);
            return res.status(500).json({ erro: "Erro ao excluir os produtos marcados." });
        } finally {
            if (cliente) cliente.release();
        }
    }
);

app.delete(
    "/api/caixas/:id/produtos/:itemId",
    exigirUsuario,

    async (req, res) => {
        try {
            await garantirTabelaCaixaProdutos();

            const caixaId = String(req.params.id || "").trim();
            const itemId = String(req.params.itemId || "").trim();

            const resultado = await pool.query(
                `
                DELETE FROM caixa_produtos
                WHERE id = $1
                  AND caixa_id = $2
                RETURNING id, caixa_id, codigo, produto, quantidade
                `,
                [itemId, caixaId]
            );

            if (!resultado.rowCount) {
                return res.status(404).json({ erro: "Produto não encontrado nesta caixa." });
            }

            const item = resultado.rows[0];

            const caixaResultado = await pool.query(
                `SELECT numero FROM caixas WHERE id = $1 LIMIT 1`,
                [caixaId]
            );

            const numeroCaixa = caixaResultado.rows[0]?.numero || caixaId;

            await registrarAuditoria({
                acao: "caixa-produto-removido",
                entidade: "caixa_produto",
                registroId: item.id,
                usuario: req.usuarioAtual.usuario,
                antes: {
                    caixaId,
                    caixa: numeroCaixa,
                    codigo: item.codigo,
                    produto: item.produto,
                    quantidade: Number(item.quantidade) || 0
                },
                detalhes: `Produto ${item.produto} removido da caixa ${numeroCaixa}.`
            });

            emitirEventoSistema("caixas-atualizadas", {
                acao: "produto-removido",
                caixaId,
                produtoId: item.id
            });

            return res.json({ ok: true });
        } catch (erro) {
            console.error("Erro ao remover produto da caixa:", erro);
            return res.status(500).json({ erro: "Erro ao remover produto da caixa." });
        }
    }
);


/* =========================================================
   CAIXAS - CONTEÚDO
========================================================= */

app.get(
    "/api/caixas/:id/conteudo",

    
    exigirUsuario,
    async (req, res) => {

        try {
            await garantirTabelaCaixaProdutos();

            const id = String(req.params.id || "").trim();

            const caixaResultado = await pool.query(
                `
                SELECT
                    id,
                    numero,
                    local,
                    responsavel,
                    criado_em
                FROM caixas
                WHERE id = $1
                LIMIT 1
                `,
                [id]
            );

            if (!caixaResultado.rowCount) {
                return res.status(404).json({
                    erro: "Caixa não encontrada."
                });
            }

            const caixa = caixaResultado.rows[0];

            const produtosResultado = await pool.query(
                `
                SELECT
                    cp.id,
                    cp.codigo,
                    cp.produto,
                    COALESCE(NULLIF(TRIM(cp.categoria), ''), NULLIF(TRIM(p.categoria), ''), 'Mercearia') AS categoria,
                    COALESCE(NULLIF(TRIM(p.fornecedor), ''), caixa_fornecedor.responsavel, '') AS fornecedor,
                    cp.quantidade,
                    cp.valor_unitario,
                    cp.motivo,
                    cp.setor_origem,
                    cp.criado_em,
                    cp.atualizado_em
                FROM caixa_produtos cp
                LEFT JOIN produtos p
                    ON p.codigo = cp.codigo
                LEFT JOIN caixas caixa_fornecedor
                    ON caixa_fornecedor.id = cp.caixa_id
                WHERE cp.caixa_id = $1
                ORDER BY cp.criado_em DESC, cp.produto ASC
                `,
                [id]
            );

            const pendenciasResultado = await pool.query(
                `
                SELECT
                    COUNT(*) FILTER (WHERE status = 'Pendente') AS pendentes,
                    MAX(criado_em) AS ultimo_lancamento_avaria
                FROM avarias
                WHERE caixa = $1
                `,
                [caixa.numero]
            );

            const registros = produtosResultado.rows.map(item => ({
                id: item.id,
                codigo: item.codigo || "",
                produto: item.produto || "",
                fornecedor: item.fornecedor || caixa.responsavel || "",
                quantidade: Number(item.quantidade) || 0,
                valorUnitario: Number(item.valor_unitario) || 0,
                valorTotal: (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0),
                motivo: item.motivo || "",
                tipo: item.motivo || "Armazenado",
                setor: item.setor_origem || "",
                setorOrigem: item.setor_origem || "",
                categoria: item.categoria || "Mercearia",
                status: "Armazenado",
                criadoEm: item.criado_em,
                atualizadoEm: item.atualizado_em
            }));

            const quantidadeTotal = registros.reduce(
                (total, item) => total + Number(item.quantidade || 0),
                0
            );

            const valorAcumulado = registros.reduce(
                (total, item) => total + Number(item.valorTotal || 0),
                0
            );

            const ultimoLancamento = registros.length
                ? registros.reduce((maisRecente, item) => {
                    if (!maisRecente) return item.criadoEm;
                    return new Date(item.criadoEm) > new Date(maisRecente)
                        ? item.criadoEm
                        : maisRecente;
                }, null)
                : null;

            return res.json({
                caixa: {
                    id: caixa.id,
                    numero: caixa.numero,
                    local: caixa.local || "",
                    responsavel: caixa.responsavel || "",
                    criadoEm: caixa.criado_em
                },
                resumo: {
                    totalRegistros: registros.length,
                    quantidadeTotal,
                    valorAcumulado,
                    avariasPendentes: Number(pendenciasResultado.rows[0]?.pendentes) || 0,
                    ultimoLancamento: ultimoLancamento || pendenciasResultado.rows[0]?.ultimo_lancamento_avaria || null
                },
                registros
            });

        } catch (erro) {
            console.error("Erro ao carregar conteúdo da caixa:", erro);
            return res.status(500).json({
                erro: "Erro ao carregar conteúdo da caixa."
            });
        }
    }
);


/* =========================================================
   V20.6 - DASHBOARD / ANALISTA IA ANALÍTICO
   Camada somente leitura. Não altera avarias, caixas, produtos,
   usuários ou qualquer dado do banco.
========================================================= */
app.post(
    "/api/dashboard/ia",
    exigirUsuario,
    async (req, res) => {
        try {
            const pergunta = String(req.body?.pergunta || "Faça uma análise completa dos dados atuais.").trim().slice(0, 500);
            const tipoAnalise = ["livre", "resumo", "concentracao", "atencao", "tendencia", "recomendacoes", "completa"].includes(req.body?.tipoAnalise)
                ? req.body.tipoAnalise
                : "livre";
            const escopo = req.body?.escopo === "caixas" ? "caixas" : "avarias";
            const contexto = req.body?.contexto && typeof req.body.contexto === "object" ? req.body.contexto : {};
            const contextoSeguro = JSON.stringify(contexto).slice(0, 50000);

            const instrucoesTipo = {
                resumo: "Entregue um retrato rápido: situação atual, 3 principais números e conclusão.",
                concentracao: "Mostre onde o impacto está concentrado. Priorize percentuais e rankings. Explique a concentração com base nos números fornecidos.",
                atencao: "Procure pontos críticos, anomalias, concentrações excessivas e situações que merecem investigação. Não invente causas.",
                tendencia: "Compare o período atual com o anterior quando houver dados de comparação. Mostre direção e percentuais. Se não houver comparação confiável, diga isso claramente.",
                recomendacoes: "Transforme os achados em prioridades práticas e reversíveis. Primeiro diga o fato que sustenta cada recomendação.",
                completa: "Faça um diagnóstico completo e objetivo: situação, concentração, tendência, pontos de atenção e prioridades.",
                livre: "Responda diretamente à pergunta do usuário usando somente o contexto fornecido."
            };
            const sistema = `Você é o Analista IA do sistema Controle de Avarias.\n\nRegras obrigatórias:\n- Responda em português do Brasil.\n- Use exclusivamente os dados fornecidos no contexto.\n- Nunca invente números, fornecedores, produtos, causas, datas ou comparações.\n- Se um dado não existir, diga "não disponível no recorte atual".\n- O contexto já contém cálculos; não substitua um cálculo fornecido por estimativa própria.\n- Diferencie fato de interpretação.\n- Sempre respeite os filtros atuais.\n- O módulo é somente leitura: não altere dados e não diga que executou alguma ação.\n- Para recomendações, use prioridades práticas e reversíveis.\n- Seja objetivo, gerencial e claro.\n- Use título curto e no máximo 6 tópicos, salvo quando uma tabela curta for necessária.\n- Tipo de análise solicitado: ${tipoAnalise}.\n- Orientação específica: ${instrucoesTipo[tipoAnalise] || instrucoesTipo.livre}.\n- Escopo: ${escopo}.`;

            if (process.env.OPENAI_API_KEY) {
                const resposta = await fetch("https://api.openai.com/v1/responses", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
                        input: [
                            { role: "system", content: [{ type: "input_text", text: sistema }] },
                            { role: "user", content: [{ type: "input_text", text: `Pergunta: ${pergunta}\n\nContexto estruturado do Dashboard (somente leitura):\n${contextoSeguro}` }] }
                        ],
                        max_output_tokens: 900
                    })
                });
                const dados = await resposta.json();
                if (!resposta.ok) {
                    console.error("Erro na IA externa:", dados);
                    return res.status(502).json({ erro: "A IA externa não respondeu. Verifique a configuração da API." });
                }
                let texto = String(dados.output_text || "").trim();
                if (!texto && Array.isArray(dados.output)) {
                    texto = dados.output.flatMap(item => Array.isArray(item.content) ? item.content : [])
                        .map(item => item.text || "").filter(Boolean).join("\n").trim();
                }
                if (!texto) return res.status(502).json({ erro: "A IA não retornou uma análise." });
                return res.json({ ok: true, modo: "ia", tipoAnalise, resposta: texto });
            }

            // Fallback local: usa somente os cálculos enviados pelo Dashboard.
            const dinheiro = valor => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const numero = valor => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
            const percentual = valor => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
            const textoPergunta = pergunta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const tem = (...termos) => termos.some(t => textoPergunta.includes(t));
            const top = (lista, n = 5) => Array.isArray(lista) ? lista.slice(0, n) : [];
            const total = contexto.total || {};
            const conc = contexto.concentracao || {};
            const tend = contexto.tendencia || {};
            const fornecedores = top(contexto.fornecedores);
            const categorias = top(contexto.categorias);
            const produtos = top(contexto.produtos);
            const caixas = top(contexto.caixas);
            const escopoCaixas = escopo === "caixas";
            const linhas = (lista, campo, limite = 5) => top(lista, limite).map((x, i) => `${i + 1}. **${x[campo] || "Não informado"}** — ${dinheiro(x.valor)}${x.quantidade != null ? ` (${numero(x.quantidade)} un./kg)` : ""}.`).join("\n");
            let resposta = "";

            if (tipoAnalise === "resumo") {
                resposta = escopoCaixas
                    ? `### Resumo do estoque\n\n- **Valor armazenado:** ${dinheiro(total.valor)}.\n- **Quantidade:** ${numero(total.quantidade)} unidades/kg.\n- **Produtos distintos:** ${numero(total.produtosDistintos)}.\n- **Caixas com produtos:** ${numero(total.caixasComProdutos)}.\n- **Principal concentração:** ${fornecedores[0]?.fornecedor || "não identificada"}, com ${dinheiro(fornecedores[0]?.valor)}.`
                    : `### Resumo das perdas\n\n- **Valor perdido:** ${dinheiro(total.valor)}.\n- **Registros:** ${numero(total.registros)}.\n- **Quantidade:** ${numero(total.quantidade)} unidades/kg.\n- **Valor médio por registro:** ${dinheiro(total.valorMedioRegistro)}.\n- **Principal impacto:** ${fornecedores[0]?.fornecedor || "não identificado"}, com ${dinheiro(fornecedores[0]?.valor)}.`;
            } else if (tipoAnalise === "concentracao") {
                resposta = escopoCaixas
                    ? `### Concentração do estoque\n\n- **Fornecedor nº 1:** ${percentual(conc.fornecedorTop1Pct)} do valor.\n- **Top 3 fornecedores:** ${percentual(conc.fornecedorTop3Pct)} do valor.\n- **Categoria nº 1:** ${percentual(conc.categoriaTop1Pct)} do valor.\n- **Top 3 categorias:** ${percentual(conc.categoriaTop3Pct)} do valor.\n- **Top 5 produtos:** ${percentual(conc.produtoTop5Pct)} do valor.`
                    : `### Concentração das perdas\n\n- **Fornecedor nº 1:** ${percentual(conc.fornecedorTop1Pct)} do valor perdido.\n- **Top 3 fornecedores:** ${percentual(conc.fornecedorTop3Pct)} do valor.\n- **Categoria nº 1:** ${percentual(conc.categoriaTop1Pct)} do valor.\n- **Top 3 categorias:** ${percentual(conc.categoriaTop3Pct)} do valor.\n- **Top 5 produtos:** ${percentual(conc.produtoTop5Pct)} do valor.\n\n**Leitura:** quanto maior a concentração, mais a gestão pode priorizar poucos pontos para atacar uma parcela maior do impacto.`;
            } else if (tipoAnalise === "tendencia") {
                if (!tend.disponivel) {
                    resposta = `### Tendência\n\nA comparação temporal está **${tend.motivo || "não disponível no recorte atual"}**.`;
                } else {
                    const v = tend.variacao || {};
                    resposta = `### Tendência do período\n\n- **Valor:** ${percentual(v.valor)}.\n- **Quantidade:** ${percentual(v.quantidade)}.\n- **Registros:** ${percentual(v.registros)}.\n- **Valor médio por registro:** ${percentual(v.valorMedioRegistro)}.\n\n**Período atual:** ${tend.periodos?.atual || "não informado"}.\n**Período anterior:** ${tend.periodos?.anterior || "não informado"}.`;
                }
            } else if (tipoAnalise === "atencao") {
                const pontos = [];
                if (conc.fornecedorTop1Pct >= 40) pontos.push(`**Concentração por fornecedor:** ${percentual(conc.fornecedorTop1Pct)} está no líder (${fornecedores[0]?.fornecedor || "não informado"}).`);
                if (conc.categoriaTop1Pct >= 40) pontos.push(`**Concentração por categoria:** ${percentual(conc.categoriaTop1Pct)} está na categoria líder (${categorias[0]?.categoria || "não informada"}).`);
                if (conc.produtoTop1Pct >= 15) pontos.push(`**Produto de alto impacto:** ${percentual(conc.produtoTop1Pct)} está no produto líder (${produtos[0]?.produto || "não identificado"}).`);
                if (tend.disponivel && tend.variacao?.valor != null && tend.variacao.valor > 10) pontos.push(`**Aumento de valor:** ${percentual(tend.variacao.valor)} em relação ao período anterior.`);
                if (!pontos.length) pontos.push("Não foi identificado um alerta objetivo acima dos limites analíticos configurados no recorte atual.");
                resposta = `### Pontos de atenção\n\n${pontos.map(x => `- ${x}`).join("\n")}`;
            } else if (tipoAnalise === "recomendacoes") {
                const rec = [];
                if (fornecedores[0]) rec.push(`Priorizar a investigação de **${fornecedores[0].fornecedor || "fornecedor líder"}**, que concentra ${percentual(conc.fornecedorTop1Pct)} do valor.`);
                if (produtos[0]) rec.push(`Verificar **${produtos[0].produto || "produto líder"}**, responsável por ${percentual(conc.produtoTop1Pct)} do valor.`);
                if (categorias[0]) rec.push(`Avaliar a operação de **${categorias[0].categoria || "categoria líder"}**, que representa ${percentual(conc.categoriaTop1Pct)} do valor.`);
                if (tend.disponivel && tend.variacao?.valor > 0) rec.push(`Acompanhar o aumento de ${percentual(tend.variacao.valor)} no valor em relação ao período anterior.`);
                resposta = `### Prioridades sugeridas\n\n${rec.length ? rec.map((x,i)=>`${i+1}. ${x}`).join("\n") : "Não há dados suficientes para sugerir prioridades no recorte atual."}\n\n*As sugestões são analíticas e não alteram nenhum dado do sistema.*`;
            } else if (tipoAnalise === "completa") {
                const tendencia = tend.disponivel && tend.variacao?.valor != null ? `${percentual(tend.variacao.valor)} no valor` : "sem comparação temporal disponível";
                resposta = `### Diagnóstico completo\n\n**Situação:** ${escopoCaixas ? `${dinheiro(total.valor)} armazenados em ${numero(total.quantidade)} unidades/kg` : `${dinheiro(total.valor)} perdidos em ${numero(total.registros)} registros`}.\n\n**Concentração:** top 3 fornecedores representam ${percentual(conc.fornecedorTop3Pct)} do valor.\n\n**Tendência:** ${tendencia}.\n\n**Ponto principal:** ${produtos[0]?.produto || categorias[0]?.categoria || fornecedores[0]?.fornecedor || "não identificado"}.\n\n**Prioridade:** investigar primeiro os itens de maior participação e validar a causa operacional antes de ampliar a investigação.`;
            } else {
                // Pergunta livre: regras simples e determinísticas antes do fallback genérico.
                if (tem("tendencia", "evolucao", "aumentou", "diminuiu", "melhorou", "piorou", "compar")) {
                    if (!tend.disponivel) resposta = "### Tendência\n\nNão há comparação temporal disponível no recorte atual.";
                    else resposta = `### Comparação\n\n- **Valor:** ${percentual(tend.variacao?.valor)}.\n- **Quantidade:** ${percentual(tend.variacao?.quantidade)}.\n- **Registros:** ${percentual(tend.variacao?.registros)}.\n- **Valor médio por registro:** ${percentual(tend.variacao?.valorMedioRegistro)}.`;
                } else if (tem("concentr", "pareto", "80/20")) {
                    resposta = `### Concentração\n\n- Top 1 fornecedor: **${percentual(conc.fornecedorTop1Pct)}**.\n- Top 3 fornecedores: **${percentual(conc.fornecedorTop3Pct)}**.\n- Top 1 categoria: **${percentual(conc.categoriaTop1Pct)}**.\n- Top 5 produtos: **${percentual(conc.produtoTop5Pct)}**.`;
                } else if (tem("atencao", "atenção", "problema", "risco", "critico", "crítico")) {
                    resposta = `### Pontos de atenção\n\n- **Fornecedor líder:** ${fornecedores[0]?.fornecedor || "não identificado"} — ${dinheiro(fornecedores[0]?.valor)}.\n- **Categoria líder:** ${categorias[0]?.categoria || "não identificada"} — ${dinheiro(categorias[0]?.valor)}.\n- **Produto líder:** ${produtos[0]?.produto || "não identificado"} — ${dinheiro(produtos[0]?.valor)}.`;
                } else if (tem("fornecedor", "fornecedores")) {
                    resposta = `### Fornecedores em destaque\n\n${linhas(fornecedores, 'fornecedor') || 'Nenhum fornecedor encontrado no recorte atual.'}`;
                } else if (tem("produto", "produtos")) {
                    resposta = `### Produtos em destaque\n\n${linhas(produtos, 'produto') || 'Nenhum produto encontrado no recorte atual.'}`;
                } else if (tem("categoria", "categorias")) {
                    resposta = `### Categorias em destaque\n\n${linhas(categorias, 'categoria') || 'Nenhuma categoria encontrada no recorte atual.'}`;
                } else {
                    resposta = escopoCaixas
                        ? `### Leitura atual\n\n- Valor armazenado: **${dinheiro(total.valor)}**.\n- Quantidade: **${numero(total.quantidade)} unidades/kg**.\n- Maior fornecedor: **${fornecedores[0]?.fornecedor || "não identificado"}**.\n- Maior categoria: **${categorias[0]?.categoria || "não identificada"}**.`
                        : `### Leitura atual\n\n- Valor perdido: **${dinheiro(total.valor)}**.\n- Registros: **${numero(total.registros)}**.\n- Valor médio por registro: **${dinheiro(total.valorMedioRegistro)}**.\n- Maior fornecedor: **${fornecedores[0]?.fornecedor || "não identificado"}**.\n- Maior categoria: **${categorias[0]?.categoria || "não identificada"}**.`;
                }
            }
            return res.json({ ok: true, modo: "local", tipoAnalise, resposta });
        } catch (erro) {
            console.error("Erro no Analista IA V20.6:", erro);
            return res.status(500).json({ erro: "Não foi possível gerar a análise." });
        }
    }
);

/* =========================================================
   DASHBOARD - ESTOQUE ARMAZENADO NAS CAIXAS
   Dados atuais das caixas, independentes dos filtros de avarias.
========================================================= */

app.get(
    "/api/dashboard/caixas-resumo",
    
    exigirUsuario,
    async (req, res) => {
        try {
            await garantirTabelaCaixaProdutos();

            const filtroFornecedor = String(req.query.fornecedor || "").trim();
            const filtroCategoria = String(req.query.categoria || "").trim();
            const filtroCaixa = String(req.query.caixa || "").trim();
            const filtroProduto = String(req.query.produto || "").trim();

            const params = [];
            const filtros = [];
            const addFiltro = (clausula, valor) => {
                params.push(valor);
                filtros.push(clausula.replace(/\$VALOR/g, `$${params.length}`));
            };

            if (filtroFornecedor && filtroFornecedor !== "Todos") {
                addFiltro(
                    `COALESCE(NULLIF(TRIM(p.fornecedor), ''), NULLIF(TRIM(c.responsavel), ''), 'Não informado') = $VALOR`,
                    filtroFornecedor
                );
            }
            if (filtroCategoria && filtroCategoria !== "Todos") {
                addFiltro(
                    `COALESCE(NULLIF(TRIM(cp.categoria), ''), NULLIF(TRIM(p.categoria), ''), 'Mercearia') = $VALOR`,
                    filtroCategoria
                );
            }
            if (filtroCaixa && filtroCaixa !== "Todos") {
                addFiltro(`c.id = $VALOR`, filtroCaixa);
            }
            if (filtroProduto) {
                addFiltro(
                    `LOWER(COALESCE(cp.produto, '') || ' ' || COALESCE(cp.codigo, '')) LIKE '%' || LOWER($VALOR) || '%'`,
                    filtroProduto
                );
            }

            const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
            const baseJoins = `
                FROM caixa_produtos cp
                LEFT JOIN produtos p ON p.codigo = cp.codigo
                INNER JOIN caixas c ON c.id = cp.caixa_id
            `;

            const total = await pool.query(`
                SELECT
                    COUNT(DISTINCT cp.caixa_id) AS caixas_com_produtos,
                    COALESCE(SUM(cp.quantidade), 0) AS quantidade_total,
                    COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0) AS valor_total,
                    COUNT(DISTINCT cp.codigo) AS produtos_distintos
                ${baseJoins}
                ${where}
            `, params);

            const fornecedores = await pool.query(`
                SELECT
                    COALESCE(NULLIF(TRIM(p.fornecedor), ''), NULLIF(TRIM(c.responsavel), ''), 'Não informado') AS fornecedor,
                    COUNT(DISTINCT cp.codigo) AS produtos,
                    COALESCE(SUM(cp.quantidade), 0) AS quantidade,
                    COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0) AS valor
                ${baseJoins}
                ${where}
                GROUP BY COALESCE(NULLIF(TRIM(p.fornecedor), ''), NULLIF(TRIM(c.responsavel), ''), 'Não informado')
                ORDER BY valor DESC, fornecedor ASC
                LIMIT 15
            `, params);

            const produtos = await pool.query(`
                SELECT
                    cp.codigo,
                    MAX(cp.produto) AS produto,
                    COALESCE(NULLIF(TRIM(MAX(cp.categoria)), ''), NULLIF(TRIM(MAX(p.categoria)), ''), 'Mercearia') AS categoria,
                    COALESCE(NULLIF(TRIM(MAX(p.fornecedor)), ''), NULLIF(TRIM(MAX(c.responsavel)), ''), 'Não informado') AS fornecedor,
                    COALESCE(SUM(cp.quantidade), 0) AS quantidade,
                    COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0) AS valor,
                    COUNT(DISTINCT cp.caixa_id) AS caixas
                ${baseJoins}
                ${where}
                GROUP BY cp.codigo
                ORDER BY valor DESC, quantidade DESC, produto ASC
                LIMIT 15
            `, params);

            const categorias = await pool.query(`
                SELECT
                    COALESCE(NULLIF(TRIM(cp.categoria), ''), NULLIF(TRIM(p.categoria), ''), 'Mercearia') AS categoria,
                    COALESCE(SUM(cp.quantidade), 0) AS quantidade,
                    COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0) AS valor,
                    COUNT(DISTINCT cp.codigo) AS produtos
                ${baseJoins}
                ${where}
                GROUP BY COALESCE(NULLIF(TRIM(cp.categoria), ''), NULLIF(TRIM(p.categoria), ''), 'Mercearia')
                ORDER BY valor DESC, categoria ASC
            `, params);

            const caixas = await pool.query(`
                SELECT
                    c.id,
                    c.numero,
                    c.local,
                    c.responsavel AS fornecedor,
                    COUNT(cp.id) AS produtos,
                    COALESCE(SUM(cp.quantidade), 0) AS quantidade,
                    COALESCE(SUM(cp.quantidade * cp.valor_unitario), 0) AS valor
                ${baseJoins}
                ${where}
                GROUP BY c.id, c.numero, c.local, c.responsavel
                ORDER BY valor DESC, c.numero ASC
                LIMIT 10
            `, params);

            // Opções sempre vêm do estoque completo, para o usuário poder trocar de filtro sem perder opções.
            const [opFornecedores, opCategorias, opCaixas] = await Promise.all([
                pool.query(`
                    SELECT DISTINCT COALESCE(NULLIF(TRIM(p.fornecedor), ''), NULLIF(TRIM(c.responsavel), ''), 'Não informado') AS fornecedor
                    FROM caixa_produtos cp
                    LEFT JOIN produtos p ON p.codigo = cp.codigo
                    INNER JOIN caixas c ON c.id = cp.caixa_id
                    ORDER BY fornecedor ASC
                `),
                pool.query(`
                    SELECT DISTINCT COALESCE(NULLIF(TRIM(cp.categoria), ''), NULLIF(TRIM(p.categoria), ''), 'Mercearia') AS categoria
                    FROM caixa_produtos cp
                    LEFT JOIN produtos p ON p.codigo = cp.codigo
                    INNER JOIN caixas c ON c.id = cp.caixa_id
                    ORDER BY categoria ASC
                `),
                pool.query(`
                    SELECT DISTINCT c.id, c.numero, c.local, c.responsavel AS fornecedor
                    FROM caixas c
                    INNER JOIN caixa_produtos cp ON cp.caixa_id = c.id
                    ORDER BY c.numero ASC, c.local ASC
                `)
            ]);

            return res.json({
                filtros: {
                    fornecedores: opFornecedores.rows.map(r => r.fornecedor || 'Não informado'),
                    categorias: opCategorias.rows.map(r => r.categoria || 'Mercearia'),
                    caixas: opCaixas.rows.map(r => ({
                        id: r.id,
                        numero: r.numero || '-',
                        local: r.local || '-',
                        fornecedor: r.fornecedor || 'Não informado'
                    }))
                },
                total: {
                    caixasComProdutos: Number(total.rows[0]?.caixas_com_produtos) || 0,
                    quantidade: Number(total.rows[0]?.quantidade_total) || 0,
                    valor: Number(total.rows[0]?.valor_total) || 0,
                    produtosDistintos: Number(total.rows[0]?.produtos_distintos) || 0
                },
                fornecedores: fornecedores.rows.map(r => ({
                    fornecedor: r.fornecedor || 'Não informado',
                    produtos: Number(r.produtos) || 0,
                    quantidade: Number(r.quantidade) || 0,
                    valor: Number(r.valor) || 0
                })),
                produtos: produtos.rows.map(r => ({
                    codigo: r.codigo || '',
                    produto: r.produto || '-',
                    categoria: r.categoria || 'Mercearia',
                    fornecedor: r.fornecedor || 'Não informado',
                    quantidade: Number(r.quantidade) || 0,
                    valor: Number(r.valor) || 0,
                    caixas: Number(r.caixas) || 0
                })),
                categorias: categorias.rows.map(r => ({
                    categoria: r.categoria || 'Mercearia',
                    quantidade: Number(r.quantidade) || 0,
                    valor: Number(r.valor) || 0,
                    produtos: Number(r.produtos) || 0
                })),
                caixas: caixas.rows.map(r => ({
                    id: r.id,
                    numero: r.numero || '-',
                    local: r.local || '-',
                    fornecedor: r.fornecedor || 'Não informado',
                    produtos: Number(r.produtos) || 0,
                    quantidade: Number(r.quantidade) || 0,
                    valor: Number(r.valor) || 0
                }))
            });
        } catch (erro) {
            console.error("Erro ao carregar resumo de estoque das caixas:", erro);
            return res.status(500).json({ erro: "Erro ao carregar resumo das caixas." });
        }
    }
);


/* =========================================================
   CAIXAS - CADASTRAR
   A caixa é criada sem produtos. Os produtos são lançados
   depois, dentro da própria caixa, pelo endpoint /produtos.
========================================================= */

app.post(
    "/api/caixas",
    exigirUsuario,

    async (req, res) => {

        let cliente;

        try {
            await garantirTabelaCaixaProdutos();

            const numero = String(req.body.numero || "").trim();
            const local = String(req.body.local || "").trim();
            const responsavel = String(req.body.responsavel || "").trim();
            const itensRecebidos = Array.isArray(req.body.itens) ? req.body.itens : [];

            if (!numero) {
                return res.status(400).json({ erro: "Informe o nome da caixa." });
            }

            const itens = [];
            for (const item of itensRecebidos) {
                const codigo = String(item?.codigo || "").trim();
                const quantidade = Number(item?.quantidade);

                if (!codigo) continue;
                if (!Number.isFinite(quantidade) || quantidade <= 0) {
                    return res.status(400).json({ erro: `Quantidade inválida para o produto ${codigo}.` });
                }

                const produtoResultado = await pool.query(
                    `
                    SELECT codigo, descricao, valor_custo
                    FROM produtos
                    WHERE ativo = TRUE
                      AND (
                          codigo = $1
                          OR (length($1) = 13 AND lpad(codigo, 13, '0') = $1)
                      )
                    ORDER BY CASE WHEN codigo = $1 THEN 0 ELSE 1 END
                    LIMIT 1
                    `,
                    [codigo]
                );

                if (!produtoResultado.rowCount) {
                    return res.status(404).json({ erro: `Produto ${codigo} não encontrado.` });
                }

                const produto = produtoResultado.rows[0];
                itens.push({
                    codigo: produto.codigo,
                    produto: produto.descricao,
                    quantidade,
                    valorUnitario: Number(produto.valor_custo) || 0
                });
            }

            // Consolida produtos repetidos antes de salvar.
            const itensMap = new Map();
            for (const item of itens) {
                if (!itensMap.has(item.codigo)) {
                    itensMap.set(item.codigo, { ...item });
                } else {
                    itensMap.get(item.codigo).quantidade += item.quantidade;
                }
            }

            const id = req.body.id || crypto.randomUUID();
            cliente = await pool.connect();
            await cliente.query("BEGIN");

            const resultado = await cliente.query(
                `
                INSERT INTO caixas
                (id, numero, local, responsavel)
                VALUES ($1, $2, $3, $4)
                RETURNING id, numero, local, responsavel, criado_em
                `,
                [id, numero, local, responsavel]
            );

            const itemCaixa = resultado.rows[0];

            for (const item of itensMap.values()) {
                await cliente.query(
                    `
                    INSERT INTO caixa_produtos
                    (id, caixa_id, codigo, produto, quantidade, valor_unitario)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (caixa_id, codigo)
                    DO UPDATE SET
                        quantidade = caixa_produtos.quantidade + EXCLUDED.quantidade,
                        produto = EXCLUDED.produto,
                        valor_unitario = EXCLUDED.valor_unitario,
                        atualizado_em = CURRENT_TIMESTAMP
                    `,
                    [
                        crypto.randomUUID(),
                        id,
                        item.codigo,
                        item.produto,
                        item.quantidade,
                        item.valorUnitario
                    ]
                );
            }

            await cliente.query("COMMIT");

            await registrarAuditoria({
                acao: "caixa-criada",
                entidade: "caixa",
                registroId: itemCaixa.id,
                usuario: req.usuarioAtual.usuario,
                depois: {
                    numero: itemCaixa.numero,
                    local: itemCaixa.local || "",
                    responsavel: itemCaixa.responsavel || "",
                    itens: Array.from(itensMap.values()).map(item => ({
                        codigo: item.codigo,
                        produto: item.produto,
                        quantidade: item.quantidade
                    }))
                },
                detalhes: `Caixa ${itemCaixa.numero} cadastrada com ${itensMap.size} produto(s).`
            });

            emitirEventoSistema("caixas-atualizadas", {
                acao: "criada",
                id: itemCaixa.id
            });

            return res.status(201).json({
                id: itemCaixa.id,
                numero: itemCaixa.numero,
                local: itemCaixa.local || "",
                responsavel: itemCaixa.responsavel || "",
                criadoEm: itemCaixa.criado_em,
                totalItens: itensMap.size
            });

        } catch (erro) {
            if (cliente) {
                try { await cliente.query("ROLLBACK"); } catch {}
            }

            if (erro.code === "23505") {
                return res.status(409).json({ erro: "Essa caixa já está cadastrada." });
            }

            console.error("Erro ao cadastrar caixa:", erro);
            return res.status(500).json({ erro: "Erro ao cadastrar caixa." });
        } finally {
            if (cliente) cliente.release();
        }
    }
);

/* =========================================================
   CAIXAS - EXCLUIR
========================================================= */

app.delete(
    "/api/caixas/:id",
    exigirUsuario,

    async (req, res) => {

        try {

            const id =
                req.params.id;


            const caixaResultado =
                await pool.query(
                    `
                    SELECT numero
                    FROM caixas
                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                caixaResultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Caixa não encontrada."
                    });

            }


            const numeroCaixa =
                caixaResultado.rows[0]
                    .numero;


            /*
                Mantém a regra que seu sistema
                já tinha: não excluir caixa com
                avaria pendente.
            */

            const pendencias =
                await pool.query(
                    `
                    SELECT COUNT(*) AS quantidade

                    FROM avarias

                    WHERE caixa = $1
                    AND status = 'Pendente'
                    `,
                    [numeroCaixa]
                );


            if (
                Number(
                    pendencias.rows[0]
                        .quantidade
                ) > 0
            ) {

                return res
                    .status(409)
                    .json({
                        erro:
                            "Essa caixa possui avarias pendentes."
                    });

            }


            await pool.query(
                `
                DELETE FROM caixa_produtos
                WHERE caixa_id = $1
                `,
                [id]
            );


            await pool.query(
                `
                DELETE FROM caixas
                WHERE id = $1
                `,
                [id]
            );


            await registrarAuditoria({
                acao: "caixa-excluida",
                entidade: "caixa",
                registroId: id,
                usuario: req.usuarioAtual.usuario,
                antes: {
                    numero: numeroCaixa
                },
                detalhes: `Caixa ${numeroCaixa} excluída.`
            });

            emitirEventoSistema(
                "caixas-atualizadas",
                {
                    acao:
                        "excluida",
                    id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao excluir caixa:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao excluir caixa."
                });

        }

    }
);


/* =========================================================
   V24 - RECUPERAÇÕES / DOAÇÕES
   Documentos numerados, abertos/finalizados, histórico por documento,
   reimpressão e auditoria de exclusões.
========================================================= */

function hojeServidor(){
    const d=new Date();
    const partes=new Intl.DateTimeFormat("en-US",{timeZone:TIME_ZONE_SISTEMA,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
    const get=t=>partes.find(p=>p.type===t)?.value||"";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalizarDataOperacao(valor) {
    const data = String(valor || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : "";
}

function dataDocumentoRecuperacao(valor) {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "";
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE_SISTEMA, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = tipo => partes.find(p => p.type === tipo)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function prefixoDocumento(tipo) {
    return tipo === "DOACAO" ? "DOA" : "REC";
}

function sequenciaDocumento(tipo) {
    return tipo === "DOACAO" ? "seq_documento_doacao_v24" : "seq_documento_recuperacao_v24";
}

function numeroDocumentoFormatado(tipo, numero) {
    return `${prefixoDocumento(tipo)}-${String(numero || 0).padStart(4, "0")}`;
}

async function garantirTabelasRecuperacaoDoacao() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS recuperacoes_produtos (
            id VARCHAR(100) PRIMARY KEY,
            codigo VARCHAR(50),
            produto VARCHAR(255) NOT NULL,
            fornecedor VARCHAR(255),
            codigo_fornecedor VARCHAR(50),
            categoria VARCHAR(50),
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
            quantidade_recuperada NUMERIC(15,3) NOT NULL DEFAULT 0,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            setor VARCHAR(100),
            observacao TEXT,
            usuario_lancamento VARCHAR(100),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recuperacoes_criado_em ON recuperacoes_produtos(criado_em DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recuperacoes_fornecedor ON recuperacoes_produtos(fornecedor)`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS doacoes_produtos (
            id VARCHAR(100) PRIMARY KEY,
            codigo VARCHAR(50),
            produto VARCHAR(255) NOT NULL,
            fornecedor VARCHAR(255),
            codigo_fornecedor VARCHAR(50),
            categoria VARCHAR(50),
            quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
            valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
            beneficiario VARCHAR(255) NOT NULL,
            data_doacao DATE NOT NULL DEFAULT CURRENT_DATE,
            observacao TEXT,
            usuario_lancamento VARCHAR(100),
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_doacoes_data ON doacoes_produtos(data_doacao DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_doacoes_beneficiario ON doacoes_produtos(beneficiario)`);

    await pool.query(`CREATE SEQUENCE IF NOT EXISTS seq_documento_recuperacao_v24 START 1`);
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS seq_documento_doacao_v24 START 1`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS documentos_operacao (
            id BIGSERIAL PRIMARY KEY,
            tipo VARCHAR(20) NOT NULL,
            data_documento DATE NOT NULL,
            numero BIGINT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finalizado_em TIMESTAMPTZ,
            finalizado_por VARCHAR(100),
            CONSTRAINT documentos_operacao_tipo_numero_unq UNIQUE (tipo, numero),
            CONSTRAINT documentos_operacao_status_chk CHECK (status IN ('ABERTO','FINALIZADO'))
        )
    `);
    await pool.query(`ALTER TABLE documentos_operacao ADD COLUMN IF NOT EXISTS beneficiario VARCHAR(255)`);
    await pool.query(`
        UPDATE documentos_operacao d
        SET beneficiario=x.beneficiario
        FROM (
            SELECT documento_id, MIN(NULLIF(TRIM(beneficiario),'')) AS beneficiario
            FROM doacoes_produtos
            WHERE documento_id IS NOT NULL
            GROUP BY documento_id
        ) x
        WHERE d.id=x.documento_id
          AND d.tipo='DOACAO'
          AND (d.beneficiario IS NULL OR TRIM(d.beneficiario)='')
          AND x.beneficiario IS NOT NULL
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documentos_operacao_beneficiario ON documentos_operacao(beneficiario)`);

    // V24.5: vários documentos podem existir no mesmo dia; somente um documento fica aberto por tipo/data.
    await pool.query(`ALTER TABLE documentos_operacao DROP CONSTRAINT IF EXISTS documentos_operacao_tipo_data_unq`);
    await pool.query(`ALTER TABLE recuperacoes_produtos ADD COLUMN IF NOT EXISTS documento_id BIGINT`);
    await pool.query(`ALTER TABLE doacoes_produtos ADD COLUMN IF NOT EXISTS documento_id BIGINT`);

    // Vincula os registros antigos ao documento que já existia para a respectiva data.
    await pool.query(`
        UPDATE recuperacoes_produtos r SET documento_id=d.id
        FROM documentos_operacao d
        WHERE r.documento_id IS NULL AND d.tipo='RECUPERACAO'
          AND d.data_documento=DATE(r.criado_em AT TIME ZONE $1)
    `,[TIME_ZONE_SISTEMA]);
    await pool.query(`
        UPDATE doacoes_produtos r SET documento_id=d.id
        FROM documentos_operacao d
        WHERE r.documento_id IS NULL AND d.tipo='DOACAO'
          AND d.data_documento=r.data_doacao
    `);

    // Caso exista registro legado sem documento, cria o documento correspondente e vincula depois.
    await pool.query(`
        INSERT INTO documentos_operacao (tipo,data_documento,numero,status,criado_em)
        SELECT 'RECUPERACAO',x.data_documento,nextval('seq_documento_recuperacao_v24'),'ABERTO',MIN(x.criado_em)
        FROM (
            SELECT DATE(criado_em AT TIME ZONE $1) data_documento,MIN(criado_em) criado_em
            FROM recuperacoes_produtos WHERE documento_id IS NULL
            GROUP BY DATE(criado_em AT TIME ZONE $1)
        ) x
        WHERE NOT EXISTS (SELECT 1 FROM documentos_operacao d WHERE d.tipo='RECUPERACAO' AND d.data_documento=x.data_documento)
        GROUP BY x.data_documento ORDER BY x.data_documento
    `,[TIME_ZONE_SISTEMA]);
    await pool.query(`
        INSERT INTO documentos_operacao (tipo,data_documento,numero,status,criado_em)
        SELECT 'DOACAO',x.data_documento,nextval('seq_documento_doacao_v24'),'ABERTO',MIN(x.criado_em)
        FROM (
            SELECT data_doacao data_documento,MIN(criado_em) criado_em
            FROM doacoes_produtos WHERE documento_id IS NULL
            GROUP BY data_doacao
        ) x
        WHERE NOT EXISTS (SELECT 1 FROM documentos_operacao d WHERE d.tipo='DOACAO' AND d.data_documento=x.data_documento)
        GROUP BY x.data_documento ORDER BY x.data_documento
    `);
    await pool.query(`
        UPDATE recuperacoes_produtos r SET documento_id=d.id
        FROM documentos_operacao d
        WHERE r.documento_id IS NULL AND d.tipo='RECUPERACAO'
          AND d.data_documento=DATE(r.criado_em AT TIME ZONE $1)
    `,[TIME_ZONE_SISTEMA]);
    await pool.query(`
        UPDATE doacoes_produtos r SET documento_id=d.id
        FROM documentos_operacao d
        WHERE r.documento_id IS NULL AND d.tipo='DOACAO'
          AND d.data_documento=r.data_doacao
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recuperacoes_documento_id ON recuperacoes_produtos(documento_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_doacoes_documento_id ON doacoes_produtos(documento_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_operacao_unico_aberto ON documentos_operacao(tipo,data_documento) WHERE status='ABERTO'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_documentos_operacao_data ON documentos_operacao(tipo,data_documento DESC)`);
}

async function obterOuCriarDocumentoOperacao(tipo, dataDocumento, client = pool) {
    const data=normalizarDataOperacao(dataDocumento);if(!data)throw new Error("Data do documento inválida.");
    const tipoNormalizado=tipo==="DOACAO"?"DOACAO":"RECUPERACAO";
    const aberto=await client.query(`SELECT * FROM documentos_operacao WHERE tipo=$1 AND data_documento=$2::date AND status='ABERTO' ORDER BY id DESC LIMIT 1`,[tipoNormalizado,data]);
    if(aberto.rowCount)return aberto.rows[0];
    const seq=sequenciaDocumento(tipoNormalizado),proximo=await client.query(`SELECT nextval('${seq}') AS numero`),numero=Number(proximo.rows[0].numero);
    try{
        const inserido=await client.query(`INSERT INTO documentos_operacao (tipo,data_documento,numero,status) VALUES ($1,$2::date,$3,'ABERTO') RETURNING *`,[tipoNormalizado,data,numero]);
        return inserido.rows[0];
    }catch(erro){
        if(erro?.code!=="23505")throw erro;
        const concorrente=await client.query(`SELECT * FROM documentos_operacao WHERE tipo=$1 AND data_documento=$2::date AND status='ABERTO' ORDER BY id DESC LIMIT 1`,[tipoNormalizado,data]);
        if(concorrente.rowCount)return concorrente.rows[0];
        throw erro;
    }
}

async function documentoOperacaoPorData(tipo,dataDocumento){
    await garantirTabelasRecuperacaoDoacao();const data=normalizarDataOperacao(dataDocumento);if(!data)return null;
    const r=await pool.query(`SELECT * FROM documentos_operacao WHERE tipo=$1 AND data_documento=$2::date ORDER BY CASE WHEN status='ABERTO' THEN 0 ELSE 1 END,numero DESC LIMIT 1`,[tipo,data]);return r.rows[0]||null;
}
async function documentoOperacaoPorId(tipo,id){
    await garantirTabelasRecuperacaoDoacao();const r=await pool.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo=$2 LIMIT 1`,[String(id),tipo]);return r.rows[0]||null;
}

function documentoResumo(doc) {
    if (!doc) return null;
    return {
        id: String(doc.id),
        tipo: doc.tipo,
        dataDocumento: doc.data_documento,
        numero: Number(doc.numero),
        documento: numeroDocumentoFormatado(doc.tipo, doc.numero),
        status: doc.status,
        beneficiario: doc.beneficiario || "",
        criadoEm: doc.criado_em,
        finalizadoEm: doc.finalizado_em,
        finalizadoPor: doc.finalizado_por || ""
    };
}

function filtrosRecuperacao(reqOrFiltros = {}) {
    const origem = reqOrFiltros.filtros || reqOrFiltros;
    const busca = String(origem.busca || "").trim();
    const fornecedor = String(origem.fornecedor || "").trim();
    const dataInicio = String(origem.dataInicio || "").trim();
    const dataFim = String(origem.dataFim || "").trim();
    const documentoId = String(origem.documentoId || "").trim();
    const where = [];
    const params = [];
    let n = 1;
    if (busca) { where.push(`(LOWER(r.produto) LIKE $${n} OR LOWER(COALESCE(r.codigo,'')) LIKE $${n} OR LOWER(COALESCE(r.fornecedor,'')) LIKE $${n})`); params.push(`%${busca.toLowerCase()}%`); n++; }
    if (fornecedor) { where.push(`LOWER(COALESCE(r.fornecedor,'')) LIKE $${n}`); params.push(`%${fornecedor.toLowerCase()}%`); n++; }
    if (dataInicio) { where.push(`r.criado_em::date >= $${n}`); params.push(dataInicio); n++; }
    if (dataFim) { where.push(`r.criado_em::date <= $${n}`); params.push(dataFim); n++; }
    if (documentoId) { where.push(`r.documento_id = $${n}`); params.push(documentoId); n++; }
    return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params, next: n };
}

function ordenarRecuperacao(valor, fallback = "criado_em") {
    const mapa = { criado_em:"r.criado_em", data:"r.criado_em", codigo:"LOWER(COALESCE(r.codigo,''))", produto:"LOWER(r.produto)", fornecedor:"LOWER(COALESCE(r.fornecedor,''))", categoria:"LOWER(COALESCE(r.categoria,''))", quantidade:"r.quantidade", valor:"(r.quantidade*r.valor_unitario)", quantidade_recuperada:"r.quantidade_recuperada", valor_recuperado:"(r.quantidade_recuperada*r.valor_unitario)" };
    return mapa[valor] || mapa[fallback];
}

function filtrosDoacao(origem = {}) {
    const filtros = origem.filtros || origem;
    const busca = String(filtros.busca || "").trim();
    const dataInicio = String(filtros.dataInicio || "").trim();
    const dataFim = String(filtros.dataFim || "").trim();
    const documentoId = String(filtros.documentoId || "").trim();
    const where = [];
    const params = [];
    let n = 1;
    if (busca) { where.push(`(LOWER(d.produto) LIKE $${n} OR LOWER(COALESCE(d.codigo,'')) LIKE $${n} OR LOWER(COALESCE(d.beneficiario,'')) LIKE $${n} OR LOWER(COALESCE(d.fornecedor,'')) LIKE $${n})`); params.push(`%${busca.toLowerCase()}%`); n++; }
    if (dataInicio) { where.push(`d.data_doacao >= $${n}`); params.push(dataInicio); n++; }
    if (dataFim) { where.push(`d.data_doacao <= $${n}`); params.push(dataFim); n++; }
    if (documentoId) { where.push(`d.documento_id = $${n}`); params.push(documentoId); n++; }
    return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params, next: n };
}

function ordenarDoacao(valor, fallback = "data_doacao") {
    const mapa = { data_doacao:"d.data_doacao", produto:"LOWER(d.produto)", quantidade:"d.quantidade", valor_total:"(d.quantidade*d.valor_unitario)" };
    return mapa[valor] || mapa[fallback];
}

async function consultarRecuperacoes(filtros = {}, paginacao = true) {
    await garantirTabelasRecuperacaoDoacao();
    const f = filtrosRecuperacao(filtros);
    const sort = ordenarRecuperacao(filtros.sort, "criado_em");
    const dir = String(filtros.dir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    let sql = `SELECT r.id,r.documento_id,r.codigo,r.produto,r.fornecedor,r.codigo_fornecedor,r.categoria,r.quantidade,r.quantidade_recuperada,r.valor_unitario,r.observacao,r.usuario_lancamento,r.criado_em,(r.quantidade*r.valor_unitario) AS valor_recuperado FROM recuperacoes_produtos r ${f.where} ORDER BY ${sort} ${dir},r.id DESC`;
    const params=[...f.params];
    if(paginacao){const limit=[10,25,50,100].includes(Number(filtros.limit))?Number(filtros.limit):25;const page=Math.max(1,Number(filtros.page)||1);params.push(limit,(page-1)*limit);sql+=` LIMIT $${params.length-1} OFFSET $${params.length}`;}
    const rows=await pool.query(sql,params);
    const resumo=await pool.query(`SELECT COUNT(*)::int AS registros,COALESCE(SUM(r.quantidade),0) AS quantidade_recuperada,COALESCE(SUM(r.quantidade*r.valor_unitario),0) AS valor_recuperado FROM recuperacoes_produtos r ${f.where}`,f.params);
    const total=Number(resumo.rows[0]?.registros||0),limit=paginacao?([10,25,50,100].includes(Number(filtros.limit))?Number(filtros.limit):25):total||1,page=paginacao?Math.max(1,Number(filtros.page)||1):1;
    return {registros:rows.rows.map(item=>({id:String(item.id),codigo:item.codigo||"",produto:item.produto||"",fornecedor:item.fornecedor||"",codigoFornecedor:item.codigo_fornecedor||"",categoria:item.categoria||"",quantidade:Number(item.quantidade||0),quantidadeRecuperada:Number(item.quantidade||0),valorUnitario:Number(item.valor_unitario||0),valorRecuperado:Number(item.valor_recuperado||0),observacao:item.observacao||"",usuarioLancamento:item.usuario_lancamento||"",criadoEm:item.criado_em})),resumo:{registros:total,quantidadeRecuperada:Number(resumo.rows[0]?.quantidade_recuperada||0),valorRecuperado:Number(resumo.rows[0]?.valor_recuperado||0)},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))};
}

async function consultarDoacoes(filtros = {}, paginacao = true) {
    await garantirTabelasRecuperacaoDoacao();
    const f=filtrosDoacao(filtros),sort=ordenarDoacao(filtros.sort,"data_doacao"),dir=String(filtros.dir||"desc").toLowerCase()==="asc"?"ASC":"DESC";
    let sql=`SELECT d.id,d.documento_id,d.codigo,d.produto,d.fornecedor,d.codigo_fornecedor,d.categoria,d.quantidade,d.valor_unitario,d.beneficiario,d.data_doacao,d.observacao,d.usuario_lancamento,d.criado_em,(d.quantidade*d.valor_unitario) AS valor_total FROM doacoes_produtos d ${f.where} ORDER BY ${sort} ${dir},d.id DESC`;
    const params=[...f.params];
    if(paginacao){const limit=[10,25,50,100].includes(Number(filtros.limit))?Number(filtros.limit):25;const page=Math.max(1,Number(filtros.page)||1);params.push(limit,(page-1)*limit);sql+=` LIMIT $${params.length-1} OFFSET $${params.length}`;}
    const rows=await pool.query(sql,params);
    const resumo=await pool.query(`SELECT COUNT(*)::int AS registros,COALESCE(SUM(d.quantidade),0) AS quantidade_doada,COALESCE(SUM(d.quantidade*d.valor_unitario),0) AS valor_doado,COUNT(DISTINCT LOWER(TRIM(d.beneficiario)))::int AS beneficiarios FROM doacoes_produtos d ${f.where}`,f.params);
    const total=Number(resumo.rows[0]?.registros||0),limit=paginacao?([10,25,50,100].includes(Number(filtros.limit))?Number(filtros.limit):25):total||1,page=paginacao?Math.max(1,Number(filtros.page)||1):1;
    return {registros:rows.rows.map(item=>({id:String(item.id),codigo:item.codigo||"",produto:item.produto||"",fornecedor:item.fornecedor||"",codigoFornecedor:item.codigo_fornecedor||"",categoria:item.categoria||"",quantidade:Number(item.quantidade||0),valorUnitario:Number(item.valor_unitario||0),valorTotal:Number(item.valor_total||0),beneficiario:item.beneficiario||"",dataDoacao:item.data_doacao,observacao:item.observacao||"",usuarioLancamento:item.usuario_lancamento||"",criadoEm:item.criado_em})),resumo:{registros:total,quantidadeDoada:Number(resumo.rows[0]?.quantidade_doada||0),valorDoado:Number(resumo.rows[0]?.valor_doado||0),beneficiarios:Number(resumo.rows[0]?.beneficiarios||0)},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))};
}

async function consultarDocumentosRecuperacao(filtros = {}, paginacao = true) {
    await garantirTabelasRecuperacaoDoacao();
    const o=filtros.filtros||filtros,busca=String(o.busca||"").trim().toLowerCase(),fornecedor=String(o.fornecedor||"").trim().toLowerCase(),inicio=String(o.dataInicio||"").trim(),fim=String(o.dataFim||"").trim();
    const where=[],params=[];let n=1;
    if(busca){where.push(`(LOWER(r.produto) LIKE $${n} OR LOWER(COALESCE(r.codigo,'')) LIKE $${n} OR LOWER(COALESCE(r.fornecedor,'')) LIKE $${n})`);params.push(`%${busca}%`);n++;}
    if(fornecedor){where.push(`LOWER(COALESCE(r.fornecedor,'')) LIKE $${n}`);params.push(`%${fornecedor}%`);n++;}
    if(inicio){where.push(`d.data_documento >= $${n}::date`);params.push(inicio);n++;}
    if(fim){where.push(`d.data_documento <= $${n}::date`);params.push(fim);n++;}
    const cond=where.length?`WHERE ${where.join(" AND ")}`:"",sortMap={data_documento:"d.data_documento",numero:"d.numero",registros:"COUNT(r.id)",valor:"COALESCE(SUM(r.quantidade*r.valor_unitario),0)",status:"d.status"},sort=sortMap[o.sort]||sortMap.data_documento,dir=String(o.dir||"desc").toLowerCase()==="asc"?"ASC":"DESC";
    const limit=[10,25,50,100].includes(Number(o.limit))?Number(o.limit):25,page=Math.max(1,Number(o.page)||1);
    const sql=`SELECT d.id,d.data_documento,d.numero,d.status,d.criado_em,d.finalizado_em,d.finalizado_por,COUNT(r.id)::int registros,COALESCE(SUM(r.quantidade),0) quantidade_recuperada,COALESCE(SUM(r.quantidade*r.valor_unitario),0) valor_recuperado FROM documentos_operacao d JOIN recuperacoes_produtos r ON r.documento_id=d.id AND d.tipo='RECUPERACAO' ${cond} GROUP BY d.id ORDER BY ${sort} ${dir},d.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const rows=await pool.query(sql,[...params,limit,(page-1)*limit]);
    const count=await pool.query(`SELECT COUNT(*)::int documentos,COALESCE(SUM(x.registros),0)::int registros,COALESCE(SUM(x.quantidade_recuperada),0) quantidade_recuperada,COALESCE(SUM(x.valor_recuperado),0) valor_recuperado FROM (SELECT d.id,COUNT(r.id)::int registros,COALESCE(SUM(r.quantidade),0) quantidade_recuperada,COALESCE(SUM(r.quantidade*r.valor_unitario),0) valor_recuperado FROM documentos_operacao d JOIN recuperacoes_produtos r ON r.documento_id=d.id AND d.tipo='RECUPERACAO' ${cond} GROUP BY d.id)x`,params);
    const total=Number(count.rows[0]?.documentos||0);
    return {documentos:rows.rows.map(r=>({id:String(r.id),dataDocumento:r.data_documento,numero:Number(r.numero),documento:numeroDocumentoFormatado("RECUPERACAO",r.numero),status:r.status,registros:Number(r.registros||0),quantidadeRecuperada:Number(r.quantidade_recuperada||0),valorRecuperado:Number(r.valor_recuperado||0),finalizadoEm:r.finalizado_em,finalizadoPor:r.finalizado_por||""})),resumo:{documentos:total,registros:Number(count.rows[0]?.registros||0),quantidadeRecuperada:Number(count.rows[0]?.quantidade_recuperada||0),valorRecuperado:Number(count.rows[0]?.valor_recuperado||0)},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))};
}

async function consultarDocumentosDoacao(filtros = {}, paginacao = true) {
    await garantirTabelasRecuperacaoDoacao();
    const o=filtros.filtros||filtros,busca=String(o.busca||"").trim().toLowerCase(),inicio=String(o.dataInicio||"").trim(),fim=String(o.dataFim||"").trim();
    const where=[],params=["DOACAO"];let n=2;
    if(busca){where.push(`(LOWER(dop.produto) LIKE $${n} OR LOWER(COALESCE(dop.codigo,'')) LIKE $${n} OR LOWER(COALESCE(dop.beneficiario,'')) LIKE $${n} OR LOWER(COALESCE(dop.fornecedor,'')) LIKE $${n})`);params.push(`%${busca}%`);n++;}
    if(inicio){where.push(`d.data_documento >= $${n}::date`);params.push(inicio);n++;}
    if(fim){where.push(`d.data_documento <= $${n}::date`);params.push(fim);n++;}
    const cond=where.length?`WHERE ${where.join(" AND ")}`:"",sortMap={data_documento:"d.data_documento",numero:"d.numero",registros:"COUNT(dop.id)",valor:"COALESCE(SUM(dop.quantidade*dop.valor_unitario),0)",status:"d.status"},sort=sortMap[o.sort]||sortMap.data_documento,dir=String(o.dir||"desc").toLowerCase()==="asc"?"ASC":"DESC";
    const limit=[10,25,50,100].includes(Number(o.limit))?Number(o.limit):25,page=Math.max(1,Number(o.page)||1);
    const sql=`SELECT d.id,d.data_documento,d.numero,d.status,d.beneficiario,d.criado_em,d.finalizado_em,d.finalizado_por,COUNT(dop.id)::int registros,COALESCE(SUM(dop.quantidade),0) quantidade_doada,COALESCE(SUM(dop.quantidade*dop.valor_unitario),0) valor_doado FROM documentos_operacao d JOIN doacoes_produtos dop ON dop.documento_id=d.id AND d.tipo=$1 ${cond} GROUP BY d.id ORDER BY ${sort} ${dir},d.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    const rows=await pool.query(sql,[...params,limit,(page-1)*limit]);
    const count=await pool.query(`SELECT COUNT(*)::int documentos,COALESCE(SUM(x.registros),0)::int registros,COALESCE(SUM(x.quantidade_doada),0) quantidade_doada,COALESCE(SUM(x.valor_doado),0) valor_doado FROM (SELECT d.id,COUNT(dop.id)::int registros,COALESCE(SUM(dop.quantidade),0) quantidade_doada,COALESCE(SUM(dop.quantidade*dop.valor_unitario),0) valor_doado FROM documentos_operacao d JOIN doacoes_produtos dop ON dop.documento_id=d.id AND d.tipo=$1 ${cond} GROUP BY d.id)x`,params);
    const total=Number(count.rows[0]?.documentos||0);
    return {documentos:rows.rows.map(r=>({id:String(r.id),dataDocumento:r.data_documento,numero:Number(r.numero),documento:numeroDocumentoFormatado("DOACAO",r.numero),status:r.status,beneficiario:r.beneficiario||"",registros:Number(r.registros||0),quantidadeDoada:Number(r.quantidade_doada||0),valorDoado:Number(r.valor_doado||0),finalizadoEm:r.finalizado_em,finalizadoPor:r.finalizado_por||""})),resumo:{documentos:total,registros:Number(count.rows[0]?.registros||0),quantidadeDoada:Number(count.rows[0]?.quantidade_doada||0),valorDoado:Number(count.rows[0]?.valor_doado||0)},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))};
}

const DOCUMENTOS_RECUPERACAO_DIR = path.join(__dirname, "documentos_recuperacao");
const DOCUMENTOS_DOACAO_DIR = path.join(__dirname, "documentos_doacoes");

async function gerarESalvarDocumentoDiarioRecuperacao(dataDocumento,documentoId=null){
    await garantirTabelasRecuperacaoDoacao();const data=normalizarDataOperacao(dataDocumento);if(!data)throw new Error("Data do documento diário inválida.");
    const doc=documentoId?await documentoOperacaoPorId("RECUPERACAO",documentoId):await documentoOperacaoPorData("RECUPERACAO",data);if(!doc)return null;
    const resultado=await pool.query(`SELECT r.id,r.codigo,r.produto,r.fornecedor,r.quantidade,r.quantidade_recuperada,r.valor_unitario,r.observacao,r.usuario_lancamento,r.criado_em FROM recuperacoes_produtos r WHERE r.documento_id=$1 ORDER BY r.criado_em ASC,r.id ASC`,[String(doc.id)]);if(!resultado.rowCount)return null;
    const arquivo=gerarPdfDocumentoOperacao(resultado.rows,data,doc,"RECUPERACAO");await fs.promises.mkdir(DOCUMENTOS_RECUPERACAO_DIR,{recursive:true});const caminho=path.join(DOCUMENTOS_RECUPERACAO_DIR,`documento_recuperacao_${doc.numero}_${data}.pdf`);await fs.promises.writeFile(caminho,arquivo);return {...documentoResumo(doc),caminho,arquivo,registros:resultado.rowCount};
}

async function gerarESalvarDocumentoDiarioDoacao(dataDocumento,documentoId=null){
    await garantirTabelasRecuperacaoDoacao();const data=normalizarDataOperacao(dataDocumento);if(!data)throw new Error("Data do documento de doação inválida.");
    const doc=documentoId?await documentoOperacaoPorId("DOACAO",documentoId):await documentoOperacaoPorData("DOACAO",data);if(!doc)return null;
    const resultado=await pool.query(`SELECT d.id,d.codigo,d.produto,d.fornecedor,d.quantidade,d.valor_unitario,d.beneficiario,d.data_doacao,d.observacao,d.usuario_lancamento,d.criado_em FROM doacoes_produtos d WHERE d.documento_id=$1 ORDER BY d.criado_em ASC,d.id ASC`,[String(doc.id)]);if(!resultado.rowCount)return null;
    const arquivo=gerarPdfDocumentoOperacao(resultado.rows,data,doc,"DOACAO");await fs.promises.mkdir(DOCUMENTOS_DOACAO_DIR,{recursive:true});const caminho=path.join(DOCUMENTOS_DOACAO_DIR,`documento_doacao_${doc.numero}_${data}.pdf`);await fs.promises.writeFile(caminho,arquivo);return {...documentoResumo(doc),caminho,arquivo,registros:resultado.rowCount};
}

function gerarPdfDocumentoOperacao(registros,dataDocumento,doc,tipo){
    // V25: documento A4 vertical, seguindo a referência de movimentação de estoque.
    const W=595,H=842;
    const recuperacao=tipo==="RECUPERACAO";
    const titulo=recuperacao?"DOCUMENTO DE RECUPERAÇÃO":"DOCUMENTO DE DOAÇÃO";
    const agrupados=[];
    const mapa=new Map();
    for(const r of registros){
        const chave=String(r.codigo||r.produto||"").trim().toLowerCase();
        const existente=mapa.get(chave);
        if(existente){
            existente.quantidade+=Number(r.quantidade||0);
            existente.observacoes=[existente.observacoes,r.observacao].filter(Boolean).join(" | ");
        }else{
            const item={...r,quantidade:Number(r.quantidade||0),observacoes:String(r.observacao||"")};
            mapa.set(chave,item);agrupados.push(item);
        }
    }
    const totalQtd=agrupados.reduce((s,r)=>s+Number(r.quantidade||0),0);
    const totalValor=agrupados.reduce((s,r)=>s+Number(r.quantidade||0)*Number(r.valor_unitario||0),0);
    const margem=34,tabelaW=W-(margem*2);
    const colunas=[["Código",78],["Código barra",82],["Descrição",250],["Quantidade",75],["Valor total",tabelaW-78-82-250-75]];
    const pages=[];let ops=[];let y=0;
    function text(x,y,size,value,bold=false){ops.push(`BT /${bold?"F2":"F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);}
    function line(x1,y1,x2,y2){ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);}
    function rect(x,y,w,h,fill=false){if(fill)ops.push("0.92 g");ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill?"f":"S"}`);if(fill)ops.push("0 g");}
    function header(){
        ops=[];
        text(margem,H-38,14,"CONTROLE DE AVARIAS",true);
        text(margem,H-52,8,titulo,true);
        text(W-170,H-38,8,`Data: ${dataSomenteLocal(dataDocumento)}`);
        text(W-170,H-52,8,`Hora: ${(dataHoraLocal(doc.criado_em).split(" ")[1]||"-")}`);
        line(margem,H-62,W-margem,H-62);
        text(margem,H-80,7,"Unidade: 001");
        text(margem,H-94,7,`Data do movimento: ${dataSomenteLocal(dataDocumento)}`);
        text(margem,H-108,7,`Tipo do movimento: ${recuperacao?"RECUPERAÇÃO DE PRODUTOS":"DOAÇÃO DE PRODUTOS"}`);
        const fornecedores=[...new Set(agrupados.map(r=>String(r.fornecedor||"").trim()).filter(Boolean))];
        text(margem,H-122,7,`Fornecedor: ${fornecedores.length===1?fornecedores[0]:"Diversos"}`);
        text(margem,H-136,7,`Tipo do documento: ${recuperacao?"RECUPERAÇÃO":"DOAÇÃO"}`);
        text(W-145,H-136,7,`Número do documento: ${Number(doc.numero)||0}`);
        if(!recuperacao) text(margem,H-150,7,`Beneficiário: ${doc.beneficiario||agrupados[0]?.beneficiario||"-"}`);
        y=H-(recuperacao?158:172);
    }
    function tabelaCabecalho(){
        const h=20;rect(margem,y-h,tabelaW,h,true);let x=margem;
        for(const [label,w] of colunas){text(x+3,y-13,6,label,true);x+=w;}
        y-=h;
    }
    function novaPagina(){
        if(ops.length)pages.push(ops);
        header();tabelaCabecalho();
    }
    novaPagina();
    for(const r of agrupados){
        const altura=18;
        if(y-altura<105) novaPagina();
        let x=margem;
        const codigo=r.codigo||"-";
        const valores=[codigo,codigo,r.produto||"-",quantidadeFormatadaPdf(r.quantidade),moedaPdf(Number(r.quantidade||0)*Number(r.valor_unitario||0))];
        for(let i=0;i<colunas.length;i++){
            const w=colunas[i][1];
            text(x+3,y-12,5.6,pdfTrunc(valores[i],i===2?43:(i<2?13:12)));
            x+=w;
        }
        line(margem,y-altura,margem+tabelaW,y-altura);
        y-=altura;
        if(r.observacoes){
            if(y-14<105) novaPagina();
            text(margem+3,y-9,5.2,`Obs.: ${pdfTrunc(r.observacoes,105)}`);
            y-=14;
        }
    }
    if(y<150) novaPagina();
    y-=10;
    rect(margem,y-22,tabelaW,22,true);
    text(margem+4,y-14,7,"TOTAL",true);
    text(margem+350,y-14,7,`Quantidade: ${quantidadeFormatadaPdf(totalQtd)}`,true);
    text(margem+450,y-14,7,`Valor: ${moedaPdf(totalValor)}`,true);
    y-=34;
    const observacoes=agrupados.map(r=>r.observacoes).filter(Boolean).join(" | ");
    if(observacoes){text(margem,y,7,`Observações: ${pdfTrunc(observacoes,100)}`);y-=18;}
    if(!recuperacao){
        if(y<115) novaPagina();
        const largura=210,x1=margem,x2=W-margem-largura,ys=60;
        line(x1,ys,x1+largura,ys);line(x2,ys,x2+largura,ys);
        text(x1+55,ys-14,6,"Responsável pela Doação",true);
        text(x2+76,ys-14,6,"Beneficiário",true);
    }
    pages.push(ops);
    for(let i=0;i<pages.length;i++){
        pages[i].push(`BT /F1 6 Tf 1 0 0 1 ${margem.toFixed(2)} 25 Tm (${pdfEscape(`Documento ${numeroDocumentoFormatado(doc.tipo,doc.numero)} - Controle de Avarias`)}) Tj ET`);
        pages[i].push(`BT /F1 6 Tf 1 0 0 1 ${(W-85).toFixed(2)} 25 Tm (${pdfEscape(`Página ${i+1} / ${pages.length}`)}) Tj ET`);
    }
    const objs=[],add=o=>(objs.push(o),objs.length),catalog=add('<< /Type /Catalog /Pages 2 0 R >>'),pagesObj=add('PLACEHOLDER'),font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),kids=[];
    for(const op of pages){const stream=op.join('\n')+'\n',content=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}endstream`),pg=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${content} 0 R >>`);kids.push(pg);}
    objs[pagesObj-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let pdf='%PDF-1.4\n';const offsets=[];
    for(let i=0;i<objs.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'latin1');pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
    const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf,'latin1');
}

app.get("/api/recuperacoes", exigirUsuario, async (req,res)=>{try{return res.json(await consultarRecuperacoes(req.query,true));}catch(erro){console.error(erro);return res.status(500).json({erro:"Erro ao carregar recuperações."});}});
app.get("/api/doacoes", exigirUsuario, async (req,res)=>{try{return res.json(await consultarDoacoes(req.query,true));}catch(erro){console.error(erro);return res.status(500).json({erro:"Erro ao carregar doações."});}});

app.post("/api/recuperacoes/documento/abrir", exigirUsuario, async (req,res)=>{try{const data=normalizarDataOperacao(req.body.data)||hojeServidor();const doc=await obterOuCriarDocumentoOperacao("RECUPERACAO",data);return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao abrir documento de recuperação."});}});
app.post("/api/doacoes/documento/abrir", exigirUsuario, async (req,res)=>{try{const data=normalizarDataOperacao(req.body.data)||hojeServidor();const doc=await obterOuCriarDocumentoOperacao("DOACAO",data);return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao abrir documento de doação."});}});
app.get("/api/recuperacoes/documento/info", exigirUsuario, async (req,res)=>{try{const doc=await documentoOperacaoPorId("RECUPERACAO",req.query.id);if(!doc)return res.status(404).json({erro:"Documento de recuperação não encontrado."});return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao consultar documento de recuperação."});}});
app.get("/api/doacoes/documento/info", exigirUsuario, async (req,res)=>{try{const doc=await documentoOperacaoPorId("DOACAO",req.query.id);if(!doc)return res.status(404).json({erro:"Documento de doação não encontrado."});return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao consultar documento de doação."});}});
app.get("/api/recuperacoes/documento", exigirUsuario, async (req,res)=>{try{const id=String(req.query.id||"").trim(),data=normalizarDataOperacao(req.query.data),documento=id?await gerarESalvarDocumentoDiarioRecuperacao(data||hojeServidor(),id):await gerarESalvarDocumentoDiarioRecuperacao(data);if(!documento)return res.status(404).json({erro:"Documento de recuperação não encontrado ou sem produtos."});const dataArquivo=String(documento.dataDocumento).slice(0,10);res.setHeader("Content-Disposition",`inline; filename="${numeroDocumentoFormatado("RECUPERACAO",documento.numero)}_${dataArquivo}.pdf"`);res.setHeader("Content-Type","application/pdf");return res.send(documento.arquivo);}catch(e){console.error("Erro ao gerar documento diário de recuperação:",e);return res.status(500).json({erro:"Erro ao gerar o documento diário de recuperação."});}});
app.get("/api/doacoes/documento", exigirUsuario, async (req,res)=>{try{const id=String(req.query.id||"").trim(),data=normalizarDataOperacao(req.query.data),documento=id?await gerarESalvarDocumentoDiarioDoacao(data||hojeServidor(),id):await gerarESalvarDocumentoDiarioDoacao(data);if(!documento)return res.status(404).json({erro:"Documento de doação não encontrado ou sem produtos."});const dataArquivo=String(documento.dataDocumento).slice(0,10);res.setHeader("Content-Disposition",`inline; filename="${numeroDocumentoFormatado("DOACAO",documento.numero)}_${dataArquivo}.pdf"`);res.setHeader("Content-Type","application/pdf");return res.send(documento.arquivo);}catch(e){console.error("Erro ao gerar documento diário de doação:",e);return res.status(500).json({erro:"Erro ao gerar o documento diário de doação."});}});

app.get("/api/recuperacoes/documentos", exigirUsuario, async (req,res)=>{try{return res.json(await consultarDocumentosRecuperacao(req.query,true));}catch(erro){console.error(erro);return res.status(500).json({erro:"Erro ao carregar documentos de recuperações."});}});
app.get("/api/doacoes/documentos", exigirUsuario, async (req,res)=>{try{return res.json(await consultarDocumentosDoacao(req.query,true));}catch(erro){console.error(erro);return res.status(500).json({erro:"Erro ao carregar documentos de doações."});}});

app.post("/api/recuperacoes", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const codigo=String(req.body.codigo||"").trim(),quantidade=Number(req.body.quantidade);if(!codigo){const e=new Error("Código do produto não informado.");e.status=400;throw e;}if(!Number.isFinite(quantidade)||quantidade<=0){const e=new Error("Quantidade inválida.");e.status=400;throw e;}const produto=await client.query(`SELECT codigo,descricao,fornecedor,codigo_fornecedor,categoria,valor_custo FROM produtos WHERE ativo=TRUE AND (codigo=$1 OR (length($1)=13 AND lpad(codigo,13,'0')=$1)) ORDER BY CASE WHEN codigo=$1 THEN 0 ELSE 1 END LIMIT 1`,[codigo]);if(!produto.rowCount){const e=new Error(`Produto não encontrado para o código ${codigo}.`);e.status=404;throw e;}const p=produto.rows[0],valorUnitario=Number(p.valor_custo);if(!Number.isFinite(valorUnitario)||valorUnitario<=0){const e=new Error(`O produto ${codigo} foi encontrado, mas está sem valor de custo válido.`);e.status=422;throw e;}const data=hojeServidor(),doc=await obterOuCriarDocumentoOperacao("RECUPERACAO",data,client),id=String(req.body.id||crypto.randomUUID());const resultado=await client.query(`INSERT INTO recuperacoes_produtos (id,codigo,produto,fornecedor,codigo_fornecedor,categoria,quantidade,quantidade_recuperada,valor_unitario,setor,observacao,usuario_lancamento,documento_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,NULL,$9,$10,$11) RETURNING *`,[id,p.codigo||codigo,p.descricao||"",p.fornecedor||"",p.codigo_fornecedor||"",p.categoria||classificarCategoriaProduto(p.descricao),quantidade,valorUnitario,String(req.body.observacao||"").trim(),req.usuarioAtual.usuario,doc.id]);await client.query("COMMIT");const item=resultado.rows[0];let documentoGerado=false;try{documentoGerado=!!(await gerarESalvarDocumentoDiarioRecuperacao(data,doc.id));}catch(e){console.error(e);}await registrarAuditoria({acao:"CRIAR",entidade:"RECUPERACAO",registroId:id,usuario:req.usuarioAtual.usuario,depois:{codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade)},detalhes:`Recuperação registrada no documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)}.`});emitirEventoSistema("recuperacoes-atualizadas",{acao:"criada",id});return res.status(201).json({id,codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade),valorUnitario:Number(item.valor_unitario),valorRecuperado:Number(item.quantidade)*Number(item.valor_unitario),usuarioLancamento:item.usuario_lancamento||req.usuarioAtual.usuario,criadoEm:item.criado_em,documento:numeroDocumentoFormatado("RECUPERACAO",doc.numero),documentoId:String(doc.id),documentoStatus:doc.status,documentoGerado});}catch(erro){try{await client.query("ROLLBACK");}catch{}console.error("Erro ao cadastrar recuperação:",erro);return res.status(erro.status||500).json({erro:erro.message||"Erro ao cadastrar recuperação."});}finally{client.release();}});

app.post("/api/recuperacoes/documento/finalizar", exigirUsuario, async (req,res)=>{try{await garantirTabelasRecuperacaoDoacao();const data=normalizarDataOperacao(req.body.data)||hojeServidor(),documentoId=String(req.body.documentoId||"").trim();let doc=documentoId?await documentoOperacaoPorId("RECUPERACAO",documentoId):await documentoOperacaoPorData("RECUPERACAO",data);if(!doc)return res.status(404).json({erro:"Nenhum documento de recuperação encontrado."});if(doc.status==="FINALIZADO")return res.status(409).json({erro:`O documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)} já está finalizado.`});const qtd=await pool.query(`SELECT COUNT(*)::int itens FROM recuperacoes_produtos WHERE documento_id=$1`,[String(doc.id)]);if(!Number(qtd.rows[0]?.itens||0))return res.status(400).json({erro:"Não é possível finalizar um documento sem produtos lançados."});const atual=await pool.query(`UPDATE documentos_operacao SET status='FINALIZADO',finalizado_em=CURRENT_TIMESTAMP,finalizado_por=$2 WHERE id=$1 AND tipo='RECUPERACAO' AND status='ABERTO' RETURNING *`,[String(doc.id),req.usuarioAtual.usuario]);doc=atual.rows[0]||doc;await gerarESalvarDocumentoDiarioRecuperacao(data,doc.id);if(atual.rowCount)await registrarAuditoria({acao:"FINALIZAR",entidade:"DOCUMENTO_RECUPERACAO",registroId:String(doc.id),usuario:req.usuarioAtual.usuario,depois:documentoResumo(doc),detalhes:`Documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)} finalizado.`});return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao finalizar documento de recuperação."});}});


app.put("/api/recuperacoes/:id", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const id=String(req.params.id),quantidade=Number(req.body.quantidade);if(!Number.isFinite(quantidade)||quantidade<=0){const e=new Error("Quantidade inválida.");e.status=400;throw e;}const q=await client.query(`SELECT * FROM recuperacoes_produtos WHERE id=$1 LIMIT 1 FOR UPDATE`,[id]);if(!q.rowCount){const e=new Error("Recuperação não encontrada.");e.status=404;throw e;}const antes=q.rows[0];const dq=await client.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo='RECUPERACAO' LIMIT 1 FOR UPDATE`,[String(antes.documento_id)]);const doc=dq.rows[0];if(doc?.status==="FINALIZADO"){const e=new Error(`O documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)} está finalizado e não pode ser alterado.`);e.status=409;throw e;}const observacao=String(req.body.observacao||"").trim();const r=await client.query(`UPDATE recuperacoes_produtos SET quantidade=$2, quantidade_recuperada=$2, observacao=$3 WHERE id=$1 RETURNING *`,[id,quantidade,observacao]);const item=r.rows[0];await client.query("COMMIT");let documentoAtualizado=false;try{documentoAtualizado=!!(await gerarESalvarDocumentoDiarioRecuperacao(doc.data_documento,doc.id));}catch(e){console.error(e);}await registrarAuditoria({acao:"EDITAR",entidade:"RECUPERACAO",registroId:id,usuario:req.usuarioAtual.usuario,antes,depois:item,detalhes:`Recuperação ${item.produto||""} editada no documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)}.`});emitirEventoSistema("recuperacoes-atualizadas",{acao:"editada",id});return res.json({ok:true,id,codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade),valorUnitario:Number(item.valor_unitario),valorRecuperado:Number(item.quantidade)*Number(item.valor_unitario),observacao:item.observacao||"",documentoAtualizado,documento:numeroDocumentoFormatado("RECUPERACAO",doc.numero),documentoId:String(doc.id)});}catch(e){try{await client.query("ROLLBACK");}catch{}console.error("Erro ao editar recuperação:",e);return res.status(e.status||500).json({erro:e.message||"Erro ao editar recuperação."});}finally{client.release();}});
app.delete("/api/recuperacoes/:id", exigirUsuario, async (req,res)=>{try{await garantirTabelasRecuperacaoDoacao();const antes=await pool.query(`SELECT * FROM recuperacoes_produtos WHERE id=$1 LIMIT 1`,[String(req.params.id)]);if(!antes.rowCount)return res.status(404).json({erro:"Recuperação não encontrada."});const registro=antes.rows[0],doc=await documentoOperacaoPorId("RECUPERACAO",registro.documento_id);if(doc?.status==="FINALIZADO")return res.status(409).json({erro:`O documento ${numeroDocumentoFormatado("RECUPERACAO",doc.numero)} está finalizado e não pode ser alterado.`});await pool.query(`DELETE FROM recuperacoes_produtos WHERE id=$1`,[String(req.params.id)]);let documentoAtualizado=false;try{const d=doc?await gerarESalvarDocumentoDiarioRecuperacao(doc.data_documento,doc.id):null;documentoAtualizado=!!d;}catch(e){console.error(e);}await registrarAuditoria({acao:"EXCLUIR",entidade:"RECUPERACAO",registroId:String(req.params.id),usuario:req.usuarioAtual.usuario,antes:registro,depois:{removido:true},detalhes:`Recuperação ${registro.produto||""} excluída.`});emitirEventoSistema("recuperacoes-atualizadas",{acao:"excluida",id:String(req.params.id)});return res.json({ok:true,documentoAtualizado,documento:doc?documentoResumo(doc):null});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao excluir recuperação."});}});

app.post("/api/doacoes", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const codigo=String(req.body.codigo||"").trim(),quantidade=Number(req.body.quantidade),beneficiario=String(req.body.beneficiario||"").trim(),data=normalizarDataOperacao(req.body.dataDoacao)||hojeServidor();if(!codigo){const e=new Error("Código do produto não informado.");e.status=400;throw e;}if(!Number.isFinite(quantidade)||quantidade<=0){const e=new Error("Quantidade inválida.");e.status=400;throw e;}if(!beneficiario){const e=new Error("Informe a instituição ou beneficiário.");e.status=400;throw e;}const produto=await client.query(`SELECT codigo,descricao,fornecedor,codigo_fornecedor,categoria,valor_custo FROM produtos WHERE ativo=TRUE AND (codigo=$1 OR (length($1)=13 AND lpad(codigo,13,'0')=$1)) ORDER BY CASE WHEN codigo=$1 THEN 0 ELSE 1 END LIMIT 1`,[codigo]);if(!produto.rowCount){const e=new Error(`Produto não encontrado para o código ${codigo}.`);e.status=404;throw e;}const p=produto.rows[0],valorUnitario=Number(p.valor_custo);if(!Number.isFinite(valorUnitario)||valorUnitario<=0){const e=new Error(`O produto ${codigo} foi encontrado, mas está sem valor de custo válido.`);e.status=422;throw e;}const doc=await obterOuCriarDocumentoOperacao("DOACAO",data,client);const docLock=await client.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo='DOACAO' FOR UPDATE`,[String(doc.id)]);const documentoAtual=docLock.rows[0]||doc;const beneficiarioDocumento=String(documentoAtual.beneficiario||"").trim();if(beneficiarioDocumento && beneficiarioDocumento.localeCompare(beneficiario,"pt-BR",{sensitivity:"base"})!==0){const e=new Error(`O documento ${numeroDocumentoFormatado("DOACAO",documentoAtual.numero)} já está vinculado ao beneficiário ${beneficiarioDocumento}.`);e.status=409;throw e;}if(!beneficiarioDocumento){await client.query(`UPDATE documentos_operacao SET beneficiario=$2 WHERE id=$1 AND tipo='DOACAO'`,[String(documentoAtual.id),beneficiario]);documentoAtual.beneficiario=beneficiario;}const id=String(req.body.id||crypto.randomUUID());const resultado=await client.query(`INSERT INTO doacoes_produtos (id,codigo,produto,fornecedor,codigo_fornecedor,categoria,quantidade,valor_unitario,beneficiario,data_doacao,observacao,usuario_lancamento,documento_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13) RETURNING *`,[id,p.codigo||codigo,p.descricao||"",p.fornecedor||"",p.codigo_fornecedor||"",p.categoria||classificarCategoriaProduto(p.descricao),quantidade,valorUnitario,documentoAtual.beneficiario||beneficiario,data,String(req.body.observacao||"").trim(),req.usuarioAtual.usuario,documentoAtual.id]);await client.query("COMMIT");const item=resultado.rows[0];let documentoGerado=false;try{documentoGerado=!!(await gerarESalvarDocumentoDiarioDoacao(data,documentoAtual.id));}catch(e){console.error(e);}await registrarAuditoria({acao:"CRIAR",entidade:"DOACAO",registroId:id,usuario:req.usuarioAtual.usuario,depois:{codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade),beneficiario:item.beneficiario},detalhes:`Doação registrada no documento ${numeroDocumentoFormatado("DOACAO",documentoAtual.numero)}.`});emitirEventoSistema("doacoes-atualizadas",{acao:"criada",id});return res.status(201).json({id,codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade),valorTotal:Number(item.quantidade)*Number(item.valor_unitario),beneficiario:item.beneficiario,dataDoacao:item.data_doacao,documento:numeroDocumentoFormatado("DOACAO",documentoAtual.numero),documentoId:String(documentoAtual.id),documentoStatus:documentoAtual.status,documentoGerado});}catch(e){try{await client.query("ROLLBACK");}catch{}console.error(e);return res.status(e.status||500).json({erro:e.message||"Erro ao registrar doação."});}finally{client.release();}});

app.post("/api/doacoes/documento/finalizar", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const data=normalizarDataOperacao(req.body.data)||hojeServidor(),documentoId=String(req.body.documentoId||"").trim();let doc=documentoId?await documentoOperacaoPorId("DOACAO",documentoId):await documentoOperacaoPorData("DOACAO",data);if(!doc){await client.query("ROLLBACK");return res.status(404).json({erro:"Nenhum documento de doação encontrado."});}const bloqueado=await client.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo='DOACAO' FOR UPDATE`,[String(doc.id)]);doc=bloqueado.rows[0]||doc;if(doc.status==="FINALIZADO"){await client.query("ROLLBACK");return res.status(409).json({erro:`O documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} já está finalizado.`});}const qtd=await client.query(`SELECT COUNT(*)::int itens FROM doacoes_produtos WHERE documento_id=$1`,[String(doc.id)]);if(!Number(qtd.rows[0]?.itens||0)){await client.query("ROLLBACK");return res.status(400).json({erro:"Não é possível finalizar um documento sem produtos lançados."});}const atual=await client.query(`UPDATE documentos_operacao SET status='FINALIZADO',finalizado_em=CURRENT_TIMESTAMP,finalizado_por=$2 WHERE id=$1 AND tipo='DOACAO' AND status='ABERTO' RETURNING *`,[String(doc.id),req.usuarioAtual.usuario]);if(!atual.rowCount){await client.query("ROLLBACK");return res.status(409).json({erro:`O documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} não está mais aberto.`});}doc=atual.rows[0];await client.query("COMMIT");await gerarESalvarDocumentoDiarioDoacao(data,doc.id);await registrarAuditoria({acao:"FINALIZAR",entidade:"DOCUMENTO_DOACAO",registroId:String(doc.id),usuario:req.usuarioAtual.usuario,depois:documentoResumo(doc),detalhes:`Documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} finalizado.`});return res.json({ok:true,documento:documentoResumo(doc)});}catch(e){try{await client.query("ROLLBACK");}catch{}console.error(e);return res.status(500).json({erro:"Erro ao finalizar documento de doação."});}finally{client.release();}});


app.put("/api/doacoes/:id", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const id=String(req.params.id),quantidade=Number(req.body.quantidade);if(!Number.isFinite(quantidade)||quantidade<=0){const e=new Error("Quantidade inválida.");e.status=400;throw e;}const q=await client.query(`SELECT * FROM doacoes_produtos WHERE id=$1 LIMIT 1 FOR UPDATE`,[id]);if(!q.rowCount){const e=new Error("Doação não encontrada.");e.status=404;throw e;}const antes=q.rows[0];const dq=await client.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo='DOACAO' LIMIT 1 FOR UPDATE`,[String(antes.documento_id)]);const doc=dq.rows[0];if(doc?.status==="FINALIZADO"){const e=new Error(`O documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} está finalizado e não pode ser alterado.`);e.status=409;throw e;}const observacao=String(req.body.observacao||"").trim();const r=await client.query(`UPDATE doacoes_produtos SET quantidade=$2, observacao=$3 WHERE id=$1 RETURNING *`,[id,quantidade,observacao]);const item=r.rows[0];await client.query("COMMIT");let documentoAtualizado=false;try{documentoAtualizado=!!(await gerarESalvarDocumentoDiarioDoacao(doc.data_documento,doc.id));}catch(e){console.error(e);}await registrarAuditoria({acao:"EDITAR",entidade:"DOACAO",registroId:id,usuario:req.usuarioAtual.usuario,antes,depois:item,detalhes:`Doação ${item.produto||""} editada no documento ${numeroDocumentoFormatado("DOACAO",doc.numero)}.`});emitirEventoSistema("doacoes-atualizadas",{acao:"editada",id});return res.json({ok:true,id,codigo:item.codigo,produto:item.produto,quantidade:Number(item.quantidade),valorTotal:Number(item.quantidade)*Number(item.valor_unitario),beneficiario:item.beneficiario||"",observacao:item.observacao||"",documentoAtualizado,documento:numeroDocumentoFormatado("DOACAO",doc.numero),documentoId:String(doc.id)});}catch(e){try{await client.query("ROLLBACK");}catch{}console.error("Erro ao editar doação:",e);return res.status(e.status||500).json({erro:e.message||"Erro ao editar doação."});}finally{client.release();}});

app.patch("/api/doacoes/documento/:id", exigirUsuario, async (req,res)=>{const client=await pool.connect();try{await client.query("BEGIN");await garantirTabelasRecuperacaoDoacao();const id=String(req.params.id),beneficiario=String(req.body.beneficiario||"").trim();if(!beneficiario){const e=new Error("Informe a instituição ou beneficiário.");e.status=400;throw e;}const q=await client.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo='DOACAO' LIMIT 1 FOR UPDATE`,[id]);if(!q.rowCount){const e=new Error("Documento de doação não encontrado.");e.status=404;throw e;}const antes=q.rows[0];if(antes.status==="FINALIZADO"){const e=new Error(`O documento ${numeroDocumentoFormatado("DOACAO",antes.numero)} está finalizado e não pode ser alterado.`);e.status=409;throw e;}const r=await client.query(`UPDATE documentos_operacao SET beneficiario=$2 WHERE id=$1 AND tipo='DOACAO' RETURNING *`,[id,beneficiario]);const doc=r.rows[0];await client.query(`UPDATE doacoes_produtos SET beneficiario=$2 WHERE documento_id=$1`,[id,beneficiario]);await client.query("COMMIT");let documentoAtualizado=false;try{documentoAtualizado=!!(await gerarESalvarDocumentoDiarioDoacao(doc.data_documento,doc.id));}catch(e){console.error(e);}await registrarAuditoria({acao:"EDITAR",entidade:"DOCUMENTO_DOACAO",registroId:id,usuario:req.usuarioAtual.usuario,antes,depois:doc,detalhes:`Beneficiário do documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} alterado.`});emitirEventoSistema("doacoes-atualizadas",{acao:"documento-editado",id});return res.json({ok:true,documento:documentoResumo(doc),documentoAtualizado});}catch(e){try{await client.query("ROLLBACK");}catch{}console.error("Erro ao editar beneficiário da doação:",e);return res.status(e.status||500).json({erro:e.message||"Erro ao editar beneficiário da doação."});}finally{client.release();}});
app.delete("/api/doacoes/:id", exigirUsuario, async (req,res)=>{try{await garantirTabelasRecuperacaoDoacao();const antes=await pool.query(`SELECT * FROM doacoes_produtos WHERE id=$1 LIMIT 1`,[String(req.params.id)]);if(!antes.rowCount)return res.status(404).json({erro:"Doação não encontrada."});const registro=antes.rows[0],doc=await documentoOperacaoPorId("DOACAO",registro.documento_id);if(doc?.status==="FINALIZADO")return res.status(409).json({erro:`O documento ${numeroDocumentoFormatado("DOACAO",doc.numero)} está finalizado e não pode ser alterado.`});await pool.query(`DELETE FROM doacoes_produtos WHERE id=$1`,[String(req.params.id)]);let documentoAtualizado=false;try{const d=doc?await gerarESalvarDocumentoDiarioDoacao(doc.data_documento,doc.id):null;documentoAtualizado=!!d;}catch(e){console.error(e);}await registrarAuditoria({acao:"EXCLUIR",entidade:"DOACAO",registroId:String(req.params.id),usuario:req.usuarioAtual.usuario,antes:registro,depois:{removido:true},detalhes:`Doação ${registro.produto||""} excluída.`});emitirEventoSistema("doacoes-atualizadas",{acao:"excluida",id:String(req.params.id)});return res.json({ok:true,documentoAtualizado,documento:doc?documentoResumo(doc):null});}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao excluir doação."});}});

async function excluirDocumentoOperacao(tipo,id,usuario){
    await garantirTabelasRecuperacaoDoacao();
    const tipoNormalizado=tipo==="DOACAO"?"DOACAO":"RECUPERACAO";
    const tabelaItens=tipoNormalizado==="DOACAO"?"doacoes_produtos":"recuperacoes_produtos";
    const pastaDocumentos=tipoNormalizado==="DOACAO"?DOCUMENTOS_DOACAO_DIR:DOCUMENTOS_RECUPERACAO_DIR;
    const cliente=await pool.connect();
    let doc=null, resumo=null, arquivoNome="";
    try{
        await cliente.query("BEGIN");
        const encontrado=await cliente.query(`SELECT * FROM documentos_operacao WHERE id=$1 AND tipo=$2 FOR UPDATE`,[String(id),tipoNormalizado]);
        if(!encontrado.rowCount){const erro=new Error("Documento não encontrado no histórico.");erro.status=404;throw erro;}
        doc=encontrado.rows[0];
        const itens=await cliente.query(`SELECT COUNT(*)::int AS itens,COALESCE(SUM(quantidade),0) AS quantidade,COALESCE(SUM(quantidade*valor_unitario),0) AS valor FROM ${tabelaItens} WHERE documento_id=$1`,[String(doc.id)]);
        resumo={documento:numeroDocumentoFormatado(tipoNormalizado,doc.numero),dataDocumento:doc.data_documento,status:doc.status,itens:Number(itens.rows[0]?.itens||0),quantidade:Number(itens.rows[0]?.quantidade||0),valor:Number(itens.rows[0]?.valor||0)};
        await cliente.query(`DELETE FROM ${tabelaItens} WHERE documento_id=$1`,[String(doc.id)]);
        await cliente.query(`DELETE FROM documentos_operacao WHERE id=$1 AND tipo=$2`,[String(doc.id),tipoNormalizado]);
        await cliente.query("COMMIT");
        arquivoNome=tipoNormalizado==="DOACAO"?`documento_doacao_${doc.numero}_${String(doc.data_documento).slice(0,10)}.pdf`:`documento_recuperacao_${doc.numero}_${String(doc.data_documento).slice(0,10)}.pdf`;
        try{await fs.promises.unlink(path.join(pastaDocumentos,arquivoNome));}catch(e){if(e?.code!=="ENOENT")console.warn("Não foi possível remover o PDF do documento excluído:",e.message);}
        await registrarAuditoria({acao:"EXCLUIR_DOCUMENTO",entidade:`DOCUMENTO_${tipoNormalizado}`,registroId:String(doc.id),usuario:usuario||"sistema",antes:resumo,depois:{removido:true},detalhes:`Documento ${resumo.documento} excluído do histórico.`});
        emitirEventoSistema(tipoNormalizado==="DOACAO"?"doacoes-atualizadas":"recuperacoes-atualizadas",{acao:"documento-excluido",id:String(doc.id)});
        return resumo;
    }catch(e){try{await cliente.query("ROLLBACK");}catch{}throw e;}finally{cliente.release();}
}

app.delete("/api/recuperacoes/documentos/:id", exigirAdmin, async (req,res)=>{
    try{
        const resumo=await excluirDocumentoOperacao("RECUPERACAO",req.params.id,req.usuarioAdmin?.usuario||"admin");
        return res.json({ok:true,documento:resumo.documento});
    }catch(e){console.error("Erro ao excluir documento de recuperação:",e);return res.status(e.status||500).json({erro:e.message||"Erro ao excluir o documento de recuperação."});}
});

app.delete("/api/doacoes/documentos/:id", exigirAdmin, async (req,res)=>{
    try{
        const resumo=await excluirDocumentoOperacao("DOACAO",req.params.id,req.usuarioAdmin?.usuario||"admin");
        return res.json({ok:true,documento:resumo.documento});
    }catch(e){console.error("Erro ao excluir documento de doação:",e);return res.status(e.status||500).json({erro:e.message||"Erro ao excluir o documento de doação."});}
});

app.post("/api/recuperacoes/exportar-xlsx", exigirUsuario, async (req,res)=>{try{const dados=await consultarRecuperacoes(req.body.filtros||{},false);const linhas=dados.registros.map(r=>({Data:dataHoraLocal(r.criadoEm),Codigo:r.codigo,Produto:r.produto,Fornecedor:r.fornecedor,Categoria:r.categoria,Quantidade:r.quantidade,"Valor recuperado":r.valorRecuperado,Responsável:r.usuarioLancamento,Observação:r.observacao}));const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(linhas);XLSX.utils.book_append_sheet(wb,ws,"Recuperações");const arquivo=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition",`attachment; filename="recuperacoes_${hojeServidor()}.xlsx"`);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");return res.send(arquivo);}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao gerar Excel das recuperações."});}});
app.post("/api/doacoes/exportar-xlsx", exigirUsuario, async (req,res)=>{try{const dados=await consultarDoacoes(req.body.filtros||{},false);const linhas=dados.registros.map(r=>({Data:dataSomenteLocal(r.dataDoacao),Codigo:r.codigo,Produto:r.produto,Fornecedor:r.fornecedor,Categoria:r.categoria,Quantidade:r.quantidade,"Valor unitário":r.valorUnitario,"Valor total":r.valorTotal,Beneficiário:r.beneficiario,Responsável:r.usuarioLancamento,Observação:r.observacao}));const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(linhas);XLSX.utils.book_append_sheet(wb,ws,"Doações");const arquivo=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});res.setHeader("Content-Disposition",`attachment; filename="doacoes_${hojeServidor()}.xlsx"`);res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");return res.send(arquivo);}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao gerar Excel das doações."});}});

function dataHoraLocal(v){if(!v)return "-";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat("pt-BR",{timeZone:TIME_ZONE_SISTEMA,dateStyle:"short",timeStyle:"short"}).format(d);}
function dataSomenteLocal(v){if(!v)return "-";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString("pt-BR");}
function quantidadeFormatadaPdf(v){return Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:3});}
function moedaPdf(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function gerarPdfListaModulo(titulo,subtitulo,registros,tipo){const W=842,H=595,rowH=17;const columns=tipo==="recuperacoes"?[["Data",62,12],["Código",70,13],["Produto",180,30],["Fornecedor",115,20],["Qtd.",55,10],["Valor",75,12],["Respons.",95,16]]:[["Data",55,10],["Produto",145,26],["Fornecedor",100,18],["Qtd.",45,9],["Valor",65,12],["Beneficiário",155,28],["Respons.",90,16]];const totalW=columns.reduce((a,c)=>a+c[1],0),x0=(W-totalW)/2,pages=[];let ops=[],y=515;const header=()=>{ops.push(`BT /F1 13 Tf 20 565 Td (${pdfEscape(titulo)}) Tj ET`);ops.push(`BT /F1 6 Tf 20 551 Td (${pdfEscape(subtitulo)}) Tj ET`);ops.push("0.90 g");ops.push(`${x0} 528 ${totalW} 18 re f`);ops.push("0 g BT /F1 5.5 Tf");let x=x0;for(const [l,w] of columns){ops.push(`1 0 0 1 ${x+2} 534 Tm (${pdfEscape(l)}) Tj`);x+=w;}ops.push("ET");y=515;};const newPage=()=>{if(ops.length)pages.push(ops);ops=[];header();};newPage();for(const r of registros){if(y<32)newPage();const vals=tipo==="recuperacoes"?[dataHoraLocal(r.criadoEm),r.codigo,r.produto,r.fornecedor,quantidadeFormatadaPdf(r.quantidade),moedaPdf(r.valorRecuperado),r.usuarioLancamento||"-"]:[dataSomenteLocal(r.dataDoacao),r.produto,r.fornecedor,quantidadeFormatadaPdf(r.quantidade),moedaPdf(r.valorTotal),r.beneficiario,r.usuarioLancamento||"-"];let x=x0;ops.push("BT /F1 5.2 Tf");for(let i=0;i<columns.length;i++){const w=columns[i][1],max=columns[i][2];ops.push(`1 0 0 1 ${x+2} ${y} Tm (${pdfEscape(pdfTrunc(vals[i],max))}) Tj`);x+=w;}ops.push("ET");y-=rowH;}pages.push(ops);const objs=[],add=o=>(objs.push(o),objs.length),catalog=add('<< /Type /Catalog /Pages 2 0 R >>'),pagesObj=add('PLACEHOLDER'),fontObj=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),kids=[];for(const op of pages){const stream=op.join('\n')+'\n',content=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}endstream`),pg=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${content} 0 R >>`);kids.push(pg);}objs[pagesObj-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;let pdf='%PDF-1.4\n';const offsets=[];for(let i=0;i<objs.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'latin1');pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf,'latin1');}

app.post("/api/recuperacoes/exportar-pdf", exigirUsuario, async (req,res)=>{try{const dados=await consultarRecuperacoes(req.body.filtros||{},false);const arquivo=gerarPdfListaModulo("Controle de Avarias - Recuperações","Recuperações filtradas",dados.registros,"recuperacoes");res.setHeader("Content-Disposition",`attachment; filename="recuperacoes_${hojeServidor()}.pdf"`);res.setHeader("Content-Type","application/pdf");return res.send(arquivo);}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao gerar PDF das recuperações."});}});
app.post("/api/doacoes/exportar-pdf", exigirUsuario, async (req,res)=>{try{const dados=await consultarDoacoes(req.body.filtros||{},false);const arquivo=gerarPdfListaModulo("Controle de Avarias - Doações","Doações filtradas",dados.registros,"doacoes");res.setHeader("Content-Disposition",`attachment; filename="doacoes_${hojeServidor()}.pdf"`);res.setHeader("Content-Type","application/pdf");return res.send(arquivo);}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao gerar PDF das doações."});}});

app.get("/api/doacoes/:id/comprovante", exigirUsuario, async (req,res)=>{try{await garantirTabelasRecuperacaoDoacao();const resultado=await pool.query(`SELECT * FROM doacoes_produtos WHERE id=$1`,[String(req.params.id)]);if(!resultado.rowCount)return res.status(404).json({erro:"Doação não encontrada."});const d=resultado.rows[0];const linhas=[`COMPROVANTE DE DOAÇÃO`,`Data: ${dataSomenteLocal(d.data_doacao)}`,`Instituição / beneficiário: ${d.beneficiario}`,`Produto: ${d.produto}`,`Código: ${d.codigo||"-"}`,`Fornecedor: ${d.fornecedor||"-"}`,`Quantidade: ${quantidadeFormatadaPdf(d.quantidade)}`,`Valor estimado: ${moedaPdf(Number(d.quantidade)*Number(d.valor_unitario))}`,`Responsável: ${d.usuario_lancamento||"-"}`,`Observação: ${d.observacao||"-"}`];const W=595,H=842,objs=[],add=o=>(objs.push(o),objs.length),catalog=add('<< /Type /Catalog /Pages 2 0 R >>'),pagesObj=add('PLACEHOLDER'),fontObj=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');let ops=['BT /F1 17 Tf 50 780 Td ('+pdfEscape(linhas[0])+') Tj ET'],y=745;for(const linha of linhas.slice(1)){ops.push(`BT /F1 10 Tf 50 ${y} Td (${pdfEscape(linha)}) Tj ET`);y-=32;}ops.push(`BT /F1 8 Tf 50 80 Td (${pdfEscape("Documento gerado pelo Controle de Avarias")}) Tj ET`);const stream=ops.join('\n')+'\n',content=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}endstream`),pg=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${content} 0 R >>`);objs[pagesObj-1]=`<< /Type /Pages /Kids [${pg} 0 R] /Count 1 >>`;let pdf='%PDF-1.4\n';const offsets=[];for(let i=0;i<objs.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'latin1');pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf,'latin1');pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;res.setHeader("Content-Disposition",`inline; filename="comprovante_doacao_${String(d.id).slice(0,8)}.pdf"`);res.setHeader("Content-Type","application/pdf");return res.send(Buffer.from(pdf,'latin1'));}catch(e){console.error(e);return res.status(500).json({erro:"Erro ao gerar comprovante de doação."});}});

/* =========================================================
   AVARIAS - LISTAR
========================================================= */

app.get(
    "/api/avarias",

    
    exigirUsuario,
    async (req, res) => {

        try {

            const statusFiltro =
                String(
                    req.query.status || ""
                ).trim();


            const valores = [];

            let where = "";


            if (
                statusFiltro &&
                statusFiltro !== "Todos"
            ) {

                valores.push(
                    statusFiltro
                );


                where =
                    `WHERE a.status = $1`;

            }


            const resultado =
                await pool.query(
                    `
                    SELECT
                        a.id,
                        a.codigo,
                        a.produto,
                        a.fornecedor,
                        p.codigo_fornecedor,
                        COALESCE(NULLIF(a.categoria, ''), p.categoria, 'Mercearia') AS categoria,
                        a.quantidade,
                        a.valor_unitario,
                        a.setor,
                        a.tipo,
                        a.caixa,
                        a.status,
                        a.observacao,
                        a.usuario_lancamento,
                        a.criado_em,
                        a.movimentado_em

                    FROM avarias a

                    LEFT JOIN produtos p
                        ON p.codigo = a.codigo

                    ${where}

                    ORDER BY
                        a.criado_em DESC
                    `,
                    valores
                );


            const avarias =
                resultado.rows.map(
                    item => ({

                        id:
                            item.id,

                        codigo:
                            item.codigo || "",

                        produto:
                            item.produto,

                        fornecedor:
                            item.fornecedor || "",

                        codigoFornecedor:
                            item.codigo_fornecedor || "",

                        quantidade:
                            Number(
                                item.quantidade
                            ),

                        valorUnitario:
                            Number(
                                item.valor_unitario
                            ),

                        setor:
                            item.setor || "",

                        tipo:
                            item.tipo || "",

                        caixa:
                            item.caixa || "",

                        status:
                            item.status,

                        observacao:
                            item.observacao || "",

                        usuarioLancamento:
                            item.usuario_lancamento || "",

                        categoria:
                            item.categoria || "Mercearia",

                        criadoEm:
                            item.criado_em,

                        movimentadoEm:
                            item.movimentado_em

                    })
                );


            return res.json(
                avarias
            );


        } catch (erro) {

            console.error(
                "Erro ao listar avarias:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao listar avarias."
                });

        }

    }
);


/* =========================================================
   V20.1 - RECUPERAÇÃO E FALLBACK DO HISTÓRICO
========================================================= */

function mapearRegistroHistorico(item) {
    return {
        id: item.id,
        codigo: item.codigo || "",
        produto: item.produto || "",
        fornecedor: item.fornecedor || "",
        codigoFornecedor: item.codigo_fornecedor || item.codigoFornecedor || "",
        quantidade: Number(item.quantidade) || 0,
        valorUnitario: Number(item.valor_unitario ?? item.valorUnitario) || 0,
        setor: item.setor || "",
        tipo: item.tipo || "",
        caixa: item.caixa || "",
        status: item.status || "Pendente",
        observacao: item.observacao || "",
        usuarioLancamento: item.usuario_lancamento || item.usuarioLancamento || "",
        categoria: item.categoria || "Mercearia",
        criadoEm: item.criado_em ?? item.criadoEm ?? null,
        movimentadoEm: item.movimentado_em ?? item.movimentadoEm ?? null
    };
}

async function lerHistoricoAtivoDoBackup() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        const arquivos = (await fs.promises.readdir(BACKUP_DIR))
            .filter(nome => /^controle_avarias_.*\.json$/i.test(nome))
            .sort()
            .reverse();

        for (const nome of arquivos) {
            try {
                const caminho = path.join(BACKUP_DIR, nome);
                const snapshot = JSON.parse(await fs.promises.readFile(caminho, "utf8"));
                const lista = Array.isArray(snapshot?.tabelas?.historico_avarias)
                    ? snapshot.tabelas.historico_avarias
                    : [];
                const ativos = lista
                    .filter(item => item && item.removido !== true)
                    .map(mapearRegistroHistorico)
                    .sort((a,b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
                if (ativos.length) return ativos;
            } catch (_) {}
        }
    } catch (_) {}
    return [];
}

async function recuperarHistoricoDoBackup() {
    try {
        const dir = BACKUP_DIR;
        if (!fs.existsSync(dir)) return { importados: 0, arquivo: "" };

        const arquivos = (await fs.promises.readdir(dir))
            .filter(nome => /^controle_avarias_.*\.json$/i.test(nome))
            .sort()
            .reverse();

        if (!arquivos.length) return { importados: 0, arquivo: "" };

        let importados = 0;
        let arquivoUsado = "";

        for (const nome of arquivos) {
            const caminho = path.join(dir, nome);
            let snapshot;
            try {
                snapshot = JSON.parse(await fs.promises.readFile(caminho, "utf8"));
            } catch (_) {
                continue;
            }

            const lista = Array.isArray(snapshot?.tabelas?.historico_avarias)
                ? snapshot.tabelas.historico_avarias
                : [];

            if (!lista.length) continue;

            for (const item of lista) {
                const id = String(item?.id || "").trim();
                if (!id) continue;

                try {
                    const resultado = await pool.query(`
                        INSERT INTO historico_avarias
                        (
                            id, codigo, produto, fornecedor, codigo_fornecedor,
                            quantidade, valor_unitario, setor, tipo, caixa, status,
                            observacao, usuario_lancamento, criado_em, movimentado_em,
                            historico_criado_em, removido, categoria
                        )
                        VALUES
                        (
                            $1, $2, $3, $4, $5,
                            $6, $7, $8, $9, $10, $11,
                            $12, $13, COALESCE($14, CURRENT_TIMESTAMP), $15,
                            COALESCE($16, CURRENT_TIMESTAMP), COALESCE($17, FALSE), $18
                        )
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        id,
                        String(item.codigo || ""),
                        String(item.produto || ""),
                        String(item.fornecedor || ""),
                        item.codigo_fornecedor == null ? null : String(item.codigo_fornecedor),
                        Number(item.quantidade) || 0,
                        Number(item.valor_unitario) || 0,
                        String(item.setor || ""),
                        String(item.tipo || ""),
                        String(item.caixa || ""),
                        String(item.status || "Pendente"),
                        String(item.observacao || ""),
                        String(item.usuario_lancamento || ""),
                        item.criado_em || null,
                        item.movimentado_em || null,
                        item.historico_criado_em || null,
                        item.removido === true,
                        String(item.categoria || "Mercearia")
                    ]);
                    importados += Number(resultado.rowCount || 0);
                } catch (erro) {
                    // Um registro incompatível não deve impedir a recuperação dos demais.
                    console.warn(`V20.0: não foi possível recuperar o histórico ${id}: ${erro.message}`);
                }
            }

            arquivoUsado = nome;
            break;
        }

        if (importados > 0) {
            console.log(`V20.0: ${importados} registro(s) de histórico recuperado(s) de ${arquivoUsado}.`);
        }

        return { importados, arquivo: arquivoUsado };
    } catch (erro) {
        console.warn("V20.0: recuperação do backup do histórico não executada:", erro.message);
        return { importados: 0, arquivo: "" };
    }
}

async function consultarAvariasComoHistoricoFallback() {
    const resultado = await pool.query(`
        SELECT
            a.id,
            a.codigo,
            a.produto,
            a.fornecedor,
            p.codigo_fornecedor,
            COALESCE(NULLIF(a.categoria, ''), p.categoria, 'Mercearia') AS categoria,
            a.quantidade,
            a.valor_unitario,
            a.setor,
            a.tipo,
            a.caixa,
            a.status,
            a.observacao,
            a.usuario_lancamento,
            a.criado_em,
            a.movimentado_em
        FROM avarias a
        LEFT JOIN produtos p ON p.codigo = a.codigo
        ORDER BY a.criado_em DESC
    `);

    return resultado.rows.map(item => ({
        id: item.id,
        codigo: item.codigo || "",
        produto: item.produto || "",
        fornecedor: item.fornecedor || "",
        codigoFornecedor: item.codigo_fornecedor || "",
        quantidade: Number(item.quantidade) || 0,
        valorUnitario: Number(item.valor_unitario) || 0,
        setor: item.setor || "",
        tipo: item.tipo || "",
        caixa: item.caixa || "",
        status: item.status || "Pendente",
        observacao: item.observacao || "",
        usuarioLancamento: item.usuario_lancamento || "",
        categoria: item.categoria || "Mercearia",
        criadoEm: item.criado_em,
        movimentadoEm: item.movimentado_em
    }));
}

/* =========================================================
   HISTÓRICO - LISTAR
========================================================= */

app.get(
    "/api/historico-avarias",
    exigirUsuario,
    async (req, res) => {
        try {
            // 1) Garante a estrutura, mas nunca deixa uma falha de migração
            // impedir que os registros atuais sejam exibidos.
            try {
                await garantirTabelaHistorico();
            } catch (erroEstrutura) {
                console.warn("V20.0: estrutura do histórico não pôde ser preparada:", erroEstrutura.message);
            }

            // 2) Sincroniza as avarias atuais. Falha aqui não interrompe a leitura.
            try {
                await sincronizarHistoricoExistente();
            } catch (erroSync) {
                console.warn("V20.0: sincronização do histórico falhou; usando leitura resiliente:", erroSync.message);
            }

            let historico = [];

            // 3) Fonte principal: histórico permanente.
            try {
                const resultado = await pool.query(`
                    SELECT
                        id, codigo, produto, fornecedor, codigo_fornecedor,
                        categoria, quantidade, valor_unitario, setor, tipo, caixa,
                        status, observacao, usuario_lancamento, criado_em, movimentado_em
                    FROM historico_avarias
                    WHERE COALESCE(removido, FALSE) = FALSE
                    ORDER BY criado_em DESC
                `);
                historico = resultado.rows.map(mapearRegistroHistorico);
            } catch (erroLeituraHistorico) {
                console.warn("V20.0: leitura do histórico falhou:", erroLeituraHistorico.message);
            }

            // 4) Complementa com avarias que ainda não possuem projeção histórica.
            // IMPORTANTE: se um ID já existe em historico_avarias e foi marcado
            // como removido, ele NÃO pode voltar pelo fallback de avarias.
            // Isso evita o efeito "apaga e volta" na aba Baixas.
            try {
                const atuais = await consultarAvariasComoHistoricoFallback();
                const idsAtivos = new Set(historico.map(item => String(item.id)));
                const removidosResult = await pool.query(`
                    SELECT id
                    FROM historico_avarias
                    WHERE COALESCE(removido, FALSE) = TRUE
                `);
                const idsRemovidos = new Set(
                    removidosResult.rows.map(item => String(item.id))
                );

                for (const item of atuais) {
                    const id = String(item.id);
                    if (!idsAtivos.has(id) && !idsRemovidos.has(id)) {
                        historico.push(item);
                    }
                }
            } catch (erroAvarias) {
                console.warn("V21.0: leitura de avarias para complemento falhou:", erroAvarias.message);
            }

            // 5) Se o banco não tiver dados disponíveis, usa o último snapshot
            // local como último recurso. Isso NÃO substitui nem apaga o banco.
            let fonte = historico.length ? "banco_unificado" : "backup_local";
            if (!historico.length) {
                historico = await lerHistoricoAtivoDoBackup();
                try {
                    const removidosResult = await pool.query(`
                        SELECT id
                        FROM historico_avarias
                        WHERE COALESCE(removido, FALSE) = TRUE
                    `);
                    const idsRemovidos = new Set(
                        removidosResult.rows.map(item => String(item.id))
                    );
                    historico = historico.filter(item => !idsRemovidos.has(String(item.id)));
                } catch (_) {}
            }

            historico.sort((a,b) => new Date(b.movimentadoEm || b.criadoEm || 0) - new Date(a.movimentadoEm || a.criadoEm || 0));
            res.setHeader("X-Historico-Fonte", fonte);
            res.setHeader("X-Historico-Total", String(historico.length));
            return res.json(historico);
        } catch (erro) {
            console.error("V20.0: erro geral ao listar histórico:", erro);
            try {
                const fallback = await lerHistoricoAtivoDoBackup();
                if (fallback.length) {
                    res.setHeader("X-Historico-Fonte", "backup_local_erro");
                    res.setHeader("X-Historico-Total", String(fallback.length));
                    return res.json(fallback);
                }
            } catch (_) {}
            return res.status(500).json({
                erro: "Erro ao carregar o histórico.",
                detalhe: erro.message,
                versao: APP_VERSION
            });
        }
    }
);

/* =========================================================
   DIAGNÓSTICO DO HISTÓRICO - ADMIN
========================================================= */
app.get(
    "/api/diagnostico-historico",
    exigirAdmin,
    async (req, res) => {
        try {
            const banco = await pool.query(`SELECT current_database() AS banco, current_user AS usuario`);
            const avarias = await pool.query(`SELECT COUNT(*)::int AS total FROM avarias`);
            const historico = await pool.query(`SELECT COUNT(*)::int AS total FROM historico_avarias`);
            const ativos = await pool.query(`SELECT COUNT(*)::int AS total FROM historico_avarias WHERE COALESCE(removido, FALSE) = FALSE`);
            const removidos = await pool.query(`SELECT COUNT(*)::int AS total FROM historico_avarias WHERE COALESCE(removido, FALSE) = TRUE`);
            const colunas = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'historico_avarias'
                ORDER BY ordinal_position
            `);
            return res.json({
                ok: true,
                versao: APP_VERSION,
                banco: banco.rows[0],
                avarias: Number(avarias.rows[0].total),
                historicoTotal: Number(historico.rows[0].total),
                historicoAtivo: Number(ativos.rows[0].total),
                historicoRemovido: Number(removidos.rows[0].total),
                colunas: colunas.rows
            });
        } catch (erro) {
            console.error("V20.0: diagnóstico do histórico falhou:", erro);
            return res.status(500).json({ ok: false, erro: erro.message, versao: APP_VERSION });
        }
    }
);


/* =========================================================
   HISTÓRICO - EXCLUSÃO DEFINITIVA DA VISUALIZAÇÃO
========================================================= */

app.delete(
    "/api/historico-avarias/:id",
    exigirAdmin,

    async (req, res) => {

        try {

            await garantirTabelaHistorico();


            const registroAntes = await pool.query(`
                SELECT *
                FROM historico_avarias
                WHERE id = $1
                  AND removido = FALSE
                LIMIT 1
            `, [req.params.id]);

            if (registroAntes.rowCount === 0) {
                return res.status(404).json({ erro: "Registro do histórico não encontrado." });
            }

            const resultado =
                await pool.query(
                    `
                    UPDATE historico_avarias

                    SET removido = TRUE

                    WHERE id = $1
                    AND removido = FALSE

                    RETURNING id
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                resultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Registro do histórico não encontrado."
                    });

            }


            await registrarAuditoria({
                acao: "excluido",
                entidade: "historico_avarias",
                registroId: req.params.id,
                usuario: req.usuarioAdmin.usuario,
                antes: registroAntes.rows[0],
                depois: { removido: true },
                detalhes: `Baixa ${registroAntes.rows[0].produto || ""} excluída do histórico.`
            });

            emitirEventoSistema(
                "historico-atualizado",
                {
                    acao:
                        "excluido",
                    id:
                        req.params.id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao excluir do histórico:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao excluir do histórico."
                });

        }

    }
);


/* =========================================================
   BAIXAS - EDITAR REGISTRO (ADMIN)
   Edita o lançamento exibido no histórico de baixas e mantém
   a avaria original sincronizada quando ela ainda existir.
========================================================= */

app.put(
    "/api/historico-avarias/:id",
    exigirAdmin,
    async (req, res) => {

        const cliente = await pool.connect();

        try {

            await garantirTabelaHistorico();

            const id = String(req.params.id || "").trim();
            const codigo = String(req.body.codigo || "").trim();
            const produto = String(req.body.produto || "").trim();
            const fornecedor = String(req.body.fornecedor || "").trim();
            const codigoFornecedor = String(req.body.codigoFornecedor || "").trim();
            const categoria = String(req.body.categoria || "").trim();
            const quantidade = Number(req.body.quantidade);
            const valorUnitario = Number(req.body.valorUnitario);
            const setor = String(req.body.setor || "Loja").trim() || "Loja";
            const tipo = String(req.body.tipo || "").trim();
            const caixa = String(req.body.caixa || "").trim();
            const observacao = String(req.body.observacao || "").trim();
            const dataBaixa = String(req.body.dataBaixa || "").trim();

            const categoriasPermitidas = [
                "Frios",
                "Mercearia",
                "Padaria",
                "Limpeza",
                "Bebidas"
            ];

            if (!id) {
                return res.status(400).json({ erro: "Registro não informado." });
            }

            if (!codigo || !produto) {
                return res.status(400).json({ erro: "Código e produto são obrigatórios." });
            }

            if (!Number.isFinite(quantidade) || quantidade <= 0) {
                return res.status(400).json({ erro: "Informe uma quantidade válida." });
            }

            if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
                return res.status(400).json({ erro: "Informe um valor de custo válido." });
            }

            if (!categoriasPermitidas.includes(categoria)) {
                return res.status(400).json({ erro: "Categoria inválida." });
            }

            let dataBaixaSql = null;
            if (dataBaixa) {
                const dataTeste = new Date(dataBaixa);
                if (Number.isNaN(dataTeste.getTime())) {
                    return res.status(400).json({ erro: "Data da baixa inválida." });
                }
                dataBaixaSql = dataBaixa;
            }

            const existente = await cliente.query(`
                SELECT *
                FROM historico_avarias
                WHERE id = $1
                  AND removido = FALSE
                LIMIT 1
            `, [id]);

            if (existente.rowCount === 0) {
                return res.status(404).json({ erro: "Registro da baixa não encontrado." });
            }

            await cliente.query("BEGIN");

            // Se a categoria foi alterada, ela continua sendo permanente para o produto.
            if (codigo) {
                const produtoBase = await cliente.query(`
                    SELECT codigo
                    FROM produtos
                    WHERE ativo = TRUE
                      AND (
                          codigo = $1
                          OR (length($1) = 13 AND lpad(codigo, 13, '0') = $1)
                      )
                    ORDER BY CASE WHEN codigo = $1 THEN 0 ELSE 1 END
                    LIMIT 1
                `, [codigo]);

                if (produtoBase.rowCount > 0) {
                    const codigoBanco = produtoBase.rows[0].codigo;
                    await cliente.query(`
                        UPDATE produtos
                        SET categoria = $1,
                            atualizado_em = CURRENT_TIMESTAMP
                        WHERE codigo = $2
                    `, [categoria, codigoBanco]);

                    await cliente.query(`
                        UPDATE avarias
                        SET categoria = $1
                        WHERE codigo = $2
                    `, [categoria, codigoBanco]);

                    await cliente.query(`
                        UPDATE historico_avarias
                        SET categoria = $1
                        WHERE codigo = $2
                          AND removido = FALSE
                    `, [categoria, codigoBanco]);
                }
            }

            // Atualiza o lançamento histórico que está sendo editado.
            const historicoAtualizado = await cliente.query(`
                UPDATE historico_avarias
                SET
                    codigo = $1,
                    produto = $2,
                    fornecedor = $3,
                    codigo_fornecedor = $4,
                    categoria = $5,
                    quantidade = $6,
                    valor_unitario = $7,
                    setor = $8,
                    tipo = $9,
                    caixa = $10,
                    observacao = $11,
                    movimentado_em = COALESCE($12::timestamptz, movimentado_em)
                WHERE id = $13
                  AND removido = FALSE
                RETURNING
                    id,
                    codigo,
                    produto,
                    fornecedor,
                    codigo_fornecedor,
                    categoria,
                    quantidade,
                    valor_unitario,
                    setor,
                    tipo,
                    caixa,
                    status,
                    observacao,
                    usuario_lancamento,
                    criado_em,
                    movimentado_em
            `, [
                codigo,
                produto,
                fornecedor,
                codigoFornecedor,
                categoria,
                quantidade,
                valorUnitario,
                setor,
                tipo,
                caixa,
                observacao,
                dataBaixaSql,
                id
            ]);

            // Mantém a avaria correspondente sincronizada, se ainda existir.
            const avariaAtualizada = await cliente.query(`
                UPDATE avarias
                SET
                    codigo = $1,
                    produto = $2,
                    fornecedor = $3,
                    categoria = $4,
                    quantidade = $5,
                    valor_unitario = $6,
                    setor = $7,
                    tipo = $8,
                    caixa = $9,
                    observacao = $10,
                    movimentado_em = COALESCE($11::timestamptz, movimentado_em)
                WHERE id = $12
                RETURNING id
            `, [
                codigo,
                produto,
                fornecedor,
                categoria,
                quantidade,
                valorUnitario,
                setor,
                tipo,
                caixa,
                observacao,
                dataBaixaSql,
                id
            ]);

            await cliente.query("COMMIT");

            const item = historicoAtualizado.rows[0];

            await registrarAuditoria({
                acao: "editado",
                entidade: "historico_avarias",
                registroId: id,
                usuario: req.usuarioAdmin.usuario,
                antes: existente.rows[0],
                depois: item,
                detalhes: `Baixa ${item.produto || ""} editada pelo administrador.`
            });
            const resposta = {
                id: item.id,
                codigo: item.codigo || "",
                produto: item.produto || "",
                fornecedor: item.fornecedor || "",
                codigoFornecedor: item.codigo_fornecedor || "",
                categoria: item.categoria || "Mercearia",
                quantidade: Number(item.quantidade) || 0,
                valorUnitario: Number(item.valor_unitario) || 0,
                setor: item.setor || "",
                tipo: item.tipo || "",
                caixa: item.caixa || "",
                status: item.status || "Baixa",
                observacao: item.observacao || "",
                usuarioLancamento: item.usuario_lancamento || "",
                criadoEm: item.criado_em,
                movimentadoEm: item.movimentado_em
            };

            emitirEventoSistema("historico-atualizado", {
                acao: "editado",
                id,
                usuario: req.usuarioAdmin.usuario
            });

            if (avariaAtualizada.rowCount > 0) {
                emitirEventoSistema("avarias-atualizadas", {
                    acao: "editada",
                    id,
                    usuario: req.usuarioAdmin.usuario
                });
            }

            emitirEventoSistema("produtos-atualizados", {
                acao: "registro-baixa-editado",
                codigo,
                categoria,
                usuario: req.usuarioAdmin.usuario
            });

            return res.json(resposta);

        } catch (erro) {

            try {
                await cliente.query("ROLLBACK");
            } catch {}

            console.error(
                "Erro ao editar baixa:",
                erro
            );

            return res.status(500).json({
                erro: "Erro ao editar o registro da baixa."
            });

        } finally {
            cliente.release();
        }

    }
);


/* =========================================================
   AVARIAS - CADASTRAR
========================================================= */

app.post(
    "/api/avarias",
    exigirUsuario,

    async (req, res) => {

        try {

            const codigo =
                String(
                    req.body.codigo || ""
                ).trim();


            const quantidade =
                Number(
                    req.body.quantidade
                );

            const categoriasPermitidas = [
                "Frios",
                "Mercearia",
                "Padaria",
                "Limpeza",
                "Bebidas"
            ];

            const categoriaInformada = String(req.body.categoria || "").trim();

            if (categoriaInformada && !categoriasPermitidas.includes(categoriaInformada)) {
                return res.status(400).json({ erro: "Categoria inválida." });
            }


            if (!codigo) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Código do produto não informado."
                    });

            }


            const produtoResultado =
                await pool.query(
                    `
                    SELECT
                        codigo,
                        descricao,
                        fornecedor,
                        categoria,
                        valor_custo

                    FROM produtos

                    WHERE ativo = TRUE
                    AND (
                        codigo = $1
                        OR (
                            length($1) = 13
                            AND lpad(codigo, 13, '0') = $1
                        )
                    )

                    ORDER BY
                        CASE
                            WHEN codigo = $1 THEN 0
                            ELSE 1
                        END

                    LIMIT 1
                    `,
                    [codigo]
                );


            if (produtoResultado.rowCount === 0) {

                return res
                    .status(404)
                    .json({
                        erro:
                            `Produto não encontrado para o código ${codigo}.`
                    });

            }


            const produtoBanco =
                produtoResultado.rows[0];


            const produto =
                produtoBanco.descricao || "";


            const valorUnitario =
                Number(
                    produtoBanco.valor_custo
                );


            if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {

                return res
                    .status(422)
                    .json({
                        erro:
                            `O produto ${codigo} foi encontrado, mas está sem valor de custo válido.`
                    });

            }


            if (
                !Number.isFinite(
                    quantidade
                ) ||
                quantidade <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Quantidade inválida."
                    });

            }


            if (
                !Number.isFinite(
                    valorUnitario
                ) ||
                valorUnitario < 0
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Valor inválido."
                    });

            }


            const id =
                req.body.id ||
                crypto.randomUUID();


            const resultado =
                await pool.query(
                    `
                    INSERT INTO avarias
                    (
                        id,
                        codigo,
                        produto,
                        fornecedor,
                        categoria,
                        quantidade,
                        valor_unitario,
                        setor,
                        tipo,
                        caixa,
                        usuario_lancamento,
                        status,
                        observacao,
                        criado_em,
                        movimentado_em
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13,
                        COALESCE($14, CURRENT_TIMESTAMP),
                        $15
                    )

                    RETURNING *
                    `,
                    [
                        id,

                        produtoBanco.codigo ||
                            codigo,

                        produto,

                        produtoBanco.fornecedor || "",

                        categoriaInformada || produtoBanco.categoria || classificarCategoriaProduto(produtoBanco.descricao),

                        quantidade,

                        valorUnitario,

                        String(
                            req.body.setor || "Loja"
                        ).trim() || "Loja",

                        String(
                            req.body.tipo || ""
                        ).trim(),

                        "",

                        req.usuarioAtual.usuario,

                        "Pendente",

                        String(
                            req.body.observacao || ""
                        ).trim(),

                        req.body.criadoEm || null,

                        req.body.movimentadoEm || null
                    ]
                );


            const item =
                resultado.rows[0];


            try {
                await sincronizarHistoricoAvaria(item.id);
            } catch (erroHistorico) {
                console.error("V20.0: avaria salva, mas a sincronização do histórico falhou:", erroHistorico);
            }


            emitirEventoSistema(
                "avarias-atualizadas",
                {
                    acao:
                        "criada",
                    id:
                        item.id
                }
            );


            emitirEventoSistema(
                "historico-atualizado",
                {
                    acao:
                        "sincronizado",
                    id:
                        item.id
                }
            );


            return res
                .status(201)
                .json({

                    id:
                        item.id,

                    codigo:
                        item.codigo || "",

                    produto:
                        item.produto,

                    fornecedor:
                        item.fornecedor || "",

                    categoria:
                        item.categoria || categoriaInformada || "Mercearia",

                    quantidade:
                        Number(
                            item.quantidade
                        ),

                    valorUnitario:
                        Number(
                            item.valor_unitario
                        ),

                    setor:
                        item.setor || "",

                    tipo:
                        item.tipo || "",

                    caixa:
                        item.caixa || "",

                    usuarioLancamento:
                        item.usuario_lancamento || req.usuarioAtual.usuario,

                    status:
                        item.status,

                    observacao:
                        item.observacao || "",

                    criadoEm:
                        item.criado_em,

                    movimentadoEm:
                        item.movimentado_em

                });


        } catch (erro) {

            console.error(
                "Erro ao cadastrar avaria:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao cadastrar avaria."
                });

        }

    }
);


/* =========================================================
   AVARIAS - ALTERAR STATUS
========================================================= */

app.patch(
    "/api/avarias/:id/status",

    
    exigirUsuario,
    async (req, res) => {

        try {

            const id =
                req.params.id;


            const status =
                String(
                    req.body.status || ""
                ).trim();


            const permitidos =
                [
                    "Pendente",
                    "Baixa",
                    "Devolução"
                ];


            if (
                !permitidos.includes(
                    status
                )
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Status inválido."
                    });

            }


            const resultado =
                await pool.query(
                    `
                    UPDATE avarias

                    SET
                        status = $1,

                        movimentado_em =
                            CASE
                                WHEN $1 = 'Pendente'
                                    THEN NULL
                                ELSE CURRENT_TIMESTAMP
                            END

                    WHERE id = $2

                    RETURNING *
                    `,
                    [
                        status,
                        id
                    ]
                );


            if (
                resultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Avaria não encontrada."
                    });

            }


            await sincronizarHistoricoAvaria(
                id
            );


            emitirEventoSistema(
                "avarias-atualizadas",
                {
                    acao:
                        "status",
                    id,
                    status
                }
            );


            emitirEventoSistema(
                "historico-atualizado",
                {
                    acao:
                        "sincronizado",
                    id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao atualizar avaria:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao atualizar avaria."
                });

        }

    }
);


/* =========================================================
   AVARIAS - EXCLUIR
========================================================= */

app.delete(
    "/api/avarias/:id",
   
    exigirUsuario,
     exigirUsuario,

    async (req, res) => {

        try {

            const registroAntes = await pool.query(`
                SELECT *
                FROM avarias
                WHERE id = $1
                LIMIT 1
            `, [req.params.id]);

            if (registroAntes.rowCount === 0) {
                // Exclusão idempotente: o registro pode já ter sido removido da
                // tabela avarias, mas continuar preservado no histórico.
                // Nesse caso, não há nada a apagar da aba Registros.
                const historicoExistente = await pool.query(`
                    SELECT id
                    FROM historico_avarias
                    WHERE id = $1
                    LIMIT 1
                `, [req.params.id]);

                if (historicoExistente.rowCount > 0) {
                    return res.json({
                        ok: true,
                        jaRemovido: true,
                        historicoPreservado: true
                    });
                }

                return res.status(404).json({ erro: "Avaria não encontrada." });
            }

            await sincronizarHistoricoAvaria(
                req.params.id
            );


            const resultado =
                await pool.query(
                    `
                    DELETE FROM avarias

                    WHERE id = $1

                    RETURNING id
                    `,
                    [
                        req.params.id
                    ]
                );


            if (
                resultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Avaria não encontrada."
                    });

            }


            await registrarAuditoria({
                acao: "excluido",
                entidade: "avaria",
                registroId: req.params.id,
                usuario: req.usuarioAtual.usuario,
                antes: registroAntes.rows[0],
                depois: { removidoDaAvaria: true },
                detalhes: `Registro ${registroAntes.rows[0].produto || ""} excluído da aba Registros pelo usuário ${req.usuarioAtual.usuario}.`
            });

            emitirEventoSistema(
                "avarias-atualizadas",
                {
                    acao:
                        "excluida",
                    id:
                        req.params.id
                }
            );


            emitirEventoSistema(
                "historico-atualizado",
                {
                    acao:
                        "preservado",
                    id:
                        req.params.id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao excluir avaria:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao excluir avaria."
                });

        }

    }
);

/* =========================================================
   MIGRAÇÃO DO LOCALSTORAGE PARA POSTGRESQL
========================================================= */

app.post(
    "/api/migracao/localstorage",

    
    exigirAdmin,
    async (req, res) => {

        const cliente =
            await pool.connect();


        try {

            const caixasRecebidas =
                Array.isArray(req.body.caixas)
                    ? req.body.caixas
                    : [];


            const avariasRecebidas =
                Array.isArray(req.body.avarias)
                    ? req.body.avarias
                    : [];


            await cliente.query("BEGIN");


            let caixasNovas = 0;
            let caixasAtualizadas = 0;

            let avariasNovas = 0;
            let avariasAtualizadas = 0;

            let caixasIgnoradas = 0;
            let avariasIgnoradas = 0;


            /* =========================================
               CAIXAS
            ========================================= */

            for (const caixa of caixasRecebidas) {

                const numero =
                    String(
                        caixa.numero || ""
                    ).trim();


                if (!numero) {

                    caixasIgnoradas++;

                    continue;

                }


                const id =
                    String(
                        caixa.id ||
                        crypto.randomUUID()
                    );


                const existente =
                    await cliente.query(
                        `
                        SELECT id

                        FROM caixas

                        WHERE id = $1
                           OR numero = $2

                        LIMIT 1
                        `,
                        [
                            id,
                            numero
                        ]
                    );


                if (existente.rowCount > 0) {

                    await cliente.query(
                        `
                        UPDATE caixas

                        SET
                            numero = $1,
                            local = $2,
                            responsavel = $3

                        WHERE id = $4
                        `,
                        [
                            numero,

                            String(
                                caixa.local || ""
                            ).trim(),

                            String(
                                caixa.responsavel || ""
                            ).trim(),

                            existente.rows[0].id
                        ]
                    );


                    caixasAtualizadas++;

                } else {

                    await cliente.query(
                        `
                        INSERT INTO caixas
                        (
                            id,
                            numero,
                            local,
                            responsavel,
                            criado_em
                        )

                        VALUES
                        (
                            $1,
                            $2,
                            $3,
                            $4,
                            COALESCE(
                                $5,
                                CURRENT_TIMESTAMP
                            )
                        )
                        `,
                        [
                            id,

                            numero,

                            String(
                                caixa.local || ""
                            ).trim(),

                            String(
                                caixa.responsavel || ""
                            ).trim(),

                            caixa.criadoEm || null
                        ]
                    );


                    caixasNovas++;

                }

            }


            /* =========================================
               AVARIAS
            ========================================= */

            for (const avaria of avariasRecebidas) {

                const produto =
                    String(
                        avaria.produto || ""
                    ).trim();


                const quantidade =
                    Number(
                        avaria.quantidade
                    );


                const valorUnitario =
                    Number(
                        avaria.valorUnitario
                    );


                if (
                    !produto ||
                    !Number.isFinite(quantidade) ||
                    quantidade <= 0
                ) {

                    avariasIgnoradas++;

                    continue;

                }


                const id =
                    String(
                        avaria.id ||
                        crypto.randomUUID()
                    );


                let status =
                    String(
                        avaria.status ||
                        "Pendente"
                    ).trim();


                /*
                    Compatibilidade com registros
                    antigos do sistema.
                */

                if (
                    status === "Concluída" ||
                    status === "Concluida"
                ) {

                    status = "Baixa";

                }


                if (
                    ![
                        "Pendente",
                        "Baixa",
                        "Devolução"
                    ].includes(status)
                ) {

                    status = "Pendente";

                }


                const existente =
                    await cliente.query(
                        `
                        SELECT id

                        FROM avarias

                        WHERE id = $1

                        LIMIT 1
                        `,
                        [id]
                    );


                if (existente.rowCount > 0) {

                    await cliente.query(
                        `
                        UPDATE avarias

                        SET
                            codigo = $1,
                            produto = $2,
                            fornecedor = $3,
                            quantidade = $4,
                            valor_unitario = $5,
                            setor = $6,
                            tipo = $7,
                            caixa = $8,
                            status = $9,
                            observacao = $10,
                            criado_em = COALESCE(
                                $11,
                                criado_em
                            ),
                            movimentado_em = $12

                        WHERE id = $13
                        `,
                        [

                            String(
                                avaria.codigo || ""
                            ).trim(),

                            produto,

                            String(
                                avaria.fornecedor || ""
                            ).trim(),

                            quantidade,

                            Number.isFinite(valorUnitario)
                                ? valorUnitario
                                : 0,

                            String(
                                avaria.setor || "Loja"
                            ).trim() || "Loja",

                            String(
                                avaria.tipo || ""
                            ).trim(),

                            String(
                                avaria.caixa || ""
                            ).trim(),

                            status,

                            String(
                                avaria.observacao || ""
                            ).trim(),

                            avaria.criadoEm || null,

                            avaria.movimentadoEm || null,

                            id
                        ]
                    );


                    avariasAtualizadas++;

                } else {

                    await cliente.query(
                        `
                        INSERT INTO avarias
                        (
                            id,
                            codigo,
                            produto,
                            fornecedor,
                            quantidade,
                            valor_unitario,
                            setor,
                            tipo,
                            caixa,
                            status,
                            observacao,
                            criado_em,
                            movimentado_em
                        )

                        VALUES
                        (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7,
                            $8,
                            $9,
                            $10,
                            $11,
                            COALESCE(
                                $12,
                                CURRENT_TIMESTAMP
                            ),
                            $13
                        )
                        `,
                        [

                            id,

                            String(
                                avaria.codigo || ""
                            ).trim(),

                            produto,

                            String(
                                avaria.fornecedor || ""
                            ).trim(),

                            quantidade,

                            Number.isFinite(valorUnitario)
                                ? valorUnitario
                                : 0,

                            String(
                                avaria.setor || "Loja"
                            ).trim() || "Loja",

                            String(
                                avaria.tipo || ""
                            ).trim(),

                            String(
                                avaria.caixa || ""
                            ).trim(),

                            status,

                            String(
                                avaria.observacao || ""
                            ).trim(),

                            avaria.criadoEm || null,

                            avaria.movimentadoEm || null
                        ]
                    );


                    avariasNovas++;

                }

            }


            await cliente.query("COMMIT");


            const totalCaixas =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM caixas
                `);


            const totalAvarias =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM avarias
                `);


            return res.json({

                ok: true,

                caixas: {
                    novas:
                        caixasNovas,

                    atualizadas:
                        caixasAtualizadas,

                    ignoradas:
                        caixasIgnoradas,

                    totalBanco:
                        Number(
                            totalCaixas.rows[0].total
                        )
                },

                avarias: {
                    novas:
                        avariasNovas,

                    atualizadas:
                        avariasAtualizadas,

                    ignoradas:
                        avariasIgnoradas,

                    totalBanco:
                        Number(
                            totalAvarias.rows[0].total
                        )
                }

            });


        } catch (erro) {

            await cliente.query(
                "ROLLBACK"
            );


            console.error(
                "Erro na migração:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao migrar dados."
                });


        } finally {

            cliente.release();

        }

    }
);

/* =========================================================
   USUÁRIOS - ADMINISTRADOR
========================================================= */

app.get(
    "/api/usuarios",
    exigirAdmin,

    async (req, res) => {

        try {

            const resultado =
                await pool.query(`
                    SELECT
                        id,
                        usuario,
                        nome,
                        perfil,
                        ativo,
                        criado_em

                    FROM usuarios

                    ORDER BY
                        CASE
                            WHEN perfil = 'admin'
                                THEN 0
                            ELSE 1
                        END,
                        nome ASC
                `);


            return res.json(
                resultado.rows.map(
                    item => ({

                        id:
                            item.id,

                        usuario:
                            item.usuario,

                        nome:
                            item.nome,

                        perfil:
                            item.perfil,

                        ativo:
                            item.ativo,

                        criadoEm:
                            item.criado_em

                    })
                )
            );


        } catch (erro) {

            console.error(
                "Erro ao listar usuários:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao listar usuários."
                });

        }

    }
);


app.post(
    "/api/usuarios",
    exigirAdmin,

    async (req, res) => {

        try {

            const nome =
                String(
                    req.body.nome || ""
                ).trim();


            const usuario =
                String(
                    req.body.usuario || ""
                )
                .trim()
                .toLowerCase();


            const senha =
                String(
                    req.body.senha || ""
                );


            if (!nome) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Informe o nome do usuário."
                    });

            }


            if (
                !/^[a-z0-9._-]{3,40}$/.test(
                    usuario
                )
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "O usuário deve ter de 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou underline."
                    });

            }


            if (senha.length < 6) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "A senha precisa ter pelo menos 6 caracteres."
                    });

            }


            const senhaHash =
                await bcrypt.hash(
                    senha,
                    12
                );


            const resultado =
                await pool.query(
                    `
                    INSERT INTO usuarios
                    (
                        usuario,
                        senha_hash,
                        nome,
                        perfil,
                        ativo
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        'usuario',
                        TRUE
                    )

                    RETURNING
                        id,
                        usuario,
                        nome,
                        perfil,
                        ativo,
                        criado_em
                    `,
                    [
                        usuario,
                        senhaHash,
                        nome
                    ]
                );


            const item =
                resultado.rows[0];


            emitirEventoSistema(
                "usuarios-atualizados",
                {
                    acao:
                        "criado",
                    id:
                        item.id
                }
            );


            return res
                .status(201)
                .json({

                    id:
                        item.id,

                    usuario:
                        item.usuario,

                    nome:
                        item.nome,

                    perfil:
                        item.perfil,

                    ativo:
                        item.ativo,

                    criadoEm:
                        item.criado_em

                });


        } catch (erro) {

            if (erro.code === "23505") {

                return res
                    .status(409)
                    .json({
                        erro:
                            "Esse nome de usuário já está em uso."
                    });

            }


            console.error(
                "Erro ao criar usuário:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao criar usuário."
                });

        }

    }
);


app.patch(
    "/api/usuarios/:id/status",
    exigirAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const ativo =
                req.body.ativo;


            if (
                !Number.isInteger(id) ||
                typeof ativo !== "boolean"
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Dados inválidos."
                    });

            }


            if (
                id ===
                Number(
                    req.usuarioAdmin.id
                ) &&
                ativo === false
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "O administrador logado não pode desativar o próprio acesso."
                    });

            }


            const resultado =
                await pool.query(
                    `
                    UPDATE usuarios

                    SET ativo = $1

                    WHERE id = $2

                    RETURNING id
                    `,
                    [
                        ativo,
                        id
                    ]
                );


            if (resultado.rowCount === 0) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Usuário não encontrado."
                    });

            }


            emitirEventoSistema(
                "usuarios-atualizados",
                {
                    acao:
                        "status",
                    id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao alterar usuário:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao alterar usuário."
                });

        }

    }
);


app.patch(
    "/api/usuarios/:id/senha",
    exigirAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const senha =
                String(
                    req.body.senha || ""
                );


            if (
                !Number.isInteger(id)
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Usuário inválido."
                    });

            }


            if (senha.length < 6) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "A nova senha precisa ter pelo menos 6 caracteres."
                    });

            }


            const senhaHash =
                await bcrypt.hash(
                    senha,
                    12
                );


            const resultado =
                await pool.query(
                    `
                    UPDATE usuarios

                    SET senha_hash = $1

                    WHERE id = $2

                    RETURNING id
                    `,
                    [
                        senhaHash,
                        id
                    ]
                );


            if (resultado.rowCount === 0) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Usuário não encontrado."
                    });

            }


            emitirEventoSistema(
                "usuarios-atualizados",
                {
                    acao:
                        "senha",
                    id
                }
            );


            return res.json({
                ok: true
            });


        } catch (erro) {

            console.error(
                "Erro ao redefinir senha:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao redefinir senha."
                });

        }

    }
);


/* =========================================================
   USUÁRIOS - EXCLUIR
========================================================= */

app.delete(
    "/api/usuarios/:id",
    exigirAdmin,

    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (!Number.isInteger(id)) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Usuário inválido."
                    });

            }


            if (
                id ===
                Number(
                    req.usuarioAdmin.id
                )
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "O administrador logado não pode excluir o próprio usuário."
                    });

            }


            const usuarioResultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        usuario,
                        nome,
                        perfil

                    FROM usuarios

                    WHERE id = $1

                    LIMIT 1
                    `,
                    [id]
                );


            if (
                usuarioResultado.rowCount === 0
            ) {

                return res
                    .status(404)
                    .json({
                        erro:
                            "Usuário não encontrado."
                    });

            }


            const usuarioAlvo =
                usuarioResultado.rows[0];


            if (
                usuarioAlvo.perfil ===
                "admin"
            ) {

                const outrosAdmins =
                    await pool.query(
                        `
                        SELECT COUNT(*) AS total

                        FROM usuarios

                        WHERE perfil = 'admin'
                        AND id <> $1
                        `,
                        [id]
                    );


                if (
                    Number(
                        outrosAdmins.rows[0]
                            .total
                    ) === 0
                ) {

                    return res
                        .status(400)
                        .json({
                            erro:
                                "Não é possível excluir o único administrador do sistema."
                        });

                }

            }


            await pool.query(
                `
                DELETE FROM usuarios

                WHERE id = $1
                `,
                [id]
            );


            emitirEventoSistema(
                "usuarios-atualizados",
                {
                    acao:
                        "excluido",
                    id
                }
            );


            return res.json({
                ok: true,
                id,
                usuario:
                    usuarioAlvo.usuario
            });


        } catch (erro) {

            console.error(
                "Erro ao excluir usuário:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao excluir usuário."
                });

        }

    }
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/login",

    async (req, res) => {

        try {

            await garantirTabelaUsuarios();


            const usuario =
                String(
                    req.body.usuario || ""
                ).trim();


            const senha =
                String(
                    req.body.senha || ""
                );


            /* =========================
               VALIDAÇÃO
            ========================= */

            if (
                !usuario ||
                !senha
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Preencha usuário e senha."
                    });

            }


            /* =========================
               PROCURAR USUÁRIO
            ========================= */

            const resultado =
                await pool.query(
                    `
                    SELECT
                        id,
                        usuario,
                        senha_hash,
                        nome,
                        perfil,
                        ativo

                    FROM usuarios

                    WHERE usuario = $1

                    LIMIT 1
                    `,
                    [usuario]
                );


            if (
                resultado.rowCount === 0
            ) {

                return res
                    .status(401)
                    .json({
                        erro:
                            "Usuário ou senha incorretos."
                    });

            }


            const usuarioBanco =
                resultado.rows[0];


            /* =========================
               USUÁRIO INATIVO
            ========================= */

            if (
                usuarioBanco.ativo !== true
            ) {

                return res
                    .status(403)
                    .json({
                        erro:
                            "Usuário desativado."
                    });

            }


            /* =========================
               VALIDAR SENHA
            ========================= */

            const senhaCorreta =
                await bcrypt.compare(
                    senha,
                    usuarioBanco.senha_hash
                );


            if (!senhaCorreta) {

                return res
                    .status(401)
                    .json({
                        erro:
                            "Usuário ou senha incorretos."
                    });

            }


            /* =========================
               LOGIN CORRETO - V19
            ========================= */

            const tokenSessao =
                await criarSessaoServidor(
                    usuarioBanco,
                    req,
                    res
                );

            return res.json({

                ok:
                    true,

                usuario:
                    usuarioBanco.usuario,

                nome:
                    usuarioBanco.nome,

                perfil:
                    usuarioBanco.perfil,

                // Mantido para compatibilidade com as telas V17.
                // A autenticação principal agora está no cookie HttpOnly.
                token:
                    tokenSessao

            });


        } catch (erro) {

            console.error(
                "Erro no login:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro interno ao realizar login."
                });

        }

    }
);

/* =========================================================
   SESSÃO ATUAL - V20.0
   Usado pelo Dashboard e demais páginas para validar a sessão
   única antes de carregar dados protegidos.
========================================================= */

app.get(
    "/api/sessao",
    exigirUsuario,
    async (req, res) => {
        return res.json({
            ok: true,
            id: req.usuarioAtual.id,
            usuario: req.usuarioAtual.usuario,
            nome: req.usuarioAtual.nome,
            perfil: req.usuarioAtual.perfil,
            ativo: req.usuarioAtual.ativo
        });
    }
);

/* =========================================================
   PERFIL DO USUÁRIO LOGADO
========================================================= */

app.get(
    "/api/perfil",
    exigirUsuario,
    async (req, res) => {
        try {
            const resultado = await pool.query(`
                SELECT id, usuario, nome, perfil, ativo, criado_em
                FROM usuarios
                WHERE id = $1
                LIMIT 1
            `, [req.usuarioAtual.id]);

            if (resultado.rowCount === 0) {
                return res.status(404).json({ erro: "Usuário não encontrado." });
            }

            const item = resultado.rows[0];
            return res.json({
                id: item.id,
                usuario: item.usuario,
                nome: item.nome,
                perfil: item.perfil,
                ativo: item.ativo,
                criadoEm: item.criado_em
            });
        } catch (erro) {
            console.error("Erro ao carregar perfil:", erro);
            return res.status(500).json({ erro: "Erro ao carregar o perfil." });
        }
    }
);

app.patch(
    "/api/perfil",
    exigirUsuario,
    async (req, res) => {
        try {
            const nome = String(req.body.nome || "").trim();
            const senhaAtual = String(req.body.senhaAtual || "");
            const novaSenha = String(req.body.novaSenha || "");

            if (!nome) {
                return res.status(400).json({ erro: "Informe o nome." });
            }

            if (nome.length > 120) {
                return res.status(400).json({ erro: "O nome deve ter no máximo 120 caracteres." });
            }

            const precisaTrocarSenha = senhaAtual.length > 0 || novaSenha.length > 0;

            if (precisaTrocarSenha) {
                if (!senhaAtual || !novaSenha) {
                    return res.status(400).json({ erro: "Informe a senha atual e a nova senha." });
                }

                if (novaSenha.length < 6) {
                    return res.status(400).json({ erro: "A nova senha precisa ter pelo menos 6 caracteres." });
                }

                const resultadoSenha = await pool.query(
                    `SELECT senha_hash FROM usuarios WHERE id = $1 LIMIT 1`,
                    [req.usuarioAtual.id]
                );

                if (resultadoSenha.rowCount === 0) {
                    return res.status(404).json({ erro: "Usuário não encontrado." });
                }

                const senhaCorreta = await bcrypt.compare(
                    senhaAtual,
                    resultadoSenha.rows[0].senha_hash
                );

                if (!senhaCorreta) {
                    return res.status(400).json({ erro: "A senha atual está incorreta." });
                }

                const senhaHash = await bcrypt.hash(novaSenha, 12);
                await pool.query(
                    `UPDATE usuarios SET nome = $1, senha_hash = $2 WHERE id = $3`,
                    [nome, senhaHash, req.usuarioAtual.id]
                );
            } else {
                await pool.query(
                    `UPDATE usuarios SET nome = $1 WHERE id = $2`,
                    [nome, req.usuarioAtual.id]
                );
            }

            registrarAuditoria({
                acao: "atualizado",
                entidade: "perfil_usuario",
                registroId: req.usuarioAtual.id,
                usuario: req.usuarioAtual.usuario,
                detalhes: precisaTrocarSenha
                    ? "Usuário atualizou o nome e a própria senha."
                    : "Usuário atualizou o próprio nome."
            });

            emitirEventoSistema("perfil-atualizado", {
                id: req.usuarioAtual.id
            });

            const resultado = await pool.query(`
                SELECT id, usuario, nome, perfil, ativo, criado_em
                FROM usuarios
                WHERE id = $1
                LIMIT 1
            `, [req.usuarioAtual.id]);

            const item = resultado.rows[0];
            return res.json({
                ok: true,
                id: item.id,
                usuario: item.usuario,
                nome: item.nome,
                perfil: item.perfil,
                ativo: item.ativo,
                criadoEm: item.criado_em
            });
        } catch (erro) {
            console.error("Erro ao atualizar perfil:", erro);
            return res.status(500).json({ erro: "Erro ao atualizar o perfil." });
        }
    }
);

/* =========================================================
   SESSÃO - CONSULTAR USUÁRIO ATUAL
========================================================= */

app.get(
    "/api/sessao",
    exigirUsuario,
    async (req, res) => {
        return res.json({
            ok: true,
            usuario: req.usuarioAtual.usuario,
            nome: req.usuarioAtual.nome,
            perfil: req.usuarioAtual.perfil
        });
    }
);


/* =========================================================
   SESSÃO - SAIR
========================================================= */

app.post(
    "/api/logout",
    async (req, res) => {
        try {
            await revogarSessaoAtual(req);
        } catch (erro) {
            console.error(
                "Erro ao revogar sessão:",
                erro
            );
        }

        limparCookieSessao(res);

        return res.json({
            ok: true
        });
    }
);


/* =========================================================
   BACKUP - STATUS DO ÚLTIMO BACKUP
========================================================= */

app.get(
    "/api/admin/backup-status",
    exigirAdmin,
    async (req, res) => {
        return res.json({
            ...ultimoBackupStatus,
            retencao: BACKUP_RETENCAO
        });
    }
);


/* =========================================================
   BACKUP - EXECUÇÃO MANUAL
========================================================= */

app.post(
    "/api/admin/backup",
    exigirAdmin,
    async (req, res) => {
        try {
            ultimoBackupDia = "";
            await executarBackupAutomatico(true);

            return res.json({
                ok: true,
                backup: ultimoBackupStatus
            });
        } catch (erro) {
            return res
                .status(500)
                .json({
                    erro:
                        "Não foi possível executar o backup."
                });
        }
    }
);


/* =========================================================
   AVARIAS - EXPORTAR XLSX
========================================================= */

app.post(
    "/api/avarias/exportar",
    exigirUsuario,

    async (req, res) => {

        try {

            const registros =
                Array.isArray(
                    req.body.registros
                )
                    ? req.body.registros
                    : [];


            if (!registros.length) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Nenhum registro para exportar."
                    });

            }


            const agrupados = new Map();

            for (const item of registros) {
                const chave = String(item.codigo || item.produto || "").trim().toLowerCase();
                if (!chave) continue;
                if (!agrupados.has(chave)) {
                    agrupados.set(chave, { ...item, quantidade: Number(item.quantidade) || 0, valorTotal: Number(item.valorTotal) || 0 });
                } else {
                    const atual = agrupados.get(chave);
                    atual.quantidade += Number(item.quantidade) || 0;
                    atual.valorTotal += Number(item.valorTotal) || 0;
                }
            }

            const dadosExcel = Array.from(agrupados.values()).map(item => ({
                "Data": item.data || "",
                "Código do Produto": item.codigo || "",
                "Produto": item.produto || "",
                "Categoria": item.categoria || "",
                "Empresa / Fornecedor": item.fornecedor || "",
                "Código do Fornecedor": item.codigoFornecedor || "",
                "Quantidade": Number(item.quantidade) || 0,
                "Valor de Custo": Number(item.valorUnitario) || 0,
                "Valor Total": Number(item.valorTotal) || 0,
                "Tipo de Avaria": item.tipo || "",
                "Setor de Origem": item.setor || "",
                "Usuário": item.usuario || "",
                "Status": item.status || "",
                "Observação": item.observacao || ""
            }));

            const totalQuantidadeExcel = dadosExcel.reduce(
                (soma, item) => soma + (Number(item["Quantidade"]) || 0),
                0
            );

            const totalValorExcel = dadosExcel.reduce(
                (soma, item) => soma + (Number(item["Valor Total"]) || 0),
                0
            );

            dadosExcel.push({
                "Data": "TOTAL",
                "Quantidade": totalQuantidadeExcel,
                "Valor Total": totalValorExcel
            });


            const planilha =
                XLSX.utils.json_to_sheet(
                    dadosExcel
                );


            /*
                Largura das colunas
            */

            planilha["!cols"] = [

                { wch: 18 }, // Data
                { wch: 18 }, // Código
                { wch: 45 }, // Produto
                { wch: 16 }, // Categoria
                { wch: 30 }, // Empresa
                { wch: 20 }, // Código fornecedor
                { wch: 12 }, // Quantidade
                { wch: 15 }, // Custo
                { wch: 15 }, // Total
                { wch: 25 }, // Tipo
                { wch: 18 }, // Setor
                { wch: 18 }, // Usuário
                { wch: 14 }, // Status
                { wch: 40 }  // Observação

            ];


            const workbook =
                XLSX.utils.book_new();


            XLSX.utils.book_append_sheet(

                workbook,

                planilha,

                "Avarias"

            );


            const arquivo =
                XLSX.write(
                    workbook,
                    {

                        type:
                            "buffer",

                        bookType:
                            "xlsx"

                    }
                );


            const agora =
                new Date();


            const data =
                agora
                    .toISOString()
                    .slice(
                        0,
                        10
                    );


            const nomeArquivo =
                `avarias_${data}.xlsx`;


            res.setHeader(

                "Content-Disposition",

                `attachment; filename="${nomeArquivo}"`

            );


            res.setHeader(

                "Content-Type",

                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            );


            return res.send(
                arquivo
            );


        } catch (erro) {

            console.error(
                "Erro ao exportar XLSX:",
                erro
            );


            return res
                .status(500)
                .json({
                    erro:
                        "Erro ao gerar arquivo XLSX."
                });

        }

    }
);


/* =========================================================
   V13 - EXPORTAR PDF DAS BAIXAS
========================================================= */

function pdfEscape(texto) {
    return String(texto ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\r?\n/g, " ");
}

function pdfTrunc(texto, maxChars) {
    const t = String(texto ?? "").replace(/\s+/g, " ").trim();
    if (t.length <= maxChars) return t;
    return t.slice(0, Math.max(0, maxChars - 1)) + "...";
}

function gerarPdfBaixas(registros, titulo = "Controle de Avarias - Baixas", subtitulo = "Exportacao das baixas filtradas") {
    const W = 842;
    const H = 595;
    const rowH = 16;
    const columns = [
        ["Data", 58, 11], ["Código", 62, 13], ["Produto", 150, 30],
        ["Fornecedor", 90, 18], ["Categoria", 55, 11], ["Cód. Forn.", 48, 10],
        ["Qtd.", 32, 7], ["Valor", 55, 11], ["Setor", 50, 10],
        ["Motivo", 85, 17], ["Usuário", 60, 12], ["Caixa", 50, 10]
    ];
    const totalW = columns.reduce((a,c)=>a+c[1],0);
    const x0 = (W-totalW)/2;
    const pages=[]; let ops=[]; let y=510;

    function header() {
        ops.push(`BT /F1 13 Tf 20 565 Td (${pdfEscape(titulo)}) Tj ET`);
        ops.push(`BT /F1 6 Tf 20 551 Td (${pdfEscape(subtitulo)}) Tj ET`);
        ops.push("0.90 g");
        ops.push(`${x0.toFixed(2)} 528 ${totalW.toFixed(2)} 18 re f`);
        ops.push("0 g BT /F1 5.5 Tf");
        let x=x0;
        for(const [label,w] of columns){
            ops.push(`1 0 0 1 ${(x+2).toFixed(2)} 534 Tm (${pdfEscape(label)}) Tj`);
            x+=w;
        }
        ops.push("ET");
        y=515;
    }
    function newPage(){ if(ops.length) pages.push(ops); ops=[]; header(); }
    newPage();

    for(const r of registros){
        if(y<32) newPage();
        const vals=[
            r.data,r.codigo,r.produto,r.fornecedor,r.categoria,r.codigoFornecedor,
            Number(r.quantidade||0).toLocaleString('pt-BR',{maximumFractionDigits:3}),
            Number(r.valorTotal||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
            r.setor||'-',r.tipo||'-',r.usuario||'-',r.caixa||'-'
        ];
        let x=x0;
        ops.push("BT /F1 5.2 Tf");
        for(let i=0;i<columns.length;i++){
            const w=columns[i][1], max=columns[i][2];
            ops.push(`1 0 0 1 ${(x+2).toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(pdfTrunc(vals[i],max))}) Tj`);
            x+=w;
        }
        ops.push("ET");
        y-=rowH;
    }
    const totalQuantidadePdf = registros.reduce(
        (soma, item) => soma + (Number(item.quantidade) || 0),
        0
    );
    const totalValorPdf = registros.reduce(
        (soma, item) => soma + (Number(item.valorTotal) || 0),
        0
    );

    if (y < 55) newPage();
    ops.push(`0.90 g ${x0.toFixed(2)} ${(y - 4).toFixed(2)} ${totalW.toFixed(2)} 18 re f 0 g`);
    ops.push(`BT /F1 6.2 Tf 1 0 0 1 ${(x0+2).toFixed(2)} ${y.toFixed(2)} Tm (TOTAL) Tj 1 0 0 1 ${(x0+columns.slice(0,6).reduce((a,c)=>a+c[1],0)+2).toFixed(2)} ${y.toFixed(2)} Tm (Qtd: ${pdfEscape(totalQuantidadePdf.toLocaleString('pt-BR',{maximumFractionDigits:3}))}) Tj 1 0 0 1 ${(x0+columns.slice(0,7).reduce((a,c)=>a+c[1],0)+2).toFixed(2)} ${y.toFixed(2)} Tm (Valor: ${pdfEscape(totalValorPdf.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))}) Tj ET`);

    pages.push(ops);

    const objs=[]; const add=o=>{objs.push(o);return objs.length;};
    const catalog=add('<< /Type /Catalog /Pages 2 0 R >>');
    const pagesObj=add('PLACEHOLDER');
    const fontObj=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const kids=[];
    for(const opsPage of pages){
        const stream=opsPage.join('\n')+'\n';
        const content=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}endstream`);
        const pg=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${content} 0 R >>`);
        kids.push(pg);
    }
    objs[pagesObj-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let pdf='%PDF-1.4\n'; const offsets=[];
    for(let i=0;i<objs.length;i++){offsets[i+1]=Buffer.byteLength(pdf,'latin1');pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
    const xref=Buffer.byteLength(pdf,'latin1');
    pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<=objs.length;i++) pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
    pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf,'latin1');
}

app.post(
    "/api/avarias/exportar-pdf",
    exigirUsuario,
    async (req,res)=>{
        try{
            const registros=Array.isArray(req.body.registros)?req.body.registros:[];
            if(!registros.length) return res.status(400).json({erro:"Nenhum registro para exportar."});
            const mapa=new Map();
            for(const item of registros){
                const chave=String(item.codigo||item.produto||'').trim().toLowerCase();
                if(!chave) continue;
                if(!mapa.has(chave)) mapa.set(chave,{...item,quantidade:Number(item.quantidade)||0,valorTotal:Number(item.valorTotal)||0});
                else { const a=mapa.get(chave); a.quantidade+=Number(item.quantidade)||0; a.valorTotal+=Number(item.valorTotal)||0; }
            }
            const arquivo=gerarPdfBaixas(Array.from(mapa.values()));
            res.setHeader('Content-Disposition',`attachment; filename="baixas_${new Date().toISOString().slice(0,10)}.pdf"`);
            res.setHeader('Content-Type','application/pdf');
            return res.send(arquivo);
        }catch(erro){
            console.error('Erro ao exportar PDF:',erro);
            return res.status(500).json({erro:'Erro ao gerar arquivo PDF.'});
        }
    }
);

app.post(
    "/api/avarias/exportar-pdf-registros",
    exigirUsuario,
    async (req, res) => {
        try {
            const registros = Array.isArray(req.body.registros) ? req.body.registros : [];
            if (!registros.length) {
                return res.status(400).json({ erro: "Nenhum registro para exportar." });
            }

            const mapa = new Map();
            for (const item of registros) {
                const chave = String(item.codigo || item.produto || "").trim().toLowerCase();
                if (!chave) continue;
                if (!mapa.has(chave)) {
                    mapa.set(chave, {
                        ...item,
                        quantidade: Number(item.quantidade) || 0,
                        valorTotal: Number(item.valorTotal) || 0
                    });
                } else {
                    const atual = mapa.get(chave);
                    atual.quantidade += Number(item.quantidade) || 0;
                    atual.valorTotal += Number(item.valorTotal) || 0;
                }
            }

            const arquivo = gerarPdfBaixas(
                Array.from(mapa.values()),
                "Controle de Avarias - Registros",
                "Registros de avarias selecionados"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="avarias_${new Date().toISOString().slice(0, 10)}.pdf"`
            );
            res.setHeader("Content-Type", "application/pdf");
            return res.send(arquivo);
        } catch (erro) {
            console.error("Erro ao exportar PDF dos registros:", erro);
            return res.status(500).json({ erro: "Erro ao gerar arquivo PDF." });
        }
    }
);

/* =========================================================
   FALLBACK DE API
   Nunca devolve HTML para uma rota /api inexistente.
   Isso evita o erro genérico "Unexpected token <" no navegador.
========================================================= */

app.use("/api", (req, res) => {
    return res.status(404).json({
        ok: false,
        erro: "Rota da API não encontrada.",
        rota: req.originalUrl,
        versao: APP_VERSION
    });
});

/*
   ERROS DA API NUNCA DEVEM VOLTAR COMO HTML.
   Isso evita que o frontend receba <!DOCTYPE html> e tente fazer JSON.parse().
*/
app.use((erro, req, res, next) => {
    if (String(req.originalUrl || "").startsWith("/api/")) {
        console.error("Erro não tratado na API:", erro);
        return res.status(500).json({
            ok: false,
            erro: "Erro interno na API.",
            detalhe: process.env.NODE_ENV === "production" ? undefined : String(erro?.message || erro || "Erro desconhecido"),
            versao: APP_VERSION
        });
    }
    return next(erro);
});


/* =========================================================
   INICIAR SERVIDOR
========================================================= */

const servidorHttp = app.listen(
    PORT,
    HOST,

    async () => {

        console.log("");
        console.log(
            "=============================="
        );

        console.log(
            " CONTROLE DE AVARIAS"
        );

        console.log(
            "=============================="
        );

        console.log("");

        console.log(
            `Neste computador: http://localhost:${PORT}`
        );


        const interfaces =
            os.networkInterfaces();


        const enderecos =
            [];


        Object.values(interfaces)
            .flat()
            .filter(Boolean)
            .forEach(
                item => {

                    if (
                        item.family === "IPv4" &&
                        item.internal === false
                    ) {

                        enderecos.push(
                            item.address
                        );

                    }

                }
            );


        enderecos.forEach(
            endereco => {

                console.log(
                    `Outros PCs: http://${endereco}:${PORT}`
                );

            }
        );


        try {

            await pool.query(
                "SELECT 1"
            );


            await garantirTabelaUsuarios();


            // Garante a estrutura do histórico antes das migrações que
            // dependem dela. Isso permite atualizar bancos antigos sem
            // apagar os dados existentes.
            await garantirTabelaHistorico();


            await garantirTabelaAuditoria();


            await garantirTabelaTarefas();


            await garantirTabelaNotificacoes();


            await garantirTabelasRecuperacaoDoacao();


            await garantirEstruturaV10();


            await garantirEstruturaV12();

            await garantirEstruturaV13();


            await garantirTabelaCaixaProdutos();


            await garantirSetorOrigemPadrao();


            await garantirTabelaMapeamento();

            await garantirIndicesV19();

            try {
                await sincronizarHistoricoExistente();
            } catch (erroHistorico) {
                console.error("V20.0: sincronização inicial do histórico falhou:", erroHistorico);
            }

            await recuperarHistoricoDoBackup();

            await garantirFusoHorarioBrasil();

            console.log(
                "PostgreSQL conectado."
            );


            console.log(
                "Histórico de avarias pronto."
            );

            // Garante pelo menos um backup/snapshot por dia mesmo se o servidor
            // for iniciado depois do horário programado.
            await executarBackupAutomatico(true);

        } catch (erro) {

            console.error(
                "Erro PostgreSQL:",
                erro
            );

        }

    }
);

servidorHttp.on("error", (erro) => {
    if (erro && erro.code === "EADDRINUSE") {
        console.error(`
ERRO: a porta ${PORT} já está em uso.
Feche o servidor antigo do Controle de Avarias e execute INICIAR_SERVIDOR.bat novamente.
`);
    } else {
        console.error("Erro no servidor HTTP:", erro);
    }
    process.exitCode = 1;
});
