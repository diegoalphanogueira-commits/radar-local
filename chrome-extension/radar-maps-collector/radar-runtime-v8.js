(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const TARGET_KEY = "radarV1CoverageTargetV3";
  let activeSessionId = "";

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const GROUPS = [
    { id:"barbearia", test:/barbear|barber|corte masculino|barba e cabelo|salao masculino/ },
    { id:"odontologia", test:/odont|dentist|dental|ortodont|implantodont|endodont/ },
    { id:"estetica", test:/estet|beleza|harmoniza|depila|limpeza de pele|spa/ },
    { id:"manicure", test:/manicure|pedicure|unha|nail|esmalter/ },
    { id:"podologia", test:/podolog/ },
    { id:"pet-veterinaria", test:/pet|veterin|banho e tosa/ },
    { id:"padaria", test:/padaria|panific|confeitaria|bakery/ },
    { id:"seguros", test:/seguro|corretor/ },
    { id:"imobiliaria", test:/imobili|imoveis/ },
    { id:"contabilidade", test:/contab|contador/ },
    { id:"advocacia", test:/advoc|advog/ },
    { id:"academia", test:/academia|fitness|muscul/ },
    { id:"restaurante", test:/restaurante|pizzaria|lanchonete|hamburg/ }
  ];

  function canonical(term) {
    const n = normalize(term);
    return GROUPS.find(group => group.test.test(n))?.id || n;
  }

  function targetMode() {
    const value = String(document.querySelector("#radarCoverageTarget")?.value || localStorage.getItem(TARGET_KEY) || "50");
    return ["30", "50", "100", "max"].includes(value) ? value : "50";
  }

  function contextNow() {
    const term = String(document.querySelector("#mapsSearchTerm")?.value || "").trim();
    const region = String(document.querySelector("#mapsSearchCity")?.value || "").trim();
    const radiusKm = Number(document.querySelector("#v4Radius")?.value || 5) || 5;
    return { term, region, radiusKm, segment: canonical(term), targetMode: targetMode() };
  }

  function ensureCoverageControl() {
    if (document.querySelector("#radarCoverageControl")) return;
    const radius = document.querySelector("#v4Radius");
    if (!radius?.parentElement) return;
    const box = document.createElement("div");
    box.id = "radarCoverageControl";
    box.className = "radar-coverage-control";
    box.innerHTML = `<label for="radarCoverageTarget">Cobertura</label><select id="radarCoverageTarget"><option value="30">30+ empresas</option><option value="50">50+ empresas</option><option value="100">100+ empresas</option><option value="max">Máxima</option></select><small>Meta considera empresas dentro do raio.</small>`;
    radius.parentElement.insertAdjacentElement("afterend", box);
    const select = box.querySelector("select");
    select.value = localStorage.getItem(TARGET_KEY) || "50";
    if (!["30", "50", "100", "max"].includes(select.value)) select.value = "50";
    select.addEventListener("change", () => localStorage.setItem(TARGET_KEY, select.value));
  }

  const post = (type, payload = {}) => window.postMessage({ source: TARGET, type, ...payload }, location.origin);

  async function cancelCurrent() {
    if (!activeSessionId) return;
    const old = activeSessionId;
    activeSessionId = "";
    await chrome.runtime.sendMessage({ cmd: "CANCEL_MARKET_SEARCH", sessionId: old }).catch(() => {});
  }

  async function runBatch(message) {
    const ctx = contextNow();
    if (!ctx.term || !ctx.region) return { ok: false, error: "Informe segmento e região." };

    await cancelCurrent();
    const sessionId = `radar-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    activeSessionId = sessionId;

    const discovery = await chrome.runtime.sendMessage({
      cmd: "RUN_MARKET_SEARCH_V5",
      sessionId,
      term: ctx.term,
      segment: ctx.segment,
      region: ctx.region,
      radiusKm: ctx.radiusKm,
      queries: Array.isArray(message.queries) ? message.queries : [],
      targetMode: ctx.targetMode,
      seedLeads: []
    });

    if (activeSessionId !== sessionId) return { ok: false, cancelled: true, error: "CANCELLED" };
    if (!discovery?.ok) {
      activeSessionId = "";
      return discovery || { ok:false, error:"Falha na descoberta." };
    }

    const discovered = Array.isArray(discovery.leads) ? discovery.leads : [];
    const enrichment = await chrome.runtime.sendMessage({
      cmd: "ENRICH_ALL",
      sessionId,
      limit: Math.min(300, Math.max(1, discovered.length))
    });

    if (activeSessionId !== sessionId) return { ok:false, cancelled:true, error:"CANCELLED" };
    activeSessionId = "";

    const leads = enrichment?.ok && Array.isArray(enrichment.leads) ? enrichment.leads : discovered;
    return {
      ok: true,
      leads,
      context: discovery.context || null,
      geoStats: discovery.geoStats || null,
      searchesDone: discovery.searchesDone || 0,
      plannedSearches: discovery.plannedSearches || 0
    };
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.source !== SOURCE) return;

    if (message.type === "PING") {
      post("PONG", { version: chrome.runtime.getManifest().version });
      return;
    }

    if (message.type === "START_BATCH_SEARCH") {
      runBatch(message)
        .then(response => post("BATCH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("BATCH_RESULT", { requestId: message.requestId || "", response: { ok:false, error:error?.message || String(error) } }));
      return;
    }

    if (message.type === "GET_STATE") {
      chrome.runtime.sendMessage({ cmd:"GET_STATE" })
        .then(response => post("STATE_RESULT", { requestId:message.requestId || "", response }))
        .catch(error => post("STATE_RESULT", { requestId:message.requestId || "", response:{ ok:false, error:error.message } }));
      return;
    }

    if (message.type === "ENRICH") {
      const sessionId = activeSessionId || `manual-${Date.now()}`;
      chrome.runtime.sendMessage({ cmd:"ENRICH_ALL", sessionId, limit:Number(message.limit) || 300 })
        .then(response => post("ENRICH_RESULT", { requestId:message.requestId || "", response }))
        .catch(error => post("ENRICH_RESULT", { requestId:message.requestId || "", response:{ ok:false, error:error.message } }));
      return;
    }

    if (message.type === "SITE_ENRICH") {
      chrome.runtime.sendMessage({ cmd:"SITE_ENRICH_ONE", website:String(message.website || "").trim(), force:!!message.force })
        .then(response => post("SITE_ENRICH_RESULT", { requestId:message.requestId || "", response }))
        .catch(error => post("SITE_ENRICH_RESULT", { requestId:message.requestId || "", response:{ ok:false, error:error.message } }));
      return;
    }

    if (message.type === "CLEAR") {
      cancelCurrent()
        .then(() => chrome.runtime.sendMessage({ cmd:"CLEAR" }))
        .then(response => post("CLEAR_RESULT", { requestId:message.requestId || "", response }))
        .catch(error => post("CLEAR_RESULT", { requestId:message.requestId || "", response:{ ok:false, error:error.message } }));
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (!message?.event) return;
    if (activeSessionId && message.sessionId && message.sessionId !== activeSessionId) return;
    post("PROGRESS", { progress: message });
  });

  const observer = new MutationObserver(ensureCoverageControl);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureCoverageControl, { once:true });
  else ensureCoverageControl();
  setInterval(ensureCoverageControl, 1200);
})();
