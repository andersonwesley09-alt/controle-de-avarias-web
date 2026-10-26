# Projeto APP V16 - Controle de Avarias

## Principais atualizações

- Cabeçalho com botões Avisos, Perfil e Sair padronizados.
- Central de notificações persistente por usuário, salva no PostgreSQL.
- Notificações para novas tarefas, tarefas concluídas e tarefas reabertas.
- Contador de notificações não lidas e marcação individual ou em massa como lida.
- Clique na notificação direciona para Tarefas Diárias.
- Checklist diário com filtros Todas/Pendentes/Concluídas.
- Pesquisa das tarefas do próprio usuário.
- Botão para concluir todas as tarefas pendentes do dia selecionado, com confirmação.
- Informações de quem atribuiu cada tarefa.
- ADM pode copiar as tarefas do dia anterior para a data selecionada sem duplicar tarefas existentes.
- Atualização em tempo real preservada via SSE.
- Backup automático inclui a tabela de notificações.

## Banco

Novas estruturas são criadas automaticamente na inicialização:

- `notificacoes`
- índices para usuário/status e tarefa

As estruturas existentes de tarefas e demais módulos são preservadas.


## V16.1

Padronização geral de data/hora para `America/Sao_Paulo`, com migração segura dos timestamps legados.
