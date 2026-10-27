const formatarDataHoraSistema = (valor) => {
    if (typeof window.formatarDataHoraManaira === "function") return window.formatarDataHoraManaira(valor);
    const d = valor instanceof Date ? valor : new Date(valor);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d);
};

/* BUILD V20.3 - base consolidada, sessão centralizada e histórico corrigido */
/* =========================================================
   USUÁRIOS - ADMIN
========================================================= */

const API = window.CA_API_BASE || (window.CA_LOCAL_MODE ? "" : (window.location.origin || "http://localhost:3000"));


let usuarios = [];


function obterSessao() {

    try {

        return JSON.parse(
            sessionStorage.getItem(
                "usuarioLogado"
            ) || "null"
        );

    } catch {

        return null;

    }

}


const sessao =
    obterSessao();


if (
    !sessao ||
    sessao.perfil !== "admin" ||
    !sessao.token
) {

    window.location.href =
        sessao
            ? "sistema.html"
            : "login.html";

}


const formUsuario =
    document.getElementById(
        "formUsuario"
    );

const nome =
    document.getElementById(
        "nome"
    );

const usuario =
    document.getElementById(
        "usuario"
    );

const senha =
    document.getElementById(
        "senha"
    );

const confirmarSenha =
    document.getElementById(
        "confirmarSenha"
    );

const btnCriar =
    document.getElementById(
        "btnCriar"
    );

const busca =
    document.getElementById(
        "busca"
    );

const tabelaUsuarios =
    document.getElementById(
        "tabelaUsuarios"
    );

const totalUsuarios =
    document.getElementById(
        "totalUsuarios"
    );

const usuariosAtivos =
    document.getElementById(
        "usuariosAtivos"
    );

const usuariosInativos =
    document.getElementById(
        "usuariosInativos"
    );

const btnSair =
    document.getElementById(
        "btnSair"
    );

const toast =
    document.getElementById(
        "toast"
    );

const modalSenha =
    document.getElementById("modalSenha");

const modalSenhaNome =
    document.getElementById("modalSenhaNome");

const btnFecharModalSenha =
    document.getElementById("btnFecharModalSenha");

const btnCancelarModalSenha =
    document.getElementById("btnCancelarModalSenha");

const btnRedefinirModalSenha =
    document.getElementById("btnRedefinirModalSenha");

const modalEditarUsuario =
    document.getElementById("modalEditarUsuario");

const editarNome =
    document.getElementById("editarNome");

const editarUsuario =
    document.getElementById("editarUsuario");

const btnFecharModalEditar =
    document.getElementById("btnFecharModalEditar");

const btnCancelarModalEditar =
    document.getElementById("btnCancelarModalEditar");

const btnSalvarModalEditar =
    document.getElementById("btnSalvarModalEditar");

let usuarioSenhaModal = null;
let usuarioEdicaoModal = null;


function esc(valor) {

    return String(
        valor ?? ""
    ).replace(
        /[&<>"']/g,
        caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]
    );

}


function dataHora(valor) {

    if (!valor) return "-";

    const data =
        new Date(valor);

    if (
        Number.isNaN(
            data.getTime()
        )
    ) {

        return "-";

    }

    return formatarDataHoraSistema(data);

}


let timerToast;

function mostrarToast(mensagem) {

    toast.textContent =
        mensagem;

    toast.classList.add(
        "ativo"
    );

    clearTimeout(
        timerToast
    );

    timerToast =
        setTimeout(
            () =>
                toast.classList.remove(
                    "ativo"
                ),
            2800
        );

}


function headersAdmin() {

    return {
        "Content-Type":
            "application/json",
        "Authorization":
            `Bearer ${sessao.token}`
    };

}


async function tratarResposta(
    resposta
) {

    let dados = {};

    try {

        dados =
            await resposta.json();

    } catch {}


    if (
        resposta.status === 401 ||
        resposta.status === 403
    ) {

        sessionStorage.removeItem(
            "usuarioLogado"
        );

        alert(
            dados.erro ||
            "Sua sessão expirou. Faça login novamente."
        );

        window.location.href =
            "login.html";

        throw new Error(
            dados.erro ||
            "Sessão inválida."
        );

    }


    if (!resposta.ok) {

        throw new Error(
            dados.erro ||
            "Não foi possível concluir a operação."
        );

    }


    return dados;

}


async function carregarUsuarios() {

    try {

        const resposta =
            await fetch(
                `${API}/api/usuarios`,
                {
                    headers:
                        headersAdmin()
                }
            );

        usuarios =
            await tratarResposta(
                resposta
            );

        atualizarResumo();
        renderizarUsuarios();

    } catch (erro) {

        console.error(
            erro
        );

        tabelaUsuarios.innerHTML = `
            <tr>
                <td colspan="6" class="vazio">
                    Não foi possível carregar os usuários.
                </td>
            </tr>
        `;

        mostrarToast(
            erro.message
        );

    }

}


function atualizarResumo() {

    totalUsuarios.textContent =
        usuarios.length;

    usuariosAtivos.textContent =
        usuarios.filter(
            item => item.ativo
        ).length;

    usuariosInativos.textContent =
        usuarios.filter(
            item => !item.ativo
        ).length;

}


function obterFiltrados() {

    const termo =
        busca.value
            .trim()
            .toLowerCase();

    if (!termo) {

        return usuarios;

    }

    return usuarios.filter(
        item =>
            `${item.nome} ${item.usuario}`
                .toLowerCase()
                .includes(termo)
    );

}


function renderizarUsuarios() {

    const lista =
        obterFiltrados();

    if (!lista.length) {

        tabelaUsuarios.innerHTML = `
            <tr>
                <td colspan="6" class="vazio">
                    Nenhum usuário encontrado.
                </td>
            </tr>
        `;

        return;

    }


    tabelaUsuarios.innerHTML =
        lista.map(
            item => {

                const admin =
                    item.perfil === "admin";

                const situacao =
                    item.ativo
                        ? "Ativo"
                        : "Inativo";

                return `
                    <tr>
                        <td>
                            <strong>${esc(item.nome)}</strong>
                        </td>
                        <td>${esc(item.usuario)}</td>
                        <td>
                            <span class="badge ${admin ? "admin" : "usuario"}">
                                ${admin ? "Administrador" : "Usuário"}
                            </span>
                        </td>
                        <td>
                            <span class="badge ${item.ativo ? "ativo" : "inativo"}">
                                ${situacao}
                            </span>
                        </td>
                        <td>${dataHora(item.criadoEm)}</td>
                        <td>
                            <div class="acoes">
                                <button
                                    type="button"
                                    class="btn-editar-usuario"
                                    data-id="${item.id}"
                                    data-nome="${esc(item.nome)}"
                                    data-usuario="${esc(item.usuario)}"
                                >
                                    Editar
                                </button>

                                ${admin && item.usuario === sessao.usuario ? "" : `
                                    <button
                                        type="button"
                                        class="btn-status ${item.ativo ? "desativar" : "ativar"}"
                                        data-id="${item.id}"
                                        data-ativo="${item.ativo ? "false" : "true"}"
                                    >
                                        ${item.ativo ? "Desativar" : "Ativar"}
                                    </button>
                                `}

                                <button
                                    type="button"
                                    class="btn-senha"
                                    data-id="${item.id}"
                                    data-nome="${esc(item.nome)}"
                                >
                                    Redefinir senha
                                </button>

                                ${item.usuario === sessao.usuario ? "" : `
                                    <button
                                        type="button"
                                        class="btn-excluir-usuario"
                                        data-id="${item.id}"
                                        data-nome="${esc(item.nome)}"
                                        data-usuario="${esc(item.usuario)}"
                                    >
                                        Excluir
                                    </button>
                                `}
                            </div>
                        </td>
                    </tr>
                `;

            }
        ).join("");


    tabelaUsuarios
        .querySelectorAll(
            ".btn-editar-usuario"
        )
        .forEach(
            botao => {
                botao.addEventListener(
                    "click",
                    () => abrirModalEditarUsuario(
                        botao.dataset.id,
                        botao.dataset.nome,
                        botao.dataset.usuario
                    )
                );
            }
        );


    tabelaUsuarios
        .querySelectorAll(
            ".btn-status"
        )
        .forEach(
            botao => {

                botao.addEventListener(
                    "click",
                    () => alterarStatus(
                        botao.dataset.id,
                        botao.dataset.ativo === "true"
                    )
                );

            }
        );


    tabelaUsuarios
        .querySelectorAll(
            ".btn-senha"
        )
        .forEach(
            botao => {

                botao.addEventListener(
                    "click",
                    () => redefinirSenha(
                        botao.dataset.id,
                        botao.dataset.nome
                    )
                );

            }
        );


    tabelaUsuarios
        .querySelectorAll(
            ".btn-ver-senha"
        )
        .forEach(
            botao => {

                botao.addEventListener(
                    "click",
                    () => abrirModalSenha(
                        botao.dataset.id,
                        botao.dataset.nome
                    )
                );

            }
        );


    tabelaUsuarios
        .querySelectorAll(
            ".btn-excluir-usuario"
        )
        .forEach(
            botao => {

                botao.addEventListener(
                    "click",
                    () => excluirUsuario(
                        botao.dataset.id,
                        botao.dataset.nome,
                        botao.dataset.usuario
                    )
                );

            }
        );

}


formUsuario.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const nomeValor =
            nome.value.trim();

        const usuarioValor =
            usuario.value
                .trim()
                .toLowerCase();

        const senhaValor =
            senha.value;

        const confirmarValor =
            confirmarSenha.value;


        if (
            senhaValor !==
            confirmarValor
        ) {

            mostrarToast(
                "As senhas não conferem."
            );

            confirmarSenha.focus();
            return;

        }


        btnCriar.disabled =
            true;

        const texto =
            btnCriar.textContent;

        btnCriar.textContent =
            "Criando...";


        try {

            const resposta =
                await fetch(
                    `${API}/api/usuarios`,
                    {
                        method: "POST",
                        headers: headersAdmin(),
                        body: JSON.stringify({
                            nome: nomeValor,
                            usuario: usuarioValor,
                            senha: senhaValor
                        })
                    }
                );

            await tratarResposta(
                resposta
            );

            formUsuario.reset();

            mostrarToast(
                "Usuário criado com sucesso."
            );

            await carregarUsuarios();

            nome.focus();

        } catch (erro) {

            console.error(
                erro
            );

            mostrarToast(
                erro.message
            );

        } finally {

            btnCriar.disabled =
                false;

            btnCriar.textContent =
                texto;

        }

    }
);


async function alterarStatus(
    id,
    ativo
) {

    const item =
        usuarios.find(
            usuarioItem =>
                String(usuarioItem.id) ===
                String(id)
        );

    if (!item) return;

    const acao =
        ativo
            ? "ativar"
            : "desativar";

    if (
        !confirm(
            `Deseja ${acao} o usuário "${item.nome}"?`
        )
    ) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `${API}/api/usuarios/${encodeURIComponent(id)}/status`,
                {
                    method: "PATCH",
                    headers: headersAdmin(),
                    body: JSON.stringify({
                        ativo
                    })
                }
            );

        await tratarResposta(
            resposta
        );

        mostrarToast(
            ativo
                ? "Usuário ativado."
                : "Usuário desativado."
        );

        await carregarUsuarios();

    } catch (erro) {

        mostrarToast(
            erro.message
        );

    }

}


function abrirModalEditarUsuario(id, nomeUsuario, loginUsuario) {
    const item = usuarios.find(
        usuarioItem => String(usuarioItem.id) === String(id)
    );

    if (!item) {
        mostrarToast("Usuário não encontrado.");
        return;
    }

    usuarioEdicaoModal = {
        id: String(item.id),
        usuarioOriginal: String(item.usuario || "")
    };

    editarNome.value = String(nomeUsuario || item.nome || "");
    editarUsuario.value = String(loginUsuario || item.usuario || "");

    modalEditarUsuario.classList.add("ativo");
    modalEditarUsuario.setAttribute("aria-hidden", "false");

    setTimeout(() => editarNome.focus(), 0);
}


function fecharModalEditarUsuario() {
    modalEditarUsuario.classList.remove("ativo");
    modalEditarUsuario.setAttribute("aria-hidden", "true");
    usuarioEdicaoModal = null;
}


async function salvarEdicaoUsuario() {
    if (!usuarioEdicaoModal) return;

    const alvo = usuarioEdicaoModal;
    const novoNome = editarNome.value.trim();
    const novoUsuario = editarUsuario.value.trim().toLowerCase();

    if (!novoNome) {
        mostrarToast("Informe o nome do usuário.");
        editarNome.focus();
        return;
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(novoUsuario)) {
        mostrarToast("O usuário deve ter de 3 a 40 caracteres e usar apenas letras, números, ponto, hífen ou underline.");
        editarUsuario.focus();
        return;
    }

    const textoOriginal = btnSalvarModalEditar.textContent;
    btnSalvarModalEditar.disabled = true;
    btnSalvarModalEditar.textContent = "Salvando...";

    try {
        const resposta = await fetch(
            `${API}/api/usuarios/${encodeURIComponent(alvo.id)}`,
            {
                method: "PATCH",
                headers: headersAdmin(),
                body: JSON.stringify({
                    nome: novoNome,
                    usuario: novoUsuario
                })
            }
        );

        const dados = await tratarResposta(resposta);

        if (String(alvo.id) === String(sessao.id || "") || alvo.usuarioOriginal === sessao.usuario) {
            const sessaoAtualizada = {
                ...sessao,
                nome: dados.nome || novoNome,
                usuario: dados.usuario || novoUsuario
            };
            sessionStorage.setItem("usuarioLogado", JSON.stringify(sessaoAtualizada));
            sessao.nome = sessaoAtualizada.nome;
            sessao.usuario = sessaoAtualizada.usuario;
        }

        fecharModalEditarUsuario();
        mostrarToast("Usuário atualizado com sucesso.");
        await carregarUsuarios();
    } catch (erro) {
        console.error(erro);
        mostrarToast(erro.message);
    } finally {
        btnSalvarModalEditar.disabled = false;
        btnSalvarModalEditar.textContent = textoOriginal;
    }
}


function abrirModalSenha(id, nomeUsuario) {

    usuarioSenhaModal = {
        id: String(id),
        nome: String(nomeUsuario || "usuário")
    };

    modalSenhaNome.textContent = usuarioSenhaModal.nome;
    modalSenha.classList.add("ativo");
    modalSenha.setAttribute("aria-hidden", "false");

}


function fecharModalSenha() {

    modalSenha.classList.remove("ativo");
    modalSenha.setAttribute("aria-hidden", "true");
    usuarioSenhaModal = null;

}


async function redefinirSenhaDoModal() {

    if (!usuarioSenhaModal) return;

    const alvo = usuarioSenhaModal;
    fecharModalSenha();
    await redefinirSenha(alvo.id, alvo.nome);

}


async function redefinirSenha(
    id,
    nomeUsuario
) {

    const novaSenha =
        prompt(
            `Digite a nova senha para ${nomeUsuario}:`
        );

    if (novaSenha === null) {

        return;

    }

    if (novaSenha.length < 6) {

        mostrarToast(
            "A senha precisa ter pelo menos 6 caracteres."
        );

        return;

    }

    if (
        !confirm(
            `Confirmar redefinição da senha de "${nomeUsuario}"?`
        )
    ) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `${API}/api/usuarios/${encodeURIComponent(id)}/senha`,
                {
                    method: "PATCH",
                    headers: headersAdmin(),
                    body: JSON.stringify({
                        senha: novaSenha
                    })
                }
            );

        await tratarResposta(
            resposta
        );

        mostrarToast(
            "Senha redefinida com sucesso."
        );

    } catch (erro) {

        mostrarToast(
            erro.message
        );

    }

}


async function excluirUsuario(
    id,
    nomeUsuario,
    loginUsuario
) {

    const mensagem =
        `Deseja excluir definitivamente o usuário "${nomeUsuario}" (${loginUsuario})?\n\n` +
        "Esse usuário não poderá mais entrar no sistema.";


    if (!confirm(mensagem)) {

        return;

    }


    try {

        const resposta =
            await fetch(
                `${API}/api/usuarios/${encodeURIComponent(id)}`,
                {
                    method: "DELETE",
                    headers: headersAdmin()
                }
            );


        await tratarResposta(
            resposta
        );


        mostrarToast(
            "Usuário excluído com sucesso."
        );


        await carregarUsuarios();


    } catch (erro) {

        console.error(
            erro
        );


        mostrarToast(
            erro.message
        );

    }

}


busca.addEventListener(
    "input",
    renderizarUsuarios
);


btnSair.addEventListener(
    "click",
    () => {

        if (
            !confirm(
                "Deseja sair do sistema?"
            )
        ) {

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


document
    .querySelectorAll(".btn-mostrar-senha")
    .forEach(botao => {
        botao.addEventListener("click", () => {
            const campo = document.getElementById(botao.dataset.target);
            if (!campo) return;
            const mostrar = campo.type === "password";
            campo.type = mostrar ? "text" : "password";
            botao.textContent = mostrar ? "🙈" : "👁";
            botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
        });
    });

btnFecharModalEditar?.addEventListener("click", fecharModalEditarUsuario);
btnCancelarModalEditar?.addEventListener("click", fecharModalEditarUsuario);
btnSalvarModalEditar?.addEventListener("click", salvarEdicaoUsuario);
modalEditarUsuario?.addEventListener("click", event => {
    if (event.target === modalEditarUsuario) fecharModalEditarUsuario();
});

btnFecharModalSenha?.addEventListener("click", fecharModalSenha);
btnCancelarModalSenha?.addEventListener("click", fecharModalSenha);
btnRedefinirModalSenha?.addEventListener("click", redefinirSenhaDoModal);
modalSenha?.addEventListener("click", event => {
    if (event.target === modalSenha) fecharModalSenha();
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    if (modalEditarUsuario?.classList.contains("ativo")) {
        fecharModalEditarUsuario();
        return;
    }

    if (modalSenha?.classList.contains("ativo")) {
        fecharModalSenha();
    }
});

carregarUsuarios();


/* =========================================================
   TEMPO REAL ENTRE OS PCS
========================================================= */

if (typeof EventSource !== "undefined") {

    const eventosUsuarios =
        new EventSource(
            `${API}/api/eventos`
        );

    eventosUsuarios.addEventListener(
        "usuarios-atualizados",
        () =>
            carregarUsuarios()
    );

}
