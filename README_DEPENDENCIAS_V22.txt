V22 - DEPENDENCIAS DO SERVIDOR

O projeto utiliza dependencias Node.js como dotenv, express, cors, pg, multer, xlsx e bcryptjs.

IMPORTANTE:
Voce NAO precisa executar npm install toda vez.

O arquivo INICIAR_SERVIDOR.bat verifica automaticamente se as dependencias estao instaladas.
- Se estiverem instaladas: inicia o servidor normalmente.
- Se estiver faltando alguma: instala automaticamente e depois inicia o servidor.

A instalacao automatica acontece somente quando necessario, por exemplo na primeira execucao em um computador novo.

Requisito: Node.js LTS instalado no Windows e acesso a internet na primeira instalacao das dependencias.

Se a instalacao falhar por falta de internet, execute INSTALAR_DEPENDENCIAS.bat quando a conexao estiver disponivel.
