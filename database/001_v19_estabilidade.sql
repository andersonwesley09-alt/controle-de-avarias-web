-- CONTROLE DE AVARIAS - V19
-- Migração de estabilidade: sessões revogáveis + índices de desempenho.
-- Pode ser executada no PostgreSQL antes ou depois de iniciar o server.js.
-- O próprio servidor também garante estas estruturas automaticamente.

CREATE TABLE IF NOT EXISTS sessoes (
    id BIGSERIAL PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMPTZ NOT NULL,
    ultimo_acesso_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revogada_em TIMESTAMPTZ,
    ip VARCHAR(100),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario
    ON sessoes(usuario_id);

CREATE INDEX IF NOT EXISTS idx_sessoes_expira
    ON sessoes(expira_em);

CREATE INDEX IF NOT EXISTS idx_avarias_status_criado
    ON avarias(status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_avarias_fornecedor_criado
    ON avarias(fornecedor, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_avarias_categoria_criado
    ON avarias(categoria, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_historico_status_criado
    ON historico_avarias(status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_historico_fornecedor_criado
    ON historico_avarias(fornecedor, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_historico_categoria_criado
    ON historico_avarias(categoria, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_historico_ativo_criado
    ON historico_avarias(criado_em DESC)
    WHERE removido = FALSE;

CREATE INDEX IF NOT EXISTS idx_caixas_criado
    ON caixas(criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_caixas_numero
    ON caixas(numero);

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor
    ON produtos(fornecedor);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_ativo
    ON produtos(categoria, ativo);

CREATE INDEX IF NOT EXISTS idx_caixa_produtos_caixa_categoria
    ON caixa_produtos(caixa_id, categoria);

CREATE INDEX IF NOT EXISTS idx_caixa_produtos_setor
    ON caixa_produtos(setor_origem);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_criado
    ON auditoria_alteracoes(usuario, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_entidade_criado
    ON auditoria_alteracoes(entidade, criado_em DESC);
