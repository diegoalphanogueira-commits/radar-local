(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const ASSET_VERSION = "20260922-11";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV1";

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const QUERY_GROUPS = [
    { id: "barbearia", test: /barbear|barber|corte masculino|barba e cabelo|salao masculino/, terms: [
      "barbearia", "barbeiro", "barber shop", "barbearia masculina", "corte masculino",
      "barba e cabelo", "salão masculino", "barbearia premium", "cabelo masculino", "barbearia perto de mim"
    ]},
    { id: "odontologia", test: /odont|dentist|dental|ortodont|implantodont|endodont/, terms: [
      "dentista", "clínica odontológica", "odontologia", "consultório odontológico",
      "cirurgião-dentista", "ortodontista", "implantodontista", "implante dentário",
      "odontopediatra", "endodontista", "prótese dentária", "clareamento dental"
    ]},
    { id: "estetica", test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/, terms: [
      "clínica de estética", "centro de estética", "estética facial", "estética corporal",
      "estética avançada", "harmonização facial", "limpeza de pele", "depilação a laser",
      "esteticista", "spa estético", "clínica de beleza", "tratamento estético"
    ]},
    { id: "manicure", test: /manicure|pedicure|unha|nail|esmalter/, terms: [
      "manicure", "pedicure", "esmalteria", "nail designer", "salão de unhas",
      "alongamento de unhas", "unhas em gel", "manicure e pedicure", "studio de unhas"
    ]},
    { id: "podologia", test: /podolog/, terms: ["podologia", "clínica de podologia", "podólogo", "podóloga", "tratamento dos pés", "podologia clínica"] },
    { id: "pet-veterinaria", test: /pet|veterin|banho e tosa/, terms: [
      "pet shop", "petshop", "banho e tosa", "clínica veterinária", "veterinário",
      "hospital veterinário", "hotel para cães", "creche para cães", "loja de ração"
    ]},
    { id: "seguros", test: /seguro|corretor/, terms: ["corretora de seguros", "seguros", "corretor de seguros", "seguro auto", "seguro empresarial"] },
    { id: "imobiliaria", test: /imobili|imoveis/, terms: ["imobiliária", "corretora de imóveis", "corretor de imóveis", "imóveis", "imobiliária venda aluguel"] },
    { id: "contabilidade", test: /contab|contador/, terms: ["escritório de contabilidade", "contabilidade", "contador", "assessoria contábil"] },
    { id: "advocacia", test: /advoc|advog/, terms: ["escritório de advocacia", "advogado", "advocacia", "assessoria jurídica"] },
    { id: "academia", test: /academia|fitness|muscul/, terms: ["academia", "academia musculação", "centro de treinamento", "personal trainer", "fitness"] },
    { id: "restaurante", test: /restaurante|pizzaria|lanchonete|hamburg/, terms: ["restaurante", "pizzaria", "lanchonete", "hamburgueria", "comida delivery"] }
  ];

  function isProspectingPage() {
    return /\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname);
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  }

  function canonicalSegment(term) {
    const value = normalize(term);
    return QUERY_GROUPS.find(item => item.test.test(value))?.id || value;
  }

  function cleanMapsUrl(url) {
    return String(url || "").split("?")[0].replace(/\/$/, "");
  }

  function leadKey(lead) {
    return cleanMapsUrl(lead?.mapsUrl)
      || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || lead?.companyPhone || "")}`);
  }

  function dedupe(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(lead => {
      if (!lead?.name) return;
      const key = leadKey(lead);
      if (!key) return;
      const prev = map.get(key) || {};
      const merged = { ...prev };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      map.set(key, merged);
    });
    return [...map.values()];
  }

  function pageContext() {
    const meta = loadJson(META_KEY, {});
    const inputRegion = String(document.querySelector("#mapsSearchCity")?.value || "").trim();
    const inputTerm = String(document.querySelector("#mapsSearchTerm")?.value || "").trim();
    const radiusInput = Number(document.querySelector("#v4Radius")?.value || 0);
    const region = inputRegion || String(meta.region || "").trim();
    const term = inputTerm || String(meta.term || "").trim();
    const radiusKm = radiusInput || Number(meta.radiusKm || 5) || 5;
    const savedCenter = meta.v4Center && normalize(meta.v4Center.region || region) === normalize(region)
      && Number.isFinite(Number(meta.v4Center.lat)) && Number.isFinite(Number(meta.v4Center.lng))
      ? { lat: Number(meta.v4Center.lat), lng: Number(meta.v4Center.lng) }
      : null;
    return { region, term, segment: canonicalSegment(term), radiusKm, center: savedCenter };
  }

  function compatibleEntry(entry, context) {
    if (!entry || !context?.region || !context?.segment) return false;
    const segment = entry.segment || canonicalSegment(entry.term || "");
    return segment === context.segment
      && normalize(entry.region || "") === normalize(context.region)
      && Number(entry.radiusKm || 5) === Number(context.radiusKm || 5);
  }

  function bestSeed(context) {
    const rows = [];
    const memory = loadJson(MEMORY_KEY, {});
    Object.values(memory || {}).forEach(entry => {
      if (compatibleEntry(entry, context) && Array.isArray(entry.leads)) rows.push(...entry.leads);
    });

    const meta = loadJson(META_KEY, {});
    const current = loadJson(LEADS_KEY, []);
    const currentContext = {
      region: String(meta.region || "").trim(),
      segment: canonicalSegment(meta.term || ""),
      radiusKm: Number(meta.radiusKm || 5) || 5
    };
    if (Array.isArray(current)
      && currentContext.segment === context.segment
      && normalize(currentContext.region) === normalize(context.region)
      && Number(currentContext.radiusKm) === Number(context.radiusKm)) {
      rows.push(...current);
    }
    return dedupe(rows);
  }

  function expandQueries(inputQueries) {
    const context = pageContext();
    const group = QUERY_GROUPS.find(item => item.id === context.segment);
    const base = Array.isArray(inputQueries) ? inputQueries : [];
    if (!group || !context.region) return [...new Set(base.map(item => String(item || "").trim()).filter(Boolean))].slice(0, 12);
    const extras = group.terms.map(keyword => `${keyword} ${context.region}`.trim());
    return [...new Set([...base, ...extras].map(item => String(item || "").trim()).filter(Boolean))].slice(0, 12);
  }

  function sanitizeSavedCenter() {
    if (!isProspectingPage()) return;
    try {
      const meta = loadJson(META_KEY, {});
      const leads = loadJson(LEADS_KEY, []);
      const region = String(meta.region || "").trim();
      const center = meta.v4Center || null;
      const centerRegion = String(center?.region || "").trim();
      const coverage = Number(meta.centerCoverage ?? center?.coverage ?? NaN);
      const regionChanged = !!(region && centerRegion && normalize(region) !== normalize(centerRegion));
      const zeroCoverage = Array.isArray(leads) && leads.length > 0 && Number.isFinite(coverage) && coverage <= 0;
      if (regionChanged || zeroCoverage) {
        delete meta.v4Center;
        delete meta.centerCoverage;
        delete meta.centerRecoveredAt;
        localStorage.setItem(META_KEY, JSON.stringify(meta));
      }
    } catch {}
  }

  function injectPageScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    (document.head || document.documentElement).appendChild(script);
  }

  function injectStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    (document.head || document.documentElement).appendChild(link);
  }

  function injectWorkspaceAssets() {
    if (!isProspectingPage()) return;
    sanitizeSavedCenter();
    const origin = window.location.origin;
    injectStylesheet("radarProspectingWorkspaceCss", `${origin}/css/prospecting-workspace.css?v=${ASSET_VERSION}`);
    injectStylesheet("radarLiveProgressCss", `${origin}/css/radar-live-progress.css?v=${ASSET_VERSION}`);
    injectPageScript("radarProspectingWorkspaceScript", `${origin}/js/prospecting-workspace.js?v=${ASSET_VERSION}`);
    injectPageScript("radarSearchOrchestratorScript", `${origin}/js/radar-search-orchestrator-v2.js?v=${ASSET_VERSION}`);
    injectPageScript("radarCenterRecoveryScript", `${origin}/js/radar-center-recovery.js?v=${ASSET_VERSION}`);
  }

  function post(type, payload = {}) {
    window.postMessage({ source: TARGET, type, ...payload }, window.location.origin);
  }

  async function seedCollector(context) {
    const seed = bestSeed(context);
    await chrome.runtime.sendMessage({ cmd: "CLEAR" }).catch(() => null);
    if (seed.length) await chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: seed }).catch(() => null);
    return seed;
  }

  async function mergeResponseWithSeed(response, context) {
    if (!response?.ok || !Array.isArray(response.leads)) return response;
    const seed = bestSeed(context);
    const merged = dedupe([...seed, ...response.leads]);
    if (merged.length > response.leads.length) {
      await chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: merged }).catch(() => null);
    }
    return { ...response, leads: merged, restoredFromRadar: Math.max(0, merged.length - response.leads.length) };
  }

  injectWorkspaceAssets();

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== SOURCE) return;

    if (message.type === "PING") {
      post("PONG", { version: chrome.runtime.getManifest().version });
      return;
    }

    if (message.type === "START_SEARCH") {
      const context = pageContext();
      seedCollector(context).then(() => chrome.runtime.sendMessage({
        cmd: "RUN_SEARCH",
        query: String(message.query || "").trim(),
        maxScrolls: Math.max(90, Number(message.maxScrolls) || 90),
        replace: false,
        enrich: message.enrich !== false,
        enrichLimit: Number(message.enrichLimit) || 60,
        region: context.region,
        radiusKm: context.radiusKm,
        center: context.center
      })).then(response => mergeResponseWithSeed(response, context)).then(response => {
        post("SEARCH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => post("SEARCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "START_BATCH_SEARCH") {
      const context = pageContext();
      const queries = expandQueries(message.queries);
      seedCollector(context).then(seed => chrome.runtime.sendMessage({
        cmd: "RUN_BATCH_SEARCH",
        queries,
        maxScrolls: Math.max(95, Number(message.maxScrolls) || 95),
        replace: false,
        region: context.region,
        radiusKm: context.radiusKm,
        center: context.center,
        segment: context.segment,
        seededCount: seed.length
      })).then(response => mergeResponseWithSeed(response, context)).then(response => {
        post("BATCH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => post("BATCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "ENRICH") {
      const context = pageContext();
      chrome.runtime.sendMessage({ cmd: "ENRICH_ALL", limit: Number(message.limit) || 60 })
        .then(response => mergeResponseWithSeed(response, context))
        .then(response => post("ENRICH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "SITE_ENRICH") {
      chrome.runtime.sendMessage({ cmd: "SITE_ENRICH_ONE", website: String(message.website || "").trim(), force: !!message.force })
        .then(response => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "GET_STATE") {
      const context = pageContext();
      chrome.runtime.sendMessage({ cmd: "GET_STATE" })
        .then(response => mergeResponseWithSeed(response, context))
        .then(response => post("STATE_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("STATE_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "CLEAR") {
      chrome.runtime.sendMessage({ cmd: "CLEAR" })
        .then(response => post("CLEAR_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("CLEAR_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (!message || !message.event) return;
    if (["SEARCH_PROGRESS", "BATCH_PROGRESS", "ENRICH_PROGRESS"].includes(message.event)) {
      post("PROGRESS", { progress: message });
    }
  });

  post("READY", { version: chrome.runtime.getManifest().version });
})();
