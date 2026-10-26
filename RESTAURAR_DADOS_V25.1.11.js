
/*
 * CONTROLE DE AVARIAS V25.1.11
 * RESTAURAÇÃO SEGURA DOS DADOS
 *
 * IMPORTANTE:
 * - Não apaga nada.
 * - Não substitui nada.
 * - Só insere registros cujo ID ainda não existe.
 * - A tabela AVARIAS ativa não é restaurada para não ressuscitar
 *   lançamentos que tenham sido excluídos/baixados legitimamente.
 * - O HISTÓRICO é a fonte principal para recuperar lançamentos.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, "backups");
const LIMITE_QUANTIDADE = 100000;

const pool = new Pool({
    user: process.env.DB_USER || process.env.PGUSER || "postgres",
    host: process.env.DB_HOST || process.env.PGHOST || "localhost",
    database: process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    ...(process.env.DB_PASSWORD || process.env.PGPASSWORD
        ? { password: process.env.DB_PASSWORD || process.env.PGPASSWORD }
        : {})
});

function carimbo() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function snapshotAtual(tabelas) {
    const saida = {
        geradoEm: new Date().toISOString(),
        banco: process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
        motivo: "snapshot_pre_restauracao_V25.1.11",
        tabelas: {}
    };

    for (const tabela of tabelas) {
        try {
            const r = await pool.query(`SELECT * FROM ${tabela}`);
            saida.tabelas[tabela] = r.rows;
        } catch (e) {
            saida.tabelas[tabela] = { erro: e.message };
        }
    }

    await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
    const caminho = path.join(BACKUP_DIR, `pre_restauracao_${carimbo()}.json`);
    await fs.promises.writeFile(caminho, JSON.stringify(saida, null, 2), "utf8");
    return caminho;
}

async function ultimoSnapshotFonte() {
    if (!fs.existsSync(BACKUP_DIR)) return null;

    const arquivos = (await fs.promises.readdir(BACKUP_DIR))
        .filter(n => /^controle_avarias_.*\.json$/i.test(n))
        .sort()
        .reverse();

    for (const nome of arquivos) {
        try {
            const caminho = path.join(BACKUP_DIR, nome);
            const snapshot = JSON.parse(await fs.promises.readFile(caminho, "utf8"));
            if (Array.isArray(snapshot?.tabelas?.historico_avarias)) {
                return { caminho, nome, snapshot };
            }
        } catch (_) {}
    }

    return null;
}

function normalizarQuantidade(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > LIMITE_QUANTIDADE) return 0;
    return n;
}

async function garantirEstruturas() {
    // Usa as mesmas rotinas de compatibilidade do servidor sem iniciar HTTP.
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

    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS codigo_fornecedor VARCHAR(50)
    `);
    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS historico_criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    `);
    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS removido BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await pool.query(`
        ALTER TABLE historico_avarias
        ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            usuario VARCHAR(100) UNIQUE NOT NULL,
            senha_hash VARCHAR(255) NOT NULL,
            nome VARCHAR(255) NOT NULL,
            perfil VARCHAR(50) NOT NULL DEFAULT 'usuario',
            ativo BOOLEAN NOT NULL DEFAULT TRUE,
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

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
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            documento_id BIGINT
        )
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
            criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            documento_id BIGINT
        )
    `);
}

async function restaurarHistorico(lista) {
    let inseridos = 0, existentes = 0, ignorados = 0;

    for (const item of lista) {
        const id = String(item?.id ?? "").trim();
        const produto = String(item?.produto ?? "").trim();

        if (!id || !produto) {
            ignorados++;
            continue;
        }

        const quantidade = normalizarQuantidade(item.quantidade);
        const valor = Number(item.valor_unitario);
        if (!Number.isFinite(valor) || valor < 0) {
            ignorados++;
            continue;
        }

        const r = await pool.query(`
            INSERT INTO historico_avarias
            (
                id, codigo, produto, fornecedor, codigo_fornecedor,
                quantidade, valor_unitario, setor, tipo, caixa, status,
                observacao, usuario_lancamento, criado_em, movimentado_em,
                historico_criado_em, removido, categoria
            )
            VALUES
            (
                $1,$2,$3,$4,$5,
                $6,$7,$8,$9,$10,$11,
                $12,$13,COALESCE($14,CURRENT_TIMESTAMP),$15,
                COALESCE($16,CURRENT_TIMESTAMP),COALESCE($17,FALSE),$18
            )
            ON CONFLICT (id) DO NOTHING
        `, [
            id,
            String(item.codigo || ""),
            produto,
            String(item.fornecedor || ""),
            item.codigo_fornecedor == null ? null : String(item.codigo_fornecedor),
            quantidade,
            valor,
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

        if (r.rowCount) inseridos++;
        else existentes++;
    }

    return { inseridos, existentes, ignorados };
}

async function restaurarUsuarios(lista) {
    let inseridos = 0, existentes = 0, ignorados = 0;

    for (const item of lista || []) {
        const usuario = String(item?.usuario || "").trim().toLowerCase();
        const nome = String(item?.nome || "").trim();
        const hash = String(item?.senha_hash_original || item?.senha_hash || "").trim();

        if (!usuario || !nome || !hash) {
            ignorados++;
            continue;
        }

        const r = await pool.query(`
            INSERT INTO usuarios (id, usuario, senha_hash, nome, perfil, ativo, criado_em)
            VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_TIMESTAMP))
            ON CONFLICT DO NOTHING
        `, [
            Number(item.id) || 0,
            usuario,
            hash,
            nome,
            String(item.perfil || "usuario"),
            item.ativo !== false,
            item.criadoEm || item.criado_em || null
        ]);

        if (r.rowCount) inseridos++;
        else existentes++;
    }

    // Reajusta a sequência para não causar conflito em novos usuários.
    await pool.query(`
        SELECT setval(
            pg_get_serial_sequence('usuarios','id'),
            COALESCE((SELECT MAX(id) FROM usuarios), 1),
            TRUE
        )
    `);

    return { inseridos, existentes, ignorados };
}

async function restaurarRecuperacoes(lista) {
    let inseridos = 0, existentes = 0, ignorados = 0;

    for (const item of lista || []) {
        const id = String(item?.id || "").trim();
        const produto = String(item?.produto || "").trim();
        if (!id || !produto) { ignorados++; continue; }

        const r = await pool.query(`
            INSERT INTO recuperacoes_produtos
            (
                id,codigo,produto,fornecedor,codigo_fornecedor,categoria,
                quantidade,quantidade_recuperada,valor_unitario,setor,observacao,
                usuario_lancamento,criado_em,documento_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13,CURRENT_TIMESTAMP),$14)
            ON CONFLICT (id) DO NOTHING
        `, [
            id,
            String(item.codigo || ""),
            produto,
            String(item.fornecedor || ""),
            String(item.codigo_fornecedor || item.codigoFornecedor || ""),
            String(item.categoria || "Mercearia"),
            normalizarQuantidade(item.quantidade),
            normalizarQuantidade(item.quantidade_recuperada ?? item.quantidadeRecuperada),
            Number(item.valor_unitario ?? item.valorUnitario) || 0,
            item.setor == null ? null : String(item.setor),
            String(item.observacao || ""),
            String(item.usuario_lancamento || item.usuarioLancamento || ""),
            item.criado_em || item.criadoEm || null,
            item.documento_id == null ? null : Number(item.documento_id)
        ]);

        if (r.rowCount) inseridos++;
        else existentes++;
    }
    return { inseridos, existentes, ignorados };
}

async function restaurarDoacoes(lista) {
    let inseridos = 0, existentes = 0, ignorados = 0;

    for (const item of lista || []) {
        const id = String(item?.id || "").trim();
        const produto = String(item?.produto || "").trim();
        const beneficiario = String(item?.beneficiario || "").trim();
        if (!id || !produto || !beneficiario) { ignorados++; continue; }

        const r = await pool.query(`
            INSERT INTO doacoes_produtos
            (
                id,codigo,produto,fornecedor,codigo_fornecedor,categoria,
                quantidade,valor_unitario,beneficiario,data_doacao,observacao,
                usuario_lancamento,criado_em,documento_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,COALESCE($13,CURRENT_TIMESTAMP),$14)
            ON CONFLICT (id) DO NOTHING
        `, [
            id,
            String(item.codigo || ""),
            produto,
            String(item.fornecedor || ""),
            String(item.codigo_fornecedor || item.codigoFornecedor || ""),
            String(item.categoria || "Mercearia"),
            normalizarQuantidade(item.quantidade),
            Number(item.valor_unitario ?? item.valorUnitario) || 0,
            beneficiario,
            String(item.data_doacao || item.dataDoacao || "").slice(0,10) || new Date().toISOString().slice(0,10),
            String(item.observacao || ""),
            String(item.usuario_lancamento || item.usuarioLancamento || ""),
            item.criado_em || item.criadoEm || null,
            item.documento_id == null ? null : Number(item.documento_id)
        ]);

        if (r.rowCount) inseridos++;
        else existentes++;
    }
    return { inseridos, existentes, ignorados };
}

(async () => {
    try {
        await pool.query("SELECT 1");
        await garantirEstruturas();

        const fonte = await ultimoSnapshotFonte();
        if (!fonte) {
            throw new Error("Nenhum backup controle_avarias_*.json foi encontrado na pasta backups.");
        }

        const pre = await snapshotAtual([
            "usuarios",
            "avarias",
            "historico_avarias",
            "recuperacoes_produtos",
            "doacoes_produtos"
        ]);

        const snapshot = fonte.snapshot;

        const resultado = {
            fonte: fonte.nome,
            snapshotPreRestauracao: path.basename(pre),
            historico: await restaurarHistorico(snapshot.tabelas.historico_avarias || []),
            usuarios: await restaurarUsuarios(snapshot.tabelas.usuarios || []),
            recuperacoes: await restaurarRecuperacoes(snapshot.tabelas.recuperacoes_produtos || []),
            doacoes: await restaurarDoacoes(snapshot.tabelas.doacoes_produtos || [])
        };

        console.log("");
        console.log("==============================================");
        console.log(" CONTROLE DE AVARIAS V25.1.11");
        console.log(" RESTAURACAO SEGURA CONCLUIDA");
        console.log("==============================================");
        console.log("");
        console.log("Fonte:", fonte.nome);
        console.log("Snapshot de segurança:", path.basename(pre));
        console.log("");
        console.log("HISTÓRICO:", resultado.historico);
        console.log("USUÁRIOS:", resultado.usuarios);
        console.log("RECUPERAÇÕES:", resultado.recuperacoes);
        console.log("DOAÇÕES:", resultado.doacoes);
        console.log("");
        console.log("Nenhum registro existente foi sobrescrito.");
        console.log("A tabela AVARIAS ativa não foi restaurada para evitar ressuscitar exclusões.");
        console.log("");

        await pool.end();
    } catch (erro) {
        console.error("");
        console.error("ERRO NA RESTAURAÇÃO:", erro.message);
        console.error("");
        try { await pool.end(); } catch (_) {}
        process.exitCode = 1;
    }
})();
