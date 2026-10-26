V13.7 – Produtos por caixa

- Caixas agora podem cadastrar produtos vinculados.
- Cadastro de nova caixa permite adicionar produtos por EAN e quantidade.
- Cada caixa possui botão “Produtos” para consultar, adicionar e remover itens.
- Produtos usam a base PostgreSQL existente.
- Produto repetido na mesma caixa soma a quantidade.
- Remoção e inclusão são registradas na auditoria.
- Nova tabela PostgreSQL: caixa_produtos.
- Backup automático inclui caixa_produtos.
- “Ver conteúdo” continua mostrando as avarias vinculadas à caixa.
