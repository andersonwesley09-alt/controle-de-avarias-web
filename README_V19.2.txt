V19.2 — CORREÇÃO DO LOGIN E DIAGNÓSTICO DE REDE

- Corrigido o erro de conexão quando login.html era aberto por duplo clique (file://).
- Adicionado /api/saude para diagnóstico rápido do servidor.
- Login mostra o endereço real do servidor quando a conexão falha.
- ALLOW_FILE_ORIGIN=true permite origem null somente para uso local.
- O endereço pode ser informado pela URL com ?servidor=http://IP:3000.
- Mantida a sessão HttpOnly da V19.

RECOMENDADO: acessar pelo servidor em http://IP_DO_SERVIDOR:3000.
