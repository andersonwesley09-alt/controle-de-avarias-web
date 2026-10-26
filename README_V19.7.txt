V20.0 - CORRECAO DEFINITIVA DO ACESSO

PROBLEMA CORRIGIDO:
- O login aberto por duplo clique (file://) recebia HTTP 500 HTML por CORS.
- O bootstrap tambem falhava ao testar /api/versao pelo mesmo motivo.
- Por isso o navegador permanecia em file:// e depois tentava chamar a API de forma bloqueada.

CORRECAO:
- CORS agora reflete a origem real, inclusive Origin: null do file://.
- API /api continua retornando JSON.
- Sessao HttpOnly permanece centralizada no servidor.
- O fluxo normal deve ser: abrir servidor -> http://localhost:3000 -> login -> sistema -> dashboard.

TESTE:
1. Feche servidores antigos.
2. Execute REINICIAR_V197.bat no computador servidor.
3. Execute TESTAR_V197.bat e confirme {"ok":true,"versao":"V20.0"}.
4. Abra http://localhost:3000.
5. Faça login.
6. Dashboard deve abrir sem novo login.

IMPORTANTE:
- Nao use uma copia antiga do server.js.
- Nos outros PCs, use o endereco HTTP mostrado pelo servidor, por exemplo http://IP_DO_SERVIDOR:3000.
