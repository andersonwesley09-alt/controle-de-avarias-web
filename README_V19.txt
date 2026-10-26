# CONTROLE DE AVARIAS — V19

## Objetivo da V19

A V19 é uma versão de estabilidade e segurança. A prioridade não é adicionar módulos, e sim fortalecer o sistema já existente.

### Principais melhorias

1. **Sessão centralizada no servidor**
   - Login cria uma sessão persistida no PostgreSQL.
   - Cookie `HttpOnly`, `SameSite=Lax` e duração de 12 horas.
   - Logout revoga a sessão no banco.
   - Tokens assinados antigos da V17 continuam aceitos apenas para compatibilidade.

2. **APIs protegidas**
   - Consultas de avarias, histórico, caixas, produtos, dashboard, eventos em tempo real e operações de migração agora exigem autenticação adequada.
   - Operações administrativas continuam restritas ao perfil `admin`.

3. **Banco configurável por `.env`**
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`

4. **Backup**
   - `pg_dump` continua sendo o backup principal.
   - Snapshot JSON continua como contingência.
   - Retenção configurável em `BACKUP_RETENCAO` (padrão: 30 arquivos).
   - Endpoint administrativo para consultar status e executar backup manual.

5. **Desempenho**
   - Novos índices para filtros e dashboards por status, fornecedor, categoria, data, caixas e auditoria.

6. **Migração documentada**
   - `database/001_v19_estabilidade.sql`
   - O servidor também cria automaticamente a estrutura necessária.

## Configuração

No `.env`:

```env
PORT=3000
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=5432
DB_NAME=controle_avarias
DB_USER=postgres
DB_PASSWORD=

SESSION_COOKIE_NAME=controle_avarias_sessao
SESSION_SECURE_COOKIE=false

BACKUP_HORA=23
BACKUP_MINUTO=55
BACKUP_RETENCAO=30

CORS_ORIGINS=
```

### HTTPS

Se o sistema passar a ser servido por HTTPS, alterar:

```env
SESSION_SECURE_COOKIE=true
```

### CORS

Por padrão, o sistema não abre CORS para origens externas. Como frontend e API são servidos pelo mesmo Node, isso é o comportamento recomendado.

Se houver uma integração externa autorizada, informar as origens separadas por vírgula:

```env
CORS_ORIGINS=https://exemplo.local,http://10.10.70.163:3000
```

## Inicialização

```bash
npm install
npm start
```

Ou use o `INICIAR_SERVIDOR.bat`.

## Teste rápido

```bash
npm run check
```

E valide:

- login;
- abertura do dashboard;
- cadastro de avaria;
- histórico;
- caixas;
- tarefas;
- auditoria;
- usuários;
- logout;
- acesso por outro PC da rede;
- backup automático.

## Regra importante

A V19 deve ser tratada como uma versão de estabilização. Novas funcionalidades grandes devem entrar somente depois da validação dos fluxos acima.
