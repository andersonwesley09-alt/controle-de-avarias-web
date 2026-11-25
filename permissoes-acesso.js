"use strict";
// Controle de acesso V27.13. Valores falsos nunca são substituídos por permissões padrão.
const GRUPOS = [
  {titulo:"Dashboard", opcoes:[["dashboard.visualizar","Visualizar indicadores"],["dashboard.exportar","Gerar relatórios e exportar"]]},
  {titulo:"Avarias e Baixas", opcoes:[["avarias.consultar","Consultar avarias"],["avarias.cadastrar","Lançar avarias"],["avarias.editar","Editar avarias"],["avarias.excluir","Excluir avarias"],["avarias.exportar","Exportar avarias"],["baixas.consultar","Consultar baixas"],["baixas.lancar","Realizar baixas"],["baixas.editar","Editar baixas"],["baixas.excluir","Excluir baixas"],["baixas.exportar","Exportar baixas"]]},
  {titulo:"Produtos e Caixas", opcoes:[["produtos.consultar","Consultar produtos"],["produtos.editar","Editar categorias"],["produtos.importar","Importar produtos"],["caixas.consultar","Consultar caixas"],["caixas.movimentar","Movimentar caixas"],["caixas.excluir","Excluir caixas/itens"]]},
  {titulo:"Recuperações e Doações", opcoes:[["recuperacoes.consultar","Consultar recuperações"],["recuperacoes.criar","Cadastrar recuperações"],["recuperacoes.editar","Editar recuperações"],["recuperacoes.finalizar","Finalizar recuperações"],["recuperacoes.excluir","Excluir recuperações"],["recuperacoes.exportar","Exportar recuperações"],["doacoes.consultar","Consultar doações"],["doacoes.criar","Criar doações"],["doacoes.editar","Editar doações"],["doacoes.finalizar","Finalizar doações"],["doacoes.excluir","Excluir doações"],["doacoes.exportar","Exportar doações"]]},
  {titulo:"Notas fiscais pendentes", opcoes:[["nfs.consultar","Consultar NFs pendentes"],["nfs.criar","Cadastrar/importar NFs"],["nfs.editar","Editar e concluir pendências"],["nfs.excluir","Excluir pendências"],["nfs.exportar","Exportar relatório de NFs"]]},
  {titulo:"Tarefas e Listas", opcoes:[["tarefas.consultar","Consultar tarefas diárias"],["tarefas.concluir","Concluir próprias tarefas"],["tarefas.gerenciar","Distribuir/gerenciar tarefas"],["listas.proprias","Gerenciar minhas listas"]]},
  {titulo:"Outros módulos", opcoes:[["documentos.consultar","Consultar documentos"],["documentos.criar","Enviar documentos"],["documentos.editar","Editar documentos"],["documentos.excluir","Excluir documentos"],["avisos.consultar","Consultar avisos"],["avisos.criar","Publicar avisos"],["avisos.excluir","Excluir avisos"],["mapeamento.consultar","Consultar mapeamento"],["mapeamento.editar","Alterar mapeamento"],["auditoria.consultar","Consultar auditoria"]]}
];
const CHAVES = GRUPOS.flatMap(g => g.opcoes.map(x => x[0]));
const TODAS = Object.fromEntries(CHAVES.map(k=>[k,true]));
const LEITURA = Object.fromEntries(CHAVES.map(k=>[k,false]));
for (const k of CHAVES) if (/\.(consultar|visualizar|exportar|proprias)$/.test(k)) LEITURA[k] = true;
LEITURA['tarefas.concluir'] = true;
LEITURA['auditoria.consultar'] = false;
// O administrador continua sendo o único que pode conceder permissões.
const LEGADO_ADMIN = new Set([
  'tarefas.gerenciar','produtos.editar','produtos.importar', 'mapeamento.editar',
  'auditoria.consultar','baixas.editar','baixas.excluir'
]);
function normalizar(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  if (Object.keys(valor).some(k => !CHAVES.includes(k) || typeof valor[k] !== 'boolean')) return null;
  // Estrutura explícita completa: sem defaults permissivos para campos esquecidos.
  return Object.fromEntries(CHAVES.map(k=>[k,valor[k] === true]));
}
function acessoDoUsuario(sessao) {
  if (sessao?.perfil === 'admin') return {...TODAS};
  const p = sessao?.permissoes;
  if (p === null || p === undefined) return null; // Somente NULL indica usuário legado.
  return (normalizar(p) || Object.fromEntries(CHAVES.map(k=>[k,false])));
}
function autorizar(sessao, chaves) {
  if (sessao?.perfil === 'admin') return true;
  const pessoais = acessoDoUsuario(sessao);
  if (!pessoais) {
    // Permissões anteriores continuam iguais; o módulo NOVO não concede escrita
    // por omissão a usuários com configuração legada sem permissões explícitas.
    const isPermitidaLegada = k => !String(k).startsWith('nfs.') || k === 'nfs.consultar' || k === 'nfs.exportar';
    if(chaves && Array.isArray(chaves.qualquer)) return chaves.qualquer.some(isPermitidaLegada);
    return (Array.isArray(chaves) ? chaves : [chaves]).every(isPermitidaLegada);
  }
  if (chaves && typeof chaves === 'object' && Array.isArray(chaves.qualquer)) {
    return chaves.qualquer.some(k => pessoais[k] === true);
  }
  const lista = Array.isArray(chaves) ? chaves : [chaves];
  return lista.every(k => pessoais[k] === true);
}
function identificar(method, path) {
  const m=String(method||'GET').toUpperCase(), p=String(path||'');
  if (!p.startsWith('/api/')) return null;
  if (/^\/api\/(?:asset-check|versao|rede-info|saude|status|eventos|login|logout|sessao|perfil|notificacoes(?:\/|$))/.test(p)) return null;
  if (/^\/api\/usuarios(?:\/|$)/.test(p) || /^\/api\/admin(?:\/|$)/.test(p) || /^\/api\/(?:migracao|migracao-local|diagnostico-historico)(?:\/|$)/.test(p) || p==='/api/documentos/importar-local') return 'ADMIN';
  if (/^\/api\/nfs-pendentes(?:\/|$)/.test(p)) {
    if (/\/exportar$/.test(p)) return 'nfs.exportar';
    if (/\/importar$/.test(p)) return 'nfs.criar';
    if (/\/anexo$/.test(p)) return m==='GET'?'nfs.consultar':'nfs.editar';
    if (m==='GET') return 'nfs.consultar';
    if (m==='POST') return 'nfs.criar';
    if (m==='DELETE') return 'nfs.excluir';
    return 'nfs.editar';
  }
  if (/^\/api\/listas-pessoais(?:\/|$)/.test(p)) return 'listas.proprias';
  if (/^\/api\/tarefas\/(?:admin|usuarios)(?:\/|$)/.test(p) || /^\/api\/tarefas\/copiar-dia(?:\/|$)/.test(p) || (p==='/api/tarefas' && m==='POST')) return 'tarefas.gerenciar';
  if (/^\/api\/tarefas(?:\/|$)/.test(p)) return m==='GET'?'tarefas.consultar':m==='DELETE'?'tarefas.gerenciar':'tarefas.concluir';
  if (/^\/api\/auditoria(?:\/|$)/.test(p)) return m==='GET'?'auditoria.consultar':'ADMIN';
  if (/^\/api\/avisos(?:\/|$)/.test(p)) return m==='GET'?'avisos.consultar':m==='DELETE'?'avisos.excluir':'avisos.criar';
  if (/^\/api\/mapeamento(?:\/|$)/.test(p)) return m==='GET'?'mapeamento.consultar':'mapeamento.editar';
  if (/^\/api\/dashboard(?:\/|$)/.test(p)) return p.includes('/relatorio')?'dashboard.exportar':'dashboard.visualizar';
  if (/^\/api\/produtos(?:\/|$)/.test(p)) return p.includes('/importar')?'produtos.importar':m==='GET'?'produtos.consultar':'produtos.editar';
  if (/^\/api\/caixas(?:\/|$)/.test(p)) return m==='GET'?'caixas.consultar':m==='DELETE'||/\/(?:excluir|remover)(?:\/|$)/.test(p)?'caixas.excluir':'caixas.movimentar';
  if (/^\/api\/recuperacoes(?:\/|$)/.test(p)) {
    if (/\/exportar-(?:xlsx|pdf)$/.test(p)) return 'recuperacoes.exportar';
    if (m==='GET') return 'recuperacoes.consultar';
    if (m==='DELETE') return 'recuperacoes.excluir';
    if (/\/finalizar$/.test(p)) return 'recuperacoes.finalizar';
    if (m==='PUT'||m==='PATCH') return 'recuperacoes.editar';
    return 'recuperacoes.criar';
  }
  if (/^\/api\/doacoes(?:\/|$)/.test(p)) {
    if (/\/exportar-(?:xlsx|pdf)$/.test(p)) return 'doacoes.exportar';
    if (m==='GET') return 'doacoes.consultar';
    if (m==='DELETE') return 'doacoes.excluir';
    if (/\/finalizar$/.test(p)) return 'doacoes.finalizar';
    if (m==='PUT'||m==='PATCH') return 'doacoes.editar';
    return 'doacoes.criar';
  }
  if (/^\/api\/historico-avarias(?:\/|$)/.test(p)) return m==='GET'?{qualquer:['avarias.consultar','baixas.consultar']}:m==='DELETE'?'baixas.excluir':'baixas.editar';
  if (/^\/api\/avarias(?:\/|$)/.test(p)) {
    if (/\/encaminhar-doacao$/.test(p)) return ['avarias.consultar','doacoes.criar'];
    if (/\/exportar(?:-|$|\/)/.test(p)) return 'avarias.exportar';
    if (m==='GET') return 'avarias.consultar';
    if (m==='DELETE') return 'avarias.excluir';
    if (/\/status$/.test(p) && m==='PATCH') return 'baixas.lancar';
    if (m==='PUT'||m==='PATCH') return 'avarias.editar';
    return 'avarias.cadastrar';
  }
  if (/^\/api\/documentos(?:\/|$)/.test(p)) return m==='GET'?'documentos.consultar':m==='DELETE'?'documentos.excluir':m==='PUT'||m==='PATCH'?'documentos.editar':'documentos.criar';
  // Rota não reconhecida: para usuários com restrições, negar por segurança.
  return 'DESCONHECIDA';
}
module.exports={GRUPOS,CHAVES,TODAS,LEITURA,LEGADO_ADMIN,normalizar,autorizar,identificar,acessoDoUsuario};
