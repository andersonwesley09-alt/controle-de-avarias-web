V21.0 - EXCLUSÃO SELECIONADOS DEFINITIVA

Correções desta versão:
- Seleção visual da tabela passa a ser a fonte de verdade para exclusão em Registros e Baixas.
- Exclusão usa credentials: include e mostra o motivo real da falha quando a API rejeitar.
- Após exclusão, a tela recarrega os dados oficiais em vez de depender de renderização otimista.
- Histórico não volta a aparecer pelo fallback de /api/avarias quando o mesmo ID já foi marcado como removido.
- Fallback de backup também respeita IDs removidos.
- Cache do avarias.js atualizado para V21.0.
- APP_VERSION do servidor atualizado para V21.0.

V20.9 permanece preservada como backup.
