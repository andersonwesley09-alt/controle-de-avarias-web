CONTROLE DE AVARIAS - V13.3

Alterações desta versão:

1. ABA BAIXAS
- O botão de ação por registro deixou de ser "Excluir" e passou a ser "Editar".
- Somente administradores podem editar.
- A edição abre uma janela completa para alterar código, produto, fornecedor, código do fornecedor, categoria, quantidade, valor de custo unitário, setor, motivo, caixa, data da baixa e observação.
- O usuário que lançou o registro é exibido como somente leitura para preservar o histórico.
- O modal mostra automaticamente o valor total (quantidade x custo unitário).
- Dentro do próprio modal existe a opção de excluir o registro.
- A exclusão mantém o comportamento anterior do histórico: remove o registro da visualização de Baixas.

2. SINCRONIZAÇÃO
- Ao salvar uma edição, o lançamento histórico e a avaria correspondente são atualizados.
- A categoria continua permanente para o produto quando alterada.
- Eventos SSE avisam os outros computadores sobre as alterações.

3. SEGURANÇA
- A API de edição usa autenticação administrativa.
- Usuários comuns não recebem o botão Editar nem podem executar a rota de edição.

4. VERSÃO
- Front-end da aba Avarias/Baixas atualizado para v13.3.
- package.json atualizado para 1.3.3.
