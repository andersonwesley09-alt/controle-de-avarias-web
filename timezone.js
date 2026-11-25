/* =========================================================
   HORÁRIO OFICIAL DO SISTEMA - EmpresaExemplo
   Todos os horários exibidos ao usuário usam America/Sao_Paulo.
========================================================= */
(function (global) {
    const TIME_ZONE = "America/Sao_Paulo";

    function dataValida(valor) {
        const d = valor instanceof Date ? valor : new Date(valor);
        return !Number.isNaN(d.getTime()) ? d : null;
    }

    function formatarDataHoraEmpresaExemplo(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            dateStyle: "short",
            timeStyle: "short"
        }).format(d);
    }

    function formatarHoraEmpresaExemplo(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(d);
    }

    function formatarDataEmpresaExemplo(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            dateStyle: "short"
        }).format(d);
    }

    function formatarDataCurtaEmpresaExemplo(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            day: "2-digit",
            month: "2-digit"
        }).format(d);
    }

    function hojeEmpresaExemplo() {
        const partes = new Intl.DateTimeFormat("en-CA", {
            timeZone: TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const get = tipo => partes.find(p => p.type === tipo)?.value || "";
        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function inicioDiaEmpresaExemplo(dataISO) {
        const data = String(dataISO || hojeEmpresaExemplo()).slice(0, 10);
        return new Date(`${data}T00:00:00-03:00`);
    }

    function fimDiaEmpresaExemplo(dataISO) {
        const data = String(dataISO || hojeEmpresaExemplo()).slice(0, 10);
        return new Date(`${data}T23:59:59.999-03:00`);
    }

    global.EmpresaExemplo_TIME_ZONE = TIME_ZONE;
    global.formatarDataHoraEmpresaExemplo = formatarDataHoraEmpresaExemplo;
    global.formatarHoraEmpresaExemplo = formatarHoraEmpresaExemplo;
    global.formatarDataEmpresaExemplo = formatarDataEmpresaExemplo;
    global.formatarDataCurtaEmpresaExemplo = formatarDataCurtaEmpresaExemplo;
    global.hojeEmpresaExemplo = hojeEmpresaExemplo;
    global.inicioDiaEmpresaExemplo = inicioDiaEmpresaExemplo;
    global.fimDiaEmpresaExemplo = fimDiaEmpresaExemplo;
})(window);
