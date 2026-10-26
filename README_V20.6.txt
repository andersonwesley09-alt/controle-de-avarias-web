CONTROLE DE AVARIAS — V20.6
IA ANALÍTICA ISOLADA

Base: V20.5.

OBJETIVO
Evoluir somente o módulo Analista IA sem alterar o funcionamento dos demais módulos.

NOVO NA IA
- Contexto automático dos filtros atuais do Dashboard.
- Cálculos estruturados antes da interpretação: total, média, rankings, concentração e tendência.
- Resumo, Concentração, Atenção, Tendência, Recomendações e Análise completa.
- Pergunta livre continua disponível no botão Analisar.
- Comparação com o período anterior quando houver datas válidas no Dashboard.
- Fallback local determinístico quando não houver OPENAI_API_KEY.
- Regras para não inventar dados e deixar claro quando uma informação não está disponível.
- IA somente leitura: não altera banco, avarias, caixas, produtos ou usuários.

PRESERVAÇÃO
- Histórico, cadastro de avarias, Dashboard, caixas, login/sessão e PostgreSQL permanecem com a lógica da V20.5.
- O endpoint da IA continua sendo /api/dashboard/ia; somente o contexto e a análise foram enriquecidos.
