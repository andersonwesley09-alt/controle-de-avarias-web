# Controle de Avarias — Vitrine GitHub Pages V25.1.28

Esta é a **versão demonstrativa estática** do sistema, com a interface da V25.1.28. **Não** é a versão operacional da empresa.

- HTML, CSS e JavaScript; sem Node.js, PostgreSQL, credenciais ou conexão com o servidor interno.
- Não contém logo da empresa, fotografia da fachada, banco de dados, backups, documentos privados nem registros reais.
- Dados de teste fictícios são mantidos **somente na sessão deste navegador** (`sessionStorage`); ao fechar a sessão podem ser perdidos. Não há sincronização entre dispositivos.
- Login demonstrativo: `admin` / `admin123` (**não é autenticação segura; apenas interface para demonstração**).
- Inclui telas de Registros, Avarias, Dashboard, Caixas, Recuperações, Doações, Produtos, Tarefas, Auditoria e demais páginas originais. Os fluxos e PDFs demonstrativos são simulados no navegador.
- Alguns recursos dependentes da infraestrutura real (ex.: notificações em tempo real, processamento no servidor e integrações) **não estão disponíveis nesta vitrine**.

## Publicação no GitHub Pages

Envie o **conteúdo interno deste ZIP** diretamente para a raiz do repositório `controle-de-avarias-web` (branch `main`). Em *Settings → Pages*, selecione *Deploy from a branch*, branch `main`, pasta `/ (root)`.

Não envie o ZIP de produção, `node_modules`, `.env`, `server.js`, `database`, `backups` ou PDFs originais ao repositório.

## Teste antes de publicar

Abra a pasta em um servidor estático local (por exemplo, VS Code Live Server ou `python -m http.server 8000`) e acesse `/login.html`. Teste login demo, fluxo de cadastro, encaminhamento de uma avaria para Doações, gestão e PDF, filtragem e exportação.

**Versão de produção preservada**: o pacote de GitHub é independente e não modifica o sistema real nem o banco de dados da empresa.
