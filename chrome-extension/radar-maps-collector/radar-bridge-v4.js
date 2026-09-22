(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV3";
  const TARGET_KEY = "radarV1CoverageTargetV3";
  const ASSET_VERSION = "20260922-13";

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

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  }

  function canonicalSegment(term) {
    const value = normalize(term);
    return QUERY_GROUPS.find(item => item.test.test(value))?.id || value;
  }

  function contextKey(context) {
    return `${context.segment}|${normalize(context.region)}|${Number(context.radiusKm || 5) || 5}`;
  }

  function pageContext() {
    const meta = loadJson(META_KEY, {});
    const term = String(document.querySelector("#mapsSearchTerm")?.value || meta.term || "").trim();
    const region = String(document.querySelector("#mapsSearchCity")?.value || meta.region || "").trim();
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
      const previous = map.get(key) || {};
      const merged = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      map.set(key, merged);
    });
    return [...map.values()];
  }

  function exactSeed(context) {
    const memory = loadJson(MEMORY_KEY, {});
    const entry = memory[contextKey(context)];
    const rows = Array.isArray(entry?.leads) ? [...entry.leads] : [];

    const stored = storedContext();
    if (stored.segment === context.segment
      && normalize(stored.region) === normalize(context.region)
      && Number(stored.radiusKm) === Number(context.radiusKm)) {
      rows.push(...loadJson(LEADS_KEY, []));
    }
    return dedupe(rows);
  }

  function saveMemory(context, leads, extra = {}) {
    const memory = loadJson(MEMORY_KEY, {});
    const key = contextKey(context);
    const previous = memory[key] || {};
    const merged = dedupe([...(previous.leads || []), ...(Array.isArray(leads) ? leads : [])]).slice(0, 700);
    memory[key] = {
      ...previous,
      term: context.term,
      segment: context.segment,
      region: context.region,
      radiusKm: context.radiusKm,
      updatedAt: Date.now(),
      bestCount: Math.max(Number(previous.bestCount || 0), merged.length),
      ...extra,
      leads: merged
    };
    const entries = Object.entries(memory)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, 40);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(entries)));
    return merged;
  }

  function expandQueries(inputQueries, context) {
    const group = QUERY_GROUPS.find(item => item.id === context.segment);
    const base = Array.isArray(inputQueries) ? inputQueries : [];
    const extras = group && context.region ? group.terms.map(term => `${term} ${context.region}`) : [];
    return [...new Set([...base, ...extras].map(v => String(v || "").trim()).filter(Boolean))].slice(0, 12);
  }

  function targetMode() {
    const select = document.querySelector("#radarCoverageTarget");
    const value = String(select?.value || localStorage.getItem(TARGET_KEY) || "max");
    return ["30","50","100","max"].includes(value) ? value : "max";
  }

  function persistSessionStart(context, seed) {
    const sessionId = `radar-v3-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const previous = loadJson(META_KEY, {});
    localStorage.setItem(META_KEY, JSON.stringify({
      ...previous,
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      count: seed.length,
      activeSearchSession: sessionId,
      activeSearchKey: contextKey(context),
      activeSearchSegment: context.segment,
      searchStartedAt: new Date().toISOString(),
      coverageTarget: targetMode(),
      v4Center: null,
      centerCoverage: null,
      centerRecoveredAt: null
    }));
    localStorage.setItem(LEADS_KEY, JSON.stringify(seed));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: seed.length, source: "market-v3-start" } }));
    return sessionId;
  }

  function sessionCurrent(sessionId, context) {
    const meta = loadJson(META_KEY, {});
    return String(meta.activeSearchSession || "") === String(sessionId || "")
      && String(meta.activeSearchKey || "") === contextKey(context);
  }

  function finalize(context, sessionId, seed, response) {
    if (!response?.ok) return response;
    if (!sessionCurrent(sessionId, context)) return { ok: false, error: "Esta pesquisa foi substituída por uma nova sessão." };

    const merged = saveMemory(context, dedupe([...seed, ...(response.leads || [])]), {
      center: response?.context?.center || null,
      targetLabel: response.targetLabel || "Máxima",
      searchesDone: response.searchesDone || 0,
      usefulCount: response.usefulCount || 0
    });
    const center = response?.context?.center || null;
    const meta = loadJson(META_KEY, {});
    localStorage.setItem(META_KEY, JSON.stringify({
      ...meta,
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      count: merged.length,
      activeSearchSession: sessionId,
      activeSearchKey: contextKey(context),
      activeSearchSegment: context.segment,
      searchCompletedAt: new Date().toISOString(),
      coverageTarget: targetMode(),
      coverageTargetLabel: response.targetLabel || "Máxima",
      coverageSearchesDone: response.searchesDone || 0,
      coverageUsefulCount: response.usefulCount || 0,
      v4Center: center ? { ...center, source: "market-v3", region: context.region } : null
    }));
    localStorage.setItem(LEADS_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: merged.length, source: "market-v3-complete" } }));
    return { ...response, leads: merged, context: { ...(response.context || {}), region: context.region, radiusKm: context.radiusKm, center } };
  }

  function ensureCoverageControl() {
    if (!/\/prospeccao(?:\.html)?\/?$/i.test(location.pathname)) return;
    if (document.querySelector("#radarCoverageControl")) return;
    const radius = document.querySelector("#v4Radius");
    if (!radius?.parentElement) return;

    const box = document.createElement("div");
    box.id = "radarCoverageControl";
    box.className = "radar-coverage-control";
    box.innerHTML = `
      <label for="radarCoverageTarget">Cobertura</label>
      <select id="radarCoverageTarget" aria-label="Meta de cobertura da busca">
        <option value="30">30+ empresas</option>
        <option value="50">50+ empresas</option>
        <option value="100">100+ empresas</option>
        <option value="max">Máxima</option>
      </select>
      <small>Quanto maior, mais o Radar insiste na descoberta.</small>
    `;
    radius.parentElement.insertAdjacentElement("afterend", box);
    const saved = localStorage.getItem(TARGET_KEY) || "max";
    const select = box.querySelector("select");
    select.value = ["30","50","100","max"].includes(saved) ? saved : "max";
    select.addEventListener("change", () => localStorage.setItem(TARGET_KEY, select.value));
  }

  function injectAssets() {
    if (!/\/prospeccao(?:\.html)?\/?$/i.test(location.pathname)) return;
    const origin = location.origin;
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
  }

  const post = (type, payload = {}) => window.postMessage({ source: TARGET, type, ...payload }, location.origin);

  async function runBatch(message) {
    const context = pageContext();
    const seed = exactSeed(context);
    const sessionId = persistSessionStart(context, seed);
    const response = await chrome.runtime.sendMessage({
      cmd: "RUN_MARKET_SEARCH_V3",
      term: context.term,
      segment: context.segment,
      region: context.region,
      radiusKm: context.radiusKm,
      queries: expandQueries(message.queries, context),
      targetMode: targetMode(),
      maxScrolls: 125,
      seedLeads: seed
    });
    return finalize(context, sessionId, seed, response);
  }

  injectAssets();
  const observer = new MutationObserver(() => ensureCoverageControl());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureCoverageControl, { once: true });
  else ensureCoverageControl();
  setInterval(ensureCoverageControl, 1500);

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.source !== SOURCE) return;

    if (message.type === "PING") {
      post("PONG", { version: chrome.runtime.getManifest().version });
      return;
    }

    if (message.type === "START_BATCH_SEARCH" || message.type === "START_SEARCH") {
      runBatch(message)
        .then(response => post(message.type === "START_BATCH_SEARCH" ? "BATCH_RESULT" : "SEARCH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post(message.type === "START_BATCH_SEARCH" ? "BATCH_RESULT" : "SEARCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "GET_STATE") {
      const page = pageContext();
      const stored = storedContext();
      const compatible = page.segment === stored.segment
        && normalize(page.region) === normalize(stored.region)
        && Number(page.radiusKm) === Number(stored.radiusKm);
      const leads = compatible ? dedupe(loadJson(LEADS_KEY, [])) : [];
      post("STATE_RESULT", { requestId: message.requestId || "", response: { ok: true, leads } });
      return;
    }

    if (message.type === "ENRICH") {
      const context = storedContext();
      const current = dedupe(loadJson(LEADS_KEY, []));
      chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: current })
        .then(() => chrome.runtime.sendMessage({ cmd: "ENRICH_ALL", limit: Number(message.limit) || 60 }))
        .then(response => {
          if (response?.ok && Array.isArray(response.leads)) {
            const merged = saveMemory(context, dedupe([...current, ...response.leads]));
            localStorage.setItem(LEADS_KEY, JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: merged.length, source: "market-v3-enrich" } }));
            response = { ...response, leads: merged };
          }
          post("ENRICH_RESULT", { requestId: message.requestId || "", response });
        })
        .catch(error => post("ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "SITE_ENRICH") {
      chrome.runtime.sendMessage({ cmd: "SITE_ENRICH_ONE", website: String(message.website || "").trim(), force: !!message.force })
        .then(response => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("SITE_ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
      return;
    }

    if (message.type === "CLEAR") {
      chrome.runtime.sendMessage({ cmd: "CLEAR" })
        .then(response => post("CLEAR_RESULT", { requestId: message.requestId || "", response }))
        .catch(error => post("CLEAR_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } }));
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (!message?.event) return;
    post("PROGRESS", { progress: message });
  });
})();
