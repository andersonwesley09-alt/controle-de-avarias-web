CONTROLE DE AVARIAS - V13.8
===========================

VERSÃO ATUAL
- V13.8 - Com Logo
- PostgreSQL central
- Acesso por rede local via Node.js
- Tempo real entre os PCs

INICIAR
1. Confirme que o PostgreSQL está iniciado no PC principal.
2. Execute INICIAR_SERVIDOR.bat.
3. Mantenha a janela do servidor aberta.
4. Nos outros PCs, abra o endereço exibido como “Outros PCs”.

PERMISSÕES
- Atualização dos Produtos: somente administrador.
- Histórico de alterações: somente administrador.
- Edição de baixas: somente administrador.
- Exclusão de registros da aba Registros: usuários autenticados podem excluir, com auditoria do usuário responsável.
- Alteração permanente de categoria: somente administrador.

PRINCIPAIS RECURSOS V13.8
- Cadastro de avarias com categoria.
- Registros com filtros em botão e ordenação opcional maior/menor.
- Baixas com filtros em botão, edição administrativa e exportação Excel/PDF.
- Consolidação e soma de produtos repetidos na exportação.
- Dashboard com filtros flutuantes e período padrão do mês atual.
- Auditoria administrativa.
- Responsividade.
- Sincronização em tempo real.
- Backup automático diário.

VERIFICAÇÃO
Execute: npm run check

OBSERVAÇÃO
Não é necessário instalar Node.js ou PostgreSQL nos PCs clientes. Apenas o PC principal precisa executar o servidor e estar acessível pela rede local.


V13.8 - CAIXAS: produtos são lançados somente depois de criar e abrir a caixa.


V13.17: identificação amigável A20 aplicada à posição anteriormente exibida como R2C20.


Atualização: V13.20 - dados das caixas integrados ao Dashboard.
