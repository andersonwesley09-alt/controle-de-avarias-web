/* Controle de Avarias V28.4: filtro por fornecedor, detalhes da NF e exportação com filtros. */
(()=>{'use strict';
  const root=document.getElementById('abaNfs');if(!root)return;
  const $=id=>document.getElementById(id);
  const el={tabela:$('nfTabela'),pagina:$('nfPagina'),resumo:$('nfResumoTabela'),msg:$('nfMensagem'),modal:$('nfDialog'),form:$('nfFormulario')};
  const st={pagina:1,total:0,registros:[],ocupado:false,anexoId:null,modalItem:null,fornecedoresCarregados:false};
  const base=window.CA_API_BASE || location.origin;
  function pode(k){return window.CA_ACL?.permitido(k)===true;}
  function sessao(){try{return JSON.parse(sessionStorage.getItem('usuarioLogado')||'null')||{}}catch{return {}}}
  function headers(){const token=sessao().token;return token?{Authorization:'Bearer '+token}:{};}
  function alerta(msg,erro=false){el.msg.hidden=!msg;el.msg.textContent=msg||'';el.msg.classList.toggle('erro',erro);}
  function money(x){return Number(x||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
  function dia(x){const s=String(x||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.slice(8)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'-'}
  function iso(x){return String(x||'').slice(0,10)}
  function dataHora(x){if(!x)return '—';const d=new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function statusClass(x){return x==='Pendente'?'nf-pendente':x==='Em análise'?'nf-analise':x==='Resolvida'?'nf-resolvida':'nf-cancelada'}
  function busca(){return new URLSearchParams({pagina:String(st.pagina),busca:$('nfBusca').value.trim(),fornecedor:$('nfFornecedorFiltro').value,situacao:$('nfSituacao').value,inicio:$('nfInicio').value,fim:$('nfFim').value})}
  async function request(path,options={}){
    const opts={credentials:'include',cache:'no-store',...options};opts.headers={...headers(),...(options.headers||{})};
    const resp=await fetch(base+path,opts);
    if(resp.status===401){alerta('Sua sessão expirou. Faça login novamente.',true);throw new Error('Sessão expirada.')}
    if(!resp.ok){const d=await resp.json().catch(()=>({}));throw new Error(d.erro||'Falha de comunicação HTTP '+resp.status)}
    return resp;
  }
  function atualizarAcoes(){
    $('nfNova').hidden=!pode('nfs.criar');$('nfImportarLabel').hidden=!pode('nfs.criar');$('nfExportar').hidden=!pode('nfs.exportar');
  }
  async function carregarFornecedores(){
    const resp=await request('/api/nfs-pendentes/fornecedores');
    const dados=await resp.json();
    const lista=Array.isArray(dados.fornecedores)?dados.fornecedores:[];
    const seletor=$('nfFornecedorFiltro'),atual=seletor.value;
    seletor.replaceChildren(new Option('Todos os fornecedores',''),...lista.map(nome=>new Option(nome,nome)));
    // A seleção continua aplicada até mesmo quando a última NF do fornecedor é editada ou excluída.
    if(atual&&!lista.includes(atual))seletor.add(new Option(atual,atual));
    seletor.value=atual;
    st.fornecedoresCarregados=true;
  }
  async function baixarAnexo(item){
    if(!item?.anexo_nome)return;
    const resp=await request('/api/nfs-pendentes/'+encodeURIComponent(item.id)+'/anexo');
    const file=await resp.blob();const url=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=url;a.download=item.anexo_nome;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function renderizar(){
    el.tabela.innerHTML=st.registros.length?st.registros.map(r=>{
      const status=escape(r.situacao==='Resolvida'?'Resolvido':r.situacao),id=Number(r.id);
      return `<tr><td><button type="button" class="nf-numero-link" data-id="${id}" data-act="ver" title="Ver todos os detalhes da NF">${escape(r.numero)}</button>${r.serie?`<small> / ${escape(r.serie)}</small>`:''}</td><td>${dia(r.emissao)}</td><td>${escape(r.fornecedor)}</td><td>${money(r.valor)}</td><td>${escape(r.motivo)}</td><td><span class="nf-pill ${statusClass(r.situacao)}">${status}</span></td><td>${escape(r.responsavel||'—')}</td><td><div class="nf-miniacoes"><button data-id="${id}" data-act="ver" title="Consultar nota">Consultar</button>${pode('nfs.editar')?`<button data-id="${id}" data-act="editar">Editar</button><button data-id="${id}" data-act="anexar" title="Anexar PDF/XML">Anexar</button>`:''}${r.anexo_nome?`<button data-id="${id}" data-act="arquivo" title="Baixar arquivo anexo">PDF/XML</button>`:''}${pode('nfs.excluir')?`<button class="ameaça" data-id="${id}" data-act="excluir">Excluir</button>`:''}</div></td></tr>`;
    }).join(''):'<tr><td class="nf-vazio" colspan="8">Nenhuma NF encontrada para os filtros selecionados.</td></tr>';
    const max=Math.max(1,Math.ceil(st.total/25));el.pagina.textContent=`Página ${st.pagina} de ${max}`;
    el.resumo.textContent=`${st.total.toLocaleString('pt-BR')} nota(s) encontrada(s)`;$('nfAnterior').disabled=st.pagina<=1;$('nfProximo').disabled=st.pagina>=max;
  }
  async function carregar(){
    if(st.ocupado)return;
    atualizarAcoes();if(!pode('nfs.consultar')){alerta('Sem permissão para consultar NFs pendentes.',true);return;}
    st.ocupado=true;el.resumo.textContent='Carregando...';
    try{
      if(!st.fornecedoresCarregados)await carregarFornecedores().catch(e=>console.warn('Filtro de fornecedores indisponível:',e.message));
      const r=await request('/api/nfs-pendentes?'+busca());const d=await r.json();st.registros=d.registros||[];st.total=d.total||0;
      $('nfQtdPendentes').textContent=d.indicadores?.pendentes??0;$('nfQtdTotal').textContent=d.indicadores?.total??0;$('nfQtdResolvidas').textContent=d.indicadores?.resolvidas??0;$('nfValorAberto').textContent=money(d.indicadores?.valor_aberto||0);renderizar();alerta('');
    }catch(e){alerta(e.message,true);el.resumo.textContent='Erro ao carregar — tente novamente.';}finally{st.ocupado=false;}
  }
  const campos=['numero','serie','fornecedor','emissao','valor','prazo','motivo','responsavel','situacao','observacao'];
  function abrir(item,consulta=false){el.form.reset();st.modalItem=item||null;$('nfId').value=item?.id||'';
    const seletorSituacao=el.form.elements.namedItem('situacao');
    seletorSituacao.querySelector('option[data-legado]')?.remove();
    campos.forEach(k=>{const inp=el.form.elements.namedItem(k);if(inp)inp.value=(k==='emissao'||k==='prazo')?iso(item?.[k]):(k==='situacao'&&!item?'Pendente':item?.[k]??'');});
    // Preserva o status histórico em modo consulta. Para editar registros antigos,
    // exige escolha explícita entre Pendente e Resolvido, sem conversão silenciosa.
    if(item && !['Pendente','Resolvida'].includes(item.situacao)){
      const legado=new Option(item.situacao+' (situação anterior — escolha uma nova)',consulta?item.situacao:'',true,true);
      legado.dataset.legado='1';legado.disabled=!consulta;
      seletorSituacao.add(legado,0);
    }
    $('nfDialogTitulo').textContent=consulta?'Consultar NF':item?'Editar NF pendente':'Nova pendência';
    el.form.querySelectorAll('input:not([type=hidden]),select,textarea').forEach(x=>x.disabled=consulta);
    $('nfSalvar').hidden=consulta;
    const info=$('nfDadosRegistro');info.hidden=!item;
    if(item){
      info.textContent=`Cadastrada por: ${item.criado_por||'Não informado'}  |  Criada em: ${dataHora(item.criado_em)}  |  Atualizada em: ${dataHora(item.atualizado_em)}  |  Anexo: ${item.anexo_nome||'Nenhum'}`;
    }
    $('nfBaixarAnexo').hidden=!item?.anexo_nome;
    el.modal.showModal();
  }
  $('nfNova').addEventListener('click',()=>{if(pode('nfs.criar'))abrir(null)});
  $('nfCancelar').addEventListener('click',()=>el.modal.close());
  $('nfBaixarAnexo').addEventListener('click',async()=>{try{await baixarAnexo(st.modalItem)}catch(e){alerta(e.message,true)}});
  // No cadastro/edição, Enter no Número da NF avança para Série, sem enviar o formulário.
  el.form.addEventListener('keydown', e=>{
    if(e.key !== 'Enter' || e.isComposing || e.repeat) return;
    if(e.target !== el.form.elements.namedItem('numero')) return;
    e.preventDefault();
    const serie=el.form.elements.namedItem('serie');
    if(serie && !serie.disabled) serie.focus();
  });
  el.form.addEventListener('submit',async e=>{e.preventDefault();const id=$('nfId').value;if(!pode(id?'nfs.editar':'nfs.criar'))return alerta('Sem autorização para salvar.',true);
    const body=Object.fromEntries(campos.map(k=>[k,el.form.elements.namedItem(k).value]));
    // Converter dinheiro para número sem remover ponto decimal do input type=number.
    body.valor=Number(body.valor);
    const btn=$('nfSalvar');btn.disabled=true;try{await request(id?'/api/nfs-pendentes/'+encodeURIComponent(id):'/api/nfs-pendentes',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});el.modal.close();st.fornecedoresCarregados=false;await carregar();alerta('Pendência salva com sucesso.');}catch(err){alerta(err.message,true);}finally{btn.disabled=false;}
  });
  el.tabela.addEventListener('click',async e=>{const b=e.target.closest('button[data-act]');if(!b)return;const r=st.registros.find(x=>String(x.id)===b.dataset.id);if(!r)return;
    try{
      if(b.dataset.act==='ver'){abrir(r,true)}
      if(b.dataset.act==='editar'&&pode('nfs.editar'))abrir(r);
      if(b.dataset.act==='anexar'&&pode('nfs.editar')){st.anexoId=r.id;$('nfAnexoEscolha').click()}
      if(b.dataset.act==='arquivo'&&r.anexo_nome)await baixarAnexo(r);
      if(b.dataset.act==='excluir'&&pode('nfs.excluir')){
        if(!confirm(`Excluir a pendência da NF ${r.numero}? Essa ação será registrada na auditoria.`))return;
        await request('/api/nfs-pendentes/'+encodeURIComponent(r.id),{method:'DELETE'});st.fornecedoresCarregados=false;await carregar();alerta('Pendência excluída.');
      }
    }catch(err){alerta(err.message,true)}
  });
  $('nfAnexoEscolha').addEventListener('change',async e=>{const f=e.target.files?.[0],id=st.anexoId;e.target.value='';if(!f||!id)return;
    const form=new FormData();form.append('arquivo',f);try{await request(`/api/nfs-pendentes/${encodeURIComponent(id)}/anexo`,{method:'POST',body:form});await carregar();alerta('Documento anexado com sucesso.');}catch(err){alerta(err.message,true)}
  });
  $('nfArquivoImportacao').addEventListener('change',async e=>{const f=e.target.files?.[0];e.target.value='';if(!f||!pode('nfs.criar'))return;
    if(!confirm('Importar notas fiscais desta planilha? NFs repetidas serão ignoradas.'))return;
    const fd=new FormData();fd.append('arquivo',f);try{const r=await request('/api/nfs-pendentes/importar',{method:'POST',body:fd});const d=await r.json();st.pagina=1;st.fornecedoresCarregados=false;await carregar();alerta(`Importação: ${d.novos} nova(s), ${d.duplicados} duplicada(s).`);}catch(err){alerta(err.message,true)}
  });
  $('nfFiltrar').addEventListener('click',()=>{st.pagina=1;carregar()});$('nfBusca').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();st.pagina=1;carregar()}});
  $('nfLimpar').addEventListener('click',()=>{['nfBusca','nfFornecedorFiltro','nfSituacao','nfInicio','nfFim'].forEach(id=>$(id).value='');st.pagina=1;carregar()});
  $('nfAnterior').addEventListener('click',()=>{if(st.pagina>1){st.pagina--;carregar()}});$('nfProximo').addEventListener('click',()=>{if(st.pagina*25<st.total){st.pagina++;carregar()}});
  $('nfExportar').addEventListener('click',async()=>{if(!pode('nfs.exportar'))return;try{const query=busca();query.delete('pagina');const r=await request('/api/nfs-pendentes/exportar?'+query);const blob=await r.blob();const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='nfs_pendentes.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch(e){alerta(e.message,true)}});
  window.NFsPendentes={carregar};
})();
