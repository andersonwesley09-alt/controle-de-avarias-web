
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || process.env.PGUSER || "postgres",
  host: process.env.DB_HOST || process.env.PGHOST || "localhost",
  database: process.env.DB_NAME || process.env.PGDATABASE || "controle_avarias",
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  ...(process.env.DB_PASSWORD || process.env.PGPASSWORD ? {password: process.env.DB_PASSWORD || process.env.PGPASSWORD} : {})
});

(async()=>{
  try{
    const r = await pool.query(`
      SELECT current_database() AS banco,
             current_user AS usuario,
             current_setting('server_version') AS postgres
    `);
    const h = await pool.query(`SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE COALESCE(removido,FALSE)=FALSE)::int ativos, COUNT(*) FILTER (WHERE COALESCE(removido,FALSE)=TRUE)::int removidos FROM historico_avarias`);
    const a = await pool.query(`SELECT COUNT(*)::int total FROM avarias`);
    const u = await pool.query(`SELECT COUNT(*)::int total FROM usuarios`);

    const dir = path.join(__dirname,"backups");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x=>/^controle_avarias_.*\.json$/i.test(x)).sort().reverse() : [];
    let backup = null;
    if(files.length){
      try{
        const d=JSON.parse(fs.readFileSync(path.join(dir,files[0]),"utf8"));
        backup={
          arquivo: files[0],
          historicoTotal: Array.isArray(d?.tabelas?.historico_avarias) ? d.tabelas.historico_avarias.length : 0,
          avarias: Array.isArray(d?.tabelas?.avarias) ? d.tabelas.avarias.length : 0,
          usuarios: Array.isArray(d?.tabelas?.usuarios) ? d.tabelas.usuarios.length : 0
        };
      }catch(_){}
    }

    console.log(JSON.stringify({
      banco:r.rows[0],
      bancoAtual:{
        historicoTotal:h.rows[0].total,
        historicoAtivo:h.rows[0].ativos,
        historicoRemovido:h.rows[0].removidos,
        avarias:a.rows[0].total,
        usuarios:u.rows[0].total
      },
      backupMaisRecente:backup
    },null,2));
  }catch(e){
    console.error("ERRO:",e.message);
    process.exitCode=1;
  }finally{
    await pool.end();
  }
})();
