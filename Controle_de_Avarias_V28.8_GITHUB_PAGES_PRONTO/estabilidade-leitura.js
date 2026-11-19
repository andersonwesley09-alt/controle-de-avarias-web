/* Controle de Avarias V27.12 - recuperacao pontual de consultas GET. */
(() => {
  if (window.__caLeituraResilienteAtiva || window.CA_LOCAL_MODE) return;
  window.__caLeituraResilienteAtiva = true;
  const fetchOriginal = window.fetch.bind(window);
  let houveFalha = false;
  let ultimoAviso = 0;
  const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
  function notificarReconexao() {
    if (Date.now() - ultimoAviso < 1500) return;
    ultimoAviso = Date.now();
    window.dispatchEvent(new Event('ca:reconexao'));
  }
  window.addEventListener('online', () => { if (houveFalha) notificarReconexao(); });
  window.addEventListener('focus', () => {
    if (houveFalha && navigator.onLine !== false) notificarReconexao();
  });
  // SSE avisa quando o banco terminou de iniciar ou a conexao foi restaurada.
  if (typeof window.EventSource === 'function') {
    const EventSourceAnterior = window.EventSource;
    window.EventSource = class EventSourceRecuperavel extends EventSourceAnterior {
      constructor(url, opcoes) {
        super(url, opcoes);
        let caiu = false;
        this.addEventListener('error', () => { caiu = true; });
        this.addEventListener('open', () => {
          if (caiu) { caiu = false; notificarReconexao(); }
        });
        this.addEventListener('sistema-pronto', notificarReconexao);
      }
    };
  }
  window.fetch = async function(input, init) {
    const metodo = String(init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
    let uri;
    try { uri = new URL(typeof input === 'string' ? input : input.url, location.href); }
    catch (_) { return fetchOriginal(input, init); }
    const baseConfigurada = window.CA_API_BASE ? new URL(window.CA_API_BASE, location.href).origin : location.origin;
    if (metodo !== 'GET' || !uri.pathname.startsWith('/api/') ||
        (uri.origin !== location.origin && uri.origin !== baseConfigurada) ||
        (init?.signal?.aborted || (typeof Request !== 'undefined' && input instanceof Request && input.signal.aborted))) {
      return fetchOriginal(input, init);
    }
    for (let tentativa = 0; tentativa <= 2; tentativa++) {
      try {
        const resposta = await fetchOriginal(input, init);
        if (![500, 502, 503, 504].includes(resposta.status) || tentativa === 2) {
          if (resposta.ok) houveFalha = false;
          return resposta;
        }
        houveFalha = true;
      } catch (erro) {
        if (erro?.name === 'AbortError' || tentativa === 2) throw erro;
        houveFalha = true;
      }
      await pausa(tentativa === 0 ? 450 : 1100);
    }
  };
})();
