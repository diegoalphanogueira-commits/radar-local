const STORAGE_KEY = "radarMapsCollectorLeadsV1";
const SEARCH_CACHE_KEY = "radarMapsCollectorSearchSnapshotsV1";
const CURRENT_SEARCH_KEY = "radarMapsCollectorCurrentSearchV1";
const SEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SEARCH_CACHE_MAX = 12;
const SEARCH_CACHE_MAX_LEADS = 400;
const DISCOVERY_MIN_PASSES = 2;
const DISCOVERY_MAX_PASSES = 3;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getLeads() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setLeads(leads) {
  await chrome.storage.local.set({ [STORAGE_KEY]: leads });
  return leads;
}

function leadKey(lead) {
  return String(lead?.mapsUrl || `${lead?.name || ""}|${lead?.address || ""}`).trim();
}

function mergeLeads(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming].forEach(lead => {
    if (!lead) return;
    const key = leadKey(lead);
    if (!key) return;
    const prev = map.get(key) || {};
    const merged = { ...prev };
    Object.entries(lead).forEach(([field, value]) => {
      if (value !== "" && value !== null && value !== undefined) merged[field] = value;
    });
    map.set(key, merged);
  });
  return [...map.values()];
}

function searchFingerprint(queries, context = {}) {
  const queryPart = [...new Set((Array.isArray(queries) ? queries : []).map(normalizeText).filter(Boolean))]
    .sort()
    .join("||");
  const region = normalizeText(context.region || "");
  const center = context.center && Number.isFinite(Number(context.center.lat)) && Number.isFinite(Number(context.center.lng))
    ? `${Number(context.center.lat).toFixed(4)},${Number(context.center.lng).toFixed(4)}`
    : "";
  const radius = Number(context.radiusKm || 0) || 0;
  return `${region}|${center}|${radius}|${queryPart}`;
}

async function loadSearchCache() {
  const data = await chrome.storage.local.get(SEARCH_CACHE_KEY);
  const raw = data[SEARCH_CACHE_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

async function saveSearchCache(cache) {
  const now = Date.now();
  const entries = Object.entries(cache || {})
    .filter(([, entry]) => entry && Number(entry.updatedAt || 0) >= now - SEARCH_CACHE_TTL_MS)
    .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
    .slice(0, SEARCH_CACHE_MAX);
  await chrome.storage.local.set({ [SEARCH_CACHE_KEY]: Object.fromEntries(entries) });
}

async function getSearchSnapshot(fingerprint) {
  if (!fingerprint) return null;
  const cache = await loadSearchCache();
  const entry = cache[fingerprint];
  if (!entry) return null;
  if (Number(entry.updatedAt || 0) < Date.now() - SEARCH_CACHE_TTL_MS) {
    delete cache[fingerprint];
    await saveSearchCache(cache);
    return null;
  }
  return entry;
}

async function putSearchSnapshot(fingerprint, queries, leads) {
  if (!fingerprint) return;
  const cache = await loadSearchCache();
  cache[fingerprint] = {
    fingerprint,
    queries: Array.isArray(queries) ? queries : [],
    updatedAt: Date.now(),
    leads: mergeLeads([], Array.isArray(leads) ? leads : []).slice(0, SEARCH_CACHE_MAX_LEADS)
  };
  await saveSearchCache(cache);
}

async function setCurrentSearch(fingerprint, queries) {
  await chrome.storage.local.set({
    [CURRENT_SEARCH_KEY]: {
      fingerprint: fingerprint || "",
      queries: Array.isArray(queries) ? queries : [],
      updatedAt: Date.now()
    }
  });
}

async function getCurrentSearch() {
  const data = await chrome.storage.local.get(CURRENT_SEARCH_KEY);
  return data[CURRENT_SEARCH_KEY] || null;
}

async function refreshCurrentSnapshot(leads) {
  const current = await getCurrentSearch();
  if (!current?.fingerprint) return;
  const existing = await getSearchSnapshot(current.fingerprint);
  const merged = mergeLeads(existing?.leads || [], Array.isArray(leads) ? leads : []);
  await putSearchSnapshot(current.fingerprint, current.queries || [], merged);
}

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("TIMEOUT"));
    }, timeoutMs);

    function listener(updatedId, info) {
      if (updatedId !== tabId || info.status !== "complete" || done) return;
      done = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendToTabWithRetry(tabId, message, attempts = 5) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(900 + i * 450);
  }
  throw lastError || new Error("CONTENT_SCRIPT_UNAVAILABLE");
}

async function geocodeRegion(region) {
  const query = String(region || "").trim();
  if (!query) return null;
  const expanded = /brasil/i.test(query) ? query : `${query}, São Paulo, Brasil`;
  try {
    const params = new URLSearchParams({
      q: expanded,
      format: "jsonv2",
      limit: "5",
      countrycodes: "br",
      addressdetails: "1"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const normalized = normalizeText(query);
    const tokens = normalized.split(" ").filter(token => token.length >= 3 && !["jardim","jd","vila","bairro","sp","sao"].includes(token));
    const ranked = (Array.isArray(rows) ? rows : []).map(row => {
      const hay = normalizeText(row?.display_name || "");
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      return { row, score };
    }).sort((a, b) => b.score - a.score);
    const best = ranked[0]?.row;
    const lat = Number(best?.lat);
    const lng = Number(best?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: best.display_name || query };
  } catch (error) {
    console.warn("[RadarMapsCollector] geocode", error);
    return null;
  }
}

function zoomForRadius(radiusKm) {
  const radius = Number(radiusKm || 5) || 5;
  if (radius <= 2) return 15;
  if (radius <= 5) return 14;
  if (radius <= 9) return 13;
  return 12;
}

function offsetPoint(center, eastKm = 0, northKm = 0) {
  if (!center) return null;
  const lat = Number(center.lat);
  const lng = Number(center.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const dLat = northKm / 110.574;
  const cos = Math.max(0.25, Math.cos(lat * Math.PI / 180));
  const dLng = eastKm / (111.320 * cos);
  return { lat: lat + dLat, lng: lng + dLng };
}

function coverageAnchors(center, radiusKm) {
  if (!center) return [null];
  const radius = Math.max(1, Number(radiusKm || 5) || 5);
  const offset = Math.min(3.2, Math.max(0.9, radius * 0.45));
  return [
    { ...center, label: "centro" },
    { ...offsetPoint(center, offset, offset), label: "nordeste" },
    { ...offsetPoint(center, -offset, -offset), label: "sudoeste" },
    { ...offsetPoint(center, -offset, offset), label: "noroeste" },
    { ...offsetPoint(center, offset, -offset), label: "sudeste" }
  ];
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

function buildMapsUrl(query, context = {}, anchor = null) {
  const cleanQuery = String(query || "").trim();
  const center = anchor || context.center;
  if (center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng))) {
    const searchTerm = stripRegionFromQuery(cleanQuery, context.region) || cleanQuery;
    const zoom = zoomForRadius(context.radiusKm);
    return `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/@${Number(center.lat)},${Number(center.lng)},${zoom}z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(cleanQuery)}`;
}

async function runSearch(query, maxScrolls = 75, pass = 1, totalPasses = DISCOVERY_MAX_PASSES, context = {}, anchor = null) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) throw new Error("Informe segmento e região.");

  const anchorLabel = anchor?.label ? ` · área ${anchor.label}` : "";
  broadcast({
    event: "SEARCH_PROGRESS",
    stage: "opening",
    text: `Abrindo busca no Google Maps · passagem ${pass}/${totalPasses}${anchorLabel}...`,
    query: cleanQuery,
    pass,
    totalPasses
  });
  const url = buildMapsUrl(cleanQuery, context, anchor);
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabComplete(tab.id, 40000).catch(() => {});
    await sleep(2800 + Math.round(Math.random() * 900));
    broadcast({
      event: "SEARCH_PROGRESS",
      stage: "scanning",
      text: `Varrendo resultados até estabilizar · passagem ${pass}/${totalPasses}${anchorLabel}...`,
      query: cleanQuery,
      pass,
      totalPasses
    });

    const response = await sendToTabWithRetry(tab.id, { cmd: "SCAN_SCROLL", maxScrolls }, 6);
    if (!response?.ok) throw new Error(response?.error || "Falha ao ler os resultados do Maps.");

    const existing = await getLeads();
    const before = existing.length;
    const found = Array.isArray(response.leads) ? response.leads : [];
    const leads = mergeLeads(existing, found);
    const added = Math.max(0, leads.length - before);
    await setLeads(leads);

    broadcast({
      event: "SEARCH_PROGRESS",
      stage: "done",
      text: `${found.length} vistos nesta passagem · ${added} novos adicionados · ${leads.length} únicos acumulados.`,
      query: cleanQuery,
      count: found.length,
      added,
      accumulated: leads.length,
      pass,
      totalPasses
    });
    return { leads, found, added };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function runQueryExhaustive(query, maxScrolls, queryIndex, queryTotal, context = {}) {
  let result = { leads: await getLeads(), found: [], added: 0 };
  let pass = 0;
  const anchors = coverageAnchors(context.center, context.radiusKm);
  while (pass < DISCOVERY_MAX_PASSES) {
    pass += 1;
    const anchor = anchors[(queryIndex + pass - 1) % anchors.length] || context.center || null;
    broadcast({
      event: "BATCH_PROGRESS",
      stage: "searching",
      current: queryIndex + 1,
      total: queryTotal,
      pass,
      totalPasses: DISCOVERY_MAX_PASSES,
      query,
      text: `Busca ${queryIndex + 1}/${queryTotal} · passagem ${pass}/${DISCOVERY_MAX_PASSES}${anchor?.label ? ` · ${anchor.label}` : ""}: ${query}`
    });

    result = await runSearch(query, maxScrolls, pass, DISCOVERY_MAX_PASSES, context, anchor);

    broadcast({
      event: "BATCH_PROGRESS",
      stage: "pass_done",
      current: queryIndex + 1,
      total: queryTotal,
      pass,
      totalPasses: DISCOVERY_MAX_PASSES,
      query,
      added: result.added,
      accumulated: result.leads.length,
      text: `Passagem ${pass}: ${result.added} empresas novas · ${result.leads.length} únicas acumuladas.`
    });

    if (pass >= DISCOVERY_MIN_PASSES && result.added === 0) break;
    if (pass < DISCOVERY_MAX_PASSES) await sleep(1700 + Math.round(Math.random() * 1200));
  }
  return result;
}

async function runBatchSearch(rawQueries, maxScrolls = 75, replace = true, rawContext = {}) {
  const queries = [...new Set((Array.isArray(rawQueries) ? rawQueries : [])
    .map(query => String(query || "").trim())
    .filter(Boolean))].slice(0, 12);
  if (!queries.length) throw new Error("Nenhuma busca válida foi informada.");

  const context = {
    region: String(rawContext.region || "").trim(),
    radiusKm: Math.max(1, Number(rawContext.radiusKm || 5) || 5),
    center: rawContext.center && Number.isFinite(Number(rawContext.center.lat)) && Number.isFinite(Number(rawContext.center.lng))
      ? { lat: Number(rawContext.center.lat), lng: Number(rawContext.center.lng) }
      : null
  };
  if (!context.center && context.region) context.center = await geocodeRegion(context.region);

  const fingerprint = searchFingerprint(queries, context);
  const previousSnapshot = await getSearchSnapshot(fingerprint);
  const previousLeads = Array.isArray(previousSnapshot?.leads) ? previousSnapshot.leads : [];
  await setCurrentSearch(fingerprint, queries);
  if (replace) await setLeads([]);

  const errors = [];
  const scrollBudget = Math.max(75, Math.min(Number(maxScrolls) || 85, 110));

  broadcast({
    event: "BATCH_PROGRESS",
    stage: "coverage_start",
    current: 0,
    total: queries.length,
    text: context.center
      ? `Cobertura espacial ativada em ${context.region || "região"} · raio ${context.radiusKm} km.`
      : `Cobertura por texto ativada · não foi possível obter o centro da região.`
  });

  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    try {
      await runQueryExhaustive(query, scrollBudget, index, queries.length, context);
    } catch (error) {
      errors.push({ query, error: error?.message || "SEARCH_FAILED" });
      console.warn("[RadarMapsCollector] batch", query, error);
    }
    await sleep(1200 + Math.round(Math.random() * 1000));
  }

  const freshLeads = await getLeads();
  const leads = mergeLeads(previousLeads, freshLeads);
  const restoredCount = Math.max(0, leads.length - freshLeads.length);
  await setLeads(leads);
  await putSearchSnapshot(fingerprint, queries, leads);

  broadcast({
    event: "BATCH_PROGRESS",
    stage: "done",
    current: queries.length,
    total: queries.length,
    text: restoredCount
      ? `${leads.length} negócios consolidados · ${freshLeads.length} vistos agora · ${restoredCount} recuperados da memória desta busca.`
      : `${leads.length} negócios únicos consolidados após cobertura espacial.`
  });
  return { leads, errors, queries, freshCount: freshLeads.length, restoredCount, cacheHit: previousLeads.length > 0, context };
}

async function enrichOne(lead) {
  if (!lead?.mapsUrl) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  try {
    await waitForTabComplete(tab.id, 25000).catch(() => {});
    await sleep(1500 + Math.round(Math.random() * 650));
    const response = await sendToTabWithRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 4).catch(() => null);
    if (!response?.ok || !response.lead) return lead;
    return mergeLeads([lead], [response.lead])[0];
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
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
  const max = Math.max(1, Math.min(Number(limit) || 60, 120));
  const indexes = leads
    .map((lead, index) => ({ lead, index, priority: enrichmentPriority(lead) }))
    .filter(item => item.lead?.mapsUrl && item.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max);

  if (!indexes.length) {
    await refreshCurrentSnapshot(leads);
    return leads;
  }

  let cursor = 0;
  let completed = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 3, 4, indexes.length));

  async function worker() {
    while (true) {
      const position = cursor++;
      if (position >= indexes.length) return;
      const item = indexes[position];
      try {
        leads[item.index] = await enrichOne(item.lead);
        await setLeads(leads);
      } catch (error) {
        console.warn("[RadarMapsCollector] detail", error);
      } finally {
        completed += 1;
        broadcast({
          event: "ENRICH_PROGRESS",
          current: completed,
          total: indexes.length,
          lead: leads[item.index]
        });
        await sleep(400 + Math.round(Math.random() * 350));
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  await refreshCurrentSnapshot(leads);
  return leads;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function makeCsv(leads) {
  const header = ["Nome","Categoria","Nota","Avaliacoes","Telefone","Site","Endereco","Lat","Lng","LinkMaps","Horario","DataColeta"];
  const rows = [header.map(csvCell).join(";")];
  leads.forEach(lead => {
    rows.push([
      lead.name || "", lead.category || "", lead.rating ?? "", lead.reviews ?? "", lead.phone || "", lead.website || "", lead.address || "", lead.lat ?? "", lead.lng ?? "", lead.mapsUrl || "", lead.hours || "", lead.collectedAt || lead.detailedAt || ""
    ].map(csvCell).join(";"));
  });
  return "\uFEFF" + rows.join("\n");
}

async function downloadText(text, mime, filename) {
  const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.cmd === "GET_STATE") {
      const leads = await getLeads();
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "RUN_SEARCH") {
      if (message.replace !== false) await setLeads([]);
      const searchResult = await runSearch(message.query, Number(message.maxScrolls) || 75, 1, 1, {
        region: String(message.region || "").trim(),
        radiusKm: Number(message.radiusKm || 5) || 5,
        center: message.center || null
      });
      let leads = searchResult.leads;
      if (leads.length) {
        broadcast({ event: "SEARCH_PROGRESS", stage: "enriching", text: "Completando telefone, site e horário das empresas..." });
        leads = await enrichAll(Number(message.enrichLimit) || 60, 3);
      }
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "RUN_BATCH_SEARCH") {
      const result = await runBatchSearch(
        message.queries,
        Number(message.maxScrolls) || 85,
        message.replace !== false,
        {
          region: message.region,
          radiusKm: message.radiusKm,
          center: message.center
        }
      );
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message?.cmd === "STORE_LEADS") {
      const existing = await getLeads();
      const leads = mergeLeads(existing, Array.isArray(message.leads) ? message.leads : []);
      await setLeads(leads);
      await refreshCurrentSnapshot(leads);
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "CLEAR") {
      await setLeads([]);
      sendResponse({ ok: true, leads: [] });
      return;
    }

    if (message?.cmd === "ENRICH_ALL") {
      const leads = await enrichAll(Number(message.limit) || 60, 3);
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "EXPORT_JSON") {
      const leads = await getLeads();
      await downloadText(JSON.stringify(leads, null, 2), "application/json", `radar-maps-${new Date().toISOString().slice(0,10)}.json`);
      sendResponse({ ok: true });
      return;
    }

    if (message?.cmd === "EXPORT_CSV") {
      const leads = await getLeads();
      await downloadText(makeCsv(leads), "text/csv", `radar-maps-${new Date().toISOString().slice(0,10)}.csv`);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "UNKNOWN_COMMAND" });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});