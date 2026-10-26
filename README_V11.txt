V11.3 - Mapeamento com contagem exata de quadrados: L1=20, L2=16, L3=16, L4=14, L5=14.

V11 - MAPEAMENTO

Atualizações:
- Nova aba Mapeamento dentro do módulo Caixas.
- Layout baseado na ordem e estrutura do mapa físico enviado.
- Posições preservadas por linha/coluna no banco PostgreSQL.
- Nome de cada posição pode ser editado diretamente no mapa.
- Alterações são salvas no PostgreSQL e identificam o usuário que fez a alteração.
- Atualização em tempo real via SSE entre os PCs conectados.
- Caixas e Mapeamento ficam disponíveis em abas separadas.
- Mantidos os recursos existentes da V10.3.

Observação:
Os textos iniciais das posições foram transcritos do mapa enviado; posições de leitura duvidosa ficam editáveis para ajuste no próprio sistema.

Para usar:
1. Substitua o projeto pela V11 mantendo o banco PostgreSQL atual.
2. Inicie o servidor normalmente.
3. Abra Caixas > Mapeamento.
4. Clique em qualquer posição para alterar o nome.


V11.2 - Mapeamento:
- Edição e exclusão de nomes do mapa somente para perfil admin.
- Exclusão limpa o nome da posição sem remover a posição física do mapa.
- Mapa ocupa o tamanho disponível; em telas menores usa rolagem horizontal.
- Tempo real mantido via SSE.

V11.4: mapa corrigido conforme imagem de referência: L1 4|2|6|6|2; L2/L3 2|6|6|2; L4/L5 2|5|5|2; divisões verticais e área inferior ajustadas.


V11.5 - Correção do mapa: linha 1 com 20 posições e larguras independentes por linha; linhas 2/3 com 16 e 4/5 com 14, mantendo as divisões do modelo.


V11.6 - Ajuste final do mapa:
- Linhas 4 e 5 passam a ter 2 | 6 | 6 posições, totalizando 14 quadrados.
- A faixa à direita, abaixo das posições SÃO BRAZ, fica sem quadrados.
- O administrador agora pode excluir o quadrado inteiro pelo botão "Excluir quadrado".
- A exclusão é persistida como posição inativa no PostgreSQL e não volta após reiniciar.
- A posição excluída deixa apenas o espaço correspondente no mapa, preservando a geometria.
- Usuários comuns continuam somente em modo de leitura.
- Atualização em tempo real mantida via SSE.
