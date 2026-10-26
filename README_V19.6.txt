V20.0 - BASE ESTAVEL DE ACESSO
==============================

Esta versao retorna ao fluxo de autenticacao da V20.0, que era a base funcional,
e corrige a causa estrutural identificada nas tentativas seguintes.

CORRECOES
- Login e Dashboard voltam a usar a mesma origem HTTP do servidor.
- Removido o auth-client.js que interceptava fetch e podia mascarar problemas de origem.
- Removido o redirecionamento automatico agressivo para IP fixo.
- Adicionado endpoint /api/versao para identificar inequivocamente qual servidor esta respondendo.
- Adicionado retorno JSON para rotas /api inexistentes, evitando o erro "Unexpected token <".
- Startup verifica a porta 3000 e encerra somente outro servidor do proprio projeto quando houver conflito.
- ABRIR_SISTEMA.bat inicia o servidor quando necessario.
- ABRIR_DASHBOARD.bat abre o Dashboard no endereco correto.
- Mantida a sessao centralizada: cookie HttpOnly + token de compatibilidade.
- Mantida a correcao de sessao do Dashboard da V20.0.
- Mantidas as funcoes existentes do projeto.

REGRA PRINCIPAL
O sistema deve ser acessado por HTTP:
http://localhost:3000
ou
http://IP_DO_SERVIDOR:3000

Nao use duplo clique no index.html para operar o sistema em rede.


TESTE OBRIGATORIO APOS INICIAR
-------------------------------
Antes de fazer login, abra no navegador:
http://localhost:3000/api/versao

Deve aparecer JSON com:
{ "ok": true, "versao": "V20.0", ... }

Se aparecer HTML, NAO tente fazer login. O servidor errado ainda está na porta 3000.
Use REINICIAR_SERVIDOR.bat e confirme o encerramento do processo antigo.
