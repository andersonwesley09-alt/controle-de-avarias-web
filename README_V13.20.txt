V13.20 - DASHBOARD DE ESTOQUE NAS CAIXAS

Alteração principal:
- Removido do dashboard o detalhamento geral de caixas.
- Adicionado somente o valor total armazenado nas caixas como indicador principal.
- Não foram adicionados indicadores separados de quantidade ou número de produtos.
- Valor armazenado por fornecedor.
- Ranking de produtos armazenados por maior valor ou quantidade.
- Valor armazenado por categoria.
- Top caixas por valor armazenado.
- Dados de estoque das caixas são independentes dos filtros de avarias.
- Atualização em tempo real quando caixas/produtos são alterados.

Endpoint novo:
GET /api/dashboard/caixas-resumo
