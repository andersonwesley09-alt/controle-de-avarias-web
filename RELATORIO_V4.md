# Relatório — Portfólio V4

## Objetivo
Manter os cards de projetos, mas retirar a gestão de projetos do código da página. A área de projetos agora é uma página própria e os dados dos cards vêm de `data/projects.json`.

## Alterações

### 1. Projetos em página separada
- Criado `projetos.html`.
- Os cards continuam com o mesmo conceito visual, agora em uma página dedicada.
- A Home ficou mais limpa e o menu aponta para a página de projetos.

### 2. Projetos administráveis
- Criado `data/projects.json`.
- O JavaScript da página de projetos lê os dados desse arquivo e monta os cards automaticamente.
- É possível cadastrar novos projetos sem editar HTML/JavaScript.
- Cada projeto pode ter título, categoria, tipo, descrição, detalhes, funcionalidades, tecnologias, imagem, link e status publicado/rascunho.

### 3. Painel administrativo
- Criado `/admin/` com Decap CMS.
- A coleção `Projetos` edita diretamente `data/projects.json`.
- O campo de projetos usa lista repetível: no painel, o administrador pode adicionar, remover e reordenar cards.
- Imagens podem ser enviadas pela biblioteca de mídia.
- Projetos podem ficar como rascunho e não aparecer no site.

### 4. Segurança do administrador
- Não foi criada uma senha fixa dentro do JavaScript.
- O acesso administrativo foi preparado para autenticação via Decap Turbo + GitHub.
- O repositório deve ter somente a conta do proprietário com permissão de escrita.

### 5. GitHub Pages
- Criado `.github/workflows/pages.yml`.
- A cada push na branch `main`, o GitHub Actions publica o site no GitHub Pages.

### 6. 404
- Criado `404.html` para endereços inexistentes.

### 7. Estabilidade
- Removidas do `script.js` da Home as dependências do antigo modal de projetos, evitando erros causados pela separação da página.
- Mantidos tema claro/escuro, menu responsivo, animações, formulário e demais recursos da V3.

## Por que essa arquitetura?
GitHub Pages hospeda conteúdo estático. Por isso, o painel não deve tentar gravar uma senha ou token no navegador. O CMS autentica o administrador e grava as alterações no repositório. O site público apenas lê os dados publicados.

O Decap CMS documenta que o backend do GitHub serve para ler e atualizar conteúdo no repositório, e o Decap Turbo oferece autenticação hospedada e proxy para o GitHub. O GitHub Pages pode ser publicado automaticamente por GitHub Actions.

## Configuração que ainda depende da conta do proprietário
O arquivo `admin/config.yml` contém `COLOQUE-SEU-TURBO-SITE-ID-AQUI`. Esse ID só existe depois que o repositório for conectado ao Decap Turbo. Ele não deve ser inventado.

Depois de criar o site no Turbo, basta substituir o placeholder pelo Site ID real e cadastrar a URL exata de `/admin/`.


## Correção V4.1 — carregamento local dos projetos
- Corrigido o problema de `projetos.html` mostrar “Não foi possível carregar os projetos agora” quando aberto diretamente pelo Windows/Chrome (`file://`).
- Em hospedagem HTTP/GitHub Pages, `data/projects.json` continua sendo a fonte oficial.
- Em abertura local, existe um fallback embutido com os mesmos projetos atuais, sem alterar o visual ou o funcionamento dos cards.
