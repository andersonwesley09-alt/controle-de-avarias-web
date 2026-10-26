CONTROLE DE AVARIAS - V25.1.19
CORREÇÃO EXCLUSIVA DO MÓDULO AVISOS

Correção feita somente em avisos.html/avisos.js.

- Corrige Failed to fetch quando avisos.html é aberto por duplo clique (file://).
- Usa o servidor central http://10.10.70.163:3000 quando não há uma origem HTTP válida.
- Rejeita localhost salvo como servidor central para evitar apontar para o PC cliente.
- Mantém publicação, listagem, exclusão e atualização em tempo real.
- Não altera PostgreSQL, server.js, Registros, Baixas, Documentos, Perfil ou outros módulos.
