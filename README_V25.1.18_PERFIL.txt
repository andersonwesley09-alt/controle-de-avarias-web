V25.1.18 - CORREÇÃO EXCLUSIVA DO PERFIL

Alteração somente em perfil.html e perfil.js.

Correção:
- A página de perfil não depende mais do endereço salvo em localStorage para descobrir a API.
- Se aberta pelo servidor, usa a própria origem (ex.: http://10.10.70.163:3000).
- Se aberta por arquivo local, usa o servidor configurado/fixo 10.10.70.163:3000.
- Mantém cookies e Bearer token na chamada da API.
- Cache do perfil foi renovado para evitar carregar o JS antigo.

Nenhum outro módulo, banco, rota ou arquivo funcional foi alterado.
