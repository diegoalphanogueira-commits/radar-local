(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const ASSET_VERSION = "20260922-8";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function isProspectingPage() {
    return /\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname);
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
      chrome.runtime.sendMessage({
        cmd: "RUN_SEARCH",
        query: String(message.query || "").trim(),
        maxScrolls: Number(message.maxScrolls) || 75,
        replace: message.replace !== false,
        enrich: message.enrich !== false,
        enrichLimit: Number(message.enrichLimit) || 60
      }).then(response => {
        post("SEARCH_RESULT", { requestId: message.requestId || "", response });
      }).catch(error => {
        post("SEARCH_RESULT", { requestId: message.requestId || "", response: { ok: false, error: error.message } });
      });
      return;
    }

    if (message.type === "START_BATCH_SEARCH") {
      chrome.runtime.sendMessage({
        cmd: "RUN_BATCH_SEARCH",
        queries: Array.isArray(message.queries) ? message.queries : [],
        maxScrolls: Number(message.maxScrolls) || 75,
        replace: message.replace !== false
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