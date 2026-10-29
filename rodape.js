(() => {
    const VERSAO_SISTEMA = "V25.1.28";

    function montarRodape() {
        let rodape = document.querySelector("footer.rodape-sistema");
        if (!rodape) {
            rodape = document.createElement("footer");
            rodape.className = "rodape-sistema";
            document.body.appendChild(rodape);
        }

        rodape.innerHTML = `
            <div class="rodape-conteudo">
                <span>Controle de Avarias</span>
                <span>Versão <strong>${VERSAO_SISTEMA}</strong></span>
                <span>© 2026 Todos os direitos reservados</span>
                <span>Criador do sistema: <strong>Wesley</strong></span>
            </div>
        `;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", montarRodape, { once: true });
    } else {
        montarRodape();
    }
})();
