/* BUILD V19.1 - Dashboard protegido e sessão centralizada */
/* =========================================================
   LOGIN
   AUTENTICAÇÃO PELO POSTGRESQL
========================================================= */


/* =========================
   API
========================= */

const API = window.CA_API_BASE || (window.CA_LOCAL_MODE ? "" : (window.location.origin || "http://localhost:3000"));

// Permite corrigir o endereço do servidor sem editar o código.
try {
    const servidorInformado = new URLSearchParams(window.location.search).get("servidor");
    if (servidorInformado && /^https?:\/\//i.test(servidorInformado)) {
        localStorage.setItem("controleAvariasServidor", servidorInformado.replace(/\/$/, ""));
    }
} catch {}



/* =========================
   ELEMENTOS
========================= */

const formLogin =
    document.getElementById(
        "formLogin"
    );


const campoUsuario =
    document.getElementById(
        "usuario"
    );


const campoSenha =
    document.getElementById(
        "senha"
    );


const mostrarSenha =
    document.getElementById(
        "mostrarSenha"
    );


const mensagemErro =
    document.getElementById(
        "mensagemErro"
    );


const btnEntrar =
    document.querySelector(
        ".btn-entrar"
    );


/* =========================
   MOSTRAR SENHA
========================= */

mostrarSenha.addEventListener(
    "click",

    function() {

        const senhaVisivel =
            campoSenha.type ===
            "text";


        campoSenha.type =
            senhaVisivel
                ? "password"
                : "text";


        mostrarSenha.textContent =
            senhaVisivel
                ? "👁"
                : "🙈";

    }
);


/* =========================
   LIMPAR ERRO
========================= */

function limparErro() {

    mensagemErro.textContent =
        "";


    mensagemErro.classList.remove(
        "ativo"
    );

}


campoUsuario.addEventListener(
    "input",
    limparErro
);


campoSenha.addEventListener(
    "input",
    limparErro
);


/* =========================
   EXIBIR ERRO
========================= */

function exibirErro(
    mensagem
) {

    mensagemErro.textContent =
        mensagem;


    mensagemErro.classList.add(
        "ativo"
    );

}


/* =========================
   LOGIN
========================= */

formLogin.addEventListener(
    "submit",

    async function(event) {

        event.preventDefault();


        limparErro();


        const usuarioDigitado =
            campoUsuario.value
                .trim();


        const senhaDigitada =
            campoSenha.value;


        if (
            !usuarioDigitado ||
            !senhaDigitada
        ) {

            exibirErro(
                "Preencha usuário e senha."
            );


            return;

        }


        /* =========================
           BLOQUEAR BOTÃO
        ========================= */

        btnEntrar.disabled =
            true;


        const textoOriginal =
            btnEntrar.textContent;


        btnEntrar.textContent =
            "Entrando...";


        try {

            /* =========================
               CONSULTAR API
            ========================= */

            // Diagnóstico rápido: diferencia servidor desligado de credencial inválida.
            try {
                const saude = await fetch(`${API}/api/saude`, { cache: "no-store", credentials: "include" });
                if (!saude.ok) {
                    const info = await saude.json().catch(() => ({}));
                    throw new Error(info.erro || `Servidor respondeu HTTP ${saude.status}.`);
                }
            } catch (erroSaude) {
                throw new Error(`Não foi possível conectar ao servidor ${API}. ${erroSaude.message || "Confirme se o server.js está rodando."}`);
            }

            const resposta =
                await fetch(
                    `${API}/api/login`,
                    {

                        method:
                            "POST",

                        cache:
                            "no-store",

                        credentials:
                            "include",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                usuario:
                                    usuarioDigitado,

                                senha:
                                    senhaDigitada

                            })

                    }
                );


            const tipoConteudo = String(resposta.headers.get("content-type") || "").toLowerCase();
            const textoResposta = await resposta.text();
            let dados = {};

            if (tipoConteudo.includes("application/json")) {
                try {
                    dados = JSON.parse(textoResposta || "{}");
                } catch (erroJson) {
                    throw new Error("O servidor respondeu com JSON inválido. Confirme se o V20.0 está rodando na porta 3000.");
                }
            } else {
                const trecho = textoResposta.replace(/\s+/g, " ").slice(0, 180);
                throw new Error(
                    `Não foi possível validar o acesso ao sistema no modo Web local (HTTP ${resposta.status}). Resposta: ${trecho || "vazia"}.`
                );
            }

            if (!resposta.ok) {
                throw new Error(
                    dados.erro ||
                    `Não foi possível realizar o login (HTTP ${resposta.status}).`
                );
            }


            /* =========================
               SALVAR SESSÃO
            ========================= */

            const sessao = {

                usuario:
                    dados.usuario,

                nome:
                    dados.nome,

                perfil:
                    dados.perfil,

                token:
                    dados.token || "",

                loginEm:
                    new Date()
                        .toISOString()

            };


            sessionStorage.setItem(

                "usuarioLogado",

                JSON.stringify(
                    sessao
                )

            );


            /* =========================
               SISTEMA
            ========================= */

            window.location.href =
                "sistema.html";


        } catch (erro) {

            console.error(
                "Erro de login:",
                erro
            );


            const mensagem = erro.message || "Não foi possível realizar o login.";


            exibirErro(
                mensagem
            );


            campoSenha.value =
                "";


            campoSenha.focus();


            btnEntrar.disabled =
                false;


            btnEntrar.textContent =
                textoOriginal;

        }

    }
);


/* =========================
   FOCO INICIAL
========================= */

campoUsuario.focus();