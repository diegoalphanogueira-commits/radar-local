importScripts("site-enrichment.js", "export-handler-v3.js");

const STORAGE_KEY = "radarMapsCollectorLeadsV3";
const MARKET_CACHE_KEY = "radarMarketCoverageV4";
const PROGRESS_KEY = "radarExtractionProgressV2";
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
    Object.entries(lead).forEach(([field, value]) => {
      if (value !== "" && value !== null && value !== undefined) next[field] = value;
    });
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
async function progress(patch = {}) {
  const data = await chrome.storage.local.get(PROGRESS_KEY);
  const previous = data[PROGRESS_KEY] && typeof data[PROGRESS_KEY] === "object" ? data[PROGRESS_KEY] : {};
  const next = { ...previous, ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [PROGRESS_KEY]: next });
  return next;
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
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => { if (id === tabId && info.status === "complete") finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeout);
  });
}
async function sendRetry(tabId, message, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const r = await chrome.tabs.sendMessage(tabId, message);
      if (r) return r;
    } catch (e) { last = e; }
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
  const d = Math.min(3.2, Math.max(.65, Number(radiusKm || 5) * .42));
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
function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng);
  if (![lat1,lng1,lat2,lng2].every(Number.isFinite)) return null;
  const rad = n => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng/2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}
function geoStats(leads, center, radiusKm) {
  let inRadius = 0, outside = 0, unknown = 0;
  (leads || []).forEach(lead => {
    const lat = Number(lead?.lat), lng = Number(lead?.lng);
    if (!center || !Number.isFinite(lat) || !Number.isFinite(lng)) { unknown += 1; return; }
    const distance = haversineKm(center, { lat, lng });
    if (!Number.isFinite(distance)) { unknown += 1; return; }
    if (distance <= Number(radiusKm || 5)) inRadius += 1;
    else outside += 1;
  });
  return { total: (leads || []).length, inRadius, outside, unknown };
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
  cache[key] = {
    segment: message.segment,
    term: message.term,
    region: message.region,
    radiusKm: Number(message.radiusKm || 5),
    center: center || previous.center || null,
    updatedAt: Date.now(),
    bestCount: Math.max(Number(previous.bestCount || 0), merged.length),
    leads: merged
  };
  const kept = Object.entries(cache).sort((a,b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0)).slice(0, 30);
  await chrome.storage.local.set({ [MARKET_CACHE_KEY]: Object.fromEntries(kept) });
  return merged;
}

function config(mode) {
  if (mode === "30") return { target: 30, minTasks: 3, maxTasks: 7, concurrency: 2, scanMode: "30" };
  if (mode === "50") return { target: 50, minTasks: 4, maxTasks: 10, concurrency: 2, scanMode: "50" };
  if (mode === "100") return { target: 100, minTasks: 7, maxTasks: 18, concurrency: 3, scanMode: "100" };
  return { target: Infinity, minTasks: 10, maxTasks: 24, concurrency: 3, scanMode: "max" };
}
function buildPlan(queries, points, maxTasks) {
  const q = [...new Set((queries || []).map(v => String(v || "").trim()).filter(Boolean))];
  const p = points.length ? points : [null];
  const plan = [];
  if (!q.length) return plan;
  let round = 0;
  while (plan.length < maxTasks) {
    const query = q[round % q.length];
    const anchor = p[(round * 2 + Math.floor(round / q.length)) % p.length];
    plan.push({ query, anchor });
    round += 1;
    if (round > maxTasks * 2) break;
  }
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
    await sleep(850);
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
  let cursor = 0, completed = 0, stable = 0, lastTotal = leads.length;
  const errors = [];
  let stats = geoStats(leads, center, context.radiusKm);

  await progress({ sessionId: run.id, phase: "discovery", state: "running", current: 0, total: plan.length, percent: 3, accumulated: leads.length, ...stats, text: "Preparando varreduras do Google Maps." });
  emit(run, { event: "BATCH_PROGRESS", stage: "start", current: 0, total: plan.length, accumulated: leads.length, inRadiusCount: stats.inRadius, text: `${message.segment || message.term} · cobertura ${message.targetMode === "max" ? "Máxima" : `${message.targetMode}+`}` });

  async function worker() {
    while (true) {
      if (!runAlive(run)) return;
      const taskIndex = cursor++;
      if (taskIndex >= plan.length) return;
      stats = geoStats(leads, center, context.radiusKm);
      if (completed >= cfg.minTasks && Number.isFinite(cfg.target) && stats.inRadius >= cfg.target) return;
      if (completed >= cfg.minTasks && !Number.isFinite(cfg.target) && stable >= 6) return;
      const task = plan[taskIndex];
      try {
        const result = await scanTask(run, task, taskIndex + 1, plan.length, context, cfg.scanMode);
        if (!runAlive(run)) return;
        leads = await setLeads(merge(leads, result.leads || []));
        const added = Math.max(0, leads.length - lastTotal);
        lastTotal = leads.length;
        stable = added ? 0 : stable + 1;
        completed += 1;
        await saveCached(message, leads, center);
        stats = geoStats(leads, center, context.radiusKm);
        const pct = 5 + Math.min(1, completed / Math.max(1, plan.length)) * 63;
        await progress({ sessionId: run.id, phase: "discovery", state: "running", current: completed, total: plan.length, percent: pct, accumulated: leads.length, ...stats, query: task.query, area: task.anchor?.label || "texto", text: `${leads.length} extraídos · ${stats.inRadius} dentro do raio.` });
        emit(run, { event: "MARKET_PARTIAL", stage: "pass_done", current: completed, total: plan.length, accumulated: leads.length, inRadiusCount: stats.inRadius, outsideCount: stats.outside, unknownCount: stats.unknown, added, query: task.query, area: task.anchor?.label || "texto", metrics: result.metrics || {}, text: `${leads.length} negócios acumulados · ${stats.inRadius} dentro do raio · +${added} nesta varredura.` });
      } catch (error) {
        if (String(error?.message) === "CANCELLED") return;
        completed += 1;
        stable += 1;
        errors.push({ query: task.query, error: error?.message || String(error) });
        stats = geoStats(leads, center, context.radiusKm);
        await progress({ sessionId: run.id, phase: "discovery", state: "running", current: completed, total: plan.length, percent: 5 + Math.min(1, completed / Math.max(1, plan.length)) * 63, accumulated: leads.length, ...stats, text: `Varredura ${completed}/${plan.length}; mantendo ${leads.length} negócios já encontrados.` });
      }
    }
  }

  await Promise.all(Array.from({ length: cfg.concurrency }, () => worker()));
  if (!runAlive(run)) throw new Error("CANCELLED");
  leads = await setLeads(merge(leads, await getLeads()));
  leads = await saveCached(message, leads, center);
  await setLeads(leads);
  stats = geoStats(leads, center, context.radiusKm);
  await progress({ sessionId: run.id, phase: "discovery_done", state: "running", current: completed, total: plan.length, percent: 70, accumulated: leads.length, ...stats, text: `${leads.length} extraídos · ${stats.inRadius} dentro do raio. Iniciando enriquecimento.` });
  emit(run, { event: "BATCH_PROGRESS", stage: "done", current: completed, total: plan.length, accumulated: leads.length, inRadiusCount: stats.inRadius, outsideCount: stats.outside, unknownCount: stats.unknown, text: `${leads.length} negócios consolidados · ${stats.inRadius} dentro do raio.` });
  if (activeRun?.id === run.id) activeRun = null;
  return { leads, context, errors, searchesDone: completed, plannedSearches: plan.length, targetLabel: message.targetMode === "max" ? "Máxima" : `${message.targetMode}+`, bestCount: leads.length, geoStats: stats };
}

async function enrichOne(lead, job) {
  if (!lead?.mapsUrl || !enrichAlive(job)) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  job.tabs.add(tab.id);
  let mergedLead = { ...lead };
  try {
    await waitTab(tab.id, 20000);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    await sleep(950);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!enrichAlive(job)) throw new Error("CANCELLED");
      const response = await sendRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 4).catch(() => null);
      if (response?.ok && response.lead) mergedLead = merge([mergedLead], [response.lead])[0];
      const hasPhone = String(mergedLead.phone || "").replace(/\D/g, "").length >= 10;
      const hasSite = !!String(mergedLead.website || "").trim();
      if (hasPhone && hasSite) break;
      if (attempt < 2) await sleep(850 + attempt * 500);
    }
    return { ...mergedLead, enrichmentAttemptedAt: new Date().toISOString() };
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
  const queue = leads
    .map((lead, index) => ({ lead, index, score: (!lead.phone ? 100 : 0) + (!lead.website ? 35 : 0) + (!lead.hours ? 10 : 0) }))
    .filter(x => x.lead?.mapsUrl && x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, Math.min(Number(limit || leads.length || 60), 300));
  let cursor = 0, done = 0;
  const initialPhones = leads.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const initialSites = leads.filter(x => String(x.website || "").trim()).length;
  await progress({ sessionId: job.id, phase: "enrich", state: "running", current: 0, total: queue.length, percent: 70, accumulated: leads.length, phoneCount: initialPhones, siteCount: initialSites, text: `Completando ${queue.length} fichas em 3 abas paralelas.` });

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
      const phoneCount = leads.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
      const siteCount = leads.filter(x => String(x.website || "").trim()).length;
      const pct = 70 + Math.min(1, done / Math.max(1, queue.length)) * 30;
      await progress({ sessionId: job.id, phase: "enrich", state: done >= queue.length ? "done" : "running", current: done, total: queue.length, percent: pct, accumulated: leads.length, phoneCount, siteCount, text: `${done}/${queue.length} fichas · ${phoneCount} telefones · ${siteCount} sites.` });
      emit(job, { event: "ENRICH_PROGRESS", current: done, total: queue.length, accumulated: leads.length, phoneCount, siteCount, lead: leads[item.index] });
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, Math.max(1, queue.length)) }, () => worker()));
  if (!enrichAlive(job)) throw new Error("CANCELLED");
  const final = await setLeads(leads);
  const phoneCount = final.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const siteCount = final.filter(x => String(x.website || "").trim()).length;
  await progress({ sessionId: job.id, phase: "done", state: "done", current: queue.length, total: queue.length, percent: 100, accumulated: final.length, phoneCount, siteCount, text: `${final.length} negócios · ${phoneCount} com telefone · ${siteCount} com site.` });
  if (activeEnrich?.id === job.id) activeEnrich = null;
  return final;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.cmd === "SITE_ENRICH_ONE") return;
  if (message?.cmd === "CANCEL_MARKET_SEARCH") {
    cancelAll("user-replaced").then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.cmd === "RUN_MARKET_SEARCH_V5") {
    runMarket(message).then(result => sendResponse({ ok: true, ...result })).catch(error => sendResponse({ ok: false, cancelled: error?.message === "CANCELLED", error: error?.message || String(error) }));
    return true;
  }
  if (message?.cmd === "GET_STATE") {
    Promise.all([getLeads(), chrome.storage.local.get(PROGRESS_KEY)]).then(([leads, p]) => sendResponse({ ok: true, leads, progress: p[PROGRESS_KEY] || null, sessionId: activeRun?.id || activeEnrich?.id || "" })).catch(error => sendResponse({ ok: false, error: error.message }));
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
    cancelAll("clear").then(() => Promise.all([setLeads([]), chrome.storage.local.remove(PROGRESS_KEY)])).then(() => sendResponse({ ok: true, leads: [] })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
