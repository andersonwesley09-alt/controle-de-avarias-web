/* =========================================================
   NOTIFICAÇÕES - V21.6
   Persistentes no PostgreSQL e individualizadas por usuário.
   - Usuário: novas tarefas atribuídas.
   - ADM: novas tarefas, conclusões e reaberturas.
========================================================= */
(() => {
    const sessao = (() => {
        try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); }
        catch { return null; }
    })();
    if (!sessao || !sessao.token) return;

    const area = document.getElementById("areaNotificacoesAdmin");
    const botao = document.getElementById("btnNotificacoesAdmin");
    const badge = document.getElementById("badgeNotificacoesAdmin");
    const painel = document.getElementById("painelNotificacoesAdmin");
    const lista = document.getElementById("listaNotificacoesAdmin");
    const subtitulo = document.getElementById("subtituloNotificacoesAdmin");
    const btnLidas = document.getElementById("btnMarcarNotificacoesLidas");
    const btnLimparLidas = document.getElementById("btnLimparNotificacoesLidas");
    if (!area || !botao || !badge || !painel || !lista || !subtitulo || !btnLidas || !btnLimparLidas) return;

    const API = window.CA_API_BASE || (window.CA_LOCAL_MODE ? "" : (window.location.origin || "http://localhost:3000"));

    let notificacoes = [];
    let naoLidas = 0;
    let carregando = false;

    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

    function tipoVisual(tipo) {
        if (tipo === "tarefa_concluida") return { icone: "☑️", classe: "concluida" };
        if (tipo === "tarefa_reaberta") return { icone: "↩️", classe: "reaberta" };
        return { icone: "📋", classe: "nova-tarefa" };
    }

    function tempoRelativo(data) {
        if (!data) return "Agora";
        const instante = new Date(data).getTime();
        if (!Number.isFinite(instante)) return "Agora";
        const segundos = Math.max(0, Math.floor((Date.now() - instante) / 1000));
        if (segundos < 60) return "Agora";
        const minutos = Math.floor(segundos / 60);
        if (minutos < 60) return `Há ${minutos} min`;
        const horas = Math.floor(minutos / 60);
        if (horas < 24) return `Há ${horas} h`;
        const dias = Math.floor(horas / 24);
        if (dias === 1) return "Ontem";
        if (dias < 7) return `Há ${dias} dias`;
        return typeof formatarDataManaira === "function" ? formatarDataManaira(data) : new Date(data).toLocaleString("pt-BR");
    }

    function atualizarCabecalho() {
        badge.textContent = naoLidas > 99 ? "99+" : String(naoLidas);
        badge.classList.toggle("zero", naoLidas === 0);
        subtitulo.textContent = naoLidas
            ? `${naoLidas} nova${naoLidas === 1 ? "" : "s"} para você`
            : "Tudo em dia";
        btnLidas.disabled = naoLidas === 0;
        btnLimparLidas.disabled = !notificacoes.some(item => item.lida);
    }

    function renderizar() {
        atualizarCabecalho();
        if (!notificacoes.length) {
            lista.innerHTML = `
                <div class="notificacao-vazia">
                    <div class="notificacao-vazia-icone">✓</div>
                    <strong>Nenhuma notificação</strong>
                    <span>Quando houver uma atualização importante, ela aparecerá aqui.</span>
                </div>`;
            return;
        }

        lista.innerHTML = notificacoes.map(item => {
            const visual = tipoVisual(item.tipo);
            return `
                <button class="notificacao-item ${item.lida ? "lida" : "nova"}" type="button" data-notificacao-id="${esc(item.id)}">
                    <span class="notificacao-icone ${visual.classe}">${visual.icone}</span>
                    <span class="notificacao-conteudo">
                        <strong>${esc(item.titulo)}</strong>
                        <span class="notificacao-mensagem">${esc(item.mensagem || "Atualização de tarefa.")}</span>
                        <small>${esc(tempoRelativo(item.criadoEm))}</small>
                    </span>
                    ${item.lida ? '<span class="notificacao-lida">Lida</span>' : '<span class="notificacao-ponto" aria-label="Nova"></span>'}
                </button>`;
        }).join("");

        lista.querySelectorAll("[data-notificacao-id]").forEach(item => {
            item.addEventListener("click", async () => {
                const id = item.dataset.notificacaoId;
                await marcarUmaComoLida(id);
                if (window.location.pathname.endsWith("tarefas.html")) {
                    painel.classList.add("oculto");
                    botao.classList.remove("ativo");
                    botao.setAttribute("aria-expanded", "false");
                } else {
                    window.location.href = "tarefas.html";
                }
            });
        });
    }

    async function carregar({ pulsar = false } = {}) {
        if (carregando) return;
        carregando = true;
        try {
            const resposta = await fetch(`${API}/api/notificacoes`, {
                headers: { Authorization: `Bearer ${sessao.token}` },
                credentials: "include",
                cache: "no-store"
            });
            if (!resposta.ok) throw new Error("Falha ao carregar notificações.");
            const dados = await resposta.json();
            const anterior = naoLidas;
            notificacoes = Array.isArray(dados.notificacoes) ? dados.notificacoes : [];
            naoLidas = Number(dados.naoLidas || 0);
            renderizar();
            if (pulsar && naoLidas > anterior) {
                botao.classList.remove("pulsando");
                void botao.offsetWidth;
                botao.classList.add("pulsando");
            }
        } catch (erro) {
            console.warn("Não foi possível carregar notificações:", erro);
            lista.innerHTML = `<div class="notificacao-vazia erro"><strong>Não foi possível atualizar.</strong><span>Tente novamente em alguns segundos.</span></div>`;
        } finally {
            carregando = false;
        }
    }

    async function marcarUmaComoLida(id) {
        try {
            const resposta = await fetch(`${API}/api/notificacoes/${encodeURIComponent(id)}/lida`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${sessao.token}` },
                credentials: "include"
            });
            if (!resposta.ok) throw new Error("Falha ao marcar a notificação.");
            await carregar();
        } catch (erro) {
            console.warn("Não foi possível marcar a notificação:", erro);
        }
    }

    async function marcarTodasComoLidas() {
        if (!naoLidas) return;
        btnLidas.disabled = true;
        try {
            const resposta = await fetch(`${API}/api/notificacoes/lidas`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${sessao.token}` },
                credentials: "include"
            });
            if (!resposta.ok) throw new Error("Falha ao marcar notificações.");
            await carregar();
        } catch (erro) {
            console.warn(erro);
        } finally {
            atualizarCabecalho();
        }
    }

    async function limparLidas() {
        if (!notificacoes.some(item => item.lida)) return;
        if (!window.confirm("Limpar as notificações que já estão lidas?")) return;
        btnLimparLidas.disabled = true;
        try {
            const resposta = await fetch(`${API}/api/notificacoes/lidas`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${sessao.token}` },
                credentials: "include"
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.erro || "Falha ao limpar notificações.");
            await carregar();
        } catch (erro) {
            console.warn("Não foi possível limpar notificações:", erro);
        } finally {
            atualizarCabecalho();
        }
    }

    area.classList.remove("oculto");
    botao.setAttribute("aria-label", "Abrir notificações");
    botao.title = "Notificações";
    btnLidas.textContent = "Marcar todas como lidas";
    btnLimparLidas.textContent = "Limpar lidas";

    botao.addEventListener("click", event => {
        event.stopPropagation();
        const aberto = !painel.classList.contains("oculto");
        painel.classList.toggle("oculto", aberto);
        botao.classList.toggle("ativo", !aberto);
        botao.setAttribute("aria-expanded", String(!aberto));
        if (!aberto) carregar();
    });

    btnLidas.addEventListener("click", async event => {
        event.stopPropagation();
        await marcarTodasComoLidas();
    });

    btnLimparLidas.addEventListener("click", async event => {
        event.stopPropagation();
        await limparLidas();
    });

    document.addEventListener("click", event => {
        if (!area.contains(event.target)) {
            painel.classList.add("oculto");
            botao.classList.remove("ativo");
            botao.setAttribute("aria-expanded", "false");
        }
    });

    carregar();

    if (typeof EventSource !== "undefined") {
        const eventos = new EventSource(`${API}/api/eventos`);
        eventos.addEventListener("tarefas-atualizadas", () => carregar({ pulsar: true }));
    }

    setInterval(() => carregar(), 60000);
})();
