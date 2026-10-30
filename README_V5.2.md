# Portfólio Wesley — V5.0.2

Correção pontual da V5.0.1: restaurados os botões **Ver detalhes** e **Acessar projeto** nos cards. Acessar projeto aparece **somente** quando há uma URL externa válida configurada para aquele projeto em `data/projects.json`, no campo `link`. A mesma URL aparece também na página individual.

**Importante:** os dois cadastros recebidos não continham links de destino, por isso não foi possível preencher URLs sem inventá-las. Para ativar o botão, edite `data/projects.json` e adicione `"link": "https://endereco-real-do-seu-projeto"` dentro do objeto correspondente. O campo já existe no formulário do painel Decap CMS.

Atenção: use a URL exata de cada projeto, seja a demonstração ou o repositório, e não a URL do portfólio.

Para atualizar manualmente no GitHub, basta enviar `projects.js`, `detail.js` e `style.css` e, após configurar as URLs, `data/projects.json`. As demais páginas e funcionalidades permanecem preservadas.
