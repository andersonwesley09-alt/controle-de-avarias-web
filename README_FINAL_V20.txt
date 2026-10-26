CONTROLE DE AVARIAS - V20.0

BASE CONSOLIDADA

O que foi corrigido nesta versão:
- Todos os arquivos HTML usam uma nova chave de cache V20.0. Isso elimina o problema de o navegador carregar avarias.js antigo com ?v=19.1.
- Sessão centralizada permanece no cookie HttpOnly + token de compatibilidade.
- Dashboard e Avarias continuam usando a mesma sessão.
- Histórico passa a ser resiliente: histórico permanente + avarias atuais sem projeção + último backup local como último recurso.
- O histórico não depende mais de uma única tabela estar sincronizada para aparecer na tela.
- Dashboard recebe a mesma fonte unificada.
- API retorna JSON em erros e inclui a versão do servidor.
- Endpoint administrativo /api/diagnostico-historico mostra banco e contagens reais.
- Não há scripts INICIAR/REINICIAR duplicados de versões antigas.

COMO INICIAR
1. Feche servidores antigos.
2. Execute REINICIAR_SERVIDOR.bat uma vez.
3. Depois use INICIAR_SERVIDOR.bat normalmente.
4. Abra http://localhost:3000.
5. Nos demais PCs use o IP exibido no terminal.

DIAGNÓSTICO
Como administrador, abra /api/diagnostico-historico para verificar:
- banco PostgreSQL conectado;
- quantidade de avarias;
- quantidade total de histórico;
- histórico ativo;
- histórico removido;
- estrutura real da tabela.

IMPORTANTE
A V20.0 não apaga o banco e não substitui registros existentes.
