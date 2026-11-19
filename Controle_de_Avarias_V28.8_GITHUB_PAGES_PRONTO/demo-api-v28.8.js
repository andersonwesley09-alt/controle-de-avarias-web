/* Controle de Avarias V28.8 — extensão da demonstração estática GitHub Pages.
 * Sem Node.js, PostgreSQL, cookies reais, acesso à rede da empresa ou dados operacionais.
 * Dados exclusivamente FICTÍCIOS, armazenados em sessionStorage deste navegador.
 */
(()=>{'use strict';
  window.CA_LOCAL_MODE=true; window.CA_API_BASE='';
  const anterior=window.fetch.bind(window);
  const KEY='ca_demo_v288_nfs', DOC='ca_demo_v288_docs', AVISOS='ca_demo_v288_avisos';
  const ler=(k,def=[])=>{try{const x=JSON.parse(sessionStorage.getItem(k)||'null');return x===null?def:x;}catch{return def}};
  const salvar=(k,v)=>sessionStorage.setItem(k,JSON.stringify(v));
  const resposta=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json;charset=utf-8'}});
  const hoje=new Date().toISOString().slice(0,10);
  const dias=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
  const autentica=()=>{try{return JSON.parse(sessionStorage.getItem('usuarioLogado')||'null')}catch{return null}};
  const texto=(v)=>String(v??'').trim();
  const slug=(v)=>texto(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const agora=()=>new Date().toISOString();
  const proximo=(rows)=>Math.max(0,...rows.map(x=>Number(x.id)||0))+1;
  const copiar=(x)=>JSON.parse(JSON.stringify(x));
  const bloba=(blob,tipo='application/octet-stream')=>new Response(blob,{headers:{'Content-Type':tipo}});
  const erro=(msg,st=400)=>resposta({erro:msg},st);
  const fazArquivo=async(file)=>new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(Error('Falha ao ler anexo.'));rd.readAsDataURL(file)});
  const seedNfs=[
    {id:1,numero:'100101',serie:'1',fornecedor:'FORNECEDOR DEMO A',emissao:dias(-9),valor:68,prazo:dias(3),motivo:'Conferência de devolução',responsavel:'Operação Demo',situacao:'Pendente',observacao:'Exemplo fictício para teste do módulo'},
    {id:2,numero:'100102',serie:'2',fornecedor:'FORNECEDOR DEMO B',emissao:dias(-7),valor:152.9,prazo:dias(2),motivo:'Divergência na mercadoria',responsavel:'Compras Demo',situacao:'Pendente',observacao:''},
    {id:3,numero:'100103',serie:'1',fornecedor:'FORNECEDOR DEMO A',emissao:dias(-5),valor:319.7,prazo:dias(-1),motivo:'Nota de devolução aguardando retorno',responsavel:'Compras Demo',situacao:'Resolvida',observacao:'Resolvida para demonstrar indicadores'},
    {id:4,numero:'100104',serie:'3',fornecedor:'FORNECEDOR DEMO C',emissao:dias(-3),valor:49.5,prazo:dias(6),motivo:'Validação documental',responsavel:'Operação Demo',situacao:'Pendente',observacao:''},
    {id:5,numero:'100105',serie:'1',fornecedor:'FORNECEDOR DEMO B',emissao:dias(-2),valor:220,prazo:dias(8),motivo:'Acerto com fornecedor',responsavel:'Financeiro Demo',situacao:'Resolvida',observacao:''},
    {id:6,numero:'100106',serie:'1',fornecedor:'FORNECEDOR DEMO C',emissao:hoje,valor:87.25,prazo:dias(10),motivo:'Aguardando documento complementar',responsavel:'Financeiro Demo',situacao:'Pendente',observacao:''}
  ].map(x=>({...x,anexo_nome:null,anexo_tipo:null,criado_por:'admin',criado_em:agora(),atualizado_em:agora()}));
  if(!sessionStorage.getItem(KEY))salvar(KEY,seedNfs);
  if(!sessionStorage.getItem(DOC))salvar(DOC,[]);
  if(!sessionStorage.getItem(AVISOS))salvar(AVISOS,[]);

  // Amostra fictícia para não deixar o Dashboard vazio na primeira visita.
  if(!sessionStorage.getItem('ca_demo_v288_avarias_seed')){
    if(ler('avarias',[]).length===0){
      const amostras=[
        {id:'av-demo-1',codigo:'DEMO001',produto:'PRODUTO EXEMPLO A',fornecedor:'FORNECEDOR FICTÍCIO',codigoFornecedor:'101',categoria:'Mercearia',quantidade:3,valorUnitario:6.5,setor:'Loja',tipo:'Produto avariado',status:'Pendente',usuarioLancamento:'admin',criadoEm:dias(-4)+'T12:00:00',movimentadoEm:null},
        {id:'av-demo-2',codigo:'DEMO002',produto:'PRODUTO EXEMPLO B',fornecedor:'FORNECEDOR FICTÍCIO',codigoFornecedor:'102',categoria:'Frios',quantidade:8,valorUnitario:4.8,setor:'Frios',tipo:'Próximo do vencimento',status:'Baixa',usuarioLancamento:'admin',criadoEm:dias(-3)+'T12:00:00',movimentadoEm:dias(-2)+'T12:00:00'},
        {id:'av-demo-3',codigo:'DEMO003',produto:'PRODUTO EXEMPLO C',fornecedor:'FORNECEDOR FICTÍCIO',codigoFornecedor:'103',categoria:'Bebidas',quantidade:5,valorUnitario:3.1,setor:'Loja',tipo:'Produto avariado',status:'Pendente',usuarioLancamento:'admin',criadoEm:dias(-1)+'T12:00:00',movimentadoEm:null},
        {id:'av-demo-4',codigo:'DEMO001',produto:'PRODUTO EXEMPLO A',fornecedor:'FORNECEDOR FICTÍCIO',codigoFornecedor:'101',categoria:'Mercearia',quantidade:2,valorUnitario:6.5,setor:'Estoque',tipo:'Furado',status:'Baixa',usuarioLancamento:'admin',criadoEm:dias(-1)+'T12:00:00',movimentadoEm:agora()}
      ];salvar('avarias',amostras);salvar('historicoAvarias',amostras);
    }
    sessionStorage.setItem('ca_demo_v288_avarias_seed','1');
  }

  const auditoria=(acao,antes,depois)=>{const k='auditoria',a=ler(k,[]);const d=depois||antes||{};a.unshift({id:`NF-DEMO-${Date.now()}`,criadoEm:agora(),usuario:autentica()?.usuario||'demo',acao,entidade:'NF_PENDENTE',registroId:String(d.id||''),detalhes:`NF ${d.numero||''}: ${acao.toLowerCase()} no ambiente demonstrativo`,antes:antes||null,depois:depois||null});salvar(k,a)};
  const lista=()=>ler(KEY,[]);
  const norm=(x)=>{const r={numero:texto(x.numero).slice(0,40),serie:texto(x.serie).slice(0,20),fornecedor:texto(x.fornecedor).slice(0,200),emissao:texto(x.emissao).slice(0,10),valor:Number(x.valor),prazo:texto(x.prazo).slice(0,10)||null,motivo:texto(x.motivo).slice(0,500),responsavel:texto(x.responsavel).slice(0,150),situacao:x.situacao==='Resolvido'?'Resolvida':texto(x.situacao||'Pendente'),observacao:texto(x.observacao).slice(0,3000)};
    if(!r.numero||!r.fornecedor||!r.motivo||!/^\d{4}-\d{2}-\d{2}$/.test(r.emissao)||Number.isNaN(Date.parse(r.emissao)))throw Error('Informe NF, fornecedor, emissão e motivo.');
    if(!Number.isFinite(r.valor)||r.valor<0)throw Error('Valor inválido.');
    if(!['Pendente','Resolvida'].includes(r.situacao))throw Error('Escolha Pendente ou Resolvido.');
    return r;
  };
  function filtrarNfs(q){const busca=slug(q.get('busca')),fornecedor=q.get('fornecedor')||'',sit=q.get('situacao')||'',inicio=q.get('inicio')||'',fim=q.get('fim')||'';
    return lista().filter(n=>(!busca||[n.numero,n.fornecedor,n.motivo,n.responsavel].some(v=>slug(v).includes(busca)))&&(!fornecedor||n.fornecedor===fornecedor)&&(!sit||(sit==='Pendente'?['Pendente','Em análise'].includes(n.situacao):n.situacao===sit))&&(!inicio||n.emissao>=inicio)&&(!fim||n.emissao<=fim)).sort((a,b)=>b.id-a.id);
  }
  const XLSX_CONTENT='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  function exportar(rows){if(typeof XLSX==='undefined')return erro('Biblioteca Excel não carregada nesta demonstração.',503);
    const dados=rows.map(n=>({'Número NF':n.numero,'Série':n.serie,'Fornecedor':n.fornecedor,'Emissão':n.emissao?.split('-').reverse().join('/'),'Valor (R$)':Number(n.valor),'Prazo':n.prazo?n.prazo.split('-').reverse().join('/'):'','Motivo':n.motivo,'Responsável':n.responsavel,'Situação':n.situacao==='Resolvida'?'Resolvido':n.situacao,'Observação':n.observacao}));
    const ws=XLSX.utils.json_to_sheet(dados.length?dados:[{'Número NF':'','Fornecedor':'','Situação':''}]);ws['!cols']=[{wch:16},{wch:9},{wch:28},{wch:15},{wch:18},{wch:15},{wch:40},{wch:22},{wch:15},{wch:40}];
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'NFs Pendentes');const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});return bloba(new Blob([bytes],{type:XLSX_CONTENT}),XLSX_CONTENT);
  }
  const coluna=(o,nomes)=>{for(const [k,v] of Object.entries(o||{})){if(nomes.includes(slug(k).replace(/[^a-z0-9]/g,'')))return v}return ''};
  function dataPlanilha(d){const s=texto(d);if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))return s.slice(6)+'-'+s.slice(3,5)+'-'+s.slice(0,2);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);if(typeof d==='number'&&typeof XLSX!=='undefined')return XLSX.SSF.parse_date_code(d)?.y+'-'+String(XLSX.SSF.parse_date_code(d)?.m).padStart(2,'0')+'-'+String(XLSX.SSF.parse_date_code(d)?.d).padStart(2,'0');return s.slice(0,10)}
  async function importarExcel(file){if(!file||!file.name.match(/\.xlsx?$/i))throw Error('Selecione arquivo Excel .xlsx ou .xls.');if(typeof XLSX==='undefined')throw Error('Leitor Excel indisponível.');if(file.size>5*1024*1024)throw Error('Planilha maior que 5 MB.');const bytes=new Uint8Array(await file.arrayBuffer()),wb=XLSX.read(bytes,{type:'array'});const linhas=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(linhas.length>2000)throw Error('Limite de 2.000 notas por planilha.');
    const atual=lista();let novos=0,duplicados=0;
    for(const [i,x] of linhas.entries()){
      let item;try{item=norm({numero:coluna(x,['nf','numnf','numeronf','numeronota','notafiscal']),serie:coluna(x,['serie']),fornecedor:coluna(x,['fornecedor','empresa']),emissao:dataPlanilha(coluna(x,['emissao','dataemissao','data'])),valor:coluna(x,['valor','valortotal','valornf'])||0,prazo:dataPlanilha(coluna(x,['prazo','vencimento'])),motivo:coluna(x,['motivo','motivodapendencia'])||'Aguardando providência',responsavel:coluna(x,['responsavel']),situacao:coluna(x,['situacao','status'])||'Pendente',observacao:coluna(x,['observacao','observacoes'])});}catch(e){throw Error(`Linha ${i+2}: ${e.message}`)}
      if(atual.some(n=>n.numero===item.numero&&n.serie===item.serie&&n.fornecedor===item.fornecedor)){duplicados++;continue;}
      atual.push({...item,id:proximo(atual),criado_por:autentica()?.usuario||'admin',criado_em:agora(),atualizado_em:agora(),anexo_nome:null,anexo_tipo:null});novos++;
    }
    salvar(KEY,atual);if(novos)auditoria('IMPORTAR',null,{numero:`${novos} notas`});return {ok:true,novos,duplicados};
  }
  async function rotaNfs(path,url,method,body){const q=url.searchParams,match=path.match(/\/api\/nfs-pendentes\/(\d+)(?:\/(anexo))?$/);
    if(path==='/api/nfs-pendentes/fornecedores'&&method==='GET')return resposta({fornecedores:[...new Set(lista().map(x=>x.fornecedor))].sort((a,b)=>a.localeCompare(b,'pt-BR'))});
    if(path==='/api/nfs-pendentes'&&method==='GET'){
      const rows=filtrarNfs(q),pagina=Math.max(1,Number(q.get('pagina')||1)),base=(pagina-1)*25;
      return resposta({registros:rows.slice(base,base+25),total:rows.length,pagina,limite:25,indicadores:{total:rows.length,pendentes:rows.filter(x=>['Pendente','Em análise'].includes(x.situacao)).length,resolvidas:rows.filter(x=>x.situacao==='Resolvida').length,valor_aberto:rows.filter(x=>['Pendente','Em análise'].includes(x.situacao)).reduce((acc,n)=>acc+Number(n.valor||0),0)}});
    }
    if(path==='/api/nfs-pendentes/exportar'&&method==='GET')return exportar(filtrarNfs(q));
    if(path==='/api/nfs-pendentes/importar'&&method==='POST'){try{return resposta(await importarExcel(body.get('arquivo')))}catch(e){return erro(e.message)}}
    if(path==='/api/nfs-pendentes'&&method==='POST'){
      try{const item=norm(body),todos=lista();if(todos.some(n=>n.numero===item.numero&&n.serie===item.serie&&n.fornecedor===item.fornecedor))return erro('Já existe pendência para essa NF, série e fornecedor.',409);
        const n={...item,id:proximo(todos),criado_por:autentica()?.usuario||'admin',criado_em:agora(),atualizado_em:agora(),anexo_nome:null,anexo_tipo:null};todos.unshift(n);salvar(KEY,todos);auditoria('CRIAR',null,n);return resposta({registro:n},201);}catch(e){return erro(e.message)}
    }
    if(match){const id=Number(match[1]),arr=lista(),pos=arr.findIndex(x=>x.id===id);if(pos<0)return erro('NF não encontrada.',404);
      const antigo=arr[pos];if(match[2]==='anexo'){
        if(method==='GET'){const data=antigo.__anexo; if(!data)return erro('Nenhum anexo disponível.',404); const res=await fetch(data);return bloba(await res.blob(),antigo.anexo_tipo||'application/octet-stream');}
        if(method==='POST'){const f=body.get('arquivo');if(!f)return erro('Escolha PDF ou XML.');if(f.size>900000)return erro('Nesta demonstração, o anexo deve ter até 900 KB.');if(!/\.(pdf|xml)$/i.test(f.name))return erro('Aceitos apenas PDF ou XML.');const novo={...antigo,anexo_nome:f.name,anexo_tipo:f.type|| (f.name.endsWith('.pdf')?'application/pdf':'application/xml'),__anexo:await fazArquivo(f),atualizado_em:agora()};arr[pos]=novo;try{salvar(KEY,arr)}catch(e){return erro('Sem espaço no navegador para guardar este anexo.')}auditoria('ANEXAR',null,novo);return resposta({registro:novo})}
      }
      if(method==='PATCH'||method==='PUT')try{const dados=norm(body);if(arr.some((n,i)=>i!==pos&&n.numero===dados.numero&&n.serie===dados.serie&&n.fornecedor===dados.fornecedor))return erro('NF já cadastrada.',409);arr[pos]={...antigo,...dados,atualizado_em:agora()};salvar(KEY,arr);auditoria('EDITAR',antigo,arr[pos]);return resposta({registro:arr[pos]})}catch(e){return erro(e.message)}
      if(method==='DELETE'){arr.splice(pos,1);salvar(KEY,arr);auditoria('EXCLUIR',antigo,null);return resposta({ok:true})}
    }
    return erro('Operação não disponível nesta demonstração.',404);
  }
  const docAtuais=()=>ler(DOC,[]);
  async function rotaDocumentos(path,url,method,body){let a=docAtuais();const m=path.match(/^\/api\/documentos\/(\d+)(?:\/(arquivo|favorito))?$/);
    if(path==='/api/documentos'&&method==='GET')return resposta(a);
    if(path==='/api/documentos'&&method==='POST'){
      const nome=texto(body.get('nome')||body.get('titulo')||body.get('descricao')),f=body.get('arquivo');if(!nome)return erro('Informe o nome do documento.');
      if(!f||!f.name)return erro('Selecione PDF ou Excel.');
      if(f.size>850000)return erro('No modo demonstrativo, arquivos devem ter até 850 KB.');
      const novo={id:proximo(a),nome,categoria:texto(body.get('categoria')||'Outros'),descricao:texto(body.get('descricao')||''),favorito:false,tipo:f.name.toLowerCase().endsWith('.pdf')?'pdf':'excel',arquivoNome:f.name,tamanho:f.size,__arquivo:await fazArquivo(f),criadoEm:agora(),atualizadoEm:agora(),criadoPor:autentica()?.usuario||'admin'};
      a.unshift(novo);try{salvar(DOC,a)}catch{return erro('Não há espaço no navegador para o arquivo.')}return resposta(novo,201);
    }
    if(m){let i=a.findIndex(x=>x.id===Number(m[1]));if(i<0)return erro('Documento não encontrado.',404);
      if(method==='DELETE'){a.splice(i,1);salvar(DOC,a);return resposta({ok:true})}
      if(m[2]==='favorito'&&method==='PATCH'){a[i].favorito=!!body.favorito;a[i].atualizadoEm=agora();salvar(DOC,a);return resposta(a[i])}
      if(m[2]==='arquivo'&&method==='GET'){if(!a[i].__arquivo)return erro('Arquivo não encontrado.',404);const file=await fetch(a[i].__arquivo);return bloba(await file.blob(),a[i].tipo==='pdf'?'application/pdf':XLSX_CONTENT)}
      if(method==='PUT'){
        const f=body.get('arquivo');a[i]={...a[i],nome:texto(body.get('nome'))||a[i].nome,categoria:texto(body.get('categoria')||a[i].categoria),descricao:texto(body.get('descricao')||''),atualizadoEm:agora()};
        if(f?.name){if(f.size>850000)return erro('No modo demonstrativo, arquivos devem ter até 850 KB.');a[i].tipo=f.name.toLowerCase().endsWith('.pdf')?'pdf':'excel';a[i].arquivoNome=f.name;a[i].tamanho=f.size;a[i].__arquivo=await fazArquivo(f)}
        try{salvar(DOC,a)}catch{return erro('Sem espaço no navegador.')}return resposta(a[i]);
      }
    }
    return erro('Operação demonstrativa indisponível.',404);
  }
  const CATALOG=[
    {titulo:'Dashboard',opcoes:[['dashboard.visualizar','Visualizar indicadores'],['dashboard.exportar','Gerar relatórios']]},
    {titulo:'Avarias e Baixas',opcoes:[['avarias.consultar','Consultar avarias'],['avarias.cadastrar','Lançar avarias'],['avarias.editar','Editar avarias'],['avarias.excluir','Excluir avarias'],['avarias.exportar','Exportar avarias'],['baixas.consultar','Consultar baixas'],['baixas.lancar','Realizar baixas'],['baixas.editar','Editar baixas'],['baixas.excluir','Excluir baixas'],['baixas.exportar','Exportar baixas']]},
    {titulo:'Notas fiscais pendentes',opcoes:[['nfs.consultar','Consultar NFs pendentes'],['nfs.criar','Cadastrar/importar NFs'],['nfs.editar','Editar e concluir pendências'],['nfs.excluir','Excluir pendências'],['nfs.exportar','Exportar NFs']]},
    {titulo:'Produtos e Caixas',opcoes:[['produtos.consultar','Consultar produtos'],['produtos.editar','Editar categorias'],['produtos.importar','Importar produtos'],['caixas.consultar','Consultar caixas'],['caixas.movimentar','Movimentar caixas'],['caixas.excluir','Excluir caixas']]},
    {titulo:'Recuperação e Doações',opcoes:[['recuperacoes.consultar','Consultar recuperação'],['recuperacoes.criar','Cadastrar recuperação'],['recuperacoes.editar','Editar recuperação'],['recuperacoes.finalizar','Finalizar recuperação'],['recuperacoes.excluir','Excluir recuperação'],['recuperacoes.exportar','Exportar recuperação'],['doacoes.consultar','Consultar doações'],['doacoes.criar','Cadastrar doações'],['doacoes.editar','Editar doações'],['doacoes.finalizar','Finalizar doações'],['doacoes.excluir','Excluir doações'],['doacoes.exportar','Exportar doações']]},
    {titulo:'Outros módulos',opcoes:[['documentos.consultar','Consultar documentos'],['documentos.criar','Cadastrar documentos'],['documentos.editar','Editar documentos'],['documentos.excluir','Excluir documentos'],['tarefas.consultar','Consultar tarefas'],['tarefas.gerenciar','Gerenciar tarefas'],['tarefas.concluir','Concluir tarefas'],['avisos.consultar','Consultar avisos'],['avisos.criar','Publicar avisos'],['avisos.excluir','Excluir avisos'],['auditoria.consultar','Consultar auditoria'],['mapeamento.consultar','Consultar mapeamento'],['mapeamento.editar','Editar mapeamento'],['listas.proprias','Listas pessoais']]}
  ];
  const todasChaves=CATALOG.flatMap(g=>g.opcoes.map(x=>x[0]));
  const modelos={operacional:Object.fromEntries(todasChaves.map(x=>[x,true])),consulta:Object.fromEntries(todasChaves.map(x=>[x.endsWith('.consultar')||x.endsWith('.visualizar')||x.endsWith('.exportar')])),nenhum:Object.fromEntries(todasChaves.map(x=>[x,false]))};
  function permitido(k){const s=autentica();if(!s)return false;if(s.perfil==='admin')return true;return s.permissoes?.[k]===true||(!s.permissoes&&['nfs.consultar','nfs.exportar'].includes(k));}
  function permissoesDoUsuario(id){return ler('ca_v25120_demo_users',[]).find(x=>String(x.id)===String(id));}
  const demoHeaders={cache:'no-store'};
  window.fetch=async function(input,options={}){
    const raw=typeof input==='string'?input:input?.url||'';let url;
    try{url=new URL(raw,location.href)}catch{return anterior(input,options)}
    const path=url.pathname,method=String(options.method||input?.method||'GET').toUpperCase();
    if(!path.startsWith('/api/'))return anterior(input,options);
    // Bloqueio de chamadas a qualquer backend externo: nunca consulta IPs reais.
    if(url.origin!==location.origin)return erro('Nesta demonstração não é permitido acessar um servidor externo.',403);
    let body=options.body||{};
    if(typeof body==='string')try{body=JSON.parse(body)}catch{body={}};
    if(path==='/api/versao')return resposta({ok:true,versao:'28.8-web-demo',modo:'demonstração',atualizadoEm:agora()});
    if(path==='/api/asset-check')return resposta({ok:true,modo:'web-demo',versao:'28.8'});
    if(path==='/api/rede-info')return resposta({ok:true,modo:'demonstração',servidor:'GitHub Pages'});
    if(path==='/api/sessao'&&method==='GET'){
      const user=autentica();if(!user)return erro('Sessão não encontrada.',401);
      return resposta({...user,ok:true,ativo:true,permissoes:user.permissoes??null});
    }
    if(path.startsWith('/api/nfs-pendentes')){
      if(!autentica())return erro('Faça login para continuar.',401);
      const key=path.endsWith('/exportar')?'nfs.exportar':path.endsWith('/importar')?'nfs.criar':/\/anexo$/.test(path)?(method==='GET'?'nfs.consultar':'nfs.editar'):(method==='GET'?'nfs.consultar':method==='POST'?'nfs.criar':method==='DELETE'?'nfs.excluir':'nfs.editar');
      if(!permitido(key))return erro('Sem permissão para esta operação.',403);
      return rotaNfs(path,url,method,body);
    }
    if(path.startsWith('/api/documentos')){if(!autentica())return erro('Faça login para continuar.',401);return rotaDocumentos(path,url,method,body)}
    if(path==='/api/avisos'&&method==='GET')return resposta(ler(AVISOS,[]));
    if(path==='/api/avisos'&&method==='POST'){let a=ler(AVISOS,[]);const item={id:proximo(a),...body,criadoEm:agora()};a.unshift(item);salvar(AVISOS,a);return resposta(item,201)}
    if(/^\/api\/avisos\/\d+$/.test(path)&&method==='DELETE'){let a=ler(AVISOS,[]);a=a.filter(x=>String(x.id)!==path.split('/').pop());salvar(AVISOS,a);return resposta({ok:true})}
    if(path==='/api/usuarios/permissoes/catalogo'&&method==='GET')return resposta({grupos:CATALOG,modelos});
    const per=path.match(/^\/api\/usuarios\/(\d+)\/permissoes$/);
    if(per){if(autentica()?.perfil!=='admin')return erro('Acesso restrito.',403);
      const u=permissoesDoUsuario(per[1]);if(!u)return erro('Usuário não encontrado.',404);
      if(method==='GET')return resposta({id:u.id,nome:u.nome,usuario:u.usuario,permissoes:u.permissoes||null,herdadas:!u.permissoes});
      if(method==='PUT'||method==='PATCH'){
        const l=ler('ca_v25120_demo_users',[]),pos=l.findIndex(x=>String(x.id)===per[1]);
        const p=body.permissoes||body;if(!p||typeof p!=='object')return erro('Permissões inválidas.');
        l[pos].permissoes=Object.fromEntries(todasChaves.map(x=>[x,p[x]===true]));salvar('ca_v25120_demo_users',l);
        return resposta({ok:true,permissoes:l[pos].permissoes});
      }
    }
    if(path==='/api/login'&&method==='POST'){
      const resp=await anterior(input,options);if(!resp.ok)return resp;
      const dados=await resp.json(),u=ler('ca_v25120_demo_users',[]).find(x=>x.usuario===dados.usuario);
      const extra=u?.permissoes||null,atual=autentica();
      if(atual){atual.permissoes=extra;salvar('usuarioLogado',atual)}
      return resposta({...dados,permissoes:extra});
    }
    return anterior(input,options);
  };
  // Faixa discreta para deixar claro que a instalação no GitHub é uma simulação.
  document.addEventListener('DOMContentLoaded',()=>{
    const bar=document.createElement('aside');bar.id='caDemoBar';bar.setAttribute('role','note');
    bar.innerHTML='<strong>AMBIENTE DEMONSTRATIVO</strong><span> Dados fictícios · Sem conexão com o PostgreSQL</span>';
    Object.assign(bar.style,{position:'fixed',zIndex:'99999',bottom:'12px',left:'12px',background:'#123456',color:'#fff',padding:'8px 13px',borderRadius:'10px',font:'12px system-ui,sans-serif',boxShadow:'0 4px 16px #001c3440',maxWidth:'calc(100vw - 24px)',pointerEvents:'none'});
    document.body.appendChild(bar);
  },{once:true});
  window.CA_DEMO_V288={versao:'28.8',resetar(){sessionStorage.removeItem(KEY);sessionStorage.removeItem(DOC);sessionStorage.removeItem(AVISOS);location.reload()},nfs:lista};
})();
