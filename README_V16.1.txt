# Projeto APP V16.1 - Controle de Avarias

## Padronização de data e hora

- Horário oficial do sistema: `America/Sao_Paulo` (Brasília).
- Conexões PostgreSQL passam a usar o mesmo fuso.
- Novos campos de data/hora do sistema usam `TIMESTAMPTZ`.
- Migração única dos timestamps legados gravados como UTC em colunas sem fuso.
- Backup JSON criado antes da migração histórica.
- Tabela `sistema_fuso_horario` registra que a migração já foi executada e evita conversão duplicada.
- Tarefas, notificações, auditoria, avarias, histórico, caixas, produtos, mapeamento e perfil passam a exibir horários de forma consistente.
- Filtros por data usam os limites do dia de Brasília.
- Horário de conclusão das tarefas é convertido pelo fuso oficial, em vez de extrair diretamente a hora do texto ISO.

## Segurança da migração

A conversão histórica é executada dentro de transação. Se houver erro, a transação é revertida e a migração não é marcada como concluída.
