V19.1 - CORREÇÃO DO DASHBOARD E ACESSO POR SESSÃO

- Dashboard valida a sessão no servidor antes de carregar os dados.
- Sem sessão válida, redireciona para login em vez de mostrar "Erro ao carregar".
- Cookie HttpOnly continua sendo a autenticação principal.
- Token da sessão atual é usado apenas como fallback de compatibilidade durante a transição de hostname.
- Consultas do Dashboard usam credentials: include.
- IA do Dashboard usa a mesma autenticação.
- Card Dashboard restaurado no menu principal.
- V19.0 preservada como versão anterior.
