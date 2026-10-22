/* BUILD V20.1 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================
   ELEMENTOS
========================= */

const nomeUsuario =
    document.getElementById(
        "nomeUsuario"
    );


const mensagemBoasVindas =
    document.getElementById(
        "mensagemBoasVindas"
    );


const btnSair =
    document.getElementById(
        "btnSair"
    );


const botoesModulo =
    document.querySelectorAll(
        ".modulo-card"
    );


const moduloUsuarios =
    document.getElementById(
        "moduloUsuarios"
    );

const moduloDashboard = document.getElementById('moduloDashboard');

const moduloProdutos =
    document.getElementById(
        "moduloProdutos"
    );

const moduloAuditoria =
    document.getElementById(
        "moduloAuditoria"
    );


const moduloTarefas =
    document.getElementById(
        "moduloTarefas"
    );


const tarefasPendentes =
    document.getElementById(
        "tarefasPendentes"
    );


/* =========================
   VERIFICAR LOGIN
========================= */

function verificarLogin() {

    const dadosSessao =
        sessionStorage.getItem(
            "usuarioLogado"
        );


    if (!dadosSessao) {

        window.location.href =
            "login.html";

        return null;

    }


    try {

        return JSON.parse(
            dadosSessao
        );

    }

    catch (erro) {

        fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include",
                keepalive: true
            }
        ).catch(() => {});

        sessionStorage.removeItem(
            "usuarioLogado"
        );


        window.location.href =
            "login.html";


        return null;

    }

}


/* =========================
   CARREGAR USUÁRIO
========================= */

const usuarioLogado =
    verificarLogin();


if (usuarioLogado) {

    nomeUsuario.textContent =
        usuarioLogado.nome;


    mensagemBoasVindas.textContent =
        "Bem-vindo, " +
        usuarioLogado.nome;


    if (
        usuarioLogado.perfil === "admin" &&
        usuarioLogado.token
    ) {

        [moduloUsuarios, moduloProdutos, moduloAuditoria]
            .filter(Boolean)
            .forEach(modulo => modulo.classList.remove("oculto"));

    }

    carregarResumoTarefas();

}


/* =========================
   SAIR
========================= */

btnSair.addEventListener(
    "click",
    function () {

        const confirmar =
            confirm(
                "Deseja sair do sistema?"
            );


        if (!confirmar) {

            return;

        }


        fetch(
            "/api/logout",
            {
                method: "POST",
                credentials: "include",
                keepalive: true
            }
        ).catch(() => {});

        sessionStorage.removeItem(
            "usuarioLogado"
        );


        window.location.href =
            "login.html";

    }
);


/* =========================
   MÓDULOS
========================= */

botoesModulo.forEach(
    botao => {

        botao.addEventListener(
            "click",
            function () {

                const modulo =
                    botao.dataset.modulo;


                abrirModulo(
                    modulo
                );

            }
        );

    }
);


/* =========================
   ABRIR MÓDULO
========================= */

async function abrirDashboardComSessao() {
    const sessaoLocal = usuarioLogado || (() => {
        try { return JSON.parse(sessionStorage.getItem("usuarioLogado") || "null"); } catch { return null; }
    })();

    const headers = {};
    if (sessaoLocal?.token) {
        headers.Authorization = `Bearer ${sessaoLocal.token}`;
    }

    try {
        const resposta = await fetch("/api/sessao", {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers
        });

        if (resposta.ok) {
            const dados = await resposta.json();
            const sessaoAtual = {
                usuario: dados.usuario,
                nome: dados.nome,
                perfil: dados.perfil,
                token: sessaoLocal?.token || "",
                loginEm: sessaoLocal?.loginEm || new Date().toISOString()
            };
            sessionStorage.setItem("usuarioLogado", JSON.stringify(sessaoAtual));
            // A chamada acima também garante que o cookie HttpOnly esteja
            // disponível para a próxima página quando a autenticação veio por Bearer.
            window.location.href = "index.html";
            return;
        }

        if (resposta.status === 401 || resposta.status === 403) {
            sessionStorage.removeItem("usuarioLogado");
            window.location.href = "login.html";
            return;
        }

        throw new Error(`HTTP ${resposta.status}`);
    } catch (erro) {
        console.error("Não foi possível validar a sessão antes de abrir o Dashboard:", erro);
        alert("Não foi possível validar sua sessão. Verifique se o servidor está ativo.");
    }
}

function abrirModulo(modulo) {


    /* =========================
       DASHBOARD
    ========================= */

    if (modulo === "dashboard") {
        abrirDashboardComSessao();
        return;
    }


    /* =========================
       AVARIAS E BAIXAS
    ========================= */

    if (modulo === "avarias") {

        window.location.href =
            "avarias.html";

        return;

    }


    /* =========================
       CAIXAS
    ========================= */

    if (modulo === "caixas") {

        window.location.href =
            "caixas.html";

        return;

    }


    /* =========================
       TAREFAS DIÁRIAS
    ========================= */

    if (modulo === "tarefas") {

        window.location.href =
            "tarefas.html";

        return;

    }


    /* =========================
       PRODUTOS
    ========================= */

    if (modulo === "produtos") {

        if (!usuarioLogado || usuarioLogado.perfil !== "admin") {
            alert("Apenas o administrador pode acessar a atualização dos produtos.");
            return;
        }

        window.location.href =
            "produtos.html";

        return;

    }


    if (modulo === "auditoria") {

        if (!usuarioLogado || usuarioLogado.perfil !== "admin") {
            alert("Apenas o administrador pode acessar o histórico de alterações.");
            return;
        }

        window.location.href = "auditoria.html";
        return;

    }


    /* =========================
       RECUPERAÇÃO DE PRODUTOS
    ========================= */

    if (modulo === "recuperacao") {
        window.location.href = "recuperacao.html";
        return;
    }


    /* =========================
       USUÁRIOS - ADMIN
    ========================= */

    if (modulo === "usuarios") {

        if (
            !usuarioLogado ||
            usuarioLogado.perfil !== "admin"
        ) {

            alert(
                "Apenas o administrador pode acessar usuários."
            );

            return;

        }


        window.location.href =
            "usuarios.html";

        return;

    }

}


/* =========================
   RESUMO DE TAREFAS
========================= */

async function carregarResumoTarefas() {

    if (!tarefasPendentes || !usuarioLogado || !usuarioLogado.token) {
        return;
    }

    try {
        const hoje = hojeSistema();
        const resposta = await fetch(
            `/api/tarefas/minhas?data=${encodeURIComponent(hoje)}`,
            {
                headers: {
                    "Authorization": `Bearer ${usuarioLogado.token}`
                },
                cache: "no-store"
            }
        );

        if (!resposta.ok) {
            throw new Error("Não foi possível carregar as tarefas.");
        }

        const tarefas = await resposta.json();
        const pendentes = tarefas.filter(item => !item.concluida).length;

        tarefasPendentes.textContent =
            pendentes === 1
                ? "1 tarefa pendente hoje"
                : `${pendentes} tarefas pendentes hoje`;

        tarefasPendentes.classList.toggle("zerado", pendentes === 0);

    } catch (erro) {
        console.warn("Não foi possível carregar o resumo de tarefas:", erro);
        tarefasPendentes.textContent = "Checklist diário";
    }
}
