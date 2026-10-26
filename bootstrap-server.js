/* CONTROLE DE AVARIAS V25.1 — MODO DEMO / VITRINE */

(() => {
    const hostname = String(window.location.hostname || "");

    const githubPages =
        /\.github\.io$/i.test(hostname) ||
        /\.pages\.dev$/i.test(hostname);

    // GitHub Pages: usar somente a API local do navegador.
    if (githubPages) {
        const script = document.createElement("script");
        script.src = "demo-api-v25.js?v=25.1-demo";
        script.async = false;

        const atual = document.currentScript;

        if (atual?.parentNode) {
            atual.parentNode.insertBefore(script, atual.nextSibling);
        } else {
            document.head.appendChild(script);
        }

        return;
    }

    // Ambiente local: não interfere no funcionamento do servidor.
})();
