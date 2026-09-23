importScripts("site-enrichment.js", "export-handler-v3.js");

const STORAGE_KEY = "radarMapsCollectorLeadsV3";
const MARKET_CACHE_KEY = "radarSingleFeedCoverageV1";
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
async function setProgress(patch = {}) {
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
  try { const tab = await chrome.tabs.get(tabId); if (tab?.status === "complete") return; } catch {}
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
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response) return response;
    } catch (error) { last = error; }
    await sleep(450 + i * 250);
  }
  throw last || new Error("CONTENT_SCRIPT_UNAVAILABLE");
}

async function geocode(region) {
  const q = String(region || "").trim();
  if (!q) return null;
  try {
    const params = new URLSearchParams({ q: `${q}, Brasil`, format: "jsonv2", limit: "3", countrycodes: "br" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
    const rows = response.ok ? await response.json() : [];
    const first = rows?.[0];
    const lat = Number(first?.lat), lng = Number(first?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, source: "geocode", displayName: first.display_name || q } : null;
  } catch { return null; }
}
function zoom(radius) { return radius <= 2 ? 15 : radius <= 5 ? 14 : radius <= 9 ? 13 : 12; }
function mapsUrl(term, context) {
  const query = String(term || "").trim();
  if (context.center) return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${context.center.lat},${context.center.lng},${zoom(context.radiusKm)}z`;
  return `https://www.google.com/maps/search/${encodeURIComponent(`${query} ${context.region}`.trim())}`;
}
function haversineKm(a, b) {
  if (!a || !b) return null;
  const values = [a.lat,a.lng,b.lat,b.lng].map(Number);
  if (!values.every(Number.isFinite)) return null;
  const [lat1,lng1,lat2,lng2] = values, rad = n => n * Math.PI / 180;
  const dLat = rad(lat2-lat1), dLng = rad(lng2-lng1);
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

function marketKey(message) {
  return `${norm(message.term)}|${norm(message.region)}|${Number(message.radiusKm || 5)}`;
}
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
    term: message.term,
    region: message.region,
    radiusKm: Number(message.radiusKm || 5),
    center: center || previous.center || null,
    updatedAt: Date.now(),
    bestCount: Math.max(Number(previous.bestCount || 0), merged.length),
    leads: merged
  };
  const kept = Object.entries(cache).sort((a,b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0)).slice(0,30);
  await chrome.storage.local.set({ [MARKET_CACHE_KEY]: Object.fromEntries(kept) });
  return merged;
}

async function runMarket(message) {
  await cancelAll("new-search");
  const run = { id: String(message.sessionId || `run-${Date.now()}`), cancelled: false, tabs: new Set(), term: message.term, region: message.region };
  activeRun = run;
  const center = await geocode(message.region);
  const context = { region: message.region, radiusKm: Number(message.radiusKm || 5), center };
  const cached = await getCached(message);
  let leads = merge(cached?.leads || [], message.seedLeads || []);
  await setLeads(leads);

  const mode = ["30","50","100","max"].includes(String(message.targetMode)) ? String(message.targetMode) : "50";
  await setProgress({ sessionId:run.id, phase:"discovery", state:"running", current:0, total:1, percent:4, accumulated:leads.length, ...geoStats(leads,center,context.radiusKm), text:`Abrindo uma única busca de “${message.term}” e carregando a lista até o fim.` });
  emit(run, { event:"BATCH_PROGRESS", stage:"start", current:0, total:1, accumulated:leads.length, text:`Uma única busca: ${message.term}. Carregando a lista completa.` });

  const tab = await chrome.tabs.create({ url: mapsUrl(message.term, context), active: false });
  run.tabs.add(tab.id);
  let result;
  try {
    await waitTab(tab.id, 22000);
    if (!runAlive(run)) throw new Error("CANCELLED");
    await sleep(900);
    result = await sendRetry(tab.id, { cmd:"SCAN_SCROLL", mode, sessionId:run.id }, 5);
    if (!result?.ok) throw new Error(result?.error || "SCAN_FAILED");
    if (!runAlive(run)) throw new Error("CANCELLED");
  } finally {
    run.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }

  leads = await setLeads(merge(leads, result?.leads || []));
  leads = await saveCached(message, leads, center);
  await setLeads(leads);
  const stats = geoStats(leads, center, context.radiusKm);
  await setProgress({ sessionId:run.id, phase:"discovery_done", state:"running", current:1, total:1, percent:70, accumulated:leads.length, ...stats, text:`Lista principal concluída: ${leads.length} empresas únicas encontradas. Agora completando fichas.` });
  emit(run, { event:"BATCH_PROGRESS", stage:"done", current:1, total:1, accumulated:leads.length, inRadiusCount:stats.inRadius, text:`${leads.length} empresas únicas encontradas na lista principal.` });

  if (activeRun?.id === run.id) activeRun = null;
  return { leads, context, errors:[], searchesDone:1, plannedSearches:1, bestCount:leads.length, geoStats:stats, scanMetrics:result?.metrics || {} };
}

async function enrichOne(lead, job) {
  if (!lead?.mapsUrl || !enrichAlive(job)) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active:false });
  job.tabs.add(tab.id);
  let mergedLead = { ...lead };
  try {
    await waitTab(tab.id, 20000);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    await sleep(950);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!enrichAlive(job)) throw new Error("CANCELLED");
      const response = await sendRetry(tab.id, { cmd:"EXTRACT_DETAIL" }, 4).catch(() => null);
      if (response?.ok && response.lead) mergedLead = merge([mergedLead],[response.lead])[0];
      const hasPhone = String(mergedLead.phone || "").replace(/\D/g, "").length >= 10;
      const hasSite = !!String(mergedLead.website || "").trim();
      if (hasPhone && hasSite) break;
      if (attempt < 2) await sleep(850 + attempt * 500);
    }
    return { ...mergedLead, enrichmentAttemptedAt:new Date().toISOString() };
  } finally {
    job.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}
async function enrichAll(limit = 60, sessionId = "") {
  await cancelEnrich("new-enrich");
  const job = { id:String(sessionId || `enrich-${Date.now()}`), cancelled:false, tabs:new Set() };
  activeEnrich = job;
  let leads = await getLeads();
  const queue = leads
    .map((lead,index) => ({ lead,index,score:(!lead.phone?100:0)+(!lead.website?35:0)+(!lead.hours?10:0) }))
    .filter(x => x.lead?.mapsUrl && x.score > 0)
    .sort((a,b) => b.score-a.score)
    .slice(0, Math.min(Number(limit || leads.length || 60), 300));
  let cursor = 0, done = 0;
  await setProgress({ sessionId:job.id, phase:"enrich", state:"running", current:0, total:queue.length, percent:70, accumulated:leads.length, phoneCount:leads.filter(x=>String(x.phone||"").replace(/\D/g,"").length>=10).length, siteCount:leads.filter(x=>String(x.website||"").trim()).length, text:`Completando ${queue.length} fichas em 3 abas paralelas.` });

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
      const percent = 70 + Math.min(1, done / Math.max(1, queue.length)) * 30;
      await setProgress({ sessionId:job.id, phase:"enrich", state:done>=queue.length?"done":"running", current:done, total:queue.length, percent, accumulated:leads.length, phoneCount, siteCount, text:`${done}/${queue.length} fichas · ${phoneCount} telefones · ${siteCount} sites.` });
      emit(job, { event:"ENRICH_PROGRESS", current:done, total:queue.length, accumulated:leads.length, phoneCount, siteCount, lead:leads[item.index] });
    }
  }

  await Promise.all(Array.from({ length:Math.min(3,Math.max(1,queue.length)) }, () => worker()));
  if (!enrichAlive(job)) throw new Error("CANCELLED");
  const final = await setLeads(leads);
  const phoneCount = final.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const siteCount = final.filter(x => String(x.website || "").trim()).length;
  await setProgress({ sessionId:job.id, phase:"done", state:"done", current:queue.length, total:queue.length, percent:100, accumulated:final.length, phoneCount, siteCount, text:`${final.length} negócios · ${phoneCount} com telefone · ${siteCount} com site.` });
  if (activeEnrich?.id === job.id) activeEnrich = null;
  return final;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.cmd === "SITE_ENRICH_ONE") return;

  if (message?.cmd === "SCAN_FEED_PROGRESS") {
    if (!activeRun || message.sessionId !== activeRun.id || activeRun.cancelled) return;
    const run = activeRun;
    const percent = Math.max(5, Math.min(68, Number(message.percent || 5)));
    setProgress({ sessionId:run.id, phase:"discovery", state:"running", current:Number(message.round || 0), total:Number(message.rounds || 0), percent, accumulated:Number(message.unique || 0), text:`${Number(message.unique || 0)} empresas únicas carregadas na lista principal.` }).catch(() => {});
    emit(run, { event:"BATCH_PROGRESS", stage:"scanning", current:Number(message.round || 0), total:Number(message.rounds || 0), accumulated:Number(message.unique || 0), text:`${Number(message.unique || 0)} empresas únicas carregadas.` });
    return;
  }

  if (message?.cmd === "CANCEL_MARKET_SEARCH") {
    cancelAll("user-replaced").then(() => sendResponse({ ok:true })).catch(error => sendResponse({ ok:false,error:error.message }));
    return true;
  }
  if (message?.cmd === "RUN_MARKET_SEARCH_V5") {
    runMarket(message).then(result => sendResponse({ ok:true,...result })).catch(error => sendResponse({ ok:false,cancelled:error?.message==="CANCELLED",error:error?.message||String(error) }));
    return true;
  }
  if (message?.cmd === "GET_STATE") {
    Promise.all([getLeads(), chrome.storage.local.get(PROGRESS_KEY)]).then(([leads,p]) => sendResponse({ ok:true,leads,progress:p[PROGRESS_KEY]||null,sessionId:activeRun?.id||activeEnrich?.id||"" })).catch(error => sendResponse({ ok:false,error:error.message }));
    return true;
  }
  if (message?.cmd === "STORE_LEADS") {
    setLeads(message.leads || []).then(leads => sendResponse({ ok:true,leads })).catch(error => sendResponse({ ok:false,error:error.message }));
    return true;
  }
  if (message?.cmd === "ENRICH_ALL") {
    enrichAll(message.limit,message.sessionId).then(leads => sendResponse({ ok:true,leads })).catch(error => sendResponse({ ok:false,cancelled:error?.message==="CANCELLED",error:error.message }));
    return true;
  }
  if (message?.cmd === "CLEAR") {
    cancelAll("clear").then(() => Promise.all([setLeads([]),chrome.storage.local.remove(PROGRESS_KEY)])).then(() => sendResponse({ ok:true,leads:[] })).catch(error => sendResponse({ ok:false,error:error.message }));
    return true;
  }
});
