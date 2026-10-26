CONTROLE DE AVARIAS - V25.1.14
==============================

OBJETIVO
Eliminar a divergência entre computadores causada por fontes locais diferentes.

CORREÇÃO CENTRAL
1. O frontend não possui mais modo de dados local.
2. rede-central.js força todos os /api/* para a origem central.
3. Mesmo se um HTML for aberto por file://, a API apontará para o servidor central padrão.
4. EventSource também é direcionado para /api/eventos do servidor central.
5. O servidor continua escutando em 0.0.0.0:3000.
6. O launcher cliente tenta descoberta UDP 3001 e usa fallback para 10.10.70.163:3000.

MÓDULOS CENTRALIZADOS
- Dashboard
- Avarias / Registros / Baixas
- Caixas
- Produtos
- Usuários
- Tarefas
- Auditoria
- Recuperação
- Doações
- Devoluções
- Documentos gerais
- Notificações
- Tempo real

DOCUMENTOS GERAIS
Antes, Documentos usava IndexedDB do navegador. Isso fazia cada PC possuir sua própria lista de PDFs/Excel.
Agora a tabela documentos_arquivos guarda metadados e o arquivo BYTEA no PostgreSQL.

ENDPOINTS
GET    /api/documentos
POST   /api/documentos
POST   /api/documentos/importar-local   (admin; migração)
PUT    /api/documentos/:id
PATCH  /api/documentos/:id/favorito
GET    /api/documentos/:id/arquivo
DELETE /api/documentos/:id

DEVOLUÇÕES
Antes, devolucoes.js carregava e salvava avarias diretamente no localStorage.
Agora consulta /api/avarias?status=Pendente e /api/avarias?status=Devolução e usa PATCH /api/avarias/:id/status.

BANCO
A V25.1.14 não executa migração destrutiva.
Na inicialização, apenas garante a existência da tabela documentos_arquivos e seus índices.
O backup PostgreSQL existente continua sendo a fonte de recuperação.

OPERAÇÃO RECOMENDADA
PC servidor:
- LIBERAR_ACESSO_REDE.bat (uma vez, como administrador)
- INICIAR_SERVIDOR.bat

PCs clientes:
- ABRIR_SISTEMA_CLIENTE.bat

Se o IP do servidor mudar:
- CONFIGURAR_SERVIDOR_REDE.bat
