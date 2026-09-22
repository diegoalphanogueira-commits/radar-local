importScripts("site-enrichment.js", "export-handler-v3.js");

const STORAGE_KEY = "radarMapsCollectorLeadsV3";
const MARKET_CACHE_KEY = "radarMarketCoverageV4";
const MAX_LEADS = 700;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let activeRun = null;
let activeEnrich = null;

function norm(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function keyForLead(lead) {
  const url = String(lead?.mapsUrl || "").split("?")[0].replace(/\/$/, "");
  return url || norm(`${lead?.name || ""}|${lead?.address || ""}|${lead?.phone || ""}`);
}
function merge(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].forEach(lead => {
    if (!lead?.name) return;
    const key = keyForLead(lead);
    if (!key) return;
    const next = { ...(map.get(key) || {}) };
    Object.entries(lead).forEach(([field, value]) => { if (value !== "" && value !== null && value !== undefined) next[field] = value; });
    map.set(key, next);
  });
  return [...map.values()];
}
async function getLeads() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}
async function setLeads(rows) {
  const clean = merge([], rows).slice(0, MAX_LEADS);
  await chrome.storage.local.set({ [STORAGE_KEY]: clean });
  return clean;
}
function emit(owner, payload) {
  chrome.runtime.sendMessage({ ...payload, sessionId: owner?.id || payload.sessionId || "" }).catch(() => {});
}
function runAlive(run) { return !!run && activeRun?.id === run.id && !run.cancelled; }
function enrichAlive(job) { return !!job && activeEnrich?.id === job.id && !job.cancelled; }
async function closeTabs(owner) {
  if (!owner?.tabs) return;
  const ids = [...owner.tabs];
  owner.tabs.clear();
  await Promise.all(ids.map(id => chrome.tabs.remove(id).catch(() => {})));
}
async function cancelRun(reason = "replaced") {
  const run = activeRun;
  if (!run) return;
  run.cancelled = true;
  run.reason = reason;
  await closeTabs(run);
  if (activeRun?.id === run.id) activeRun = null;
}
async function cancelEnrich(reason = "replaced") {
  const job = activeEnrich;
  if (!job) return;
  job.cancelled = true;
  job.reason = reason;
  await closeTabs(job);
  if (activeEnrich?.id === job.id) activeEnrich = null;
}
async function cancelAll(reason = "replaced") {
  await Promise.all([cancelRun(reason), cancelEnrich(reason)]);
}

async function waitTab(tabId, timeout = 22000) {
  try { const t = await chrome.tabs.get(tabId); if (t?.status === "complete") return; } catch {}
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); };
    const listener = (id, info) => { if (id === tabId && info.status === "complete") finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeout);
  });
}
async function sendRetry(tabId, message, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try { const r = await chrome.tabs.sendMessage(tabId, message); if (r) return r; } catch (e) { last = e; }
    await sleep(450 + i * 250);
  }
  throw last || new Error("CONTENT_SCRIPT_UNAVAILABLE");
}

async function geocode(region) {
  const q = String(region || "").trim();
  if (!q) return null;
  try {
    const params = new URLSearchParams({ q: `${q}, Brasil`, format: "jsonv2", limit: "3", countrycodes: "br" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
    const rows = res.ok ? await res.json() : [];
    const first = rows?.[0];
    const lat = Number(first?.lat), lng = Number(first?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, source: "geocode", displayName: first.display_name || q } : null;
  } catch { return null; }
}
function offset(center, eastKm = 0, northKm = 0) {
  if (!center) return null;
  const lat = Number(center.lat), lng = Number(center.lng);
  const dLat = northKm / 110.574;
  const dLng = eastKm / (111.320 * Math.max(.25, Math.cos(lat * Math.PI / 180)));
  return { lat: lat + dLat, lng: lng + dLng };
}
function anchors(center, radiusKm) {
  if (!center) return [null];
  const d = Math.min(3.2, Math.max(.9, Number(radiusKm || 5) * .45));
  return [
    { ...center, label: "centro" },
    { ...offset(center, 0, d), label: "norte" },
    { ...offset(center, d, 0), label: "leste" },
    { ...offset(center, 0, -d), label: "sul" },
    { ...offset(center, -d, 0), label: "oeste" },
    { ...offset(center, d, d), label: "nordeste" },
    { ...offset(center, -d, d), label: "noroeste" },
    { ...offset(center, d, -d), label: "sudeste" },
    { ...offset(center, -d, -d), label: "sudoeste" }
  ];
}
function zoom(radius) { return radius <= 2 ? 15 : radius <= 5 ? 14 : radius <= 9 ? 13 : 12; }
function stripRegion(query, region) {
  const q = String(query || "").trim(), r = String(region || "").trim();
  if (!r) return q;
  const qn = norm(q), rn = norm(r);
  if (qn.endsWith(rn)) return q.slice(0, Math.max(0, q.length - r.length)).trim();
  return q;
}
function mapsUrl(query, context, anchor) {
  const center = anchor || context.center;
  if (center) return `https://www.google.com/maps/search/${encodeURIComponent(stripRegion(query, context.region) || query)}/@${center.lat},${center.lng},${zoom(context.radiusKm)}z`;
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function marketKey(message) { return `${norm(message.segment || message.term)}|${norm(message.region)}|${Number(message.radiusKm || 5)}`; }
async function loadCache() {
  const data = await chrome.storage.local.get(MARKET_CACHE_KEY);
  return data[MARKET_CACHE_KEY] && typeof data[MARKET_CACHE_KEY] === "object" ? data[MARKET_CACHE_KEY] : {};
}
async function getCached(message) { return (await loadCache())[marketKey(message)] || null; }
async function saveCached(message, leads, center) {
  const cache = await loadCache();
  const key = marketKey(message);
  const previous = cache[key] || {};
  const merged = merge(previous.leads || [], leads || []).slice(0, MAX_LEADS);
  cache[key] = { segment: message.segment, term: message.term, region: message.region, radiusKm: Number(message.radiusKm || 5), center: center || previous.center || null, updatedAt: Date.now(), bestCount: Math.max(Number(previous.bestCount || 0), merged.length), leads: merged };
  const kept = Object.entries(cache).sort((a,b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0)).slice(0, 30);
  await chrome.storage.local.set({ [MARKET_CACHE_KEY]: Object.fromEntries(kept) });
  return merged;
}

function config(mode) {
  if (mode === "30") return { target: 30, minTasks: 3, maxTasks: 5, concurrency: 2, scanMode: "30" };
  if (mode === "50") return { target: 50, minTasks: 4, maxTasks: 8, concurrency: 2, scanMode: "50" };
  if (mode === "100") return { target: 100, minTasks: 6, maxTasks: 12, concurrency: 2, scanMode: "100" };
  return { target: Infinity, minTasks: 8, maxTasks: 18, concurrency: 2, scanMode: "max" };
}
function buildPlan(queries, points, maxTasks) {
  const q = [...new Set((queries || []).map(v => String(v || "").trim()).filter(Boolean))];
  const p = points.length ? points : [null];
  const plan = [];
  if (!q.length) return plan;
  [0,1,2,3,4].forEach(i => plan.push({ query: q[0], anchor: p[i % p.length] }));
  if (q[1]) [0,1].forEach(i => plan.push({ query: q[1], anchor: p[i % p.length] }));
  for (let i = 2; i < q.length && plan.length < maxTasks; i += 1) plan.push({ query: q[i], anchor: p[(i + 3) % p.length] });
  return plan.slice(0, maxTasks);
}

async function scanTask(run, task, index, total, context, scanMode) {
  if (!runAlive(run)) throw new Error("CANCELLED");
  const tab = await chrome.tabs.create({ url: mapsUrl(task.query, context, task.anchor), active: false });
  run.tabs.add(tab.id);
  emit(run, { event: "SEARCH_PROGRESS", stage: "opening", current: index, total, query: task.query, area: task.anchor?.label || "texto", text: `Buscando ${task.query} · ${task.anchor?.label || "região"}` });
  try {
    await waitTab(tab.id, 22000);
    if (!runAlive(run)) throw new Error("CANCELLED");
    await sleep(900);
    const response = await sendRetry(tab.id, { cmd: "SCAN_SCROLL", mode: scanMode }, 5);
    if (!response?.ok) throw new Error(response?.error || "SCAN_FAILED");
    if (!runAlive(run)) throw new Error("CANCELLED");
    return response;
  } finally {
    run.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function runMarket(message) {
  await cancelAll("new-search");
  const run = { id: String(message.sessionId || `run-${Date.now()}`), cancelled: false, tabs: new Set(), segment: message.segment, region: message.region };
  activeRun = run;
  const cfg = config(String(message.targetMode || "50"));
  const center = await geocode(message.region);
  const context = { region: message.region, radiusKm: Number(message.radiusKm || 5), center };
  const cached = await getCached(message);
  let leads = merge(cached?.leads || [], message.seedLeads || []);
  await setLeads(leads);
  const plan = buildPlan(message.queries, anchors(center, context.radiusKm), cfg.maxTasks);
  let cursor = 0, completed = 0, stable = 0, lastCount = leads.length;
  const errors = [];

  emit(run, { event: "BATCH_PROGRESS", stage: "start", current: 0, total: plan.length, accumulated: leads.length, text: `${message.segment || message.term} · cobertura ${message.targetMode === "max" ? "Máxima" : `${message.targetMode}+`}` });

  async function worker() {
    while (true) {
      if (!runAlive(run)) return;
      const taskIndex = cursor++;
      if (taskIndex >= plan.length) return;
      if (completed >= cfg.minTasks && Number.isFinite(cfg.target) && leads.length >= cfg.target) return;
      if (completed >= cfg.minTasks && !Number.isFinite(cfg.target) && stable >= 5) return;
      const task = plan[taskIndex];
      try {
        const result = await scanTask(run, task, taskIndex + 1, plan.length, context, cfg.scanMode);
        if (!runAlive(run)) return;
        leads = await setLeads(merge(leads, result.leads || []));
        const added = Math.max(0, leads.length - lastCount);
        lastCount = leads.length;
        stable = added ? 0 : stable + 1;
        completed += 1;
        await saveCached(message, leads, center);
        emit(run, { event: "MARKET_PARTIAL", stage: "pass_done", current: completed, total: plan.length, accumulated: leads.length, added, query: task.query, area: task.anchor?.label || "texto", metrics: result.metrics || {}, text: `${leads.length} negócios acumulados · +${added} nesta varredura.` });
      } catch (error) {
        if (String(error?.message) === "CANCELLED") return;
        completed += 1;
        stable += 1;
        errors.push({ query: task.query, error: error?.message || String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: cfg.concurrency }, () => worker()));
  if (!runAlive(run)) throw new Error("CANCELLED");
  leads = await setLeads(merge(leads, await getLeads()));
  leads = await saveCached(message, leads, center);
  await setLeads(leads);
  emit(run, { event: "BATCH_PROGRESS", stage: "done", current: completed, total: plan.length, accumulated: leads.length, text: `${leads.length} negócios consolidados.` });
  if (activeRun?.id === run.id) activeRun = null;
  return { leads, context, errors, searchesDone: completed, plannedSearches: plan.length, targetLabel: message.targetMode === "max" ? "Máxima" : `${message.targetMode}+`, bestCount: leads.length };
}

async function enrichOne(lead, job) {
  if (!lead?.mapsUrl || !enrichAlive(job)) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  job.tabs.add(tab.id);
  try {
    await waitTab(tab.id, 18000);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    await sleep(700);
    const response = await sendRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 4).catch(() => null);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    return response?.ok && response.lead ? merge([lead], [response.lead])[0] : lead;
  } finally {
    job.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
async function enrichAll(limit = 60, sessionId = "") {
  await cancelEnrich("new-enrich");
  const job = { id: String(sessionId || `enrich-${Date.now()}`), cancelled: false, tabs: new Set() };
  activeEnrich = job;
  let leads = await getLeads();
  const queue = leads.map((lead, index) => ({ lead, index, score: (!lead.phone ? 100 : 0) + (!lead.website ? 35 : 0) + (!lead.hours ? 10 : 0) })).filter(x => x.lead?.mapsUrl && x.score > 0).sort((a,b) => b.score - a.score).slice(0, Math.min(Number(limit || 60), 150));
  let cursor = 0, done = 0;
  async function worker() {
    while (true) {
      if (!enrichAlive(job)) return;
      const pos = cursor++;
      if (pos >= queue.length) return;
      const item = queue[pos];
      try {
        leads[item.index] = await enrichOne(item.lead, job);
        if (enrichAlive(job)) leads = await setLeads(leads);
      } catch (error) {
        if (error?.message === "CANCELLED") return;
      }
      if (!enrichAlive(job)) return;
      done += 1;
      emit(job, { event: "ENRICH_PROGRESS", current: done, total: queue.length, lead: leads[item.index] });
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, Math.max(1, queue.length)) }, () => worker()));
  if (!enrichAlive(job)) throw new Error("CANCELLED");
  if (activeEnrich?.id === job.id) activeEnrich = null;
  return setLeads(leads);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.cmd === "SITE_ENRICH_ONE") return;
  if (message?.cmd === "CANCEL_MARKET_SEARCH") {
    cancelAll("user-replaced").then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.cmd === "RUN_MARKET_SEARCH_V4") {
    runMarket(message).then(result => sendResponse({ ok: true, ...result })).catch(error => sendResponse({ ok: false, cancelled: error?.message === "CANCELLED", error: error?.message || String(error) }));
    return true;
  }
  if (message?.cmd === "GET_STATE") {
    getLeads().then(leads => sendResponse({ ok: true, leads, sessionId: activeRun?.id || activeEnrich?.id || "" })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.cmd === "STORE_LEADS") {
    setLeads(message.leads || []).then(leads => sendResponse({ ok: true, leads })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.cmd === "ENRICH_ALL") {
    enrichAll(message.limit, message.sessionId).then(leads => sendResponse({ ok: true, leads })).catch(error => sendResponse({ ok: false, cancelled: error?.message === "CANCELLED", error: error.message }));
    return true;
  }
  if (message?.cmd === "CLEAR") {
    cancelAll("clear").then(() => setLeads([])).then(leads => sendResponse({ ok: true, leads })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
