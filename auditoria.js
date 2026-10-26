/* BUILD V25 - auditoria com filtros, paginação, seleção e exclusão administrativa */
const sessao = sessionStorage.getItem("usuarioLogado");
let dadosSessao = null;
try { dadosSessao = JSON.parse(sessao || "null"); } catch {}
if (!dadosSessao || dadosSessao.perfil !== "admin" || !dadosSessao.token) {
    window.location.href = "sistema.html";
    throw new Error("Acesso administrativo necessário.");
}

const API = window.CA_API_BASE || (window.CA_LOCAL_MODE ? "" : (window.location.origin || "http://localhost:3000"));

const tabela = document.getElementById("tabelaAuditoria");
const total = document.getElementById("totalAuditoria");
const toast = document.getElementById("toast");
const busca = document.getElementById("buscaAuditoria");
const filtroAcao = document.getElementById("filtroAcaoAuditoria");
const filtroEntidade = document.getElementById("filtroEntidadeAuditoria");
const filtroUsuario = document.getElementById("filtroUsuarioAuditoria");
const btnLimparFiltros = document.getElementById("btnLimparFiltrosAuditoria");
const paginacao = document.getElementById("paginacaoAuditoria");
const btnSelecionarTodos = document.getElementById("btnSelecionarTodosAuditoria");
const btnExcluirSelecionados = document.getElementById("btnExcluirSelecionadosAuditoria");
const checkTodos = document.getElementById("checkTodosAuditoria");

const TAMANHOS = [10, 25, 50, 100];
let registros = [];
let filtrados = [];
let pagina = 1;
let tamanhoPagina = 25;
let ordenacao = { campo: "data", direcao: "desc" };
const selecionados = new Set();

function esc(v){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function mostrarToast(msg){toast.textContent=msg;toast.classList.add("ativo");setTimeout(()=>toast.classList.remove("ativo"),2500);}
function formatarDataHoraSistema(valor){
    if (typeof window.formatarDataHoraManaira === "function") return window.formatarDataHoraManaira(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short"}).format(d);
}

const CAMPOS_IGNORADOS = new Set([
    "id","criado_em","atualizado_em","criadoEm","atualizadoEm","concluida_em","historico_criado_em",
    "usuario_id","criado_por","criado_por_id","tarefa_id","tarefaOriginalId","caixa_id","produto_id"
]);
const ROTULOS = {
    codigo:"Código", produto:"Produto", descricao:"Descrição", categoria:"Categoria", fornecedor:"Fornecedor",
    quantidade:"Quantidade", valor_unitario:"Valor de custo", valorUnitario:"Valor de custo", motivo:"Motivo",
    setor_origem:"Setor de origem", setor:"Setor", tipo:"Motivo", status:"Status", concluida:"Status",
    titulo:"Tarefa", observacao:"Observação", usuario_nome:"Usuário", usuarioNome:"Usuário", data_tarefa:"Data da tarefa",
    numero:"Caixa", local:"Localização", responsavel:"Fornecedor", ativo:"Situação", perfil:"Perfil"
};
function rotuloCampo(chave){return ROTULOS[chave] || String(chave||"").replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());}
function normalizarValor(valor){
    if(valor === null || valor === undefined || valor === "") return "—";
    if(typeof valor === "boolean") return valor ? "Sim" : "Não";
    if(typeof valor === "number") return String(valor).replace(".",",");
    if(typeof valor === "object") return Array.isArray(valor) ? valor.join(", ") : "Alterado";
    return String(valor);
}
function achatar(obj, prefix="", saida={}){
    if(obj == null || typeof obj !== "object") return saida;
    for(const [chave, valor] of Object.entries(obj)){
        if(CAMPOS_IGNORADOS.has(chave)) continue;
        const caminho = prefix ? `${prefix}.${chave}` : chave;
        if(valor && typeof valor === "object" && !Array.isArray(valor)) achatar(valor, caminho, saida);
        else saida[caminho] = valor;
    }
    return saida;
}
function resultadoAuditoria(acao){
    const chave = String(acao || "").toLowerCase().trim();
    const mapa = {
        "criado":"Criado", "criada":"Criado", "caixa-criada":"Criado",
        "editado":"Alterado", "editada":"Alterado", "atualizado":"Alterado",
        "categoria-alterada":"Alterado", "registro-baixa-editado":"Alterado",
        "caixa-produto-adicionado":"Adicionado", "produto-adicionado":"Adicionado",
        "caixa-produto-removido":"Excluído", "produto-removido":"Excluído",
        "produtos-removidos":"Excluído", "excluido":"Excluído", "excluida":"Excluído",
        "caixa-excluida":"Excluído", "exclusao-quadrado":"Excluído",
        "concluido":"Concluído", "concluidas-em-lote":"Concluído",
        "reaberto":"Reaberto", "reaberta":"Reaberto", "copiado":"Copiado", "copiadas":"Copiado",
        "importacao":"Importado"
    };
    return `<span class="resultado-palavra">${esc(mapa[chave] || "Alterado")}</span>`;
}

function textoPesquisa(item){
    return [item.acao,item.entidade,item.registroId,item.usuario,item.detalhes,JSON.stringify(item.antes||{}),JSON.stringify(item.depois||{})]
        .join(" ").toLowerCase();
}
function aplicarFiltros(){
    const termo = String(busca?.value || "").trim().toLowerCase();
    const acao = String(filtroAcao?.value || "");
    const entidade = String(filtroEntidade?.value || "");
    const usuario = String(filtroUsuario?.value || "");
    filtrados = registros.filter(item => {
        if (termo && !textoPesquisa(item).includes(termo)) return false;
        if (acao && String(item.acao || "") !== acao) return false;
        if (entidade && String(item.entidade || "") !== entidade) return false;
        if (usuario && String(item.usuario || "") !== usuario) return false;
        return true;
    });
}
function comparar(a,b,campo,direcao){
    let va, vb;
    if(campo === "data"){
        va = new Date(a.criadoEm || 0).getTime(); vb = new Date(b.criadoEm || 0).getTime();
    } else {
        const chave = campo === "usuario" ? "usuario" : campo;
        va = String(a[chave] || ""); vb = String(b[chave] || "");
        const c = va.localeCompare(vb,"pt-BR",{numeric:true,sensitivity:"base"});
        return direcao === "asc" ? c : -c;
    }
    if(va === vb) return 0;
    const c = va < vb ? -1 : 1;
    return direcao === "asc" ? c : -c;
}
function ordenar(){filtrados.sort((a,b)=>comparar(a,b,ordenacao.campo,ordenacao.direcao));}
function popularFiltros(){
    const preencher=(el,valores,rotulo)=>{
        if(!el) return;
        const atual=el.value;
        el.innerHTML=`<option value="">${rotulo}</option>`+Array.from(new Set(valores.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),"pt-BR",{sensitivity:"base"})).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
        if(valores.includes(atual)) el.value=atual;
    };
    preencher(filtroAcao,registros.map(x=>x.acao),"Todas");
    preencher(filtroEntidade,registros.map(x=>x.entidade),"Todas");
    preencher(filtroUsuario,registros.map(x=>x.usuario),"Todos");
}
function renderizarPaginacao(){
    if(!paginacao || !filtrados.length){if(paginacao)paginacao.innerHTML="";return;}
    const totalPaginas=Math.max(1,Math.ceil(filtrados.length/tamanhoPagina));
    pagina=Math.min(Math.max(1,pagina),totalPaginas);
    const inicio=(pagina-1)*tamanhoPagina+1;
    const fim=Math.min(pagina*tamanhoPagina,filtrados.length);
    const botoes=[];
    const add=(p,t,cl="")=>botoes.push(`<button type="button" class="pagina-btn ${cl}" data-pagina="${p}" ${p===pagina?'aria-current="page"':''}>${t}</button>`);
    add(1,"«",pagina===1?"desabilitado":""); add(Math.max(1,pagina-1),"‹",pagina===1?"desabilitado":"");
    let paginas=[];
    if(totalPaginas<=7) paginas=Array.from({length:totalPaginas},(_,i)=>i+1);
    else if(pagina<=4) paginas=[1,2,3,4,5,"…",totalPaginas];
    else if(pagina>=totalPaginas-3) paginas=[1,"…",totalPaginas-4,totalPaginas-3,totalPaginas-2,totalPaginas-1,totalPaginas];
    else paginas=[1,"…",pagina-1,pagina,pagina+1,"…",totalPaginas];
    paginas.forEach(p=>p==="…"?botoes.push('<span class="pagina-reticencias">…</span>'):add(p,String(p),p===pagina?"ativo":""));
    add(Math.min(totalPaginas,pagina+1),"›",pagina===totalPaginas?"desabilitado":""); add(totalPaginas,"»",pagina===totalPaginas?"desabilitado":"");
    paginacao.innerHTML=`<div class="paginacao-info">Mostrando <strong>${inicio}–${fim}</strong> de <strong>${filtrados.length}</strong></div><div class="paginacao-controles"><label>Por página <select class="paginacao-tamanho">${TAMANHOS.map(n=>`<option value="${n}" ${n===tamanhoPagina?"selected":""}>${n}</option>`).join("")}</select></label><div class="paginacao-botoes">${botoes.join("")}</div></div>`;
    paginacao.querySelector(".paginacao-tamanho")?.addEventListener("change",e=>{tamanhoPagina=Number(e.target.value)||25;pagina=1;renderizar();});
    paginacao.querySelectorAll(".pagina-btn").forEach(btn=>btn.addEventListener("click",()=>{if(btn.classList.contains("desabilitado"))return;pagina=Number(btn.dataset.pagina)||1;renderizar();}));
}
function renderizar(){
    aplicarFiltros();
    ordenar();
    total.textContent=filtrados.length;
    const totalPaginas=Math.max(1,Math.ceil(filtrados.length/tamanhoPagina));
    pagina=Math.min(Math.max(1,pagina),totalPaginas);
    const inicio=(pagina-1)*tamanhoPagina;
    const paginaAtual=filtrados.slice(inicio,inicio+tamanhoPagina);
    tabela.innerHTML=paginaAtual.length?paginaAtual.map(item=>`<tr>
        <td class="td-selecao"><input class="checkbox-auditoria checkbox-registro" type="checkbox" data-id="${esc(item.id)}" ${selecionados.has(String(item.id))?"checked":""} aria-label="Selecionar registro ${esc(item.id)}"></td>
        <td>${formatarDataHoraSistema(item.criadoEm)}</td>
        <td>${esc(item.usuario)}</td>
        <td><span class="badge">${esc(item.acao)}</span></td>
        <td>${esc(item.entidade)}</td>
        <td>${esc(item.registroId||"—")}</td>
        <td>${esc(item.detalhes||"—")}</td>
        <td>${resultadoAuditoria(item.acao)}</td>
    </tr>`).join(""):"<tr><td colspan=\"8\" class=\"vazio\">Nenhuma alteração encontrada com os filtros atuais.</td></tr>";
    tabela.querySelectorAll(".checkbox-registro").forEach(check=>check.addEventListener("change",()=>{
        const id=String(check.dataset.id||"");
        if(check.checked) selecionados.add(id); else selecionados.delete(id);
        atualizarControlesSelecao();
    }));
    atualizarControlesSelecao(paginaAtual);
    const camposOrdenacao = ["selecao","data","usuario","acao","entidade","registro","detalhes","resultado"];
    document.querySelectorAll("table thead th").forEach((th,index)=>{
        const campo = camposOrdenacao[index];
        const ativo = campo && campo === ordenacao.campo;
        th.classList.toggle("ordenado", Boolean(ativo));
        th.setAttribute("aria-sort", ativo ? (ordenacao.direcao === "asc" ? "ascending" : "descending") : "none");
    });
    renderizarPaginacao();
}
async function carregar(){
    try{
        const r=await fetch(`${API}/api/auditoria?limite=2000`,{headers:{Authorization:`Bearer ${dadosSessao.token}`},credentials:"include",cache:"no-store"});
        const dados=await r.json();
        if(!r.ok) throw new Error(dados.erro||"Erro ao carregar auditoria.");
        registros=Array.isArray(dados)?dados:[];
        popularFiltros();
        pagina=1;
        renderizar();
    }catch(e){
        console.error("Erro ao carregar auditoria:",e);
        const mensagem=e instanceof TypeError?"Não foi possível conectar ao servidor de auditoria. Verifique se o server.js está rodando e tente atualizar a página.":e.message;
        tabela.innerHTML=`<tr><td colspan="8" class="vazio">${esc(mensagem)}</td></tr>`;
        mostrarToast(mensagem);
    }
}

[busca,filtroAcao,filtroEntidade,filtroUsuario].forEach(el=>el?.addEventListener("input",()=>{pagina=1;renderizar();}));
[filtroAcao,filtroEntidade,filtroUsuario].forEach(el=>el?.addEventListener("change",()=>{pagina=1;renderizar();}));
btnLimparFiltros?.addEventListener("click",()=>{
    busca.value=""; filtroAcao.value=""; filtroEntidade.value=""; filtroUsuario.value=""; pagina=1; renderizar();
});

document.querySelectorAll("table thead th").forEach((th,index)=>{
    const campos=["selecao","data","usuario","acao","entidade","registro","detalhes","resultado"];
    const campo=campos[index];
    if(!campo || campo==="resultado" || campo==="selecao") return;
    th.classList.add("th-ordenavel");
    th.addEventListener("click",()=>{
        if(ordenacao.campo===campo) ordenacao.direcao=ordenacao.direcao==="asc"?"desc":"asc";
        else {ordenacao.campo=campo;ordenacao.direcao=campo==="data"?"desc":"asc";}
        pagina=1; renderizar();
    });
});

function atualizarControlesSelecao(paginaAtual=[]) {
    const quantidade=selecionados.size;
    if(btnExcluirSelecionados){
        btnExcluirSelecionados.disabled=quantidade===0;
        btnExcluirSelecionados.textContent=quantidade?`🗑 Excluir selecionados (${quantidade})`:"🗑 Excluir selecionados";
    }
    if(btnSelecionarTodos) btnSelecionarTodos.textContent=filtrados.length && filtrados.every(item=>selecionados.has(String(item.id)))?"☐ Limpar seleção":"☑ Selecionar todos";
    if(checkTodos){
        const idsPagina=paginaAtual.map(item=>String(item.id));
        const todosPagina=idsPagina.length>0 && idsPagina.every(id=>selecionados.has(id));
        checkTodos.checked=todosPagina;
        checkTodos.indeterminate=!todosPagina && idsPagina.some(id=>selecionados.has(id));
    }
}

checkTodos?.addEventListener("change",()=>{
    const totalPaginas=Math.max(1,Math.ceil(filtrados.length/tamanhoPagina));
    const inicio=(pagina-1)*tamanhoPagina;
    const paginaAtual=filtrados.slice(inicio,inicio+tamanhoPagina);
    paginaAtual.forEach(item=>{
        const id=String(item.id);
        if(checkTodos.checked) selecionados.add(id); else selecionados.delete(id);
    });
    renderizar();
});

btnSelecionarTodos?.addEventListener("click",()=>{
    const todos=filtrados.length>0 && filtrados.every(item=>selecionados.has(String(item.id)));
    filtrados.forEach(item=>{
        const id=String(item.id);
        if(todos) selecionados.delete(id); else selecionados.add(id);
    });
    renderizar();
});

btnExcluirSelecionados?.addEventListener("click",async()=>{
    const ids=Array.from(selecionados);
    if(!ids.length) return;
    const confirmado=window.confirm(`Deseja excluir ${ids.length} registro${ids.length===1?"":"s"} do histórico de alterações?\n\nEssa ação não pode ser desfeita.`);
    if(!confirmado) return;
    btnExcluirSelecionados.disabled=true;
    try{
        const r=await fetch(`${API}/api/auditoria`,{
            method:"DELETE",
            headers:{"Content-Type":"application/json",Authorization:`Bearer ${dadosSessao.token}`},
            credentials:"include",
            body:JSON.stringify({ids})
        });
        const dados=await r.json();
        if(!r.ok) throw new Error(dados.erro||"Erro ao excluir os registros selecionados.");
        ids.forEach(id=>selecionados.delete(String(id)));
        mostrarToast(`${dados.excluidos||ids.length} registro${(dados.excluidos||ids.length)===1?"":"s"} excluído${(dados.excluidos||ids.length)===1?"":"s"}.`);
        await carregar();
    }catch(e){
        console.error("Erro ao excluir auditoria:",e);
        mostrarToast(e.message||"Erro ao excluir os registros selecionados.");
        atualizarControlesSelecao();
    }
});

document.getElementById("btnAtualizar").addEventListener("click",carregar);
document.getElementById("btnSair").addEventListener("click",()=>{fetch(`${API}/api/logout`,{method:"POST",credentials:"include",keepalive:true}).catch(()=>{});sessionStorage.removeItem("usuarioLogado");location.href="login.html";});
if(typeof EventSource!=="undefined"){
    const ev=new EventSource(`${API}/api/eventos`);
    ["historico-atualizado","avarias-atualizadas","produtos-atualizados"].forEach(t=>ev.addEventListener(t,carregar));
}
carregar();
