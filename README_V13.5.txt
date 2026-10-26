V13.5 - CONTROLE DE AVARIAS
===========================

Principais alterações:
- Dashboard mais funcional, com filtros em botão flutuante no canto inferior direito e período padrão do mês atual.
- Registros: filtros em botão, ordenação maior/menor, correção de Cód. fornecedor x Qtd. e ajuste da tabela para o botão Editar caber na tela.
- Baixas: filtros em botão, exportação Excel/PDF somente dos itens selecionados e consolidação/soma de produtos repetidos.
- Cadastro: lançamento à esquerda e últimos lançamentos à direita; categoria editável no lançamento.
- Categoria: alteração permanente do produto continua restrita ao administrador.
- Atualização de produtos: acesso visual e API restritos ao administrador.
- Auditoria: histórico de alterações/exclusões/importações disponível somente para administrador.
- Exclusões: registros só podem ser excluídos pelo administrador e continuam preservados no histórico quando saem da aba Registros.
- Tempo real: indicador de conexão/reconexão e SSE mantido entre os PCs.
- Responsividade: tabelas, filtros, cadastro e dashboard adaptados para telas menores.
- Backup automático: tentativa diária de pg_dump; se pg_dump não estiver disponível, o sistema gera snapshot JSON das tabelas.
- Versionamento de CSS/JS atualizado para 13.5 para evitar cache antigo.
