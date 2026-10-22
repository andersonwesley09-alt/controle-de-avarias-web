-- Controle de Avarias V24
-- Documentos numerados, abertos/finalizados e auditoria por operação.
-- A aplicação também cria estas estruturas automaticamente ao iniciar.

CREATE SEQUENCE IF NOT EXISTS seq_documento_recuperacao_v24 START 1;
CREATE SEQUENCE IF NOT EXISTS seq_documento_doacao_v24 START 1;

CREATE TABLE IF NOT EXISTS documentos_operacao (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    data_documento DATE NOT NULL,
    numero BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_em TIMESTAMPTZ,
    finalizado_por VARCHAR(100),
    CONSTRAINT documentos_operacao_tipo_data_unq UNIQUE (tipo, data_documento),
    CONSTRAINT documentos_operacao_tipo_numero_unq UNIQUE (tipo, numero),
    CONSTRAINT documentos_operacao_status_chk CHECK (status IN ('ABERTO','FINALIZADO'))
);
