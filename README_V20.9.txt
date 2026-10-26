V20.9 – EXCLUSÃO DE SELECIONADOS DO HISTÓRICO

Correções:
- Botão “Excluir selecionados” do Histórico de Baixas fica visível.
- A permissão de administrador é confirmada diretamente pela sessão do servidor.
- Usuário não administrador vê o botão desabilitado, sem receber uma ação escondida.
- Administrador pode selecionar vários registros e excluí-los pelo botão.
- A exclusão usa a rota existente /api/historico-avarias/:id, preservando a regra de auditoria e remoção lógica.
- Não altera Dashboard, IA, cadastro de avarias ou banco além da rotina já existente de exclusão histórica.
