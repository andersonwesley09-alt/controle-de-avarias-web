V20.4 - Navegação autenticada e Assistente IA

BASE: V20.3 estável. Não altera banco, histórico, cadastro de avarias ou lógica de dados.

ALTERAÇÕES:
1. Dashboard na página de boas-vindas agora valida a sessão no servidor antes de navegar.
2. A validação usa cookie HttpOnly e Bearer apenas como fallback para garantir que o cookie seja estabelecido.
3. Se a sessão estiver inválida, somente então retorna ao login.
4. Cabeçalho do Dashboard deixa de mostrar "Entrar" para usuário já autenticado e passa a mostrar "← Voltar".
5. Analista IA recebeu identidade visual própria: núcleo luminoso, órbitas, pulso, indicador online e cabeçalho de assistente.
6. IDs e lógica do Analista IA foram preservados.
7. Nenhuma alteração de banco de dados.


V20.5 - Login reorganizado em duas colunas: resumo do sistema à esquerda e login à direita.
