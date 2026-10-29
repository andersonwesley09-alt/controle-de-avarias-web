/* V25.1.28 — API demonstrativa de Recuperações, Doações e Documentos.
   Sem acesso a servidor: dados ficam somente no sessionStorage do navegador.
   Não substitui a API PostgreSQL em produção. */
(() => {
  'use strict';
  const prefix = 'ca_demo_v25128_', get = (k,d=[]) => {try{return JSON.parse(sessionStorage.getItem(prefix+k))??d;}catch{return d;}},
    set = (k,v) => sessionStorage.setItem(prefix+k, JSON.stringify(v));
  const now = () => new Date().toISOString(), today=()=>new Date().toISOString().slice(0,10),
    uuid = ()=> (typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2));
  const n=v=>{const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)?x:0;};
  const err=(msg,status=400)=>reply({erro:msg},status),reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  const parse=async opt=>{try{if(typeof opt?.body==='string') return JSON.parse(opt.body);return opt?.body||{};}catch{return {};}},
    username=()=>{try{return JSON.parse(sessionStorage.getItem('usuarioLogado')||'{}').usuario||'admin';}catch{return 'admin';}},
    admin=()=>{try{return JSON.parse(sessionStorage.getItem('usuarioLogado')||'{}').perfil==='admin';}catch{return false;}};
  const types={recuperacoes:{key:'rec',tag:'REC',list:'recuperacoes'},doacoes:{key:'do',tag:'DOA',list:'doacoes'}};
  const docName=(type,num)=>`${type.tag}-${String(num).padStart(4,'0')}`;
  const docs=type=>get(type.key+'Docs',[]),items=type=>get(type.key+'Items',[]);
  const saveDocs=(t,a)=>set(t.key+'Docs',a), saveItems=(t,a)=>set(t.key+'Items',a);
  const openDoc=(type,data)=>{
    let a=docs(type),d=a.find(x=>x.status==='ABERTO'&&x.dataDocumento===data);
    if(d)return d;
    const numero=Math.max(0,...a.map(x=>n(x.numero)))+1;
    d={id:uuid(),numero,documento:docName(type,numero),dataDocumento:data||today(),status:'ABERTO',beneficiario:'',criadoEm:now(),registros:0};a.unshift(d);saveDocs(type,a);return d;
  };
  const findDoc=(type,id)=>docs(type).find(x=>String(x.id)===String(id));
  const docWithTotal=(type,d)=>{const rows=items(type).filter(x=>String(x.documentoId)===String(d.id));return {...d,registros:rows.length,
    quantidadeRecuperada:rows.reduce((v,x)=>v+n(x.quantidade),0),valorRecuperado:rows.reduce((v,x)=>v+n(x.valorRecuperado),0),
    quantidadeDoada:rows.reduce((v,x)=>v+n(x.quantidade),0),valorDoado:rows.reduce((v,x)=>v+n(x.valorTotal),0)};};
  const matches=(v,q)=>String(v??'').toLowerCase().includes(String(q??'').toLowerCase());
  const queryRows=(t,q,documentMode=false)=>{
    let a=(documentMode?docs(t).map(d=>docWithTotal(t,d)):items(t)).slice();
    const di=q.get('dataInicio')||q.get('dataInicial')||'',df=q.get('dataFim')||q.get('dataFinal')||'', busca=q.get('busca')||'',fornecedor=q.get('fornecedor')||'',did=q.get('documentoId')||'';
    a=a.filter(x=>{
      let data=String((documentMode?x.dataDocumento:x.dataDoacao||x.criadoEm)||'').slice(0,10);
      if(di&&data<di||df&&data>df)return false;
      if(did&&String(x.documentoId)!==did&&!documentMode)return false;
      if(fornecedor&&!matches(x.fornecedor,fornecedor))return false;
      if(busca&&!['codigo','produto','fornecedor','beneficiario','documento'].some(k=>matches(x[k],busca)))return false;
      return true;
    });
    const dir=q.get('dir')==='asc'?1:-1;
    a.sort((x,y)=>dir*String(x.dataDocumento||x.criadoEm||'').localeCompare(String(y.dataDocumento||y.criadoEm||'')));
    const total=a.length,page=Math.max(1,n(q.get('page'))||1),limit=Math.min(1000,Math.max(1,n(q.get('limit'))||25));
    const meta={total,page,limit,totalPaginas:Math.max(1,Math.ceil(total/limit))};
    return {rows:a.slice((page-1)*limit,page*limit),all:a,meta};
  };
  const product=code=>{try{return (JSON.parse(sessionStorage.getItem('produtos')||'[]')||[]).find(p=>p.codigo===code&&p.ativo!==false);}catch{return null;}};
  const source=()=>{try{return JSON.parse(sessionStorage.getItem('avarias')||'[]')||[];}catch{return [];}};
  function pdfBlob(titulo, linhas){
    const esc=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ').replace(/[\\()]/g,'\\$&').slice(0,112);
    const text=['BT /F1 15 Tf 38 792 Td ('+esc(titulo)+') Tj ET'];let y=760;
    for(const s of linhas.slice(0,46)){text.push(`BT /F1 9 Tf 38 ${y} Td (${esc(s)}) Tj ET`);y-=15;}
    const stream=text.join('\n')+'\n',objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [5 0 R] /Count 1 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}endstream`,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>'];
    let raw='%PDF-1.4\n',off=[0];for(let i=0;i<objs.length;i++){off.push(raw.length);raw+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}let xr=raw.length;raw+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(const o of off.slice(1))raw+=`${String(o).padStart(10,'0')} 00000 n \n`;raw+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
    return new Blob([raw],{type:'application/pdf'});
  }
  const blobResponse=(blob)=>new Response(blob,{status:200,headers:{'Content-Type':blob.type}});
  const documentPdf=(t,id)=>{
    const d=findDoc(t,id);if(!d)return err('Documento não encontrado.',404);
    const a=items(t).filter(x=>String(x.documentoId)===String(id));if(!a.length)return err('Documento sem produtos.',404);
    const linhas=[`Documento: ${d.documento}`,`Data: ${d.dataDocumento}`,`Status: ${d.status}`,`Beneficiario: ${d.beneficiario||'-'}`,' ','PRODUTOS',...a.map((x,i)=>`${i+1}. ${x.produto} | ${x.codigo} | Quantidade: ${x.quantidade} | R$ ${(x.valorTotal||x.valorRecuperado||0).toFixed(2)}`),' ','DOCUMENTO DEMONSTRATIVO - SEM VALIDADE OPERACIONAL'];
    return blobResponse(pdfBlob(`CONTROLE DE AVARIAS - ${t.tag}`,linhas));
  };
  const listExport=(t,kind,body)=>{
    const a=queryRows(t,new URLSearchParams({...body.filtros,page:1,limit:1000})).all;
    const out=a.map(x=>({Data:x.dataDoacao||x.criadoEm,Codigo:x.codigo,Produto:x.produto,Fornecedor:x.fornecedor,Quantidade:x.quantidade,Valor:x.valorTotal||x.valorRecuperado||0,Beneficiario:x.beneficiario||''}));
    if(kind==='xlsx'&&window.XLSX){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out),t.tag);return blobResponse(new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));}
    return blobResponse(pdfBlob(`${t.tag} - EXPORTACAO DEMONSTRATIVA`,['Itens: '+out.length,...out.map(x=>`${x.Data} - ${x.Produto} | Qtd: ${x.Quantidade} | R$ ${x.Valor}`)]));
  };
  async function route(path,method,q,body){
    if(path==='/api/avarias/encaminhar-doacao'&&method==='POST'){
      const req=Array.isArray(body.itens)?body.itens:[],beneficiario=String(body.beneficiario||'').trim();if(!beneficiario||!req.length)return err('Informe beneficiário e selecione produtos.');
      const t=types.doacoes,origens=source(),lista=items(t),propostos=[];
      if(new Set(req.map(x=>x.avariaId)).size!==req.length)return err('Seleção repetida.');
      for(const x of req){const origem=origens.find(y=>String(y.id)===String(x.avariaId));if(!origem)return err('Registro original não encontrado.',404);
        const used=lista.filter(y=>String(y.origemAvariaId)===String(origem.id)).reduce((v,y)=>v+n(y.quantidade),0),quant=n(x.quantidade);
        if(quant<=0||used+quant>n(origem.quantidade)+1e-8)return err('Quantidade indisponível para '+origem.produto+'.',409);
        propostos.push({origem,quant});}
      const atual=docs(t).find(x=>x.dataDocumento===today()&&x.status==='ABERTO');if(atual?.beneficiario&&atual.beneficiario!==beneficiario)return err(`Finalize ${atual.documento} antes de cadastrar outro beneficiário.`,409);
      const d=openDoc(t,today()), ds=docs(t);ds.find(x=>x.id===d.id).beneficiario=beneficiario;saveDocs(t,ds);
      for(const {origem,quant} of propostos)lista.unshift({id:uuid(),documentoId:d.id,origemAvariaId:origem.id,codigo:origem.codigo,produto:origem.produto,fornecedor:origem.fornecedor,categoria:origem.categoria,quantidade:quant,valorUnitario:n(origem.valorUnitario),valorTotal:quant*n(origem.valorUnitario),dataDoacao:today(),beneficiario,usuarioLancamento:username(),observacao:body.observacao||'',criadoEm:now()});
      saveItems(t,lista);return reply({ok:true,documentoId:d.id,documento:d.documento,quantidadeItens:propostos.length},201);
    }
    // Avisos demonstrativos (somente sessão atual).
    if(path==='/api/avisos'){
      if(method==='GET')return reply({ok:true,avisos:get('avisos',[])});
      if(method==='POST'){if(!admin())return err('Somente administrador pode publicar avisos.',403);
        const a=get('avisos',[]),x={id:uuid(),titulo:String(body.titulo||''),mensagem:String(body.mensagem||''),usuario:username(),criadoEm:now()};a.unshift(x);set('avisos',a);return reply({ok:true,aviso:x},201);}
    }
    let aviso=path.match(/^\/api\/avisos\/([^/]+)$/);
    if(aviso&&method==='DELETE'){if(!admin())return err('Somente administrador pode excluir.',403);set('avisos',get('avisos',[]).filter(x=>String(x.id)!==decodeURIComponent(aviso[1])));return reply({ok:true});}
    // Documentos da vitrine: arquivos pequenos apenas no navegador, sem upload para servidor.
    if(path==='/api/documentos'){
      if(method==='GET')return reply(get('documentos',[]).map(({arquivoBase64,...x})=>x));
      if(method==='POST'){
        if(!(body instanceof FormData))return err('Dados de documento inválidos.');
        const file=body.get('arquivo');if(!file||!file.size)return err('Selecione um arquivo PDF ou Excel.');
        if(file.size>1000000)return err('Na vitrine, arquivos devem ter até 1 MB.');
        const binary=new Uint8Array(await file.arrayBuffer());let str='';for(let i=0;i<binary.length;i++)str+=String.fromCharCode(binary[i]);
        const obj={id:uuid(),nome:String(body.get('nome')||''),descricao:String(body.get('descricao')||''),categoria:String(body.get('categoria')||'Outros'),tipo:/\.pdf$/i.test(file.name)?'pdf':'excel',arquivoNome:file.name,tamanho:file.size,favorito:false,atualizadoEm:now(),arquivoBase64:btoa(str)};
        const docsLocal=get('documentos',[]);docsLocal.unshift(obj);set('documentos',docsLocal);return reply({...obj,arquivoBase64:undefined},201);
      }
    }
    const files=path.match(/^\/api\/documentos\/([^/]+)(?:\/(arquivo|favorito))?$/);
    if(files){const docId=decodeURIComponent(files[1]),mode=files[2],a=get('documentos',[]),idx=a.findIndex(x=>String(x.id)===docId);if(idx<0)return err('Documento não encontrado.',404);
      if(mode==='arquivo'&&method==='GET'){
        const binary=atob(a[idx].arquivoBase64||''),arr=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)arr[i]=binary.charCodeAt(i);
        return blobResponse(new Blob([arr],{type:a[idx].tipo==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      }
      if(mode==='favorito'&&method==='PATCH'){a[idx].favorito=!!body.favorito;set('documentos',a);return reply({ok:true});}
      if(!mode&&method==='DELETE'){a.splice(idx,1);set('documentos',a);return reply({ok:true});}
      if(!mode&&method==='PUT'){
        if(!(body instanceof FormData))return err('Formulário inválido.');
        for(const key of ['nome','descricao','categoria'])a[idx][key]=String(body.get(key)||'');
        const file=body.get('arquivo');if(file&&file.size){if(file.size>1000000)return err('Limite de 1 MB na vitrine.');
          const binary=new Uint8Array(await file.arrayBuffer());let str='';for(const ch of binary)str+=String.fromCharCode(ch);
          a[idx].arquivoBase64=btoa(str);a[idx].arquivoNome=file.name;a[idx].tamanho=file.size;a[idx].tipo=/\.pdf$/i.test(file.name)?'pdf':'excel';}
        a[idx].atualizadoEm=now();set('documentos',a);return reply({ok:true});
      }
    }
    const m=path.match(/^\/api\/(recuperacoes|doacoes)(?:\/(.*))?$/);if(!m)return null;
    const t=types[m[1]],rest=m[2]||'';let d,a;
    if(rest==='documento/abrir'&&method==='POST')return reply({ok:true,documento:docWithTotal(t,openDoc(t,body.data||today()))});
    if(rest==='documento/info'&&method==='GET')return (d=findDoc(t,q.get('id')))?reply({ok:true,documento:docWithTotal(t,d)}):err('Documento não encontrado.',404);
    if(rest==='documento'&&method==='GET')return documentPdf(t,q.get('id'));
    if(rest==='documentos'&&method==='GET'){
      const result=queryRows(t,q,true),all=result.all,resumo={documentos:result.meta.total,
        quantidadeRecuperada:all.reduce((v,x)=>v+x.quantidadeRecuperada,0),valorRecuperado:all.reduce((v,x)=>v+x.valorRecuperado,0),
        quantidadeDoada:all.reduce((v,x)=>v+x.quantidadeDoada,0),valorDoado:all.reduce((v,x)=>v+x.valorDoado,0)};
      return reply({...result.meta,documentos:result.rows,resumo});
    }
    if(rest==='documento/finalizar'&&method==='POST'){
      d=findDoc(t,body.documentoId);if(!d)return err('Documento não encontrado.',404);if(d.status==='FINALIZADO')return err('Documento já finalizado.',409);
      if(!items(t).some(x=>String(x.documentoId)===String(d.id)))return err('Não é possível finalizar um documento sem produtos.');
      a=docs(t);a.find(x=>x.id===d.id).status='FINALIZADO';saveDocs(t,a);return reply({ok:true,documento:docWithTotal(t,findDoc(t,d.id))});
    }
    let mm=rest.match(/^documentos\/([^/]+)$/);
    if(mm&&method==='DELETE'){
      if(!admin())return err('Somente administrador pode excluir documentos.',403);
      d=findDoc(t,decodeURIComponent(mm[1]));if(!d)return err('Documento não encontrado.',404);
      saveDocs(t,docs(t).filter(x=>x.id!==d.id));saveItems(t,items(t).filter(x=>x.documentoId!==d.id));return reply({ok:true,documento:d.documento});
    }
    mm=rest.match(/^documento\/([^/]+)$/);
    if(mm&&method==='PATCH'){
      d=findDoc(t,decodeURIComponent(mm[1]));if(!d)return err('Documento não encontrado.',404);
      if(d.status==='FINALIZADO')return err('Documento finalizado.',409);
      const b=String(body.beneficiario||'').trim();if(!b)return err('Beneficiário obrigatório.');
      const arr=docs(t);arr.find(x=>x.id===d.id).beneficiario=b;saveDocs(t,arr);
      const it=items(t);it.filter(x=>x.documentoId===d.id).forEach(x=>x.beneficiario=b);saveItems(t,it);
      return reply({ok:true,documento:docWithTotal(t,findDoc(t,d.id))});
    }
    if(rest==='exportar-pdf'&&method==='POST')return listExport(t,'pdf',body);
    if(rest==='exportar-xlsx'&&method==='POST')return listExport(t,'xlsx',body);
    if(!rest&&method==='GET'){const x=queryRows(t,q);return reply({...x.meta,registros:x.rows});}
    if(!rest&&method==='POST'){
      const p=product(String(body.codigo||''));if(!p)return err('Produto não encontrado. Use um código fictício da vitrine.',404);
      const qty=n(body.quantidade);if(qty<=0)return err('Quantidade deve ser maior que zero.');
      d=t===types.doacoes&&body.documentoId?findDoc(t,body.documentoId):openDoc(t,body.dataDoacao||today());
      if(!d||d.status==='FINALIZADO')return err('Documento finalizado ou inexistente.',409);
      if(t===types.doacoes){const beneficiario=String(body.beneficiario||'').trim();if(!beneficiario)return err('Informe o beneficiário.');
        if(d.beneficiario&&d.beneficiario!==beneficiario)return err('Este documento já pertence a outro beneficiário.');
        const ds=docs(t);ds.find(x=>x.id===d.id).beneficiario=beneficiario;saveDocs(t,ds);}
      const item={id:uuid(),documentoId:d.id,documento:d.documento,codigo:p.codigo,produto:p.descricao||p.produto,fornecedor:p.fornecedor,codigoFornecedor:p.codigoFornecedor,categoria:p.categoria,
        quantidade:qty,quantidadeRecuperada:qty,valorUnitario:n(p.valorCusto),valorTotal:qty*n(p.valorCusto),valorRecuperado:qty*n(p.valorCusto),beneficiario:body.beneficiario||'',observacao:body.observacao||'',usuarioLancamento:username(),dataDoacao:body.dataDoacao||today(),criadoEm:now()};
      a=items(t);a.unshift(item);saveItems(t,a);
      return reply({...item,documentoId:d.id,documento:d.documento,documentoStatus:d.status,documentoGerado:true},201);
    }
    mm=rest.match(/^([^/]+)$/);
    if(mm&&(method==='PUT'||method==='DELETE')){
      const rid=decodeURIComponent(mm[1]),it=items(t),idx=it.findIndex(x=>String(x.id)===rid);if(idx<0)return err('Lançamento não encontrado.',404);
      d=findDoc(t,it[idx].documentoId);if(d?.status==='FINALIZADO')return err('Documento finalizado.',409);
      if(method==='DELETE'){it.splice(idx,1);saveItems(t,it);return reply({ok:true,documentoAtualizado:true});}
      const qty=n(body.quantidade);if(qty<=0)return err('Quantidade deve ser maior que zero.');
      it[idx].quantidade=qty;it[idx].quantidadeRecuperada=qty;it[idx].valorTotal=qty*n(it[idx].valorUnitario);it[idx].valorRecuperado=it[idx].valorTotal;it[idx].observacao=body.observacao||'';saveItems(t,it);return reply({ok:true,...it[idx]});
    }
    return null;
  }
  const priorFetch=window.fetch.bind(window);
  window.fetch=async function(input,options={}){
    const url=typeof input==='string'?input:input?.url||'',u=new URL(url,location.href),p=u.pathname;
    // Mostra corretamente o saldo já encaminhado no botão de Doações dos Registros.
    if(p==='/api/avarias'&&String(options.method||'GET').toUpperCase()==='GET'){
      const response=await priorFetch(input,options);
      if(!response.ok)return response;
      const arr=await response.json();
      if(!Array.isArray(arr))return reply(arr);
      const doados=items(types.doacoes);
      return reply(arr.map(x=>({...x,quantidadeDoada:doados.filter(y=>String(y.origemAvariaId)===String(x.id)).reduce((s,y)=>s+n(y.quantidade),0)})));
    }
    if(p.startsWith('/api/recuperacoes')||p.startsWith('/api/doacoes')||p.startsWith('/api/avisos')||p.startsWith('/api/documentos')||p==='/api/avarias/encaminhar-doacao'){
      try {const r=await route(p,String(options.method||'GET').toUpperCase(),u.searchParams,await parse(options));if(r)return r;}catch(e){console.error('Demo docs',e);return err('Falha na demonstração: '+e.message,500);}
    }
    return priorFetch(input,options);
  };
})();
