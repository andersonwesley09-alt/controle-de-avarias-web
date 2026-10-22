# Controle de Avarias — V25

Sistema web para registro e acompanhamento de avarias, baixas, caixas, recuperações, doações, documentos operacionais, histórico e auditoria.

## Requisitos

- Node.js
- PostgreSQL

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha as credenciais do PostgreSQL no `.env`.
3. Execute `npm install`.
4. Execute `npm start` ou use `INICIAR_SERVIDOR.bat` no Windows.

O arquivo `.env` não deve ser versionado.

## Banco de dados

As migrações SQL estão em `database/` e devem ser aplicadas no banco da instalação.

## Verificação

```bash
npm run check
```

## Estrutura

- `server.js` — servidor/API
- páginas HTML — interface
- arquivos JS/CSS — módulos e estilos
- `database/` — migrações
- `scripts/` — utilitários

## Versão

V25 — documento aberto editável, recuperação e doações com documentos operacionais, histórico e auditoria.
