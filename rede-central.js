/*
 * CONTROLE DE AVARIAS V25.1.20 - ADAPTADOR VITRINE
 *
 * Frontend intocado. Este arquivo substitui apenas a ponte de backend:
 * - não usa Node/PostgreSQL/servidor central;
 * - intercepta /api/* no próprio navegador;
 * - usa sessionStorage para os dados da sessão;
 * - o catálogo de produtos empacotado permanece somente em memória;
 * - fechar a sessão encerra os dados operacionais gravados durante a sessão.
 */
(() => {
  window.CA_LOCAL_MODE = true;
  // Ponto relativo: os scripts continuam montando `${API}/api/...` e o interceptor abaixo
  // transforma essas chamadas em rotas locais, inclusive quando o projeto é aberto como file://.
  window.CA_API_BASE = '.';
  window.CA_LOCAL_ADAPTER_FILE = 'vitrine-v25.1.20';
  const originalFetch = window.fetch.bind(window);

  const PRODUCT_SEED_GZIP_B64 = 'H4sIAAAAAAAC/4uOBQApu0wNAgAAAA==';
  const CORE_SEED = {"users":[{"id":1,"usuario":"admin","nome":"Administrador","perfil":"admin","ativo":true,"senha":"admin123","criadoEm":"2026-10-26T00:00:00.000Z"}],"avarias":[],"historicoAvarias":[],"caixas":[],"caixaProdutos":[],"tarefas":[],"auditoria":[],"mapeamentoCaixas":[],"notificacoesCaixas":[],"recuperacoes":[],"doacoes":[],"documentosRecuperacao":[],"documentosDoacao":[]};
  let productCache = null;
  let productLoadPromise = null;

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
    notificacoes: 'notificacoesCaixas',
    recuperacoes: 'ca_v25_recuperacoes',
    doacoes: 'ca_v25_doacoes',
    documentosRecuperacao: 'ca_v25_documentos_recuperacao',
    documentosDoacao: 'ca_v25_documentos_doacao'
  };
  const now = () => new Date().toISOString();
  const id = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const read = (k, fallback=[]) => {
    if (k === KEYS.produtos && Array.isArray(productCache)) return productCache;
    try { const v = JSON.parse(sessionStorage.getItem(k)); return v ?? fallback; } catch { return fallback; }
  };
  const write = (k,v) => { if (k === KEYS.produtos) { productCache = Array.isArray(v) ? v : []; sessionStorage.setItem(k, JSON.stringify(productCache)); return; } sessionStorage.setItem(k, JSON.stringify(v)); };
  async function ensureProducts(){
    if (Array.isArray(productCache)) return productCache;
    if (productLoadPromise) return productLoadPromise;
    productLoadPromise = (async()=>{
      try {
        const existing = JSON.parse(sessionStorage.getItem(KEYS.produtos)||'null');
        if (Array.isArray(existing) && existing.length) { productCache=existing; return productCache; }
      } catch {}
      const bin=Uint8Array.from(atob(PRODUCT_SEED_GZIP_B64), c=>c.charCodeAt(0));
      if (typeof DecompressionStream !== 'function') throw new Error('Este navegador não suporta a carga do banco local. Atualize o Chrome/Edge.');
      const ds=new DecompressionStream('gzip');
      const out=await new Response(new Blob([bin]).stream().pipeThrough(ds)).text();
      productCache=JSON.parse(out);
      return productCache;
    })();
    try { return await productLoadPromise; } finally { productLoadPromise=null; }
  }
  const num = v => { if(typeof v==='number') return Number.isFinite(v)?v:0; const t=String(v??'').trim(); if(!t)return 0; const n=Number(t.replace(/\./g,'').replace(',','.')); if(Number.isFinite(n))return n; const f=Number(t.replace(',','.')); return Number.isFinite(f)?f:0; };
  const text = v => String(v ?? '').trim();
  const currentUser = () => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null'); } catch { return null; } };
  async function senhaConfere(usuario, senha) {
    if (!usuario) return false;
    if (usuario.senha_hash_original || usuario.senha_hash) {
      try {
        if (window.bcrypt && typeof window.bcrypt.compare === 'function') {
          return await window.bcrypt.compare(String(senha || ''), usuario.senha_hash_original || usuario.senha_hash);
        }
      } catch (e) { console.warn('Falha ao validar senha bcrypt:', e); }
      return false;
    }
    return String(usuario.senha || '') === String(senha || '');
  };
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
  const findProduct = async codigo => {
    const c=text(codigo); const ps=await ensureProducts(); return ps.find(p=>p.ativo!==false && (text(p.codigo)===c || (c.length===13 && text(p.codigo).padStart(13,'0')===c))) || null;
  };
  const avarias = () => read(KEYS.avarias,[]);
  const historico = () => read(KEYS.historico,[]);
  const syncHistory = a => {
    let h = historico(); const i=h.findIndex(x=>String(x.id)===String(a.id));
    const item={...a};
    if(i>=0) h[i]={...h[i],...item}; else h.unshift(item);
    write(KEYS.historico,h);
  };
  const VITRINE_SEED_VERSION = '2026-10-27-vitrine-clean';
  const seed = () => {
    const hasMarker = sessionStorage.getItem('ca_v25_seed_version');
    if (hasMarker !== VITRINE_SEED_VERSION) {
      // A versão vitrine nunca herda dados de uma instalação anterior.
      // Isso evita que um navegador reutilizado mostre usuários, lançamentos ou configurações antigas.
      for (const key of Object.values(KEYS)) sessionStorage.removeItem(key);
      sessionStorage.removeItem('usuarioLogado');
      try { localStorage.removeItem('controleAvariasServidor'); } catch (_) {}

      sessionStorage.setItem(KEYS.users, JSON.stringify([
        {id:1,usuario:'admin',nome:'Administrador',perfil:'admin',ativo:true,senha:'admin123',criadoEm:now()}
      ]));
      sessionStorage.setItem(KEYS.avarias,'[]');
      sessionStorage.setItem(KEYS.historico,'[]');
      sessionStorage.setItem(KEYS.produtos,'[]');
      sessionStorage.setItem(KEYS.caixas,'[]');
      sessionStorage.setItem(KEYS.caixaProdutos,'[]');
      sessionStorage.setItem(KEYS.tarefas,'[]');
      sessionStorage.setItem(KEYS.auditoria,'[]');
      sessionStorage.setItem(KEYS.notificacoes,'[]');
      sessionStorage.setItem(KEYS.mapeamento,'[]');
      sessionStorage.setItem(KEYS.recuperacoes,'[]');
      sessionStorage.setItem(KEYS.doacoes,'[]');
      sessionStorage.setItem(KEYS.documentosRecuperacao,'[]');
      sessionStorage.setItem(KEYS.documentosDoacao,'[]');
      sessionStorage.setItem('ca_v25_seed_version', VITRINE_SEED_VERSION);
      productCache = [];
    }

    const currentUsers = read(KEYS.users, []);
    if (!Array.isArray(currentUsers) || !currentUsers.some(u => String(u.usuario).toLowerCase() === 'admin')) {
      write(KEYS.users, [{id:1,usuario:'admin',nome:'Administrador',perfil:'admin',ativo:true,senha:'admin123',criadoEm:now()}]);
    }
    if (!Array.isArray(read(KEYS.mapeamento,null)) || !read(KEYS.mapeamento,[]).length) {
      const cfg=[{l:1,q:20},{l:2,q:16},{l:3,q:16},{l:4,q:14},{l:5,q:14}];
      const mapa=[]; let n=1;
      for(const row of cfg){
        for(let c=1;c<=row.q;c++) mapa.push({id:`m${n++}`,linha:row.l,coluna:c,nome:'',ativo:true,atualizadoEm:now(),atualizadoPor:''});
      }
      write(KEYS.mapeamento,mapa);
    }
  };
  seed();

  async function route(url, options={}) {
    const path=pathOf(url), method=methodOf(options), q=queryOf(url), body=await bodyOf(options), user=currentUser();
    if(!path.includes('/api/')) return null;
    if(path.endsWith('/api/saude') || path.endsWith('/api/status') || path.endsWith('/api/versao')) return jsonResponse({ok:true,versao:'25.1.6-web-local',mensagem:'Modo web local ativo.'});
    if(path.endsWith('/api/login') && method==='POST'){
      const usuario=text(body.usuario).toLowerCase(), senha=String(body.senha||''); const u=read(KEYS.users,[]).find(x=>x.usuario===usuario);
      if(!u || u.ativo===false || !(await senhaConfere(u, senha))) return jsonResponse({erro:u?.ativo===false?'Usuário desativado.':'Usuário ou senha incorretos.'},u?.ativo===false?403:401);
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
      if(body.senhaAtual || body.novaSenha){ if(!(await senhaConfere(us[i], String(body.senhaAtual||'')))) return jsonResponse({erro:'A senha atual está incorreta.'},400); if(String(body.novaSenha||'').length<6) return jsonResponse({erro:'A nova senha precisa ter pelo menos 6 caracteres.'},400); us[i].senha=String(body.novaSenha); delete us[i].senha_hash_original; delete us[i].senha_hash; }
      us[i].nome=nome; write(KEYS.users,us); sessionStorage.setItem('usuarioLogado',JSON.stringify({...user,nome})); saveAudit('atualizado','perfil_usuario',us[i].id,'Perfil atualizado.'); return jsonResponse({ok:true,id:us[i].id,usuario:us[i].usuario,nome:us[i].nome,perfil:us[i].perfil,ativo:us[i].ativo,criadoEm:us[i].criadoEm});
    }
    if(path.endsWith('/api/avarias') && method==='GET'){
      let a=avarias(); const st=text(q.get('status')); if(st && st!=='Todos') a=a.filter(x=>x.status===st); return jsonResponse(a.sort((x,y)=>new Date(y.criadoEm||0)-new Date(x.criadoEm||0)));
    }
    if(path.endsWith('/api/avarias') && method==='POST'){
      const p=await findProduct(body.codigo); if(!p) return jsonResponse({erro:`Produto não encontrado para o código ${body.codigo}.`},404);
      const quantidade=num(body.quantidade); if(!Number.isFinite(quantidade)||quantidade<=0||quantidade>100000) return jsonResponse({erro:'Quantidade inválida. O limite por lançamento é 100.000.'},400); if(num(p.valorCusto)<=0) return jsonResponse({erro:`O produto ${p.codigo} foi encontrado, mas está sem valor de custo válido.`},422);
      const item={id:body.id||id(),codigo:p.codigo,produto:p.produto||p.descricao,fornecedor:p.fornecedor||'',codigoFornecedor:p.codigoFornecedor||'',categoria:text(body.categoria)||p.categoria||'Mercearia',quantidade,valorUnitario:num(p.valorCusto),setor:text(body.setor)||'Loja',tipo:text(body.tipo),caixa:'',usuarioLancamento:user?.usuario||'admin',status:'Pendente',observacao:text(body.observacao),criadoEm:body.criadoEm||now(),movimentadoEm:body.movimentadoEm||null};
      const a=avarias(); a.unshift(item); write(KEYS.avarias,a); syncHistory(item); saveAudit('criado','avaria',item.id,`Avaria ${item.produto} cadastrada.`,null,item); return jsonResponse(item,201);
    }
    let m=path.match(/\/api\/avarias\/([^/]+)\/status$/); if(m && method==='PATCH'){
      const a=avarias(), i=a.findIndex(x=>String(x.id)===decodeURIComponent(m[1])); if(i<0) return jsonResponse({erro:'Avaria não encontrada.'},404); const st=text(body.status); if(!['Pendente','Baixa','Devolução'].includes(st)) return jsonResponse({erro:'Status inválido.'},400); a[i].status=st; a[i].movimentadoEm=st==='Pendente'?null:now(); write(KEYS.avarias,a); syncHistory(a[i]); saveAudit('status','avaria',a[i].id,`Status alterado para ${st}.`); return jsonResponse({ok:true});
    }
    m=path.match(/\/api\/avarias\/([^/]+)$/); if(m && method==='DELETE'){
      const idv=decodeURIComponent(m[1]), a=avarias(), i=a.findIndex(x=>String(x.id)===idv); if(i<0) return jsonResponse({ok:true,jaRemovido:true,historicoPreservado:true}); const [item]=a.splice(i,1); write(KEYS.avarias,a); syncHistory(item); saveAudit('excluido','avaria',item.id,`Registro ${item.produto} excluído da aba Registros.`,item,{removidoDaAvaria:true}); return jsonResponse({ok:true});
    }
    m=path.match(/\/api\/produtos\/([^/]+)$/); if(m && method==='GET' && decodeURIComponent(m[1])!=='resumo'){
      const p=await findProduct(decodeURIComponent(m[1])); if(!p) return jsonResponse({erro:'Produto não encontrado.'},404); return jsonResponse(p);
    }
    m=path.match(/\/api\/produtos\/([^/]+)\/categoria$/); if(m && method==='PUT'){
      if(!isAdmin()) return jsonResponse({erro:'Acesso permitido somente ao administrador.'},403); const c=text(body.categoria); if(!['Frios','Mercearia','Padaria','Limpeza','Bebidas'].includes(c)) return jsonResponse({erro:'Categoria inválida.'},400); const ps=await ensureProducts(), i=ps.findIndex(p=>String(p.codigo)===decodeURIComponent(m[1])); if(i<0) return jsonResponse({erro:'Produto não encontrado.'},404); ps[i].categoria=c; ps[i].atualizadoEm=now(); write(KEYS.produtos,ps); for(const k of [KEYS.avarias,KEYS.historico]){const arr=read(k,[]); arr.forEach(x=>{if(String(x.codigo)===String(ps[i].codigo))x.categoria=c;});write(k,arr);} saveAudit('categoria-alterada','produto',ps[i].codigo,`Categoria de ${ps[i].descricao} alterada.`); return jsonResponse({ok:true,codigo:ps[i].codigo,produto:ps[i].descricao,categoria:c,atualizadoPor:user?.usuario||'admin'});
    }
    if(path.endsWith('/api/produtos/resumo') && method==='GET'){const ps=await ensureProducts(); return jsonResponse({ok:true,total:ps.length,ativos:ps.filter(p=>p.ativo!==false).length});}
    if(path.endsWith('/api/produtos/importar') && method==='POST'){
      const fd=body instanceof FormData ? body : null;
      const file=fd?.get('arquivo');
      if(!file) return jsonResponse({erro:'Nenhum arquivo enviado.'},400);
      const name=text(file.name).toLowerCase();
      const isCsv=name.endsWith('.csv');
      const isExcel=name.endsWith('.xlsx') || name.endsWith('.xls');
      if(!isCsv && !isExcel) return jsonResponse({erro:'Selecione um arquivo Excel (.xlsx/.xls) ou CSV.'},400);

      let linhas=[];
      if(isExcel){
        if(!window.XLSX || typeof window.XLSX.read!=='function') return jsonResponse({erro:'O leitor de Excel não foi carregado. Recarregue a página e tente novamente.'},500);
        try{
          const ab=await file.arrayBuffer();
          const wb=window.XLSX.read(ab,{type:'array',cellDates:false});
          const nomeAba=wb.SheetNames[0];
          if(!nomeAba) return jsonResponse({erro:'A planilha está vazia.'},400);
          const ws=wb.Sheets[nomeAba];
          linhas=window.XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});
        }catch(e){
          console.error('Erro ao ler Excel no modo Web:',e);
          return jsonResponse({erro:'Não foi possível ler o arquivo Excel. Verifique se o arquivo está íntegro.'},400);
        }
      } else {
        const raw=await file.text();
        const lines=raw.split(/\r?\n/).filter(x=>x.trim());
        if(!lines.length) return jsonResponse({erro:'Arquivo vazio.'},400);
        const delim=(lines[0].split(';').length>lines[0].split(',').length)?';':',';
        const headers=lines[0].split(delim).map(x=>x.replace(/^\uFEFF/,'').trim());
        const parseLine=line=>{const vals=[];let cur='',quote=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){quote=!quote;continue}if(ch===delim&&!quote){vals.push(cur);cur='';}else cur+=ch;}vals.push(cur);return vals;};
        for(let r=1;r<lines.length;r++){const vals=parseLine(lines[r]);const row={};headers.forEach((h,i)=>row[h]=vals[i]??'');linhas.push(row);}
      }
      if(!linhas.length) return jsonResponse({erro:'A planilha está vazia.'},400);

      const normalizarCabecalhoLocal=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
      const valorColunaLocal=(row,aliases,fallback=null)=>{
        const wanted=aliases.map(normalizarCabecalhoLocal);
        for(const [k,v] of Object.entries(row||{})) if(wanted.includes(normalizarCabecalhoLocal(k)) && text(v)!=='') return v;
        if(fallback!==null){const keys=Object.keys(row||{});if(keys[fallback]!==undefined)return row[keys[fallback]];}
        return '';
      };
      const codigoLocal=v=>{if(v===null||v===undefined||v==='')return '';return String(v).trim().replace(/\.0$/,'');};
      const numeroLocal=v=>{
        if(v===null||v===undefined||v==='')return 0;
        if(typeof v==='number')return Number.isFinite(v)?v:0;
        let t=String(v).trim();if(!t)return 0;
        if(t.includes(',')&&t.includes('.'))t=t.replace(/\./g,'').replace(',','.');else if(t.includes(','))t=t.replace(',','.');
        const n=Number(t);return Number.isFinite(n)?n:0;
      };
      const aliasesCusto=['V CUSTO','VALOR C','VALOR CUSTO','VALOR DE CUSTO','CUSTO'];
      const primeira=linhas[0]||{};
      const temCusto=Object.keys(primeira).some(k=>aliasesCusto.includes(normalizarCabecalhoLocal(k)));
      if(!temCusto) return jsonResponse({erro:'A planilha não possui uma coluna de valor de custo reconhecida. Use V. CUSTO, VALOR C, VALOR CUSTO ou CUSTO.'},400);

      const pontuar=item=>{let score=0;if(numeroLocal(item.valorCusto)>0)score+=100;if(numeroLocal(item.valorVenda)>0)score+=20;if(text(item.fornecedor)!=='')score+=10;if(text(item.codigoFornecedor)!=='')score+=10;if(numeroLocal(item.estoque)!==0)score+=1;return score;};
      const escolher=(a,b)=>pontuar(b)>pontuar(a)?b:a;
      const motivo=item=>numeroLocal(item.valorCusto)>0?'Preferido: possui custo válido':'Mantido: nenhum duplicado apresentou custo válido';
      const produtosMap=new Map();const duplicadosMap=new Map();let invalidos=0;
      linhas.forEach((linha,idx)=>{
        const numeroLinha=idx+2;
        const codigo=codigoLocal(valorColunaLocal(linha,['CODIGO','COD. DE BARRAS','COD DE BARRAS','CODIGO DE BARRAS','EAN'],2));
        const descricao=text(valorColunaLocal(linha,['DESCRICAO','PRODUTO'],3));
        if(!codigo||!descricao){invalidos++;return;}
        const item={codigo,descricao,fornecedor:text(valorColunaLocal(linha,['FORNECEDOR','EMPRESA','EMPRESA/FORNECEDOR','EMPRESA / FORNECEDOR'],1)),codigoFornecedor:codigoLocal(valorColunaLocal(linha,['COD. FORNECEDOR','COD FORNECEDOR','CODIGO FORNECEDOR','CÓD FORNECEDOR'],0)),estoque:numeroLocal(valorColunaLocal(linha,['ESTOQUE','QTD ESTOQUE','QUANTIDADE ESTOQUE'],4)),valorCusto:numeroLocal(valorColunaLocal(linha,aliasesCusto,5)),valorVenda:numeroLocal(valorColunaLocal(linha,['VALOR. VEND','VALOR V','VALOR VENDA','PREÇO VENDA','PRECO VENDA'],6)),categoria:text(valorColunaLocal(linha,['CATEGORIA','DEPARTAMENTO','GRUPO','SECAO','SEÇÃO']))||productCategory(descricao),linhaPlanilha:numeroLinha};
        if(produtosMap.has(codigo)){const anterior=produtosMap.get(codigo);let rel=duplicadosMap.get(codigo);if(!rel){rel={codigo,ocorrencias:[anterior]};duplicadosMap.set(codigo,rel);}rel.ocorrencias.push(item);produtosMap.set(codigo,escolher(anterior,item));}else produtosMap.set(codigo,item);
      });
      const lista=[...produtosMap.values()];
      const duplicadosDetalhes=[...duplicadosMap.values()].map(rel=>{const escolhido=produtosMap.get(rel.codigo);return {codigo:rel.codigo,ocorrencias:rel.ocorrencias.length,linhas:rel.ocorrencias.map(x=>x.linhaPlanilha),escolhidoLinha:escolhido.linhaPlanilha,custoEscolhido:Number(escolhido.valorCusto)||0,vendaEscolhida:Number(escolhido.valorVenda)||0,estoqueEscolhido:Number(escolhido.estoque)||0,fornecedorEscolhido:escolhido.fornecedor||'',codigoFornecedorEscolhido:escolhido.codigoFornecedor||'',motivo:motivo(escolhido)}}).sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),undefined,{numeric:true}));
      const ps=await ensureProducts();const map=new Map(ps.map(p=>[String(p.codigo),p]));let novos=0,atualizados=0;
      for(const item of lista){const produto=normalizeProduct(item);const old=map.get(produto.codigo);if(old){map.set(produto.codigo,{...old,...produto});atualizados++;}else{map.set(produto.codigo,produto);novos++;}}
      write(KEYS.produtos,[...map.values()]);
      const linhasDuplicadas=duplicadosDetalhes.reduce((t,x)=>t+Math.max(0,x.ocorrencias-1),0);
      return jsonResponse({ok:true,planilha:linhas.length,produtosUnicos:lista.length,novos,atualizados,ignorados:invalidos,totalBanco:map.size,duplicados:duplicadosDetalhes.length,linhasDuplicadas,duplicadosDetalhes,duplicadosDetalhesTotal:duplicadosDetalhes.length});
    }
    if(path.endsWith('/api/historico-avarias') && method==='GET') return jsonResponse(historico().filter(x=>x.removido!==true).sort((a,b)=>new Date(b.movimentadoEm||b.criadoEm||0)-new Date(a.movimentadoEm||a.criadoEm||0)));
    m=path.match(/\/api\/historico-avarias\/([^/]+)$/); if(m && method==='DELETE'){
      if(!isAdmin()) return jsonResponse({erro:'Somente o administrador pode excluir registros do histórico.'},403); const idv=decodeURIComponent(m[1]), h=historico(), i=h.findIndex(x=>String(x.id)===idv && x.removido!==true); if(i<0)return jsonResponse({erro:'Registro do histórico não encontrado.'},404); h[i].removido=true; write(KEYS.historico,h); saveAudit('excluido','historico_avarias',idv,`Baixa ${h[i].produto||''} excluída do histórico.`,h[i],{removido:true}); return jsonResponse({ok:true});
    }
    if(m && method==='PUT' && path.includes('/api/historico-avarias/')){
      if(!isAdmin()) return jsonResponse({erro:'Somente o administrador pode editar baixas.'},403); const idv=decodeURIComponent(m[1]), h=historico(), i=h.findIndex(x=>String(x.id)===idv); if(i<0)return jsonResponse({erro:'Registro do histórico não encontrado.'},404); const novaQuantidade=num(body.quantidade); if(!Number.isFinite(novaQuantidade)||novaQuantidade<=0||novaQuantidade>100000)return jsonResponse({erro:'Quantidade inválida. O limite por lançamento é 100.000.'},400); const item={...h[i],codigo:text(body.codigo),produto:text(body.produto),fornecedor:text(body.fornecedor),codigoFornecedor:text(body.codigoFornecedor),categoria:text(body.categoria)||'Mercearia',quantidade:novaQuantidade,valorUnitario:num(body.valorUnitario),setor:text(body.setor)||'Loja',tipo:text(body.tipo),caixa:text(body.caixa),observacao:text(body.observacao),movimentadoEm:body.dataBaixa?new Date(body.dataBaixa).toISOString():h[i].movimentadoEm||now()}; h[i]=item; write(KEYS.historico,h); const a=avarias(), ia=a.findIndex(x=>String(x.id)===idv); if(ia>=0){a[ia]={...a[ia],...item};write(KEYS.avarias,a);} saveAudit('registro-baixa-editado','historico_avarias',idv,`Baixa ${item.produto||''} editada.`); return jsonResponse(item);
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
      const cid=decodeURIComponent(m[1]), c=read(KEYS.caixas,[]).find(x=>String(x.id)===cid); if(!c)return jsonResponse({erro:'Caixa não encontrada.'},404); const p=await findProduct(body.codigo); if(!p)return jsonResponse({erro:`Produto ${body.codigo} não encontrado.`},404); const qty=num(body.quantidade); if(!Number.isFinite(qty)||qty<=0||qty>100000)return jsonResponse({erro:'Informe uma quantidade válida. O limite por lançamento é 100.000.'},400); const cps=read(KEYS.caixaProdutos,[]), i=cps.findIndex(x=>String(x.caixaId)===cid&&String(x.codigo)===String(p.codigo)); const item={id:i>=0?cps[i].id:id(),caixaId:cid,codigo:p.codigo,produto:p.produto||p.descricao,categoria:text(body.categoria)||p.categoria||'Mercearia',motivo:text(body.motivo),setorOrigem:text(body.setorOrigem)||'Loja',quantidade:qty+(i>=0?num(cps[i].quantidade):0),valorUnitario:num(p.valorCusto),criadoEm:i>=0?cps[i].criadoEm:now(),atualizadoEm:now()}; if(i>=0)cps[i]=item;else cps.unshift(item);write(KEYS.caixaProdutos,cps);saveAudit('caixa-produto-adicionado','caixa_produto',item.id,`Produto ${item.produto} adicionado à caixa ${c.numero}.`);return jsonResponse(item,201);}
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
    if(path.endsWith('/api/auditoria')&&method==='DELETE'){
      if(!isAdmin()) return jsonResponse({erro:'Somente o administrador pode excluir registros de auditoria.'},403);
      const ids=Array.isArray(body.ids)?body.ids.map(x=>String(x)):[];
      if(!ids.length) return jsonResponse({erro:'Nenhum registro selecionado.'},400);
      const lista=read(KEYS.auditoria,[]);
      const alvo=new Set(ids);
      const restantes=lista.filter(x=>!alvo.has(String(x.id)));
      const excluidos=lista.length-restantes.length;
      write(KEYS.auditoria,restantes);
      return jsonResponse({ok:true,excluidos});
    }
    if(path.endsWith('/api/diagnostico-historico')&&method==='GET'){const h=historico();return jsonResponse({ok:true,versao:'25.1.6-web-local',banco:{banco:'sessionStorage',usuario:'navegador'},avarias:avarias().length,historicoTotal:h.length,historicoAtivo:h.filter(x=>!x.removido).length,historicoRemovido:h.filter(x=>x.removido).length,colunas:[]});}
    // Map
    if(path.endsWith('/api/mapeamento')&&method==='GET')return jsonResponse(read(KEYS.mapeamento,[]).filter(x=>x.ativo!==false));
    m=path.match(/\/api\/mapeamento\/([^/]+)$/);if(m&&method==='PUT'){if(!isAdmin())return jsonResponse({erro:'Somente o administrador pode editar o mapeamento.'},403);const iid=decodeURIComponent(m[1]),mp=read(KEYS.mapeamento,[]),i=mp.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Posição do mapeamento não encontrada.'},404);mp[i].nome=text(body.nome).slice(0,120);mp[i].atualizadoEm=now();mp[i].atualizadoPor=user?.usuario||'admin';write(KEYS.mapeamento,mp);return jsonResponse(mp[i]);}
    if(m&&method==='DELETE'&&path.includes('/api/mapeamento/')){if(!isAdmin())return jsonResponse({erro:'Somente o administrador pode excluir.'},403);const iid=decodeURIComponent(m[1]),mp=read(KEYS.mapeamento,[]),i=mp.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Quadrado não encontrado.'},404);mp[i].ativo=false;mp[i].atualizadoEm=now();mp[i].atualizadoPor=user?.usuario||'admin';write(KEYS.mapeamento,mp);return jsonResponse(mp[i]);}
    // V25 Recuperações e Doações — armazenamento local.
    const opDocs = type => read(type==='RECUPERACAO'?KEYS.documentosRecuperacao:KEYS.documentosDoacao,[]);
    const opRows = type => read(type==='RECUPERACAO'?KEYS.recuperacoes:KEYS.doacoes,[]);
    const saveOpRows = (type,rows)=>write(type==='RECUPERACAO'?KEYS.recuperacoes:KEYS.doacoes,rows);
    const saveOpDocs = (type,docs)=>write(type==='RECUPERACAO'?KEYS.documentosRecuperacao:KEYS.documentosDoacao,docs);
    const docLabel=(type,n)=>`${type==='RECUPERACAO'?'REC':'DOA'}-${String(n).padStart(4,'0')}`;
    const getDoc=(type,id)=>opDocs(type).find(d=>String(d.id)===String(id))||null;
    const ensureDoc=(type,data)=>{let docs=opDocs(type);let d=docs.find(x=>x.dataDocumento===data&&x.status==='ABERTO');if(!d){const n=Math.max(0,...docs.map(x=>Number(x.numero)||0))+1;d={id:id(),tipo:type,dataDocumento:data,numero:n,status:'ABERTO',beneficiario:'',criadoEm:now(),finalizadoEm:null,finalizadoPor:''};docs.unshift(d);saveOpDocs(type,docs);}return d;};
    const docSummary=(type,d)=>{if(!d)return null;const rows=opRows(type).filter(r=>String(r.documentoId)===String(d.id));const qtd=rows.reduce((s,r)=>s+num(r.quantidade),0);const val=rows.reduce((s,r)=>s+num(r.quantidade)*num(r.valorUnitario),0);return {...d,id:String(d.id),numero:Number(d.numero),documento:docLabel(type,d.numero),registros:rows.length,quantidadeRecuperada:type==='RECUPERACAO'?qtd:undefined,valorRecuperado:type==='RECUPERACAO'?val:undefined,quantidadeDoada:type==='DOACAO'?qtd:undefined,valorDoado:type==='DOACAO'?val:undefined};};
    function filtroOpRows(type,o){let rows=opRows(type).slice();const busca=text(o.busca).toLowerCase(),forn=text(o.fornecedor).toLowerCase(),ini=text(o.dataInicio),fim=text(o.dataFim),did=text(o.documentoId);rows=rows.filter(r=>(!busca||`${r.produto} ${r.codigo} ${r.fornecedor} ${r.beneficiario||''}`.toLowerCase().includes(busca))&&(!forn||String(r.fornecedor||'').toLowerCase().includes(forn))&&(!ini||String(type==='DOACAO'?r.dataDoacao:r.criadoEm).slice(0,10)>=ini)&&(!fim||String(type==='DOACAO'?r.dataDoacao:r.criadoEm).slice(0,10)<=fim)&&(!did||String(r.documentoId)===did));return rows;}
    const mapRec=r=>({id:String(r.id),codigo:r.codigo||'',produto:r.produto||'',fornecedor:r.fornecedor||'',codigoFornecedor:r.codigoFornecedor||'',categoria:r.categoria||'',quantidade:num(r.quantidade),quantidadeRecuperada:num(r.quantidadeRecuperada||r.quantidade),valorUnitario:num(r.valorUnitario),valorRecuperado:num(r.quantidadeRecuperada||r.quantidade)*num(r.valorUnitario),observacao:r.observacao||'',usuarioLancamento:r.usuarioLancamento||'',criadoEm:r.criadoEm,documentoId:String(r.documentoId||'')});
    const mapDoa=r=>({id:String(r.id),codigo:r.codigo||'',produto:r.produto||'',fornecedor:r.fornecedor||'',codigoFornecedor:r.codigoFornecedor||'',categoria:r.categoria||'',quantidade:num(r.quantidade),valorUnitario:num(r.valorUnitario),valorTotal:num(r.quantidade)*num(r.valorUnitario),beneficiario:r.beneficiario||'',dataDoacao:r.dataDoacao,observacao:r.observacao||'',usuarioLancamento:r.usuarioLancamento||'',criadoEm:r.criadoEm,documentoId:String(r.documentoId||''),avariaId:String(r.avariaId||r.origemAvariaId||'')});
    if(path.endsWith('/api/recuperacoes/documento/abrir')&&method==='POST'){const data=text(body.data)||new Date().toISOString().slice(0,10);return jsonResponse({ok:true,documento:docSummary('RECUPERACAO',ensureDoc('RECUPERACAO',data))});}
    if(path.endsWith('/api/doacoes/documento/abrir')&&method==='POST'){const data=text(body.data)||new Date().toISOString().slice(0,10);return jsonResponse({ok:true,documento:docSummary('DOACAO',ensureDoc('DOACAO',data))});}
    if(path.endsWith('/api/recuperacoes')&&method==='GET'){const rows=filtroOpRows('RECUPERACAO',Object.fromEntries(q.entries())).map(mapRec);return jsonResponse(rows);}
    if(path.endsWith('/api/doacoes')&&method==='GET'){const rows=filtroOpRows('DOACAO',Object.fromEntries(q.entries())).map(mapDoa);return jsonResponse(rows);}
    if(path.endsWith('/api/recuperacoes')&&method==='POST'){const codigo=text(body.codigo),p=await findProduct(codigo);if(!p)return jsonResponse({erro:`Produto não encontrado para o código ${codigo}.`},404);const qty=num(body.quantidade);if(!Number.isFinite(qty)||qty<=0||qty>100000)return jsonResponse({erro:'Quantidade inválida. O limite por lançamento é 100.000.'},400);if(num(p.valorCusto)<=0)return jsonResponse({erro:'Produto sem custo válido.'},422);const d=ensureDoc('RECUPERACAO',new Date().toISOString().slice(0,10));const row={id:body.id||id(),codigo:p.codigo,produto:p.produto,fornecedor:p.fornecedor,codigoFornecedor:p.codigoFornecedor,categoria:p.categoria,quantidade:qty,quantidadeRecuperada:qty,valorUnitario:num(p.valorCusto),observacao:text(body.observacao),usuarioLancamento:user?.usuario||'admin',criadoEm:now(),documentoId:String(d.id)};const rows=opRows('RECUPERACAO');rows.unshift(row);saveOpRows('RECUPERACAO',rows);saveAudit('CRIAR','RECUPERACAO',row.id,`Recuperação registrada no documento ${docLabel('RECUPERACAO',d.numero)}.`);return jsonResponse({...mapRec(row),documento:docLabel('RECUPERACAO',d.numero),documentoId:String(d.id),documentoStatus:d.status,documentoGerado:true},201);}
    if(path.endsWith('/api/avarias/encaminhar-doacao')&&method==='POST'){
      const itens=Array.isArray(body.itens)?body.itens:[], beneficiario=text(body.beneficiario), observacao=text(body.observacao);
      if(!itens.length)return jsonResponse({erro:'Nenhum registro foi selecionado.'},400);
      if(!beneficiario)return jsonResponse({erro:'Informe o beneficiário ou instituição.'},400);
      const base=avarias(), validos=[], vistos=new Set();
      for(const item of itens){
        const aid=String(item?.avariaId||''); if(!aid||vistos.has(aid))continue; vistos.add(aid);
        const a=base.find(x=>String(x.id)===aid); if(!a)return jsonResponse({erro:'Um dos registros selecionados não foi encontrado.'},404);
        const disponivel=Math.max(0,num(a.quantidade)-num(a.quantidadeDoada)); const qty=num(item.quantidade);
        if(qty<=0)continue; if(qty>100000)return jsonResponse({erro:'A quantidade informada excede o limite de 100.000 por lançamento.'},400); if(qty>disponivel+1e-9)return jsonResponse({erro:`A quantidade para doação de ${a.produto||'um produto'} excede o disponível (${disponivel}).`},422);
        validos.push({a,qty,disponivel});
      }
      if(!validos.length)return jsonResponse({erro:'Informe pelo menos uma quantidade para doação.'},400);
      const data=new Date().toISOString().slice(0,10), d=ensureDoc('DOACAO',data), rows=opRows('DOACAO'), criados=[];
      for(const item of validos){
        const a=item.a;
        const row={id:id(),codigo:a.codigo,produto:a.produto,fornecedor:a.fornecedor,codigoFornecedor:a.codigoFornecedor,categoria:a.categoria,quantidade:item.qty,valorUnitario:num(a.valorUnitario),beneficiario,dataDoacao:now(),observacao,usuarioLancamento:user?.usuario||'admin',criadoEm:now(),documentoId:String(d.id),avariaId:String(a.id),origemAvariaId:String(a.id),origemQuantidade:item.qty};
        rows.unshift(row); criados.push(row);
        a.quantidadeDoada=num(a.quantidadeDoada)+item.qty;
        a.destinacoesDoacao=Array.isArray(a.destinacoesDoacao)?a.destinacoesDoacao:[];
        a.destinacoesDoacao.push({doacaoId:String(row.id),documentoId:String(d.id),documento:docLabel('DOACAO',d.numero),quantidade:item.qty,criadoEm:row.criadoEm});
        saveAudit('DESTINADO_DOACAO','avaria',a.id,`Avaria ${a.produto} encaminhada para doação: ${item.qty}.`,null,{quantidadeDoada:item.qty,documento:docLabel('DOACAO',d.numero)});
      }
      d.beneficiario=beneficiario; saveOpDocs('DOACAO',opDocs('DOACAO').map(x=>String(x.id)===String(d.id)?d:x)); saveOpRows('DOACAO',rows); write(KEYS.avarias,base); syncHistory(validos[0].a);
      for(const item of validos.slice(1))syncHistory(item.a);
      return jsonResponse({ok:true,documento:docLabel('DOACAO',d.numero),documentoId:String(d.id),quantidadeItens:criados.length,quantidadeTotal:criados.reduce((s,x)=>s+num(x.quantidade),0),registros:criados.map(mapDoa)},201);
    }
    if(path.endsWith('/api/doacoes')&&method==='POST'){const codigo=text(body.codigo),p=await findProduct(codigo);if(!p)return jsonResponse({erro:`Produto não encontrado para o código ${codigo}.`},404);const qty=num(body.quantidade);if(qty<=0)return jsonResponse({erro:'Quantidade inválida.'},400);const dataDoacao=text(body.dataDoacao)||new Date().toISOString().slice(0,10);const requestedDocId=text(body.documentoId);const d=requestedDocId?getDoc('DOACAO',requestedDocId):ensureDoc('DOACAO',String(dataDoacao).slice(0,10));if(!d)return jsonResponse({erro:'Documento de doação não encontrado.'},404);if(d.status==='FINALIZADO')return jsonResponse({erro:`O documento ${docLabel('DOACAO',d.numero)} está finalizado e não pode receber novos produtos.`},409);const row={id:body.id||id(),codigo:p.codigo,produto:p.produto,fornecedor:p.fornecedor,codigoFornecedor:p.codigoFornecedor,categoria:p.categoria,quantidade:qty,valorUnitario:num(p.valorCusto),beneficiario:text(body.beneficiario)||d.beneficiario||'',dataDoacao:body.dataDoacao||d.dataDocumento||new Date().toISOString(),observacao:text(body.observacao),usuarioLancamento:user?.usuario||'admin',criadoEm:now(),documentoId:String(d.id)};const rows=opRows('DOACAO');rows.unshift(row);saveOpRows('DOACAO',rows);if(body.beneficiario||!d.beneficiario){d.beneficiario=text(body.beneficiario)||d.beneficiario||'';const docs=opDocs('DOACAO');const i=docs.findIndex(x=>String(x.id)===String(d.id));if(i>=0)docs[i]=d;saveOpDocs('DOACAO',docs);}saveAudit('CRIAR','DOACAO',row.id,`Doação registrada no documento ${docLabel('DOACAO',d.numero)}.`);return jsonResponse({...mapDoa(row),documento:docLabel('DOACAO',d.numero),documentoId:String(d.id),documentoStatus:d.status,documentoGerado:true},201);}
    let mOp=path.match(/\/api\/(recuperacoes|doacoes)\/([^/]+)$/);if(mOp && method==='PUT'){const type=mOp[1]==='recuperacoes'?'RECUPERACAO':'DOACAO',rid=decodeURIComponent(mOp[2]),rows=opRows(type),i=rows.findIndex(x=>String(x.id)===rid);if(i<0)return jsonResponse({erro:'Registro não encontrado.'},404);const d=getDoc(type,rows[i].documentoId);if(d?.status==='FINALIZADO')return jsonResponse({erro:`O documento ${docLabel(type,d.numero)} está finalizado e não pode ser alterado.`},409);if(!Number.isFinite(num(body.quantidade))||num(body.quantidade)<=0||num(body.quantidade)>100000)return jsonResponse({erro:'Quantidade inválida. O limite por lançamento é 100.000.'},400); if(type==='DOACAO'&&rows[i].avariaId){const av=avarias(),ai=av.findIndex(x=>String(x.id)===String(rows[i].avariaId));if(ai>=0){const antiga=num(rows[i].quantidade),nova=num(body.quantidade)||antiga,disponivel=Math.max(0,num(av[ai].quantidade)-num(av[ai].quantidadeDoada)+antiga);if(nova>disponivel+1e-9)return jsonResponse({erro:`A quantidade excede o disponível (${disponivel}).`},422);av[ai].quantidadeDoada=Math.max(0,num(av[ai].quantidadeDoada)-antiga+nova);rows[i].quantidade=nova;rows[i].observacao=text(body.observacao);if(body.beneficiario!==undefined)rows[i].beneficiario=text(body.beneficiario);write(KEYS.avarias,av);syncHistory(av[ai]);}}else{rows[i].quantidade=num(body.quantidade)||rows[i].quantidade;rows[i].observacao=text(body.observacao);if(type==='DOACAO'&&body.beneficiario!==undefined)rows[i].beneficiario=text(body.beneficiario);}saveOpRows(type,rows);return jsonResponse(type==='RECUPERACAO'?mapRec(rows[i]):mapDoa(rows[i]));}
    if(mOp && method==='DELETE'){const type=mOp[1]==='recuperacoes'?'RECUPERACAO':'DOACAO',rid=decodeURIComponent(mOp[2]),rows=opRows(type),i=rows.findIndex(x=>String(x.id)===rid);if(i<0)return jsonResponse({erro:'Registro não encontrado.'},404);const d=getDoc(type,rows[i].documentoId);if(d?.status==='FINALIZADO')return jsonResponse({erro:`O documento ${docLabel(type,d.numero)} está finalizado e não pode ser alterado.`},409);const [removido]=rows.splice(i,1);if(type==='DOACAO'&&removido.avariaId){const av=avarias(),ai=av.findIndex(x=>String(x.id)===String(removido.avariaId));if(ai>=0){av[ai].quantidadeDoada=Math.max(0,num(av[ai].quantidadeDoada)-num(removido.quantidade));if(Array.isArray(av[ai].destinacoesDoacao))av[ai].destinacoesDoacao=av[ai].destinacoesDoacao.filter(x=>String(x.doacaoId)!==String(removido.id));write(KEYS.avarias,av);syncHistory(av[ai]);}}saveOpRows(type,rows);return jsonResponse({ok:true,documento:d?docSummary(type,d):null});}
    if(path.endsWith('/api/recuperacoes/documentos')&&method==='GET'){const o=Object.fromEntries(q.entries()),docs=opDocs('RECUPERACAO').map(d=>docSummary('RECUPERACAO',d)).filter(d=>{const s=String(o.busca||'').toLowerCase();return (!s||JSON.stringify(d).toLowerCase().includes(s))&&(!o.dataInicio||d.dataDocumento>=o.dataInicio)&&(!o.dataFim||d.dataDocumento<=o.dataFim)&&(!o.fornecedor||opRows('RECUPERACAO').filter(r=>String(r.documentoId)===String(d.id)).some(r=>String(r.fornecedor||'').toLowerCase().includes(String(o.fornecedor).toLowerCase())))});const page=Math.max(1,Number(o.page)||1),limit=[10,25,50,100].includes(Number(o.limit))?Number(o.limit):25,total=docs.length;return jsonResponse({documentos:docs.slice((page-1)*limit,page*limit),resumo:{documentos:total,registros:docs.reduce((s,d)=>s+d.registros,0),quantidadeRecuperada:docs.reduce((s,d)=>s+num(d.quantidadeRecuperada),0),valorRecuperado:docs.reduce((s,d)=>s+num(d.valorRecuperado),0)},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))});}
    if(path.endsWith('/api/doacoes/documentos')&&method==='GET'){const o=Object.fromEntries(q.entries()),docs=opDocs('DOACAO').map(d=>docSummary('DOACAO',d)).filter(d=>{const s=String(o.busca||'').toLowerCase();return (!s||JSON.stringify(d).toLowerCase().includes(s))&&(!o.dataInicio||d.dataDocumento>=o.dataInicio)&&(!o.dataFim||d.dataDocumento<=o.dataFim)});const page=Math.max(1,Number(o.page)||1),limit=[10,25,50,100].includes(Number(o.limit))?Number(o.limit):25,total=docs.length;return jsonResponse({documentos:docs.slice((page-1)*limit,page*limit),resumo:{documentos:total,registros:docs.reduce((s,d)=>s+d.registros,0),quantidadeDoada:docs.reduce((s,d)=>s+num(d.quantidadeDoada),0),valorDoado:docs.reduce((s,d)=>s+num(d.valorDoado),0),beneficiarios:new Set(opRows('DOACAO').map(r=>r.beneficiario).filter(Boolean)).size},page,limit,total,totalPaginas:Math.max(1,Math.ceil(total/limit))});}
    let mDoc=path.match(/\/api\/(recuperacoes|doacoes)\/documento\/info$/);if(mDoc&&method==='GET'){const type=mDoc[1]==='recuperacoes'?'RECUPERACAO':'DOACAO',d=getDoc(type,q.get('id'));if(!d)return jsonResponse({erro:'Documento não encontrado.'},404);return jsonResponse({ok:true,documento:docSummary(type,d)});}
    let mFin=path.match(/\/api\/(recuperacoes|doacoes)\/documento\/finalizar$/);if(mFin&&method==='POST'){const type=mFin[1]==='recuperacoes'?'RECUPERACAO':'DOACAO',did=text(body.documentoId),d=getDoc(type,did);if(!d)return jsonResponse({erro:'Nenhum documento encontrado.'},404);const rows=opRows(type).filter(r=>String(r.documentoId)===String(d.id));if(!rows.length)return jsonResponse({erro:'Não é possível finalizar um documento sem produtos lançados.'},400);d.status='FINALIZADO';d.finalizadoEm=now();d.finalizadoPor=user?.usuario||'admin';const docs=opDocs(type);const i=docs.findIndex(x=>String(x.id)===String(d.id));if(i>=0)docs[i]=d;saveOpDocs(type,docs);return jsonResponse({ok:true,documento:docSummary(type,d)});}
    let mBen=path.match(/\/api\/doacoes\/documento\/([^/]+)$/);if(mBen&&method==='PATCH'){const d=getDoc('DOACAO',decodeURIComponent(mBen[1]));if(!d)return jsonResponse({erro:'Documento de doação não encontrado.'},404);if(d.status==='FINALIZADO')return jsonResponse({erro:'Documento finalizado.'},409);d.beneficiario=text(body.beneficiario);const docs=opDocs('DOACAO');const i=docs.findIndex(x=>String(x.id)===String(d.id));if(i>=0)docs[i]=d;saveOpDocs('DOACAO',docs);const rows=opRows('DOACAO');rows.forEach(r=>{if(String(r.documentoId)===String(d.id))r.beneficiario=d.beneficiario;});saveOpRows('DOACAO',rows);return jsonResponse({ok:true,documento:docSummary('DOACAO',d)});}
    // Dashboard boxes summary
    if(path.endsWith('/api/dashboard/caixas-resumo')&&method==='GET'){
      const f=text(q.get('fornecedor')), cat=text(q.get('categoria')), cx=text(q.get('caixa')), prod=text(q.get('produto')).toLowerCase(); const cs=read(KEYS.caixas,[]),ps=await ensureProducts(),cps=read(KEYS.caixaProdutos,[]); const items=cps.filter(x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));const forn=p?.fornecedor||c?.responsavel||'Não informado';return (!f||f==='Todos'||forn===f)&&(!cat||cat==='Todos'||(x.categoria||p?.categoria||'Mercearia')===cat)&&(!cx||cx==='Todos'||String(x.caixaId)===cx)&&(!prod||`${x.produto} ${x.codigo}`.toLowerCase().includes(prod));});
      const base=items.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0), groups=(arr,key)=>{const m=new Map();arr.forEach(x=>{const k=key(x)||'Não informado';const v=m.get(k)||{fornecedor:k,categoria:k,produtos:0,quantidade:0,valor:0};v.produtos++;v.quantidade+=num(x.quantidade);v.valor+=num(x.quantidade)*num(x.valorUnitario);m.set(k,v)});return [...m.values()].sort((a,b)=>b.valor-a.valor)}; const fornecedores=groups(items,x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));return p?.fornecedor||c?.responsavel||'Não informado'}); const categorias=groups(items,x=>x.categoria||ps.find(p=>String(p.codigo)===String(x.codigo))?.categoria||'Mercearia'); const produtosMap=new Map();items.forEach(x=>{const k=String(x.codigo);const p=produtosMap.get(k)||{produto:x.produto,codigo:x.codigo,categoria:x.categoria,fornecedor:ps.find(p=>String(p.codigo)===k)?.fornecedor||'',caixas:0,quantidade:0,valor:0};p.caixas++;p.quantidade+=num(x.quantidade);p.valor+=num(x.quantidade)*num(x.valorUnitario);produtosMap.set(k,p)});const produtos=[...produtosMap.values()].sort((a,b)=>b.valor-a.valor);const caixas=cs.map(c=>{const its=items.filter(x=>String(x.caixaId)===String(c.id));return{caixa:c.numero,fornecedor:c.responsavel||'',local:c.local||'',produtos:its.length,quantidade:its.reduce((s,x)=>s+num(x.quantidade),0),valor:its.reduce((s,x)=>s+num(x.quantidade)*num(x.valorUnitario),0)}}).filter(x=>x.produtos).sort((a,b)=>b.valor-a.valor);const fornecedoresNomes=[...new Set(cps.map(x=>{const c=cs.find(c=>String(c.id)===String(x.caixaId));const p=ps.find(p=>String(p.codigo)===String(x.codigo));return p?.fornecedor||c?.responsavel||'Não informado'}))].sort((a,b)=>a.localeCompare(b,'pt-BR')); const categoriasNomes=[...new Set(cps.map(x=>x.categoria||ps.find(p=>String(p.codigo)===String(x.codigo))?.categoria||'Mercearia'))].sort((a,b)=>a.localeCompare(b,'pt-BR')); const caixasNomes=cs.filter(c=>cps.some(x=>String(x.caixaId)===String(c.id))).map(c=>({id:c.id,numero:c.numero,local:c.local||'-',fornecedor:c.responsavel||'Não informado'})); return jsonResponse({filtros:{fornecedores:fornecedoresNomes,categorias:categoriasNomes,caixas:caixasNomes},total:{caixasComProdutos:new Set(items.map(x=>x.caixaId)).size,quantidade:items.reduce((s,x)=>s+num(x.quantidade),0),valor:base,produtosDistintos:new Set(items.map(x=>x.codigo)).size},fornecedores:fornecedores.map(x=>({...x,participacao:base?x.valor/base*100:0})),categorias,produtos,caixas});
    }
    // Analista local: usa exatamente o contexto calculado pelo Dashboard e seus filtros atuais.
    // Não consulta servidor externo e não ignora registros Pendentes.
    if(path.endsWith('/api/dashboard/ia')&&method==='POST'){
      const scope=text(body.escopo)||'avarias';
      const tipoRaw=text(body.tipoAnalise)||'livre';
      const tipos=['livre','resumo','concentracao','atencao','tendencia','recomendacoes','completa'];
      const tipo=tipos.includes(tipoRaw)?tipoRaw:'livre';
      const pergunta=text(body.pergunta);
      const ctx=body.contexto&&typeof body.contexto==='object'?body.contexto:{};
      const total=ctx.total&&typeof ctx.total==='object'?ctx.total:{};
      const conc=ctx.concentracao&&typeof ctx.concentracao==='object'?ctx.concentracao:{};
      const tend=ctx.tendencia&&typeof ctx.tendencia==='object'?ctx.tendencia:{};
      const fornecedores=Array.isArray(ctx.fornecedores)?ctx.fornecedores:[];
      const categorias=Array.isArray(ctx.categorias)?ctx.categorias:[];
      const produtos=Array.isArray(ctx.produtos)?ctx.produtos:[];
      const setores=Array.isArray(ctx.setores)?ctx.setores:[];
      const motivos=Array.isArray(ctx.motivos)?ctx.motivos:[];
      const caixas=Array.isArray(ctx.caixas)?ctx.caixas:[];
      const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const number=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
      const pct=v=>`${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
      const topF=fornecedores[0];
      const topC=categorias[0];
      const topP=produtos[0];
      const topS=setores[0];
      const topM=motivos[0];
      const topCx=caixas[0];
      const valor=number(total.valor);
      const quantidade=number(total.quantidade);
      const registros=number(total.registros);
      const escopoLabel=scope==='caixas'?'estoque armazenado nas caixas':'perdas e avarias';
      let tipoEfetivo=tipo;
      const q=pergunta.toLowerCase();
      if(tipo==='livre'){
        if(/tend|evolu|aument|diminui|melhor|pior|compar/.test(q)) tipoEfetivo='tendencia';
        else if(/concentr|fornecedor|categoria|produto|onde/.test(q)) tipoEfetivo='concentracao';
        else if(/recomend|prioridade|devo|fazer|ação|acao/.test(q)) tipoEfetivo='recomendacoes';
        else tipoEfetivo='resumo';
      }
      let resposta='';
      if(scope==='caixas'){
        if(tipoEfetivo==='concentracao'){
          resposta=`### Concentração do estoque\n\n- **Fornecedor nº 1:** ${pct(conc.fornecedorTop1Pct)} do valor armazenado${topF?` (${topF.fornecedor||'não informado'})`:''}.\n- **Top 3 fornecedores:** ${pct(conc.fornecedorTop3Pct)} do valor.\n- **Categoria nº 1:** ${pct(conc.categoriaTop1Pct)} do valor${topC?` (${topC.categoria||'não informada'})`:''}.\n- **Top 5 produtos:** ${pct(conc.produtoTop5Pct)} do valor.\n- **Caixa nº 1:** ${pct(conc.caixaTop1Pct)} do valor${topCx?` (${topCx.caixa||'não informada'})`:''}.`;
        } else if(tipoEfetivo==='tendencia'){
          resposta=`### Tendência\n\nA comparação temporal do estoque **não está disponível no recorte atual**. O Dashboard apresenta uma fotografia do estoque armazenado nas caixas.`;
        } else if(tipoEfetivo==='atencao'){
          const pontos=[];
          if(topF) pontos.push(`**Fornecedor líder:** ${topF.fornecedor||'não informado'} concentra ${pct(conc.fornecedorTop1Pct)} do valor.`);
          if(topC) pontos.push(`**Categoria líder:** ${topC.categoria||'não informada'} concentra ${pct(conc.categoriaTop1Pct)} do valor.`);
          if(topP) pontos.push(`**Produto de maior impacto:** ${topP.produto||'não informado'} com ${money(topP.valor)}.`);
          resposta=`### Pontos de atenção\n\n${pontos.length?pontos.map(x=>`- ${x}`).join('\n'):'- Não há dados suficientes no recorte atual.'}`;
        } else if(tipoEfetivo==='recomendacoes'){
          const rec=[];
          if(topF) rec.push(`Priorizar a investigação de **${topF.fornecedor||'fornecedor líder'}**, que representa ${pct(conc.fornecedorTop1Pct)} do valor armazenado.`);
          if(topP) rec.push(`Revisar primeiro **${topP.produto||'o produto líder'}**, responsável por ${money(topP.valor)} no recorte.`);
          if(topCx) rec.push(`Avaliar a **caixa ${topCx.caixa||'líder'}**, que concentra ${pct(conc.caixaTop1Pct)} do valor.`);
          resposta=`### Prioridades\n\n${rec.length?rec.map((x,i)=>`${i+1}. ${x}`).join('\n'):'1. Não há dados suficientes para recomendar uma prioridade no recorte atual.'}`;
        } else {
          resposta=`### ${tipoEfetivo==='completa'?'Diagnóstico completo':'Resumo do estoque'}\n\n- **Valor armazenado:** ${money(total.valor)}.\n- **Quantidade:** ${quantidade} unidades/kg.\n- **Produtos distintos:** ${number(total.produtosDistintos)}.\n- **Caixas com produtos:** ${number(total.caixasComProdutos)}.\n- **Principal concentração:** ${topF?.fornecedor||topC?.categoria||topP?.produto||'não identificada'}.`;
          if(tipoEfetivo==='completa') resposta+=`\n\n**Concentração:** top 3 fornecedores representam ${pct(conc.fornecedorTop3Pct)} do valor.\n\n**Tendência:** não disponível para esta fotografia de estoque.\n\n**Prioridade:** investigar os pontos de maior participação antes de ampliar a análise.`;
        }
      } else {
        if(tipoEfetivo==='concentracao'){
          resposta=`### Concentração das perdas\n\n- **Fornecedor nº 1:** ${pct(conc.fornecedorTop1Pct)} do valor${topF?` (${topF.fornecedor||'não informado'})`:''}.\n- **Top 3 fornecedores:** ${pct(conc.fornecedorTop3Pct)} do valor.\n- **Categoria nº 1:** ${pct(conc.categoriaTop1Pct)} do valor${topC?` (${topC.categoria||'não informada'})`:''}.\n- **Top 5 produtos:** ${pct(conc.produtoTop5Pct)} do valor.\n- **Produto de maior impacto:** ${topP?.produto||'não identificado'}${topP?` (${money(topP.valor)})`:''}.`;
        } else if(tipoEfetivo==='tendencia'){
          if(tend.disponivel){
            resposta=`### Tendência do período\n\n- **Valor:** ${pct(tend.variacao?.valor)}.\n- **Quantidade:** ${pct(tend.variacao?.quantidade)}.\n- **Registros:** ${pct(tend.variacao?.registros)}.\n- **Valor médio por registro:** ${pct(tend.variacao?.valorMedioRegistro)}.\n\n**Período atual:** ${tend.periodos?.atual||'não informado'}.\n**Período anterior:** ${tend.periodos?.anterior||'não informado'}.`;
          } else {
            resposta=`### Tendência\n\nNão há comparação temporal disponível no recorte atual.`;
          }
        } else if(tipoEfetivo==='atencao'){
          const pontos=[];
          if(topF) pontos.push(`**Fornecedor líder:** ${topF.fornecedor||'não informado'} concentra ${pct(conc.fornecedorTop1Pct)} do valor.`);
          if(topC) pontos.push(`**Categoria líder:** ${topC.categoria||'não informada'} concentra ${pct(conc.categoriaTop1Pct)} do valor.`);
          if(topP) pontos.push(`**Produto de maior impacto:** ${topP.produto||'não informado'} com ${money(topP.valor)}.`);
          if(topM) pontos.push(`**Motivo mais relevante:** ${topM.motivo||'não informado'} com ${number(topM.registros)} registros.`);
          resposta=`### Pontos de atenção\n\n${pontos.length?pontos.map(x=>`- ${x}`).join('\n'):'- Não há dados suficientes no recorte atual.'}`;
        } else if(tipoEfetivo==='recomendacoes'){
          const rec=[];
          if(topF) rec.push(`Investigar primeiro **${topF.fornecedor||'fornecedor líder'}**, responsável por ${pct(conc.fornecedorTop1Pct)} do valor perdido.`);
          if(topP) rec.push(`Revisar **${topP.produto||'o produto líder'}**, que concentra ${money(topP.valor)} no recorte.`);
          if(topC) rec.push(`Avaliar a categoria **${topC.categoria||'líder'}**, que representa ${pct(conc.categoriaTop1Pct)} do valor.`);
          if(tend.disponivel&&tend.variacao?.valor!=null) rec.push(`Comparar a evolução do período, que apresenta variação de ${pct(tend.variacao.valor)} no valor.`);
          resposta=`### Prioridades e recomendações\n\n${rec.length?rec.map((x,i)=>`${i+1}. ${x}`).join('\n'):'1. Não há dados suficientes para recomendar uma prioridade no recorte atual.'}`;
        } else {
          resposta=`### ${tipoEfetivo==='completa'?'Diagnóstico completo':'Resumo gerencial'}\n\n- **Registros:** ${registros}.\n- **Quantidade:** ${quantidade} unidades/kg.\n- **Valor perdido:** ${money(total.valor)}.\n- **Fornecedores:** ${number(total.fornecedores)}.\n- **Produtos distintos:** ${number(total.produtosDistintos)}.\n- **Maior concentração:** ${topF?.fornecedor||topC?.categoria||topP?.produto||'não identificada'}.`;
          if(tipoEfetivo==='completa') resposta+=`\n\n**Concentração:** top 3 fornecedores representam ${pct(conc.fornecedorTop3Pct)} do valor.\n\n**Tendência:** ${tend.disponivel&&tend.variacao?.valor!=null?`${pct(tend.variacao.valor)} no valor`: 'não disponível no recorte atual'}.\n\n**Prioridade:** investigar os itens de maior participação e validar a causa operacional antes de ampliar a investigação.`;
        }
      }
      resposta+=`\n\n_A análise considera exatamente os dados e filtros atuais do Dashboard e é processada localmente neste navegador._`;
      return jsonResponse({modo:'local',resposta});
    }
    // Excel real (XLSX) sem biblioteca externa: ZIP sem compressão com XML mínimo válido.
    const utf8 = v => new TextEncoder().encode(String(v??''));
    const crc32 = bytes => { let table=crc32.table; if(!table){table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}crc32.table=table;} let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0; };
    const concatBytes = parts => { const total=parts.reduce((n,p)=>n+p.length,0), out=new Uint8Array(total); let o=0; for(const p of parts){out.set(p,o);o+=p.length;} return out; };
    const zipU16 = (dv,o,n) => dv.setUint16(o,n,true);
    const zipU32 = (dv,o,n) => dv.setUint32(o,n>>>0,true);
    function zipStore(entries){
      const locals=[],centrals=[]; let offset=0;
      for(const e of entries){
        const name=utf8(e.name),data=utf8(e.data),crc=crc32(data);
        const lh=new Uint8Array(30+name.length+data.length),ld=new DataView(lh.buffer);
        zipU32(ld,0,0x04034b50);zipU16(ld,4,20);zipU16(ld,6,0);zipU16(ld,8,0);zipU16(ld,10,0);zipU16(ld,12,0);zipU32(ld,14,crc);zipU32(ld,18,data.length);zipU32(ld,22,data.length);zipU16(ld,26,name.length);zipU16(ld,28,0);lh.set(name,30);lh.set(data,30+name.length);locals.push(lh);
        const ch=new Uint8Array(46+name.length),cd=new DataView(ch.buffer);
        zipU32(cd,0,0x02014b50);zipU16(cd,4,20);zipU16(cd,6,20);zipU16(cd,8,0);zipU16(cd,10,0);zipU16(cd,12,0);zipU16(cd,14,0);zipU32(cd,16,crc);zipU32(cd,20,data.length);zipU32(cd,24,data.length);zipU16(cd,28,name.length);zipU16(cd,30,0);zipU16(cd,32,0);zipU16(cd,34,0);zipU16(cd,36,0);zipU32(cd,38,0);zipU32(cd,42,offset);ch.set(name,46);centrals.push(ch);offset+=lh.length;
      }
      const localBytes=concatBytes(locals),centralBytes=concatBytes(centrals),eocd=new Uint8Array(22),ed=new DataView(eocd.buffer);
      zipU32(ed,0,0x06054b50);zipU16(ed,4,0);zipU16(ed,6,0);zipU16(ed,8,entries.length);zipU16(ed,10,entries.length);zipU32(ed,12,centralBytes.length);zipU32(ed,16,localBytes.length);zipU16(ed,20,0);
      return concatBytes([localBytes,centralBytes,eocd]);
    }
    const xmlEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    function xlsxBlob(headers,rows){
      const cells=(row,r)=>headers.map((h,c)=>{const v=row[h]??'';const ref=String.fromCharCode(65+c)+(r+1);const n=Number(v);return Number.isFinite(n)&&String(v).trim()!==''?`<c r="${ref}"><v>${n}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;}).join('');
      const all=[headers.reduce((o,h)=>{o[h]=h;return o;},{}),...rows];
      const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${all.map((r,i)=>`<row r="${i+1}">${cells(r,i)}</row>`).join('')}</sheetData></worksheet>`;
      const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>`;
      const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
      const rootrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
      const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
      const data=zipStore([{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rootrels},{name:'xl/workbook.xml',data:wb},{name:'xl/_rels/workbook.xml.rels',data:rels},{name:'xl/worksheets/sheet1.xml',data:sheet}]);return new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    }
    // Export endpoints: local files, including the V25 document-style PDF for Registros.
    if(path.endsWith('/api/avarias/exportar') && method==='POST'){
      const rows=Array.isArray(body.registros)?body.registros:[];
      if(!rows.length) return jsonResponse({erro:'Nenhum registro para exportar.'},400);
      const headers=['Data','Código','Produto','Fornecedor','Categoria','Cód. fornecedor','Quantidade','Valor unitário','Valor total','Setor','Motivo','Usuário','Caixa','Status','Observação'];
      const data=rows.map(r=>({
        'Data':r.data||'',
        'Código':r.codigo||'',
        'Produto':r.produto||'',
        'Fornecedor':r.fornecedor||'',
        'Categoria':r.categoria||'',
        'Cód. fornecedor':r.codigoFornecedor||'',
        'Quantidade':r.quantidade,
        'Valor unitário':r.valorUnitario,
        'Valor total':r.valorTotal,
        'Setor':r.setor||'',
        'Motivo':r.tipo||'',
        'Usuário':r.usuario||'',
        'Caixa':r.caixa||'',
        'Status':r.status||'',
        'Observação':r.observacao||''
      }));
      return blobResponse(xlsxBlob(headers,data));
    }
    if((path.endsWith('/api/avarias/exportar-pdf')||path.endsWith('/api/avarias/exportar-pdf-registros'))&&method==='POST'){
      const rows=Array.isArray(body.registros)?body.registros:[];
      if(!rows.length)return jsonResponse({erro:'Nenhum registro para exportar.'},400);
      const mapa=new Map();
      for(const item of rows){const chave=String(item.codigo||item.produto||'').trim().toLowerCase();if(!chave)continue;if(!mapa.has(chave))mapa.set(chave,{...item,quantidade:num(item.quantidade),valorTotal:num(item.valorTotal)});else{const a=mapa.get(chave);a.quantidade+=num(item.quantidade);a.valorTotal+=num(item.valorTotal);}}
      const registros=[...mapa.values()];
      const strip=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ');
      const pdfEscape=v=>strip(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
      const trunc=(v,n)=>{const t=strip(v);return t.length<=n?t:t.slice(0,Math.max(0,n-1))+'...';};
      const qtd=v=>num(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
      const brl=v=>num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const dateOnly=v=>{if(!v)return'-';const s=String(v);const d=new Date(s.length>=10?s.slice(0,10)+'T12:00:00':s);return Number.isNaN(d.getTime())?s.slice(0,10):d.toLocaleDateString('pt-BR');};
      const timeNow=()=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date());
      const uniqueDates=[...new Set(registros.map(r=>String(r.data||'').slice(0,10)).filter(Boolean))];
      const fornecedores=[...new Set(registros.map(r=>String(r.fornecedor||'').trim()).filter(Boolean))];
      const W=595,H=842,margin=34,tabelaW=W-margin*2;
      const cols=[['Código',78],['Código barra',82],['Descrição',250],['Quantidade',75],['Valor total',tabelaW-78-82-250-75]];
      const seq=Number(sessionStorage.getItem('ca_v25_registro_pdf_seq')||0)+1;sessionStorage.setItem('ca_v25_registro_pdf_seq',String(seq));
      const docNo=`REG-${String(seq).padStart(4,'0')}`;
      const pages=[];let ops=[],y=0;
      const text=(x,yy,size,val,bold=false)=>ops.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm (${pdfEscape(val)}) Tj ET`);
      const line=(x1,y1,x2,y2)=>ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
      const rect=(x,yy,w,h,fill=false)=>{if(fill)ops.push('0.92 g');ops.push(`${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill?'f':'S'}`);if(fill)ops.push('0 g');};
      function header(){ops=[];text(margin,H-38,14,'CONTROLE DE AVARIAS',true);text(margin,H-52,8,'DOCUMENTO DE AVARIAS',true);text(W-170,H-38,8,`Data: ${dateOnly(new Date().toISOString())}`);text(W-170,H-52,8,`Hora: ${timeNow()}`);line(margin,H-62,W-margin,H-62);text(margin,H-80,7,'Loja: 001 - UNIDADE DEMO');text(margin,H-94,7,`Data do movimento: ${uniqueDates.length===1?dateOnly(uniqueDates[0]):'Diversas'}`);text(margin,H-108,7,'Tipo do movimento: AVARIAS');text(margin,H-122,7,`Fornecedor: ${fornecedores.length===1?fornecedores[0]:'Diversos'}`);text(margin,H-136,7,'Tipo do documento: AVARIAS');text(W-145,H-136,7,`Número do documento: ${docNo}`);y=H-158;}
      function tableHeader(){const h=20;rect(margin,y-h,tabelaW,h,true);let x=margin;for(const [label,w] of cols){text(x+3,y-13,6,label,true);x+=w;}y-=h;}
      function newPage(){if(ops.length)pages.push(ops);header();tableHeader();}
      newPage();
      for(const r of registros){const h=18;if(y-h<105)newPage();let x=margin;const vals=[r.codigo||'-',r.codigo||'-',r.produto||'-',qtd(r.quantidade),brl(r.valorTotal)];for(let i=0;i<cols.length;i++){text(x+3,y-12,5.6,trunc(vals[i],i===2?43:(i<2?13:12)));x+=cols[i][1];}line(margin,y-h,margin+tabelaW,y-h);y-=h;if(r.observacao){if(y-14<105)newPage();text(margin+3,y-9,5.2,`Obs.: ${trunc(r.observacao,105)}`);y-=14;}}
      const totalQtd=registros.reduce((s,r)=>s+num(r.quantidade),0),totalVal=registros.reduce((s,r)=>s+num(r.valorTotal),0);if(y<150)newPage();y-=10;rect(margin,y-22,tabelaW,22,true);text(margin+4,y-14,7,'TOTAL',true);text(margin+350,y-14,7,`Quantidade: ${qtd(totalQtd)}`,true);text(margin+450,y-14,7,`Valor: ${brl(totalVal)}`,true);y-=34;
      const obs=registros.map(r=>r.observacao).filter(Boolean).join(' | ');if(obs){text(margin,y,7,`Observações: ${trunc(obs,100)}`);y-=18;}
      pages.push(ops);
      const objs=[],add=o=>(objs.push(o),objs.length),catalog=add('<< /Type /Catalog /Pages 2 0 R >>'),pagesObj=add('PLACEHOLDER'),font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),kids=[];
      for(let i=0;i<pages.length;i++){pages[i].push(`BT /F1 6 Tf 1 0 0 1 ${margin.toFixed(2)} 25 Tm (${pdfEscape(`Documento ${docNo} - Controle de Avarias - Supermercado Manaíra`)}) Tj ET`);pages[i].push(`BT /F1 6 Tf 1 0 0 1 ${(W-85).toFixed(2)} 25 Tm (${pdfEscape(`Página ${i+1} / ${pages.length}`)}) Tj ET`);const stream=pages[i].join('\n')+'\n',content=add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`),pg=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${content} 0 R >>`);kids.push(pg);}
      objs[pagesObj-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;let pdf='%PDF-1.4\n';const offsets=[];for(let i=0;i<objs.length;i++){offsets[i+1]=new TextEncoder().encode(pdf).length;pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=new TextEncoder().encode(pdf).length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return blobResponse(new Blob([pdf],{type:'application/pdf'}));
    }
    // =========================================================
    // COMPATIBILIDADE V25 WEB LOCAL - COBERTURA DAS ROTAS DO server.js
    // =========================================================
    if(path.endsWith('/api/asset-check') && method==='GET'){
      return jsonResponse({ok:true,modo:'web-local',assets:['local-api-216.js','bcrypt-browser.js'],servidor:false});
    }
    if(path.endsWith('/api/notificacoes/lidas') && method==='DELETE'){
      const ns=read(KEYS.notificacoes,[]); const uid=String(user?.id||1); const antes=ns.length;
      const restantes=ns.filter(x=>!(String(x.usuarioId)===uid && x.lida)); write(KEYS.notificacoes,restantes);
      return jsonResponse({ok:true,removidas:antes-restantes.length});
    }
    // Compatibilidade com as duas assinaturas usadas pela V25 para produtos de caixa.
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos\/excluir$/); if(m && method==='POST'){
      const cid=decodeURIComponent(m[1]), ids=Array.isArray(body.ids)?body.ids.map(String):[], cps=read(KEYS.caixaProdutos,[]), before=cps.length;
      write(KEYS.caixaProdutos,cps.filter(x=>!(String(x.caixaId)===cid&&ids.includes(String(x.id)))));
      return jsonResponse({ok:true,removidos:before-read(KEYS.caixaProdutos,[]).length});
    }
    m=path.match(/\/api\/caixas\/([^/]+)\/produtos$/); if(m && method==='DELETE'){
      const cid=decodeURIComponent(m[1]), ids=Array.isArray(body.ids)?body.ids.map(String):[]; const cps=read(KEYS.caixaProdutos,[]); const out=ids.length?cps.filter(x=>!(String(x.caixaId)===cid&&ids.includes(String(x.id)))):cps.filter(x=>String(x.caixaId)!==cid); const removed=cps.length-out.length; write(KEYS.caixaProdutos,out); return jsonResponse({ok:true,removidos:removed});
    }
    // Excluir documentos REC/DOA e seus lançamentos.
    m=path.match(/\/api\/(recuperacoes|doacoes)\/documentos\/([^/]+)$/); if(m && method==='DELETE'){
      if(!isAdmin()) return jsonResponse({erro:'Apenas o administrador pode excluir documentos do histórico.'},403);
      const type=m[1]==='recuperacoes'?'RECUPERACAO':'DOACAO', did=decodeURIComponent(m[2]);
      const docs=opDocs(type), d=docs.find(x=>String(x.id)===did); if(!d)return jsonResponse({erro:'Documento não encontrado.'},404);
      const remainingDocs=docs.filter(x=>String(x.id)!==did); const allRows=opRows(type), removidas=allRows.filter(x=>String(x.documentoId)===did), rows=allRows.filter(x=>String(x.documentoId)!==did);
      if(type==='DOACAO'&&removidas.length){const av=avarias();for(const r of removidas){const ai=av.findIndex(x=>String(x.id)===String(r.avariaId));if(ai>=0){av[ai].quantidadeDoada=Math.max(0,num(av[ai].quantidadeDoada)-num(r.quantidade));if(Array.isArray(av[ai].destinacoesDoacao))av[ai].destinacoesDoacao=av[ai].destinacoesDoacao.filter(x=>String(x.doacaoId)!==String(r.id));}}write(KEYS.avarias,av);for(const a of av)if(removidas.some(r=>String(r.avariaId)===String(a.id)))syncHistory(a);}
      saveOpDocs(type,remainingDocs); saveOpRows(type,rows); saveAudit('EXCLUIR','DOCUMENTO_'+type,did,`Documento ${docLabel(type,d.numero)} excluído.`);
      return jsonResponse({ok:true,documento:docLabel(type,d.numero)});
    }
    if(path.endsWith('/api/recuperacoes/exportar-xlsx')&&method==='POST'){
      const f=body.filtros||{}, rows=filtroOpRows('RECUPERACAO',f).map(mapRec); const headers=['Data','Codigo','Produto','Fornecedor','Categoria','Quantidade','Valor recuperado','Responsável','Observação']; const data=rows.map(r=>({'Data':r.criadoEm||'',Codigo:r.codigo,Produto:r.produto,Fornecedor:r.fornecedor,Categoria:r.categoria,Quantidade:r.quantidade,'Valor recuperado':r.valorRecuperado,'Responsável':r.usuarioLancamento,Observação:r.observacao})); return blobResponse(xlsxBlob(headers,data));
    }
    if(path.endsWith('/api/doacoes/exportar-xlsx')&&method==='POST'){
      const f=body.filtros||{}, rows=filtroOpRows('DOACAO',f).map(mapDoa); const headers=['Data','Codigo','Produto','Fornecedor','Categoria','Quantidade','Valor unitário','Valor total','Beneficiário','Responsável','Observação']; const data=rows.map(r=>({'Data':r.dataDoacao||'',Codigo:r.codigo,Produto:r.produto,Fornecedor:r.fornecedor,Categoria:r.categoria,Quantidade:r.quantidade,'Valor unitário':r.valorUnitario,'Valor total':r.valorTotal,Beneficiário:r.beneficiario,'Responsável':r.usuarioLancamento,Observação:r.observacao})); return blobResponse(xlsxBlob(headers,data));
    }
    // PDF genérico de REC/DOA, mantendo o documento operacional como referência visual.
    function pdfDocOperacao(type,d,rows){
      const W=595,H=842,margin=34,tableW=W-margin*2;
      const strip=function(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ');};
      const esc=function(v){return strip(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');};
      const brl=function(v){return num(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});};
      const qtd=function(v){return num(v).toLocaleString('pt-BR',{maximumFractionDigits:3});};
      const date=function(v){const s=String(v||'').slice(0,10);if(!s)return '-';const dt=new Date(s+'T12:00:00');return Number.isNaN(dt.getTime())?s:dt.toLocaleDateString('pt-BR');};
      const ops=[];
      const T=function(x,y,size,val,bold){ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+esc(val)+') Tj ET');};
      const L=function(x1,y1,x2,y2){ops.push(x1+' '+y1+' m '+x2+' '+y2+' l S');};
      const R=function(x,y,w,h){ops.push('0.92 g');ops.push(x+' '+y+' '+w+' '+h+' re f');ops.push('0 g');};
      T(margin,H-38,14,'CONTROLE DE AVARIAS',true);
      T(margin,H-52,8,type==='RECUPERACAO'?'DOCUMENTO DE RECUPERAÇÃO':'DOCUMENTO DE DOAÇÃO',true);
      T(W-170,H-38,8,'Data: '+date(now()),false);
      T(W-170,H-52,8,'Hora: '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date()),false);
      L(margin,H-62,W-margin,H-62);
      T(margin,H-80,7,'Loja: 001 - UNIDADE DEMO');
      T(margin,H-94,7,'Data do movimento: '+date(d.dataDocumento));
      T(margin,H-108,7,'Tipo do movimento: '+(type==='RECUPERACAO'?'RECUPERAÇÃO DE PRODUTOS':'DOAÇÃO DE PRODUTOS'));
      if(type==='DOACAO') T(margin,H-122,7,'Beneficiário: '+(d.beneficiario||'Diversos'));
      else T(margin,H-122,7,'Fornecedor: Diversos');
      T(margin,H-136,7,'Tipo do documento: '+(type==='RECUPERACAO'?'RECUPERAÇÃO':'DOAÇÃO'));
      T(W-145,H-136,7,'Número do documento: '+docLabel(type,d.numero));
      let y=H-158;
      const cols=type==='RECUPERACAO'?[['Código',78],['Código barra',82],['Descrição',250],['Quantidade',75],['Valor total',tableW-78-82-250-75]]:[['Código',78],['Código barra',82],['Descrição',230],['Quantidade',75],['Valor total',tableW-78-82-230-75]];
      R(margin,y-20,tableW,20); let x=margin;
      for(const col of cols){T(x+3,y-13,6,col[0],true);x+=col[1];} y-=20;
      for(const r of rows){
        if(y<105)break;
        x=margin;
        const valTotal=type==='RECUPERACAO'?num(r.valorRecuperado):num(r.quantidade)*num(r.valorUnitario);
        const vals=[r.codigo||'-',r.codigo||'-',r.produto||'-',qtd(r.quantidade),brl(valTotal)];
        for(let i=0;i<cols.length;i++){let v=strip(vals[i]);const max=i===2?43:13;if(v.length>max)v=v.slice(0,max-1)+'...';T(x+3,y-12,5.6,v,false);x+=cols[i][1];}
        L(margin,y-18,margin+tableW,y-18);y-=18;
      }
      const totalQtd=rows.reduce(function(s,r){return s+num(r.quantidade);},0);
      const totalVal=rows.reduce(function(s,r){return s+(type==='RECUPERACAO'?num(r.valorRecuperado):num(r.quantidade)*num(r.valorUnitario));},0);
      y-=10;R(margin,y-22,tableW,22);T(margin+4,y-14,7,'TOTAL',true);T(margin+350,y-14,7,'Quantidade: '+qtd(totalQtd),true);T(margin+450,y-14,7,'Valor: '+brl(totalVal),true);y-=34;
      T(margin,y,7,'Responsável: '+(d.finalizadoPor||(rows[0]&&rows[0].usuarioLancamento)||'-'));
      T(margin,25,6,'Documento '+docLabel(type,d.numero)+' - Controle de Avarias - Supermercado Manaíra');
      T(W-85,25,6,'Página 1 / 1');
      const stream=ops.join('\n')+'\n';
      const objs=[
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [6 0 R] /Count 1 >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        '<< /Length '+new TextEncoder().encode(stream).length+' >>\nstream\n'+stream+'endstream',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 5 0 R >>'
      ];
      let pdf='%PDF-1.4\n'; const offsets=[];
      for(let i=0;i<objs.length;i++){offsets[i+1]=new TextEncoder().encode(pdf).length;pdf+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
      const xref=new TextEncoder().encode(pdf).length;
      pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
      for(let i=1;i<=objs.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
      pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
      return new Blob([pdf],{type:'application/pdf'});
    }
    const mDocs=path.match(/\/api\/(recuperacoes|doacoes)\/documento$/); if(mDocs&&method==='GET'){
      const type=mDocs[1]==='recuperacoes'?'RECUPERACAO':'DOACAO';
      const d=getDoc(type,q.get('id'))||opDocs(type).find(function(x){return x.dataDocumento===q.get('data');});
      if(!d)return jsonResponse({erro:'Documento não encontrado ou sem produtos.'},404);
      const rows=opRows(type).filter(function(r){return String(r.documentoId)===String(d.id);}).map(type==='RECUPERACAO'?mapRec:mapDoa);
      if(!rows.length)return jsonResponse({erro:'Documento não encontrado ou sem produtos.'},404);
      return blobResponse(pdfDocOperacao(type,d,rows));
    }
    // Comprovante individual de doação.
    m=path.match(/\/api\/doacoes\/([^/]+)\/comprovante$/); if(m&&method==='GET'){
      const rid=decodeURIComponent(m[1]), row=opRows('DOACAO').find(x=>String(x.id)===rid); if(!row)return jsonResponse({erro:'Doação não encontrada.'},404); const d=getDoc('DOACAO',row.documentoId)||{numero:0,dataDocumento:row.dataDoacao,beneficiario:row.beneficiario}; return blobResponse(pdfDocOperacao('DOACAO',d,[mapDoa(row)]));
    }
    // Backups locais: exporta o mesmo conjunto de dados que o adaptador usa.
    if(path.endsWith('/api/admin/backup-status')&&method==='GET')return jsonResponse({ok:true,modo:'web-local',banco:'sessionStorage',ultimaExecucao:null,retencao:0});
    if(path.endsWith('/api/admin/backup')&&method==='POST'){
      const out={version:'25-web-local',exportadoEm:now(),dados:{}};for(const k of Object.values(KEYS))out.dados[k]=read(k,[]);return blobResponse(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
    }
    if(path.endsWith('/api/migracao/localstorage')&&method==='POST'){
      const dados=body?.dados||body||{};let n=0;for(const [k,v] of Object.entries(dados)){if(Object.values(KEYS).includes(k)&&Array.isArray(v)){write(k,v);n++;}}location.reload();return jsonResponse({ok:true,chavesMigradas:n});
    }

    // Avisos compartilhados apenas dentro desta sessão do navegador.
    if(path.endsWith('/api/avisos') && method==='GET'){
      return jsonResponse({avisos:read('ca_v25_avisos',[]).slice().sort((a,b)=>new Date(b.criadoEm||0)-new Date(a.criadoEm||0))});
    }
    if(path.endsWith('/api/avisos') && method==='POST'){
      if(!user) return jsonResponse({erro:'Não autenticado.'},401);
      const titulo=text(body.titulo), mensagem=text(body.mensagem);
      if(!titulo)return jsonResponse({erro:'Informe o título do aviso.'},400);
      if(titulo.length>160)return jsonResponse({erro:'O título pode ter no máximo 160 caracteres.'},400);
      if(!mensagem)return jsonResponse({erro:'Informe a mensagem do aviso.'},400);
      if(mensagem.length>5000)return jsonResponse({erro:'O aviso pode ter no máximo 5.000 caracteres.'},400);
      const aviso={id:id(),titulo,mensagem,usuarioId:Number(user.id||1),usuarioNome:user.nome||user.usuario||'Usuário',criadoEm:now()};
      const arr=read('ca_v25_avisos',[]);arr.unshift(aviso);write('ca_v25_avisos',arr.slice(0,200));saveAudit('CRIAR','AVISO',aviso.id,`Aviso "${titulo}" publicado.`);return jsonResponse({ok:true,aviso},201);
    }
    m=path.match(/\/api\/avisos\/([^/]+)$/);if(m&&method==='DELETE'){
      const iid=decodeURIComponent(m[1]),arr=read('ca_v25_avisos',[]),i=arr.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Aviso não encontrado.'},404);
      const [item]=arr.splice(i,1);write('ca_v25_avisos',arr);saveAudit('EXCLUIR','AVISO',iid,`Aviso "${item.titulo}" excluído.`);return jsonResponse({ok:true,id:iid});
    }

    // Documentos: metadados e arquivo ficam apenas na sessão. Limite de 5 MB por arquivo.
    const docsKey='ca_v25_documentos_gerais';
    const docMime=nome=>{const n=String(nome||'').toLowerCase();if(n.endsWith('.pdf'))return 'pdf';if(n.endsWith('.xlsx'))return 'excel';if(n.endsWith('.xls'))return 'excel';return 'outros';};
    const docRows=()=>read(docsKey,[]);
    const docPublic=d=>({id:String(d.id),nome:d.nome,categoria:d.categoria||'Outros',descricao:d.descricao||'',arquivoNome:d.arquivoNome||'',tipo:d.tipo||docMime(d.arquivoNome),mimeType:d.mimeType||'application/octet-stream',tamanho:Number(d.tamanho||0),favorito:d.favorito===true,criadoEm:d.criadoEm,atualizadoEm:d.atualizadoEm,criadoPor:d.criadoPor||'',atualizadoPor:d.atualizadoPor||''});
    if(path.endsWith('/api/documentos')&&method==='GET'){
      const busca=text(q.get('busca')).toLowerCase(),categoria=text(q.get('categoria')),tipo=text(q.get('tipo')).toLowerCase(),favoritos=text(q.get('favoritos')).toLowerCase()==='true';
      const out=docRows().filter(d=>(!busca||`${d.nome} ${d.descricao||''} ${d.arquivoNome||''} ${d.categoria||''}`.toLowerCase().includes(busca))&&(!categoria||categoria==='Todos'||d.categoria===categoria)&&(!tipo||tipo==='todos'||docMime(d.arquivoNome)===tipo)&&(!favoritos||d.favorito));
      return jsonResponse(out.sort((a,b)=>Number(b.favorito)-Number(a.favorito)||new Date(b.atualizadoEm)-new Date(a.atualizadoEm)).map(docPublic));
    }
    const docIdMatch=path.match(/\/api\/documentos\/([^/]+)$/);
    const docArquivoMatch=path.match(/\/api\/documentos\/([^/]+)\/arquivo$/);
    const docFavoritoMatch=path.match(/\/api\/documentos\/([^/]+)\/favorito$/);
    if(path.endsWith('/api/documentos')&&(method==='POST'||method==='PUT')){
      if(!user)return jsonResponse({erro:'Não autenticado.'},401);
      const fd=body instanceof FormData?body:null;const idEdit=method==='PUT'?path.split('/').pop():null;const rows=docRows();
      const nome=text(fd?.get('nome')||body.nome),categoria=text(fd?.get('categoria')||body.categoria)||'Outros',descricao=text(fd?.get('descricao')||body.descricao);
      if(!nome)return jsonResponse({erro:'Informe o nome do documento.'},400);
      const file=fd?.get('arquivo');
      if(method==='POST'&&!file)return jsonResponse({erro:'Selecione um PDF ou Excel.'},400);
      if(file&&typeof file.arrayBuffer==='function'){
        const bytes=await file.arrayBuffer();if(bytes.byteLength>5*1024*1024)return jsonResponse({erro:'O arquivo deve ter no máximo 5 MB.'},400);
        const allowed=/\.(pdf|xlsx|xls)$/i.test(file.name||'');if(!allowed)return jsonResponse({erro:'Aceitamos somente PDF, XLSX ou XLS.'},400);
        let bin='';const u8=new Uint8Array(bytes);const chunk=0x8000;for(let i=0;i<u8.length;i+=chunk)bin+=String.fromCharCode(...u8.subarray(i,Math.min(i+chunk,u8.length)));
        const base64=btoa(bin);
        const item={id:idEdit?String(idEdit):id(),nome,categoria,descricao,arquivoNome:file.name,mimeType:file.type||'application/octet-stream',tipo:docMime(file.name),tamanho:bytes.byteLength,dadosBase64:base64,favorito:false,criadoEm:now(),atualizadoEm:now(),criadoPor:user.usuario||'',atualizadoPor:user.usuario||''};
        if(idEdit){const i=rows.findIndex(x=>String(x.id)===String(idEdit));if(i<0)return jsonResponse({erro:'Documento não encontrado.'},404);item.criadoEm=rows[i].criadoEm;item.criadoPor=rows[i].criadoPor;item.favorito=rows[i].favorito===true;rows[i]=item;}else rows.unshift(item);
      }else{
        const i=rows.findIndex(x=>String(x.id)===String(idEdit));if(i<0)return jsonResponse({erro:'Documento não encontrado.'},404);rows[i]={...rows[i],nome,categoria,descricao,atualizadoEm:now(),atualizadoPor:user.usuario||''};
      }
      write(docsKey,rows);const saved=rows.find(x=>String(x.id)===String(idEdit||rows[0].id));saveAudit(method==='POST'?'CRIAR':'EDITAR','DOCUMENTO',saved.id,`Documento ${saved.nome} ${method==='POST'?'adicionado':'editado'}.`);return jsonResponse(docPublic(saved),method==='POST'?201:200);
    }
    if(docArquivoMatch&&method==='GET'){
      const iid=decodeURIComponent(docArquivoMatch[1]),d=docRows().find(x=>String(x.id)===iid);if(!d)return jsonResponse({erro:'Documento não encontrado.'},404);
      if(!d.dadosBase64)return jsonResponse({erro:'O arquivo deste documento não está disponível.'},404);
      const bin=atob(d.dadosBase64),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      return new Response(new Blob([u8],{type:d.mimeType||'application/octet-stream'}),{status:200,headers:{'Content-Type':d.mimeType||'application/octet-stream'}});
    }
    if(docFavoritoMatch&&method==='PATCH'){
      const iid=decodeURIComponent(docFavoritoMatch[1]),d=docRows().find(x=>String(x.id)===iid);if(!d)return jsonResponse({erro:'Documento não encontrado.'},404);
      const fav=body.favorito===true||String(body.favorito||'').toLowerCase()==='true';d.favorito=fav;d.atualizadoEm=now();d.atualizadoPor=user?.usuario||'';write(docsKey,docRows());return jsonResponse({ok:true,id:iid,favorito:fav});
    }
    if(docIdMatch&&method==='GET'){
      const iid=decodeURIComponent(docIdMatch[1]),d=docRows().find(x=>String(x.id)===iid);if(!d)return jsonResponse({erro:'Documento não encontrado.'},404);
      return jsonResponse(docPublic(d));
    }
    if(docIdMatch&&method==='DELETE'){
      const iid=decodeURIComponent(docIdMatch[1]),rows=docRows(),i=rows.findIndex(x=>String(x.id)===iid);if(i<0)return jsonResponse({erro:'Documento não encontrado.'},404);const [d]=rows.splice(i,1);write(docsKey,rows);saveAudit('EXCLUIR','DOCUMENTO',iid,`Documento ${d.nome} excluído.`);return jsonResponse({ok:true,id:iid});
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
  window.CA_LOCAL={version:'25-web-local',keys:KEYS,exportData(){const out={version:'25-web-local',exportadoEm:now(),dados:{}};for(const k of Object.values(KEYS))out.dados[k]=read(k,[]);return out;},importData(obj){if(!obj?.dados)throw new Error('Backup inválido.');for(const [k,v] of Object.entries(obj.dados))if(Object.values(KEYS).includes(k))write(k,v);location.reload();}};
})();
