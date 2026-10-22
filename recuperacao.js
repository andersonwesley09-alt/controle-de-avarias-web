/* =========================================================
   CONTROLE DE AVARIAS - V25.1
   Recuperações e Doações: documentos numerados, múltiplos lançamentos,
   fechamento, reimpressão, histórico por documento e auditoria.
========================================================= */
const sessaoRaw=sessionStorage.getItem("usuarioLogado");
if(!sessaoRaw) window.location.href="login.html";
let sessao=null;try{sessao=JSON.parse(sessaoRaw||"null");}catch{sessao=null;}
if(!sessao) window.location.href="login.html";

const API=(()=>{const c=(()=>{try{const v=localStorage.getItem("controleAvariasServidor");if(!v)return"";const u=new URL(v);return/^https?:$/.test(u.protocol)&&!/\.github\.io$/i.test(u.hostname)&&!/\.pages\.dev$/i.test(u.hostname)?u.origin:""}catch{return""}})(),p=window.location.protocol,h=window.location.hostname,o=window.location.origin,port=window.location.port;if((p==="http:"||p==="https:")&&port==="3000")return o;if(/\.github\.io$/i.test(h)||/\.pages\.dev$/i.test(h))return c||"http://localhost:3000";if(c)return c;if((p==="http:"||p==="https:")&&h&&h!=="localhost"&&h!=="127.0.0.1")return `${p}//${h}:3000`;return o&&o!=="null"?o:"http://localhost:3000"})();
const authHeaders=()=>sessao?.token?{Authorization:`Bearer ${sessao.token}`}:{};
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const numero=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const moeda=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(numero(v));
const quantidadeFormatada=v=>numero(v).toLocaleString("pt-BR",{maximumFractionDigits:3});
const dataHora=v=>{if(!v)return"-";if(typeof window.formatarDataHoraSistema==="function")return window.formatarDataHoraSistema(v);const d=new Date(v);return Number.isNaN(d.getTime())?"-":new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(d);};
const dataSomente=v=>{if(!v)return"-";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString("pt-BR");};
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),3200);}

async function requisicao(url,options={}){
    const resposta=await fetch(`${API}${url}`,{...options,headers:{...authHeaders(),...(options.headers||{})},credentials:"include",cache:"no-store"});
    if(resposta.status===401){sessionStorage.removeItem("usuarioLogado");window.location.href="login.html";throw new Error("Sessão expirada.");}
    const tipo=String(resposta.headers.get("content-type")||"");
    if(tipo.includes("application/json")){const dados=await resposta.json();if(!resposta.ok)throw new Error(dados.erro||"Erro na operação.");return dados;}
    if(!resposta.ok)throw new Error(`Erro HTTP ${resposta.status}`);return resposta;
}

function alternarAba(nome){
    document.querySelectorAll(".aba-btn").forEach(btn=>btn.classList.toggle("ativo",btn.dataset.aba===nome));
    $("abaRecuperacao")?.classList.toggle("ativo",nome==="recuperacao");$("abaDoacoes")?.classList.toggle("ativo",nome==="doacoes");
    if(nome==="doacoes"){carregarDoacoes();carregarProdutosLancadosDoacao();}else{carregarRecuperacoes();carregarProdutosLancadosRecuperacao();}
}
document.querySelectorAll(".aba-btn").forEach(btn=>btn.addEventListener("click",()=>alternarAba(btn.dataset.aba)));

/* =========================================================
   MODAL DE RECUPERAÇÃO
========================================================= */
const modalCadastroRecuperacao=$("modalCadastroRecuperacao");
let documentoRecuperacaoAtual=null;
async function prepararDocumentoRecuperacao(){const r=await requisicao("/api/recuperacoes/documento/abrir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:hoje()})});documentoRecuperacaoAtual=r.documento||null;return documentoRecuperacaoAtual;}
async function abrirCadastroRecuperacao(){if(!modalCadastroRecuperacao)return;modalCadastroRecuperacao.classList.add("ativo");modalCadastroRecuperacao.setAttribute("aria-hidden","false");document.body.classList.add("modal-aberto");limparFormularioRecuperacao();try{await prepararDocumentoRecuperacao();await carregarProdutosLancadosRecuperacao();await atualizarStatusDocumentoRecuperacao();}catch(e){toast(e.message||"Não foi possível abrir o documento de recuperação.");}setTimeout(()=>$("codigoRecuperacao")?.focus(),60);}
function documentoComItensAberto(containerId,doc){return doc?.status==="ABERTO" && !!$(containerId)?.querySelector(".produto-lancado-item");}
function confirmarFechamentoDocumento(containerId,doc){if(!documentoComItensAberto(containerId,doc))return true;return confirm(`O documento ${documentoLabel(doc,doc.tipo)} está aberto e possui produtos lançados. Os itens serão mantidos. Deseja fechar a janela?`);}
function fecharCadastroRecuperacao(){if(!modalCadastroRecuperacao)return;if(!confirmarFechamentoDocumento("listaProdutosRecuperacao",documentoRecuperacaoAtual))return;modalCadastroRecuperacao.classList.remove("ativo");modalCadastroRecuperacao.setAttribute("aria-hidden","true");document.body.classList.remove("modal-aberto");}
$("btnAbrirCadastroRecuperacao")?.addEventListener("click",abrirCadastroRecuperacao);
$("btnFecharCadastroRecuperacao")?.addEventListener("click",fecharCadastroRecuperacao);
modalCadastroRecuperacao?.querySelectorAll('[data-fechar-modal-recuperacao="true"]').forEach(el=>el.addEventListener("click",fecharCadastroRecuperacao));

$("btnSair")?.addEventListener("click",async()=>{if(!confirm("Deseja sair do sistema?"))return;try{await fetch(`${API}/api/logout`,{method:"POST",credentials:"include",headers:authHeaders()});}catch{}sessionStorage.removeItem("usuarioLogado");window.location.href="login.html";});

/* =========================================================
   PRODUTO
========================================================= */
async function buscarProduto(codigo){return requisicao(`/api/produtos/${encodeURIComponent(codigo)}`);}
function mostrarProduto(prefix,produto){
    $("produtoInfo"+prefix)?.classList.remove("oculto");
    $("codigoProdutoInfo"+prefix).textContent=produto.codigo||"-";
    $("nomeProduto"+prefix).textContent=produto.produto||"-";
    $("nomeFornecedor"+prefix).textContent=produto.fornecedor||"-";
    $("codigoFornecedorInfo"+prefix).textContent=produto.codigoFornecedor||"-";
    $("categoriaProdutoInfo"+prefix).textContent=produto.categoria||"-";
    $("valorProduto"+prefix).textContent=moeda(produto.valorCusto);
}
function limparProduto(prefix){$("produtoInfo"+prefix)?.classList.add("oculto");$("produtoNaoEncontrado"+prefix)?.classList.add("oculto");$("produtoSemCusto"+prefix)?.classList.add("oculto");}
function documentoLabel(doc,tipo){return doc?.documento||`${tipo==="DOACAO"?"DOA":"REC"}-${String(doc?.numero||0).padStart(4,"0")}`;}
function statusTexto(status){return status==="FINALIZADO"?"Finalizado":"Aberto";}
function statusClasse(status){return status==="FINALIZADO"?"status-finalizado":"status-aberto";}

/* =========================================================
   RECUPERAÇÃO
========================================================= */
let produtoRecuperacao=null, edicaoRecuperacaoId=null;
const codigoRecuperacao=$("codigoRecuperacao"),quantidadeRecuperacao=$("quantidadeRecuperacao");
const btnSalvarEGerarDocumentoRecuperacao=$("btnSalvarEGerarDocumentoRecuperacao");
async function consultarProdutoRecuperacao(){
    const codigo=codigoRecuperacao.value.trim();if(!codigo)return toast("Digite ou bipe o código.");
    limparProduto("Recuperacao");produtoRecuperacao=null;quantidadeRecuperacao.disabled=true;if(btnSalvarEGerarDocumentoRecuperacao)btnSalvarEGerarDocumentoRecuperacao.disabled=true;
    try{const produto=await buscarProduto(codigo);if(!numero(produto.valorCusto)){$("produtoSemCustoRecuperacao")?.classList.remove("oculto");return toast("Produto sem custo válido. O lançamento está bloqueado.");}produtoRecuperacao=produto;mostrarProduto("Recuperacao",produto);quantidadeRecuperacao.disabled=false;quantidadeRecuperacao.focus();atualizarPreviewRecuperacao();}
    catch(e){$("produtoNaoEncontradoRecuperacao")?.classList.remove("oculto");$("mensagemProdutoNaoEncontradoRecuperacao").textContent=`Código consultado: ${codigo}. Verifique se ele está na base de produtos.`;toast(e.message||"Produto não encontrado.");codigoRecuperacao.select();}
}
function atualizarPreviewRecuperacao(){const qtd=numero(quantidadeRecuperacao.value),custo=numero(produtoRecuperacao?.valorCusto);$("valorTotalRecuperacao").textContent=moeda(qtd*custo);$("valorRecuperadoPreview").textContent=moeda(qtd*custo);if(btnSalvarEGerarDocumentoRecuperacao)btnSalvarEGerarDocumentoRecuperacao.disabled=!produtoRecuperacao||qtd<=0;}
codigoRecuperacao.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();consultarProdutoRecuperacao();}});
codigoRecuperacao.addEventListener("input",()=>{if(produtoRecuperacao&&codigoRecuperacao.value.trim()!==String(produtoRecuperacao.codigo)){produtoRecuperacao=null;limparProduto("Recuperacao");quantidadeRecuperacao.disabled=true;if(btnSalvarEGerarDocumentoRecuperacao)btnSalvarEGerarDocumentoRecuperacao.disabled=true;}});
quantidadeRecuperacao.addEventListener("input",atualizarPreviewRecuperacao);
quantidadeRecuperacao.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("formRecuperacao").requestSubmit();}});

$("formRecuperacao").addEventListener("submit",async e=>{
    e.preventDefault();
    if(lancamentoRecuperacaoEmAndamento)return;
    if(!produtoRecuperacao)return toast("Primeiro informe um produto válido.");
    const qtd=numero(quantidadeRecuperacao.value);
    if(qtd<=0)return toast("Informe a quantidade ou peso recuperado.");
    lancamentoRecuperacaoEmAndamento=true;
    btnSalvarEGerarDocumentoRecuperacao?.setAttribute("disabled","true");
    try{
        if(edicaoRecuperacaoId){
            const resultado=await requisicao(`/api/recuperacoes/${encodeURIComponent(edicaoRecuperacaoId)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantidade:qtd,observacao:$("obsRecuperacao").value.trim()})});
            toast(`Recuperação ${resultado.documento} atualizada.`);
            cancelarEdicaoRecuperacao();
            await Promise.all([carregarProdutosLancadosRecuperacao(),carregarRecuperacoes(),atualizarStatusDocumentoRecuperacao()]);
        }else{
            const resultado=await requisicao("/api/recuperacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({codigo:produtoRecuperacao.codigo,quantidade:qtd,observacao:$("obsRecuperacao").value.trim()})});
            documentoRecuperacaoAtual={id:resultado.documentoId,documento:resultado.documento,status:resultado.documentoStatus,dataDocumento:hoje()};
            toast(`Recuperação lançada no ${resultado.documento}.`);
            limparCamposLancamentoRecuperacao();
            await Promise.all([carregarProdutosLancadosRecuperacao(),carregarRecuperacoes(),atualizarStatusDocumentoRecuperacao()]);
        }
        setTimeout(()=>codigoRecuperacao?.focus(),60);
    }catch(e){toast(e.message);}
    finally{lancamentoRecuperacaoEmAndamento=false;atualizarPreviewRecuperacao();}
});
function limparCamposLancamentoRecuperacao(){produtoRecuperacao=null;edicaoRecuperacaoId=null;codigoRecuperacao.disabled=false;codigoRecuperacao.value="";quantidadeRecuperacao.value="";$("obsRecuperacao").value="";quantidadeRecuperacao.disabled=true;if(btnSalvarEGerarDocumentoRecuperacao){btnSalvarEGerarDocumentoRecuperacao.disabled=true;btnSalvarEGerarDocumentoRecuperacao.textContent="Lançar recuperação";}$("btnCancelarEdicaoRecuperacao")?.classList.add("oculto");limparProduto("Recuperacao");$("valorTotalRecuperacao").textContent="R$ 0,00";$("valorRecuperadoPreview").textContent="R$ 0,00";}
function limparFormularioRecuperacao(){$("formRecuperacao").reset();limparCamposLancamentoRecuperacao();}

async function carregarProdutosLancadosRecuperacao(){try{if(!documentoRecuperacaoAtual?.id)return;const dados=await requisicao(`/api/recuperacoes?page=1&limit=100&sort=criado_em&dir=desc&documentoId=${encodeURIComponent(documentoRecuperacaoAtual.id)}`);renderProdutosLancados("listaProdutosRecuperacao","contadorProdutosRecuperacao",dados.registros||[],"recuperacao");}catch(e){const c=$("listaProdutosRecuperacao");if(c)c.innerHTML='<div class="lista-produtos-vazia">Não foi possível carregar os produtos lançados.</div>';}}
async function atualizarStatusDocumentoRecuperacao(){try{if(!documentoRecuperacaoAtual?.id)return;const r=await requisicao(`/api/recuperacoes/documento/info?id=${encodeURIComponent(documentoRecuperacaoAtual.id)}`),doc=r.documento,finalizado=doc?.status==="FINALIZADO";documentoRecuperacaoAtual=doc;const status=$("statusDocumentoRecuperacao");status?.replaceChildren(document.createTextNode(doc?`${documentoLabel(doc,"RECUPERACAO")} · ${statusTexto(doc.status)}`:"Nenhum documento hoje"));status?.classList.toggle("status-finalizado",finalizado);status?.classList.toggle("status-aberto",!finalizado);$("btnFinalizarDocumentoRecuperacao")?.toggleAttribute("disabled",!doc||finalizado);$("codigoRecuperacao")?.toggleAttribute("disabled",finalizado||!!edicaoRecuperacaoId);$("quantidadeRecuperacao")?.toggleAttribute("disabled",finalizado||!produtoRecuperacao);$("obsRecuperacao")?.toggleAttribute("disabled",finalizado);$("btnSalvarEGerarDocumentoRecuperacao")?.toggleAttribute("disabled",finalizado||!produtoRecuperacao||numero(quantidadeRecuperacao?.value)<=0);$("listaProdutosRecuperacao")?.setAttribute("data-documento-finalizado",finalizado?"true":"false");$("listaProdutosRecuperacao")?.querySelectorAll("[data-excluir-item],[data-editar-item]").forEach(b=>b.disabled=finalizado);}catch(e){toast(e.message||"Não foi possível consultar o documento.");}}
function abrirPdfNovaAba(endpoint){const win=window.open(`${API}${endpoint}`,"_blank");if(!win)toast("Permita pop-ups para abrir o documento.");return win;}
async function abrirDocumentoRecuperacao(id){const docId=id||documentoRecuperacaoAtual?.id;if(!docId)return toast("Nenhum documento disponível.");return abrirPdfNovaAba(`/api/recuperacoes/documento?id=${encodeURIComponent(docId)}`);}
$("btnGerarDocumentoDiaRecuperacao")?.addEventListener("click",()=>abrirDocumentoRecuperacao($("btnGerarDocumentoDiaRecuperacao")?.dataset.documentoId));
async function finalizarDocumentoRecuperacao(){const doc=documentoRecuperacaoAtual;if(!doc?.id)return toast("Nenhum documento aberto.");if(doc.status==="FINALIZADO")return toast(`O documento ${documentoLabel(doc,"RECUPERACAO")} já está finalizado.`);if(!confirm(`Finalizar o documento ${documentoLabel(doc,"RECUPERACAO")}? Depois disso não será possível incluir, editar ou excluir itens dele.`))return;try{const r=await requisicao("/api/recuperacoes/documento/finalizar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:doc.dataDocumento||hoje(),documentoId:doc.id})});documentoRecuperacaoAtual=r.documento;toast(`${r.documento.documento} finalizado.`);await Promise.all([atualizarStatusDocumentoRecuperacao(),carregarRecuperacoes()]);}catch(e){toast(e.message);}}
$("btnFinalizarDocumentoRecuperacao")?.addEventListener("click",finalizarDocumentoRecuperacao);

async function excluirRecuperacao(id){if(!confirm("Excluir este lançamento? O documento será atualizado."))return;try{const r=await requisicao(`/api/recuperacoes/${encodeURIComponent(id)}`,{method:"DELETE"});toast(r.documentoAtualizado?"Lançamento excluído e documento atualizado.":"Lançamento excluído.");await Promise.all([carregarRecuperacoes(),carregarProdutosLancadosRecuperacao(),atualizarStatusDocumentoRecuperacao()]);}catch(e){toast(e.message);}}

/* =========================================================
   DOAÇÕES
========================================================= */
let produtoDoacao=null, edicaoDoacaoId=null;
let lancamentoRecuperacaoEmAndamento=false;
let lancamentoDoacaoEmAndamento=false;
const codigoDoacao=$("codigoDoacao"),quantidadeDoacao=$("quantidadeDoacao");
const modalCadastroDoacao=$("modalCadastroDoacao");
let documentoDoacaoAtual=null, beneficiarioDoacaoPersistido="";
async function prepararDocumentoDoacao(){const data=$("dataDoacao")?.value||hoje();const r=await requisicao("/api/doacoes/documento/abrir",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})});documentoDoacaoAtual=r.documento||null;beneficiarioDoacaoPersistido=documentoDoacaoAtual?.beneficiario||"";if(documentoDoacaoAtual?.beneficiario&&$("beneficiarioDoacao"))$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;return documentoDoacaoAtual;}
async function abrirCadastroDoacao(){if(!modalCadastroDoacao)return;modalCadastroDoacao.classList.add("ativo");modalCadastroDoacao.setAttribute("aria-hidden","false");document.body.classList.add("modal-aberto");limparFormularioDoacao();try{await prepararDocumentoDoacao();await carregarProdutosLancadosDoacao();await atualizarStatusDocumentoDoacao();if(documentoDoacaoAtual?.beneficiario)$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;atualizarPreviewDoacao();}catch(e){toast(e.message||"Não foi possível abrir o documento de doação.");}setTimeout(()=>codigoDoacao?.focus(),60);}
function fecharCadastroDoacao(){
    if(!modalCadastroDoacao)return;
    if(!confirmarFechamentoDocumento("listaProdutosDoacao",documentoDoacaoAtual))return;
    modalCadastroDoacao.classList.remove("ativo");
    modalCadastroDoacao.setAttribute("aria-hidden","true");
    document.body.classList.remove("modal-aberto");
}
$("btnAbrirCadastroDoacao")?.addEventListener("click",abrirCadastroDoacao);
$("btnFecharCadastroDoacao")?.addEventListener("click",fecharCadastroDoacao);
modalCadastroDoacao?.querySelectorAll('[data-fechar-modal-doacao="true"]').forEach(el=>el.addEventListener("click",fecharCadastroDoacao));

async function consultarProdutoDoacao(){
    const codigo=codigoDoacao.value.trim();
    if(!codigo)return toast("Digite ou bipe o código.");
    limparProduto("Doacao");produtoDoacao=null;quantidadeDoacao.disabled=true;$("btnSalvarDoacao").disabled=true;
    try{
        const produto=await buscarProduto(codigo);
        if(!numero(produto.valorCusto)){$("produtoSemCustoDoacao")?.classList.remove("oculto");return toast("Produto sem custo válido. O lançamento está bloqueado.");}
        produtoDoacao=produto;mostrarProduto("Doacao",produto);quantidadeDoacao.disabled=false;$("beneficiarioDoacao").disabled=documentoDoacaoAtual?.status==="FINALIZADO";quantidadeDoacao.focus();atualizarPreviewDoacao();
    }catch(e){$("produtoNaoEncontradoDoacao")?.classList.remove("oculto");$("mensagemProdutoNaoEncontradoDoacao").textContent=`Código consultado: ${codigo}. Verifique se ele está na base de produtos.`;toast(e.message);codigoDoacao.select();}
}
function atualizarPreviewDoacao(){const qtd=numero(quantidadeDoacao.value);$("valorTotalDoacao").textContent=moeda(qtd*numero(produtoDoacao?.valorCusto));$("btnSalvarDoacao").disabled=!produtoDoacao||qtd<=0||!$("beneficiarioDoacao").value.trim();}
codigoDoacao.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();consultarProdutoDoacao();}});
codigoDoacao.addEventListener("input",()=>{if(produtoDoacao&&codigoDoacao.value.trim()!==String(produtoDoacao.codigo)){produtoDoacao=null;limparProduto("Doacao");quantidadeDoacao.disabled=true;$("btnSalvarDoacao").disabled=true;}});
quantidadeDoacao.addEventListener("input",atualizarPreviewDoacao);$("beneficiarioDoacao").addEventListener("input",atualizarPreviewDoacao);$("beneficiarioDoacao").addEventListener("blur",atualizarBeneficiarioDoacao);$("dataDoacao").addEventListener("change",async()=>{const dataSelecionada=$("dataDoacao").value||hoje();limparFormularioDoacao();$("dataDoacao").value=dataSelecionada;try{await prepararDocumentoDoacao();await carregarProdutosLancadosDoacao();await atualizarStatusDocumentoDoacao();if(documentoDoacaoAtual?.beneficiario)$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;atualizarPreviewDoacao();}catch(e){toast(e.message);}});

$("formDoacao").addEventListener("submit",async e=>{
    e.preventDefault();
    if(lancamentoDoacaoEmAndamento)return;
    if(!produtoDoacao)return toast("Primeiro informe um produto válido.");
    const qtd=numero(quantidadeDoacao.value),beneficiario=$("beneficiarioDoacao").value.trim(),data=$("dataDoacao").value||hoje();
    if(qtd<=0)return toast("Informe a quantidade ou peso.");
    if(!beneficiario)return toast("Informe a instituição ou beneficiário.");
    lancamentoDoacaoEmAndamento=true;
    $("btnSalvarDoacao")?.setAttribute("disabled","true");
    try{
        if(documentoDoacaoAtual?.id && documentoDoacaoAtual.status!=="FINALIZADO" && beneficiario!==beneficiarioDoacaoPersistido){const beneficiarioOk=await atualizarBeneficiarioDoacao();if(!beneficiarioOk)throw new Error("Não foi possível atualizar o beneficiário do documento.");}
        if(edicaoDoacaoId){
            const r=await requisicao(`/api/doacoes/${encodeURIComponent(edicaoDoacaoId)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantidade:qtd,observacao:$("obsDoacao").value.trim()})});
            toast(`Doação ${r.documento} atualizada.`);
            cancelarEdicaoDoacao();
            await Promise.all([carregarDoacoes(),carregarProdutosLancadosDoacao(),atualizarStatusDocumentoDoacao()]);
        }else{
            const r=await requisicao("/api/doacoes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({codigo:produtoDoacao.codigo,quantidade:qtd,beneficiario,dataDoacao:data,observacao:$("obsDoacao").value.trim()})});
            documentoDoacaoAtual={...documentoDoacaoAtual,id:r.documentoId,documento:r.documento,status:r.documentoStatus,dataDocumento:data,beneficiario:r.beneficiario||beneficiario};beneficiarioDoacaoPersistido=beneficiario;
            toast(`Doação lançada no ${r.documento}.`);
            limparCamposLancamentoDoacao();
            await Promise.all([carregarDoacoes(),carregarProdutosLancadosDoacao(),atualizarStatusDocumentoDoacao()]);
            if(documentoDoacaoAtual?.beneficiario)$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;
        }
        setTimeout(()=>codigoDoacao?.focus(),60);
    }catch(e){toast(e.message);}
    finally{lancamentoDoacaoEmAndamento=false;atualizarPreviewDoacao();}
});
function limparCamposLancamentoDoacao(){produtoDoacao=null;edicaoDoacaoId=null;codigoDoacao.disabled=false;codigoDoacao.value="";quantidadeDoacao.value="";$("obsDoacao").value="";quantidadeDoacao.disabled=true;if($("btnSalvarDoacao")){$("btnSalvarDoacao").disabled=true;$("btnSalvarDoacao").textContent="Lançar doação";}$("btnCancelarEdicaoDoacao")?.classList.add("oculto");limparProduto("Doacao");$("valorTotalDoacao").textContent="R$ 0,00";}
function limparFormularioDoacao(){produtoDoacao=null;$("formDoacao").reset();$("dataDoacao").value=hoje();quantidadeDoacao.disabled=true;$("beneficiarioDoacao").disabled=false;$("btnSalvarDoacao").disabled=true;limparProduto("Doacao");$("valorTotalDoacao").textContent="R$ 0,00";}
$("dataDoacao").value=hoje();

async function carregarProdutosLancadosDoacao(){const data=$("dataDoacao")?.value||hoje();try{if(!documentoDoacaoAtual?.id)return;const dados=await requisicao(`/api/doacoes?page=1&limit=100&sort=data_doacao&dir=desc&documentoId=${encodeURIComponent(documentoDoacaoAtual.id)}&dataInicio=${encodeURIComponent(data)}&dataFim=${encodeURIComponent(data)}`);renderProdutosLancados("listaProdutosDoacao","contadorProdutosDoacao",dados.registros||[],"doacao");}catch(e){const c=$("listaProdutosDoacao");if(c)c.innerHTML='<div class="lista-produtos-vazia">Não foi possível carregar os produtos lançados.</div>';}}
async function atualizarStatusDocumentoDoacao(){try{if(!documentoDoacaoAtual?.id)return;const r=await requisicao(`/api/doacoes/documento/info?id=${encodeURIComponent(documentoDoacaoAtual.id)}`),doc=r.documento,finalizado=doc?.status==="FINALIZADO";documentoDoacaoAtual=doc;if(doc?.beneficiario&&$("beneficiarioDoacao")){beneficiarioDoacaoPersistido=doc.beneficiario;$("beneficiarioDoacao").value=doc.beneficiario;}const status=$("statusDocumentoDoacao");status?.replaceChildren(document.createTextNode(doc?`${documentoLabel(doc,"DOACAO")} · ${statusTexto(doc.status)}`:"Nenhum documento para a data"));status?.classList.toggle("status-finalizado",finalizado);status?.classList.toggle("status-aberto",!finalizado);$("btnFinalizarDocumentoDoacao")?.toggleAttribute("disabled",!doc||finalizado);$("codigoDoacao")?.toggleAttribute("disabled",finalizado||!!edicaoDoacaoId);$("quantidadeDoacao")?.toggleAttribute("disabled",finalizado||!produtoDoacao);$("beneficiarioDoacao")?.toggleAttribute("disabled",finalizado);$("dataDoacao")?.toggleAttribute("disabled",finalizado);$("obsDoacao")?.toggleAttribute("disabled",finalizado);$("btnSalvarDoacao")?.toggleAttribute("disabled",finalizado||!produtoDoacao||numero(quantidadeDoacao?.value)<=0||!$("beneficiarioDoacao")?.value.trim());$("listaProdutosDoacao")?.setAttribute("data-documento-finalizado",finalizado?"true":"false");$("listaProdutosDoacao")?.querySelectorAll("[data-excluir-item],[data-editar-item]").forEach(b=>b.disabled=finalizado);}catch(e){toast(e.message||"Não foi possível consultar o documento.");}}
async function abrirDocumentoDoacao(id){const docId=id||documentoDoacaoAtual?.id;if(!docId)return toast("Nenhum documento disponível.");return abrirPdfNovaAba(`/api/doacoes/documento?id=${encodeURIComponent(docId)}`);}
$("btnDocumentoDiaDoacao")?.addEventListener("click",()=>abrirDocumentoDoacao($("btnDocumentoDiaDoacao")?.dataset.documentoId));
async function finalizarDocumentoDoacao(){const doc=documentoDoacaoAtual;if(!doc?.id)return toast("Nenhum documento aberto.");if(doc.status==="FINALIZADO")return toast(`O documento ${documentoLabel(doc,"DOACAO")} já está finalizado.`);if(!confirm(`Finalizar o documento ${documentoLabel(doc,"DOACAO")}? Depois disso não será possível incluir, editar ou excluir itens dele.`))return;try{const r=await requisicao("/api/doacoes/documento/finalizar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:doc.dataDocumento||$("dataDoacao").value||hoje(),documentoId:doc.id})});documentoDoacaoAtual=r.documento;toast(`${r.documento.documento} finalizado.`);await Promise.all([atualizarStatusDocumentoDoacao(),carregarDoacoes()]);}catch(e){toast(e.message);}}
$("btnFinalizarDocumentoDoacao")?.addEventListener("click",finalizarDocumentoDoacao);

function atualizarResumoModal(registros,tipo){const lista=Array.isArray(registros)?registros:[];const qtd=lista.reduce((s,r)=>s+numero(r.quantidade),0);const valor=lista.reduce((s,r)=>s+numero(tipo==="doacao"?r.valorTotal:r.valorRecuperado),0);const id=tipo==="doacao"?"resumoDocumentoDoacao":"resumoDocumentoRecuperacao";const el=$(id);if(el)el.textContent=`${lista.length} ${lista.length===1?"item":"itens"} · ${quantidadeFormatada(qtd)} ${qtd===1?"unidade":"unidades"} · ${moeda(valor)}`;}

function renderProdutosLancados(containerId,contadorId,registros,tipo){
    const container=$(containerId),contador=$(contadorId);
    if(!container)return;
    const lista=Array.isArray(registros)?registros:[];
    if(contador)contador.textContent=`${lista.length} ${lista.length===1?"item":"itens"}`;
    atualizarResumoModal(lista,tipo);
    if(!lista.length){container.innerHTML='<div class="lista-produtos-vazia">Nenhum produto lançado ainda.</div>';return;}
    const finalizado=container.dataset.documentoFinalizado==="true";
    container.innerHTML=lista.map(r=>{
        const qtd=quantidadeFormatada(r.quantidade),valor=moeda(tipo==="doacao"?r.valorTotal:r.valorRecuperado),extra=tipo==="doacao"?(r.beneficiario||"Sem beneficiário informado"):(r.observacao||"Sem observação");
        const edit=`<button class="btn" type="button" data-editar-item="${esc(r.id)}" data-tipo="${tipo}" ${finalizado?"disabled":""}>Editar</button>`;
        const del=`<button class="btn-excluir" type="button" data-excluir-item="${esc(r.id)}" data-tipo="${tipo}" ${finalizado?"disabled":""}>Excluir</button>`;
        return `<article class="produto-lancado-item"><div class="produto-lancado-principal"><strong>${esc(r.produto||"Produto sem descrição")}</strong><span>Código: ${esc(r.codigo||"-")}</span></div><div class="produto-lancado-detalhes"><span><small>Quantidade</small><b>${esc(qtd)}</b></span><span><small>Valor</small><b>${esc(valor)}</b></span><span class="produto-lancado-extra"><small>${tipo==="doacao"?"Beneficiário":"Observação"}</small><b>${esc(extra)}</b></span><span class="produto-lancado-acao"><span class="produto-lancado-botoes">${edit}${del}</span></span></div></article>`;
    }).join("");
    container.querySelectorAll("[data-excluir-item]").forEach(b=>b.addEventListener("click",()=>b.dataset.tipo==="doacao"?excluirDoacao(b.dataset.excluirItem):excluirRecuperacao(b.dataset.excluirItem)));
    container.querySelectorAll("[data-editar-item]").forEach(b=>b.addEventListener("click",()=>b.dataset.tipo==="doacao"?iniciarEdicaoDoacao(b.dataset.editarItem):iniciarEdicaoRecuperacao(b.dataset.editarItem)));
}
async function iniciarEdicaoRecuperacao(id){const item=await obterItemLancado("/api/recuperacoes",id);if(!item)return;edicaoRecuperacaoId=id;produtoRecuperacao={codigo:item.codigo,descricao:item.produto,fornecedor:item.fornecedor||"",codigo_fornecedor:item.codigoFornecedor||"",categoria:item.categoria||"",valorCusto:Number(item.valorUnitario)||0};codigoRecuperacao.value=item.codigo||"";codigoRecuperacao.disabled=true;quantidadeRecuperacao.value=item.quantidade;quantidadeRecuperacao.disabled=false;$("obsRecuperacao").value=item.observacao||"";mostrarProduto("Recuperacao",produtoRecuperacao);atualizarPreviewRecuperacao();if(btnSalvarEGerarDocumentoRecuperacao){btnSalvarEGerarDocumentoRecuperacao.disabled=false;btnSalvarEGerarDocumentoRecuperacao.textContent="Salvar alteração";}$("btnCancelarEdicaoRecuperacao")?.classList.remove("oculto");setTimeout(()=>quantidadeRecuperacao.focus(),60);}
async function iniciarEdicaoDoacao(id){const item=await obterItemLancado("/api/doacoes",id);if(!item)return;edicaoDoacaoId=id;produtoDoacao={codigo:item.codigo,descricao:item.produto,fornecedor:item.fornecedor||"",codigo_fornecedor:item.codigoFornecedor||"",categoria:item.categoria||"",valorCusto:Number(item.valorUnitario)||0};codigoDoacao.value=item.codigo||"";codigoDoacao.disabled=true;quantidadeDoacao.value=item.quantidade;quantidadeDoacao.disabled=false;$("obsDoacao").value=item.observacao||"";if(item.beneficiario&&$("beneficiarioDoacao"))$("beneficiarioDoacao").value=item.beneficiario;mostrarProduto("Doacao",produtoDoacao);atualizarPreviewDoacao();if($("btnSalvarDoacao")){$("btnSalvarDoacao").disabled=false;$("btnSalvarDoacao").textContent="Salvar alteração";}$("btnCancelarEdicaoDoacao")?.classList.remove("oculto");setTimeout(()=>quantidadeDoacao.focus(),60);}
async function obterItemLancado(base,id){try{const documentoId=base.includes("doacoes")?documentoDoacaoAtual?.id:documentoRecuperacaoAtual?.id;const q=documentoId?`&documentoId=${encodeURIComponent(documentoId)}`:"";const d=await requisicao(`${base}?page=1&limit=100&sort=criado_em&dir=desc${q}`);return (d.registros||[]).find(r=>String(r.id)===String(id))||null;}catch(e){toast(e.message);return null;}}
function cancelarEdicaoRecuperacao(){limparCamposLancamentoRecuperacao();atualizarStatusDocumentoRecuperacao();setTimeout(()=>codigoRecuperacao?.focus(),60);}
function cancelarEdicaoDoacao(){limparCamposLancamentoDoacao();if(documentoDoacaoAtual?.beneficiario)$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;atualizarStatusDocumentoDoacao();setTimeout(()=>codigoDoacao?.focus(),60);}
$("btnCancelarEdicaoRecuperacao")?.addEventListener("click",cancelarEdicaoRecuperacao);
$("btnCancelarEdicaoDoacao")?.addEventListener("click",cancelarEdicaoDoacao);
async function atualizarBeneficiarioDoacao(){const doc=documentoDoacaoAtual;if(!doc?.id||doc.status==="FINALIZADO")return true;const beneficiario=$("beneficiarioDoacao")?.value.trim();if(!beneficiario)return false;if(beneficiario===beneficiarioDoacaoPersistido)return true;try{const r=await requisicao(`/api/doacoes/documento/${encodeURIComponent(doc.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({beneficiario})});documentoDoacaoAtual=r.documento||documentoDoacaoAtual;beneficiarioDoacaoPersistido=beneficiario;await carregarProdutosLancadosDoacao();return true;}catch(e){toast(e.message);if(documentoDoacaoAtual?.beneficiario)$("beneficiarioDoacao").value=documentoDoacaoAtual.beneficiario;return false;}}
async function excluirDoacao(id){if(!confirm("Excluir esta doação? O documento será atualizado."))return;try{const r=await requisicao(`/api/doacoes/${encodeURIComponent(id)}`,{method:"DELETE"});toast(r.documentoAtualizado?"Doação excluída e documento atualizado.":"Doação excluída.");await Promise.all([carregarDoacoes(),carregarProdutosLancadosDoacao(),atualizarStatusDocumentoDoacao()]);}catch(e){toast(e.message);}}


/* =========================================================
   EXCLUSÃO DE DOCUMENTOS DO HISTÓRICO (ADMIN)
========================================================= */
const usuarioEhAdminModulo = () => sessao?.perfil === "admin";
async function excluirDocumentoRecuperacao(id,documento){if(!usuarioEhAdminModulo())return toast("Apenas o administrador pode excluir documentos do histórico.");if(!confirm(`Excluir o documento ${documento}? Todos os lançamentos desse documento também serão excluídos.`))return;try{const r=await requisicao(`/api/recuperacoes/documentos/${encodeURIComponent(id)}`,{method:"DELETE"});toast(`${r.documento||documento} excluído do histórico.`);await carregarRecuperacoes();}catch(e){toast(e.message);}}
async function excluirDocumentoDoacao(id,documento){if(!usuarioEhAdminModulo())return toast("Apenas o administrador pode excluir documentos do histórico.");if(!confirm(`Excluir o documento ${documento}? Todos os lançamentos dessa doação também serão excluídos.`))return;try{const r=await requisicao(`/api/doacoes/documentos/${encodeURIComponent(id)}`,{method:"DELETE"});toast(`${r.documento||documento} excluído do histórico.`);await carregarDoacoes();}catch(e){toast(e.message);}}

/* =========================================================
   HISTÓRICOS POR DOCUMENTO
========================================================= */
const estadoRec={page:1,limit:25,sort:"data_documento",dir:"desc"};
function filtrosRec(){return new URLSearchParams({page:estadoRec.page,limit:estadoRec.limit,sort:estadoRec.sort,dir:estadoRec.dir,busca:$("filtroRecuperacaoBusca").value.trim(),fornecedor:$("filtroRecuperacaoFornecedor").value.trim(),dataInicio:$("filtroRecuperacaoDataInicial").value,dataFim:$("filtroRecuperacaoDataFinal").value}).toString();}
function renderPaginacao(containerId,meta,onPage){const c=$(containerId);if(!c)return;const total=Number(meta.total||0),page=Number(meta.page||1),limit=Number(meta.limit||25),pages=Math.max(1,Number(meta.totalPaginas||1));if(!total){c.innerHTML="";return;}const start=(page-1)*limit+1,end=Math.min(page*limit,total);let buttons=`<button class="pagina-btn" data-page="1" ${page===1?"disabled":""}>«</button><button class="pagina-btn" data-page="${page-1}" ${page===1?"disabled":""}>‹</button>`;for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)buttons+=`<button class="pagina-btn ${i===page?"ativo":""}" data-page="${i}">${i}</button>`;buttons+=`<button class="pagina-btn" data-page="${page+1}" ${page===pages?"disabled":""}>›</button><button class="pagina-btn" data-page="${pages}" ${page===pages?"disabled":""}>»</button>`;c.innerHTML=`<div class="paginacao-info">Mostrando <strong>${start}–${end}</strong> de <strong>${total}</strong></div><div class="paginacao-controles"><label>Por página <select class="paginacao-tamanho"><option value="10" ${limit===10?"selected":""}>10</option><option value="25" ${limit===25?"selected":""}>25</option><option value="50" ${limit===50?"selected":""}>50</option><option value="100" ${limit===100?"selected":""}>100</option></select></label><div class="paginacao-botoes">${buttons}</div></div>`;c.querySelectorAll(".pagina-btn").forEach(b=>b.addEventListener("click",()=>onPage(Number(b.dataset.page))));c.querySelector("select")?.addEventListener("change",e=>onPage(1,Number(e.target.value)));}
async function carregarRecuperacoes(){try{const dados=await requisicao(`/api/recuperacoes/documentos?${filtrosRec()}`);const resumo=dados.resumo||{};$("totalRecuperacoes").textContent=Number(resumo.documentos||0).toLocaleString("pt-BR");$("quantidadeRecuperadaHistorico").textContent=quantidadeFormatada(resumo.quantidadeRecuperada||0);$("valorRecuperadoHistorico").textContent=moeda(resumo.valorRecuperado||0);$("contadorRecuperacoes").textContent=Number(resumo.documentos||0).toLocaleString("pt-BR");const tbody=$("tabelaRecuperacoes");if(!dados.documentos?.length)tbody.innerHTML='<tr><td colspan="6" class="vazio">Nenhum documento encontrado.</td></tr>';else tbody.innerHTML=dados.documentos.map(d=>`<tr><td>${esc(dataSomente(d.dataDocumento))}</td><td><strong>${esc(d.documento)}</strong></td><td>${esc(d.registros)}</td><td>${esc(quantidadeFormatada(d.quantidadeRecuperada))}</td><td>${esc(moeda(d.valorRecuperado))}</td><td><span class="status-documento ${statusClasse(d.status)}">${esc(statusTexto(d.status))}</span><span class="historico-documento-acoes"><button class="btn btn-documento" type="button" data-documento-rec="${esc(d.id)}">Documento</button>${usuarioEhAdminModulo()?`<button class="btn btn-excluir-documento" type="button" data-excluir-documento-rec="${esc(d.id)}" data-documento-label="${esc(d.documento)}">Excluir</button>`:""}</span></td></tr>`).join("");tbody.querySelectorAll("[data-documento-rec]").forEach(b=>b.addEventListener("click",()=>abrirDocumentoRecuperacao(b.dataset.documentoRec)));tbody.querySelectorAll("[data-excluir-documento-rec]").forEach(b=>b.addEventListener("click",()=>excluirDocumentoRecuperacao(b.dataset.excluirDocumentoRec,b.dataset.documentoLabel)));renderPaginacao("paginacaoRecuperacao",dados,(p,l)=>{estadoRec.page=p;if(l)estadoRec.limit=l;carregarRecuperacoes();});}catch(e){toast(e.message);}}
$("btnFiltrarRecuperacao")?.addEventListener("click",()=>{estadoRec.page=1;carregarRecuperacoes();});$("btnLimparFiltrosRecuperacao")?.addEventListener("click",()=>{$("filtroRecuperacaoBusca").value="";$ ("filtroRecuperacaoFornecedor").value="";$ ("filtroRecuperacaoDataInicial").value="";$ ("filtroRecuperacaoDataFinal").value="";estadoRec.page=1;carregarRecuperacoes();});

const estadoDo={page:1,limit:25,sort:"data_documento",dir:"desc"};
function filtrosDo(){return new URLSearchParams({page:estadoDo.page,limit:estadoDo.limit,sort:estadoDo.sort,dir:estadoDo.dir,busca:$("filtroDoacaoBusca").value.trim(),dataInicio:$("filtroDoacaoInicio").value,dataFim:$("filtroDoacaoFim").value}).toString();}
function renderResumoDo(res){const cards=[["Documentos",res.documentos||0,"Documentos no período"],["Quantidade doada",quantidadeFormatada(res.quantidadeDoada),"Total de produtos/peso"],["Valor estimado",moeda(res.valorDoado),"Valor de custo estimado"]];$("resumoDoacaoCards").innerHTML=cards.map(c=>`<article class="metric-card-modulo"><span>${esc(c[0])}</span><strong>${esc(c[1])}</strong><small>${esc(c[2])}</small></article>`).join("");}
async function carregarDoacoes(){try{const dados=await requisicao(`/api/doacoes/documentos?${filtrosDo()}`);renderResumoDo(dados.resumo||{});$("resumoHistoricoDoacao").innerHTML=`<span class="resumo-chip">Documentos: <strong>${dados.resumo?.documentos||0}</strong></span><span class="resumo-chip">Quantidade: <strong>${quantidadeFormatada(dados.resumo?.quantidadeDoada||0)}</strong></span><span class="resumo-chip">Valor: <strong>${moeda(dados.resumo?.valorDoado||0)}</strong></span>`;const tbody=$("tabelaDoacoes");if(!dados.documentos?.length)tbody.innerHTML='<tr><td colspan="7" class="vazio">Nenhum documento encontrado.</td></tr>';else tbody.innerHTML=dados.documentos.map(d=>`<tr><td>${esc(dataSomente(d.dataDocumento))}</td><td><strong>${esc(d.documento)}</strong></td><td>${esc(d.beneficiario||"-")}</td><td>${esc(d.registros)}</td><td>${esc(quantidadeFormatada(d.quantidadeDoada))}</td><td>${esc(moeda(d.valorDoado))}</td><td><span class="status-documento ${statusClasse(d.status)}">${esc(statusTexto(d.status))}</span><span class="historico-documento-acoes"><button class="btn btn-documento" type="button" data-documento-do="${esc(d.id)}">Documento</button>${usuarioEhAdminModulo()?`<button class="btn btn-excluir-documento" type="button" data-excluir-documento-do="${esc(d.id)}" data-documento-label="${esc(d.documento)}">Excluir</button>`:""}</span></td></tr>`).join("");tbody.querySelectorAll("[data-documento-do]").forEach(b=>b.addEventListener("click",()=>abrirDocumentoDoacao(b.dataset.documentoDo)));tbody.querySelectorAll("[data-excluir-documento-do]").forEach(b=>b.addEventListener("click",()=>excluirDocumentoDoacao(b.dataset.excluirDocumentoDo,b.dataset.documentoLabel)));renderPaginacao("paginacaoDoacao",dados,(p,l)=>{estadoDo.page=p;if(l)estadoDo.limit=l;carregarDoacoes();});}catch(e){toast(e.message);}}
$("btnFiltrarDoacao")?.addEventListener("click",()=>{estadoDo.page=1;carregarDoacoes();});$("btnLimparFiltrosDoacao")?.addEventListener("click",()=>{$("filtroDoacaoBusca").value="";$ ("filtroDoacaoInicio").value="";$ ("filtroDoacaoFim").value="";estadoDo.page=1;carregarDoacoes();});

document.querySelectorAll('.tabela-modulo th[data-sort]').forEach(th=>th.addEventListener('click',()=>{const key=th.dataset.sort;if(key&&key.includes("doacao")){estadoDo.sort=key;estadoDo.dir=estadoDo.dir==='asc'?'desc':'asc';estadoDo.page=1;carregarDoacoes();}}));

/* =========================================================
   EXPORTAÇÕES
========================================================= */
async function baixar(url,body,fallback){try{const r=await fetch(`${API}${url}`,{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},credentials:"include",body:JSON.stringify(body)});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.erro||"Falha ao exportar.");}const blob=await r.blob(),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=fallback;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(e){toast(e.message);}}
function filtrosExportRecuperacao(){return{filtros:{busca:$("filtroRecuperacaoBusca").value.trim(),fornecedor:$("filtroRecuperacaoFornecedor").value.trim(),dataInicio:$("filtroRecuperacaoDataInicial").value,dataFim:$("filtroRecuperacaoDataFinal").value}};}
$("btnExportarRecuperacao")?.addEventListener("click",()=>{const m=$("menuExportarRecuperacao");if(!m)return;m.hidden=!m.hidden;$("btnExportarRecuperacao").setAttribute("aria-expanded",String(!m.hidden));});
$("btnExportarRecuperacaoExcel")?.addEventListener("click",()=>{$("menuExportarRecuperacao").hidden=true;baixar("/api/recuperacoes/exportar-xlsx",filtrosExportRecuperacao(),`recuperacoes_${hoje()}.xlsx`);});$("btnExportarRecuperacaoPdf")?.addEventListener("click",()=>{$("menuExportarRecuperacao").hidden=true;baixar("/api/recuperacoes/exportar-pdf",filtrosExportRecuperacao(),`recuperacoes_${hoje()}.pdf`);});
$("btnExportarDoacao")?.addEventListener("click",()=>{const m=$("menuExportarDoacao");if(!m)return;m.hidden=!m.hidden;$("btnExportarDoacao").setAttribute("aria-expanded",String(!m.hidden));});
$("btnExportarDoacaoExcel")?.addEventListener("click",()=>{$("menuExportarDoacao").hidden=true;baixar("/api/doacoes/exportar-xlsx",{filtros:{busca:$("filtroDoacaoBusca").value.trim(),dataInicio:$("filtroDoacaoInicio").value,dataFim:$("filtroDoacaoFim").value}},`doacoes_${hoje()}.xlsx`);});$("btnExportarDoacaoPdf")?.addEventListener("click",()=>{ $("menuExportarDoacao").hidden=true;baixar("/api/doacoes/exportar-pdf",{filtros:{busca:$("filtroDoacaoBusca").value.trim(),dataInicio:$("filtroDoacaoInicio").value,dataFim:$("filtroDoacaoFim").value}},`doacoes_${hoje()}.pdf`);});
document.addEventListener("click",e=>{if(!e.target.closest(".export-dropdown")){document.querySelectorAll(".export-menu").forEach(m=>m.hidden=true);document.querySelectorAll(".btn-exportar").forEach(b=>b.setAttribute("aria-expanded","false"));}});

window.addEventListener("keydown",e=>{if(e.key==="F2"){e.preventDefault();const ativo=document.querySelector('.aba-conteudo.ativo')?.id;if(ativo==="abaDoacoes")codigoDoacao?.focus();else codigoRecuperacao?.focus();}if(e.key==="F4"){const recAberto=modalCadastroRecuperacao?.classList.contains("ativo"),doacaoAberto=modalCadastroDoacao?.classList.contains("ativo");if(recAberto||doacaoAberto){e.preventDefault();if(recAberto)finalizarDocumentoRecuperacao();else finalizarDocumentoDoacao();}}if(e.key==="Escape"&&modalCadastroRecuperacao?.classList.contains("ativo")){e.preventDefault();fecharCadastroRecuperacao();}if(e.key==="Escape"&&modalCadastroDoacao?.classList.contains("ativo")){e.preventDefault();fecharCadastroDoacao();}});

carregarRecuperacoes();carregarDoacoes();
