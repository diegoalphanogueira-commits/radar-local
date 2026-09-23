importScripts("site-enrichment.js", "export-handler-v3.js");

const STORAGE_KEY = "radarMapsCollectorLeadsV3";
const MARKET_CACHE_KEY = "radarSingleTabCoverageV2";
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

async function waitTab(tabId, timeout = 25000) {
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
    const params = new URLSearchParams({ q: `${q}, Brasil`, format: "jsonv2", limit: "5", countrycodes: "br" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
    const rows = response.ok ? await response.json() : [];
    const first = rows?.[0];
    const lat = Number(first?.lat), lng = Number(first?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, source: "geocode", displayName: first.display_name || q } : null;
  } catch { return null; }
}
function zoom(radius) { return radius <= 2 ? 15 : radius <= 5 ? 14 : radius <= 9 ? 13 : 12; }
function offsetPoint(center, eastKm = 0, northKm = 0) {
  if (!center) return null;
  const lat = Number(center.lat), lng = Number(center.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const dLat = northKm / 110.574;
  const cos = Math.max(0.25, Math.cos(lat * Math.PI / 180));
  const dLng = eastKm / (111.320 * cos);
  return { lat: lat + dLat, lng: lng + dLng };
}
function coverageAnchors(center, radiusKm, mode) {
  if (!center) return [{ ...center, label: "região" }].filter(Boolean);
  const radius = Math.max(1, Number(radiusKm || 5));
  const d = Math.min(2.8, Math.max(0.55, radius * 0.42));
  const centerPoint = { ...center, label: "centro" };
  if (mode === "30") return [centerPoint];
  if (mode === "50") return [
    centerPoint,
    { ...offsetPoint(center, d, 0), label: "leste" },
    { ...offsetPoint(center, -d, 0), label: "oeste" }
  ];
  return [
    centerPoint,
    { ...offsetPoint(center, d, d), label: "nordeste" },
    { ...offsetPoint(center, -d, d), label: "noroeste" },
    { ...offsetPoint(center, d, -d), label: "sudeste" },
    { ...offsetPoint(center, -d, -d), label: "sudoeste" }
  ];
}
function mapsUrl(term, region, center, radiusKm) {
  const query = `${String(term || "").trim()} ${String(region || "").trim()}`.trim();
  if (center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng))) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${Number(center.lat)},${Number(center.lng)},${zoom(radiusKm)}z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
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
  return { total:(leads || []).length, inRadius, outside, unknown };
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
    term:message.term,
    region:message.region,
    radiusKm:Number(message.radiusKm || 5),
    center:center || previous.center || null,
    updatedAt:Date.now(),
    bestCount:Math.max(Number(previous.bestCount || 0), merged.length),
    leads:merged
  };
  const kept = Object.entries(cache).sort((a,b) => Number(b[1]?.updatedAt || 0)-Number(a[1]?.updatedAt || 0)).slice(0,30);
  await chrome.storage.local.set({ [MARKET_CACHE_KEY]:Object.fromEntries(kept) });
  return merged;
}

async function scanSameTab(tabId, run, message, anchor, pass, totalPasses, mode) {
  if (!runAlive(run)) throw new Error("CANCELLED");
  run.discoveryPass = pass;
  run.discoveryPasses = totalPasses;
  run.discoveryLabel = anchor?.label || "região";
  const url = mapsUrl(message.term, message.region, anchor || run.center, Number(message.radiusKm || 5));
  await chrome.tabs.update(tabId, { url, active:false });
  await waitTab(tabId, 25000);
  if (!runAlive(run)) throw new Error("CANCELLED");
  await sleep(900);
  emit(run, { event:"SEARCH_PROGRESS", stage:"opening", current:pass, total:totalPasses, query:message.term, area:run.discoveryLabel, text:`Varredura ${pass}/${totalPasses} · ${run.discoveryLabel}` });
  const scanMode = pass === 1 ? mode : (mode === "max" ? "50" : "30");
  const response = await sendRetry(tabId, { cmd:"SCAN_SCROLL", mode:scanMode, sessionId:run.id }, 5);
  if (!response?.ok) throw new Error(response?.error || "SCAN_FAILED");
  return response;
}

async function runMarket(message) {
  await cancelAll("new-search");
  const run = { id:String(message.sessionId || `run-${Date.now()}`), cancelled:false, tabs:new Set(), term:message.term, region:message.region, discoveryPass:1, discoveryPasses:1 };
  activeRun = run;
  const center = await geocode(message.region);
  run.center = center;
  const context = { region:message.region, radiusKm:Number(message.radiusKm || 5), center };
  const cached = await getCached(message);
  let leads = merge(cached?.leads || [], message.seedLeads || []);
  await setLeads(leads);

  const mode = ["30","50","100","max"].includes(String(message.targetMode)) ? String(message.targetMode) : "50";
  const anchors = coverageAnchors(center, context.radiusKm, mode);
  const totalPasses = Math.max(1, anchors.length);
  await setProgress({ sessionId:run.id, phase:"discovery", state:"running", current:0, total:totalPasses, percent:3, accumulated:leads.length, ...geoStats(leads,center,context.radiusKm), text:`Carregando “${message.term}” até o fim e cobrindo toda a região na mesma aba.` });

  const firstUrl = mapsUrl(message.term, message.region, anchors[0] || center, context.radiusKm);
  const tab = await chrome.tabs.create({ url:firstUrl, active:false });
  run.tabs.add(tab.id);
  let scansDone = 0;
  const scanMetrics = [];
  try {
    for (let index = 0; index < anchors.length; index += 1) {
      if (!runAlive(run)) throw new Error("CANCELLED");
      const anchor = anchors[index];
      let response;
      if (index === 0) {
        run.discoveryPass = 1;
        run.discoveryPasses = totalPasses;
        run.discoveryLabel = anchor?.label || "centro";
        await waitTab(tab.id, 25000);
        await sleep(900);
        response = await sendRetry(tab.id, { cmd:"SCAN_SCROLL", mode, sessionId:run.id }, 5);
      } else {
        response = await scanSameTab(tab.id, run, message, anchor, index + 1, totalPasses, mode);
      }
      if (!response?.ok) continue;
      const before = leads.length;
      leads = await setLeads(merge(leads, response.leads || []));
      leads = await saveCached(message, leads, center);
      const added = Math.max(0, leads.length - before);
      scansDone += 1;
      scanMetrics.push({ area:anchor?.label || "região", added, unique:response.metrics?.unique || 0, stopReason:response.metrics?.stopReason || "" });
      const stats = geoStats(leads, center, context.radiusKm);
      const percent = 5 + Math.round((scansDone / totalPasses) * 63);
      await setProgress({ sessionId:run.id, phase:"discovery", state:"running", current:scansDone, total:totalPasses, percent, accumulated:leads.length, ...stats, text:`${leads.length} empresas únicas · ${stats.inRadius} dentro do raio · +${added} na área ${anchor?.label || "região"}.` });
      emit(run, { event:"MARKET_PARTIAL", current:scansDone, total:totalPasses, accumulated:leads.length, inRadiusCount:stats.inRadius, added, area:anchor?.label || "região", text:`${leads.length} únicas · +${added} nesta área.` });
    }
  } finally {
    run.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }

  leads = await setLeads(merge(leads, await getLeads()));
  leads = await saveCached(message, leads, center);
  const stats = geoStats(leads, center, context.radiusKm);
  await setProgress({ sessionId:run.id, phase:"discovery_done", state:"running", current:totalPasses, total:totalPasses, percent:70, accumulated:leads.length, ...stats, text:`Descoberta concluída: ${leads.length} empresas únicas. Agora completando telefone e site.` });
  emit(run, { event:"BATCH_PROGRESS", stage:"done", current:totalPasses, total:totalPasses, accumulated:leads.length, inRadiusCount:stats.inRadius, text:`${leads.length} empresas únicas após cobertura espacial na mesma aba.` });
  if (activeRun?.id === run.id) activeRun = null;
  return { leads, context, errors:[], searchesDone:scansDone, plannedSearches:totalPasses, bestCount:leads.length, geoStats:stats, scanMetrics };
}

async function enrichOne(lead, job) {
  if (!lead?.mapsUrl || !enrichAlive(job)) return lead;
  const tab = await chrome.tabs.create({ url:lead.mapsUrl, active:false });
  job.tabs.add(tab.id);
  let mergedLead = { ...lead };
  try {
    await waitTab(tab.id, 14000);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    await sleep(550);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!enrichAlive(job)) throw new Error("CANCELLED");
      const response = await sendRetry(tab.id, { cmd:"EXTRACT_DETAIL" }, 3).catch(() => null);
      if (response?.ok && response.lead) mergedLead = merge([mergedLead],[response.lead])[0];
      const hasPhone = String(mergedLead.phone || "").replace(/\D/g, "").length >= 10;
      const siteChecked = Object.prototype.hasOwnProperty.call(mergedLead, "website");
      if (hasPhone && siteChecked) break;
      if (attempt < 1) await sleep(650);
    }
    return { ...mergedLead, detailCheckedAt:new Date().toISOString() };
  } finally {
    job.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function enrichAll(limit = 300, sessionId = "") {
  await cancelEnrich("new-enrich");
  const job = { id:String(sessionId || `enrich-${Date.now()}`), cancelled:false, tabs:new Set() };
  activeEnrich = job;
  let leads = await getLeads();
  const queue = leads
    .map((lead,index) => ({
      lead,
      index,
      score:(!String(lead.phone || "").trim() ? 100 : 0) + (!String(lead.website || "").trim() ? 35 : 0)
    }))
    .filter(item => item.lead?.mapsUrl && item.score > 0)
    .sort((a,b) => b.score-a.score)
    .slice(0, Math.min(Number(limit || leads.length || 300), 300));

  let cursor = 0, done = 0;
  const phoneCount0 = leads.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const siteCount0 = leads.filter(x => String(x.website || "").trim()).length;
  await setProgress({ sessionId:job.id, phase:"enrich", state:"running", current:0, total:queue.length, percent:70, accumulated:leads.length, phoneCount:phoneCount0, siteCount:siteCount0, text:`Completando telefone e site em até 5 fichas paralelas.` });

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

  const workers = Math.min(5, Math.max(1, queue.length));
  await Promise.all(Array.from({ length:workers }, () => worker()));
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
    const local = Math.max(0, Math.min(1, Number(message.percent || 5) / 68));
    const pass = Math.max(1, Number(run.discoveryPass || 1));
    const total = Math.max(1, Number(run.discoveryPasses || 1));
    const overall = 5 + (((pass - 1) + local) / total) * 63;
    setProgress({ sessionId:run.id, phase:"discovery", state:"running", current:pass, total, percent:overall, accumulated:Number(message.unique || 0), text:`Área ${run.discoveryLabel || "região"}: ${Number(message.unique || 0)} empresas carregadas nesta lista.` }).catch(() => {});
    emit(run, { event:"BATCH_PROGRESS", stage:"scanning", current:pass, total, accumulated:Number(message.unique || 0), area:run.discoveryLabel || "região", text:`Carregando ${run.discoveryLabel || "região"} · ${Number(message.unique || 0)} perfis vistos.` });
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
