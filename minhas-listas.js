"use strict";
// V27.5 — Listas de tarefas particulares, isoladas de tarefas_diarias.
(() => {
    const $ = id => document.getElementById(id);
    const sessao = (() => {
        try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); }
        catch { return null; }
    })();
    if (!sessao?.token) { location.replace("login.html"); return; }

    const API = window.CA_API_BASE || (window.CA_LOCAL_MODE ? "" : location.origin);
    const raiz = `${API}/api/listas-pessoais`;
    const hoje = () => typeof hojeEmpresaExemplo === "function" ? hojeEmpresaExemplo() : (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    })();
    const str = x => String(x ?? "");
    const escapar = x => str(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    const ptData = x => /^\d{4}-\d\d-\d\d/.test(str(x)) ? str(x).slice(0,10).split("-").reverse().join("/") : "—";
    const ptDataHora = valor => {
        if (!valor) return "—";
        const dt = new Date(valor);
        return isNaN(dt.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza"
        }).format(dt);
    };
    function diasAtraso(data) {
        const fim = new Date(`${hoje()}T12:00:00Z`);
        const inicio = new Date(`${data}T12:00:00Z`);
        return Math.max(0, Math.round((fim.getTime()-inicio.getTime())/86400000));
    }

    let listas = [], listaAtualId = null, dia = [], atrasadas = [], historico = [], regras = [], filtro = "todas";
    let bloqueio = false, seqDetalhes = 0, tempoToast;
    $("nomeUsuario").textContent = `👤 ${sessao.nome || sessao.usuario || "Usuário"}`;
    $("dataVisualizacao").value = hoje();
    $("dataTarefa").value = hoje();
    function mensagem(texto) {
        const el = $("toast"); el.textContent = texto;
        el.classList.add("ativo"); clearTimeout(tempoToast);
        tempoToast = setTimeout(() => el.classList.remove("ativo"), 4500);
    }
    async function pedir(url, opcoes = {}) {
        const resposta = await fetch(url, {
            credentials: "include", cache: "no-store",
            ...opcoes,
            headers: {
                Authorization: `Bearer ${sessao.token}`,
                ...(opcoes.body ? {"Content-Type":"application/json"} : {}),
                ...(opcoes.headers || {})
            }
        });
        let dados = {};
        try { dados = await resposta.json(); } catch {}
        if (resposta.status === 401) {
            sessionStorage.removeItem("usuarioLogado");
            location.replace("login.html");
            throw new Error("Sessão expirada.");
        }
        if (!resposta.ok) throw new Error(dados.erro || `Erro HTTP ${resposta.status}.`);
        return dados;
    }
    const idRota = () => `${raiz}/${encodeURIComponent(listaAtualId)}`;
    const jsonBody = dados => JSON.stringify(dados);
    function comLista() { return listaAtualId != null && listas.some(l => l.id === listaAtualId); }
    function camposVisiveis(ativa) {
        $("semLista").classList.toggle("lp-oculto", ativa);
        $("conteudoLista").classList.toggle("lp-oculto", !ativa);
    }
    function desenharListas() {
        $("totalListas").textContent = listas.length;
        if (!listas.length) {
            $("listasContainer").innerHTML = '<p class="lp-vazio">Você ainda não tem listas. Crie a primeira abaixo.</p>';
            return;
        }
        $("listasContainer").innerHTML = listas.map(l => `
            <button type="button" class="lp-lista-botao ${l.id===listaAtualId ? "ativa" : ""}" data-lista-id="${l.id}">
                <strong>${escapar(l.nome)}</strong>
                <small>${Number(l.pendentes)||0} pendente(s) · ${Number(l.atrasadas)||0} atrasada(s)</small>
            </button>`).join("");
    }
    async function carregarListas(manterSelecao = true) {
        const atuais = await pedir(raiz);
        listas = atuais;
        const guardado = Number(sessionStorage.getItem("lp_lista_atual") || 0);
        if (!manterSelecao || !listas.some(l => l.id === listaAtualId)) {
            listaAtualId = listas.some(l => l.id === guardado) ? guardado : listas[0]?.id ?? null;
        }
        desenharListas();
        camposVisiveis(comLista());
        if (comLista()) await carregarListaAtual();
    }
    async function selecionarLista(id) {
        if (!listas.some(l => l.id === id)) return;
        listaAtualId = id;
        sessionStorage.setItem("lp_lista_atual", String(id));
        filtro = "todas";
        $("pesquisaTarefas").value = "";
        document.querySelectorAll("[data-filtro]").forEach(b => b.classList.toggle("ativo", b.dataset.filtro === filtro));
        desenharListas();
        await carregarListaAtual();
    }
    async function carregarListaAtual() {
        if (!comLista()) return;
        const lista = listas.find(l => l.id === listaAtualId);
        $("tituloLista").textContent = lista.nome;
        $("descricaoLista").textContent = lista.descricao || "Lista exclusiva do seu usuário";
        await Promise.all([carregarDia(), carregarRecorrencias(), carregarHistorico()]);
    }
    function itemHTML(t, anterior = false) {
        const tagAtraso = anterior ? `<span class="lp-atraso-label">${diasAtraso(t.dataTarefa)} dia(s) de atraso</span>` : "";
        return `<div class="lp-item ${anterior?"atrasada":""} ${t.concluida?"concluida":""}">
            <input type="checkbox" ${t.concluida?"checked":""} data-acao="concluir" data-id="${t.id}" aria-label="${t.concluida?"Reabrir":"Concluir"} ${escapar(t.titulo)}">
            <div class="lp-item-body">
                <div class="lp-item-titulo">${escapar(t.titulo)}</div>
                ${t.descricao ? `<div class="lp-item-desc">${escapar(t.descricao)}</div>` : ""}
                <div class="lp-item-meta"><span>Prevista: ${ptData(t.dataTarefa)}</span>${tagAtraso}
                    ${t.recorrenciaId ? "<span>↻ Recorrente</span>" : ""}
                    ${t.concluida ? `<span>Concluída por ${escapar(t.concluidaPorNome || sessao.nome || "Usuário")} em ${ptDataHora(t.concluidaEm)}</span>` : ""}
                </div>
            </div>
            <div class="lp-item-acoes">
                <button type="button" data-acao="editar" data-id="${t.id}" aria-label="Editar ${escapar(t.titulo)}">Editar</button>
                <button type="button" class="excluir" data-acao="excluir" data-id="${t.id}" aria-label="Excluir ${escapar(t.titulo)}">Excluir</button>
            </div>
        </div>`;
    }
    function renderizarDia() {
        const total = dia.length;
        const concluidas = dia.filter(x => x.concluida).length;
        const pendentes = total-concluidas;
        const progresso = total ? Math.round(concluidas/total*100) : 0;
        $("qtdTotal").textContent = total;
        $("qtdPendentes").textContent = pendentes;
        $("qtdConcluidas").textContent = concluidas;
        $("qtdProgresso").textContent = `${progresso}%`;
        $("progressoTexto").textContent = `${progresso}% concluído`;
        $("contadorProgresso").textContent = `${concluidas} de ${total} concluídas`;
        $("barraDia").style.width = `${progresso}%`;
        $("btnConcluirTodas").disabled = pendentes===0;
        const busca = $("pesquisaTarefas").value.trim().toLocaleLowerCase("pt-BR");
        const validaBusca = x => !busca || `${x.titulo} ${x.descricao}`.toLocaleLowerCase("pt-BR").includes(busca);
        const dVisiveis = dia.filter(x => validaBusca(x) &&
            (filtro === "todas" || (filtro === "pendentes" && !x.concluida) || (filtro === "concluidas" && x.concluida)));
        $("listaDia").innerHTML = dVisiveis.length ? dVisiveis.map(x => itemHTML(x)).join("") :
            '<div class="lp-vazio">Nenhuma atividade correspondente para o dia escolhido.</div>';
    }
    async function carregarDia() {
        const id = listaAtualId, consulta = ++seqDetalhes;
        const data = $("dataVisualizacao").value || hoje();
        const r = await pedir(`${raiz}/${id}/dia?data=${encodeURIComponent(data)}`);
        if (id !== listaAtualId || consulta !== seqDetalhes) return;
        dia = r.dia || []; atrasadas = r.atrasadas || [];
        renderizarDia();
    }
    async function carregarRecorrencias() {
        const id = listaAtualId;
        const res = await pedir(`${raiz}/${id}/recorrencias`);
        if (id !== listaAtualId) return;
        regras = res;
        const rotulo = r => r.frequencia === "diaria" ? "Todos os dias" : r.frequencia === "uteis" ? "Seg–Sex" :
            `Semanal: ${(r.diasSemana || []).map(n => ["","Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][n] || "?").join(", ")}`;
        $("listaRecorrencias").innerHTML = res.length ? res.map(r => `<div class="lp-recorrencia">
                <div class="lp-rec-text"><strong>${escapar(r.titulo)}</strong>
                <small>${rotulo(r)} · Início ${ptData(r.dataInicio)} · ${r.ativo ? "Ativa" : "Pausada"}</small></div>
                <div class="lp-recorrencia-acao">
                    <button type="button" class="lp-btn-suave" data-regra-acao="alternar" data-regra-id="${r.id}" data-ativo="${r.ativo}">${r.ativo ? "Pausar" : "Retomar"}</button>
                    <button type="button" class="lp-btn-perigo-suave" data-regra-acao="encerrar" data-regra-id="${r.id}">Encerrar</button>
                </div>
            </div>`).join("") : '<div class="lp-vazio">Nenhuma repetição programada nesta lista.</div>';
    }
    async function carregarHistorico() {
        const id = listaAtualId;
        const r = await pedir(`${raiz}/${id}/historico`);
        if (id !== listaAtualId) return;
        historico = r.itens || [];
        $("historicoTarefas").innerHTML = historico.length ? historico.map(t => `<tr>
            <td>${ptData(t.dataTarefa)}</td>
            <td><strong>${escapar(t.titulo)}</strong>${t.descricao ? `<span class="lp-table-sub">${escapar(t.descricao)}</span>` : ""}</td>
            <td><span class="status-badge ${t.concluida ? "concluida" : "pendente"}">${t.concluida ? "Concluída" : "Pendente"}</span></td>
            <td>${t.concluida ? `${ptDataHora(t.concluidaEm)}<span class="lp-table-sub">Por ${escapar(t.concluidaPorNome || sessao.nome || "Usuário")}</span>` : "—"}</td>
        </tr>`).join("") : '<tr><td colspan="4" class="lp-muted">Nenhuma tarefa no histórico.</td></tr>';
    }
    async function atualizarTudo() { await carregarListas(); }
    async function executar(callback) {
        if (bloqueio) return;
        bloqueio = true;
        try { await callback(); }
        catch (erro) { mensagem(erro.message || "Não foi possível concluir a operação."); }
        finally { bloqueio = false; }
    }
    $("listasContainer").addEventListener("click", e => {
        const botao = e.target.closest("[data-lista-id]");
        if (!botao) return;
        executar(() => selecionarLista(Number(botao.dataset.listaId)));
    });
    $("formNovaLista").addEventListener("submit", e => {
        e.preventDefault();
        executar(async () => {
            const nome = $("nomeNovaLista").value.trim();
            const nova = await pedir(raiz, { method:"POST", body: jsonBody({nome}) });
            $("nomeNovaLista").value = "";
            await carregarListas(false);
            await selecionarLista(nova.id);
            mensagem("Lista criada com sucesso.");
        });
    });
    $("btnEditarLista").addEventListener("click", () => {
        if (!comLista()) return;
        const lista = listas.find(l => l.id === listaAtualId);
        const nome = prompt("Nome da lista:", lista.nome);
        if (nome === null) return;
        const descricao = prompt("Descrição da lista:", lista.descricao || "");
        if (descricao === null) return;
        executar(async () => {
            await pedir(idRota(), { method:"PATCH", body:jsonBody({nome:nome.trim(),descricao:descricao.trim()}) });
            await atualizarTudo(); mensagem("Lista atualizada.");
        });
    });
    $("btnExcluirLista").addEventListener("click", () => {
        if (!comLista()) return;
        const lista = listas.find(l => l.id === listaAtualId);
        if (!confirm(`Excluir definitivamente a lista "${lista.nome}" e todas as tarefas dela?\nEsta operação não pode ser desfeita.`)) return;
        executar(async () => {
            await pedir(idRota(), {method:"DELETE"});
            listaAtualId = null;
            sessionStorage.removeItem("lp_lista_atual");
            await carregarListas(false); mensagem("Lista excluída.");
        });
    });
    $("dataVisualizacao").addEventListener("change", () => executar(async () => {
        await carregarDia();
        $("dataTarefa").value = $("dataVisualizacao").value;
    }));
    $("btnHoje").addEventListener("click", () => executar(async () => {
        $("dataVisualizacao").value = hoje(); $("dataTarefa").value = hoje(); await carregarDia();
    }));
    $("pesquisaTarefas").addEventListener("input", renderizarDia);
    document.querySelectorAll("[data-filtro]").forEach(b => b.addEventListener("click", () => {
        filtro = b.dataset.filtro;
        document.querySelectorAll("[data-filtro]").forEach(x => x.classList.toggle("ativo", x===b));
        renderizarDia();
    }));
    $("frequenciaTarefa").addEventListener("change", () => {
        const f = $("frequenciaTarefa").value;
        $("diasSemanaBox").classList.toggle("lp-oculto", f !== "semanal");
        $("textoRecorrencia").textContent = f === "unica" ? "Tarefa única, com data definida." :
            "Uma ocorrência independente será criada em cada data programada.";
    });
    $("formNovaTarefa").addEventListener("submit", e => {
        e.preventDefault();
        if (!comLista()) return;
        executar(async () => {
            const dados = {
                titulo: $("tituloTarefa").value.trim(), descricao: $("descricaoTarefa").value.trim(),
                dataTarefa: $("dataTarefa").value, frequencia: $("frequenciaTarefa").value,
                diasSemana: [...$("diasSemanaBox").querySelectorAll("input:checked")].map(x => Number(x.value))
            };
            await pedir(`${idRota()}/itens`, { method:"POST", body:jsonBody(dados) });
            $("tituloTarefa").value = ""; $("descricaoTarefa").value = "";
            await atualizarTudo();
            mensagem(dados.frequencia === "unica" ? "Tarefa adicionada." : "Repetição programada com sucesso.");
        });
    });
    $("btnConcluirTodas").addEventListener("click", () => {
        if (!dia.some(x => !x.concluida) || !confirm("Concluir todas as atividades pendentes da data selecionada?")) return;
        executar(async () => {
            const r = await pedir(`${idRota()}/concluir-dia`, {method:"PATCH",body:jsonBody({dataTarefa:$("dataVisualizacao").value})});
            await atualizarTudo(); mensagem(`${r.quantidade} tarefa(s) concluída(s).`);
        });
    });
    async function tratarAcaoItem(e) {
        const b = e.target.closest("[data-acao]");
        if (!b || !comLista()) return;
        const id = Number(b.dataset.id);
        const item = [...dia,...atrasadas].find(x => x.id===id);
        if (!item) return;
        const acao = b.dataset.acao;
        if (acao === "editar") {
            $("editId").value = id;
            $("editTitulo").value = item.titulo;
            $("editDescricao").value = item.descricao || "";
            $("editData").value = item.dataTarefa;
            $("editData").disabled = Boolean(item.recorrenciaId);
            $("avisoEditar").textContent = item.recorrenciaId ? "Esta ocorrência é recorrente; a data não pode ser alterada." : "";
            $("modalEdicao").classList.remove("lp-oculto");
            $("editTitulo").focus();
        } else if (acao === "excluir") {
            if (!confirm(`Excluir a tarefa "${item.titulo}" de ${ptData(item.dataTarefa)}?`)) return;
            executar(async () => {
                await pedir(`${idRota()}/itens/${id}`, {method:"DELETE"});
                await atualizarTudo(); mensagem("Tarefa removida.");
            });
        } else if (acao === "concluir") {
            b.disabled = true;
            executar(async () => {
                await pedir(`${idRota()}/itens/${id}`, {method:"PATCH",body:jsonBody({concluida:b.checked})});
                await atualizarTudo(); mensagem(b.checked ? "Tarefa concluída." : "Tarefa reaberta.");
            });
        }
    }
    $("listaDia").addEventListener("click", e => { if (e.target.matches('[data-acao="concluir"]')) return; tratarAcaoItem(e); });
    $("listaDia").addEventListener("change", e => { if (e.target.matches('[data-acao="concluir"]')) tratarAcaoItem(e); });
    $("btnFecharEdicao").addEventListener("click", () => $("modalEdicao").classList.add("lp-oculto"));
    $("modalEdicao").addEventListener("click", e => { if(e.target===$("modalEdicao"))$("modalEdicao").classList.add("lp-oculto"); });
    document.addEventListener("keydown", e => { if(e.key==="Escape") $("modalEdicao").classList.add("lp-oculto"); });
    $("formEditarTarefa").addEventListener("submit", e => {
        e.preventDefault();
        executar(async () => {
            const id = Number($("editId").value);
            await pedir(`${idRota()}/itens/${id}`, {method:"PATCH",body:jsonBody({
                titulo:$("editTitulo").value.trim(),descricao:$("editDescricao").value.trim(),dataTarefa:$("editData").value
            })});
            $("modalEdicao").classList.add("lp-oculto");
            await atualizarTudo(); mensagem("Tarefa atualizada.");
        });
    });
    $("listaRecorrencias").addEventListener("click", e => {
        const botao = e.target.closest("[data-regra-acao]");
        if (!botao) return;
        const id = Number(botao.dataset.regraId), acao=botao.dataset.regraAcao;
        if (acao === "encerrar" && !confirm("Encerrar esta repetição? As tarefas já geradas permanecerão no histórico.")) return;
        executar(async () => {
            if (acao === "encerrar") await pedir(`${idRota()}/recorrencias/${id}`, {method:"DELETE"});
            else await pedir(`${idRota()}/recorrencias/${id}`, {
                method:"PATCH",body:jsonBody({ativo:botao.dataset.ativo!=="true"})
            });
            await atualizarTudo(); mensagem(acao === "encerrar" ? "Repetição encerrada." : "Repetição atualizada.");
        });
    });
    $("btnAtualizarHistorico").addEventListener("click", () => executar(carregarHistorico));
    $("btnSair").addEventListener("click", () => {
        if (!confirm("Deseja sair do sistema?")) return;
        fetch(`${API}/api/logout`, {method:"POST",credentials:"include",keepalive:true}).catch(()=>{});
        sessionStorage.removeItem("usuarioLogado"); location.href="login.html";
    });
    window.addEventListener('ca:reconexao', () => {
        if (!bloqueio) carregarListas().catch(erro => console.warn('Minhas Listas: reconexão falhou', erro.message));
    });
    carregarListas().catch(e => {
        console.error(e);
        $("listasContainer").innerHTML = `<p class="lp-vazio">Não foi possível carregar suas listas: ${escapar(e.message)}</p>`;
        mensagem(e.message);
    });
})();
