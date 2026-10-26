V21.2 - CORREÇÃO DEFINITIVA DA SEPARAÇÃO ENTRE REGISTROS E HISTÓRICO

- A aba Registros passa a usar exclusivamente a tabela avarias como fonte oficial.
- O histórico não repopula mais a aba Registros após uma exclusão.
- Isso elimina o ciclo “exclui e volta” e o erro “Avaria não encontrada” causado por registros históricos exibidos como atuais.
- Exclusão da aba Registros ficou idempotente no servidor: se a avaria já não existir, mas houver histórico correspondente, a API considera a exclusão concluída e preserva o histórico.
- Corrigido listener duplicado do botão Excluir selecionados.
- APP_VERSION: V21.2.
- V21.1 permanece preservada como backup.
