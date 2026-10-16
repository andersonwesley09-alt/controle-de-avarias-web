(() => {
  const exp=document.getElementById('btnExportarDadosLocais'), imp=document.getElementById('btnImportarDadosLocais'), file=document.getElementById('arquivoBackupLocal'), status=document.getElementById('statusBackupLocal');
  if(!exp||!imp||!file||!window.CA_LOCAL)return;
  const stamp=()=>new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  exp.addEventListener('click',()=>{const data=CA_LOCAL.exportData();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`controle-avarias-backup-${stamp()}.json`;a.click();URL.revokeObjectURL(url);if(status)status.textContent=`Backup exportado em ${new Date().toLocaleString('pt-BR')}.`});
  imp.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!confirm('Restaurar este backup substituirá os dados locais atuais. Deseja continuar?'))return;CA_LOCAL.importData(obj);}catch(e){alert(e.message||'Não foi possível restaurar o backup.')}finally{file.value='';}});
})();
