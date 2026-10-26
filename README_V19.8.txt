CONTROLE DE AVARIAS - V20.0

CORREÇÃO DEFINITIVA DO HISTÓRICO E DASHBOARD

A V20.0 mantém a autenticação/session da V20.0 e corrige o problema em que:
- Dashboard aparecia com todos os indicadores em 0;
- Avarias mostrava "Não foi possível carregar o histórico";
- bancos antigos podiam ter historico_avarias sem as colunas novas;
- registros antigos podiam possuir removido = NULL e, por isso, eram filtrados.

CORREÇÕES:
1. Migração compatível da tabela historico_avarias.
2. Criação individual das colunas necessárias com ADD COLUMN IF NOT EXISTS.
3. Normalização de removido NULL para FALSE.
4. Normalização de datas/quantidade/valor/status legados.
5. WHERE COALESCE(removido, FALSE) = FALSE.
6. Sincronização de avarias existentes para o histórico sem reativar registros explicitamente excluídos.
7. Frontend do histórico envia cookie + Bearer de forma defensiva.
8. Erros da API continuam em JSON e agora exibem detalhe técnico quando disponível.
9. Dashboard passa a mostrar o detalhe real do erro caso a API falhe.

TESTE:
1. Feche servidores antigos.
2. Execute INICIAR_SERVIDOR_V197.bat ou INICIAR_SERVIDOR.bat desta pasta.
3. Faça login.
4. Abra Dashboard.
5. Abra Avarias > Registros.
6. Os dados existentes no PostgreSQL devem reaparecer automaticamente.

IMPORTANTE:
A V20.0 não apaga nem recria o banco. Ela migra a estrutura existente e sincroniza o histórico a partir da tabela avarias.
