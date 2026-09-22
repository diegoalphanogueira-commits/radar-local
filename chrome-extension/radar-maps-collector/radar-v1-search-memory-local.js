/* Radar Local V1 — memória canônica por nicho + região + raio */
(() => {
  "use strict";

  if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  if (window.RadarV1SearchMemoryLocal) return;
  window.RadarV1SearchMemoryLocal = true;

  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV1";
  const TTL = 45 * 24 * 60 * 60 * 1000;
  const MAX_SEARCHES = 40;
  const MAX_LEADS = 600;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const SEGMENTS = [
    { id: "barbearia", re: /barbear|barber|corte masculino|barba e cabelo|salao masculino/ },
    { id: "odontologia", re: /odont|dentist|dental|ortodont|implantodont|endodont/ },
    { id: "estetica", re: /estet|harmoniza|depila|limpeza de pele|spa estet|beleza/ },
    { id: "manicure", re: /manicure|pedicure|esmalter|nail|unha/ },
    { id: "podologia", re: /podolog/ },
    { id: "pet-veterinaria", re: /pet shop|petshop|veterin|banho e tosa|hotel para caes|creche para caes/ },
    { id: "seguros", re: /seguro|corretor de seguro/ },
    { id: "imobiliaria", re: /imobili|imoveis|corretor de imovel/ },
    { id: "contabilidade", re: /contab|contador/ },
    { id: "advocacia", re: /advoc|advog/ },
    { id: "academia", re: /academia|fitness|muscul|personal trainer/ },
    { id: "restaurante", re: /restaurante|pizzaria|lanchonete|hamburg/ }
  ];

  let writing = false;
  let lastSignature = "";

  function segmentOf(term) {
    const value = normalize(term);
    const match = SEGMENTS.find(item => item.re.test(value));
    return match?.id || value;
  }

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
    return { term, segment: segmentOf(term), region, radiusKm };
  }

  function contextKey(context) {
    if (!context) return "";
    return `${context.segment || segmentOf(context.term)}|${normalize(context.region)}|${Number(context.radiusKm || 5) || 5}`;
  }

  function compatibleEntry(entry, context) {
    if (!entry || !context) return false;
    const entrySegment = entry.segment || segmentOf(entry.term || "");
    return entrySegment === context.segment
      && normalize(entry.region) === normalize(context.region)
      && Number(entry.radiusKm || 5) === Number(context.radiusKm || 5);
  }

  function formMatchesMeta(context) {
    if (!context) return false;
    const termInput = document.querySelector("#mapsSearchTerm")?.value?.trim() || "";
    const regionInput = document.querySelector("#mapsSearchCity")?.value?.trim() || "";
    if (termInput && segmentOf(termInput) !== context.segment) return false;
    if (regionInput && normalize(regionInput) !== normalize(context.region)) return false;
    return true;
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

  function collectCompatible(memory, context) {
    const rows = [];
    const keys = [];
    Object.entries(memory || {}).forEach(([key, entry]) => {
      if (!compatibleEntry(entry, context)) return;
      keys.push(key);
      rows.push(...(Array.isArray(entry.leads) ? entry.leads : []));
    });
    return { leads: dedupe(rows), keys };
  }

  function writeLeads(leads, metaPatch = {}) {
    writing = true;
    try {
      const meta = loadMeta();
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
      localStorage.setItem(META_KEY, JSON.stringify({ ...meta, ...metaPatch }));
      window.dispatchEvent(new CustomEvent("radar:maps-data-updated", {
        detail: { count: leads.length, source: "v1-search-memory-local" }
      }));
    } finally {
      setTimeout(() => { writing = false; }, 0);
    }
  }

  function updateUi(restored, total, context) {
    if (!restored) return;
    const status = document.querySelector("#v4BatchStatus");
    if (status) {
      status.querySelector("b") && (status.querySelector("b").textContent = "Cobertura preservada");
      status.querySelector("span") && (status.querySelector("span").textContent = `${restored} empresa${restored === 1 ? "" : "s"} recuperada${restored === 1 ? "" : "s"} da melhor coleta de ${context.segment} · ${total} no total.`);
    }
    const current = document.querySelector("#radarLiveProgress #rlpCurrent");
    if (current) current.textContent = `Memória por nicho ativa: ${restored} resultado${restored === 1 ? "" : "s"} recuperado${restored === 1 ? "" : "s"}.`;
  }

  function reconcile() {
    if (writing) return;
    const meta = loadMeta();
    const context = contextFromMeta(meta);
    if (!context || !formMatchesMeta(context)) return;

    const current = dedupe(loadLeads());
    if (!current.length) return;

    const memory = loadMemory();
    const compatible = collectCompatible(memory, context);
    const previousLeads = compatible.leads;
    const merged = dedupe([...previousLeads, ...current]).slice(0, MAX_LEADS);
    const restored = Math.max(0, merged.length - current.length);
    const canonicalKey = contextKey(context);

    compatible.keys.forEach(key => {
      if (key !== canonicalKey) delete memory[key];
    });

    memory[canonicalKey] = {
      term: context.term,
      segment: context.segment,
      region: context.region,
      radiusKm: context.radiusKm,
      bestCount: Math.max(Number(memory[canonicalKey]?.bestCount || 0), merged.length),
      updatedAt: Date.now(),
      leads: merged
    };
    saveMemory(memory);

    if (restored > 0) {
      writeLeads(merged, {
        count: merged.length,
        coverageBestCount: merged.length,
        coverageMemoryRecovered: restored,
        coverageMemorySegment: context.segment,
        coverageMemoryRecoveredAt: new Date().toISOString()
      });
      updateUi(restored, merged.length, context);
    }
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
      reconcile();
    }
  }

  window.addEventListener("radar:maps-data-updated", event => {
    if (event?.detail?.source === "v1-search-memory-local") return;
    setTimeout(reconcile, 25);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      reconcile();
      lastSignature = signature();
    }, { once: true });
  } else {
    reconcile();
    lastSignature = signature();
  }

  setInterval(poll, 650);
  console.info("[Radar Local] Memória canônica por nicho ativa.");
})();
