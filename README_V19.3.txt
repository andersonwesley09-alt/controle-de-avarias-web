CONTROLE DE AVARIAS - V20.0

CORREÇÃO DEFINITIVA DO DASHBOARD

Causa encontrada:
O dashboard.js da V19.2 validava a sessão através de /api/sessao, mas essa rota não existia no server.js. A validação falhava e o dashboard ficava na página, mostrando erro ao carregar histórico.

Correção:
- Criada a rota GET /api/sessao, protegida por exigirUsuario.
- Usuário não autenticado recebe 401 e o Dashboard redireciona para login.html.
- Usuário autenticado recebe os dados da sessão e o Dashboard carrega normalmente.
- Cache do dashboard atualizado para V20.0.

Fluxo esperado:
login -> cookie HttpOnly -> /api/sessao -> Dashboard -> histórico/caixas/IA

Não alterar o PostgreSQL para esta correção.
