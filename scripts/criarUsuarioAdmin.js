const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "controle_avarias",
    port: 5432
});


async function criarUsuarioAdmin() {

    try {

        const senha =
            process.argv[2];


        if (!senha) {

            console.log("");
            console.log(
                "Informe uma senha."
            );

            console.log("");
            console.log(
                'Exemplo: node scripts/criarUsuarioAdmin.js "SUA_SENHA"'
            );

            return;

        }


        /* =========================
           TABELA
        ========================= */

        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (

                id SERIAL PRIMARY KEY,

                usuario VARCHAR(100)
                    UNIQUE
                    NOT NULL,

                senha_hash VARCHAR(255)
                    NOT NULL,

                nome VARCHAR(255)
                    NOT NULL,

                perfil VARCHAR(50)
                    NOT NULL
                    DEFAULT 'consulta',

                ativo BOOLEAN
                    NOT NULL
                    DEFAULT TRUE,

                criado_em TIMESTAMP
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            );
        `);


        /* =========================
           CRIPTOGRAFAR SENHA
        ========================= */

        const senhaHash =
            await bcrypt.hash(
                senha,
                12
            );


        /* =========================
           CRIAR ADMIN
        ========================= */

        await pool.query(
            `
            INSERT INTO usuarios
            (
                usuario,
                senha_hash,
                nome,
                perfil,
                ativo
            )

            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                TRUE
            )

            ON CONFLICT (usuario)

            DO UPDATE SET

                senha_hash =
                    EXCLUDED.senha_hash,

                nome =
                    EXCLUDED.nome,

                perfil =
                    EXCLUDED.perfil,

                ativo =
                    TRUE
            `,
            [
                "admin",
                senhaHash,
                "Administrador",
                "admin"
            ]
        );


        console.log("");
        console.log(
            "=============================="
        );

        console.log(
            " USUÁRIO CRIADO"
        );

        console.log(
            "=============================="
        );

        console.log("");
        console.log(
            "Usuário: admin"
        );

        console.log(
            "Perfil: admin"
        );

        console.log("");
        console.log(
            "A senha foi armazenada com hash."
        );


    } catch (erro) {

        console.error(
            "Erro:",
            erro
        );


    } finally {

        await pool.end();

    }

}


criarUsuarioAdmin();