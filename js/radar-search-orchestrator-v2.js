/* =========================================================
   RADAR LOCAL — SEARCH ORCHESTRATOR V2
   Busca completa + geocodificação da região + progresso ao vivo
   + sincronização incremental com a extensão.
========================================================= */
(() => {
  "use strict";

  if (window.RadarSearchOrchestratorV2) return;
  window.RadarSearchOrchestratorV2 = true;

  const STORAGE_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const BRIDGE_SOURCE = "RADAR_LOCAL_WEB";
  const BRIDGE_TARGET = "RADAR_MAPS_COLLECTOR";
  const pending = new Map();
  let running = false;
  let syncTimer = null;

  const $ = selector => document.querySelector(selector);
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const KEYWORD_GROUPS = [
    {
      test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/,
      terms: ["clínica de estética","centro de estética","estética facial","estética corporal","estética avançada","harmonização facial","limpeza de pele","depilação a laser","esteticista","spa estético"]
    },
    {
      test: /pet|veterin|banho e tosa|hotel.*cae|creche.*cae/,
      terms: ["pet shop","petshop","banho e tosa","clínica veterinária","veterinário","hospital veterinário","hotel para cães","creche para cães"]
    },
    { test: /podolog/, terms: ["podologia","clínica de podologia","podólogo","podóloga","tratamento dos pés","podologia clínica"] },
    { test: /odont|dentist/, terms: ["clínica odontológica","dentista","odontologia","implante dentário","ortodontia","clínica dental"] },
    { test: /barbear|barber/, terms: ["barbearia","barber shop","barbeiro","corte masculino","barbearia masculina"] },
    { test: /seguro|corretor/, terms: ["corretora de seguros","seguros","corretor de seguros","seguro auto","seguro empresarial"] },
    { test: /imobili|imoveis|imóveis/, terms: ["imobiliária","corretora de imóveis","corretor de imóveis","imóveis","imobiliária venda aluguel"] },
    { test: /contab/, terms: ["escritório de contabilidade","contabilidade","contador","assessoria contábil"] },
    { test: /advoc|advog/, terms: ["escritório de advocacia","advogado","advocacia","assessoria jurídica"] },
    { test: /academia|fitness|muscul/, terms: ["academia","academia musculação","centro de treinamento","personal trainer","fitness"] },
    { test: /restaurante|pizzaria|lanchonete|hamburg/, terms: ["restaurante","pizzaria","lanchonete","hamburgueria","comida delivery"] }
  ];

  function keywordVariants(term) {
    const raw = String(term || "").trim();
    const group = KEYWORD_GROUPS.find(item => item.test.test(normalize(raw)));
    const values = group ? [...group.terms] : [raw, `${raw} perto`, `${raw} serviços`, `${raw} loja`, `${raw} especialista`];
    if (raw && !values.some(item => normalize(item) === normalize(raw))) values.unshift(raw);
    return [...new Set(values.map(item => item.trim()).filter(Boolean))].slice(0, 10);
  }

  function cleanMapsUrl(url) {
    return String(url || "").split("?")[0].replace(/\/$/, "");
  }

  function leadKey(lead) {
    return cleanMapsUrl(lead?.mapsUrl) || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || "")}`);
  }

  function dedupe(leads) {
    const map = new Map();
    (Array.isArray(leads) ? leads : []).forEach(lead => {
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

  function loadLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveResults(leads, metaPatch = {}) {
    const clean = dedupe(leads);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...metaPatch }));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: clean.length } }));
    return clean;
  }

  function mergeOne(lead) {
    if (!lead?.name) return loadLeads();
    return saveResults([...loadLeads(), lead]);
  }

  function request(type, payload, expectedType, timeoutMs = 900000) {
    const requestId = `radar-v2-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("O coletor demorou demais para responder."));
      }, timeoutMs);
      pending.set(requestId, { expectedType, resolve, reject, timer });
      window.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload }, window.location.origin);
    });
  }

  function scoreGeocode(row, region) {
    const queryTokens = normalize(region).split(" ").filter(token => token.length >= 3 && !["jardim","jd","vila","bairro","sp","sao","são"].includes(token));
    const haystack = normalize(row?.display_name || "");
    return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
  }

  async function geocodeRegion(region) {
    const query = String(region || "").trim();
    if (!query) return null;
    const expanded = /brasil/i.test(query) ? query : `${query}, São Paulo, Brasil`;
    try {
      const params = new URLSearchParams({ q: expanded, format: "jsonv2", limit: "5", countrycodes: "br", addressdetails: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const rows = await response.json();
      const ranked = (Array.isArray(rows) ? rows : [])
        .map(row => ({ row, score: scoreGeocode(row, query) }))
        .sort((a,b) => b.score - a.score);
      const best = ranked[0]?.row;
      const lat = Number(best?.lat), lng = Number(best?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, source: "region-geocode", region: query, displayName: best.display_name || query };
    } catch (error) {
      console.warn("[RadarSearchOrchestratorV2] geocode", error);
      return null;
    }
  }

  function ensurePanel() {
    let panel = $("#radarLiveProgress");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "radarLiveProgress";
    panel.className = "rlp-panel hidden";
    panel.innerHTML = `
      <div class="rlp-head">
        <div class="rlp-head-copy"><span class="rlp-kicker">COLETA EM TEMPO REAL</span><h3 id="rlpTitle">Preparando mapeamento...</h3><p id="rlpText">O Radar vai atualizar os dados conforme cada ficha for concluída.</p></div>
        <span class="rlp-badge" id="rlpBadge">AUTOMÁTICO</span>
      </div>
      <div class="rlp-progress-wrap"><div class="rlp-progress-track"><div class="rlp-progress-bar" id="rlpBar"></div></div></div>
      <div class="rlp-stats">
        <div class="rlp-stat"><span>Negócios</span><strong id="rlpBusinesses">0</strong></div>
        <div class="rlp-stat"><span>Fichas completas</span><strong id="rlpProcessed">0</strong></div>
        <div class="rlp-stat"><span>Com telefone</span><strong id="rlpPhones">0</strong></div>
        <div class="rlp-stat"><span>Com site</span><strong id="rlpSites">0</strong></div>
        <div class="rlp-stat"><span>Restantes</span><strong id="rlpRemaining">—</strong></div>
      </div>
      <div class="rlp-current"><i class="rlp-pulse"></i><span id="rlpCurrent">Aguardando início da coleta.</span></div>`;
    const anchor = $("#v4SearchControls") || $("#mapsCollectorStatus") || $(".maps-search-row");
    anchor?.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function setPanel({ title, text, progress, processed, total, current, done = false, error = false } = {}) {
    const panel = ensurePanel();
    if (!panel) return;
    panel.classList.remove("hidden", "done", "error");
    if (done) panel.classList.add("done");
    if (error) panel.classList.add("error");
    if (title) $("#rlpTitle").textContent = title;
    if (text) $("#rlpText").textContent = text;
    if (Number.isFinite(progress)) $("#rlpBar").style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (current) $("#rlpCurrent").textContent = current;
    refreshPanelStats(processed, total);
  }

  function refreshPanelStats(processed, total) {
    const leads = dedupe(loadLeads());
    const phones = leads.filter(lead => digits(lead.phone).length >= 10).length;
    const sites = leads.filter(lead => String(lead.website || "").trim()).length;
    $("#rlpBusinesses") && ($("#rlpBusinesses").textContent = leads.length.toLocaleString("pt-BR"));
    $("#rlpPhones") && ($("#rlpPhones").textContent = phones.toLocaleString("pt-BR"));
    $("#rlpSites") && ($("#rlpSites").textContent = sites.toLocaleString("pt-BR"));
    if (Number.isFinite(processed)) $("#rlpProcessed").textContent = Number(processed).toLocaleString("pt-BR");
    if (Number.isFinite(total)) $("#rlpRemaining").textContent = Math.max(0, Number(total) - Number(processed || 0)).toLocaleString("pt-BR");
    else if (!$("#rlpRemaining").textContent) $("#rlpRemaining").textContent = "—";
  }

  function setLegacyStatus(title, text, ready = false) {
    const stateBox = $("#mapsCollectorState");
    if (stateBox) {
      stateBox.className = `maps-collector-state${ready ? " ready" : ""}`;
      stateBox.querySelector("b") && (stateBox.querySelector("b").textContent = title);
      stateBox.querySelector("span") && (stateBox.querySelector("span").textContent = text);
    }
    const batch = $("#v4BatchStatus");
    if (batch) {
      batch.querySelector("b") && (batch.querySelector("b").textContent = title);
      batch.querySelector("span") && (batch.querySelector("span").textContent = text);
    }
  }

  function setButtonsBusy(value) {
    [$("#mapsOpenGoogleButton"), $("#v4BatchSearch"), $("#v4Enrich")].filter(Boolean).forEach(button => {
      button.disabled = value;
      button.classList.toggle("collecting", value);
    });
  }

  function prepareUi() {
    ensurePanel();
    const main = $("#mapsOpenGoogleButton");
    if (main && !running) main.innerHTML = `Mapear região completa <span>→</span>`;
    const legacyAuto = $("#mapsAutoDetail")?.closest("label");
    if (legacyAuto) legacyAuto.style.display = "none";
  }

  async function syncExtensionState(silent = true) {
    try {
      const response = await request("GET_STATE", {}, "STATE_RESULT", 15000);
      if (!response?.ok || !Array.isArray(response.leads)) return;
      const current = dedupe(response.leads);
      if (!current.length) return;
      saveResults(current);
      if (!silent) setPanel({ title: "Estado recuperado", text: `${current.length} negócios recuperados da extensão.`, current: "Radar sincronizado com o coletor." });
    } catch {}
  }

  async function runCompleteSearch() {
    if (running) return;
    const term = $("#mapsSearchTerm")?.value.trim();
    const region = $("#mapsSearchCity")?.value.trim();
    if (!term || !region) return;

    const radiusKm = Number($("#v4Radius")?.value) || 5;
    const terms = keywordVariants(term);
    const queries = terms.map(keyword => `${keyword} ${region}`.trim());

    running = true;
    setButtonsBusy(true);
    setPanel({ title: "Mapeando a região...", text: `${queries.length} pesquisas relacionadas serão unificadas.`, progress: 2, processed: 0, current: `Preparando: ${term} · ${region}` });
    setLegacyStatus("Mapeando região completa...", `${queries.length} buscas relacionadas serão unificadas.`);

    try {
      const geocodePromise = geocodeRegion(region);
      const batch = await request("START_BATCH_SEARCH", { queries, maxScrolls: 45, replace: true }, "BATCH_RESULT");
      if (!batch?.ok) throw new Error(batch?.error || "Não foi possível concluir a busca no Google Maps.");

      let leads = dedupe(batch.leads || []);
      if (!leads.length) throw new Error("O Google Maps não retornou negócios nessa pesquisa.");
      const center = await geocodePromise;

      saveResults(leads, {
        source: "radar-complete-search-v2",
        term,
        region,
        searchTerms: terms,
        radiusKm,
        count: leads.length,
        importedAt: new Date().toISOString(),
        v4Center: center || null
      });
      setPanel({ title: "Empresas encontradas", text: `${leads.length} negócios únicos encontrados. Agora estou completando as fichas.`, progress: 48, processed: 0, total: leads.length, current: "Iniciando telefone, site e horário..." });
      setLegacyStatus("Completando informações...", `${leads.length} negócios encontrados. Buscando telefone, site e horário.`);

      const enrichLimit = Math.min(120, Math.max(50, leads.length));
      const enriched = await request("ENRICH", { limit: enrichLimit }, "ENRICH_RESULT");
      if (enriched?.ok && Array.isArray(enriched.leads)) leads = dedupe(enriched.leads);

      const finalCenter = center || await geocodeRegion(region);
      const phoneCount = leads.filter(lead => digits(lead.phone).length >= 10).length;
      const siteCount = leads.filter(lead => String(lead.website || "").trim()).length;
      saveResults(leads, {
        source: "radar-complete-search-v2",
        term,
        region,
        searchTerms: terms,
        radiusKm,
        count: leads.length,
        phoneCount,
        siteCount,
        importedAt: new Date().toISOString(),
        v4Center: finalCenter || null
      });

      setPanel({ title: "Mapeamento concluído", text: `${leads.length} negócios · ${phoneCount} com telefone · ${siteCount} com site.`, progress: 100, processed: leads.length, total: leads.length, current: "Dados consolidados no Radar.", done: true });
      setLegacyStatus("Mapeamento concluído", `${leads.length} negócios únicos · ${phoneCount} com telefone · ${siteCount} com site.`, true);
      sessionStorage.setItem("radarV4Toast", `${leads.length} negócios encontrados e enriquecidos.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.error("[RadarSearchOrchestratorV2]", error);
      setPanel({ title: "Busca interrompida", text: error.message || "Tente novamente.", current: "Os dados já coletados foram preservados.", error: true });
      setLegacyStatus("Busca interrompida", error.message || "Tente novamente.");
      setButtonsBusy(false);
    } finally {
      running = false;
    }
  }

  function handleProgress(progress) {
    if (!progress?.event) return;
    if (progress.event === "BATCH_PROGRESS") {
      const current = Number(progress.current || 0), total = Number(progress.total || 0);
      const pct = total ? 5 + (current / total) * 38 : 8;
      setPanel({ title: `Busca ${current || 0} de ${total || 0}`, text: progress.query || progress.text || "Percorrendo o Google Maps...", progress: pct, current: progress.query ? `Pesquisando: ${progress.query}` : "Pesquisando negócios..." });
      return;
    }
    if (progress.event === "SEARCH_PROGRESS") {
      if (progress.stage === "done") {
        setPanel({ title: "Descoberta em andamento", text: progress.text || "Mais resultados adicionados.", current: "Unificando empresas e removendo duplicados." });
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => syncExtensionState(true), 120);
      }
      return;
    }
    if (progress.event === "ENRICH_PROGRESS") {
      if (progress.lead) mergeOne(progress.lead);
      const current = Number(progress.current || 0), total = Number(progress.total || 0);
      const pct = total ? 48 + (current / total) * 50 : 52;
      const leadName = progress.lead?.name || "empresa atual";
      setPanel({ title: `Completando fichas ${current}/${total}`, text: "Cada ficha concluída já é atualizada no Radar.", progress: pct, processed: current, total, current: `Atualizado: ${leadName}` });
      return;
    }
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== BRIDGE_TARGET) return;

    if (message.type === "READY" || message.type === "PONG") {
      setTimeout(() => syncExtensionState(true), 250);
      return;
    }
    if (message.type === "PROGRESS") {
      handleProgress(message.progress || {});
      return;
    }
    if (["STATE_RESULT","BATCH_RESULT","ENRICH_RESULT","SEARCH_RESULT"].includes(message.type) && message.response?.ok && Array.isArray(message.response.leads)) {
      saveResults(message.response.leads);
      refreshPanelStats();
    }

    const item = pending.get(message.requestId);
    if (!item || item.expectedType !== message.type) return;
    clearTimeout(item.timer);
    pending.delete(message.requestId);
    item.resolve(message.response || {});
  });

  document.addEventListener("click", event => {
    const target = event.target.closest?.("#mapsOpenGoogleButton, #v4BatchSearch");
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runCompleteSearch();
  }, true);

  const observer = new MutationObserver(prepareUi);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepareUi, { once: true });
  else prepareUi();
  setInterval(prepareUi, 1600);
  setTimeout(() => window.postMessage({ source: BRIDGE_SOURCE, type: "PING" }, window.location.origin), 700);
  setTimeout(() => syncExtensionState(true), 1800);
})();
