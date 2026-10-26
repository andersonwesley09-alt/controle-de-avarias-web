/*
 * V25.1.15 - RECUPERAÇÃO SEGURA DOS LANÇAMENTOS APÓS 13/10/2026
 *
 * Recupera do snapshot legado apenas os registros ausentes do PostgreSQL.
 * Não sobrescreve registros existentes.
 * Não ressuscita registros cujo histórico atual esteja marcado como removido.
 * Cria snapshot da base atual antes de qualquer alteração.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ROOT = __dirname;
const SOURCE = path.join(ROOT, "local-api-216.LEGADO.js");
const BACKUP_DIR = path.join(ROOT, "backups");
const CUTOFF = new Date("2026-10-14T00:00:00-03:00");
const LIMITE = 100000;

const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || "postgres",
  host: process.env.DB_HOST || process.env.PGHOST || "localhost",
  database: process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  ...(process.env.DB_PASSWORD || process.env.PGPASSWORD
    ? { password: process.env.DB_PASSWORD || process.env.PGPASSWORD }
    : {}),
  options: "-c timezone=America/Sao_Paulo"
});

function stamp(){
  const d=new Date(), p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
function readSeed(){
  if(!fs.existsSync(SOURCE)) throw new Error("Arquivo local-api-216.LEGADO.js não encontrado.");
  const s=fs.readFileSync(SOURCE,"utf8");
  const marker="const CORE_SEED = ";
  const a=s.indexOf(marker);
  if(a<0) throw new Error("Snapshot CORE_SEED não encontrado no arquivo legado.");
  const start=a+marker.length;
  const end=s.indexOf(";\n",start);
  if(end<0) throw new Error("Fim do snapshot CORE_SEED não encontrado.");
  return JSON.parse(s.slice(start,end));
}
function dataItem(x){
  const v=x?.criado_em ?? x?.criadoEm ?? null;
  const d=new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function quantidade(v){
  const n=Number(v);
  return Number.isFinite(n) && n>=0 && n<=LIMITE ? n : null;
}
function dinheiro(v){
  const n=Number(v);
  return Number.isFinite(n) && n>=0 ? n : null;
}
async function ensureHistory(){
  await pool.query(`CREATE TABLE IF NOT EXISTS historico_avarias(
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
    categoria VARCHAR(50))`);
  for(const [c,t] of [
    ["codigo_fornecedor","VARCHAR(50)"],
    ["historico_criado_em","TIMESTAMPTZ"],
    ["removido","BOOLEAN NOT NULL DEFAULT FALSE"],
    ["categoria","VARCHAR(50)"]
  ]) await pool.query(`ALTER TABLE historico_avarias ADD COLUMN IF NOT EXISTS ${c} ${t}`);
}
async function snapshot(){
  await fs.promises.mkdir(BACKUP_DIR,{recursive:true});
  const out={geradoEm:new Date().toISOString(),motivo:"pre_recuperacao_pos13",tabelas:{}};
  for(const t of ["avarias","historico_avarias"]){
    const r=await pool.query(`SELECT * FROM ${t}`);
    out.tabelas[t]=r.rows;
  }
  const file=path.join(BACKUP_DIR,`pre_recuperacao_pos13_${stamp()}.json`);
  await fs.promises.writeFile(file,JSON.stringify(out,null,2),"utf8");
  return file;
}
async function recoverHistory(seed){
  let inserted=0, exists=0, skipped=0;
  const rows=(seed.historicoAvarias||[]).filter(x=>{
    const d=dataItem(x); return d && d>=CUTOFF;
  });
  for(const x of rows){
    const id=String(x?.id||"").trim(), product=String(x?.produto||"").trim();
    const q=quantidade(x.quantidade), v=dinheiro(x.valor_unitario ?? x.valorUnitario);
    if(!id||!product||q===null||v===null){skipped++;continue;}
    const r=await pool.query(`INSERT INTO historico_avarias
      (id,codigo,produto,fornecedor,codigo_fornecedor,quantidade,valor_unitario,setor,tipo,caixa,status,observacao,usuario_lancamento,criado_em,movimentado_em,historico_criado_em,removido,categoria)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,CURRENT_TIMESTAMP),$15,COALESCE($16,CURRENT_TIMESTAMP),$17,$18)
      ON CONFLICT(id) DO NOTHING`,[
        id,String(x.codigo||""),product,String(x.fornecedor||""),
        x.codigo_fornecedor==null ? null : String(x.codigo_fornecedor),q,v,
        String(x.setor||""),String(x.tipo||""),String(x.caixa||""),
        String(x.status||"Pendente"),String(x.observacao||""),
        String(x.usuario_lancamento||x.usuarioLancamento||""),
        x.criado_em||x.criadoEm||null,x.movimentado_em||x.movimentadoEm||null,
        x.historico_criado_em||x.historicoCriadoEm||null,x.removido===true,
        String(x.categoria||"Mercearia")
      ]);
    if(r.rowCount) inserted++; else exists++;
  }
  return {fonte:rows.length,inseridos:inserted,existentes:exists,ignorados:skipped};
}
async function recoverActive(seed){
  let inserted=0, exists=0, protectedRows=0, skipped=0;
  const sourceHistory=new Map((seed.historicoAvarias||[]).map(x=>[String(x.id),x]));
  const rows=(seed.avarias||[]).filter(x=>{
    const d=dataItem(x); return d && d>=CUTOFF;
  });
  for(const x of rows){
    const id=String(x?.id||"").trim(), product=String(x?.produto||"").trim();
    const q=quantidade(x.quantidade), v=dinheiro(x.valor_unitario ?? x.valorUnitario);
    if(!id||!product||q===null||q<=0||v===null){skipped++;continue;}

    const currentA=await pool.query(`SELECT 1 FROM avarias WHERE id=$1 LIMIT 1`,[id]);
    if(currentA.rowCount){exists++;continue;}

    const currentH=await pool.query(`SELECT removido FROM historico_avarias WHERE id=$1 LIMIT 1`,[id]);
    if(currentH.rowCount && currentH.rows[0].removido===true){protectedRows++;continue;}

    // Se o snapshot legado marca o próprio lançamento como removido, ele não volta para Registros.
    const legacyH=sourceHistory.get(id);
    if(legacyH?.removido===true){protectedRows++;continue;}

    const r=await pool.query(`INSERT INTO avarias
      (id,codigo,produto,fornecedor,categoria,quantidade,valor_unitario,setor,tipo,caixa,usuario_lancamento,status,observacao,criado_em,movimentado_em)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,CURRENT_TIMESTAMP),$15)
      ON CONFLICT(id) DO NOTHING`,[
        id,String(x.codigo||""),product,String(x.fornecedor||""),
        String(x.categoria||"Mercearia"),q,v,String(x.setor||"Loja")||"Loja",
        String(x.tipo||""),String(x.caixa||""),
        String(x.usuario_lancamento||x.usuarioLancamento||""),
        String(x.status||"Pendente"),String(x.observacao||""),
        x.criado_em||x.criadoEm||null,x.movimentado_em||x.movimentadoEm||null
      ]);
    if(r.rowCount) inserted++; else exists++;
  }
  return {fonte:rows.length,inseridas:inserted,existentes:exists,protegidas:protectedRows,ignoradas:skipped};
}
async function auditCounts(){
  const r=await pool.query(`SELECT
    (SELECT COUNT(*) FROM avarias)::int AS avarias,
    (SELECT COUNT(*) FROM historico_avarias)::int AS historico,
    (SELECT COUNT(*) FROM avarias WHERE criado_em >= $1)::int AS avarias_pos13,
    (SELECT COUNT(*) FROM historico_avarias WHERE criado_em >= $1)::int AS historico_pos13`,[CUTOFF]);
  return r.rows[0];
}
(async()=>{
  try{
    await pool.query("SELECT 1");
    await ensureHistory();
    const seed=readSeed();
    const pre=await snapshot();
    const before=await auditCounts();
    const h=await recoverHistory(seed);
    const a=await recoverActive(seed);
    const after=await auditCounts();
    console.log("");
    console.log("============================================================");
    console.log(" CONTROLE DE AVARIAS V25.1.15 - RECUPERAÇÃO PÓS-DIA 13");
    console.log("============================================================");
    console.log(`Snapshot de segurança: ${pre}`);
    console.log(`Fonte: ${seed.avarias?.length||0} avarias ativas | ${seed.historicoAvarias?.length||0} históricos`);
    console.log(`Corte: 14/10/2026 00:00 (America/Sao_Paulo)`);
    console.log("");
    console.log("ANTES:",before);
    console.log("HISTÓRICO:",h);
    console.log("REGISTROS ATIVOS:",a);
    console.log("DEPOIS:",after);
    console.log("");
    console.log("Nenhum registro existente foi sobrescrito.");
    console.log("Registros removidos no histórico atual foram protegidos.");
    console.log("A recuperação do snapshot vai somente até 21/10/2026.");
  }catch(e){
    console.error("ERRO NA RECUPERAÇÃO:",e.stack||e.message||e);
    process.exitCode=1;
  }finally{await pool.end();}
})();
