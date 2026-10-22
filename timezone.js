/* =========================================================
   HORÁRIO OFICIAL DO SISTEMA
   Todos os horários exibidos ao usuário usam America/Sao_Paulo.
========================================================= */
(function (global) {
    const TIME_ZONE = "America/Sao_Paulo";

    function dataValida(valor) {
        const d = valor instanceof Date ? valor : new Date(valor);
        return !Number.isNaN(d.getTime()) ? d : null;
    }

    function formatarDataHoraSistema(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            dateStyle: "short",
            timeStyle: "short"
        }).format(d);
    }

    function formatarHoraSistema(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(d);
    }

    function formatarDataSistema(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            dateStyle: "short"
        }).format(d);
    }

    function formatarDataCurtaSistema(valor) {
        const d = dataValida(valor);
        if (!d) return "-";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: TIME_ZONE,
            day: "2-digit",
            month: "2-digit"
        }).format(d);
    }

    function hojeSistema() {
        const partes = new Intl.DateTimeFormat("en-CA", {
            timeZone: TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date());

        const get = tipo => partes.find(p => p.type === tipo)?.value || "";
        return `${get("year")}-${get("month")}-${get("day")}`;
    }

    function inicioDiaSistema(dataISO) {
        const data = String(dataISO || hojeSistema()).slice(0, 10);
        return new Date(`${data}T00:00:00-03:00`);
    }

    function fimDiaSistema(dataISO) {
        const data = String(dataISO || hojeSistema()).slice(0, 10);
        return new Date(`${data}T23:59:59.999-03:00`);
    }

    global.SISTEMA_TIME_ZONE = TIME_ZONE;
    global.formatarDataHoraSistema = formatarDataHoraSistema;
    global.formatarHoraSistema = formatarHoraSistema;
    global.formatarDataSistema = formatarDataSistema;
    global.formatarDataCurtaSistema = formatarDataCurtaSistema;
    global.hojeSistema = hojeSistema;
    global.inicioDiaSistema = inicioDiaSistema;
    global.fimDiaSistema = fimDiaSistema;
})(window);
