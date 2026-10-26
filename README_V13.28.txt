V13.28 - Dados adicionais no lançamento de produtos em caixas

Alterações:
- Adicionados Motivo, Categoria e Setor de origem no lançamento de produto da caixa.
- Campos ficam na mesma área e em três colunas no desktop para caber na tela.
- Categoria é preenchida inicialmente com a categoria do produto localizado.
- Motivo inicia como Produto avariado; Setor de origem precisa ser informado.
- Dados são persistidos em caixa_produtos e aparecem no retorno da API.
- Banco recebe migração automática das novas colunas sem apagar dados existentes.
- Auditoria registra motivo, categoria e setor de origem.
