(() => {
    const sessao = (() => {
        try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); }
        catch { return null; }
    })();

    if (!sessao || !sessao.token) {
        window.location.href = "login.html";
        return;
    }

    const API = window.CA_API_BASE || "";

    const nomeUsuario = document.getElementById("nomeUsuario");
    const btnSair = document.getElementById("btnSair");
    const form = document.getElementById("formAviso");
    const titulo = document.getElementById("tituloAviso");
    const mensagem = document.getElementById("mensagemAviso");
    const contador = document.getElementById("contadorAviso");
    const btnPublicar = document.getElementById("btnPublicarAviso");
    const btnAtualizar = document.getElementById("btnAtualizarAvisos");
    const lista = document.getElementById("listaAvisos");
    const status = document.getElementById("statusAvisos");

    nomeUsuario.textContent = sessao.nome || sessao.usuario || "-";

    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[c]);

    function formatarData(valor) {
        const data = new Date(valor);
        if (!Number.isFinite(data.getTime())) return "Data não informada";
        return data.toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    function atualizarContador() {
        contador.textContent = `${mensagem.value.length} / 5000`;
    }

    async function requisicao(url, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${sessao.token}`);
        headers.set("Accept", "application/json");
        if (options.body && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        let resposta;
        try {
            resposta = await fetch(`${API}${url}`, {
                ...options,
                headers,
                credentials: "include",
                cache: "no-store"
            });
        } catch (erro) {
            throw new Error(`Não foi possível conectar ao servidor do Controle de Avarias (${API}).`);
        }

        const dados = await resposta.json().catch(() => ({}));
        if (resposta.status === 401 || resposta.status === 403) {
            sessionStorage.removeItem("usuarioLogado");
            window.location.href = "login.html";
            throw new Error(dados.erro || "Sessão expirada.");
        }
        if (!resposta.ok) {
            throw new Error(dados.erro || `Erro HTTP ${resposta.status}`);
        }
        return dados;
    }

    function renderizar(avisos) {
        if (!avisos.length) {
            lista.innerHTML = `<div class="aviso-vazio">📢<br><strong>Nenhum aviso publicado.</strong><br>Publique o primeiro comunicado para a equipe.</div>`;
            return;
        }

        lista.innerHTML = avisos.map(item => `
            <article class="aviso-item">
                <div class="aviso-conteudo">
                    <h3>${esc(item.titulo)}</h3>
                    <p class="aviso-mensagem">${esc(item.mensagem)}</p>
                    <div class="aviso-meta">Publicado por <strong>${esc(item.usuarioNome || "Usuário")}</strong> em ${esc(formatarData(item.criadoEm))}</div>
                </div>
                <button class="btn-excluir-aviso" type="button" data-excluir-aviso="${esc(item.id)}">🗑 Excluir aviso</button>
            </article>
        `).join("");

        lista.querySelectorAll("[data-excluir-aviso]").forEach(botao => {
            botao.addEventListener("click", async () => {
                const id = botao.dataset.excluirAviso;
                if (!confirm("Deseja excluir este aviso?")) return;
                botao.disabled = true;
                try {
                    await requisicao(`/api/avisos/${encodeURIComponent(id)}`, { method: "DELETE" });
                    await carregarAvisos();
                } catch (erro) {
                    alert(erro.message || "Não foi possível excluir o aviso.");
                    botao.disabled = false;
                }
            });
        });
    }

    async function carregarAvisos() {
        status.textContent = "Atualizando avisos...";
        try {
            const dados = await requisicao("/api/avisos");
            const avisos = Array.isArray(dados.avisos) ? dados.avisos : [];
            renderizar(avisos);
            status.textContent = `${avisos.length} aviso${avisos.length === 1 ? "" : "s"} publicado${avisos.length === 1 ? "" : "s"}.`;
        } catch (erro) {
            status.textContent = "Não foi possível carregar os avisos.";
            lista.innerHTML = `<div class="aviso-vazio">${esc(erro.message || "Erro ao carregar avisos.")}</div>`;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const tituloValor = titulo.value.trim();
        const mensagemValor = mensagem.value.trim();
        if (!tituloValor || !mensagemValor) {
            alert("Preencha o título e a mensagem do aviso.");
            return;
        }

        btnPublicar.disabled = true;
        btnPublicar.textContent = "Publicando...";
        try {
            await requisicao("/api/avisos", {
                method: "POST",
                body: JSON.stringify({ titulo: tituloValor, mensagem: mensagemValor })
            });
            form.reset();
            atualizarContador();
            await carregarAvisos();
            titulo.focus();
        } catch (erro) {
            alert(erro.message || "Não foi possível publicar o aviso.");
        } finally {
            btnPublicar.disabled = false;
            btnPublicar.textContent = "📢 Publicar aviso";
        }
    });

    mensagem.addEventListener("input", atualizarContador);
    btnAtualizar.addEventListener("click", carregarAvisos);

    btnSair.addEventListener("click", async () => {
        if (!confirm("Deseja sair do sistema?")) return;
        try { await requisicao("/api/logout", { method: "POST" }); } catch {}
        sessionStorage.removeItem("usuarioLogado");
        window.location.href = "login.html";
    });

    // Tempo real. O token vai na URL porque EventSource não permite Authorization header.
    try {
        const eventos = new EventSource(`${API}/api/eventos?token=${encodeURIComponent(sessao.token)}`);
        eventos.addEventListener("avisos-atualizados", () => carregarAvisos());
        eventos.onerror = () => {};
    } catch (_) {}

    atualizarContador();
    carregarAvisos();
})();
