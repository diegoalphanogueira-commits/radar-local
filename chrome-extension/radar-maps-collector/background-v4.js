/* Radar Maps Collector — V1 RC13 / Single Discovery Engine */
importScripts("site-enrichment.js");

const STORAGE_KEY = "radarMapsCollectorLeadsV3";
const MARKET_CACHE_KEY = "radarMarketCoverageV3";
const MARKET_CACHE_TTL = 45 * 24 * 60 * 60 * 1000;
const MARKET_CACHE_MAX = 30;
const MARKET_LEAD_MAX = 700;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
}

function sanitizeLead(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const lead = { ...raw };
  if (lead.coordSource === "detail-camera") {
    lead.lat = null;
    lead.lng = null;
  }
  return lead;
}

function leadKey(lead) {
  const url = String(lead?.mapsUrl || "").split("?")[0].replace(/\/$/, "");
  if (url) return url;
  return normalizeText(`${lead?.name || ""}|${lead?.address || ""}|${lead?.phone || ""}`);
}

function mergeLeads(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].forEach(raw => {
    const lead = sanitizeLead(raw);
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

async function getLeads() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setLeads(leads) {
  const clean = mergeLeads([], Array.isArray(leads) ? leads : []).slice(0, MARKET_LEAD_MAX);
  await chrome.storage.local.set({ [STORAGE_KEY]: clean });
  return clean;
}

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function waitForTabComplete(tabId, timeoutMs = 35000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tab => { if (tab?.status === "complete") finish(); }).catch(() => {});
    setTimeout(finish, timeoutMs);
  });
}

async function sendToTabWithRetry(tabId, message, attempts = 7) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(750 + i * 350);
  }
  throw lastError || new Error("CONTENT_SCRIPT_UNAVAILABLE");
}

async function geocodeRegion(region) {
  const query = String(region || "").trim();
  if (!query) return null;
  const expanded = /brasil/i.test(query) ? query : `${query}, São Paulo, Brasil`;
  try {
    const params = new URLSearchParams({ q: expanded, format: "jsonv2", limit: "5", countrycodes: "br", addressdetails: "1" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const rows = await response.json();
    const tokens = normalizeText(query).split(" ").filter(token => token.length >= 3 && !["jardim","jd","vila","bairro","sp","sao"].includes(token));
    const ranked = (Array.isArray(rows) ? rows : []).map(row => {
      const hay = normalizeText(row?.display_name || "");
      return { row, score: tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score);
    const best = ranked[0]?.row;
    const lat = Number(best?.lat);
    const lng = Number(best?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: best.display_name || query, source: "geocode" };
  } catch (error) {
    console.warn("[Radar V3] geocode", error);
    return null;
  }
}

function offsetPoint(center, eastKm = 0, northKm = 0) {
  if (!center) return null;
  const lat = Number(center.lat);
  const lng = Number(center.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const dLat = northKm / 110.574;
  const cos = Math.max(.25, Math.cos(lat * Math.PI / 180));
  const dLng = eastKm / (111.320 * cos);
  return { lat: lat + dLat, lng: lng + dLng };
}

function anchorsFor(center, radiusKm) {
  if (!center) return [null];
  const radius = Math.max(1, Number(radiusKm || 5) || 5);
  const offset = Math.min(3.4, Math.max(1, radius * .48));
  return [
    { ...center, label: "centro" },
    { ...offsetPoint(center, 0, offset), label: "norte" },
    { ...offsetPoint(center, offset, 0), label: "leste" },
    { ...offsetPoint(center, 0, -offset), label: "sul" },
    { ...offsetPoint(center, -offset, 0), label: "oeste" },
    { ...offsetPoint(center, offset, offset), label: "nordeste" },
    { ...offsetPoint(center, -offset, offset), label: "noroeste" },
    { ...offsetPoint(center, offset, -offset), label: "sudeste" },
    { ...offsetPoint(center, -offset, -offset), label: "sudoeste" }
  ];
}

function zoomForRadius(radiusKm) {
  const radius = Number(radiusKm || 5) || 5;
  if (radius <= 2) return 15;
  if (radius <= 5) return 14;
  if (radius <= 9) return 13;
  return 12;
}

function stripRegionFromQuery(query, region) {
  const raw = String(query || "").trim();
  const place = String(region || "").trim();
  if (!place) return raw;
  const lowerRaw = raw.toLocaleLowerCase("pt-BR");
  const lowerPlace = place.toLocaleLowerCase("pt-BR");
  if (lowerRaw.endsWith(lowerPlace)) return raw.slice(0, raw.length - place.length).trim();
  const first = place.split(",")[0]?.trim();
  if (first && lowerRaw.endsWith(first.toLocaleLowerCase("pt-BR"))) return raw.slice(0, raw.length - first.length).trim();
  return raw;
}

function buildMapsUrl(query, context, anchor) {
  const raw = String(query || "").trim();
  const center = anchor || context.center;
  if (center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng))) {
    const term = stripRegionFromQuery(raw, context.region) || raw;
    return `https://www.google.com/maps/search/${encodeURIComponent(term)}/@${Number(center.lat)},${Number(center.lng)},${zoomForRadius(context.radiusKm)}z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(raw)}`;
}

async function runSearch(query, context, anchor, index, total, maxScrolls) {
  const anchorLabel = anchor?.label || "texto";
  broadcast({ event: "BATCH_PROGRESS", stage: "searching", current: index, total, query, text: `Varredura ${index}/${total} · ${anchorLabel} · ${query}` });
  broadcast({ event: "SEARCH_PROGRESS", stage: "opening", query, pass: index, totalPasses: total, text: `Abrindo ${anchorLabel}: ${query}` });

  const tab = await chrome.tabs.create({ url: buildMapsUrl(query, context, anchor), active: false });
  try {
    await waitForTabComplete(tab.id, 40000);
    await sleep(2200 + Math.round(Math.random() * 850));
    const response = await sendToTabWithRetry(tab.id, { cmd: "SCAN_SCROLL", maxScrolls }, 7);
    if (!response?.ok) throw new Error(response?.error || "Falha ao ler resultados do Maps.");

    const found = mergeLeads([], response.leads || []);
    const before = await getLeads();
    const merged = await setLeads(mergeLeads(before, found));
    const added = Math.max(0, merged.length - before.length);

    broadcast({
      event: "SEARCH_PROGRESS",
      stage: "done",
      query,
      count: found.length,
      added,
      accumulated: merged.length,
      metrics: response.metrics || {},
      text: `${found.length} vistos nesta varredura · ${added} novos · ${merged.length} únicos acumulados.`
    });
    return { leads: merged, found, added, metrics: response.metrics || {} };
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function loadMarketCache() {
  const data = await chrome.storage.local.get(MARKET_CACHE_KEY);
  const raw = data[MARKET_CACHE_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

async function saveMarketCache(cache) {
  const now = Date.now();
  const entries = Object.entries(cache || {})
    .filter(([, entry]) => entry && Number(entry.updatedAt || 0) >= now - MARKET_CACHE_TTL)
    .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
    .slice(0, MARKET_CACHE_MAX);
  await chrome.storage.local.set({ [MARKET_CACHE_KEY]: Object.fromEntries(entries) });
}

function marketKey(message) {
  return `${normalizeText(message.segment || message.term || "mercado")}|${normalizeText(message.region || "")}|${Number(message.radiusKm || 5) || 5}`;
}

async function getMarketEntry(key) {
  const cache = await loadMarketCache();
  return cache[key] || null;
}

async function putMarketEntry(key, message, leads, context, stats = {}) {
  const cache = await loadMarketCache();
  const previous = cache[key] || {};
  const merged = mergeLeads(previous.leads || [], leads || []).slice(0, MARKET_LEAD_MAX);
  cache[key] = {
    key,
    term: String(message.term || "").trim(),
    segment: String(message.segment || "").trim(),
    region: String(message.region || "").trim(),
    radiusKm: Number(message.radiusKm || 5) || 5,
    center: context.center || previous.center || null,
    bestCount: Math.max(Number(previous.bestCount || 0), merged.length),
    updatedAt: Date.now(),
    stats: { ...(previous.stats || {}), ...stats },
    leads: merged
  };
  await saveMarketCache(cache);
  return cache[key];
}

function buildPlan(queries, anchors) {
  const clean = [...new Set((queries || []).map(v => String(v || "").trim()).filter(Boolean))].slice(0, 12);
  if (!clean.length) return [];
  const points = anchors.length ? anchors : [null];
  const plan = [];

  points.forEach(anchor => plan.push({ query: clean[0], anchor }));
  if (clean[1]) [0,1,2,3,4].forEach(i => plan.push({ query: clean[1], anchor: points[i % points.length] }));
  clean.slice(2).forEach((query, index) => {
    plan.push({ query, anchor: points[(index * 2 + 5) % points.length] });
    if (points.length > 1) plan.push({ query, anchor: points[(index * 2 + 7) % points.length] });
  });
  return plan;
}

function targetConfig(raw) {
  const value = String(raw || "max").toLowerCase();
  if (value === "30") return { count: 30, label: "30+", minSearches: 5 };
  if (value === "50") return { count: 50, label: "50+", minSearches: 7 };
  if (value === "100") return { count: 100, label: "100+", minSearches: 10 };
  return { count: Infinity, label: "Máxima", minSearches: 14 };
}

function haversineKm(a, b) {
  const R = 6371;
  const rad = value => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function usefulCount(leads, center, radiusKm) {
  if (!center) return leads.length;
  return leads.filter(lead => {
    const lat = Number(lead?.lat ?? lead?.latitude);
    const lng = Number(lead?.lng ?? lead?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    return haversineKm(center, { lat, lng }) <= Number(radiusKm || 5);
  }).length;
}

async function runMarketSearch(message) {
  const region = String(message.region || "").trim();
  const radiusKm = Math.max(1, Number(message.radiusKm || 5) || 5);
  const queries = [...new Set((message.queries || []).map(v => String(v || "").trim()).filter(Boolean))].slice(0, 12);
  if (!region || !queries.length) throw new Error("Informe segmento e região.");

  const context = { region, radiusKm, center: await geocodeRegion(region) };
  const key = marketKey(message);
  const previous = await getMarketEntry(key);
  const seed = mergeLeads(previous?.leads || [], message.seedLeads || []).slice(0, MARKET_LEAD_MAX);
  await setLeads(seed);

  const plan = buildPlan(queries, anchorsFor(context.center, radiusKm));
  const target = targetConfig(message.targetMode);
  const maxScrolls = Math.max(80, Math.min(Number(message.maxScrolls) || 110, 150));
  let stable = 0;
  let lastCount = seed.length;
  let searchesDone = 0;
  let freshSeen = 0;
  const errors = [];

  broadcast({ event: "BATCH_PROGRESS", stage: "coverage_start", current: 0, total: plan.length, text: `Cobertura ${target.label} · ${seed.length} negócios já conhecidos.` });

  for (let i = 0; i < plan.length; i += 1) {
    const item = plan[i];
    try {
      const result = await runSearch(item.query, context, item.anchor, i + 1, plan.length, maxScrolls);
      searchesDone += 1;
      freshSeen += result.found.length;
      const current = await getLeads();
      const added = Math.max(0, current.length - lastCount);
      stable = added ? 0 : stable + 1;
      lastCount = current.length;
      await putMarketEntry(key, message, current, context, { searchesDone, freshSeen, lastAdded: added });

      const usable = usefulCount(current, context.center, radiusKm);
      broadcast({
        event: "BATCH_PROGRESS",
        stage: "pass_done",
        current: i + 1,
        total: plan.length,
        query: item.query,
        accumulated: current.length,
        usefulCount: usable,
        targetLabel: target.label,
        text: `${current.length} negócios acumulados · ${added} novos · cobertura ${target.label}.`
      });

      if (Number.isFinite(target.count) && searchesDone >= target.minSearches && usable >= target.count) break;
      if (!Number.isFinite(target.count) && searchesDone >= target.minSearches && stable >= 8) break;
    } catch (error) {
      errors.push({ query: item.query, area: item.anchor?.label || "texto", error: error?.message || "SEARCH_FAILED" });
      stable += 1;
      console.warn("[Radar V3]", item.query, error);
    }
    await sleep(600 + Math.round(Math.random() * 450));
  }

  const leads = await setLeads(mergeLeads(seed, await getLeads()));
  const entry = await putMarketEntry(key, message, leads, context, { searchesDone, freshSeen, errors: errors.length, completedAt: new Date().toISOString() });
  const usable = usefulCount(leads, context.center, radiusKm);

  broadcast({
    event: "BATCH_PROGRESS",
    stage: "done",
    current: searchesDone,
    total: plan.length,
    accumulated: leads.length,
    usefulCount: usable,
    targetLabel: target.label,
    text: `${leads.length} negócios consolidados · ${usable} no raio ou aguardando coordenada segura.`
  });

  return {
    leads,
    errors,
    queries,
    context,
    targetLabel: target.label,
    searchesDone,
    plannedSearches: plan.length,
    freshSeen,
    usefulCount: usable,
    cacheHit: !!previous,
    bestCount: Number(entry?.bestCount || leads.length)
  };
}

async function enrichOne(rawLead) {
  const lead = sanitizeLead(rawLead);
  if (!lead?.mapsUrl) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  try {
    await waitForTabComplete(tab.id, 26000);
    await sleep(1300 + Math.round(Math.random() * 600));
    const response = await sendToTabWithRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 5).catch(() => null);
    if (!response?.ok || !response.lead) return lead;
    return mergeLeads([lead], [sanitizeLead(response.lead)])[0];
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

function enrichmentPriority(lead) {
  let score = 0;
  if (!String(lead?.phone || "").trim()) score += 100;
  if (!String(lead?.website || "").trim()) score += 35;
  if (!String(lead?.hours || "").trim()) score += 10;
  if (!String(lead?.address || "").trim()) score += 8;
  return score;
}

async function enrichAll(limit = 60, concurrency = 3) {
  let leads = await getLeads();
  const max = Math.max(1, Math.min(Number(limit) || 60, 150));
  const queue = leads
    .map((lead, index) => ({ lead, index, priority: enrichmentPriority(lead) }))
    .filter(item => item.lead?.mapsUrl && item.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max);

  let cursor = 0;
  let completed = 0;
  const workers = Math.max(1, Math.min(Number(concurrency) || 3, 4, queue.length || 1));

  async function worker() {
    while (true) {
      const pos = cursor++;
      if (pos >= queue.length) return;
      const item = queue[pos];
      try {
        leads[item.index] = await enrichOne(item.lead);
        leads = await setLeads(leads);
      } catch (error) {
        console.warn("[Radar V3 enrich]", error);
      } finally {
        completed += 1;
        broadcast({ event: "ENRICH_PROGRESS", current: completed, total: queue.length, lead: leads[item.index] });
      }
      await sleep(300 + Math.round(Math.random() * 300));
    }
  }

  if (queue.length) await Promise.all(Array.from({ length: workers }, () => worker()));
  return setLeads(leads);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.cmd === "SITE_ENRICH_ONE") return;

  (async () => {
    if (message?.cmd === "GET_STATE") {
      sendResponse({ ok: true, leads: await getLeads() });
      return;
    }
    if (message?.cmd === "STORE_LEADS") {
      sendResponse({ ok: true, leads: await setLeads(message.leads || []) });
      return;
    }
    if (message?.cmd === "CLEAR") {
      await setLeads([]);
      sendResponse({ ok: true, leads: [] });
      return;
    }
    if (message?.cmd === "RUN_MARKET_SEARCH_V3") {
      const result = await runMarketSearch(message);
      sendResponse({ ok: true, ...result });
      return;
    }
    if (message?.cmd === "ENRICH_ALL") {
      const leads = await enrichAll(Number(message.limit) || 60, 3);
      sendResponse({ ok: true, leads });
      return;
    }
  })().catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));

  if (["GET_STATE","STORE_LEADS","CLEAR","RUN_MARKET_SEARCH_V3","ENRICH_ALL"].includes(message?.cmd)) return true;
});
