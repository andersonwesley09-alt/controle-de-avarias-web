V13.28 - LANÇAMENTO DE PRODUTOS NA CAIXA

Alterações desta versão:
- A consulta de produto na tela de caixa não acontece mais durante a digitação.
- O sistema não consulta códigos parciais como "7" ou qualquer EAN ainda incompleto.
- A consulta é confirmada pelo Enter, funcionando com digitação manual e com leitores de código de barras configurados para enviar Enter ao final da leitura.
- O produto é localizado pelo código/EAN através do endpoint existente.
- Após localizar o produto, o sistema mostra o EAN/código, descrição, fornecedor, categoria, estoque, custo e valor do lançamento.
- A quantidade continua sendo informada antes do lançamento.
- O produto nunca é adicionado automaticamente apenas por bipar o EAN.


Atualização V13.28: lançamento de produtos em caixas agora exige Motivo, Categoria e Setor de origem, com persistência e auditoria.
