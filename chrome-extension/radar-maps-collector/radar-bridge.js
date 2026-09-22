(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const ASSET_VERSION = "20260922-9";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const QUERY_GROUPS = [
    {
      test: /odont|dentist|dental/,
      terms: [
        "dentista", "clínica odontológica", "odontologia", "consultório odontológico",
        "cirurgião-dentista", "ortodontista", "implantodontista", "implante dentário",
        "odontopediatra", "endodontista", "prótese dentária", "clareamento dental"
      ]
    },
    {
      test: /estet|beleza|harmoniza|depila|limpeza de pele|spa/,
      terms: [
        "clínica de estética", "centro de estética", "estética facial", "estética corporal",
        "estética avançada", "harmonização facial", "limpeza de pele", "depilação a laser",
        "esteticista", "spa estético", "clínica de beleza", "tratamento estético"
      ]
    },
    {
      test: /manicure|unha|nail|esmalter/,
      terms: [
        "manicure", "pedicure", "esmalteria", "nail designer", "salão de unhas",
        "alongamento de unhas", "unhas em gel", "manicure e pedicure", "studio de unhas"
      ]
    },
    {
      test: /pet|veterin|banho e tosa/,
      terms: [
        "pet shop", "petshop", "banho e tosa", "clínica veterinária", "veterinário",
        "hospital veterinário", "hotel para cães", "creche para cães", "loja de ração"
      ]
    }
  ];

  function isProspectingPage() {
    return /\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname);
  }

  function pageContext() {
    const region = String(document.querySelector("#mapsSearchCity")?.value || "").trim();
    const term = String(document.querySelector("#mapsSearchTerm")?.value || "").trim();
    const radiusKm = Number(document.querySelector("#v4Radius")?.value || 5) || 5;
    return { region, term, radiusKm };
  }

  function expandQueries(inputQueries) {
    const { term, region } = pageContext();
    const normalizedTerm = normalize(term);
    const group = QUERY_GROUPS.find(item => item.test.test(normalizedTerm));
    const base = Array.isArray(inputQueries) ? inputQueries : [];
    if (!group || !region) return [...new Set(base.map(item => String(item || "").trim()).filter(Boolean))].slice(0, 12);
    const extras = group.terms.map(keyword => `${keyword} ${region}`.trim());
    return [...new Set([...base, ...extras].map(item => String(item || "").trim()).filter(Boolean))].slice(0, 12);
  }

  function sanitizeSavedCenter() {
    if (!isProspectingPage()) return;
    try {
      const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}") || {};
      const leads = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
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
    } catch (error) {
      console.warn("[Radar Maps Collector] center sanitize", error);
    }
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
      chrome.runtime.sendMessage({
        cmd: "RUN_SEARCH",
        query: String(message.query || "").trim(),
        maxScrolls: Number(message.maxScrolls) || 85,
        replace: message.replace !== false,
        enrich: message.enrich !== false,
        enrichLimit: Number(message.enrichLimit) || 60,
        region: context.region,
        radiusKm: context.radiusKm
      }).then(response => {
        post("SEARCH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("SEARCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
      return;
    }

    if (message.type === "START_BATCH_SEARCH") {
      const context = pageContext();
      chrome.runtime.sendMessage({
        cmd: "RUN_BATCH_SEARCH",
        queries: expandQueries(message.queries),
        maxScrolls: Math.max(85, Number(message.maxScrolls) || 85),
        replace: message.replace !== false,
        region: context.region,
        radiusKm: context.radiusKm
      }).then(response => {
        post("BATCH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("BATCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
      return;
    }

    if (message.type === "ENRICH") {
      chrome.runtime.sendMessage({
        cmd: "ENRICH_ALL",
        limit: Number(message.limit) || 60
      }).then(response => {
        post("ENRICH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("ENRICH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
      return;
    }

    if (message.type === "GET_STATE") {
      chrome.runtime.sendMessage({ cmd: "GET_STATE" }).then(response => {
        post("STATE_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("STATE_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
      return;
    }

    if (message.type === "CLEAR") {
      chrome.runtime.sendMessage({ cmd: "CLEAR" }).then(response => {
        post("CLEAR_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("CLEAR_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
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