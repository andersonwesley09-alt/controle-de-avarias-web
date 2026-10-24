const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraManaira === "function") return window.formatarDataHoraManaira(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone:"America/Sao_Paulo", dateStyle:"short", timeStyle:"short" }).format(d);
};

const sessao = (() => { try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); } catch { return null; } })();
if (!sessao?.token) { window.location.href="login.html"; throw new Error("Sessão não encontrada."); }

const API = window.CA_API_BASE || window.location.origin;
const totalPendentes=document.getElementById("totalPendentes"),valorPendente=document.getElementById("valorPendente"),totalDevolucoes=document.getElementById("totalDevolucoes"),valorDevolucoes=document.getElementById("valorDevolucoes"),buscaPendentes=document.getElementById("buscaPendentes"),buscaHistorico=document.getElementById("buscaHistorico"),tabelaPendentes=document.getElementById("tabelaPendentes"),tabelaHistorico=document.getElementById("tabelaHistorico"),btnSair=document.getElementById("btnSair"),toastElemento=document.getElementById("toast");
let avarias=[],timerToast;
const headers=()=>({"Authorization":`Bearer ${sessao.token}`});
const numero=v=>Number.isFinite(Number(v))?Number(v):0;
const moeda=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(numero(v));
const total=a=>numero(a.quantidade)*numero(a.valorUnitario);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const data=v=>v?formatarDataHoraSistema(v):"-";

async function api(url,options={}){const r=await fetch(`${API}${url}`,{cache:"no-store",credentials:"include",...options,headers:{...headers(),...(options.headers||{})}});if(r.status===401||r.status===403){sessionStorage.removeItem("usuarioLogado");window.location.href="login.html";throw new Error("Sessão expirada.");}const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.erro||`HTTP ${r.status}`);return d;}
function mostrarToast(m){toastElemento.textContent=m;toastElemento.classList.add("ativo");clearTimeout(timerToast);timerToast=setTimeout(()=>toastElemento.classList.remove("ativo"),2500);}
function obterPendentes(){return avarias.filter(a=>String(a.status||"")!=="Devolução");}
function obterDevolucoes(){return avarias.filter(a=>String(a.status||"")==="Devolução");}
function match(a,termo){if(!termo)return true;return `${a.codigo||""} ${a.produto||""} ${a.fornecedor||""} ${a.tipo||""} ${a.setor||""} ${a.caixa||""}`.toLowerCase().includes(termo);}
function atualizarResumo(){const p=obterPendentes(),d=obterDevolucoes();totalPendentes.textContent=p.filter(a=>String(a.status||"")==="Pendente").length;valorPendente.textContent=moeda(p.filter(a=>String(a.status||"")==="Pendente").reduce((s,a)=>s+total(a),0));totalDevolucoes.textContent=d.length;valorDevolucoes.textContent=moeda(d.reduce((s,a)=>s+total(a),0));}
function renderizarPendentes(){const t=buscaPendentes.value.trim().toLowerCase();const lista=avarias.filter(a=>String(a.status||"")==="Pendente"&&match(a,t));if(!lista.length){tabelaPendentes.innerHTML='<tr><td colspan="10" class="vazio">Nenhuma avaria pendente.</td></tr>';return;}tabelaPendentes.innerHTML=lista.map(a=>`<tr><td>${data(a.criadoEm)}</td><td>${esc(a.produto)}</td><td>${esc(a.fornecedor)}</td><td>${numero(a.quantidade)}</td><td>${moeda(a.valorUnitario)}</td><td><strong>${moeda(total(a))}</strong></td><td>${esc(a.tipo)}</td><td>${esc(a.setor)}</td><td>${esc(a.caixa||"-")}</td><td><button type="button" class="btn-devolver" data-devolver="${esc(a.id)}">Devolver</button></td></tr>`).join("");}
function renderizarHistorico(){const t=buscaHistorico.value.trim().toLowerCase();const lista=obterDevolucoes().filter(a=>match(a,t)).sort((a,b)=>new Date(b.movimentadoEm||b.criadoEm||0)-new Date(a.movimentadoEm||a.criadoEm||0));if(!lista.length){tabelaHistorico.innerHTML='<tr><td colspan="9" class="vazio">Nenhuma devolução registrada.</td></tr>';return;}tabelaHistorico.innerHTML=lista.map(a=>`<tr><td>${data(a.movimentadoEm)}</td><td>${esc(a.produto)}</td><td>${esc(a.fornecedor)}</td><td>${numero(a.quantidade)}</td><td>${moeda(a.valorUnitario)}</td><td><strong>${moeda(total(a))}</strong></td><td>${esc(a.tipo)}</td><td>${esc(a.setor)}</td><td>${esc(a.caixa||"-")}</td></tr>`).join("");}
async function carregar(){try{const [p,d]=await Promise.all([api("/api/avarias?status=Pendente"),api("/api/avarias?status=Devolução")]);avarias=[...(Array.isArray(p)?p:[]),...(Array.isArray(d)?d:[])];atualizarResumo();renderizarPendentes();renderizarHistorico();}catch(e){console.error(e);mostrarToast(e.message||"Não foi possível carregar as devoluções.");}}
async function registrarDevolucao(id){const a=avarias.find(x=>String(x.id)===String(id));if(!a)return mostrarToast("Avaria não encontrada.");const v=total(a);if(!confirm(`Confirmar devolução?\n\nProduto: ${a.produto}\nFornecedor: ${a.fornecedor}\nQuantidade: ${a.quantidade}\nValor: ${moeda(v)}`))return;try{await api(`/api/avarias/${encodeURIComponent(id)}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"Devolução"})});mostrarToast("Devolução registrada com sucesso em todos os PCs.");await carregar();}catch(e){mostrarToast(e.message);}}
tabelaPendentes.addEventListener("click",e=>{const b=e.target.closest("[data-devolver]");if(b)registrarDevolucao(b.dataset.devolver);});buscaPendentes.addEventListener("input",renderizarPendentes);buscaHistorico.addEventListener("input",renderizarHistorico);btnSair.addEventListener("click",async()=>{if(!confirm("Deseja sair do sistema?"))return;try{await api("/api/logout",{method:"POST"});}catch{}sessionStorage.removeItem("usuarioLogado");window.location.href="login.html";});
if(typeof EventSource!=="undefined"){try{const ev=new EventSource(`${API}/api/eventos`);["avarias-atualizadas","historico-atualizado","produtos-atualizados"].forEach(t=>ev.addEventListener(t,carregar));}catch(e){console.warn(e);}}
carregar();
