V13.2 - CORREÇÃO DE ACESSO EM OUTROS PCS

- Mantém window.location.origin quando o sistema é aberto pelo servidor Node.
- Adiciona fallback para http://10.10.70.163:3000 quando algum HTML é aberto localmente (file://).
- Atualiza a versão dos CSS/JS para ?v=13.2.
- Mantém Cache-Control sem cache no servidor.
- Não altera o banco nem as funcionalidades da V13.1.
CONTROLE DE AVARIAS - V13.1
============================

Correção focada em acesso multi-PC e cache do navegador.

- window.location.origin em todos os módulos que usam a API.
- Versionamento ?v=13.1 nos CSS/JS.
- Cache-Control no-store para HTML/CSS/JS públicos.
- Login e consultas principais com cache no-store.
- Mantidos PostgreSQL central, SSE e todas as funcionalidades da V13.

Teste recomendado:
1. Substituir a versão no PC principal.
2. Reiniciar o INICIAR_SERVIDOR.bat.
3. Nos PCs que já estavam usando a V13, fazer Ctrl+Shift+R uma vez.
4. Testar login, Dashboard e lançamento entre dois PCs.
