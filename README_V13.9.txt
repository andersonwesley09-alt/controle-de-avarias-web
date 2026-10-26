V13.9 - INICIALIZAÇÃO AUTOMÁTICA DO SERVIDOR

ALTERAÇÃO PRINCIPAL
- A criação da caixa agora registra somente os dados básicos.
- Para lançar produtos, o usuário deve criar a caixa, abrir a caixa na listagem e adicionar os produtos dentro dela.

FLUXO
1. Cadastrar caixa.
2. A caixa aparece em Caixas cadastradas.
3. Clicar em "Abrir caixa".
4. Bipar/digitar o EAN.
5. Informar a quantidade.
6. Clicar em "+ Adicionar item".
7. O produto passa a fazer parte da caixa.

MANTIDO
- PostgreSQL
- Auditoria das inclusões/remoções de produtos
- Contagem de itens por caixa
- Exclusão de caixa
- Ver conteúdo das avarias separadamente
- Responsividade


NOVA ATUALIZAÇÃO V13.9
- O INICIAR_SERVIDOR.bat verifica automaticamente se as dependências do Node.js estão instaladas.
- Se necessário, executa npm install automaticamente antes de iniciar o servidor.
- Também verifica se o Node.js está instalado.
