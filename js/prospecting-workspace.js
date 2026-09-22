/* =========================================================
   RADAR LOCAL — WORKSPACE COMERCIAL V4
   Mapa visual + raio + busca completa + status persistentes
   + WhatsApp personalizado + roteiro de ligação + diagnóstico.
========================================================= */
(() => {
  "use strict";

  if (window.RadarProspectingWorkspaceV4) return;
  window.RadarProspectingWorkspaceV4 = true;

  const MAP_STORAGE_KEY = "radarMapsImportedLeadsV2";
  const MAP_META_KEY = "radarMapsImportedMetaV2";
  const BRIDGE_SOURCE = "RADAR_LOCAL_WEB";
  const BRIDGE_TARGET = "RADAR_MAPS_COLLECTOR";
  const WORKSPACE_VERSION = "4.0.0";

  const STATUS = {
    new: { label: "Não prospectado", short: "Novo", color: "#16a34a", order: 0 },
    attempted: { label: "Tentei / sem contato", short: "Tentativa", color: "#eab308", order: 1 },
    contacted: { label: "Contato realizado", short: "Falou", color: "#2563eb", order: 2 },
    opportunity: { label: "Deu certo / oportunidade", short: "Oportunidade", color: "#7c3aed", order: 3 },
    blocked: { label: "Não ligar novamente", short: "Bloqueado", color: "#dc2626", order: 4 }
  };

  const THIRD_PARTY_HOSTS = [
    "wa.me", "whatsapp.com", "instagram.com", "facebook.com", "linktr.ee",
    "linkr.bio", "trinks.com", "beacons.ai", "bio.site", "bit.ly", "cutt.ly"
  ];

  const KEYWORD_GROUPS = [
    {
      test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/,
      terms: [
        "clínica de estética", "centro de estética", "estética facial",
        "estética corporal", "estética avançada", "harmonização facial",
        "limpeza de pele", "depilação a laser", "esteticista", "spa estético"
      ]
    },
    { test: /podolog/, terms: ["podologia", "clínica de podologia", "podólogo", "podóloga", "tratamento dos pés", "podologia clínica"] },
    { test: /odont|dentist/, terms: ["clínica odontológica", "dentista", "odontologia", "implante dentário", "ortodontia", "clínica dental"] },
    { test: /barbear|barber/, terms: ["barbearia", "barber shop", "barbeiro", "corte masculino", "barbearia masculina"] },
    { test: /seguro|corretor/, terms: ["corretora de seguros", "seguros", "corretor de seguros", "seguro auto", "seguro empresarial"] },
    { test: /imobili|imoveis|imóveis/, terms: ["imobiliária", "corretora de imóveis", "corretor de imóveis", "imóveis", "imobiliária venda aluguel"] },
    { test: /contab/, terms: ["escritório de contabilidade", "contabilidade", "contador", "assessoria contábil"] },
    { test: /advoc|advog/, terms: ["escritório de advocacia", "advogado", "advocacia", "assessoria jurídica"] },
    { test: /academia|fitness|muscul/, terms: ["academia", "academia musculação", "centro de treinamento", "personal trainer", "fitness"] },
    { test: /veterin|pet/, terms: ["clínica veterinária", "veterinário", "hospital veterinário", "pet shop", "banho e tosa"] },
    { test: /restaurante|pizzaria|lanchonete|hamburg/, terms: ["restaurante", "pizzaria", "lanchonete", "hamburgueria", "comida delivery"] }
  ];

  const state = {
    leads: [],
    filtered: [],
    history: {},
    workspaceId: "internal",
    statusFilter: "all",
    searchText: "",
    noSiteOnly: false,
    lowReviewsOnly: false,
    radiusKm: 5,
    center: null,
    map: null,
    layer: null,
    circle: null,
    extensionConnected: false,
    extensionVersion: "",
    pending: new Map(),
    lastStorageSnapshot: "",
    busy: false,
    mapReady: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  }[char]));

  function decodeJwtPayload(token) {
    try {
      const payload = String(token || "").split(".")[1];
      if (!payload) return {};
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
      return JSON.parse(atob(padded));
    } catch { return {}; }
  }

  function getWorkspaceId() {
    const token = window.RadarAuth?.getToken?.() || "";
    const payload = decodeJwtPayload(token);
    return String(payload.sub || payload.userId || payload.user_id || payload.companyId || payload.company_id || payload.scope || "internal")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 80) || "internal";
  }

  function historyStorageKey() {
    return `radarProspectingHistoryV4:${state.workspaceId}`;
  }

  function loadHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(historyStorageKey()) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch { return {}; }
  }

  function saveHistory() {
    try { localStorage.setItem(historyStorageKey(), JSON.stringify(state.history)); }
    catch (error) { console.warn("[RadarV4] histórico não pôde ser salvo", error); }
  }

  function loadMapLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(MAP_META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveMeta(patch) {
    try { localStorage.setItem(MAP_META_KEY, JSON.stringify({ ...loadMeta(), ...patch })); }
    catch {}
  }

  function saveMapLeads(leads) {
    try { localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(leads)); }
    catch (error) { console.warn("[RadarV4] mapa não pôde ser salvo", error); }
  }

  function cleanMapsUrl(url) {
    const raw = String(url || "");
    if (!raw) return "";
    return raw.split("?")[0].replace(/\/$/, "");
  }

  function identityKeys(lead) {
    const keys = [];
    const cnpj = String(lead?.cnpj || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const maps = cleanMapsUrl(lead?.mapsUrl);
    const phone = digits(lead?.phone || lead?.companyPhone);
    const nameAddress = normalize(`${lead?.name || ""}|${lead?.address || ""}`);
    if (cnpj) keys.push(`cnpj:${cnpj}`);
    if (maps) keys.push(`maps:${maps}`);
    if (phone.length >= 10) keys.push(`phone:${phone.slice(-11)}`);
    if (nameAddress.replace(/\|/g, "").length >= 8) keys.push(`name:${nameAddress}`);
    return [...new Set(keys)];
  }

  function historyFor(lead) {
    const keys = identityKeys(lead);
    for (const key of keys) {
      if (state.history[key]) return state.history[key];
    }
    return { id: `h-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, status: "new", attempts: 0, updatedAt: "" };
  }

  function setLeadHistory(lead, patch) {
    const previous = historyFor(lead);
    const next = {
      ...previous,
      ...patch,
      id: previous.id || `h-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      updatedAt: new Date().toISOString()
    };
    identityKeys(lead).forEach(key => { state.history[key] = next; });
    saveHistory();
    render();
    return next;
  }

  function uniqueHistoryRecords() {
    const map = new Map();
    Object.values(state.history).forEach(record => {
      if (!record?.id) return;
      if (!map.has(record.id)) map.set(record.id, record);
    });
    return [...map.values()];
  }

  function normalizePhone(value) {
    let phone = digits(value);
    if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
    return phone;
  }

  function formatPhone(value) {
    const phone = normalizePhone(value);
    if (phone.length === 11) return `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`;
    if (phone.length === 10) return `(${phone.slice(0,2)}) ${phone.slice(2,6)}-${phone.slice(6)}`;
    return value || "Não informado";
  }

  function siteHost(url) {
    try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return ""; }
  }

  function opportunityFor(lead) {
    const signals = [];
    let score = 15;
    const host = siteHost(lead.website || "");
    const hasSite = !!host;
    const thirdParty = hasSite && THIRD_PARTY_HOSTS.some(item => host === item || host.endsWith(`.${item}`));
    const reviews = Number(lead.reviews);
    const rating = Number(lead.rating);

    if (!hasSite) { score += 34; signals.push({ type: "no-site", label: "Sem site próprio", strong: true }); }
    else if (thirdParty) { score += 24; signals.push({ type: "third-party", label: "Link de terceiros", strong: true }); }
    else signals.push({ type: "site", label: "Site encontrado", positive: true });

    if (Number.isFinite(reviews)) {
      if (reviews < 20) { score += 24; signals.push({ type: "few-reviews", label: `${reviews} avaliações`, strong: true }); }
      else if (reviews < 50) { score += 17; signals.push({ type: "few-reviews", label: `${reviews} avaliações` }); }
      else if (reviews < 100) { score += 9; signals.push({ type: "reviews", label: `${reviews} avaliações` }); }
      else signals.push({ type: "reviews", label: `${reviews.toLocaleString("pt-BR")} avaliações`, positive: true });
    }

    if (Number.isFinite(rating) && rating > 0) {
      if (rating < 4.3) { score += 18; signals.push({ type: "rating", label: `Nota ${String(rating).replace(".", ",")}`, strong: true }); }
      else if (rating >= 4.8) signals.push({ type: "rating", label: `Nota ${String(rating).replace(".", ",")}`, positive: true });
    }

    if (normalizePhone(lead.phone)) score += 5;
    if (lead.decisionMaker?.name) score += 8;
    return { score: Math.max(0, Math.min(100, score)), signals, thirdParty, hasSite };
  }

  function mainOpportunityText(lead) {
    const opportunity = opportunityFor(lead);
    const strong = opportunity.signals.find(signal => signal.strong);
    if (strong?.type === "no-site") return "não encontrei um site próprio da empresa";
    if (strong?.type === "third-party") return "o link principal de vocês leva para uma plataforma de terceiros, não para um site próprio";
    if (strong?.type === "few-reviews") return `vocês ainda têm ${Number(lead.reviews || 0).toLocaleString("pt-BR")} avaliações no Google`;
    if (strong?.type === "rating") return `a presença no Google está com nota ${String(lead.rating || "").replace(".", ",")}`;
    return "encontrei alguns pontos na presença digital que podem ser melhor aproveitados";
  }

  function positiveText(lead) {
    const rating = Number(lead.rating);
    if (Number.isFinite(rating) && rating >= 4.7) return `vocês têm uma avaliação muito boa no Google (${String(rating).replace(".", ",")})`;
    if (Number.isFinite(Number(lead.reviews)) && Number(lead.reviews) >= 50) return `vocês já têm uma presença relevante no Google, com ${Number(lead.reviews).toLocaleString("pt-BR")} avaliações`;
    return "encontrei a empresa bem posicionada na busca local";
  }

  function regionLabel(lead) {
    const meta = loadMeta();
    return meta.region || meta.city || lead.neighborhood || lead.city || "sua região";
  }

  function whatsappMessage(lead) {
    const term = loadMeta().term || lead.category || "empresas do segmento";
    return `Oi, tudo bem? Estava fazendo um levantamento de ${term.toLowerCase()} aqui em ${regionLabel(lead)} e encontrei a ${lead.name}. Vi que ${positiveText(lead)}, mas ${mainOpportunityText(lead)}. Eu montei uma análise rápida da presença digital de vocês e encontrei alguns pontos que podem ajudar a gerar mais oportunidades. Posso te enviar?`;
  }

  function callScript(lead) {
    const issue = mainOpportunityText(lead);
    return `ABERTURA\n\nOi, tudo bem? Eu queria falar com a pessoa responsável pela ${lead.name}.\n\nMeu nome é Diego. Estou fazendo um levantamento dos negócios de ${lead.category || loadMeta().term || "seu segmento"} aqui em ${regionLabel(lead)} e encontrei vocês.\n\nGANCHO\n\nEu vi que ${positiveText(lead)}, mas também notei que ${issue}.\n\nEu montei uma análise rápida da presença digital da ${lead.name} e encontrei alguns pontos que podem ajudar vocês a aparecer melhor e gerar mais oportunidades.\n\nCONVITE\n\nNão quero te tomar tempo pelo telefone. Posso te mostrar essa análise em uma conversa rápida de 10 minutos?`;
  }

  function keywordVariants(term) {
    const raw = String(term || "").trim();
    const normalized = normalize(raw);
    const group = KEYWORD_GROUPS.find(item => item.test.test(normalized));
    const terms = group ? [...group.terms] : [raw, `${raw} perto de mim`, `${raw} clínica`, `${raw} especialista`, `${raw} serviços`];
    if (raw && !terms.some(item => normalize(item) === normalized)) terms.unshift(raw);
    return [...new Set(terms.map(item => item.trim()).filter(Boolean))].slice(0, 10);
  }

  function parseLatLng(lead) {
    const lat = Number(lead?.lat);
    const lng = Number(lead?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function haversineKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function median(values) {
    const clean = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!clean.length) return null;
    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle-1] + clean[middle]) / 2;
  }

  function fallbackCenter(leads) {
    const points = leads.map(parseLatLng).filter(Boolean);
    if (!points.length) return null;
    return { lat: median(points.map(point => point.lat)), lng: median(points.map(point => point.lng)), source: "median" };
  }

  async function geocodeRegion(region) {
    const meta = loadMeta();
    if (meta.v4Center?.lat && meta.v4Center?.lng && normalize(meta.v4Center.region) === normalize(region)) return meta.v4Center;
    try {
      const params = new URLSearchParams({ q: region, format: "json", limit: "1", countrycodes: "br" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const rows = await response.json();
      const first = rows?.[0];
      if (!first) return null;
      const center = { lat: Number(first.lat), lng: Number(first.lon), source: "geocode", region };
      if (Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
        saveMeta({ v4Center: center });
        return center;
      }
    } catch (error) { console.warn("[RadarV4] geocode", error); }
    return null;
  }

  function dedupe(leads) {
    const map = new Map();
    leads.forEach(lead => {
      if (!lead?.name) return;
      const key = cleanMapsUrl(lead.mapsUrl) || normalize(`${lead.name}|${lead.address}|${digits(lead.phone)}`);
      if (!key) return;
      const previous = map.get(key) || {};
      const next = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) next[field] = value;
      });
      map.set(key, next);
    });
    return [...map.values()];
  }

  function filteredLeads() {
    const text = normalize(state.searchText);
    return state.leads
      .map(lead => {
        const point = parseLatLng(lead);
        const distanceKm = state.center && point ? haversineKm(state.center, point) : null;
        return { ...lead, _distanceKm: distanceKm };
      })
      .filter(lead => {
        const history = historyFor(lead);
        const opp = opportunityFor(lead);
        if (state.statusFilter !== "all" && history.status !== state.statusFilter) return false;
        if (state.noSiteOnly && opp.hasSite && !opp.thirdParty) return false;
        if (state.lowReviewsOnly && !(Number.isFinite(Number(lead.reviews)) && Number(lead.reviews) < 50)) return false;
        if (state.center && Number.isFinite(lead._distanceKm) && lead._distanceKm > state.radiusKm) return false;
        if (text && !normalize([lead.name, lead.category, lead.address, lead.phone, lead.website, lead.decisionMaker?.name].join(" ")).includes(text)) return false;
        return true;
      })
      .sort((a,b) => {
        const statusDiff = STATUS[historyFor(a).status]?.order - STATUS[historyFor(b).status]?.order;
        if (statusDiff) return statusDiff;
        return opportunityFor(b).score - opportunityFor(a).score;
      });
  }

  function countStatuses(leads = state.leads) {
    const counts = Object.fromEntries(Object.keys(STATUS).map(key => [key, 0]));
    leads.forEach(lead => { counts[historyFor(lead).status] = (counts[historyFor(lead).status] || 0) + 1; });
    return counts;
  }

  function toast(message) {
    const base = $("#toast");
    if (base) {
      base.textContent = message;
      base.classList.add("visible");
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => base.classList.remove("visible"), 2400);
      return;
    }
    console.log("[RadarV4]", message);
  }

  function randomId() { return `v4-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function bridgeRequest(type, payload, expectedType, timeoutMs = 600000) {
    const requestId = randomId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(requestId);
        reject(new Error("O coletor demorou demais para responder."));
      }, timeoutMs);
      state.pending.set(requestId, { expectedType, resolve, reject, timer });
      window.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload }, window.location.origin);
    });
  }

  function handleBridgeMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== BRIDGE_TARGET) return;
    if (message.type === "READY" || message.type === "PONG") {
      state.extensionConnected = true;
      state.extensionVersion = message.version || "";
      updateSearchControls();
      return;
    }
    if (message.type === "PROGRESS") {
      const progress = message.progress || {};
      if (progress.event === "BATCH_PROGRESS") {
        setBatchStatus(`Busca ${progress.current || 0} de ${progress.total || 0}`, progress.query || progress.text || "Mapeando a região...");
      } else if (progress.event === "ENRICH_PROGRESS") {
        setBatchStatus(`Completando ${progress.current || 0}/${progress.total || 0}`, "Buscando telefone, site e horário nas fichas.");
      }
      return;
    }
    const pending = state.pending.get(message.requestId);
    if (!pending || pending.expectedType !== message.type) return;
    clearTimeout(pending.timer);
    state.pending.delete(message.requestId);
    pending.resolve(message.response || {});
  }

  function pingExtension() {
    window.postMessage({ source: BRIDGE_SOURCE, type: "PING" }, window.location.origin);
    setTimeout(updateSearchControls, 1200);
  }

  function buildShell() {
    if ($("#prospectingWorkspaceV4")) return;
    document.body.classList.add("radar-prospecting-v4");

    const discovery = $(".maps-discovery");
    if (!discovery) return;

    const existingButton = $("#mapsOpenGoogleButton");
    if (existingButton) existingButton.innerHTML = `Busca rápida <span>↗</span>`;

    const controls = document.createElement("div");
    controls.id = "v4SearchControls";
    controls.className = "v4-search-controls";
    controls.innerHTML = `
      <div class="v4-radius-field"><label for="v4Radius">Raio real da região</label><select id="v4Radius"><option value="2">2 km</option><option value="3">3 km</option><option value="5" selected>5 km</option><option value="8">8 km</option><option value="10">10 km</option></select></div>
      <button type="button" id="v4BatchSearch" class="v4-primary-search">Mapear região completa <span>→</span></button>
      <button type="button" id="v4Enrich" class="v4-secondary-search">Completar dados (até 50)</button>
      <div id="v4BatchStatus" class="v4-batch-status"><b>Busca completa</b><span>Varia palavras-chave, remove duplicados e respeita o raio.</span></div>`;
    const collectorStatus = $("#mapsCollectorStatus");
    (collectorStatus || $(".maps-search-row"))?.insertAdjacentElement("afterend", controls);

    const workspace = document.createElement("section");
    workspace.id = "prospectingWorkspaceV4";
    workspace.className = "v4-workspace hidden";
    workspace.innerHTML = `
      <div class="v4-header panel">
        <div><span class="section-kicker">CENTRAL DE PROSPECÇÃO</span><h2>Mapa comercial da região</h2><p id="v4Context">As empresas válidas do raio aparecem aqui.</p></div>
        <div class="v4-history-badge"><span>Histórico do acesso</span><strong id="v4HistoryTotal">0</strong><small>empresas já classificadas</small></div>
      </div>

      <div class="v4-kpis" id="v4Kpis"></div>

      <div class="v4-toolbar panel">
        <div class="v4-filter-search"><input id="v4Search" type="search" placeholder="Buscar empresa, endereço, telefone ou decisor..."></div>
        <div class="v4-status-tabs" id="v4StatusTabs"></div>
        <label class="v4-check"><input id="v4NoSite" type="checkbox"> Sem site próprio</label>
        <label class="v4-check"><input id="v4LowReviews" type="checkbox"> Menos de 50 avaliações</label>
      </div>

      <div class="v4-main-grid">
        <div class="v4-map-panel panel">
          <div class="v4-map-head"><div><strong id="v4MapTitle">Região mapeada</strong><span id="v4MapSubtitle">—</span></div><div class="v4-map-legend"><span><i class="s-new"></i>Novo</span><span><i class="s-attempted"></i>Tentativa</span><span><i class="s-contacted"></i>Falou</span><span><i class="s-opportunity"></i>Oportunidade</span><span><i class="s-blocked"></i>Não ligar</span></div></div>
          <div id="v4OpportunityMap"></div>
        </div>
        <div class="v4-list-panel panel">
          <div class="v4-list-head"><div><strong>Empresas prioritárias</strong><span id="v4ListCount">0 empresas</span></div><span class="v4-sort-label">prioridade automática</span></div>
          <div id="v4LeadList" class="v4-lead-list"></div>
        </div>
      </div>`;

    const oldWorkspace = $("#mapsWorkspace");
    (oldWorkspace || discovery).insertAdjacentElement("afterend", workspace);

    const revenue = $(".revenue-search-panel");
    if (revenue && !revenue.closest(".v4-revenue-details")) {
      const details = document.createElement("details");
      details.className = "v4-revenue-details";
      details.innerHTML = `<summary><span>Dados empresariais avançados</span><b>Receita / CNPJ / QSA</b><em>abrir</em></summary>`;
      revenue.parentNode.insertBefore(details, revenue);
      details.appendChild(revenue);
    }

    wireWorkspaceEvents();
  }

  function updateSearchControls() {
    const button = $("#v4BatchSearch");
    const enrich = $("#v4Enrich");
    if (button) {
      button.disabled = state.busy || !state.extensionConnected;
      button.title = state.extensionConnected ? "Executa várias buscas relacionadas e unifica os resultados" : "Instale/atualize o Radar Maps Collector";
    }
    if (enrich) enrich.disabled = state.busy || !state.extensionConnected || !state.leads.length;
  }

  function setBatchStatus(title, text) {
    const box = $("#v4BatchStatus");
    if (!box) return;
    $("b", box).textContent = title;
    $("span", box).textContent = text;
  }

  function setBusy(value) {
    state.busy = value;
    updateSearchControls();
    const button = $("#v4BatchSearch");
    if (button) button.classList.toggle("is-busy", value);
  }

  async function runBatchSearch() {
    if (state.busy) return;
    const term = $("#mapsSearchTerm")?.value.trim();
    const region = $("#mapsSearchCity")?.value.trim();
    if (!term || !region) return toast("Informe o segmento e a região.");
    if (!state.extensionConnected) return toast("O Radar Maps Collector precisa estar instalado e atualizado.");

    state.radiusKm = Number($("#v4Radius")?.value) || 5;
    const terms = keywordVariants(term);
    const queries = terms.map(keyword => `${keyword} ${region}`.trim());
    setBusy(true);
    setBatchStatus("Preparando busca completa...", `${queries.length} termos serão pesquisados e unificados.`);

    try {
      const centerPromise = geocodeRegion(region);
      const response = await bridgeRequest("START_BATCH_SEARCH", { queries, maxScrolls: 32, replace: true }, "BATCH_RESULT", 900000);
      if (!response?.ok) throw new Error(response?.error || "Não foi possível concluir a busca completa.");
      state.leads = dedupe(Array.isArray(response.leads) ? response.leads : []);
      state.center = await centerPromise || fallbackCenter(state.leads);
      saveMapLeads(state.leads);
      saveMeta({ source: "radar-batch-v4", term, region, searchTerms: terms, radiusKm: state.radiusKm, count: state.leads.length, importedAt: new Date().toISOString(), v4Center: state.center ? { ...state.center, region } : null });
      setBatchStatus("Busca concluída", `${state.leads.length} negócios únicos encontrados. O raio agora elimina resultados distantes.`);
      render();
    } catch (error) {
      console.error("[RadarV4] batch", error);
      setBatchStatus("Busca interrompida", error.message || "Tente novamente.");
      toast(error.message || "Não foi possível concluir a busca.");
    } finally { setBusy(false); }
  }

  async function enrichLeads() {
    if (state.busy || !state.extensionConnected || !state.leads.length) return;
    setBusy(true);
    setBatchStatus("Completando fichas...", "Abrindo até 50 empresas em segundo plano para telefone, site e horário.");
    try {
      const response = await bridgeRequest("ENRICH", { limit: 50 }, "ENRICH_RESULT", 900000);
      if (!response?.ok) throw new Error(response?.error || "Falha ao completar as fichas.");
      state.leads = dedupe(response.leads || state.leads);
      saveMapLeads(state.leads);
      setBatchStatus("Dados complementados", "Telefone, site e horário foram atualizados onde o Google exibiu essas informações.");
      render();
    } catch (error) {
      console.error("[RadarV4] enrich", error);
      setBatchStatus("Enriquecimento interrompido", error.message || "Tente novamente.");
    } finally { setBusy(false); }
  }

  function buildStatusTabs() {
    const tabs = $("#v4StatusTabs");
    if (!tabs) return;
    const counts = countStatuses();
    tabs.innerHTML = `<button type="button" data-status="all" class="${state.statusFilter === "all" ? "active" : ""}">Todos <b>${state.leads.length}</b></button>` +
      Object.entries(STATUS).map(([key, config]) => `<button type="button" data-status="${key}" class="${state.statusFilter === key ? "active" : ""}"><i style="--status:${config.color}"></i>${config.short} <b>${counts[key] || 0}</b></button>`).join("");
    $$('[data-status]', tabs).forEach(button => button.addEventListener("click", () => {
      state.statusFilter = button.dataset.status || "all";
      render();
    }));
  }

  function renderKpis() {
    const box = $("#v4Kpis");
    if (!box) return;
    const counts = countStatuses(state.filtered);
    const noSite = state.filtered.filter(lead => { const opp = opportunityFor(lead); return !opp.hasSite || opp.thirdParty; }).length;
    box.innerHTML = `
      <article><span>No raio</span><strong>${state.filtered.length.toLocaleString("pt-BR")}</strong><small>empresas visíveis</small></article>
      <article><span>Não prospectadas</span><strong>${(counts.new || 0).toLocaleString("pt-BR")}</strong><small>prontas para abordar</small></article>
      <article><span>Tentativas</span><strong>${(counts.attempted || 0).toLocaleString("pt-BR")}</strong><small>sem contato</small></article>
      <article><span>Contatos</span><strong>${(counts.contacted || 0).toLocaleString("pt-BR")}</strong><small>falou com alguém</small></article>
      <article><span>Oportunidades</span><strong>${(counts.opportunity || 0).toLocaleString("pt-BR")}</strong><small>deu certo</small></article>
      <article><span>Sem site próprio</span><strong>${noSite.toLocaleString("pt-BR")}</strong><small>oportunidade digital</small></article>`;
    const historyTotal = $("#v4HistoryTotal");
    if (historyTotal) historyTotal.textContent = uniqueHistoryRecords().filter(record => record.status && record.status !== "new").length.toLocaleString("pt-BR");
  }

  function ensureMap() {
    if (state.map || !window.L || !$("#v4OpportunityMap")) return;
    state.map = L.map("v4OpportunityMap", { zoomControl: true, preferCanvas: true }).setView([-23.45, -46.53], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(state.map);
    state.layer = L.featureGroup().addTo(state.map);
    state.mapReady = true;
  }

  function markerIcon(index, statusKey, score) {
    const status = STATUS[statusKey] || STATUS.new;
    return L.divIcon({
      className: "v4-marker-shell",
      html: `<div class="v4-marker" style="--marker:${status.color}"><b>${index + 1}</b><span>${score}</span></div>`,
      iconSize: [38, 44], iconAnchor: [19, 42], popupAnchor: [0, -38]
    });
  }

  function renderMap() {
    ensureMap();
    if (!state.map || !state.layer) return;
    state.layer.clearLayers();
    if (state.circle) { state.map.removeLayer(state.circle); state.circle = null; }

    const bounds = [];
    if (state.center) {
      state.circle = L.circle([state.center.lat, state.center.lng], { radius: state.radiusKm * 1000, color: "#2878f0", weight: 2, opacity: .65, fillColor: "#2878f0", fillOpacity: .06, dashArray: "7 8" }).addTo(state.map);
      bounds.push([state.center.lat, state.center.lng]);
    }

    state.filtered.forEach((lead, index) => {
      const point = parseLatLng(lead);
      if (!point) return;
      const history = historyFor(lead);
      const opp = opportunityFor(lead);
      const marker = L.marker([point.lat, point.lng], { icon: markerIcon(index, history.status, opp.score) });
      marker.bindPopup(`<div class="v4-popup"><b>${escapeHtml(lead.name)}</b><span>${escapeHtml(lead.category || "Negócio local")}</span><strong>${lead.rating ? `★ ${escapeHtml(String(lead.rating).replace(".", ","))}` : "Sem nota"}${Number.isFinite(Number(lead.reviews)) ? ` · ${Number(lead.reviews).toLocaleString("pt-BR")} avaliações` : ""}</strong><small>${escapeHtml(lead.address || "Endereço não informado")}</small><em>${escapeHtml(STATUS[history.status]?.label || "Não prospectado")}</em></div>`);
      marker.on("click", () => document.querySelector(`.v4-lead-card[data-card-index="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      marker.addTo(state.layer);
      bounds.push([point.lat, point.lng]);
    });

    if (bounds.length === 1) state.map.setView(bounds[0], 15);
    else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [36,36], maxZoom: 15 });
    setTimeout(() => state.map?.invalidateSize(), 80);
  }

  function statusSelect(lead) {
    const current = historyFor(lead).status || "new";
    return `<div class="v4-status-control"><i style="--status:${STATUS[current]?.color || STATUS.new.color}"></i><select data-status-select>${Object.entries(STATUS).map(([key, config]) => `<option value="${key}" ${key === current ? "selected" : ""}>${escapeHtml(config.label)}</option>`).join("")}</select></div>`;
  }

  function actionDisabled(lead) {
    return historyFor(lead).status === "blocked";
  }

  function renderLeadCard(lead, index) {
    const opp = opportunityFor(lead);
    const history = historyFor(lead);
    const phone = normalizePhone(lead.phone || lead.companyPhone);
    const host = siteHost(lead.website || "");
    const rating = Number.isFinite(Number(lead.rating)) ? String(lead.rating).replace(".", ",") : "—";
    const reviews = Number.isFinite(Number(lead.reviews)) ? Number(lead.reviews).toLocaleString("pt-BR") : "—";
    const signals = opp.signals.slice(0, 3).map(signal => `<span class="${signal.strong ? "strong" : signal.positive ? "positive" : ""}">${escapeHtml(signal.label)}</span>`).join("");
    const distance = Number.isFinite(lead._distanceKm) ? `${lead._distanceKm.toFixed(1).replace(".", ",")} km` : "distância n/d";
    const blocked = actionDisabled(lead);

    const article = document.createElement("article");
    article.className = `v4-lead-card status-${history.status}`;
    article.dataset.cardIndex = String(index);
    article.innerHTML = `
      <div class="v4-card-number">${index + 1}</div>
      <div class="v4-card-head">
        <div><span class="v4-card-kicker">${escapeHtml(lead.category || "NEGÓCIO LOCAL")}</span><h3>${escapeHtml(lead.name)}</h3><p>${escapeHtml(lead.address || "Endereço não informado")}</p></div>
        <div class="v4-google-score"><strong>★ ${escapeHtml(rating)}</strong><span>${escapeHtml(reviews)} avaliações</span></div>
      </div>
      <div class="v4-status-row">${statusSelect(lead)}<span class="v4-distance">${escapeHtml(distance)}</span><span class="v4-opportunity-score">Oportunidade ${opp.score}/100</span></div>
      <div class="v4-signal-row">${signals || "<span>Dados básicos coletados</span>"}</div>
      <div class="v4-data-grid">
        <div><span>Telefone</span><strong>${escapeHtml(phone ? formatPhone(phone) : "Não informado")}</strong></div>
        <div class="${!host || opp.thirdParty ? "attention" : ""}"><span>Site</span><strong>${escapeHtml(host || "Sem site")}</strong></div>
        <div><span>Decisor</span><strong>${escapeHtml(lead.decisionMaker?.name || "Ainda não identificado")}</strong></div>
        <div><span>Último contato</span><strong>${history.lastContactAt ? new Date(history.lastContactAt).toLocaleDateString("pt-BR") : "Nunca"}</strong></div>
      </div>
      <div class="v4-card-actions">
        <button type="button" data-whatsapp class="primary" ${!phone || blocked ? "disabled" : ""}>WhatsApp</button>
        <button type="button" data-call ${blocked ? "disabled" : ""}>Ligar / script</button>
        <button type="button" data-diagnose>Diagnóstico</button>
        ${lead.mapsUrl ? `<a href="${escapeHtml(lead.mapsUrl)}" target="_blank" rel="noopener">Google</a>` : ""}
        ${lead.website ? `<a href="${escapeHtml(/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`)}" target="_blank" rel="noopener">Site</a>` : ""}
      </div>
      ${blocked ? `<div class="v4-blocked-note">Não contatar novamente. As ações de contato ficam bloqueadas para evitar abordagem duplicada.</div>` : ""}`;

    const select = $("[data-status-select]", article);
    select?.addEventListener("change", () => {
      const nextStatus = select.value;
      const previousStatus = historyFor(lead).status;
      setLeadHistory(lead, {
        status: nextStatus,
        attempts: (nextStatus === "attempted" && previousStatus !== "attempted") ? Number(historyFor(lead).attempts || 0) + 1 : Number(historyFor(lead).attempts || 0),
        lastContactAt: nextStatus === "new" ? historyFor(lead).lastContactAt || "" : new Date().toISOString()
      });
      toast(`Status: ${STATUS[nextStatus].label}`);
    });

    $("[data-whatsapp]", article)?.addEventListener("click", () => openWhatsApp(lead));
    $("[data-call]", article)?.addEventListener("click", () => openCallModal(lead));
    $("[data-diagnose]", article)?.addEventListener("click", () => openDiagnosis(lead));
    return article;
  }

  function renderList() {
    const list = $("#v4LeadList");
    if (!list) return;
    list.replaceChildren();
    if (!state.filtered.length) {
      const empty = document.createElement("div");
      empty.className = "v4-empty";
      empty.innerHTML = `<strong>Nenhuma empresa neste filtro.</strong><span>Altere o status, os filtros ou aumente o raio da região.</span>`;
      list.appendChild(empty);
    } else state.filtered.forEach((lead,index) => list.appendChild(renderLeadCard(lead,index)));
    const count = $("#v4ListCount");
    if (count) count.textContent = `${state.filtered.length.toLocaleString("pt-BR")} empresa${state.filtered.length === 1 ? "" : "s"}`;
  }

  function renderContext() {
    const meta = loadMeta();
    const context = $("#v4Context");
    if (context) context.textContent = meta.region ? `${meta.term || "Negócios"} · ${meta.region} · raio de ${state.radiusKm} km` : `${state.filtered.length} empresas válidas no mapa atual.`;
    const title = $("#v4MapTitle");
    const subtitle = $("#v4MapSubtitle");
    if (title) title.textContent = meta.region || "Região mapeada";
    if (subtitle) subtitle.textContent = state.center ? `Raio de ${state.radiusKm} km · resultados distantes são ocultados` : "Centro calculado pelos resultados disponíveis";
  }

  function render() {
    if (!$("#prospectingWorkspaceV4")) return;
    state.filtered = filteredLeads();
    $("#prospectingWorkspaceV4")?.classList.toggle("hidden", !state.leads.length);
    buildStatusTabs();
    renderKpis();
    renderContext();
    renderList();
    renderMap();
    updateSearchControls();
  }

  function openWhatsApp(lead) {
    const phone = normalizePhone(lead.phone || lead.companyPhone);
    if (!phone) return toast("Essa empresa não possui telefone coletado.");
    if (historyFor(lead).status === "blocked") return toast("Empresa marcada como não ligar novamente.");
    const message = whatsappMessage(lead);
    const current = historyFor(lead);
    setLeadHistory(lead, {
      status: current.status === "new" ? "attempted" : current.status,
      attempts: Number(current.attempts || 0) + 1,
      lastContactAt: new Date().toISOString(),
      lastChannel: "whatsapp"
    });
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function ensureModal() {
    let modal = $("#v4ActionModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "v4ActionModal";
    modal.className = "v4-modal hidden";
    modal.innerHTML = `<div class="v4-modal-backdrop" data-close></div><div class="v4-modal-card"><button type="button" class="v4-modal-close" data-close>×</button><span class="section-kicker">ROTEIRO DE PROSPECÇÃO</span><h3 id="v4ModalTitle">Ligação</h3><p id="v4ModalMeta"></p><pre id="v4ModalScript"></pre><div class="v4-modal-actions"><button type="button" id="v4CopyScript">Copiar roteiro</button><a id="v4DialLink" href="#">Ligar agora</a><button type="button" id="v4MarkAttempt">Tentei / sem contato</button><button type="button" id="v4MarkContact">Consegui falar</button><button type="button" id="v4MarkOpportunity" class="success">Deu certo</button><button type="button" id="v4MarkBlocked" class="danger">Não ligar novamente</button></div></div>`;
    document.body.appendChild(modal);
    $$('[data-close]', modal).forEach(el => el.addEventListener("click", () => modal.classList.add("hidden")));
    return modal;
  }

  function openCallModal(lead) {
    if (historyFor(lead).status === "blocked") return toast("Empresa marcada como não ligar novamente.");
    const modal = ensureModal();
    const phone = normalizePhone(lead.phone || lead.companyPhone);
    $("#v4ModalTitle", modal).textContent = lead.name;
    $("#v4ModalMeta", modal).textContent = `${formatPhone(phone)} · ${lead.category || "Negócio local"} · ${regionLabel(lead)}`;
    $("#v4ModalScript", modal).textContent = callScript(lead);
    const dial = $("#v4DialLink", modal);
    dial.href = phone ? `tel:+55${phone}` : "#";
    dial.classList.toggle("disabled", !phone);
    $("#v4CopyScript", modal).onclick = async () => {
      try { await navigator.clipboard.writeText(callScript(lead)); toast("Roteiro copiado."); }
      catch { window.prompt("Copie o roteiro:", callScript(lead)); }
    };
    $("#v4MarkAttempt", modal).onclick = () => { const current = historyFor(lead); setLeadHistory(lead, { status: "attempted", attempts: Number(current.attempts || 0) + 1, lastContactAt: new Date().toISOString(), lastChannel: "call" }); modal.classList.add("hidden"); };
    $("#v4MarkContact", modal).onclick = () => { setLeadHistory(lead, { status: "contacted", lastContactAt: new Date().toISOString(), lastChannel: "call" }); modal.classList.add("hidden"); };
    $("#v4MarkOpportunity", modal).onclick = () => { setLeadHistory(lead, { status: "opportunity", lastContactAt: new Date().toISOString(), lastChannel: "call" }); modal.classList.add("hidden"); };
    $("#v4MarkBlocked", modal).onclick = () => { setLeadHistory(lead, { status: "blocked", lastContactAt: new Date().toISOString(), lastChannel: "call" }); modal.classList.add("hidden"); };
    modal.classList.remove("hidden");
  }

  function openDiagnosis(lead) {
    const meta = loadMeta();
    const params = new URLSearchParams({
      origem: "posicionamento-local",
      empresa: lead.name || "",
      regiao: meta.region || lead.city || "",
      segmento: "outro",
      segmento_nome: lead.category || meta.term || "Negócio local",
      endereco: lead.address || "",
      telefone: normalizePhone(lead.phone || lead.companyPhone)
    });
    localStorage.setItem("radarProspectingSource", JSON.stringify({ cnpj: lead.cnpj || "", qsa: lead.qsa || [], source: "workspace-v4", mapsUrl: lead.mapsUrl || "", status: historyFor(lead).status }));
    window.location.href = `./?${params.toString()}`;
  }

  function wireWorkspaceEvents() {
    $("#v4BatchSearch")?.addEventListener("click", runBatchSearch);
    $("#v4Enrich")?.addEventListener("click", enrichLeads);
    $("#v4Radius")?.addEventListener("change", event => {
      state.radiusKm = Number(event.target.value) || 5;
      saveMeta({ radiusKm: state.radiusKm });
      render();
    });
    $("#v4Search")?.addEventListener("input", event => { state.searchText = event.target.value; render(); });
    $("#v4NoSite")?.addEventListener("change", event => { state.noSiteOnly = event.target.checked; render(); });
    $("#v4LowReviews")?.addEventListener("change", event => { state.lowReviewsOnly = event.target.checked; render(); });
  }

  async function hydrateCenter() {
    const meta = loadMeta();
    state.radiusKm = Number(meta.radiusKm) || 5;
    const radius = $("#v4Radius");
    if (radius) radius.value = String(state.radiusKm);
    const region = meta.region || $("#mapsSearchCity")?.value.trim() || "";
    if (meta.v4Center?.lat && meta.v4Center?.lng) state.center = { lat: Number(meta.v4Center.lat), lng: Number(meta.v4Center.lng), source: meta.v4Center.source || "saved" };
    else if (region) state.center = await geocodeRegion(region) || fallbackCenter(state.leads);
    else state.center = fallbackCenter(state.leads);
    render();
  }

  function syncFromStorage() {
    const raw = localStorage.getItem(MAP_STORAGE_KEY) || "[]";
    if (raw === state.lastStorageSnapshot) return;
    state.lastStorageSnapshot = raw;
    state.leads = dedupe(loadMapLeads());
    if (!state.center) state.center = fallbackCenter(state.leads);
    render();
  }

  function collapseLegacy() {
    const autoDetail = $("#mapsAutoDetail");
    if (autoDetail) autoDetail.checked = false;
  }

  async function boot() {
    state.workspaceId = getWorkspaceId();
    state.history = loadHistory();
    state.leads = dedupe(loadMapLeads());
    state.lastStorageSnapshot = localStorage.getItem(MAP_STORAGE_KEY) || "[]";
    buildShell();
    collapseLegacy();
    window.addEventListener("message", handleBridgeMessage);
    pingExtension();
    await hydrateCenter();
    setInterval(() => { syncFromStorage(); collapseLegacy(); }, 1400);
    const message = sessionStorage.getItem("radarV4Toast");
    if (message) { sessionStorage.removeItem("radarV4Toast"); setTimeout(() => toast(message), 500); }
    console.info(`[Radar Local] Workspace Comercial V${WORKSPACE_VERSION} ativo.`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
