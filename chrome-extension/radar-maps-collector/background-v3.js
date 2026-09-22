/* Radar Maps Collector — V1 RC13 / Discovery Engine V3 */
importScripts("background.js", "site-enrichment.js");

(() => {
  "use strict";

  const MARKET_CACHE_KEY = "radarMarketCoverageV3";
  const MARKET_CACHE_TTL = 45 * 24 * 60 * 60 * 1000;
  const MARKET_CACHE_MAX = 30;
  const MARKET_LEAD_MAX = 700;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

  function marketKey(message) {
    return `${normalize(message.segment || message.term || "mercado")}|${normalize(message.region || "")}|${Number(message.radiusKm || 5) || 5}`;
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

  async function getMarketEntry(key) {
    const cache = await loadMarketCache();
    return cache[key] || null;
  }

  async function putMarketEntry(key, message, leads, context, stats = {}) {
    const cache = await loadMarketCache();
    const previous = cache[key] || {};
    const merged = mergeLeads(previous.leads || [], Array.isArray(leads) ? leads : []).slice(0, MARKET_LEAD_MAX);
    cache[key] = {
      key,
      segment: String(message.segment || "").trim(),
      term: String(message.term || "").trim(),
      region: String(message.region || "").trim(),
      radiusKm: Number(message.radiusKm || 5) || 5,
      updatedAt: Date.now(),
      bestCount: Math.max(Number(previous.bestCount || 0), merged.length),
      center: context?.center || previous.center || null,
      stats: { ...(previous.stats || {}), ...stats },
      leads: merged
    };
    await saveMarketCache(cache);
    return cache[key];
  }

  function coverageAnchorsV3(center, radiusKm) {
    if (!center) return [null];
    const radius = Math.max(1, Number(radiusKm || 5) || 5);
    const offset = Math.min(3.4, Math.max(1.0, radius * 0.48));
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

  function buildPlan(queries, anchors) {
    const plan = [];
    const cleanQueries = [...new Set((Array.isArray(queries) ? queries : []).map(v => String(v || "").trim()).filter(Boolean))].slice(0, 12);
    if (!cleanQueries.length) return plan;

    const allAnchors = anchors.length ? anchors : [null];
    const first = cleanQueries[0];
    allAnchors.forEach(anchor => plan.push({ query: first, anchor }));

    if (cleanQueries[1]) {
      [0, 1, 2, 3, 4].forEach(index => {
        const anchor = allAnchors[index % allAnchors.length];
        plan.push({ query: cleanQueries[1], anchor });
      });
    }

    cleanQueries.slice(2).forEach((query, index) => {
      const a = allAnchors[(index * 2 + 5) % allAnchors.length];
      const b = allAnchors[(index * 2 + 7) % allAnchors.length];
      plan.push({ query, anchor: a });
      if (allAnchors.length > 1) plan.push({ query, anchor: b });
    });

    return plan;
  }

  function targetConfig(raw) {
    const value = String(raw || "max").toLowerCase();
    if (value === "30") return { count: 30, label: "30+", minSearches: 5 };
    if (value === "50") return { count: 50, label: "50+", minSearches: 7 };
    if (value === "100") return { count: 100, label: "100+", minSearches: 10 };
    return { count: Infinity, label: "Máxima", minSearches: 18 };
  }

  function inRadiusOrUnknownCount(leads, center, radiusKm) {
    if (!center) return Array.isArray(leads) ? leads.length : 0;
    return (Array.isArray(leads) ? leads : []).filter(lead => {
      const lat = Number(lead?.lat ?? lead?.latitude);
      const lng = Number(lead?.lng ?? lead?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
      if (lead?.coordSource && !["place", "query", "detail-camera"].includes(lead.coordSource)) return true;
      return haversineLocal(center, { lat, lng }) <= Number(radiusKm || 5);
    }).length;
  }

  function haversineLocal(a, b) {
    const R = 6371;
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function runMarketSearchV3(message) {
    const region = String(message.region || "").trim();
    const radiusKm = Math.max(1, Number(message.radiusKm || 5) || 5);
    const queries = [...new Set((Array.isArray(message.queries) ? message.queries : []).map(v => String(v || "").trim()).filter(Boolean))].slice(0, 12);
    if (!region || !queries.length) throw new Error("Informe segmento e região para iniciar a cobertura.");

    const context = {
      region,
      radiusKm,
      center: await geocodeRegion(region)
    };
    const key = marketKey(message);
    const previous = await getMarketEntry(key);
    const seed = mergeLeads(
      Array.isArray(previous?.leads) ? previous.leads : [],
      Array.isArray(message.seedLeads) ? message.seedLeads : []
    ).slice(0, MARKET_LEAD_MAX);

    await setLeads(seed);
    const anchors = coverageAnchorsV3(context.center, radiusKm);
    const plan = buildPlan(queries, anchors);
    const target = targetConfig(message.targetMode);
    const maxScrolls = Math.max(100, Math.min(Number(message.maxScrolls) || 120, 160));
    let stableSearches = 0;
    let searchesDone = 0;
    let lastCount = seed.length;
    let freshSeen = 0;
    const errors = [];

    broadcast({
      event: "MARKET_PROGRESS",
      stage: "start",
      current: 0,
      total: plan.length,
      accumulated: seed.length,
      targetLabel: target.label,
      text: `Cobertura ${target.label} iniciada em ${region} · ${seed.length} negócios já conhecidos.`
    });

    for (let index = 0; index < plan.length; index += 1) {
      const item = plan[index];
      const pass = index + 1;
      const anchorLabel = item.anchor?.label || "texto";

      broadcast({
        event: "MARKET_PROGRESS",
        stage: "searching",
        current: pass,
        total: plan.length,
        accumulated: (await getLeads()).length,
        targetLabel: target.label,
        text: `Varredura ${pass}/${plan.length} · ${anchorLabel} · ${item.query}`
      });

      try {
        const result = await runSearch(item.query, maxScrolls, pass, plan.length, context, item.anchor);
        searchesDone += 1;
        freshSeen += Array.isArray(result.found) ? result.found.length : 0;
        const current = mergeLeads([], await getLeads()).slice(0, MARKET_LEAD_MAX);
        const count = current.length;
        const added = Math.max(0, count - lastCount);
        stableSearches = added > 0 ? 0 : stableSearches + 1;
        lastCount = count;
        await setLeads(current);
        await putMarketEntry(key, message, current, context, { searchesDone, freshSeen, lastAdded: added });

        const usefulCount = inRadiusOrUnknownCount(current, context.center, radiusKm);
        broadcast({
          event: "MARKET_PROGRESS",
          stage: "pass_done",
          current: pass,
          total: plan.length,
          accumulated: count,
          usefulCount,
          added,
          targetLabel: target.label,
          text: `${count} negócios acumulados · ${added} novos nesta varredura · meta ${target.label}.`
        });

        if (Number.isFinite(target.count) && searchesDone >= target.minSearches && usefulCount >= target.count) break;
        if (!Number.isFinite(target.count) && searchesDone >= target.minSearches && stableSearches >= 12) break;
      } catch (error) {
        errors.push({ query: item.query, anchor: anchorLabel, error: error?.message || "SEARCH_FAILED" });
        stableSearches += 1;
        console.warn("[Radar V3] search", item.query, anchorLabel, error);
      }

      await sleep(650 + Math.round(Math.random() * 500));
    }

    const leads = mergeLeads(seed, await getLeads()).slice(0, MARKET_LEAD_MAX);
    await setLeads(leads);
    const entry = await putMarketEntry(key, message, leads, context, {
      searchesDone,
      freshSeen,
      errors: errors.length,
      completedAt: new Date().toISOString()
    });

    const usefulCount = inRadiusOrUnknownCount(leads, context.center, radiusKm);
    broadcast({
      event: "MARKET_PROGRESS",
      stage: "done",
      current: searchesDone,
      total: plan.length,
      accumulated: leads.length,
      usefulCount,
      targetLabel: target.label,
      text: `${leads.length} negócios consolidados · ${usefulCount} dentro do raio ou aguardando coordenada precisa.`
    });

    return {
      leads,
      errors,
      queries,
      context,
      marketKey: key,
      targetLabel: target.label,
      searchesDone,
      plannedSearches: plan.length,
      freshSeen,
      usefulCount,
      cacheHit: !!previous,
      bestCount: Number(entry?.bestCount || leads.length)
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd !== "RUN_MARKET_SEARCH_V3") return;
    runMarketSearchV3(message)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });
})();
