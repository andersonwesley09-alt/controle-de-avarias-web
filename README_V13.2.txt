CONTROLE DE AVARIAS - V13.2

CORREÇÃO PRINCIPAL
Se login.html ou index.html for aberto localmente (file://), o frontend agora usa automaticamente o servidor padrão http://10.10.70.163:3000.
Se for aberto pelo Node, usa automaticamente o endereço atual (window.location.origin).

TESTE
1. Execute INICIAR_SERVIDOR.bat no PC principal.
2. Confirme PostgreSQL conectado.
3. No outro PC, acesse http://10.10.70.163:3000.
4. Teste login e Dashboard.
5. Se o IP do servidor mudar, altere o fallback nos arquivos JS ou, preferencialmente, abra o sistema pelo novo endereço do servidor.
