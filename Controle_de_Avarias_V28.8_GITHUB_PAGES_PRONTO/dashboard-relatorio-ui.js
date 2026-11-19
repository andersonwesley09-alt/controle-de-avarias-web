/* V25.1.34 - Interface isolada. Não altera gráficos, cards ou filtros do Dashboard. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const modal=$('modalRelatorioDashboard'), botao=$('btnGerarRelatorioDashboard');
 if(!modal || !botao)return;
 const form=$('drFormulario'), di=$('drDataInicial'), df=$('drDataFinal'), checkbox=$('drUsarFiltros'), aviso=$('drAvisoPeriodo'), resumo=$('drResumo'), erro=$('drErro'), enviar=$('drConfirmar');
 let ocupado=false;
 const obterVisao=()=>document.querySelector('.dashboard-aba-btn.ativo')?.dataset.dashboardAba==='devolucoes'?'caixas':'avarias';
 const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const valor = id => String($(id)?.value||'').trim();
 const isoData = objeto => {
   const d=new Date(obj.movimentadoEm||obj.criadoEm||''); if(Number.isNaN(d.getTime()))return '';
   return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$1-$2');
 };
 function dataLocalISO(valor){
   if(!valor)return '';
   const d=new Date(valor);if(Number.isNaN(d.getTime()))return '';
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
   const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}`;
 }
 function registrosSelecionados(){
   const ini=di.value,fim=df.value,usar=checkbox.checked;
   const todos=typeof avarias==='undefined'?[]:avarias;
   return todos.filter(r=>{
     const data=dataLocalISO(r.movimentadoEm||r.criadoEm);
     if(ini&&(!data||data<ini))return false;
     if(fim&&(!data||data>fim))return false;
     if(!usar)return true;
     if(valor('filtroDashboardCategoria')!=='Todos' && (r.categoria||'Mercearia')!==valor('filtroDashboardCategoria'))return false;
     if(valor('filtroDashboardSetor')!=='Todos' && String(r.setor||'')!==valor('filtroDashboardSetor'))return false;
     if(valor('filtroDashboardMotivo')!=='Todos' && String(r.tipo||'')!==valor('filtroDashboardMotivo'))return false;
     if(valor('filtroDashboardFornecedor')!=='Todos' && String(r.fornecedor||'')!==valor('filtroDashboardFornecedor'))return false;
     if(valor('filtroDashboardStatus')!=='Todos' && String(r.status||'')!==valor('filtroDashboardStatus'))return false;
     const busca=normalizar(valor('filtroDashboardProduto'));
     if(busca&&!normalizar(`${r.codigo||''} ${r.produto||''}`).includes(busca))return false;
     return true;
   });
 }
 function filtrosDescritos(visao){
   const f={'Data inicial':di.value||'Não informada','Data final':df.value||'Não informada'};
   if(visao==='caixas'){
     f['Período']='Estoque atual';delete f['Data inicial'];delete f['Data final'];
     if(checkbox.checked){f.Fornecedor=valor('filtroCaixaFornecedor');f.Categoria=valor('filtroCaixaCategoria');f.Caixa=valor('filtroCaixaNumero');f.Produto=valor('filtroCaixaProduto');}
   } else if(checkbox.checked){
     f.Categoria=valor('filtroDashboardCategoria');f.Setor=valor('filtroDashboardSetor');f.Motivo=valor('filtroDashboardMotivo');f.Fornecedor=valor('filtroDashboardFornecedor');f.Produto=valor('filtroDashboardProduto');f.Status=valor('filtroDashboardStatus');
   }
   return f;
 }
 const filtrosCaixas=()=>checkbox.checked?{
   fornecedor:valor('filtroCaixaFornecedor')||'Todos',categoria:valor('filtroCaixaCategoria')||'Todos',caixa:valor('filtroCaixaNumero')||'Todos',produto:valor('filtroCaixaProduto')
 }:{};
 function atualizarResumo(){
   const caixas=obterVisao()==='caixas';
   aviso.hidden=!caixas;di.disabled=caixas;df.disabled=caixas;
   if(caixas){resumo.textContent='Relatório da posição atual do estoque nas caixas. O servidor aplicará os filtros escolhidos.';return;}
   const arr=registrosSelecionados();const total=arr.reduce((s,a)=>s+Number(a.quantidade||0)*Number(a.valorUnitario||0),0);
   resumo.textContent=`${arr.length.toLocaleString('pt-BR')} lançamento(s) no relatório • ${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} em perdas.`;
 }
 function abrir(){
   di.value=valor('filtroDashboardDataInicial');df.value=valor('filtroDashboardDataFinal');checkbox.checked=true;
   form.reset();checkbox.checked=true;di.value=valor('filtroDashboardDataInicial');df.value=valor('filtroDashboardDataFinal');
   erro.hidden=true;modal.hidden=false;document.body.style.overflow='hidden';atualizarResumo();$('drFechar')?.focus();
 }
 function fechar(){if(ocupado)return;modal.hidden=true;document.body.style.overflow='';botao.focus();}
 botao.addEventListener('click',abrir);
 $('drFechar').addEventListener('click',fechar);$('drCancelar').addEventListener('click',fechar);
 modal.addEventListener('click',e=>{if(e.target===modal)fechar()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)fechar()});
 [di,df,checkbox].forEach(x=>x.addEventListener('change',atualizarResumo));
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(ocupado)return;
  const visao=obterVisao(),tipo=form.querySelector('[name="drTipo"]:checked').value,formato=form.querySelector('[name="drFormato"]:checked').value;
  if(visao==='avarias'&&di.value&&df.value&&di.value>df.value){erro.textContent='A data inicial não pode ser posterior à data final.';erro.hidden=false;return;}
  const selecionados=visao==='avarias'?registrosSelecionados():null;
  if(visao==='avarias'&&(!selecionados.length||selecionados.some(r=>r.id==null))){erro.textContent='Nenhum registro disponível nos filtros. Atualize o Dashboard ou altere o período.';erro.hidden=false;return;}
  if(visao==='avarias'&&selecionados.length>30000){erro.textContent='Há mais de 30.000 registros. Aplique filtros adicionais antes de exportar.';erro.hidden=false;return;}
  erro.hidden=true;ocupado=true;enviar.disabled=true;enviar.textContent='Gerando arquivo...';
  try{
   const ses=typeof obterSessaoDashboardLocal==='function'?obterSessaoDashboardLocal():null;
   const headers={'Content-Type':'application/json'};
   if(ses?.token)headers.Authorization=`Bearer ${ses.token}`;
   const api=typeof API!=='undefined'?API:(window.CA_API_BASE||window.location.origin);
   const r=await fetch(`${api}/api/dashboard/relatorio`,{method:'POST',credentials:'include',cache:'no-store',headers,body:JSON.stringify({visao,tipo,formato,ids:selecionados?.map(r=>String(r.id)),filtros:filtrosDescritos(visao),filtrosCaixas:filtrosCaixas()})});
   if(!r.ok){const p=await r.json().catch(()=>({}));throw new Error(p.erro||`Erro ao gerar arquivo (HTTP ${r.status}).`);}
   const blob=await r.blob();if(!blob.size)throw new Error('O servidor retornou um arquivo vazio.');
   const nome=`relatorio_dashboard_${visao}_${tipo}.${formato}`;
   const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=nome;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   modal.hidden=true;document.body.style.overflow='';
  }catch(ex){console.error('Erro ao gerar relatório do Dashboard',ex);erro.textContent=ex.message||'Erro ao gerar relatório.';erro.hidden=false;}
  finally{ocupado=false;enviar.disabled=false;enviar.textContent='↓ Gerar relatório';}
 });
})();
