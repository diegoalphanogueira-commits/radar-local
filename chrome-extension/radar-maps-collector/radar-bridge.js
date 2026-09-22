(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";

  function isProspectingPage() {
    return /\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname);
  }

  function injectWorkspaceAssets() {
    if (!isProspectingPage()) return;
    const origin = window.location.origin;
    if (!document.getElementById("radarProspectingWorkspaceCss")) {
      const link = document.createElement("link");
      link.id = "radarProspectingWorkspaceCss";
      link.rel = "stylesheet";
      link.href = `${origin}/css/prospecting-workspace.css?v=20260922-4`;
      (document.head || document.documentElement).appendChild(link);
    }
    if (!document.getElementById("radarProspectingWorkspaceScript")) {
      const script = document.createElement("script");
      script.id = "radarProspectingWorkspaceScript";
      script.src = `${origin}/js/prospecting-workspace.js?v=20260922-4`;
      script.defer = true;
      (document.head || document.documentElement).appendChild(script);
    }
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
        maxScrolls: Number(message.maxScrolls) || 45,
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
        maxScrolls: Number(message.maxScrolls) || 32,
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
