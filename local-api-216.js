/*
 * CONTROLE DE AVARIAS V21.6 WEB
 * Adaptador local: mantém as telas V21.5 e troca a API/PostgreSQL por localStorage.
 * Não é um servidor nem um mecanismo de segurança real: tudo fica no navegador.
 */
(() => {
  window.CA_LOCAL_ADAPTER_FILE = 'local-api-216.js';
  const KEYS = {
    users: 'ca_v216_users',
    avarias: 'avarias',
    historico: 'historicoAvarias',
    produtos: 'produtos',
    caixas: 'caixas',
    caixaProdutos: 'caixaProdutos',
    tarefas: 'tarefas',
    auditoria: 'auditoria',
    mapeamento: 'mapeamentoCaixas',
    notificacoes: 'notificacoesCaixas'
  };
  const originalFetch = window.fetch.bind(window);
  const originalEventSource = window.EventSource;
  const now = () => new Date().toISOString();
  const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const read = (k, fallback=[]) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } };
  const write = (k,v) => localStorage.setItem(k, JSON.stringify(v));
  const num = v => { if(typeof v==='number') return Number.isFinite(v)?v:0; const t=String(v??'').trim(); if(!t)return 0; const n=Number(t.replace(/\./g,'').replace(',','.')); if(Number.isFinite(n))return n; const f=Number(t.replace(',','.')); return Number.isFinite(f)?f:0; };
  const text = v => String(v ?? '').trim();
  const currentUser = () => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null'); } catch { return null; } };
  const isAdmin = () => currentUser()?.perfil === 'admin';
  const jsonResponse = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json', ...headers}});
  const blobResponse = (blob, status=200) => new Response(blob, {status, headers:{'Content-Type':blob.type || 'application/octet-stream'}});
  const pathOf = u => { try { return new URL(u, location.href).pathname; } catch { return String(u).split('?')[0]; } };
  const queryOf = u => { try { return new URL(u, location.href).searchParams; } catch { return new URLSearchParams(); } };
  const methodOf = options => String(options?.method || 'GET').toUpperCase();
  const bodyOf = async options => {
    const b = options?.body;
    if (!b) return {};
    if (b instanceof FormData) return b;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
    return b;
  };
  const saveAudit = (acao, entidade, registroId, detalhes, antes=null, depois=null) => {
    const lista = read(KEYS.auditoria, []);
    lista.unshift({id:id(), criadoEm:now(), usuario:currentUser()?.usuario || 'sistema', acao, entidade, registroId:String(registroId ?? ''), detalhes:detalhes || '', antes, depois});
    write(KEYS.auditoria, lista.slice(0,1000));
  };
  const productCategory = d => {
    const t = text(d).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if (/SABAO|DETERG|DESINF|AMACIANTE|ALVEJ|AGUA SANIT|LIMPA|ESPONJA|VASSOURA|RODO|CLORO|SACO LIXO|PANO|BALDE|DESENG|MULTIUSO|LUSTRA|INSETIC/.test(t)) return 'Limpeza';
    if (/QUEIJO|PRESUNTO|MORTADELA|SALAME|IOGURTE|REQUEIJAO|LINGUICA|SALSICHA|PEITO DE PERU|CREAM CHEESE/.test(t)) return 'Frios';
    if (/PAO|BOLO|TORTA|SALGADO|CROISS|BRIOCHE|BAGUETE|CUCA|SONHO|PIZZA/.test(t)) return 'Padaria';
    if (/REFRIGERANTE|REFRI|SUCO|AGUA MINERAL|AGUA COM GAS|ENERGETICO|ISOTONICO|CERVEJA|VINHO|ESPUMANTE|DESTILADO|BEBIDA|CHA GELADO|CAFE PRONTO/.test(t)) return 'Bebidas';
    return 'Mercearia';
  };
  const normalizeProduct = p => ({
    codigo:text(p.codigo), produto:text(p.produto || p.descricao), descricao:text(p.descricao || p.produto), fornecedor:text(p.fornecedor), codigoFornecedor:text(p.codigoFornecedor || p.codigo_fornecedor),
    estoque:num(p.estoque), valorCusto:num(p.valorCusto ?? p.valor_custo), valorVenda:num(p.valorVenda ?? p.valor_venda), categoria:text(p.categoria) || productCategory(p.descricao || p.produto), ativo:p.ativo !== false, atualizadoEm:p.atualizadoEm || now()
  });
  const findProduct = codigo => {
    const c=text(codigo); const ps=read(KEYS.produtos,[]); return ps.find(p=>p.ativo!==false && (text(p.codigo)===c || (c.length===13 && text(p.codigo).padStart(13,'0')===c))) || null;
  };
  const avarias = () => read(KEYS.avarias,[]);
  const historico = () => read(KEYS.historico,[]);
  const syncHistory = a => {
    let h = historico(); const i=h.findIndex(x=>String(x.id)===String(a.id));
    const item={...a};
    if(i>=0) h[i]={...h[i],...item}; else h.unshift(item);
    write(KEYS.historico,h);
  };
  const seed = () => {
    let users=read(KEYS.users,null);
    if(!Array.isArray(users) || !users.length){
      users=[{id:1,usuario:'admin',nome:'Administrador',perfil:'admin',ativo:true,senha:'admin123',criadoEm:now()}];
      write(KEYS.users,users);
    }
    // Compatibilidade com a tela de devoluções, que já usa localStorage diretamente.
    if(!localStorage.getItem(KEYS.avarias)) write(KEYS.avarias,[]);
    if(!localStorage.getItem(KEYS.historico)){ const antigos=read(KEYS.avarias,[]); write(KEYS.historico,Array.isArray(antigos)?antigos.map(x=>({...x})):[]); }
    if(!localStorage.getItem(KEYS.produtos)) write(KEYS.produtos,[]);
    if(!localStorage.getItem(KEYS.caixas)) write(KEYS.caixas,[]);
    if(!localStorage.getItem(KEYS.caixaProdutos)) write(KEYS.caixaProdutos,[]);
    if(!localStorage.getItem(KEYS.tarefas)) write(KEYS.tarefas,[]);
    if(!localStorage.getItem(KEYS.auditoria)) write(KEYS.auditoria,[]);
    if(!localStorage.getItem(KEYS.notificacoes)) write(KEYS.notificacoes,[]);
    let mapa=read(KEYS.mapeamento,null);
    if(!Array.isArray(mapa) || !mapa.length){
      const cfg=[{l:1,q:20},{l:2,q:16},{l:3,q:16},{l:4,q:14},{l:5,q:14}]; mapa=[]; let n=1;
      for(const row of cfg){for(let c=1;c<=row.q;c++) mapa.push({id:`m${n++}`,linha:row.l,coluna:c,nome:'',ativo:true,atualizadoEm:now(),atualizadoPor:''});}
      write(KEYS.mapeamento,mapa);
    }
  };
  seed();

  async function route(url, options={}) {
    const path=pathOf(url), method=methodOf(options), q=queryOf(url), body=await bodyOf(options), user=currentUser();
    if(!path.includes('/api/')) return null;
    if(path.endsWith('/api/saude') || path.endsWith('/api/status') || path.endsWith('/api/versao')) return jsonResponse({ok:true,versao:'21.6-web',mensagem:'Modo web local ativo.'});
    if(path.endsWith('/api/login') && method==='POST'){
      const usuario=text(body.usuario).toLowerCase(), senha=String(body.senha||''); const u=read(KEYS.users,[]).find(x=>x.usuario===usuario);
      if(!u || u.ativo===false || u.senha!==senha) return jsonResponse({erro:u?.ativo===false?'Usuário desativado.':'Usuário ou senha incorretos.'},u?.ativo===false?403:401);
      const sess={usuario:u.usuario,nome:u.nome,perfil:u.perfil,token:`local-${id()}`,loginEm:now(),id:u.id,ativo:u.ativo};
      sessionStorage.setItem('usuarioLogado',JSON.stringify(sess)); return jsonResponse({ok:true,usuario:u.usuario,nome:u.nome,perfil:u.perfil,token:sess.token});
    }
    if(path.endsWith('/api/logout') && method==='POST'){ sessionStorage.removeItem('usuarioLogado'); return jsonResponse({ok:true}); }
    if(path.endsWith('/api/sessao') && method==='GET'){
      if(!user) return jsonResponse({erro:'Sessão não encontrada.'},401); return jsonResponse({ok:true,id:user.id||1,usuario:user.usuario,nome:user.nome,perfil:user.perfil,ativo:true});
    }
    if(path.endsWith('/api/perfil') && method==='GET'){
      if(!user) return jsonResponse({erro:'Não autenticado.'},401); const u=read(KEYS.users,[]).find(x=>x.usuario===user.usuario)||user; return jsonResponse({id:u.id,usuario:u.usuario,nome:u.nome,perfil:u.perfil,ativo:u.ativo!==false,criadoEm:u.criadoEm});
    }
    if(path.endsWith('/api/perfil') && method==='PATCH'){
      if(!user) return jsonResponse({erro:'Não autenticado.'},401); const us=read(KEYS.users,[]), i=us.findIndex(x=>x.usuario===user.usuario); if(i<0) return jsonResponse({erro:'Usuário não encontrado.'},404);
      const nome=text(body.nome); if(!nome) return jsonResponse({erro:'Informe o nome.'},400); if(nome.length>120) return jsonResponse({erro:'O nome deve ter no máximo 120 caracteres.'},400);
      if(body.senhaAtual || body.novaSenha){ if(String(body.senhaAtual||'')!==us[i].senha) return jsonResponse({erro:'A senha atual está incorreta.'},400); if(String(body.novaSenha||'').length<6) return jsonResponse({erro:'A nova senha precisa ter pelo menos 6 caracteres.'},400); us[i].senha=String(body.novaSenha); }
      us[i].nome=nome; write(KEYS.users,us); sessionStorage.setItem('usuarioLogado',JSON.stringify({...user,nome})); saveAudit('atualizado','perfil_usuario',us[i].id,'Perfil atualizado.'); return jsonResponse({ok:true,id:us[i].id,usuario:us[i].usuario,nome:us[i].nome,perfil:us[i].perfil,ativo:us[i].ativo,criadoEm:us[i].criadoEm});
    }
    if(path.endsWith('/api/avarias') && method==='GET'){
      let a=avarias(); const st=text(q.get('status')); if(st && st!=='Todos') a=a.filter(x=>x.status===st); return jsonResponse(a.sort((x,y)=>new Date(y.criadoEm||0)-new Date(x.criadoEm||0)));
    }
    if(path.endsWith('/api/avarias') && method==='POST'){
      const p=findProduct(body.codigo); if(!p) return jsonResponse({erro:`Produto não encontrado para o código ${body.codigo}.`},404);
      const quantidade=num(body.quantidade); if(quantidade<=0) return jsonResponse({erro:'Quantidade inválida.'},400); if(num(p.valorCusto)<=0) return jsonResponse({erro:`O produto ${p.codigo} foi encontrado, mas está sem valor de custo válido.`},422);
      const item={id:body.id||id(),codigo:p.codigo,produto:p.produto||p.descricao,fornecedor:p.fornecedor||'',codigoFornecedor:p.codigoFornecedor||'',categoria:text(body.categoria)||p.categoria||'Mercearia',quantidade,valorUnitario:num(p.valorCusto),setor:text(body.setor)||'Loja',tipo:text(body.tipo),caixa:'',usuarioLancamento:user?.usuario||'admin',status:'Pendente',observacao:text(body.observacao),criadoEm:body.criadoEm||now(),movimentadoEm:body.movimentadoEm||null};
      const a=avarias(); a.unshift(item); write(KEYS.avarias,a); syncHistory(item); saveAudit('criado','avaria',item.id,`Avaria ${item.produto} cadastrada.`,null,item); return jsonResponse(item,201);
    }
    let m=path.match(/\/api\/avarias\/([^/]+)\/status$/); if(m && method==='PATCH'){
      const a=avarias(), i=a.findIndex(x=>String(x.id)===decodeURIComponent(m[1])); if(i<0) return jsonResponse({erro:'Avaria não encontrada.'},404); const st=text(body.status); if(!['Pendente','Baixa','Devolução'].includes(st)) return jsonResponse({erro:'Status inválido.'},400); a[i].status=st; a[i].movimentadoEm=st==='Pendente'?null:now(); write(KEYS.avarias,a); syncHistory(a[i]); saveAudit('status','avaria',a[i].id,`Status alterado para ${st}.`); return jsonResponse({ok:true});
    }
    m=path.match(/\/api\/avarias\/([^/]+)$/); if(m && method==='DELETE'){
      const idv=decodeURIComponent(m[1]), a=avarias(), i=a.findIndex(x=>String(x.id)===idv); if(i<0) return jsonResponse({ok:true,jaRemovido:true,historicoPreservado:true}); const [item]=a.splice(i,1); write(KEYS.avarias,a); syncHistory(item); saveAudit('excluido','avaria',item.id,`Registro ${item.produto} excluído da aba Registros.`,item,{removidoDaAvaria:true}); return jsonResponse({ok:true});
    }
    m=path.match(/\/api\/produtos\/([^/]+)$/); if(m && method==='GET'){
      const p=findProduct(decodeURIComponent(m[1])); if(!p) return jsonResponse({erro:'Produto não encontrado.'},404); return jsonResponse(p);
    }
    m=path.match(/\/api\/produtos\/([^/]+)\/categoria$/); if(m && method==='PUT'){
      if(!isAdmin()) return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403); const c=text(body.categoria); if(!['Frios','Mercearia','Padaria','Limpeza','Bebidas'].includes(c)) return jsonResponse({erro:'Categoria inválida.'},400); const ps=read(KEYS.produtos,[]), i=ps.findIndex(p=>String(p.codigo)===decodeURIComponent(m[1])); if(i<0) return jsonResponse({erro:'Produto não encontrado.'},404); ps[i].categoria=c; ps[i].atualizadoEm=now(); write(KEYS.produtos,ps); for(const k of [KEYS.avarias,KEYS.historico]){const arr=read(k,[]); arr.forEach(x=>{if(String(x.codigo)===String(ps[i].codigo))x.categoria=c;});write(k,arr);} saveAudit('categoria-alterada','produto',ps[i].codigo,`Categoria de ${ps[i].descricao} alterada.`); return jsonResponse({ok:true,codigo:ps[i].codigo,produto:ps[i].descricao,categoria:c,atualizadoPor:user?.usuario||'admin'});
    }
    if(path.endsWith('/api/produtos/resumo') && method==='GET'){const ps=read(KEYS.produtos,[]); return jsonResponse({ok:true,total:ps.length,ativos:ps.filter(p=>p.ativo!==false).length});}
    if(path.endsWith('/api/produtos/importar') && method==='POST'){
      const fd=body instanceof FormData ? body : null; const file=fd?.get('arquivo'); if(!file) return jsonResponse({erro:'Nenhum arquivo enviado.'},400); const name=text(file.name).toLowerCase(); if(!name.endsWith('.csv')) return jsonResponse({erro:'Na versão Web, importe a planilha como CSV (separado por vírgula ou ponto e vírgula).'},400);
      const raw=await file.text(); const lines=raw.split(/\r?\n/).filter(x=>x.trim()); if(!lines.length) return jsonResponse({erro:'Arquivo vazio.'},400); const delim=(lines[0].split(';').length>lines[0].split(',').length)?';':','; const headers=lines[0].split(delim).map(x=>x.replace(/^\uFEFF/,'').trim()); const ps=read(KEYS.produtos,[]); const map=new Map(ps.map(p=>[String(p.codigo),p])); let novos=0,atualizados=0;
      const parseLine=line=>{const vals=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){quote=!quote;continue}if(ch===delim&&!quote){vals.push(cur);cur='';}else cur+=ch;}vals.push(cur);return vals;};
      const alias=(row,names)=>{for(const [k,v] of Object.entries(row)){const nk=k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim(); if(names.some(n=>nk===n)) return v;} return '';};
      for(let r=1;r<lines.length;r++){const vals=parseLine(lines[r]); const row={}; headers.forEach((h,i)=>row[h]=vals[i]??''); const p=normalizeProduct({codigo:alias(row,['CODIGO','COD DE BARRAS','EAN']),descricao:alias(row,['DESCRICAO','DESCRICAO PRODUTO','PRODUTO']),fornecedor:alias(row,['FORNECEDOR']),codigoFornecedor:alias(row,['CODIGO FORNECEDOR','COD FORNECEDOR']),valorCusto:alias(row,['V CUSTO','VALOR CUSTO','VALOR C']),valorVenda:alias(row,['V VENDA','VALOR VENDA']),estoque:alias(row,['ESTOQUE','QTD ESTOQUE']),categoria:alias(row,['CATEGORIA'])}); if(!p.codigo||!p.descricao) continue; const old=map.get(p.codigo); if(old){map.set(p.codigo,{...old,...p});atualizados++;}else{map.set(p.codigo,p);novos++;}}
      write(KEYS.produtos,[...map.values()]); return jsonResponse({ok:true,planilha:lines.length-1,produtosUnicos:map.size,novos,atualizados,ignorados:Math.max(0,(lines.length-1)-novos-atualizados),totalBanco:map.size,duplicados:0,duplicadosDetalhes:[]});
    }
    if(path.endsWith('/api/historico-avarias') && method==='GET') return jsonResponse(historico().filter(x=>x.removido!==true).sort((a,b)=>new Date(b.movimentadoEm||b.criadoEm||0)-new Date(a.movimentadoEm||a.criadoEm||0)));
    m=path.match(/\/api\/historico-avarias\/([^/]+)$/); if(m && method==='DELETE'){
      if(!isAdmin()) return jsonResponse({erro:'Somente o administrador pode excluir registros do histórico.'},403); const idv=decodeURIComponent(m[1]), h=historico(), i=h.findIndex(x=>String(x.id)===idv && x.removido!==true); if(i<0)return jsonResponse({erro:'Registro do histórico não encontrado.'},404); h[i].removido=true; write(KEYS.historico,h); saveAudit('excluido','historico_avarias',idv,`Baixa ${h[i].produto||''} excluída do histórico.`,h[i],{removido:true}); return jsonResponse({ok:true});
    }
    if(m && method==='PUT' && path.includes('/api/historico-avarias/')){
      if(!isAdmin()) return jsonResponse({erro:'Somente o administrador pode editar baixas.'},403); const idv=decodeURIComponent(m[1]), h=historico(), i=h.findIndex(x=>String(x.id)===idv); if(i<0)return jsonResponse({erro:'Registro do histórico não encontrado.'},404); const item={...h[i],codigo:text(body.codigo),produto:text(body.produto),fornecedor:text(body.fornecedor),codigoFornecedor:text(body.codigoFornecedor),categoria:text(body.categoria)||'Mercearia',quantidade:num(body.quantidade),valorUnitario:num(body.valorUnitario),setor:text(body.setor)||'Loja',tipo:text(body.tipo),caixa:text(body.caixa),observacao:text(body.observacao),movimentadoEm:body.dataBaixa?new Date(body.dataBaixa).toISOString():h[i].movimentadoEm||now()}; h[i]=item; write(KEYS.historico,h); const a=avarias(), ia=a.findIndex(x=>String(x.id)===idv); if(ia>=0){a[ia]={...a[ia],...item};write(KEYS.avarias,a);} saveAudit('registro-baixa-editado','historico_avarias',idv,`Baixa ${item.produto||''} editada.`); return jsonResponse(item);
    }
    // Boxes
    if(path.endsWith('/api/caixas') && method==='GET'){
      const cs=read(KEYS.caixas,[]), cps=read(KEYS.caixaProdutos,[]), av=avarias(); return jsonResponse(cs.map(c=>{const its=cps.filter(x=>String(x.caixaId)===String(c.id)); const regs=av.filter(x=>x.caixa===c.numero); return {...c,totalRegistros:regs.length,quantidadeTotal:regs.reduce((s,x)=>s+num(x.quantidade),0),valorAcumulado:regs.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0),avariasPendentes:regs.filter(x=>x.status==='Pendente').length,ultimoLancamento:regs.sort((a,b)=>new Date(b.criadoEm||0)-new Date(a.criadoEm||0))[0]?.criadoEm||null,totalItens:its.length,quantidadeItens:its.reduce((s,x)=>s+num(x.quantidade),0),valorItens:its.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0)};}));
    }
    if(path.endsWith('/api/caixas') && method==='POST'){
      const numero=text(body.numero); if(!numero)return jsonResponse({erro:'Informe o nome da caixa.'},400); const cs=read(KEYS.caixas,[]); if(cs.some(c=>String(c.numero).toLowerCase()===numero.toLowerCase()))return jsonResponse({erro:'Essa caixa já está cadastrada.'},409); const c={id:body.id||id(),numero,local:text(body.local),responsavel:text(body.responsavel),criadoEm:now()}; cs.unshift(c);write(KEYS.caixas,cs);saveAudit('caixa-criada','caixa',c.id,`Caixa ${numero} cadastrada.`); return jsonResponse({...c,totalItens:0},201);
    }
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos$/); if(m && method==='GET'){const cid=decodeURIComponent(m[1]), c=read(KEYS.caixas,[]).find(x=>String(x.id)===cid); if(!c)return jsonResponse({erro:'Caixa não encontrada.'},404); const items=read(KEYS.caixaProdutos,[]).filter(x=>String(x.caixaId)===cid); return jsonResponse({caixa:{id:c.id,numero:c.numero,local:c.local||'',responsavel:c.responsavel||''},itens});}
    if(m && method==='POST' && path.includes('/api/caixas/') && path.endsWith('/produtos')){
      const cid=decodeURIComponent(m[1]), c=read(KEYS.caixas,[]).find(x=>String(x.id)===cid); if(!c)return jsonResponse({erro:'Caixa não encontrada.'},404); const p=findProduct(body.codigo); if(!p)return jsonResponse({erro:`Produto ${body.codigo} não encontrado.`},404); const qty=num(body.quantidade); if(qty<=0)return jsonResponse({erro:'Informe uma quantidade maior que zero.'},400); const cps=read(KEYS.caixaProdutos,[]), i=cps.findIndex(x=>String(x.caixaId)===cid&&String(x.codigo)===String(p.codigo)); const item={id:i>=0?cps[i].id:id(),caixaId:cid,codigo:p.codigo,produto:p.produto||p.descricao,categoria:text(body.categoria)||p.categoria||'Mercearia',motivo:text(body.motivo),setorOrigem:text(body.setorOrigem)||'Loja',quantidade:qty+(i>=0?num(cps[i].quantidade):0),valorUnitario:num(p.valorCusto),criadoEm:i>=0?cps[i].criadoEm:now(),atualizadoEm:now()}; if(i>=0)cps[i]=item;else cps.unshift(item);write(KEYS.caixaProdutos,cps);saveAudit('caixa-produto-adicionado','caixa_produto',item.id,`Produto ${item.produto} adicionado à caixa ${c.numero}.`);return jsonResponse(item,201);}
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos\/excluir$/); if(m && method==='DELETE'){const cid=decodeURIComponent(m[1]), ids=Array.isArray(body.ids)?body.ids.map(String):[], cps=read(KEYS.caixaProdutos,[]), before=cps.length, out=cps.filter(x=>!(String(x.caixaId)===cid&&ids.includes(String(x.id))));write(KEYS.caixaProdutos,out);return jsonResponse({ok:true,removidos:before-out.length});}
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos\/([^/]+)\/remover$/); if(m && method==='POST'){const cid=decodeURIComponent(m[1]), iid=decodeURIComponent(m[2]), cps=read(KEYS.caixaProdutos,[]), before=cps.length;write(KEYS.caixaProdutos,cps.filter(x=>!(String(x.caixaId)===cid&&String(x.id)===iid)));return jsonResponse({ok:true,removido:iid});}
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos\/([^/]+)$/); if(m && method==='DELETE'){const cid=decodeURIComponent(m[1]), iid=decodeURIComponent(m[2]), cps=read(KEYS.caixaProdutos,[]);write(KEYS.caixaProdutos,cps.filter(x=>!(String(x.caixaId)===cid&&String(x.id)===iid)));return jsonResponse({ok:true});}
    m=path.match(/\/api\/caixas\/([^/]+)\/conteudo$/); if(m && method==='GET'){const cid=decodeURIComponent(m[1]), c=read(KEYS.caixas,[]).find(x=>String(x.id)===cid);if(!c)return jsonResponse({erro:'Caixa não encontrada.'},404);const itens=read(KEYS.caixaProdutos,[]).filter(x=>String(x.caixaId)===cid);return jsonResponse({caixa:{id:c.id,numero:c.numero,local:c.local||'',responsavel:c.responsavel||''},resumo:{totalRegistros:itens.length,quantidade:itens.reduce((s,x)=>s+num(x.quantidade),0),valor:itens.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0),pendentes:0,ultimoLancamento:itens.sort((a,b)=>new Date(b.criadoEm||0)-new Date(a.criadoEm||0))[0]?.criadoEm||null},itens});}
    m=path.match(/\/api\/caixas\/([^/]+)$/); if(m && method==='DELETE'){const cid=decodeURIComponent(m[1]), cs=read(KEYS.caixas,[]), c=cs.find(x=>String(x.id)===cid);if(!c)return jsonResponse({erro:'Caixa não encontrada.'},404);const pending=avarias().some(x=>x.caixa===c.numero&&x.status==='Pendente');if(pending)return jsonResponse({erro:'Essa caixa possui avarias pendentes.'},409);write(KEYS.caixas,cs.filter(x=>String(x.id)!==cid));write(KEYS.caixaProdutos,read(KEYS.caixaProdutos,[]).filter(x=>String(x.caixaId)!==cid));saveAudit('caixa-excluida','caixa',cid,`Caixa ${c.numero} excluída.`);return jsonResponse({ok:true});}
    // Tasks
    if(path.endsWith('/api/tarefas/usuarios') && method==='GET'){return jsonResponse(read(KEYS.users,[]).filter(x=>x.ativo!==false).map(x=>({id:x.id,usuario:x.usuario,nome:x.nome,perfil:x.perfil,ativo:x.ativo!==false})));}
    if(path.endsWith('/api/tarefas/minhas') && method==='GET'){const data=text(q.get('data'));return jsonResponse(read(KEYS.tarefas,[]).filter(x=>String(x.usuarioId)===String(user?.id||1)&&x.dataTarefa===data).sort((a,b)=>Number(a.concluida)-Number(b.concluida)||Number(a.id)-Number(b.id)));}
    if(path.endsWith('/api/tarefas/admin') && method==='GET'){const data=text(q.get('data')),uid=Number(q.get('usuarioId')||0);return jsonResponse(read(KEYS.tarefas,[]).filter(x=>x.dataTarefa===data&&(uid<=0||Number(x.usuarioId)===uid)));}
    if(path.endsWith('/api/tarefas') && method==='POST'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);const uid=text(body.usuarioId), users=read(KEYS.users,[]).filter(x=>x.ativo!==false&&(uid==='todos'||String(x.id)===uid));if(!users.length)return jsonResponse({erro:'Não há usuários ativos para receber a tarefa.'},400);const ts=read(KEYS.tarefas,[]),created=[];for(const u of users){const t={id:Date.now()+Math.floor(Math.random()*1000)+created.length,usuarioId:u.id,usuarioNome:u.nome,titulo:text(body.titulo),descricao:text(body.descricao),dataTarefa:text(body.data),concluida:false,concluidaEm:null,criadoPor:user.id,criadoPorNome:user.nome,criadoEm:now()};ts.push(t);created.push(t);const ns=read(KEYS.notificacoes,[]);ns.unshift({id:id(),usuarioId:u.id,tipo:'tarefa_nova',titulo:'Nova tarefa atribuída',mensagem:`${user.nome} atribuiu a tarefa "${t.titulo}" para você.`,criadoEm:now(),lida:false,tarefaId:t.id});write(KEYS.notificacoes,ns);}write(KEYS.tarefas,ts);saveAudit('criado','tarefa_diaria',created[0].id,`Tarefa diária criada: ${body.titulo}.`);return jsonResponse({ok:true,quantidade:created.length,tarefas:created},201);}
    m=path.match(/\/api\/tarefas\/minhas\/concluir-todas$/); if(m && method==='PATCH'){const data=text(body.data),ts=read(KEYS.tarefas,[]);let n=0;ts.forEach(t=>{if(String(t.usuarioId)===String(user?.id||1)&&t.dataTarefa===data&&!t.concluida){t.concluida=true;t.concluidaEm=now();n++;}});write(KEYS.tarefas,ts);return jsonResponse({ok:true,quantidade:n});}
    m=path.match(/\/api\/tarefas\/([^/]+)$/); if(m && method==='PATCH'){const iid=decodeURIComponent(m[1]),ts=read(KEYS.tarefas,[]),i=ts.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Tarefa não encontrada.'},404);ts[i].concluida=!!body.concluida;ts[i].concluidaEm=ts[i].concluida?now():null;write(KEYS.tarefas,ts);saveAudit(ts[i].concluida?'concluido':'reaberto','tarefa_diaria',iid,`Checklist ${ts[i].concluida?'concluído':'reaberto'}: ${ts[i].titulo}.`);return jsonResponse(ts[i]);}
    if(path.endsWith('/api/tarefas/copiar-dia') && method==='POST'){const origem=text(body.origem),destino=text(body.destino),uid=Number(body.usuarioId||0),ts=read(KEYS.tarefas,[]),orig=ts.filter(t=>t.dataTarefa===origem&&(uid<=0||Number(t.usuarioId)===uid));let n=0;for(const t of orig){if(ts.some(x=>x.dataTarefa===destino&&String(x.usuarioId)===String(t.usuarioId)&&x.titulo.trim().toLowerCase()===t.titulo.trim().toLowerCase()&&(x.descricao||'')===(t.descricao||'')))continue;ts.push({...t,id:Date.now()+Math.floor(Math.random()*10000)+n,dataTarefa:destino,concluida:false,concluidaEm:null,criadoEm:now()});n++;}write(KEYS.tarefas,ts);return jsonResponse({ok:true,quantidade:n,origem,destino});}
    if(m && method==='DELETE' && path.includes('/api/tarefas/')){const iid=decodeURIComponent(m[1]),ts=read(KEYS.tarefas,[]),i=ts.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Tarefa não encontrada.'},404);ts.splice(i,1);write(KEYS.tarefas,ts);saveAudit('excluido','tarefa_diaria',iid,'Tarefa diária excluída.');return jsonResponse({ok:true,id:iid});}
    // Users
    if(path.endsWith('/api/usuarios') && method==='GET'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);return jsonResponse(read(KEYS.users,[]).map(x=>({id:x.id,usuario:x.usuario,nome:x.nome,perfil:x.perfil,ativo:x.ativo,criadoEm:x.criadoEm})).sort((a,b)=>a.perfil==='admin'?-1:b.perfil==='admin'?1:a.nome.localeCompare(b.nome,'pt-BR')));}
    if(path.endsWith('/api/usuarios') && method==='POST'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);const usuario=text(body.usuario).toLowerCase(),nome=text(body.nome),senha=String(body.senha||'');if(!/^[a-z0-9._-]{3,40}$/.test(usuario))return jsonResponse({erro:'O usuário deve ter de 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou underline.'},400);if(senha.length<6)return jsonResponse({erro:'A senha precisa ter pelo menos 6 caracteres.'},400);const us=read(KEYS.users,[]);if(us.some(x=>x.usuario===usuario))return jsonResponse({erro:'Esse nome de usuário já está em uso.'},409);const u={id:Date.now(),usuario,nome,perfil:'usuario',ativo:true,senha,criadoEm:now()};us.push(u);write(KEYS.users,us);saveAudit('criado','usuario',u.id,`Usuário ${usuario} criado.`);return jsonResponse({id:u.id,usuario:u.usuario,nome:u.nome,perfil:u.perfil,ativo:u.ativo,criadoEm:u.criadoEm},201);}
    m=path.match(/\/api\/usuarios\/([^/]+)\/status$/);if(m&&method==='PATCH'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);const iid=Number(decodeURIComponent(m[1])),us=read(KEYS.users,[]),i=us.findIndex(x=>Number(x.id)===iid);if(i<0)return jsonResponse({erro:'Usuário não encontrado.'},404);if(Number(user.id)===iid&&!body.ativo)return jsonResponse({erro:'O administrador logado não pode desativar o próprio acesso.'},400);us[i].ativo=!!body.ativo;write(KEYS.users,us);return jsonResponse({ok:true});}
    m=path.match(/\/api\/usuarios\/([^/]+)\/senha$/);if(m&&method==='PATCH'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);const iid=Number(decodeURIComponent(m[1])),us=read(KEYS.users,[]),i=us.findIndex(x=>Number(x.id)===iid);if(i<0)return jsonResponse({erro:'Usuário não encontrado.'},404);const senha=String(body.senha||'');if(senha.length<6)return jsonResponse({erro:'A nova senha precisa ter pelo menos 6 caracteres.'},400);us[i].senha=senha;write(KEYS.users,us);return jsonResponse({ok:true});}
    m=path.match(/\/api\/usuarios\/([^/]+)$/);if(m&&method==='DELETE'){if(!isAdmin())return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403);const iid=Number(decodeURIComponent(m[1])),us=read(KEYS.users,[]),i=us.findIndex(x=>Number(x.id)===iid);if(i<0)return jsonResponse({erro:'Usuário não encontrado.'},404);if(Number(user.id)===iid)return jsonResponse({erro:'O administrador logado não pode excluir o próprio usuário.'},400);if(us[i].perfil==='admin'&&us.filter(x=>x.perfil==='admin').length===1)return jsonResponse({erro:'Não é possível excluir o único administrador do sistema.'},400);const [u]=us.splice(i,1);write(KEYS.users,us);return jsonResponse({ok:true,id:iid,usuario:u.usuario});}
    // Notifications
    if(path.endsWith('/api/notificacoes')&&method==='GET'){const ns=read(KEYS.notificacoes,[]).filter(x=>String(x.usuarioId)===String(user?.id||1));return jsonResponse({notificacoes:ns,naoLidas:ns.filter(x=>!x.lida).length});}
    m=path.match(/\/api\/notificacoes\/([^/]+)\/lida$/);if(m&&method==='PATCH'){const ns=read(KEYS.notificacoes,[]);const i=ns.findIndex(x=>String(x.id)===decodeURIComponent(m[1]));if(i>=0)ns[i].lida=true;write(KEYS.notificacoes,ns);return jsonResponse({ok:true});}
    if(path.endsWith('/api/notificacoes/lidas')&&method==='PATCH'){const ns=read(KEYS.notificacoes,[]);ns.forEach(x=>{if(String(x.usuarioId)===String(user?.id||1))x.lida=true});write(KEYS.notificacoes,ns);return jsonResponse({ok:true});}
    // Audit
    if(path.endsWith('/api/auditoria')&&method==='GET'){return jsonResponse(read(KEYS.auditoria,[]).slice(0,Number(q.get('limite')||300)));}
    if(path.endsWith('/api/diagnostico-historico')&&method==='GET'){const h=historico();return jsonResponse({ok:true,versao:'21.6-web',banco:{banco:'localStorage',usuario:'navegador'},avarias:avarias().length,historicoTotal:h.length,historicoAtivo:h.filter(x=>!x.removido).length,historicoRemovido:h.filter(x=>x.removido).length,colunas:[]});}
    // Map
    if(path.endsWith('/api/mapeamento')&&method==='GET')return jsonResponse(read(KEYS.mapeamento,[]).filter(x=>x.ativo!==false));
    m=path.match(/\/api\/mapeamento\/([^/]+)$/);if(m&&method==='PUT'){if(!isAdmin())return jsonResponse({erro:'Somente o administrador pode editar o mapeamento.'},403);const iid=decodeURIComponent(m[1]),mp=read(KEYS.mapeamento,[]),i=mp.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Posição do mapeamento não encontrada.'},404);mp[i].nome=text(body.nome).slice(0,120);mp[i].atualizadoEm=now();mp[i].atualizadoPor=user?.usuario||'admin';write(KEYS.mapeamento,mp);return jsonResponse(mp[i]);}
    if(m&&method==='DELETE'&&path.includes('/api/mapeamento/')){if(!isAdmin())return jsonResponse({erro:'Somente o administrador pode excluir.'},403);const iid=decodeURIComponent(m[1]),mp=read(KEYS.mapeamento,[]),i=mp.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Quadrado não encontrado.'},404);mp[i].ativo=false;mp[i].atualizadoEm=now();mp[i].atualizadoPor=user?.usuario||'admin';write(KEYS.mapeamento,mp);return jsonResponse(mp[i]);}
    // Dashboard boxes summary
    if(path.endsWith('/api/dashboard/caixas-resumo')&&method==='GET'){
      const f=text(q.get('fornecedor')), cat=text(q.get('categoria')), cx=text(q.get('caixa')), prod=text(q.get('produto')).toLowerCase(); const cs=read(KEYS.caixas,[]),ps=read(KEYS.produtos,[]),cps=read(KEYS.caixaProdutos,[]); const items=cps.filter(x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));const forn=p?.fornecedor||c?.responsavel||'Não informado';return (!f||f==='Todos'||forn===f)&&(!cat||cat==='Todos'||(x.categoria||p?.categoria||'Mercearia')===cat)&&(!cx||cx==='Todos'||String(x.caixaId)===cx)&&(!prod||`${x.produto} ${x.codigo}`.toLowerCase().includes(prod));});
      const base=items.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0), groups=(arr,key)=>{const m=new Map();arr.forEach(x=>{const k=key(x)||'Não informado';const v=m.get(k)||{fornecedor:k,categoria:k,produtos:0,quantidade:0,valor:0};v.produtos++;v.quantidade+=num(x.quantidade);v.valor+=num(x.quantidade)*num(x.valorUnitario);m.set(k,v)});return [...m.values()].sort((a,b)=>b.valor-a.valor)}; const fornecedores=groups(items,x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));return p?.fornecedor||c?.responsavel||'Não informado'}); const categorias=groups(items,x=>x.categoria||ps.find(p=>String(p.codigo)===String(x.codigo))?.categoria||'Mercearia'); const produtosMap=new Map();items.forEach(x=>{const k=String(x.codigo);const p=produtosMap.get(k)||{produto:x.produto,codigo:x.codigo,categoria:x.categoria,fornecedor:ps.find(p=>String(p.codigo)===k)?.fornecedor||'',caixas:0,quantidade:0,valor:0};p.caixas++;p.quantidade+=num(x.quantidade);p.valor+=num(x.quantidade)*num(x.valorUnitario);produtosMap.set(k,p)});const produtos=[...produtosMap.values()].sort((a,b)=>b.valor-a.valor);const caixas=cs.map(c=>{const its=items.filter(x=>String(x.caixaId)===String(c.id));return{caixa:c.numero,fornecedor:c.responsavel||'',local:c.local||'',produtos:its.length,quantidade:its.reduce((s,x)=>s+num(x.quantidade),0),valor:its.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0)}}).filter(x=>x.produtos).sort((a,b)=>b.valor-a.valor);const fornecedoresNomes=[...new Set(cps.map(x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));return p?.fornecedor||c?.responsavel||'Não informado'}))].sort((a,b)=>a.localeCompare(b,'pt-BR')); const categoriasNomes=[...new Set(cps.map(x=>x.categoria||ps.find(p=>String(p.codigo)===String(x.codigo))?.categoria||'Mercearia'))].sort((a,b)=>a.localeCompare(b,'pt-BR')); const caixasNomes=cs.filter(c=>cps.some(x=>String(x.caixaId)===String(c.id))).map(c=>({id:c.id,numero:c.numero,local:c.local||'-',fornecedor:c.responsavel||'Não informado'})); return jsonResponse({filtros:{fornecedores:fornecedoresNomes,categorias:categoriasNomes,caixas:caixasNomes},total:{caixasComProdutos:new Set(items.map(x=>x.caixaId)).size,quantidade:items.reduce((s,x)=>s+num(x.quantidade),0),valor:base,produtosDistintos:new Set(items.map(x=>x.codigo)).size},fornecedores:fornecedores.map(x=>({...x,participacao:base?x.valor/base*100:0})),categorias,produtos,caixas});
    }
    // Local intelligent analysis, no external API key.
    if(path.endsWith('/api/dashboard/ia')&&method==='POST'){
      const scope=text(body.escopo)||'avarias'; if(scope==='caixas'){const cps=read(KEYS.caixaProdutos,[]), total=cps.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0), top=[...new Map(cps.map(x=>[x.fornecedor||x.produto,{valor:num(x.quantidade)*num(x.valorUnitario)}])).entries()].sort((a,b)=>b[1].valor-a[1].valor)[0]; return jsonResponse({modo:'local',resposta:`### Análise local\n\n- **Valor armazenado:** R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}.\n- **Maior concentração:** ${top?.[0]||'Não informado'}${top?` (${top[1].valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})`:''}.\n- O resultado considera apenas os dados atualmente salvos neste navegador.`});}
      const a=avarias().filter(x=>x.status!=='Pendente'); const total=a.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0); const byF=new Map();a.forEach(x=>byF.set(x.fornecedor,(byF.get(x.fornecedor)||0)+num(x.quantidade)*num(x.valorUnitario)));const top=[...byF.entries()].sort((x,y)=>y[1]-x[1])[0];return jsonResponse({modo:'local',resposta:`### Análise local\n\n- **Registros movimentados:** ${a.length}.\n- **Valor movimentado:** R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}.\n- **Maior concentração por fornecedor:** ${top?.[0]||'Não informado'}${top?` (${top[1].toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})`:''}.\n- A análise é calculada localmente e não envia os dados para nenhum serviço externo.`});
    }
    // Export endpoints: generate CSV locally. Existing UI will download it.
    if((path.endsWith('/api/avarias/exportar')||path.endsWith('/api/avarias/exportar-pdf')||path.endsWith('/api/avarias/exportar-pdf-registros'))&&method==='POST'){
      const rows=Array.isArray(body.registros)?body.registros:[];
      if(path.endsWith('/api/avarias/exportar')){
        const headers=['Data','Código','Produto','Fornecedor','Categoria','Cód. fornecedor','Quantidade','Valor unitário','Valor total','Setor','Motivo','Usuário','Caixa','Status','Observação']; const escCsv=v=>`\"${String(v??'').replace(/\"/g,'\"\"')}\"`; const csv='\ufeff'+headers.map(escCsv).join(';')+'\n'+rows.map(r=>headers.map(h=>escCsv(({Data:r.data,Código:r.codigo,Produto:r.produto,Fornecedor:r.fornecedor,Categoria:r.categoria,'Cód. fornecedor':r.codigoFornecedor,Quantidade:r.quantidade,'Valor unitário':r.valorUnitario,'Valor total':r.valorTotal,Setor:r.setor,Motivo:r.tipo,Usuário:r.usuario,Caixa:r.caixa,Status:r.status,Observação:r.observacao})[h])).join(';')).join('\n'); return blobResponse(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      }
      const strip=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' '); const pdfEsc=v=>strip(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
      const lines=['CONTROLE DE AVARIAS - RELATORIO','Gerado em '+new Date().toLocaleString('pt-BR'),'',`Registros: ${rows.length}`,'']; rows.forEach((r,i)=>{lines.push(`${i+1}. ${strip(r.produto||'-')} | Cod: ${strip(r.codigo||'-')}`);lines.push(`Fornecedor: ${strip(r.fornecedor||'-')} | Qtd: ${strip(r.quantidade)} | Valor: R$ ${strip(r.valorTotal)}`);lines.push(`Data: ${strip(r.data||'-')} | Setor: ${strip(r.setor||'-')} | Motivo: ${strip(r.tipo||'-')}`);lines.push('');});
      const perPage=48,pages=[];for(let i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage)); const objects=[]; objects[1]='<< /Type /Catalog /Pages 2 0 R >>'; objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; const pageRefs=[]; pages.forEach((pg,idx)=>{const pageObj=4+idx*2,contentObj=5+idx*2;pageRefs.push(pageObj);const stream=['BT','/F1 9 Tf','40 800 Td',...pg.map((line,j)=>`(${pdfEsc(line)}) Tj${j<pg.length-1?' 0 -14 Td':''}`),'ET'].join('\n');objects[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`;objects[contentObj]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;}); objects[2]=`<< /Type /Pages /Kids [${pageRefs.map(n=>n+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`; let pdf='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xref=pdf.length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return blobResponse(new Blob([pdf],{type:'application/pdf'}));
    }
    return jsonResponse({erro:`Rota não implementada no modo Web: ${method} ${path}`},404);
  }
  window.fetch = async function(input, options={}){
    let u=typeof input==='string'?input:(input?.url||''); const p=pathOf(u);
    if(p.includes('/api/')) { try { const r=await route(u,options); if(r) return r; } catch(e){ console.error('Local API:',e); return jsonResponse({erro:e.message||'Erro local.'},500); } }
    return originalFetch(input,options);
  };
  class LocalEventSource {
    constructor(url){this.url=url;this.readyState=1;this.listeners={};setTimeout(()=>this.dispatch('open',{}),0);}
    addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);}
    removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x!==fn);}
    dispatch(type,data){for(const fn of this.listeners[type]||[])try{fn({type,data});}catch(e){console.warn(e)}}
    close(){this.readyState=2;}
  }
  window.EventSource = LocalEventSource;
  window.addEventListener('storage', e => { if(e.key===KEYS.avarias||e.key===KEYS.historico||e.key===KEYS.caixas||e.key===KEYS.caixaProdutos||e.key===KEYS.tarefas) window.dispatchEvent(new CustomEvent('ca-local-data-changed',{detail:{key:e.key}})); });
  window.CA_LOCAL={version:'21.6-web',keys:KEYS,exportData(){const out={version:'21.6-web',exportadoEm:now(),dados:{}};for(const k of Object.values(KEYS))out.dados[k]=read(k,[]);return out;},importData(obj){if(!obj?.dados)throw new Error('Backup inválido.');for(const [k,v] of Object.entries(obj.dados))if(Object.values(KEYS).includes(k))write(k,v);location.reload();}};
})();
