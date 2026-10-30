# V5.0.3 — Botão de acesso a projetos

A V5.0.2 ocultava o botão se não houvesse URL externa no cadastro. A V5.0.3 mostra o botão tanto nos cards quanto na página de detalhes. Sem link, fica **desabilitado** com a mensagem “Link ainda não cadastrado”; nunca direciona para endereços fictícios.

## Como ativar o botão

Edite `data/projects.json` no GitHub. Dentro de cada projeto, inclua por exemplo:

```json
"link": "https://seu-dominio-ou-repositorio.com/caminho"
```

Use o endereço real de cada projeto. `https://` é obrigatório. A edição será refletida nos cards e na página de detalhes.

## Atualização manual no GitHub

Na raiz do repositório, faça upload dos arquivos desta versão, preservando as pastas. Substituir em especial: `projects.js`, `detail.js`, `style.css`; o README é opcional. **Não use um link inventado.**
