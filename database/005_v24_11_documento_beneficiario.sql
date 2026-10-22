-- V24.11 - Beneficiário pertence ao documento de doação.
ALTER TABLE documentos_operacao ADD COLUMN IF NOT EXISTS beneficiario VARCHAR(255);
UPDATE documentos_operacao d
SET beneficiario=x.beneficiario
FROM (
    SELECT documento_id, MIN(NULLIF(TRIM(beneficiario),'')) AS beneficiario
    FROM doacoes_produtos
    WHERE documento_id IS NOT NULL
    GROUP BY documento_id
) x
WHERE d.id=x.documento_id AND d.tipo='DOACAO'
  AND (d.beneficiario IS NULL OR TRIM(d.beneficiario)='')
  AND x.beneficiario IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_operacao_beneficiario ON documentos_operacao(beneficiario);
