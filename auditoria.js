const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraSistema === "function") return window.formatarDataHoraSistema(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.3 - base consolidada, sessão centralizada e histórico corrigido */
const sessao = sessionStorage.getItem("usuarioLogado");
let dadosSessao = null;
try { dadosSessao = JSON.parse(sessao || "null"); } catch {}
if (!dadosSessao || dadosSessao.perfil !== "admin" || !dadosSessao.token) {
    window.location.href = "sistema.html";
    throw new Error("Acesso administrativo necessário.");
}

const API = (() => {
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    const porta = window.location.port;

    // Servido pelo próprio Node: usa a origem atual.
    if ((protocolo === "http:" || protocolo === "https:") && porta === "3000") {
        return window.location.origin;
    }

    // Desenvolvimento local em Live Server/outro servidor: usa o mesmo host
    // na porta do backend, evitando chamadas para a porta do frontend.
    if ((protocolo === "http:" || protocolo === "https:") && hostname) {
        return `${protocolo}//${hostname}:3000`;
    }

    // Fallback para abertura direta do HTML.
    return "http://localhost:3000";
})();

const tabela = document.getElementById("tabelaAuditoria");
const total = document.getElementById("totalAuditoria");
const toast = document.getElementById("toast");

function esc(v){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function mostrarToast(msg){toast.textContent=msg;toast.classList.add("ativo");setTimeout(()=>toast.classList.remove("ativo"),2500);}
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
function rotuloCampo(chave){
    return ROTULOS[chave] || String(chave||"").replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());
}
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
        if(valor && typeof valor === "object" && !Array.isArray(valor)){
            achatar(valor, caminho, saida);
        }else{
            saida[caminho] = valor;
        }
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
        "reaberto":"Reaberto", "reaberta":"Reaberto",
        "copiado":"Copiado", "copiadas":"Copiado",
        "importacao":"Importado"
    };
    return `<span class="resultado-palavra">${esc(mapa[chave] || "Alterado")}</span>`;
}
async function carregar(){
    try{
        const r=await fetch(`${API}/api/auditoria?limite=300`,{headers:{Authorization:`Bearer ${dadosSessao.token}`},cache:"no-store"});
        const dados=await r.json();
        if(!r.ok) throw new Error(dados.erro||"Erro ao carregar auditoria.");
        total.textContent=dados.length;
        tabela.innerHTML=dados.length?dados.map(item=>`<tr>
            <td>${formatarDataHoraSistema(item.criadoEm)}</td>
            <td>${esc(item.usuario)}</td>
            <td><span class="badge">${esc(item.acao)}</span></td>
            <td>${esc(item.entidade)}</td>
            <td>${esc(item.registroId||"—")}</td>
            <td>${esc(item.detalhes||"—")}</td>
            <td>${resultadoAuditoria(item.acao)}</td>
        </tr>`).join(""):"<tr><td colspan=\"7\" class=\"vazio\">Nenhuma alteração registrada.</td></tr>";
    }catch(e){
        console.error("Erro ao carregar auditoria:", e);
        const mensagem = e instanceof TypeError
            ? "Não foi possível conectar ao servidor de auditoria. Verifique se o server.js está rodando e tente atualizar a página."
            : e.message;
        tabela.innerHTML=`<tr><td colspan="7" class="vazio">${esc(mensagem)}</td></tr>`;
        mostrarToast(mensagem);
    }
}
document.getElementById("btnAtualizar").addEventListener("click",carregar);
document.getElementById("btnSair").addEventListener("click",()=>{fetch("/api/logout",{method:"POST",credentials:"include",keepalive:true}).catch(()=>{});sessionStorage.removeItem("usuarioLogado");location.href="login.html";});
if(typeof EventSource!=="undefined"){
    const ev=new EventSource(`${API}/api/eventos`);
    ["historico-atualizado","avarias-atualizadas","produtos-atualizados"].forEach(t=>ev.addEventListener(t,carregar));
}
carregar();
