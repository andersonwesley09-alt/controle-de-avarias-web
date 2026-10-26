CONTROLE DE AVARIAS - V25.1 WEB LOCAL

Atualizações desta versão:

1. DOCUMENTOS
- Novo card "Documentos" no menu inicial.
- Armazena arquivos localmente no navegador via IndexedDB.
- Suporte a PDF, XLSX e XLS.
- Adicionar documento por seleção de arquivo ou arrastar/soltar.
- Nome, categoria e descrição.
- Pesquisa por nome, descrição, arquivo e categoria.
- Filtro por categoria, tipo e favoritos.
- Favoritos.
- Abrir PDF em nova aba.
- Baixar arquivos Excel.
- Editar metadados e substituir arquivo.
- Excluir documento com confirmação.

2. AVARIAS -> DOAÇÃO
- Botão individual com seta (->) em cada registro.
- Botão "Enviar para doação" para vários registros selecionados.
- Modal com os produtos selecionados.
- Quantidade para doação pode ser parcial.
- Beneficiário/instituição obrigatório.
- Observação opcional.
- Registro original permanece em Registros e na Baixa/Histórico.
- A avaria recebe apenas o controle da quantidade já destinada à doação.
- Rastreabilidade entre avaria e doação.
- Exclusão/edição de uma doação vinculada devolve a quantidade disponível para a avaria.

3. VERSÃO
- Rodapé atualizado para V25.1.
- Cache dos arquivos principais atualizado para evitar carregar versões antigas.
- Sistema continua em modo Web Local, sem servidor.


V25.1.1 - Histórico de Doações: abrir documento em modo edição/consulta; incluir produtos em documento aberto; finalizar; PDF corrigido no modo Web Local; botão PDF direto no histórico; inclusão em documento existente por documentoId.


V25.1.2 - Correção da listagem de produtos dentro de documentos REC/DOA: o adaptador local retorna arrays, então as telas agora aceitam tanto array direto quanto {registros:[...]}. Cache-bust atualizado.


V25.1.3 - Corrigida a coluna Ação do histórico de Doações: o overflow da tabela estava cortando os botões. Documento, PDF e Excluir agora ficam visíveis.

V25.1.5 - Padronização visual dos botões da barra de Registros: mesma altura, tipografia, bordas, espaçamento e alinhamento; Limpar filtros neutro, Excluir vermelho quando habilitado, Enviar para doação e Compartilhar em azul; estados desabilitados neutralizados.

V25.1.6 - Correção do exportador de Registros no modo Web Local: o endpoint /api/avarias/exportar agora gera um XLSX real (não CSV renomeado), mantendo os mesmos dados e colunas.


V25.1.7 - MODO HÍBRIDO / REDE
- Restaurado o acesso compartilhado entre PCs pelo servidor Node + PostgreSQL.
- local-api-216.js agora só ativa o modo Web Local quando a página é aberta por file://.
- Quando o sistema é aberto por http://localhost:3000 ou http://IP:3000, fetch e EventSource usam o servidor central normalmente.
- Incluídos CONFIGURAR_SERVIDOR_REDE.bat e ABRIR_SISTEMA_REDE.bat para configurar o PC cliente uma única vez e abrir o sistema pela rede.
- Incluídos os arquivos do módulo Documentos na lista de arquivos públicos do servidor. O armazenamento do módulo Documentos continua local por navegador nesta versão.

V25.1.10 - REDE CENTRAL / TEMPO REAL CORRIGIDO
- PCs via HTTP e PCs que abrirem HTML diretamente com servidor configurado usam a mesma API central.
- servidor-rede.js permite configurar o servidor por PC; o CONFIGURAR_SERVIDOR_REDE.bat grava essa configuração.
- API e EventSource recebem o servidor central configurado.
- SSE aceita o token de sessão no modo file:///rede para manter tempo real entre os PCs.
- /api/saude passou a informar servidor, banco e contagens centrais para diagnóstico.
- Standalone sem servidor deixa de exibir falsamente "Tempo real conectado".
- Quantidade máxima por lançamento: 100.000; validação aplicada no servidor e nas telas.
- Mantidas as funções de documentos REC/DOA e o padrão aprovado sem botão PDF extra no histórico de Doações.

V25.1.11 - RESTAURAÇÃO SEGURA
- Corrige a divergência entre dados do modo Web Local e PostgreSQL central.
- Inclui restauração idempotente por ID, sem sobrescrever dados existentes.
- Cria snapshot de segurança antes da restauração.
- Recupera histórico, recuperação, doação e usuários ausentes no PostgreSQL.
- Não restaura avarias ativas automaticamente para evitar ressuscitar exclusões.

V25.1.13 - RECUPERAÇÃO DOS LANÇAMENTOS LOCAIS
- Inclui endpoint administrativo /api/migracao-local.
- Inclui MIGRAR_LANCAMENTOS_LOCAIS.html e .bat.
- Recupera do localStorage os lançamentos recentes que ficaram fora do snapshot PostgreSQL.
- Importação idempotente por ID, sem sobrescrever registros existentes.
- Proteção contra ressuscitar registros que já existiam no histórico central.
