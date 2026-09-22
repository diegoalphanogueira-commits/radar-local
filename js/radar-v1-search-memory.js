/* Radar Local V1 — memória persistente da melhor busca */
(() => {
  "use strict";

  if (window.RadarV1SearchMemory) return;
  window.RadarV1SearchMemory = true;

  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV1";
  const TTL = 45 * 24 * 60 * 60 * 1000;
  const MAX_SEARCHES = 30;
  const MAX_LEADS = 500;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  let writing = false;
  let lastSignature = "";

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function loadLeads() {
    try {
      const rows = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }

  function loadMemory() {
    try {
      const data = JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch { return {}; }
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

  function contextFromMeta(meta = loadMeta()) {
    const term = String(meta.term || "").trim();
    const region = String(meta.region || "").trim();
    const radiusKm = Number(meta.radiusKm || 5) || 5;
    if (!term || !region) return null;
    return { term, region, radiusKm };
  }

  function contextKey(context) {
    if (!context) return "";
    return `${normalize(context.term)}|${normalize(context.region)}|${Number(context.radiusKm || 5) || 5}`;
  }

  function formMatchesMeta(context) {
    if (!context) return false;
    const termInput = document.querySelector("#mapsSearchTerm")?.value?.trim() || "";
    const regionInput = document.querySelector("#mapsSearchCity")?.value?.trim() || "";
    if (termInput && normalize(termInput) !== normalize(context.term)) return false;
    if (regionInput && normalize(regionInput) !== normalize(context.region)) return false;
    return true;
  }

  function overlapCount(a, b) {
    const keys = new Set((Array.isArray(a) ? a : []).map(leadKey).filter(Boolean));
    let count = 0;
    (Array.isArray(b) ? b : []).forEach(lead => {
      const key = leadKey(lead);
      if (key && keys.has(key)) count += 1;
    });
    return count;
  }

  function saveMemory(memory) {
    const now = Date.now();
    const entries = Object.entries(memory || {})
      .filter(([, entry]) => entry && Number(entry.updatedAt || 0) >= now - TTL)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, MAX_SEARCHES);
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(entries))); }
    catch {}
  }

  function updateUi(restored, total) {
    if (!restored) return;
    const status = document.querySelector("#v4BatchStatus");
    if (status) {
      const title = status.querySelector("b");
      const text = status.querySelector("span");
      if (title) title.textContent = "Cobertura preservada";
      if (text) text.textContent = `${restored} empresa${restored === 1 ? "" : "s"} recuperada${restored === 1 ? "" : "s"} da melhor coleta anterior · ${total} no total.`;
    }
    const panel = document.querySelector("#radarLiveProgress");
    const current = panel?.querySelector("#rlpCurrent");
    if (current) current.textContent = `Proteção de cobertura ativa: ${restored} resultado${restored === 1 ? "" : "s"} recuperado${restored === 1 ? "" : "s"} da memória.`;
  }

  function writeLeads(leads, metaPatch = {}) {
    writing = true;
    try {
      const meta = loadMeta();
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      localStorage.setItem(META_KEY, JSON.stringify({ ...meta, ...metaPatch }));
      window.dispatchEvent(new CustomEvent("radar:maps-data-updated", {
        detail: { count: leads.length, source: "v1-search-memory" }
      }));
    } finally {
      setTimeout(() => { writing = false; }, 0);
    }
  }

  function reconcile(reason = "update") {
    if (writing) return;
    const meta = loadMeta();
    const context = contextFromMeta(meta);
    if (!context || !formMatchesMeta(context)) return;

    const current = dedupe(loadLeads());
    if (!current.length) return;

    const key = contextKey(context);
    const memory = loadMemory();
    const previous = memory[key];
    const previousLeads = dedupe(previous?.leads || []);

    if (previousLeads.length) {
      const overlap = overlapCount(previousLeads, current);
      const currentIsSmaller = current.length < previousLeads.length;
      const suspiciousDifferentSet = overlap === 0 && previousLeads.length >= 5;

      if (currentIsSmaller && !suspiciousDifferentSet) {
        const merged = dedupe([...previousLeads, ...current]).slice(0, MAX_LEADS);
        const restored = Math.max(0, merged.length - current.length);
        memory[key] = {
          term: context.term,
          region: context.region,
          radiusKm: context.radiusKm,
          bestCount: Math.max(Number(previous?.bestCount || 0), merged.length),
          updatedAt: Date.now(),
          leads: merged
        };
        saveMemory(memory);
        if (restored > 0) {
          writeLeads(merged, {
            count: merged.length,
            coverageMemoryRecovered: restored,
            coverageMemoryRecoveredAt: new Date().toISOString(),
            coverageBestCount: merged.length
          });
          updateUi(restored, merged.length);
        }
        return;
      }

      if (suspiciousDifferentSet) return;
    }

    const best = previousLeads.length ? dedupe([...previousLeads, ...current]) : current;
    memory[key] = {
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      bestCount: Math.max(Number(previous?.bestCount || 0), best.length),
      updatedAt: Date.now(),
      leads: best.slice(0, MAX_LEADS)
    };
    saveMemory(memory);
  }

  function signature() {
    const meta = loadMeta();
    const context = contextFromMeta(meta);
    const leads = loadLeads();
    return `${contextKey(context)}|${leads.length}|${meta.importedAt || ""}|${meta.phoneCount || 0}|${meta.siteCount || 0}`;
  }

  function poll() {
    const next = signature();
    if (next && next !== lastSignature) {
      lastSignature = next;
      reconcile("poll");
    }
  }

  window.addEventListener("radar:maps-data-updated", event => {
    if (event?.detail?.source === "v1-search-memory") return;
    setTimeout(() => reconcile("event"), 20);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      reconcile("boot");
      lastSignature = signature();
    }, { once: true });
  } else {
    reconcile("boot");
    lastSignature = signature();
  }

  setInterval(poll, 700);
  console.info("[Radar Local] Proteção de melhor coleta ativa.");
})();
