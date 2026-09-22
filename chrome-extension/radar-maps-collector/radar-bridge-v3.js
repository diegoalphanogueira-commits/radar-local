(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const ASSET_VERSION = "20260922-12";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV2";

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const QUERY_GROUPS = [
    { id: "barbearia", test: /barbear|barber|corte masculino|barba e cabelo|salao masculino/, terms: ["barbearia","barbeiro","barber shop","barbearia masculina","corte masculino","barba e cabelo","salão masculino","barbearia premium","cabelo masculino"] },
    { id: "odontologia", test: /odont|dentist|dental|ortodont|implantodont|endodont/, terms: ["dentista","clínica odontológica","odontologia","consultório odontológico","cirurgião-dentista","ortodontista","implantodontista","implante dentário","odontopediatra","endodontista","prótese dentária","clareamento dental"] },
    { id: "estetica", test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/, terms: ["clínica de estética","centro de estética","estética facial","estética corporal","estética avançada","harmonização facial","limpeza de pele","depilação a laser","esteticista","spa estético","clínica de beleza"] },
    { id: "manicure", test: /manicure|pedicure|unha|nail|esmalter/, terms: ["manicure","pedicure","esmalteria","nail designer","salão de unhas","alongamento de unhas","unhas em gel","manicure e pedicure","studio de unhas"] },
    { id: "podologia", test: /podolog/, terms: ["podologia","clínica de podologia","podólogo","podóloga","tratamento dos pés","podologia clínica"] },
    { id: "pet-veterinaria", test: /pet|veterin|banho e tosa/, terms: ["pet shop","petshop","banho e tosa","clínica veterinária","veterinário","hospital veterinário","hotel para cães","creche para cães","loja de ração"] },
    { id: "padaria", test: /padaria|panific|confeitaria|bakery/, terms: ["padaria","panificadora","confeitaria","padaria artesanal","bakery","café e padaria","pães artesanais","padaria e confeitaria"] },
    { id: "seguros", test: /seguro|corretor/, terms: ["corretora de seguros","seguros","corretor de seguros","seguro auto","seguro empresarial"] },
    { id: "imobiliaria", test: /imobili|imoveis/, terms: ["imobiliária","corretora de imóveis","corretor de imóveis","imóveis","imobiliária venda aluguel"] },
    { id: "contabilidade", test: /contab|contador/, terms: ["escritório de contabilidade","contabilidade","contador","assessoria contábil"] },
    { id: "advocacia", test: /advoc|advog/, terms: ["escritório de advocacia","advogado","advocacia","assessoria jurídica"] },
    { id: "academia", test: /academia|fitness|muscul/, terms: ["academia","academia musculação","centro de treinamento","personal trainer","fitness"] },
    { id: "restaurante", test: /restaurante|pizzaria|lanchonete|hamburg/, terms: ["restaurante","pizzaria","lanchonete","hamburgueria","comida delivery"] }
  ];

  const loadJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  };

  function canonicalSegment(term) {
    const value = normalize(term);
    return QUERY_GROUPS.find(item => item.test.test(value))?.id || value;
  }

  function contextKey(context) {
    return `${context.segment}|${normalize(context.region)}|${Number(context.radiusKm || 5) || 5}`;
  }

  function cleanMapsUrl(url) {
    return String(url || "").split("?")[0].replace(/\/$/, "");
  }

  function leadKey(lead) {
    return cleanMapsUrl(lead?.mapsUrl) || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || lead?.companyPhone || "")}`);
  }

  function dedupe(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(lead => {
      if (!lead?.name) return;
      const key = leadKey(lead);
      if (!key) return;
      const previous = map.get(key) || {};
      const merged = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      map.set(key, merged);
    });
    return [...map.values()];
  }

  function pageContext() {
    const meta = loadJson(META_KEY, {});
    const region = String(document.querySelector("#mapsSearchCity")?.value || meta.region || "").trim();
    const term = String(document.querySelector("#mapsSearchTerm")?.value || meta.term || "").trim();
    const radiusKm = Number(document.querySelector("#v4Radius")?.value || meta.radiusKm || 5) || 5;
    return { term, region, segment: canonicalSegment(term), radiusKm };
  }

  function storedContext() {
    const meta = loadJson(META_KEY, {});
    const term = String(meta.term || "").trim();
    const region = String(meta.region || "").trim();
    const radiusKm = Number(meta.radiusKm || 5) || 5;
    return { term, region, segment: canonicalSegment(term), radiusKm, sessionId: String(meta.activeSearchSession || "") };
  }

  function compatibleEntry(entry, context) {
    if (!entry || !context?.region || !context?.segment) return false;
    return (entry.segment || canonicalSegment(entry.term || "")) === context.segment
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
    const currentContext = storedContext();
    if (Array.isArray(current) && currentContext.segment === context.segment
      && normalize(currentContext.region) === normalize(context.region)
      && Number(currentContext.radiusKm) === Number(context.radiusKm)) rows.push(...current);
    return dedupe(rows);
  }

  function expandQueries(inputQueries, context) {
    const group = QUERY_GROUPS.find(item => item.id === context.segment);
    const base = Array.isArray(inputQueries) ? inputQueries : [];
    const extras = group && context.region ? group.terms.map(term => `${term} ${context.region}`) : [];
    return [...new Set([...base, ...extras].map(item => String(item || "").trim()).filter(Boolean))].slice(0, 12);
  }

  function finitePoint(point) {
    const lat = Number(point?.lat ?? point?.latitude);
    const lng = Number(point?.lng ?? point?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function persistSessionStart(context, seed) {
    const sessionId = `radar-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const previous = loadJson(META_KEY, {});
    const next = {
      ...previous,
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      count: seed.length,
      activeSearchSession: sessionId,
      activeSearchKey: contextKey(context),
      activeSearchSegment: context.segment,
      searchStartedAt: new Date().toISOString(),
      v4Center: null,
      centerCoverage: null,
      centerRecoveredAt: null
    };
    localStorage.setItem(META_KEY, JSON.stringify(next));
    localStorage.setItem(LEADS_KEY, JSON.stringify(seed));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: seed.length, source: "search-session-start" } }));
    return sessionId;
  }

  function sessionIsCurrent(sessionId, context) {
    const meta = loadJson(META_KEY, {});
    return String(meta.activeSearchSession || "") === String(sessionId || "")
      && String(meta.activeSearchKey || "") === contextKey(context);
  }

  async function seedCollector(context, seed) {
    await chrome.runtime.sendMessage({ cmd: "CLEAR" }).catch(() => null);
    if (seed.length) await chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: seed }).catch(() => null);
  }

  async function finalizeResponse(response, context, sessionId, seed) {
    if (!response?.ok) return response;
    if (!sessionIsCurrent(sessionId, context)) return { ok: false, error: "Esta pesquisa foi substituída por uma nova sessão." };

    const merged = dedupe([...seed, ...(Array.isArray(response.leads) ? response.leads : [])]);
    const center = finitePoint(response?.context?.center);
    const meta = loadJson(META_KEY, {});
    const nextMeta = {
      ...meta,
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      count: merged.length,
      activeSearchSession: sessionId,
      activeSearchKey: contextKey(context),
      activeSearchSegment: context.segment,
      searchCompletedAt: new Date().toISOString(),
      v4Center: center ? { ...center, source: "collector-context", region: context.region } : null
    };
    localStorage.setItem(META_KEY, JSON.stringify(nextMeta));
    localStorage.setItem(LEADS_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: merged.length, source: "search-session-complete" } }));
    await chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: merged }).catch(() => null);
    return {
      ...response,
      leads: merged,
      context: { ...(response.context || {}), region: context.region, radiusKm: context.radiusKm, center },
      searchSessionId: sessionId,
      restoredFromRadar: Math.max(0, merged.length - (Array.isArray(response.leads) ? response.leads.length : 0))
    };
  }

  function injectAssets() {
    if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
    const origin = window.location.origin;
    const addCss = (id, href) => {
      if (document.getElementById(id)) return;
      const el = document.createElement("link"); el.id = id; el.rel = "stylesheet"; el.href = href; (document.head || document.documentElement).appendChild(el);
    };
    const addJs = (id, src) => {
      if (document.getElementById(id)) return;
      const el = document.createElement("script"); el.id = id; el.src = src; el.defer = true; (document.head || document.documentElement).appendChild(el);
    };
    addCss("radarProspectingWorkspaceCss", `${origin}/css/prospecting-workspace.css?v=${ASSET_VERSION}`);
    addCss("radarLiveProgressCss", `${origin}/css/radar-live-progress.css?v=${ASSET_VERSION}`);
    addJs("radarProspectingWorkspaceScript", `${origin}/js/prospecting-workspace.js?v=${ASSET_VERSION}`);
    addJs("radarSearchOrchestratorScript", `${origin}/js/radar-search-orchestrator-v2.js?v=${ASSET_VERSION}`);
    addJs("radarCenterRecoveryScript", `${origin}/js/radar-center-recovery.js?v=${ASSET_VERSION}`);
  }

  const post = (type, payload = {}) => window.postMessage({ source: TARGET, type, ...payload }, window.location.origin);

  async function startBatch(message) {
    const context = pageContext();
    const seed = bestSeed(context);
    const sessionId = persistSessionStart(context, seed);
    await seedCollector(context, seed);
    const response = await chrome.runtime.sendMessage({
      cmd: "RUN_BATCH_SEARCH",
      queries: expandQueries(message.queries, context),
      maxScrolls: Math.max(95, Number(message.maxScrolls) || 95),
      replace: false,
      region: context.region,
      radiusKm: context.radiusKm,
      center: null,
      segment: context.segment,
      seededCount: seed.length
    });
    return finalizeResponse(response, context, sessionId, seed);
  }

  async function startSingle(message) {
    const context = pageContext();
    const seed = bestSeed(context);
    const sessionId = persistSessionStart(context, seed);
    await seedCollector(context, seed);
    const response = await chrome.runtime.sendMessage({
      cmd: "RUN_SEARCH",
      query: String(message.query || "").trim(),
      maxScrolls: Math.max(90, Number(message.maxScrolls) || 90),
      replace: false,
      enrich: message.enrich !== false,
      enrichLimit: Number(message.enrichLimit) || 60,
      region: context.region,
      radiusKm: context.radiusKm,
      center: null
    });
    return finalizeResponse(response, context, sessionId, seed);
  }

  injectAssets();

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== SOURCE) return;

    if (message.type === "PING") return post("PONG", { version: chrome.runtime.getManifest().version });

    if (message.type === "START_BATCH_SEARCH") {
      startBatch(message).then(response => post("BATCH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("BATCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "START_SEARCH") {
      startSingle(message).then(response => post("SEARCH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("SEARCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "ENRICH") {
      const context = storedContext();
      chrome.runtime.sendMessage({ cmd: "ENRICH_ALL", limit: Number(message.limit) || 60 }).then(async response => {
        if (response?.ok && Array.isArray(response.leads)) {
          const current = dedupe(loadJson(LEADS_KEY, []));
          const merged = dedupe([...current, ...response.leads]);
          localStorage.setItem(LEADS_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: merged.length, source: "enrich-session" } }));
          response = { ...response, leads: merged, context: { region: context.region, radiusKm: context.radiusKm } };
        }
        post("ENRICH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => post("ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "SITE_ENRICH") {
      chrome.runtime.sendMessage({ cmd: "SITE_ENRICH_ONE", website: String(message.website || "").trim(), force: !!message.force })
        .then(response => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "GET_STATE") {
      const meta = loadJson(META_KEY, {});
      const leads = dedupe(loadJson(LEADS_KEY, []));
      return post("STATE_RESULT", { requestId: message.requestId || "", response: { ok: true, leads, context: { region: meta.region || "", radiusKm: Number(meta.radiusKm || 5), center: finitePoint(meta.v4Center) } } });
    }

    if (message.type === "CLEAR") {
      chrome.runtime.sendMessage({ cmd: "CLEAR" }).then(response => post("CLEAR_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("CLEAR_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.event && ["SEARCH_PROGRESS","BATCH_PROGRESS","ENRICH_PROGRESS"].includes(message.event)) post("PROGRESS", { progress: message });
  });

  post("READY", { version: chrome.runtime.getManifest().version });
})();
