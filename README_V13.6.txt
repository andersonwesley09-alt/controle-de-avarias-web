V13.6 - CONTROLE DE AVARIAS
===========================

Atualização baseada na V13.5.

ALTERAÇÕES
- Ordenação da aba Registros agora é opcional; sem ordenação, a ordem original da API é preservada.
- Usuários autenticados podem excluir registros da aba Registros. A exclusão continua preservada no Histórico de Baixas e registrada na Auditoria com o usuário responsável.
- Exportação de Excel e PDF das Baixas passou a enviar o token de autenticação corretamente.
- Endpoint de exportação Excel protegido por autenticação.
- Histórico de alterações continua exclusivo do administrador.
- Ajuste do endereço da API na tela de Auditoria para evitar chamadas para a porta errada quando o frontend é aberto por Live Server/outro servidor local.
- Toast de mensagens reposicionado para não cobrir o botão flutuante de Filtros.
- Cache do frontend atualizado para v=13.6.
- Responsividade e categoria da V13.5 preservadas.

PERMISSÕES
- Categoria permanente do produto: somente administrador.
- Edição de baixas: somente administrador.
- Exclusão do histórico de baixas: somente administrador.
- Histórico de alterações: somente administrador.
- Exclusão de registros da aba Registros: usuário autenticado.
