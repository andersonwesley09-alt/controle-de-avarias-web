# Projeto HTML Wesley — V5.0.0

## Uso local

Execute `python -m http.server 8000` na pasta do projeto e acesse `http://localhost:8000/`. Não abra os HTML por `file://`, pois o JSON é carregado via fetch.

## Recursos

- Busca, filtros por tipo e destaques em `projetos.html`.
- Página de detalhe `projeto.html?slug=...` com galeria, tecnologias, funcionalidades e links externos seguros.
- Projetos vêm exclusivamente de `data/projects.json`; falhas de carregamento são exibidas (sem dados fictícios/obsoletos).
- Campo `preview_html` legado permanece no JSON para compatibilidade de dados, mas não é executado (proteção contra HTML não confiável).
- `image`: caminho dentro de `assets/` ou URL absoluta HTTPS/HTTP; `gallery`: lista `{ "image": "assets/...", "alt": "..." }`.
- `featured: true` marca destaque; `published: false` oculta o projeto.

## Painel administrativo — configuração necessária

O Decap CMS está em `/admin/`. O `admin/config.yml` usa o backend `github`. Antes de funcionar: (1) substitua `SEU_USUARIO/SEU_REPOSITORIO` pelo repositório correto; (2) configure um provedor OAuth compatível para autenticação no GitHub e indique `base_url` quando necessário; (3) conceda as permissões de edição. GitHub Pages **não** fornece autenticação Decap CMS automaticamente. Sem essa configuração, edite `data/projects.json` diretamente. Testes automatizados não substituem o teste de login real.

## SEO / compartilhamento

Metadados de descrição, Open Graph e Twitter Cards estão presentes. Para cartões sociais completos, após definir a URL pública, configure `og:url` e `og:image` com URLs **absolutas públicas** e um arquivo de capa. Sites de redes sociais geralmente não executam JavaScript: previews individualizados de cada projeto exigem HTML pré-gerado no deploy (ou servidor), não apenas mudança dinâmica de metatags no navegador.

## Contato

O formulário valida campos e prepara um e-mail via `mailto:`. O envio depende do usuário confirmar no aplicativo de e-mail; nenhuma mensagem é enviada pelo site.

## Implantação

Mantenha `.github/workflows/pages.yml` e publique a pasta na raiz do repositório conforme README original. Faça cópia do JSON antes de alterar conteúdos.
