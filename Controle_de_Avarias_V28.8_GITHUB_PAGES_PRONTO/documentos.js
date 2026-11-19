(() => {
    const sessao = (() => { try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); } catch { return null; } })();
    if (!sessao?.token) { window.location.href = "login.html"; return; }

    const API = window.CA_API_BASE || window.location.origin;
    const categorias = ["RH","Fiscal","Compras","Comercial","Financeiro","Operacional","TI","Outros"];
    const $ = id => document.getElementById(id);
    const modal = $("modalDocumento"), form = $("formDocumento"), arquivoInput = $("documentoArquivo");
    const lista = $("listaDocumentos"), vazio = $("estadoVazioDocumentos"), busca = $("buscaDocumentos");
    let documentos = [], arquivoSelecionado = null, editandoId = null, timerToast;

    function authHeaders(extra = {}) { return { "Authorization": `Bearer ${sessao.token}`, ...extra }; }
    function formatarData(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? "-" : new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short" }).format(d); }
    function tamanho(bytes) { if (!bytes) return "0 KB"; const u=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1); return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${u[i]}`; }
    function tipoArquivo(doc) { return doc.tipo === "pdf" ? "pdf" : "excel"; }
    function icone(doc) { return doc.tipo === "pdf" ? "📄" : "📊"; }
    function escapeHtml(v) { return String(v ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
    function toast(msg) { const el=$("toastDocumentos"); el.textContent=msg; el.classList.add("ativo"); clearTimeout(timerToast); timerToast=setTimeout(()=>el.classList.remove("ativo"),2800); }

    async function api(url, options={}) {
        const r = await fetch(`${API}${url}`, { cache:"no-store", credentials:"include", ...options, headers:authHeaders(options.headers || {}) });
        if (r.status === 401 || r.status === 403) { sessionStorage.removeItem("usuarioLogado"); window.location.href="login.html"; throw new Error("Sessão expirada."); }
        const ct = String(r.headers.get("content-type") || "").toLowerCase();
        const data = ct.includes("application/json") ? await r.json().catch(()=>({})) : null;
        if (!r.ok) throw new Error(data?.erro || `HTTP ${r.status}`);
        return data;
    }

    function abrirModal(doc=null) {
        editandoId=doc?.id||null; arquivoSelecionado=null;
        $("tituloModalDocumento").textContent=doc?"Editar documento":"Adicionar documento";
        $("documentoNome").value=doc?.nome||"";
        $("documentoCategoria").value=categorias.includes(doc?.categoria)?doc.categoria:"Outros";
        $("documentoDescricao").value=doc?.descricao||"";
        arquivoInput.value="";
        $("nomeArquivoDocumento").textContent=doc?"Clique para substituir o arquivo (opcional)":"Escolha um PDF ou Excel";
        $("arquivoAtualDocumento").textContent=doc?`Arquivo atual: ${doc.arquivoNome||"-"}`:"";
        $("btnSalvarDocumento").textContent=doc?"💾 Salvar alterações":"💾 Salvar documento";
        modal.classList.add("ativo"); modal.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden";
        setTimeout(()=>$("documentoNome").focus(),60);
    }
    function fecharModal(){modal.classList.remove("ativo");modal.setAttribute("aria-hidden","true");document.body.style.overflow="";}
    function validarArquivo(file){ if(!file)return false; const ok=/\.(pdf|xlsx|xls)$/i.test(file.name||""); if(!ok){toast("Aceitamos somente PDF, XLSX ou XLS.");return false;} return true; }

    function aplicarFiltros(){
        const q=busca.value.trim().toLowerCase(),cat=$("filtroCategoriaDocumentos").value,tipo=$("filtroTipoDocumentos").value,fav=$("filtroFavoritosDocumentos").checked;
        const filtrados=documentos.filter(d=>{const hay=`${d.nome} ${d.descricao||""} ${d.arquivoNome||""} ${d.categoria||""}`.toLowerCase();return(!q||hay.includes(q))&&(cat==="Todos"||d.categoria===cat)&&(tipo==="Todos"||tipoArquivo(d)===tipo)&&(!fav||d.favorito);}).sort((a,b)=>Number(b.favorito)-Number(a.favorito)||new Date(b.atualizadoEm)-new Date(a.atualizadoEm));
        renderizar(filtrados);
    }
    function renderizar(items){
        $("contadorDocumentos").textContent=items.length;
        const favs=documentos.filter(d=>d.favorito).length; $("contadorFavoritos").textContent=`${favs} favorito${favs===1?"":"s"}`;
        vazio.classList.toggle("oculto",items.length>0);
        lista.innerHTML=items.map(doc=>`<article class="documento-card"><div class="documento-icone">${icone(doc)}</div><div class="documento-conteudo"><div class="documento-titulo"><strong title="${escapeHtml(doc.nome)}">${escapeHtml(doc.nome)}</strong><span class="badge-tipo">${doc.tipo.toUpperCase()}</span><span class="badge-categoria">${escapeHtml(doc.categoria)}</span></div><div class="documento-meta">${escapeHtml(doc.arquivoNome)} · ${tamanho(doc.tamanho)} · ${formatarData(doc.atualizadoEm)}</div>${doc.descricao?`<p class="documento-descricao">${escapeHtml(doc.descricao)}</p>`:""}</div><div class="documento-acoes"><button class="btn-icone-documento btn-favorito ${doc.favorito?"ativo":""}" type="button" data-favorito="${escapeHtml(doc.id)}" title="${doc.favorito?"Remover dos favoritos":"Adicionar aos favoritos"}">${doc.favorito?"★":"☆"}</button><button class="btn-icone-documento" type="button" data-abrir="${escapeHtml(doc.id)}" title="Abrir documento">↗</button><button class="btn-icone-documento" type="button" data-editar="${escapeHtml(doc.id)}" title="Editar">✏️</button><button class="btn-icone-documento excluir" type="button" data-excluir="${escapeHtml(doc.id)}" title="Excluir">🗑</button></div></article>`).join("");
    }

    async function carregar(){
        try{
            const p=new URLSearchParams(); const q=busca.value.trim(),cat=$("filtroCategoriaDocumentos").value,tipo=$("filtroTipoDocumentos").value,fav=$("filtroFavoritosDocumentos").checked;
            if(q)p.set("busca",q);if(cat!=="Todos")p.set("categoria",cat);if(tipo!=="Todos")p.set("tipo",tipo);if(fav)p.set("favoritos","true");
            documentos=await api(`/api/documentos?${p}`)||[];aplicarFiltros();
        }catch(e){console.error(e);toast(e.message||"Erro ao carregar documentos.");}
    }

    async function abrirDocumento(doc){
        if(!doc)return;
        try{
            const r=await fetch(`${API}/api/documentos/${encodeURIComponent(doc.id)}/arquivo`,{cache:"no-store",credentials:"include",headers:authHeaders()});
            if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.erro||`HTTP ${r.status}`);}
            const blob=await r.blob(),url=URL.createObjectURL(blob);
            if(doc.tipo==="pdf"){
                const win=window.open(url,"_blank"); if(!win)toast("O navegador bloqueou a nova aba. Permita pop-ups para abrir o PDF."); setTimeout(()=>URL.revokeObjectURL(url),60000);
            }else{
                const a=document.createElement("a");a.href=url;a.download=doc.arquivoNome||doc.nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
            }
        }catch(e){toast(e.message||"Não foi possível abrir o documento.");}
    }

    form.addEventListener("submit",async e=>{
        e.preventDefault();
        const nome=$("documentoNome").value.trim(),categoria=$("documentoCategoria").value,descricao=$("documentoDescricao").value.trim();
        if(!nome)return toast("Informe o nome do documento.");
        if(!editandoId&&!arquivoSelecionado)return toast("Selecione um PDF ou Excel.");
        if(arquivoSelecionado&&!validarArquivo(arquivoSelecionado))return;
        try{
            const fd=new FormData();fd.append("nome",nome);fd.append("categoria",categoria);fd.append("descricao",descricao);if(arquivoSelecionado)fd.append("arquivo",arquivoSelecionado,arquivoSelecionado.name);
            const doc=await api(editandoId?`/api/documentos/${encodeURIComponent(editandoId)}`:"/api/documentos",{method:editandoId?"PUT":"POST",body:fd});
            fecharModal();toast(editandoId?"Documento atualizado em todos os PCs.":"Documento salvo no arquivo central.");await carregar();
        }catch(e){console.error(e);toast(e.message||"Não foi possível salvar o documento.");}
    });

    arquivoInput.addEventListener("change",()=>{const f=arquivoInput.files?.[0];if(!f||!validarArquivo(f)){arquivoInput.value="";return;}arquivoSelecionado=f;$("nomeArquivoDocumento").textContent=f.name;$("arquivoAtualDocumento").textContent=`Novo arquivo: ${f.name} · ${tamanho(f.size)}`;});
    const drop=$("dropDocumento");["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("dragover")}));["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("dragover")}));drop.addEventListener("drop",e=>{const f=e.dataTransfer.files?.[0];if(!f||!validarArquivo(f))return;arquivoSelecionado=f;$("nomeArquivoDocumento").textContent=f.name;$("arquivoAtualDocumento").textContent=`Novo arquivo: ${f.name} · ${tamanho(f.size)}`;});

    lista.addEventListener("click",async e=>{
        const fav=e.target.closest("[data-favorito]"),abrir=e.target.closest("[data-abrir]"),editar=e.target.closest("[data-editar]"),excluir=e.target.closest("[data-excluir]");
        try{
            if(fav){const doc=documentos.find(d=>String(d.id)===String(fav.dataset.favorito));if(!doc)return;await api(`/api/documentos/${encodeURIComponent(doc.id)}/favorito`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({favorito:!doc.favorito})});await carregar();}
            else if(abrir){const doc=documentos.find(d=>String(d.id)===String(abrir.dataset.abrir));await abrirDocumento(doc);}
            else if(editar){const doc=documentos.find(d=>String(d.id)===String(editar.dataset.editar));if(doc)abrirModal(doc);}
            else if(excluir){const doc=documentos.find(d=>String(d.id)===String(excluir.dataset.excluir));if(!doc)return;if(!confirm(`Excluir o documento "${doc.nome}"?`))return;await api(`/api/documentos/${encodeURIComponent(doc.id)}`,{method:"DELETE"});toast("Documento excluído de todos os PCs.");await carregar();}
        }catch(err){console.error(err);toast(err.message||"Não foi possível concluir a operação.");}
    });

    $("btnAdicionarDocumento").addEventListener("click",()=>abrirModal());$("btnCancelarDocumento").addEventListener("click",fecharModal);$("btnFecharModalDocumento").addEventListener("click",fecharModal);modal.addEventListener("click",e=>{if(e.target.dataset.fecharDocumento)fecharModal();});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("ativo"))fecharModal();});busca.addEventListener("input",carregar);$("filtroCategoriaDocumentos").addEventListener("change",carregar);$("filtroTipoDocumentos").addEventListener("change",carregar);$("filtroFavoritosDocumentos").addEventListener("change",carregar);
    $("btnSair").addEventListener("click",async()=>{if(!confirm("Deseja sair do sistema?"))return;try{await api("/api/logout",{method:"POST"});}catch{}sessionStorage.removeItem("usuarioLogado");window.location.href="login.html";});

    if(typeof EventSource!=="undefined"){
        try{const ev=new EventSource(`${API}/api/eventos`);ev.addEventListener("documentos-atualizados",()=>carregar());ev.addEventListener("error",()=>{});}catch(e){console.warn(e);}
    }
    carregar();
})();
