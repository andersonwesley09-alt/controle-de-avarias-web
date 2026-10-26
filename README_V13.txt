CONTROLE DE AVARIAS - V13.1
============================

Base: V13

CORREÇÃO V13.1 - ACESSO MULTI-PC / CACHE
------------------------------------------
- Frontend continua usando window.location.origin; nenhum localhost fixo no navegador.
- Arquivos HTML, CSS e JS passaram a ter versionamento ?v=13.1.
- O servidor envia Cache-Control: no-store para os arquivos públicos.
- Login usa fetch com cache no-store.
- Consultas dinâmicas principais usam cache no-store.
- Mantida a API central no PC principal e o PostgreSQL compartilhado.
- Mantido SSE para atualização em tempo real.

IMPORTANTE
----------
Após substituir a versão no PC principal, faça uma vez Ctrl+Shift+R nos PCs que já tinham a V13 aberta. Depois disso, as próximas atualizações de frontend não devem ficar presas ao cache.

As funcionalidades da V13 permanecem inalteradas.
