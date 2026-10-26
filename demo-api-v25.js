/*
 * CONTROLE DE AVARIAS V25.1.14 - PONTE CENTRAL
 * Este arquivo NÃƒO possui banco local, seed de dados ou API paralela.
 * Toda operaÃ§Ã£o usa o servidor central/PostgreSQL.
 */
(() => {
    const DEFAULT_SERVER = "http://10.10.70.163:3000";

    function normalizarBaseServidor(valor) {
        try {
            const bruto = String(valor || "").trim();
            if (!bruto) return "";
            const u = new URL(bruto);
            if (!/^https?:$/.test(u.protocol)) return "";
            return `${u.protocol}//${u.host}`;
        } catch (_) {
            return "";
        }
    }

    let servidor = "";
    try {
        servidor = normalizarBaseServidor(new URLSearchParams(location.search).get("servidor"));
    } catch (_) {}

    if (!servidor) {
        try { servidor = normalizarBaseServidor(sessionStorage.getItem("controleAvariasServidor")); } catch (_) {}
    }

    if (!servidor) {
        try { servidor = normalizarBaseServidor(window.CA_CONFIGURED_SERVER); } catch (_) {}
    }

    const servidoPorHttp = location.protocol === "http:" || location.protocol === "https:";
    const base = servidoPorHttp ? location.origin : (servidor || DEFAULT_SERVER);

    try { sessionStorage.setItem("controleAvariasServidor", base); } catch (_) {}

    window.CA_LOCAL_MODE = false;
    window.CA_API_BASE = base.replace(/\/$/, "");
    window.CA_LOCAL_ADAPTER_FILE = "central-only-v25.1.14";

    const originalFetch = window.fetch.bind(window);
    const originalEventSource = window.EventSource;

    window.fetch = function(input, options = {}) {
        let url = typeof input === "string" ? input : (input?.url || "");
        const ehRelativaApi = url.startsWith("/api/") || url.startsWith("api/");
        if (ehRelativaApi) {
            url = `${window.CA_API_BASE}/${url.replace(/^\/+/, "")}`;
        }

        const init = { ...options };
        const headers = new Headers(input && typeof input !== "string" && input.headers ? input.headers : undefined);
        if (options.headers) new Headers(options.headers).forEach((v, k) => headers.set(k, v));

        let ehApi = false;
        try { ehApi = new URL(url, location.href).pathname.startsWith("/api/"); } catch (_) {}
        if (ehApi) {
            try {
                const sessao = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
                if (sessao?.token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${sessao.token}`);
            } catch (_) {}
            init.credentials = "include";
            init.cache = init.cache || "no-store";
        }
        init.headers = headers;
        return originalFetch(url, init);
    };

    if (originalEventSource) {
        window.EventSource = class CentralEventSource extends originalEventSource {
            constructor(url, options = {}) {
                let finalUrl = String(url || "");
                if (finalUrl.startsWith("/api/") || finalUrl.startsWith("api/")) {
                    finalUrl = `${window.CA_API_BASE}/${finalUrl.replace(/^\/+/, "")}`;
                }
                try {
                    const parsed = new URL(finalUrl, location.href);
                    if (parsed.pathname === "/api/eventos") {
                        const sessao = JSON.parse(sessionStorage.getItem("usuarioLogado") || "null");
                        if (sessao?.token && !parsed.searchParams.has("token")) parsed.searchParams.set("token", sessao.token);
                        finalUrl = parsed.href;
                    }
                } catch (_) {}
                super(finalUrl, { ...options, withCredentials: true });
            }
        };
    }
})();

