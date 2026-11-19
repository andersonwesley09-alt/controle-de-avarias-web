/* V28 — Controle visual de acesso. A autorização efetiva é sempre feita no servidor. */
(()=>{
  'use strict';
  let sessao;
  try { sessao=JSON.parse(sessionStorage.getItem('usuarioLogado')||'null'); } catch { sessao=null; }
  if (!sessao) return;
  const caminho=(location.pathname.split('/').pop()||'').toLowerCase();
  let confirmado=false;
  let indisponivel=false;
  const permissoesLegadoNegadas=new Set(['produtos.importar','auditoria.consultar','tarefas.gerenciar','nfs.criar','nfs.editar','nfs.excluir']);
  function permitido(chave){
    if (indisponivel) return false;
    if (sessao?.perfil==='admin') return true;
    const p=sessao?.permissoes;
    if (p===null||p===undefined) return !permissoesLegadoNegadas.has(chave);
    return p[chave]===true;
  }
  function permitidoAba(aba){
    return aba==='cadastro' ? permitido('avarias.cadastrar') :
           aba==='registros' ? permitido('avarias.consultar') :
           aba==='baixas' ? permitido('baixas.consultar') :
           aba==='nfs' ? permitido('nfs.consultar') : false;
  }
  function podeDoar(){return permitido('avarias.consultar')&&permitido('doacoes.criar');}
  function ajustarSeletor(seletor,pode){
    document.querySelectorAll(seletor).forEach(el=>{
      if(!pode){
        el.style.setProperty('display','none','important');
        if(el.matches('button,input[type="button"]') && !el.disabled){el.disabled=true;el.dataset.caAclDisabled='1';}
      } else {
        el.style.removeProperty('display');
        if(el.dataset.caAclDisabled==='1'){el.disabled=false;delete el.dataset.caAclDisabled;}
      }
    });
  }
  function aplicar(){
    if(caminho==='avarias.html'){
      // A aba NFs deve permanecer visível como referência ao módulo, mesmo
      // quando o usuário ainda não possui a permissão de consulta. O clique
      // será bloqueado por abrirAba() e a API continua validando a permissão.
      // Isso evita parecer que a atualização não foi instalada.
      for(const aba of ['cadastro','registros','baixas']) ajustarSeletor(`[data-aba="${aba}"]`,permitidoAba(aba));
      ajustarSeletor('[data-aba="nfs"]',true);
      const abaNfs=document.querySelector('[data-aba="nfs"]');
      if(abaNfs) abaNfs.title=permitidoAba('nfs')?'Acompanhar notas fiscais pendentes':'Acesso restrito: solicite ao administrador a permissão Consultar NFs pendentes';
      if(!permitido('avarias.cadastrar')){
        document.getElementById('btnSalvar')?.setAttribute('disabled','disabled');
      }
      ajustarSeletor('.btn-editar-registro,#btnExcluirSelecionados',permitido('avarias.excluir'));
      ajustarSeletor('#btnCompartilhar',permitido('avarias.exportar'));
      ajustarSeletor('#btnEnviarDoacaoSelecionados,.btn-enviar-doacao-linha',podeDoar());
      ajustarSeletor('#btnExportarBaixasXlsx,#btnExportarBaixasPdf',permitido('baixas.exportar'));
      ajustarSeletor('.somente-admin-historico,.btn-editar-baixa:not(.btn-editar-registro)',permitido('baixas.editar'));
      ajustarSeletor('#btnExcluirHistoricoSelecionados,#btnExcluirBaixaModal',permitido('baixas.excluir'));
      // Abas não autorizadas devem perder a classe ativo, mesmo se a sessão
      // foi alterada enquanto esta página estava aberta.
      const atual=document.querySelector('.aba-btn.ativo');
      if(atual && !permitidoAba(atual.dataset.aba) && typeof window.caAbrirAbaAutorizada==='function'){
        window.caAbrirAbaAutorizada();
      }
    }
    if(caminho==='produtos.html'){
      ajustarSeletor('input[type="file"],input[type="file"]~button',permitido('produtos.importar'));
    }
  }
  const headers=sessao.token?{Authorization:`Bearer ${sessao.token}`} : {};
  const pronto=fetch((window.CA_API_BASE||location.origin)+'/api/sessao',{
      credentials:'include',headers,cache:'no-store',
      signal:typeof AbortSignal!=='undefined' && typeof AbortSignal.timeout==='function'
        ? AbortSignal.timeout(12000) : undefined
    }).then(async resp=>{
      if(resp.status===401){
        sessionStorage.removeItem('usuarioLogado');
        location.assign('login.html');
        throw Error('Sua sessão expirou. Faça login novamente.');
      }
      if(!resp.ok) throw Error('Não foi possível confirmar a sessão (HTTP '+resp.status+').');
      const info=await resp.json();
      if(!info || !info.perfil || !info.usuario)throw Error('Sessão retornou dados incompletos.');
      sessao={...sessao,...info,permissoes:info.permissoes??null};
      sessionStorage.setItem('usuarioLogado',JSON.stringify(sessao));
      confirmado=true;
      aplicar();
      window.dispatchEvent(new Event('ca:permissoes-atualizadas'));
      return true;
    }).catch(erro=>{
      indisponivel=true;
      console.warn('V28: não foi possível confirmar permissões:',erro.message);
      aplicar();
      return false;
    });
  window.CA_ACL={permitido,permitidoAba,podeDoar,aplicar,pronto,estaConfirmado:()=>confirmado,estaDisponivel:()=>!indisponivel};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicar,{once:true});
  else aplicar();
  if(caminho==='avarias.html'){
    let agendado=false;
    function ativarObserver(){
      const observer=new MutationObserver(()=>{
        if(agendado)return;agendado=true;
        queueMicrotask(()=>{agendado=false;aplicar();});
      });
      for(const id of ['tabelaRegistros','tabelaHistorico']){
        const el=document.getElementById(id);
        if(el)observer.observe(el,{childList:true});
      }
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ativarObserver,{once:true});
    else ativarObserver();
  }
})();
