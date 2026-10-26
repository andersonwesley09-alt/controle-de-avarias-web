CONTROLE DE AVARIAS V25.1.15
RECUPERAÇÃO SEGURA DOS LANÇAMENTOS APÓS 13/10/2026

OBJETIVO
Recuperar os lançamentos que existiam no snapshot legado e desapareceram da base central após a migração para a rede central.

FONTE DE RECUPERAÇÃO
O pacote contém um snapshot legado em local-api-216.LEGADO.js, com 1.383 avarias ativas e 1.761 registros históricos, com dados até 21/10/2026.
No intervalo de 14/10/2026 a 21/10/2026 existem 657 avarias ativas e 730 registros históricos no snapshot.

COMO USAR
1. Faça isso SOMENTE no PC que é o servidor PostgreSQL.
2. Pare o servidor do Controle de Avarias.
3. Abra a pasta desta versão.
4. Execute RECUPERAR_DADOS_POS_13.bat como administrador.
5. O script cria primeiro um snapshot de segurança da base atual.
6. Depois insere somente registros ausentes de 14/10/2026 em diante.
7. Nenhum registro existente é sobrescrito.
8. Registros que o histórico atual marca como removidos não são ressuscitados.
9. Ao terminar, inicie novamente o servidor e confira os Registros e o Histórico.

IMPORTANTE
Esta recuperação cobre os dados disponíveis no snapshot até 21/10/2026. Se também faltarem lançamentos feitos em 22/10 ou 23/10, use MIGRAR_LANCAMENTOS_LOCAIS.html no mesmo navegador onde esses dados ainda existiam.

NÃO EXECUTAR
Não execute RESTAURAR_DADOS_V25.1.11.bat nem RECONCILIAR_BASE_V25.1.13.bat junto com este procedimento. Esta versão já contém uma recuperação específica para o período após 13/10 e deve ser executada uma única vez.
