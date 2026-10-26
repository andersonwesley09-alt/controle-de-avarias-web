CONTROLE DE AVARIAS - V20.0

CORREÇÃO DEFINITIVA DO HISTÓRICO E DASHBOARD

1. Execute INICIAR_SERVIDOR.bat no computador que possui o PostgreSQL.
2. Se a porta 3000 estiver ocupada por uma versão antiga, execute REINICIAR_SERVIDOR.bat.
3. Acesse http://localhost:3000 no computador principal.
4. Nos demais PCs, use o endereço exibido no terminal, por exemplo http://IP_DO_SERVIDOR:3000.

O QUE A V20.0 CORRIGE
- Sincroniza avarias existentes com o histórico sempre que o histórico é consultado.
- Recupera registros do último backup JSON local sem apagar dados atuais.
- Se a tabela historico_avarias estiver vazia ou incompatível, o sistema usa avarias como fallback para que o histórico e o Dashboard não fiquem vazios.
- O cadastro de uma avaria não é perdido se a projeção do histórico apresentar problema.
- Dashboard e Avarias usam a mesma API /api/historico-avarias.
- Mantém sessão centralizada.
- Não existem arquivos INICIAR/REINICIAR duplicados de versões anteriores.

IMPORTANTE
A recuperação do backup é aditiva: registros atuais não são apagados nem substituídos. O snapshot existente é usado apenas para recuperar histórico que não esteja presente.
