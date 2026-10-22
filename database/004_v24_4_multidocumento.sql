-- Controle de Avarias V24.4
-- Permite mais de um documento por tipo/data, mantendo somente um aberto.
ALTER TABLE documentos_operacao DROP CONSTRAINT IF EXISTS documentos_operacao_tipo_data_unq;
ALTER TABLE recuperacoes_produtos ADD COLUMN IF NOT EXISTS documento_id BIGINT;
ALTER TABLE doacoes_produtos ADD COLUMN IF NOT EXISTS documento_id BIGINT;
UPDATE recuperacoes_produtos r SET documento_id=d.id FROM documentos_operacao d WHERE r.documento_id IS NULL AND d.tipo='RECUPERACAO' AND d.data_documento=DATE(r.criado_em AT TIME ZONE 'America/Sao_Paulo');
UPDATE doacoes_produtos r SET documento_id=d.id FROM documentos_operacao d WHERE r.documento_id IS NULL AND d.tipo='DOACAO' AND d.data_documento=r.data_doacao;
CREATE INDEX IF NOT EXISTS idx_recuperacoes_documento_id ON recuperacoes_produtos(documento_id);
CREATE INDEX IF NOT EXISTS idx_doacoes_documento_id ON doacoes_produtos(documento_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_operacao_unico_aberto ON documentos_operacao(tipo,data_documento) WHERE status='ABERTO';
