V21.1 - CORREÇÃO DO INICIALIZADOR DO SISTEMA

Correção desta versão:
- Corrigido o bootstrap-server.js para aceitar qualquer versão válida do servidor (V20.x, V21.x, V22.x etc.), em vez de aceitar somente V20.x.
- Isso corrige o aviso "Servidor do Controle de Avarias não encontrado" ao abrir arquivos HTML diretamente por file:// após a atualização para V21.0.
- Mantido o comportamento de validar /api/versao antes de redirecionar para o servidor.
- APP_VERSION atualizado para V21.1 apenas para identificar claramente esta correção.

Nenhuma alteração foi feita na lógica de avarias, histórico, baixas, Dashboard, IA, login ou banco de dados.

V21.0 permanece preservada como backup.
