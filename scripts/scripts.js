require("dotenv").config();

const { Pool } = require("pg");


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false
});


async function criarTabelaProdutos() {

    try {

        console.log(
            "Criando tabela de produtos..."
        );


        await pool.query(`
            CREATE TABLE IF NOT EXISTS produtos (

                id SERIAL PRIMARY KEY,

                codigo_barras VARCHAR(50)
                    UNIQUE
                    NOT NULL,

                descricao VARCHAR(255)
                    NOT NULL,

                fornecedor VARCHAR(255),

                preco NUMERIC(12,2)
                    NOT NULL
                    DEFAULT 0,

                setor VARCHAR(100),

                ativo BOOLEAN
                    NOT NULL
                    DEFAULT TRUE,

                criado_em TIMESTAMP
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                atualizado_em TIMESTAMP
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP

            );
        `);


        console.log(
            "Tabela produtos criada."
        );


        await pool.query(`
            CREATE INDEX IF NOT EXISTS
            idx_produtos_codigo_barras

            ON produtos(
                codigo_barras
            );
        `);


        console.log(
            "Índice criado."
        );


        await pool.query(`
            INSERT INTO produtos
            (
                codigo_barras,
                descricao,
                fornecedor,
                preco,
                setor
            )

            VALUES

            (
                '7891000100103',
                'Café Santa Clara 250g',
                'Santa Clara',
                9.99,
                'Mercearia'
            ),

            (
                '7896005800010',
                'Leite Integral 1L',
                'Fornecedor Teste',
                6.00,
                'Frios'
            )

            ON CONFLICT (codigo_barras)
            DO NOTHING;
        `);


        console.log(
            "Produtos de teste inseridos."
        );


        const resultado =
            await pool.query(`
                SELECT
                    id,
                    codigo_barras,
                    descricao,
                    fornecedor,
                    preco,
                    setor
                FROM produtos
                ORDER BY id;
            `);


        console.table(
            resultado.rows
        );


    } catch (erro) {

        console.error(
            "Erro ao criar produtos:",
            erro
        );

    } finally {

        await pool.end();

    }

}


criarTabelaProdutos();