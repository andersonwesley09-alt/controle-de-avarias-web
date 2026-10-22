-- Controle de Avarias V21.7
-- Estruturas da Recuperação de Produtos e Doações.

CREATE TABLE IF NOT EXISTS recuperacoes_produtos (
    id VARCHAR(100) PRIMARY KEY,
    codigo VARCHAR(50),
    produto VARCHAR(255) NOT NULL,
    fornecedor VARCHAR(255),
    codigo_fornecedor VARCHAR(50),
    categoria VARCHAR(50),
    quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
    quantidade_recuperada NUMERIC(15,3) NOT NULL DEFAULT 0,
    valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
    setor VARCHAR(100),
    observacao TEXT,
    usuario_lancamento VARCHAR(100),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doacoes_produtos (
    id VARCHAR(100) PRIMARY KEY,
    codigo VARCHAR(50),
    produto VARCHAR(255) NOT NULL,
    fornecedor VARCHAR(255),
    codigo_fornecedor VARCHAR(50),
    categoria VARCHAR(50),
    quantidade NUMERIC(15,3) NOT NULL DEFAULT 0,
    valor_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
    beneficiario VARCHAR(255) NOT NULL,
    data_doacao DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao TEXT,
    usuario_lancamento VARCHAR(100),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
