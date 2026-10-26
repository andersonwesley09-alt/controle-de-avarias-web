CONTROLE DE AVARIAS - V24.7

Objetivo desta versao:
- Tornar a inicializacao do servidor mais robusta.
- Verificar automaticamente todas as dependencias Node.js antes de iniciar.
- Instalar automaticamente as dependencias ausentes usando package-lock.json.
- Tentar uma segunda instalacao direta se a instalacao principal falhar.
- Fazer o REINICIAR_SERVIDOR.bat usar o mesmo inicializador seguro.

Uso normal:
1. Extraia a versao.
2. Execute INICIAR_SERVIDOR.bat.
3. Nao e necessario executar npm install manualmente.

Se uma dependencia estiver faltando, o inicializador tenta corrigir automaticamente.
