# Controle de Avarias — V28.8 — Demonstração para GitHub Pages

Esta é uma **cópia demonstrativa independente** da versão operacional V28.8. As telas foram preservadas. Ela não utiliza Node.js ou PostgreSQL e **nunca deve ser usada como sistema operacional**. Dados, lançamentos, fornecedores e documentos são fictícios, armazenados apenas na sessão do navegador.

## Acesso de demonstração

- Usuário: `admin`
- Senha: `admin123`

Este login é apenas uma simulação de acesso e **não oferece proteção de dados reais**.

## Recursos para demonstração

- Dashboard, avarias, baixas, caixas, mapeamento, tarefas e demais telas presentes no pacote.
- **NFs Pendentes**: nova pendência, consulta, alteração, exclusão, anexos pequenos e importação/exportação Excel simulados no navegador.
- Filtrar NFs por fornecedor, situação (`Pendente` e `Resolvido`), período e pesquisa; os indicadores acompanham os filtros.
- Enter no Número da NF direciona o foco para Série.
- Mapeamento demonstrativo com 80 posições; edição restrita à conta `admin` na interface.
- Permissões visíveis na interface, sem garantia de segurança real (não há servidor).

Algumas funções avançadas e integrações dependentes do backend original podem não funcionar de forma idêntica ao sistema operacional. Os dados da demonstração ficam em `sessionStorage`, portanto podem desaparecer ao encerrar a sessão do navegador.

## Publicar no GitHub Pages — repositório já existente

1. Faça backup/commit do conteúdo atual do repositório.
2. **Extraia o ZIP** no computador. Não envie o ZIP como um único arquivo.
3. Acesse o repositório `controle-de-avarias-web` no GitHub, na branch `main`.
4. Clique em `Add file` → `Upload files`. Arraste **todos os arquivos extraídos** para a raiz do repositório, substituindo arquivos com o mesmo nome.
5. Não exclua arquivos antigos que não façam parte desta atualização; não envie arquivos do projeto operacional.
6. Clique em `Commit changes`.
7. Em `Settings` → `Pages`, mantenha `Deploy from a branch` → `main` → `/ (root)`.
8. Abra `https://andersonwesley09-alt.github.io/controle-de-avarias-web/` e faça login com as credenciais demonstrativas.

A publicação pode levar um tempo para refletir as alterações. Se o navegador ainda mostrar a interface antiga, use `Ctrl + Shift + R`.

## O que não está incluído neste pacote

`server.js`, `.env`, banco PostgreSQL, backups, planilhas de produção, arquivos internos e credenciais reais. Não misture esta versão demonstrativa com a operacional.

## Validação do pacote

Verificado com testes de sintaxe JS, arquivos referenciados em HTML e testes programáticos de login, mapeamento (80 posições), consulta, filtro e cadastro de NFs. A execução visual em navegador real e a implantação GitHub Pages ainda precisam ser validadas após o upload.
