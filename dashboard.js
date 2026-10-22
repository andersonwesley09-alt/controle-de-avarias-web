const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraSistema === "function") return window.formatarDataHoraSistema(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.6 - IA analítica isolada sobre a base V20.5 */
const API = (() => {
    const chave = "controleAvariasServidor";
    const configurado = (() => {
        try {
            const valor = localStorage.getItem(chave);
            if (!valor) return "";
            const u = new URL(valor);
            return /^https?:$/.test(u.protocol) && !/\.github\.io$/i.test(u.hostname) && !/\.pages\.dev$/i.test(u.hostname) ? u.origin : "";
        } catch { return ""; }
    })();
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const porta = window.location.port;
    const origemHttp = (protocolo === "http:" || protocolo === "https:") ? window.location.origin : "";

    // Se o servidor já está sendo executado na porta 3000, usa a própria origem.
    if (origemHttp && porta === "3000") return origemHttp;

    // Em GitHub Pages (ou outro frontend estático), nunca acrescente :3000 ao domínio público.
    // Use o servidor configurado ou, por padrão, o servidor local.
    if (/\.github\.io$/i.test(hostname) || /\.pages\.dev$/i.test(hostname)) {
        return configurado || "http://localhost:3000";
    }

    // Se houver um servidor configurado manualmente, ele tem prioridade.
    if (configurado) return configurado;

    // Frontend servido por outro host/porta: mantém compatibilidade com o servidor local da rede.
    if (origemHttp && hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${protocolo}//${hostname}:3000`;
    }

    return origemHttp || "http://localhost:3000";
})();
let avarias=[];let estoqueCaixas={total:{},fornecedores:[],produtos:[],categorias:[],caixas:[]};let modoGrafico="valor";let modoProdutos="valor";let modoCaixaProdutos="valor";
const $=id=>document.getElementById(id);

/* V20.6 - sessão do Dashboard (preservada)
   O cookie HttpOnly é a autenticação principal. O token salvo pelo login
   anterior é usado somente como fallback para evitar problemas de hostname
   (localhost x IP) durante a transição.
*/
function obterSessaoDashboardLocal(){
    try{
        return JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null');
    }catch(_){
        return null;
    }
}

function cabecalhosAutenticacaoDashboard(){
    const sessao=obterSessaoDashboardLocal();
    const headers={};
    if(sessao?.token){ headers.Authorization=`Bearer ${sessao.token}`; }
    return headers;
}

async function validarSessaoDashboard(){
    try{
        const r=await fetch(`${API}/api/sessao`,{
            method:'GET',
            cache:'no-store',
            credentials:'include',
            headers:cabecalhosAutenticacaoDashboard()
        });
        if(r.status===401||r.status===403){
            sessionStorage.removeItem('usuarioLogado');
            window.location.href='login.html';
            return null;
        }
        if(!r.ok) throw new Error('Não foi possível validar a sessão.');
        const dados=await r.json();
        const atual=obterSessaoDashboardLocal() || {};
        sessionStorage.setItem('usuarioLogado',JSON.stringify({
            usuario:dados.usuario,
            nome:dados.nome,
            perfil:dados.perfil,
            token:atual.token || '',
            loginEm:atual.loginEm || new Date().toISOString()
        }));
        return dados;
    }catch(e){
        console.error('Erro ao validar sessão do Dashboard:',e);
        atualizarStatusTempoReal('offline','Servidor indisponível');
        return false;
    }
}

const els={reg:$('cardRegistros'),qtd:$('cardQuantidade'),valor:$('cardValor'),forn:$('cardFornecedores'),prod:$('cardProdutos'),caixas:$('cardCaixas'),dashValorItens:$('dashValorItens'),dashQuantidadeItens:$('dashQuantidadeItens'),dashProdutosDistintos:$('dashProdutosDistintos'),dashCaixasComProdutos:$('dashCaixasComProdutos'),dashFornecedoresCaixas:$('dashFornecedoresCaixas'),dashCategoriasCaixas:$('dashCategoriasCaixas'),dashTopFornecedor:$('dashTopFornecedor'),dashTopFornecedorValor:$('dashTopFornecedorValor'),dashTopCaixa:$('dashTopCaixa'),dashTopCaixaValor:$('dashTopCaixaValor'),dashTopCategoria:$('dashTopCategoria'),dashTopCategoriaValor:$('dashTopCategoriaValor'),tabelaFornecedoresCaixas:$('tabelaFornecedoresCaixas'),tabelaProdutosCaixas:$('tabelaProdutosCaixas'),graficoCategoriaCaixas:$('graficoCategoriaCaixas'),tabelaTopCaixas:$('tabelaTopCaixas'),di:$('filtroDashboardDataInicial'),df:$('filtroDashboardDataFinal'),cat:$('filtroDashboardCategoria'),setor:$('filtroDashboardSetor'),motivo:$('filtroDashboardMotivo'),fornecedor:$('filtroDashboardFornecedor'),produto:$('filtroDashboardProduto'),status:$('filtroDashboardStatus'),limpar:$('btnLimparDashboard'),evolucao:$('graficoEvolucao'),catGraf:$('graficoCategoria'),setorGraf:$('graficoSetor'),motGraf:$('graficoMotivo'),fornTabela:$('tabelaFornecedores'),prodTabela:$('produtosMaisBaixados'),ultimas:$('ultimasBaixas')};
const painelFiltrosDashboard = $('painelFiltrosDashboard');
const btnFiltrosDashboard = $('btnFiltrosDashboard');
const painelFiltrosCaixasDashboard = $('painelFiltrosCaixasDashboard');
const btnFecharFiltrosCaixas = $('btnFecharFiltrosCaixas');
const filtroCaixaFornecedor = $('filtroCaixaFornecedor');
const filtroCaixaCategoria = $('filtroCaixaCategoria');
const filtroCaixaNumero = $('filtroCaixaNumero');
const filtroCaixaProduto = $('filtroCaixaProduto');
const btnLimparFiltrosCaixas = $('btnLimparFiltrosCaixas');

const n=v=>Number.isFinite(Number(v))?Number(v):0;const moeda=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n(v));const qtd=v=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:3});const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const val=a=>n(a.quantidade)*n(a.valorUnitario);const cat=a=>a.categoria||'Mercearia';
function dentroData(a){const d=new Date(a.movimentadoEm||a.criadoEm||0);if(Number.isNaN(d.getTime()))return false;if(els.di.value&&d<inicioDiaSistema(els.di.value))return false;if(els.df.value&&d>fimDiaSistema(els.df.value))return false;return true;}
function filtrados(){const p=norm(els.produto.value);return avarias.filter(a=>{if(els.status.value!=='Todos'&&String(a.status||'')!==els.status.value)return false;if(!dentroData(a))return false;if(els.cat.value!=='Todos'&&cat(a)!==els.cat.value)return false;if(els.setor.value!=='Todos'&&String(a.setor||'')!==els.setor.value)return false;if(els.motivo.value!=='Todos'&&String(a.tipo||'')!==els.motivo.value)return false;if(els.fornecedor.value!=='Todos'&&String(a.fornecedor||'')!==els.fornecedor.value)return false;if(p&&!norm(`${a.codigo||''} ${a.produto||''}`).includes(p))return false;return true;});}
function opcoes(){const fs=[...new Set(avarias.map(a=>String(a.fornecedor||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const ms=[...new Set(avarias.map(a=>String(a.tipo||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));const f=els.fornecedor.value,m=els.motivo.value;els.fornecedor.innerHTML='<option>Todos</option>'+fs.map(x=>`<option>${esc(x)}</option>`).join('');els.motivo.innerHTML='<option>Todos</option>'+ms.map(x=>`<option>${esc(x)}</option>`).join('');if(fs.includes(f))els.fornecedor.value=f;if(ms.includes(m))els.motivo.value=m;}
function agr(lista,key){const m=new Map();for(const a of lista){const k=key(a)||'Não informado';if(!m.has(k))m.set(k,{chave:k,registros:0,quantidade:0,valor:0});const x=m.get(k);x.registros++;x.quantidade+=n(a.quantidade);x.valor+=val(a);}return[...m.values()];}
function barras(el,dados){if(!dados.length){el.innerHTML='<div class="vazio">Nenhum dado para os filtros selecionados.</div>';return;}const arr=dados.slice(0,8),max=Math.max(...arr.map(x=>x.valor),1);el.innerHTML=arr.map(x=>`<div class="barra-item"><div class="barra-label"><span>${esc(x.chave)}</span><strong>${moeda(x.valor)}</strong></div><div class="barra-track"><span style="width:${Math.max(3,x.valor/max*100)}%"></span></div></div>`).join('');}
function evolucao(lista){const m=new Map();for(const a of lista){const d=new Date(a.movimentadoEm||a.criadoEm||0);if(Number.isNaN(d.getTime()))continue;const k=formatarDataSistema(d);if(!m.has(k))m.set(k,{data:d,valor:0,quantidade:0,registros:0});const x=m.get(k);x.valor+=val(a);x.quantidade+=n(a.quantidade);x.registros++;}const arr=[...m.values()].sort((a,b)=>a.data-b.data).slice(-31);if(!arr.length){els.evolucao.innerHTML='<div class="vazio">Nenhuma movimentação para os filtros selecionados.</div>';return;}const max=Math.max(...arr.map(x=>n(x[modoGrafico])),1);els.evolucao.innerHTML=arr.map(x=>{const v=n(x[modoGrafico]);const label=modoGrafico==='valor'?moeda(v):modoGrafico==='quantidade'?qtd(v):v;return `<div class="coluna-grafico"><div class="coluna-valor">${label}</div><div class="coluna" style="height:${Math.max(5,v/max*100)}%"></div><small>${formatarDataCurtaSistema(x.data)}</small></div>`;}).join('');}
function fornecedores(lista){const arr=agr(lista,a=>a.fornecedor||'Não informado').sort((a,b)=>b.valor-a.valor).slice(0,12);els.fornTabela.innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.chave)}</td><td>${x.registros}</td><td>${qtd(x.quantidade)}</td><td><strong>${moeda(x.valor)}</strong></td></tr>`).join(''):'<tr><td colspan="4" class="vazio">Nenhum fornecedor encontrado.</td></tr>';}
function produtos(lista){const m=new Map();for(const a of lista){const k=String(a.codigo||a.produto||'').trim().toLowerCase();if(!k)continue;if(!m.has(k))m.set(k,{produto:a.produto||'-',codigo:a.codigo||'',categoria:cat(a),quantidade:0,valor:0});const x=m.get(k);x.quantidade+=n(a.quantidade);x.valor+=val(a);}const arr=[...m.values()].sort((a,b)=>modoProdutos==='valor'?b.valor-a.valor:b.quantidade-a.quantidade).slice(0,15);els.prodTabela.innerHTML=arr.length?arr.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.produto)}</strong><small class="codigo-secundario">${esc(x.codigo)}</small></td><td>${esc(x.categoria)}</td><td>${qtd(x.quantidade)}</td><td><strong>${moeda(x.valor)}</strong></td></tr>`).join(''):'<tr><td colspan="5" class="vazio">Nenhum produto encontrado.</td></tr>';}
function ultimas(lista){const arr=[...lista].sort((a,b)=>new Date(b.movimentadoEm||b.criadoEm||0)-new Date(a.movimentadoEm||a.criadoEm||0)).slice(0,12);els.ultimas.innerHTML=arr.length?arr.map(a=>`<tr><td>${formatarDataHoraSistema(a.movimentadoEm||a.criadoEm)}</td><td>${esc(a.produto||'-')}</td><td>${esc(cat(a))}</td><td>${esc(a.fornecedor||'-')}</td><td>${esc(a.setor||'-')}</td><td>${esc(a.tipo||'-')}</td><td>${qtd(a.quantidade)}</td><td><strong>${moeda(val(a))}</strong></td></tr>`).join(''):'<tr><td colspan="8" class="vazio">Nenhuma movimentação encontrada.</td></tr>';}
function render(){const l=filtrados();els.reg.textContent=l.length;els.qtd.textContent=qtd(l.reduce((s,a)=>s+n(a.quantidade),0));els.valor.textContent=moeda(l.reduce((s,a)=>s+val(a),0));els.forn.textContent=new Set(l.map(a=>String(a.fornecedor||'').trim()).filter(Boolean)).size;els.prod.textContent=new Set(l.map(a=>String(a.codigo||a.produto||'').trim()).filter(Boolean)).size;evolucao(l);barras(els.catGraf,agr(l,a=>cat(a)).sort((a,b)=>b.valor-a.valor));barras(els.setorGraf,agr(l,a=>a.setor||'Não informado').sort((a,b)=>b.valor-a.valor));barras(els.motGraf,agr(l,a=>a.tipo||'Não informado').sort((a,b)=>b.valor-a.valor));fornecedores(l);produtos(l);ultimas(l)}

function renderizarEstoqueCaixasDashboard(){
    const total=estoqueCaixas.total||{};
    const valorTotal=n(total.valor);
    if(els.dashValorItens) els.dashValorItens.textContent=moeda(valorTotal);
    if(els.dashQuantidadeItens) els.dashQuantidadeItens.textContent=qtd(total.quantidade||0);

    const fornecedores=[...(estoqueCaixas.fornecedores||[])].sort((a,b)=>b.valor-a.valor);
    const categorias=[...(estoqueCaixas.categorias||[])].sort((a,b)=>b.valor-a.valor);
    const produtos=[...(estoqueCaixas.produtos||[])].sort((a,b)=>modoCaixaProdutos==='valor'?b.valor-a.valor:b.quantidade-a.quantidade).slice(0,15);
    const caixas=[...(estoqueCaixas.caixas||[])].sort((a,b)=>b.valor-a.valor);

    if(els.dashProdutosDistintos) els.dashProdutosDistintos.textContent=qtd(total.produtosDistintos||0);
    if(els.dashCaixasComProdutos) els.dashCaixasComProdutos.textContent=qtd(total.caixasComProdutos||0);
    if(els.dashFornecedoresCaixas) els.dashFornecedoresCaixas.textContent=qtd(fornecedores.length);
    if(els.dashCategoriasCaixas) els.dashCategoriasCaixas.textContent=qtd(categorias.length);

    const topFornecedor=fornecedores[0];
    const topCategoria=categorias[0];
    const topCaixa=caixas[0];
    if(els.dashTopFornecedor) els.dashTopFornecedor.textContent=topFornecedor?.fornecedor||'—';
    if(els.dashTopFornecedorValor) els.dashTopFornecedorValor.textContent=topFornecedor?`${moeda(topFornecedor.valor)} • ${valorTotal?((topFornecedor.valor/valorTotal)*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):0}% do total`:'R$ 0,00';
    if(els.dashTopCategoria) els.dashTopCategoria.textContent=topCategoria?.categoria||'—';
    if(els.dashTopCategoriaValor) els.dashTopCategoriaValor.textContent=topCategoria?`${moeda(topCategoria.valor)} • ${valorTotal?((topCategoria.valor/valorTotal)*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):0}% do total`:'R$ 0,00';
    if(els.dashTopCaixa) els.dashTopCaixa.textContent=topCaixa?`${topCaixa.numero}${topCaixa.local?` • ${topCaixa.local}`:''}`:'—';
    if(els.dashTopCaixaValor) els.dashTopCaixaValor.textContent=topCaixa?`${moeda(topCaixa.valor)} • ${valorTotal?((topCaixa.valor/valorTotal)*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):0}% do total`:'R$ 0,00';

    if(els.tabelaFornecedoresCaixas){
        els.tabelaFornecedoresCaixas.innerHTML=fornecedores.length
            ? fornecedores.map((x,i)=>{const pct=valorTotal?(x.valor/valorTotal)*100:0;return `<tr><td>${i+1}</td><td><strong>${esc(x.fornecedor)}</strong></td><td>${qtd(x.produtos)}</td><td>${qtd(x.quantidade)}</td><td><span class="participacao-caixas">${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</span></td><td><strong>${moeda(x.valor)}</strong></td></tr>`}).join('')
            : '<tr><td colspan="6" class="vazio">Nenhum produto armazenado.</td></tr>';
    }

    if(els.tabelaProdutosCaixas){
        els.tabelaProdutosCaixas.innerHTML=produtos.length
            ? produtos.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.produto)}</strong><small class="codigo-secundario">${esc(x.codigo)}</small></td><td>${esc(x.categoria)}</td><td>${esc(x.fornecedor)}</td><td>${qtd(x.caixas||0)}</td><td>${qtd(x.quantidade)}</td><td><strong>${moeda(x.valor)}</strong></td></tr>`).join('')
            : '<tr><td colspan="7" class="vazio">Nenhum produto armazenado.</td></tr>';
    }

    if(els.graficoCategoriaCaixas){
        if(!categorias.length){
            els.graficoCategoriaCaixas.innerHTML='<div class="vazio">Nenhum produto armazenado.</div>';
        }else{
            const arr=categorias.slice(0,10), max=Math.max(...arr.map(x=>x.valor),1);
            els.graficoCategoriaCaixas.innerHTML=arr.map(x=>{const pct=valorTotal?(x.valor/valorTotal)*100:0;return `<div class="barra-item"><div class="barra-label"><span>${esc(x.categoria)}</span><strong>${moeda(x.valor)} <small>${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</small></strong></div><div class="barra-track"><span style="width:${Math.max(3,x.valor/max*100)}%"></span></div><div class="categoria-meta-caixas">${qtd(x.quantidade)} unidades / kg</div></div>`}).join('');
        }
    }

    if(els.tabelaTopCaixas){
        els.tabelaTopCaixas.innerHTML=caixas.length
            ? caixas.slice(0,12).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.numero)}</strong></td><td>${esc(x.fornecedor||'—')}</td><td>${esc(x.local)}</td><td>${qtd(x.produtos||0)}</td><td>${qtd(x.quantidade)}</td><td><strong>${moeda(x.valor)}</strong></td></tr>`).join('')
            : '<tr><td colspan="7" class="vazio">Nenhuma caixa com produtos.</td></tr>';
    }
}

function obterFiltrosCaixasDashboard(){
    return {
        fornecedor: filtroCaixaFornecedor?.value || 'Todos',
        categoria: filtroCaixaCategoria?.value || 'Todos',
        caixa: filtroCaixaNumero?.value || 'Todos',
        produto: String(filtroCaixaProduto?.value || '').trim()
    };
}

function preencherFiltrosCaixasDashboard(filtros){
    if(!filtros) return;
    const atual = obterFiltrosCaixasDashboard();
    const fornecedores = Array.isArray(filtros.fornecedores) ? filtros.fornecedores : [];
    const categorias = Array.isArray(filtros.categorias) ? filtros.categorias : [];
    const caixas = Array.isArray(filtros.caixas) ? filtros.caixas : [];

    if(filtroCaixaFornecedor){
        filtroCaixaFornecedor.innerHTML = '<option value="Todos">Todos</option>' + fornecedores.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
        filtroCaixaFornecedor.value = fornecedores.includes(atual.fornecedor) ? atual.fornecedor : 'Todos';
    }
    if(filtroCaixaCategoria){
        filtroCaixaCategoria.innerHTML = '<option value="Todos">Todos</option>' + categorias.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
        filtroCaixaCategoria.value = categorias.includes(atual.categoria) ? atual.categoria : 'Todos';
    }
    if(filtroCaixaNumero){
        filtroCaixaNumero.innerHTML = '<option value="Todos">Todas</option>' + caixas.map(x=>`<option value="${esc(x.id)}">${esc(x.numero)}${x.local ? ` • ${esc(x.local)}` : ''}${x.fornecedor ? ` • ${esc(x.fornecedor)}` : ''}</option>`).join('');
        if(caixas.some(x=>String(x.id)===String(atual.caixa))) filtroCaixaNumero.value = atual.caixa;
        else filtroCaixaNumero.value = 'Todos';
    }
    if(filtroCaixaProduto) filtroCaixaProduto.value = atual.produto;
}

let carregamentoCaixasTimer = null;
async function carregarEstoqueCaixasDashboard(){
    try{
        const filtros = obterFiltrosCaixasDashboard();
        const params = new URLSearchParams();
        if(filtros.fornecedor !== 'Todos') params.set('fornecedor', filtros.fornecedor);
        if(filtros.categoria !== 'Todos') params.set('categoria', filtros.categoria);
        if(filtros.caixa !== 'Todos') params.set('caixa', filtros.caixa);
        if(filtros.produto) params.set('produto', filtros.produto);
        const url = `${API}/api/dashboard/caixas-resumo${params.toString() ? `?${params.toString()}` : ''}`;
        const r=await fetch(url,{cache:'no-store',credentials:'include',headers:cabecalhosAutenticacaoDashboard()});
        if(!r.ok) throw new Error('Erro ao carregar resumo do estoque das caixas.');
        estoqueCaixas=await r.json();
        preencherFiltrosCaixasDashboard(estoqueCaixas.filtros);
        renderizarEstoqueCaixasDashboard();
    }catch(e){
        console.error('Erro ao carregar estoque das caixas no dashboard:',e);
        estoqueCaixas={total:{},fornecedores:[],produtos:[],categorias:[],caixas:[],filtros:{fornecedores:[],categorias:[],caixas:[]}};
        renderizarEstoqueCaixasDashboard();
    }
}



/* =========================================================
   V20.6 - ANALISTA IA: CAMADA ANALÍTICA ISOLADA
   Não altera os dados do Dashboard; apenas cria um contexto
   estruturado e somente leitura para a IA.
========================================================= */
const btnGerarAnaliseIA = $('btnGerarAnaliseIA');
const perguntaIA = $('perguntaIA');
const resultadoAnaliseIA = $('resultadoAnaliseIA');
const btnAbrirIA = $('btnAbrirIA');
const btnFecharIA = $('btnFecharIA');
const painelAnalistaIA = $('painelAnalistaIA');

function alternarAnalistaIA(abrir = null) {
    if (!painelAnalistaIA || !btnAbrirIA) return;
    const deveAbrir = abrir === null ? !painelAnalistaIA.classList.contains('aberto') : Boolean(abrir);
    painelAnalistaIA.classList.toggle('aberto', deveAbrir);
    painelAnalistaIA.setAttribute('aria-hidden', String(!deveAbrir));
    btnAbrirIA.setAttribute('aria-expanded', String(deveAbrir));
    btnAbrirIA.classList.toggle('ativo', deveAbrir);
    if (deveAbrir) setTimeout(() => perguntaIA?.focus(), 80);
}
btnAbrirIA?.addEventListener('click', () => alternarAnalistaIA());
btnFecharIA?.addEventListener('click', () => alternarAnalistaIA(false));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && painelAnalistaIA?.classList.contains('aberto')) alternarAnalistaIA(false);
});
document.addEventListener('click', event => {
    if (!painelAnalistaIA?.classList.contains('aberto')) return;
    if (event.target.closest('#painelAnalistaIA, #btnAbrirIA')) return;
    alternarAnalistaIA(false);
});

function filtrarAvariasIA(lista, incluirDatas = true) {
    const p = norm(els.produto.value);
    return lista.filter(a => {
        if (els.status.value !== 'Todos' && String(a.status || '') !== els.status.value) return false;
        if (incluirDatas && !dentroData(a)) return false;
        if (els.cat.value !== 'Todos' && cat(a) !== els.cat.value) return false;
        if (els.setor.value !== 'Todos' && String(a.setor || '') !== els.setor.value) return false;
        if (els.motivo.value !== 'Todos' && String(a.tipo || '') !== els.motivo.value) return false;
        if (els.fornecedor.value !== 'Todos' && String(a.fornecedor || '') !== els.fornecedor.value) return false;
        if (p && !norm(`${a.codigo || ''} ${a.produto || ''}`).includes(p)) return false;
        return true;
    });
}

function agruparIA(lista, fn) {
    const mapa = new Map();
    for (const item of lista) {
        const chave = String(fn(item) || 'Não informado').trim() || 'Não informado';
        const atual = mapa.get(chave) || { nome: chave, registros: 0, quantidade: 0, valor: 0 };
        atual.registros += 1;
        atual.quantidade += n(item.quantidade);
        atual.valor += val(item);
        mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a,b) => b.valor - a.valor);
}

function resumoNumericoIA(lista) {
    const valor = lista.reduce((s,a) => s + val(a), 0);
    const quantidade = lista.reduce((s,a) => s + n(a.quantidade), 0);
    return {
        registros: lista.length,
        quantidade,
        valor,
        valorMedioRegistro: lista.length ? valor / lista.length : 0,
        fornecedores: new Set(lista.map(a => String(a.fornecedor || '').trim()).filter(Boolean)).size,
        produtosDistintos: new Set(lista.map(a => String(a.codigo || a.produto || '').trim()).filter(Boolean)).size
    };
}

function variacaoIA(atual, anterior) {
    const a = n(atual), b = n(anterior);
    if (!b) return a ? null : 0;
    return ((a - b) / b) * 100;
}

function ordenarDataIA(lista) {
    return [...lista].sort((a,b) => new Date(a.movimentadoEm || a.criadoEm || 0) - new Date(b.movimentadoEm || b.criadoEm || 0));
}

function montarTendenciaAvariasIA(listaAtual) {
    const dataInicial = els.di.value;
    const dataFinal = els.df.value;
    if (!dataInicial || !dataFinal) return { disponivel: false, motivo: 'Período não definido.' };
    const inicio = new Date(`${dataInicial}T00:00:00`);
    const fim = new Date(`${dataFinal}T23:59:59.999`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) return { disponivel: false, motivo: 'Período inválido.' };
    const dias = Math.max(1, Math.round((fim - inicio) / 86400000) + 1);
    const prevFim = new Date(inicio.getTime() - 1);
    const prevInicio = new Date(prevFim.getTime() - (dias - 1) * 86400000);
    const baseSemData = filtrarAvariasIA(avarias, false);
    const anterior = baseSemData.filter(a => {
        const d = new Date(a.movimentadoEm || a.criadoEm || 0);
        return !Number.isNaN(d.getTime()) && d >= prevInicio && d <= prevFim;
    });
    const atual = resumoNumericoIA(listaAtual);
    const ant = resumoNumericoIA(anterior);
    return {
        disponivel: true,
        atual,
        anterior: ant,
        variacao: {
            valor: variacaoIA(atual.valor, ant.valor),
            quantidade: variacaoIA(atual.quantidade, ant.quantidade),
            registros: variacaoIA(atual.registros, ant.registros),
            valorMedioRegistro: variacaoIA(atual.valorMedioRegistro, ant.valorMedioRegistro)
        },
        periodos: { atual: `${dataInicial} a ${dataFinal}`, anterior: `${prevInicio.toISOString().slice(0,10)} a ${prevFim.toISOString().slice(0,10)}` }
    };
}

function montarConcentracaoIA(lista, totalValor) {
    const total = n(totalValor);
    const pct = (valor, base = total) => base ? (n(valor) / base) * 100 : 0;
    const fornecedores = agruparIA(lista, a => a.fornecedor);
    const categorias = agruparIA(lista, a => cat(a));
    const produtos = agruparIA(lista, a => a.produto || a.codigo);
    return {
        fornecedorTop1Pct: pct(fornecedores[0]?.valor),
        fornecedorTop3Pct: pct(fornecedores.slice(0,3).reduce((s,x)=>s+x.valor,0)),
        categoriaTop1Pct: pct(categorias[0]?.valor),
        categoriaTop3Pct: pct(categorias.slice(0,3).reduce((s,x)=>s+x.valor,0)),
        produtoTop1Pct: pct(produtos[0]?.valor),
        produtoTop5Pct: pct(produtos.slice(0,5).reduce((s,x)=>s+x.valor,0))
    };
}

function contextoAnaliseAvarias() {
    const lista = filtrados();
    const total = resumoNumericoIA(lista);
    const fornecedores = agruparIA(lista, a => a.fornecedor);
    const categorias = agruparIA(lista, a => cat(a));
    const produtos = agruparIA(lista, a => a.produto || a.codigo);
    const setores = agruparIA(lista, a => a.setor);
    const motivos = agruparIA(lista, a => a.tipo);
    return {
        somenteLeitura: true,
        escopo: 'avarias',
        filtros: {
            dataInicial: els.di.value || null,
            dataFinal: els.df.value || null,
            categoria: els.cat.value,
            setor: els.setor.value,
            motivo: els.motivo.value,
            fornecedor: els.fornecedor.value,
            produto: els.produto.value || '',
            status: els.status.value
        },
        total,
        concentracao: montarConcentracaoIA(lista, total.valor),
        tendencia: montarTendenciaAvariasIA(lista),
        fornecedores: fornecedores.slice(0, 10).map(x => ({ fornecedor: x.nome, valor: x.valor, registros: x.registros, quantidade: x.quantidade })),
        categorias: categorias.slice(0, 10).map(x => ({ categoria: x.nome, valor: x.valor, registros: x.registros, quantidade: x.quantidade })),
        produtos: produtos.slice(0, 10).map(x => ({ produto: x.nome, valor: x.valor, registros: x.registros, quantidade: x.quantidade })),
        setores: setores.slice(0, 8).map(x => ({ setor: x.nome, valor: x.valor, registros: x.registros })),
        motivos: motivos.slice(0, 8).map(x => ({ motivo: x.nome, valor: x.valor, registros: x.registros }))
    };
}

function contextoAnaliseCaixas() {
    const filtros = obterFiltrosCaixasDashboard();
    const total = estoqueCaixas.total || {};
    const fornecedores = (estoqueCaixas.fornecedores || []).slice(0, 10);
    const categorias = (estoqueCaixas.categorias || []).slice(0, 10);
    const produtos = (estoqueCaixas.produtos || []).slice(0, 10);
    const caixas = (estoqueCaixas.caixas || []).slice(0, 10);
    const base = n(total.valor);
    const pct = v => base ? (n(v) / base) * 100 : 0;
    return {
        somenteLeitura: true,
        escopo: 'caixas',
        filtros,
        total,
        concentracao: {
            fornecedorTop1Pct: pct(fornecedores[0]?.valor),
            fornecedorTop3Pct: pct(fornecedores.slice(0,3).reduce((s,x)=>s+n(x.valor),0)),
            categoriaTop1Pct: pct(categorias[0]?.valor),
            categoriaTop3Pct: pct(categorias.slice(0,3).reduce((s,x)=>s+n(x.valor),0)),
            produtoTop1Pct: pct(produtos[0]?.valor),
            produtoTop5Pct: pct(produtos.slice(0,5).reduce((s,x)=>s+n(x.valor),0)),
            caixaTop1Pct: pct(caixas[0]?.valor)
        },
        tendencia: { disponivel: false, motivo: 'O estoque das caixas é uma fotografia atual; comparação temporal não está disponível neste recorte.' },
        fornecedores,
        categorias,
        produtos,
        caixas
    };
}

function escHtmlIA(texto) {
    return String(texto || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function renderizarRespostaIA(texto, modo) {
    if (!resultadoAnaliseIA) return;
    const seguro = escHtmlIA(texto)
        .replace(/^###\s*(.+)$/gm, '<h4>$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/\n{2,}/g, '<div class="ia-espaco"></div>')
        .replace(/\n/g, '<br>');
    resultadoAnaliseIA.innerHTML = `
        <div class="ia-resposta">
            <div class="ia-resposta-topo"><span>✦</span><div><strong>${modo === 'ia' ? 'Análise IA' : 'Análise inteligente local'}</strong><small>Contexto e filtros atuais do dashboard • somente leitura</small></div></div>
            <div class="ia-resposta-texto">${seguro}</div>
        </div>`;
}

async function gerarAnaliseIA(pergunta = '', tipo = 'livre') {
    if (!resultadoAnaliseIA || !btnGerarAnaliseIA) return;
    const abaAtiva = document.querySelector('.dashboard-aba-btn.ativo')?.dataset.dashboardAba === 'devolucoes' ? 'caixas' : 'avarias';
    const contexto = abaAtiva === 'caixas' ? contextoAnaliseCaixas() : contextoAnaliseAvarias();
    const perguntaFinal = String(pergunta || perguntaIA?.value || '').trim() || 'Faça uma análise completa dos dados atuais.';
    btnGerarAnaliseIA.disabled = true;
    btnGerarAnaliseIA.textContent = '⏳ Analisando...';
    resultadoAnaliseIA.innerHTML = '<div class="ia-carregando"><span>✦</span><div><strong>Analisando os dados...</strong><small>Estou usando apenas o recorte e os filtros atuais.</small></div></div>';
    try {
        const r = await fetch(`${API}/api/dashboard/ia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...cabecalhosAutenticacaoDashboard() },
            credentials: 'include',
            body: JSON.stringify({ escopo: abaAtiva, tipoAnalise: tipo, pergunta: perguntaFinal, contexto })
        });
        const dados = await r.json();
        if (!r.ok) throw new Error(dados.erro || 'Erro ao gerar análise.');
        renderizarRespostaIA(dados.resposta, dados.modo);
    } catch (e) {
        console.error('Erro no Analista IA:', e);
        resultadoAnaliseIA.innerHTML = `<div class="ia-erro"><strong>Não foi possível gerar a análise.</strong><small>${escHtmlIA(e.message)}</small></div>`;
    } finally {
        btnGerarAnaliseIA.disabled = false;
        btnGerarAnaliseIA.textContent = '✨ Analisar';
    }
}

btnGerarAnaliseIA?.addEventListener('click', () => gerarAnaliseIA('', 'livre'));
perguntaIA?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); gerarAnaliseIA('', 'livre'); }
});
document.querySelectorAll('.atalho-ia').forEach(botao => {
    botao.addEventListener('click', () => {
        alternarAnalistaIA(true);
        const pergunta = botao.dataset.pergunta || '';
        const tipo = botao.dataset.tipo || 'livre';
        if (perguntaIA) perguntaIA.value = pergunta;
        gerarAnaliseIA(pergunta, tipo);
    });
});

function configurarAbasDashboard(){
    const botoes = document.querySelectorAll('.dashboard-aba-btn');
    const conteudos = document.querySelectorAll('.dashboard-aba-conteudo');

    botoes.forEach(botao => {
        botao.addEventListener('click', () => {
            const aba = botao.dataset.dashboardAba;
            botoes.forEach(b => {
                const ativo = b === botao;
                b.classList.toggle('ativo', ativo);
                b.setAttribute('aria-selected', String(ativo));
            });
            conteudos.forEach(conteudo => {
                conteudo.classList.toggle('ativo', conteudo.id === `abaDashboard${aba.charAt(0).toUpperCase()}${aba.slice(1)}`);
            });
            fecharTodosFiltrosDashboard();
        });
    });
}

function definirPeriodoPadrao(){
    const hoje = hojeSistema();
    const [ano, mes] = hoje.split('-').map(Number);
    const primeiroDia = `${ano}-${String(mes).padStart(2,'0')}-01`;
    if (!els.di.value) els.di.value = primeiroDia;
    if (!els.df.value) els.df.value = hoje;
}

function atualizarStatusTempoReal(estado, texto){
    const el = $('statusTempoReal');
    if(!el) return;
    el.classList.remove('conectado','reconectando','offline');
    el.classList.add(estado);
    el.textContent = `● ${texto}`;
}

function dashboardEstaEmCaixas(){
    return document.querySelector('.dashboard-aba-btn.ativo')?.dataset.dashboardAba === 'devolucoes';
}

function fecharTodosFiltrosDashboard(){
    painelFiltrosDashboard?.classList.remove('aberto');
    painelFiltrosCaixasDashboard?.classList.remove('aberto');
    painelFiltrosCaixasDashboard?.setAttribute('aria-hidden','true');
    btnFiltrosDashboard?.classList.remove('ativo');
    btnFiltrosDashboard?.setAttribute('aria-expanded','false');
}

function alternarFiltrosDashboard(){
    if(!btnFiltrosDashboard) return;
    if(dashboardEstaEmCaixas()){
        if(!painelFiltrosCaixasDashboard) return;
        const aberto = painelFiltrosCaixasDashboard.classList.toggle('aberto');
        painelFiltrosCaixasDashboard.setAttribute('aria-hidden', String(!aberto));
        painelFiltrosDashboard?.classList.remove('aberto');
        btnFiltrosDashboard.classList.toggle('ativo', aberto);
        btnFiltrosDashboard.setAttribute('aria-expanded', String(aberto));
    }else{
        if(!painelFiltrosDashboard) return;
        const aberto = painelFiltrosDashboard.classList.toggle('aberto');
        painelFiltrosCaixasDashboard?.classList.remove('aberto');
        painelFiltrosCaixasDashboard?.setAttribute('aria-hidden','true');
        btnFiltrosDashboard.classList.toggle('ativo', aberto);
        btnFiltrosDashboard.setAttribute('aria-expanded', String(aberto));
    }
}

btnFiltrosDashboard?.addEventListener('click', alternarFiltrosDashboard);
btnFecharFiltrosCaixas?.addEventListener('click', fecharTodosFiltrosDashboard);
[filtroCaixaFornecedor,filtroCaixaCategoria,filtroCaixaNumero].forEach(el=>el?.addEventListener('change',()=>carregarEstoqueCaixasDashboard()));
filtroCaixaProduto?.addEventListener('input',()=>{
    clearTimeout(carregamentoCaixasTimer);
    carregamentoCaixasTimer=setTimeout(()=>carregarEstoqueCaixasDashboard(),300);
});
btnLimparFiltrosCaixas?.addEventListener('click',()=>{
    if(filtroCaixaFornecedor) filtroCaixaFornecedor.value='Todos';
    if(filtroCaixaCategoria) filtroCaixaCategoria.value='Todos';
    if(filtroCaixaNumero) filtroCaixaNumero.value='Todos';
    if(filtroCaixaProduto) filtroCaixaProduto.value='';
    carregarEstoqueCaixasDashboard();
});

async function carregar(){
    const sessao=await validarSessaoDashboard();
    if(sessao===null) return;
    if(sessao===false) return;
    try{
        const r=await fetch(`${API}/api/historico-avarias`,{
            cache:'no-store',
            credentials:'include',
            headers:cabecalhosAutenticacaoDashboard()
        });
        if(r.status===401||r.status===403){
            sessionStorage.removeItem('usuarioLogado');
            window.location.href='login.html';
            return;
        }
        const texto=await r.text();
        let dados=null;
        try{ dados=JSON.parse(texto||'null'); }catch(_){ throw new Error(`A API do Dashboard não retornou JSON (HTTP ${r.status}).`); }
        if(!r.ok) throw new Error(dados?.detalhe || dados?.erro || `Erro ao carregar os dados do Dashboard (HTTP ${r.status}).`);
        if(!Array.isArray(dados)) throw new Error('A API do Dashboard não retornou uma lista de registros.');
        avarias=dados;
        opcoes();
        render();
        await carregarEstoqueCaixasDashboard();
        atualizarStatusTempoReal('conectado','Tempo real conectado');
    }catch(e){
        console.error('V20.6: erro ao carregar Dashboard:',e);
        try{
            const fallback=await fetch(`${API}/api/avarias`,{cache:'no-store',credentials:'include',headers:cabecalhosAutenticacaoDashboard()});
            const dadosFallback=await fallback.json();
            if(fallback.ok && Array.isArray(dadosFallback) && dadosFallback.length){
                avarias=dadosFallback;
                opcoes();
                render();
                atualizarStatusTempoReal('conectado','Dados carregados pela fonte de segurança');
                return;
            }
        }catch(fallbackErro){ console.error('V20.6: fallback Dashboard falhou:',fallbackErro); }
        atualizarStatusTempoReal('offline',e.message || 'Erro ao carregar');
    }
}

configurarAbasDashboard();
definirPeriodoPadrao();
[els.di,els.df,els.cat,els.setor,els.motivo,els.fornecedor,els.status].forEach(x=>x.addEventListener('change',render));els.produto.addEventListener('input',render);els.limpar.addEventListener('click',()=>{els.di.value='';els.df.value='';els.cat.value='Todos';els.setor.value='Todos';els.motivo.value='Todos';els.fornecedor.value='Todos';els.produto.value='';els.status.value='Todos';render();});document.querySelectorAll('.modo-grafico').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.modo-grafico').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');modoGrafico=b.dataset.modo;render();}));document.querySelectorAll('.modo-produto').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.modo-produto').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');modoProdutos=b.dataset.modo;render();}));document.querySelectorAll('.modo-caixa-produto').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.modo-caixa-produto').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');modoCaixaProdutos=b.dataset.modo;renderizarEstoqueCaixasDashboard();}));if(typeof EventSource!=='undefined'){
    const ev=new EventSource(`${API}/api/eventos`);
    ev.addEventListener('open',()=>atualizarStatusTempoReal('conectado','Tempo real conectado'));
    ev.addEventListener('conectado',()=>atualizarStatusTempoReal('conectado','Tempo real conectado'));
    ev.addEventListener('error',()=>atualizarStatusTempoReal('reconectando','Reconectando...'));
    ev.addEventListener('avarias-atualizadas',carregar);
    ev.addEventListener('historico-atualizado',carregar);
    ev.addEventListener('produtos-atualizados',carregar);
    ev.addEventListener('caixas-atualizadas',carregarEstoqueCaixasDashboard);
    ev.addEventListener('mapeamento-atualizado',carregarEstoqueCaixasDashboard);
} else { atualizarStatusTempoReal('offline','Tempo real indisponível'); }
carregar();
