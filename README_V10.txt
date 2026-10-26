# Projeto APP V10 - Com Logo - Controle de Avarias

Base: V9 - Filtros, Admin e Tempo Real.

## Atualizações V10

1. Verificação de produto no cadastro:
   - código precisa existir na base ativa;
   - consulta aceita EAN de 13 dígitos com zero à esquerda;
   - produto sem custo válido fica bloqueado para lançamento;
   - servidor também valida produto e custo antes de salvar.

2. Usuário do lançamento:
   - cada nova avaria registra o usuário autenticado;
   - Registros e Histórico exibem o usuário.

3. Cadastro de avaria:
   - setor: CD, Online, Estoque, Loja e Câmara;
   - motivo: Produto avariado, Degustação de cliente, Fermentado, Vencido, Próximo do vencimento, Embalagem danificada, Quebra e Outro;
   - campo Caixa removido do cadastro. Dados antigos de caixa permanecem no histórico para não perder informações.

4. Baixas/Histórico:
   - os três cards passam a refletir exatamente os registros atualmente exibidos após os filtros;
   - cards: Registros exibidos, Quantidade exibida e Valor total exibido.

5. Tempo real continua ativo entre os PCs por SSE.

## Instalação

1. Pare a versão anterior com Ctrl+C.
2. Execute INICIAR_SERVIDOR.bat desta versão.
3. No PC principal: http://localhost:3000
4. Nos outros PCs: http://IP-DO-PC-PRINCIPAL:3000

A V9 deve ser mantida como backup.


V10.1: importação de produtos aceita colunas V. CUSTO / VALOR C / VALOR CUSTO e variações de código de barras.


V10.2: correção do preenchimento de fornecedor/código de fornecedor na importação, com fallback por posição da planilha e preservação de dados existentes quando a importação vier vazia.


V10.3: importação com consolidação segura de códigos duplicados. Quando o mesmo código aparece mais de uma vez, o sistema prioriza o registro com custo válido e mostra um relatório dos duplicados encontrados. A base é gravada com apenas um registro por código.
