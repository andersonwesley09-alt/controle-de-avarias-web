CONTROLE DE AVARIAS - V25.1.17

NOVA FUNCIONALIDADE: AVISOS GERAIS

- Novo card "Avisos" no painel principal.
- Todos os usuários autenticados podem publicar avisos.
- Todos os usuários autenticados podem visualizar os avisos publicados.
- Todos os usuários autenticados podem excluir avisos.
- Publicação e exclusão são persistidas no PostgreSQL central.
- Atualização em tempo real via SSE entre os PCs conectados.
- Publicações e exclusões são registradas na auditoria.
- A tabela "avisos" é criada automaticamente pelo servidor.

IMPORTANTE

A funcionalidade usa o mesmo servidor e PostgreSQL central do sistema.
Não há armazenamento de avisos em localStorage.
