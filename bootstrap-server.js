/* CONTROLE DE AVARIAS V25.1 — MODO VITRINE */

(() => {
    const hostname = String(window.location.hostname || "");

    const githubPages =
        /\.github\.io$/i.test(hostname) ||
        /\.pages\.dev$/i.test(hostname);

    if (!githubPages) {
        return;
    }

    /*
     * Carregamento síncrono.
     * O mock precisa existir ANTES de login.js e dos demais módulos.
     */
    document.write(
        '<script src="demo-api-v25.js?v=25.1-demo-2"><\/script>'
    );
})();
