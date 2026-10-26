
require("dotenv").config();
const fs=require("fs"), path=require("path");
const {Pool}=require("pg");

const ROOT=__dirname;
const ADAPTER=path.join(ROOT,"local-api-216.LEGADO.js");
const BACKUP_DIR=path.join(ROOT,"backups");
const LIMITE=100000;

const pool=new Pool({
 user:process.env.DB_USER||process.env.PGUSER||"postgres",
 host:process.env.DB_HOST||process.env.PGHOST||"localhost",
 database:process.env.DB_NAME||process.env.PGDATABASE||"controle_avarias",
 port:Number(process.env.DB_PORT||process.env.PGPORT||5432),
 ...(process.env.DB_PASSWORD||process.env.PGPASSWORD?{password:process.env.DB_PASSWORD||process.env.PGPASSWORD}:{})
});

function stamp(){const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;}
function seed(){
 const s=fs.readFileSync(ADAPTER,"utf8");
 const a=s.indexOf("const CORE_SEED = ");
 if(a<0)throw new Error("CORE_SEED não encontrado.");
 const i=a+"const CORE_SEED = ".length;
 const f=s.indexOf(";\n",i);
 if(f<0)throw new Error("Fim do CORE_SEED não encontrado.");
 return JSON.parse(s.slice(i,f));
}
function n(v){const x=Number(v);return Number.isFinite(x)&&x>=0&&x<=LIMITE?x:0;}
function money(v){const x=Number(v);return Number.isFinite(x)&&x>=0?x:0;}

async function ensureHistory(){
 await pool.query(`CREATE TABLE IF NOT EXISTS historico_avarias(
 id VARCHAR(100) PRIMARY KEY,codigo VARCHAR(50),produto VARCHAR(255) NOT NULL,
 fornecedor VARCHAR(255),codigo_fornecedor VARCHAR(50),
 quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
 valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
 setor VARCHAR(100),tipo VARCHAR(100),caixa VARCHAR(255),
 status VARCHAR(50) NOT NULL DEFAULT 'Pendente',observacao TEXT,
 usuario_lancamento VARCHAR(100),criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
 movimentado_em TIMESTAMPTZ,historico_criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
 removido BOOLEAN NOT NULL DEFAULT FALSE,categoria VARCHAR(50))`);
 for(const [c,t] of [["codigo_fornecedor","VARCHAR(50)"],["historico_criado_em","TIMESTAMPTZ"],["removido","BOOLEAN"],["categoria","VARCHAR(50)"]])
   await pool.query(`ALTER TABLE historico_avarias ADD COLUMN IF NOT EXISTS ${c} ${t}`);
}
async function snapshot(){
 const out={geradoEm:new Date().toISOString(),tabelas:{}};
 for(const t of ["avarias","historico_avarias","usuarios"]){
   try{out.tabelas[t]=(await pool.query(`SELECT * FROM ${t}`)).rows}catch(e){out.tabelas[t]={erro:e.message}}
 }
 await fs.promises.mkdir(BACKUP_DIR,{recursive:true});
 const file=path.join(BACKUP_DIR,`pre_reconciliacao_${stamp()}.json`);
 await fs.promises.writeFile(file,JSON.stringify(out,null,2),"utf8");
 return file;
}
async function hist(seed){
 let ins=0,exists=0,skip=0;
 for(const x of seed.historicoAvarias||[]){
  const id=String(x?.id||"").trim(),prod=String(x?.produto||"").trim();
  if(!id||!prod){skip++;continue;}
  const r=await pool.query(`INSERT INTO historico_avarias
   (id,codigo,produto,fornecedor,codigo_fornecedor,quantidade,valor_unitario,setor,tipo,caixa,status,observacao,usuario_lancamento,criado_em,movimentado_em,historico_criado_em,removido,categoria)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,CURRENT_TIMESTAMP),$15,COALESCE($16,CURRENT_TIMESTAMP),$17,$18)
   ON CONFLICT(id) DO NOTHING`,[
    id,String(x.codigo||""),prod,String(x.fornecedor||""),
    x.codigo_fornecedor==null?null:String(x.codigo_fornecedor),
    n(x.quantidade),money(x.valor_unitario),String(x.setor||""),
    String(x.tipo||""),String(x.caixa||""),String(x.status||"Pendente"),
    String(x.observacao||""),String(x.usuario_lancamento||""),
    x.criado_em||x.criadoEm||null,x.movimentado_em||x.movimentadoEm||null,
    x.historico_criado_em||x.historicoCriadoEm||null,x.removido===true,
    String(x.categoria||"Mercearia")]);
  if(r.rowCount)ins++;else exists++;
 }
 return {inseridos:ins,existentes:exists,ignorados:skip};
}
async function avs(seed){
 let ins=0,exists=0,skip=0,protectedCount=0;
 const hs=new Map((seed.historicoAvarias||[]).map(x=>[String(x.id),x]));
 for(const x of seed.avarias||[]){
  const id=String(x?.id||"").trim(),prod=String(x?.produto||"").trim();
  if(!id||!prod){skip++;continue;}
  const e=await pool.query(`SELECT 1 FROM avarias WHERE id=$1 LIMIT 1`,[id]);
  if(e.rowCount){exists++;continue;}
  const h=hs.get(id);
  if(h?.removido===true){protectedCount++;continue;}
  const q=Number(x.quantidade),v=Number(x.valor_unitario??x.valorUnitario);
  if(!Number.isFinite(q)||q<=0||q>LIMITE||!Number.isFinite(v)||v<0){skip++;continue;}
  const r=await pool.query(`INSERT INTO avarias
   (id,codigo,produto,fornecedor,categoria,quantidade,valor_unitario,setor,tipo,caixa,usuario_lancamento,status,observacao,criado_em,movimentado_em)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,CURRENT_TIMESTAMP),$15)
   ON CONFLICT(id) DO NOTHING`,[
    id,String(x.codigo||""),prod,String(x.fornecedor||""),
    String(x.categoria||"Mercearia"),q,v,String(x.setor||"Loja")||"Loja",
    String(x.tipo||""),String(x.caixa||""),String(x.usuario_lancamento||x.usuarioLancamento||""),
    String(x.status||"Pendente"),String(x.observacao||""),
    x.criado_em||x.criadoEm||null,x.movimentado_em||x.movimentadoEm||null]);
  if(r.rowCount)ins++;else exists++;
 }
 return {inseridas:ins,existentes:exists,ignoradas:skip,protegidas:protectedCount};
}
async function users(seed){
 let ins=0,exists=0,skip=0;
 for(const x of seed.users||[]){
  const u=String(x?.usuario||"").trim().toLowerCase(),nome=String(x?.nome||"").trim(),hash=String(x?.senha_hash_original||x?.senha_hash||"").trim();
  if(!u||!nome||!hash){skip++;continue;}
  const r=await pool.query(`INSERT INTO usuarios(id,usuario,senha_hash,nome,perfil,ativo,criado_em)
    VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,CURRENT_TIMESTAMP)) ON CONFLICT DO NOTHING`,
    [Number(x.id)||0,u,hash,nome,String(x.perfil||"usuario"),x.ativo!==false,x.criadoEm||x.criado_em||null]);
  if(r.rowCount)ins++;else exists++;
 }
 try{await pool.query(`SELECT setval(pg_get_serial_sequence('usuarios','id'),COALESCE((SELECT MAX(id) FROM usuarios),1),TRUE)`)}catch(_){}
 return {inseridos:ins,existentes:exists,ignorados:skip};
}
(async()=>{
 try{
  await pool.query("SELECT 1"); await ensureHistory();
  const source=seed(); const pre=await snapshot();
  const h=await hist(source),a=await avs(source),u=await users(source);
  console.log("");
  console.log("=== V25.1.13 - RECONCILIACAO SEGURA ===");
  console.log("Snapshot fonte: avarias="+(source.avarias||[]).length+" | historico="+(source.historicoAvarias||[]).length);
  console.log("Periodo avarias: "+(source.avarias||[]).map(x=>x.criado_em).filter(Boolean).sort()[0]+" ate "+(source.avarias||[]).map(x=>x.criado_em).filter(Boolean).sort().slice(-1)[0]);
  console.log("Backup pre-reconciliacao: "+path.basename(pre));
  console.log("Historico:",h);
  console.log("Avarias ativas:",a);
  console.log("Usuarios:",u);
  console.log("Nenhum registro existente foi sobrescrito.");
 }catch(e){console.error("ERRO:",e.message);process.exitCode=1}
 finally{await pool.end()}
})();
