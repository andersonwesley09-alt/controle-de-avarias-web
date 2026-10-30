# Portfólio V4 — Wesley

Site estático preparado para GitHub Pages, com área pública e painel de projetos administrável.

## Estrutura
- `index.html` — página principal
- `projetos.html` — página de projetos mantendo os cards
- `data/projects.json` — conteúdo dos projetos
- `admin/` — painel Decap CMS
- `assets/uploads/` — imagens adicionadas pelo painel
- `404.html` — página de erro

## Adicionar projeto sem editar código
O painel administrativo foi preparado para editar `data/projects.json`. Depois de configurar a autenticação do Decap Turbo, acesse `/admin/`, faça login e use **Portfólio → Projetos**. Ao salvar, o conteúdo é gravado no repositório e o GitHub Pages publica a alteração.

## GitHub Pages
O site é estático e pode ser publicado diretamente pelo GitHub Pages. O GitHub Pages pode ser implantado por GitHub Actions.

## Administração segura
Não há senha fixa no JavaScript. A autenticação deve ser feita pelo Decap Turbo/GitHub. Mantenha apenas sua conta com acesso de escrita ao repositório.

## Antes de publicar
1. Crie o repositório no GitHub.
2. Envie todos os arquivos.
3. Ative GitHub Pages.
4. Crie uma organização/site no Decap Turbo e conecte o repositório GitHub.
5. Copie o Site ID gerado para `admin/config.yml` no campo `turbo_site_id`.
6. Cadastre a URL exata de `admin/` no Decap Turbo.
7. Acesse `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/admin/`.

O backend `turbo-github` usa autenticação hospedada e grava o conteúdo no GitHub; o site público continua hospedado no GitHub Pages.
