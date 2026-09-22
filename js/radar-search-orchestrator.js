/* =========================================================
   RADAR LOCAL — SEARCH ORCHESTRATOR V1
   Unifica a busca rápida e a busca completa:
   múltiplos termos -> dedupe -> centro robusto -> enriquecimento.
========================================================= */
(() => {
  "use strict";

  if (window.RadarSearchOrchestratorV1) return;
  window.RadarSearchOrchestratorV1 = true;

  const STORAGE_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const BRIDGE_SOURCE = "RADAR_LOCAL_WEB";
  const BRIDGE_TARGET = "RADAR_MAPS_COLLECTOR";
  const pending = new Map();
  let running = false;

  const $ = selector => document.querySelector(selector);
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const KEYWORD_GROUPS = [
    {
      test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/,
      terms: [
        "clínica de estética", "centro de estética", "estética facial",
        "estética corporal", "estética avançada", "harmonização facial",
        "limpeza de pele", "depilação a laser", "esteticista", "spa estético"
      ]
    },
    {
      test: /pet|veterin|banho e tosa|hotel.*cae|creche.*cae/,
      terms: [
        "pet shop", "petshop", "banho e tosa", "clínica veterinária",
        "veterinário", "hospital veterinário", "hotel para cães", "creche para cães"
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
    { test: /restaurante|pizzaria|lanchonete|hamburg/, terms: ["restaurante", "pizzaria", "lanchonete", "hamburgueria", "comida delivery"] }
  ];

  const GENERIC_REGION_TOKENS = new Set([
    "jardim", "jd", "vila", "bairro", "parque", "regiao", "região",
    "distrito", "cidade", "municipio", "município", "sao", "são", "sp"
  ]);

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

  function dedupe(leads) {
    const map = new Map();
    (Array.isArray(leads) ? leads : []).forEach(lead => {
      if (!lead?.name) return;
      const key = cleanMapsUrl(lead.mapsUrl) || normalize(`${lead.name}|${lead.address || ""}|${lead.phone || ""}`);
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

  function pointOf(lead) {
    const lat = Number(lead?.lat);
    const lng = Number(lead?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function haversineKm(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371;
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function median(values) {
    const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!nums.length) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }

  function medianCenter(points, source = "cluster") {
    if (!points.length) return null;
    return {
      lat: median(points.map(point => point.lat)),
      lng: median(points.map(point => point.lng)),
      source
    };
  }

  function regionCoreTokens(region) {
    const firstPart = String(region || "").split(",")[0];
    return normalize(firstPart)
      .split(" ")
      .filter(token => token.length >= 3 && !GENERIC_REGION_TOKENS.has(token));
  }

  function addressMatchesRegion(lead, region) {
    const tokens = regionCoreTokens(region);
    if (!tokens.length) return false;
    const address = normalize(`${lead?.address || ""} ${lead?.neighborhood || ""} ${lead?.city || ""}`);
    const addressTokens = address.split(" ").filter(Boolean);
    const matchesToken = token => addressTokens.some(candidate => {
      if (candidate === token) return true;
      if (token.length >= 4 && candidate.length >= 4) return token.startsWith(candidate) || candidate.startsWith(token);
      return false;
    });
    const matched = tokens.filter(matchesToken).length;
    return tokens.length === 1 ? matched === 1 : matched >= Math.min(2, tokens.length);
  }

  function densestCenter(leads, radiusKm) {
    const points = leads.map(pointOf).filter(Boolean);
    if (!points.length) return null;
    if (points.length === 1) return { ...points[0], source: "single-result" };

    const clusterRadius = Math.max(1.8, Math.min(5, Number(radiusKm || 5) * 0.9));
    let bestCluster = [];
    for (const point of points) {
      const cluster = points.filter(other => haversineKm(point, other) <= clusterRadius);
      if (cluster.length > bestCluster.length) bestCluster = cluster;
    }
    return medianCenter(bestCluster.length ? bestCluster : points, "densest-cluster");
  }

  function robustCenter(leads, region, radiusKm) {
    const matched = leads.filter(lead => addressMatchesRegion(lead, region)).map(pointOf).filter(Boolean);
    if (matched.length) return { ...medianCenter(matched, "region-address"), region };
    const dense = densestCenter(leads, radiusKm);
    return dense ? { ...dense, region } : null;
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveResults(leads, metaPatch) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupe(leads)));
    localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...metaPatch }));
  }

  function request(type, payload, expectedType, timeoutMs = 900000) {
    const requestId = `orchestrator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("O coletor demorou demais para responder."));
      }, timeoutMs);
      pending.set(requestId, { expectedType, resolve, reject, timer });
      window.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload }, window.location.origin);
    });
  }

  function setStatus(title, text, ready = false) {
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
    const checkbox = $("#mapsAutoDetail");
    if (checkbox) {
      checkbox.checked = true;
      checkbox.disabled = true;
      const label = checkbox.closest("label");
      if (label) {
        label.title = "O Radar completa telefone, site e horário automaticamente após a descoberta.";
        const textNodes = [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
        textNodes.forEach(node => node.textContent = " telefone, site e horário serão completados automaticamente");
      }
    }
    const mainButton = $("#mapsOpenGoogleButton");
    if (mainButton && !running) mainButton.innerHTML = `Mapear região completa <span>→</span>`;
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
    setStatus("Mapeando região completa...", `${queries.length} buscas relacionadas serão unificadas.`);

    try {
      const batch = await request("START_BATCH_SEARCH", {
        queries,
        maxScrolls: 45,
        replace: true
      }, "BATCH_RESULT");
      if (!batch?.ok) throw new Error(batch?.error || "Não foi possível concluir a busca no Google Maps.");

      let leads = dedupe(batch.leads || []);
      if (!leads.length) throw new Error("O Google Maps não retornou negócios nessa pesquisa.");

      let center = robustCenter(leads, region, radiusKm);
      saveResults(leads, {
        source: "radar-complete-search",
        term,
        region,
        searchTerms: terms,
        radiusKm,
        count: leads.length,
        importedAt: new Date().toISOString(),
        v4Center: center
      });

      setStatus("Completando informações...", `${leads.length} negócios encontrados. Buscando telefone, site e horário.`);
      const enrichLimit = Math.min(120, Math.max(50, leads.length));
      const enriched = await request("ENRICH", { limit: enrichLimit }, "ENRICH_RESULT");
      if (enriched?.ok && Array.isArray(enriched.leads)) leads = dedupe(enriched.leads);

      center = robustCenter(leads, region, radiusKm) || center;
      const phoneCount = leads.filter(lead => String(lead.phone || "").replace(/\D/g, "").length >= 10).length;
      const siteCount = leads.filter(lead => String(lead.website || "").trim()).length;
      saveResults(leads, {
        source: "radar-complete-search",
        term,
        region,
        searchTerms: terms,
        radiusKm,
        count: leads.length,
        phoneCount,
        siteCount,
        importedAt: new Date().toISOString(),
        v4Center: center
      });

      setStatus("Mapeamento concluído", `${leads.length} negócios únicos · ${phoneCount} com telefone · ${siteCount} com site.`, true);
      sessionStorage.setItem("radarV4Toast", `${leads.length} negócios encontrados e enriquecidos.`);
      setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      console.error("[RadarSearchOrchestrator]", error);
      setStatus("Busca interrompida", error.message || "Tente novamente.");
      setButtonsBusy(false);
    } finally {
      running = false;
    }
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== BRIDGE_TARGET) return;

    if (message.type === "PROGRESS") {
      const progress = message.progress || {};
      if (progress.event === "BATCH_PROGRESS") {
        setStatus(`Busca ${progress.current || 0} de ${progress.total || 0}`, progress.query || progress.text || "Percorrendo o Google Maps...");
      } else if (progress.event === "ENRICH_PROGRESS") {
        setStatus(`Completando ${progress.current || 0}/${progress.total || 0}`, "Telefone, site e horário nas fichas do Google.");
      }
      return;
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
  setInterval(prepareUi, 1800);
})();