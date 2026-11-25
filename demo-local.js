/* V28.8 public demo: browser-only API emulator, no external data access. */
(function(){
 'use strict';
 window.CA_LOCAL_MODE=true;
 window.CA_API_BASE=location.origin;
 try { localStorage.removeItem('controleAvariasServidor'); } catch(e) {}
 const prefix='avarias_public_v288_';
 const read=(key)=>{try{return JSON.parse(localStorage.getItem(prefix+key)||'null')}catch(e){return null}};
 const write=(key,val)=>{try{localStorage.setItem(prefix+key,JSON.stringify(val))}catch(e){}return val};
 const arrays=['avarias','historico-avarias','caixas','produtos','tarefas','devolucoes','recuperacoes','doacoes','documentos','avisos','nfs-pendentes','usuarios','auditoria','notificacoes','listas-pessoais','mapeamento'];
 const initial={
  produtos:[{id:1,codigo:'7891000000001',codigo_barras:'7891000000001',descricao:'Produto demonstrativo A',categoria:'Mercearia',fornecedor:'Fornecedor Exemplo',preco_custo:9.9},{id:2,codigo:'7891000000002',codigo_barras:'7891000000002',descricao:'Produto demonstrativo B',categoria:'Bebidas',fornecedor:'Fornecedor Exemplo',preco_custo:5.5}],
  avarias:[], 'historico-avarias':[], caixas:[], tarefas:[], 'nfs-pendentes':[], usuarios:[{id:1,usuario:'demo',nome:'Usuário de Demonstração',perfil:'admin',ativo:true}], auditoria:[]
 };
 for(const k of arrays)if(read(k)===null)write(k,initial[k]||[]);
 const originalFetch=window.fetch.bind(window);
 const originalEventSource=window.EventSource;
 const reply=(body,status=200,headers={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
 const session=()=>({usuario:'demo',nome:'Usuário de Demonstração',perfil:'admin',role:'admin',permissoes:['*'],token:'demo-local',id:1});
 const parseBody=async opts=>{try{return typeof opts.body==='string'?JSON.parse(opts.body):opts.body||{}}catch(e){return {}}};
 const resource=(path)=>arrays.find(k=>path==='/api/'+k||path.startsWith('/api/'+k+'/'));
 window.fetch=async function(input,opts={}){
  const url=typeof input==='string'?input:input?.url||'';
  let parsed;try{parsed=new URL(url,location.href)}catch(e){return reply({erro:'Endereço inválido'},400)}
  if(!parsed.pathname.startsWith('/api/')){
   if(parsed.origin!==location.origin)return reply({erro:'Conexões externas desabilitadas na demonstração'},403);
   return originalFetch(input,opts);
  }
  const path=parsed.pathname;
  const method=(opts.method||(typeof input!=='string'?input.method:'GET')||'GET').toUpperCase();
  const body=await parseBody(opts);
  if(path==='/api/saude'||path==='/api/health')return reply({ok:true,status:'ok',modo:'demonstração local'});
  if(path==='/api/login')return (body.usuario==='demo'&&body.senha==='demo123')?reply(session()):reply({erro:'Use demo / demo123'},401);
  if(path==='/api/logout')return reply({ok:true});
  if(path==='/api/sessao'||path==='/api/perfil')return reply({...session(),logado:true,autenticado:true});
  if(path==='/api/produtos/resumo')return reply({total:read('produtos').length,quantidade:read('produtos').length});
  if(path.startsWith('/api/produtos/')){
   const code=decodeURIComponent(path.split('/')[3]||''); const found=read('produtos').find(x=>String(x.codigo)===code||String(x.codigo_barras)===code);
   return found?reply(found):reply({erro:'Produto não encontrado no cadastro fictício'},404);
  }
  if(path.includes('/exportar')||path.includes('/documento')||path.includes('/importar')||path.includes('/backup')||path.includes('/relatorio'))return reply({erro:'Operação avançada indisponível na demonstração estática. Nenhum dado real é enviado.'},501);
  if(path==='/api/dashboard/ia')return reply({resposta:'Assistente não habilitado na demonstração independente.',mensagem:'Assistente não habilitado.'});
  if(path==='/api/dashboard/caixas-resumo')return reply({total_caixas:read('caixas').length,caixas:read('caixas'),total:read('caixas').length});
  if(path==='/api/notificacoes/lidas')return reply({ok:true});
  const key=resource(path);
  if(key){
   const collection=read(key)||[];
   const tail=path.slice(('/api/'+key).length).split('/').filter(Boolean);
   const id=tail[0];
   if(method==='GET'){
    if(id){const item=collection.find(x=>String(x.id)===decodeURIComponent(id));return item?reply(item):reply({erro:'Registro não encontrado'},404)}
    return reply(collection);
   }
   if(method==='POST'){
    const item={...(body&&typeof body==='object'?body:{}),id:Date.now(),criado_em:new Date().toISOString()};
    write(key,[item,...collection]);return reply({...item,sucesso:true},201);
   }
   if(method==='PUT'||method==='PATCH'){
    const idx=collection.findIndex(x=>String(x.id)===decodeURIComponent(id||''));if(idx<0)return reply({erro:'Registro não encontrado'},404);
    collection[idx]={...collection[idx],...body};write(key,collection);return reply({...collection[idx],sucesso:true});
   }
   if(method==='DELETE'){
    write(key,collection.filter(x=>String(x.id)!==decodeURIComponent(id||'')));return reply({ok:true,sucesso:true});
   }
  }
  return reply({erro:'Rota não disponível nesta demonstração',rota:path},501);
 };
 if(originalEventSource)window.EventSource=class DemoEventSource{constructor(){this.readyState=2;this.onmessage=null;this.onerror=null}addEventListener(){}removeEventListener(){}close(){}};
})();
