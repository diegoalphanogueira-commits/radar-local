/* =========================================================
   RADAR LOCAL — CENTER RECOVERY V1
   Corrige automaticamente o caso "N coletados / 0 no raio"
   sem depender do centro antigo mantido em memória pelo workspace.
========================================================= */
(() => {
  "use strict";

  if (window.RadarCenterRecoveryV1) return;
  window.RadarCenterRecoveryV1 = true;

  const STORAGE_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const RELOAD_KEY = "radarCenterRecoveryReload";

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function pointOf(lead) {
    const lat = Number(lead?.lat ?? lead?.latitude);
    const lng = Number(lead?.lng ?? lead?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function haversineKm(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371;
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function median(values) {
    const clean = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!clean.length) return null;
    const m = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[m] : (clean[m - 1] + clean[m]) / 2;
  }

  function medianCenter(points, source, region) {
    if (!points.length) return null;
    return { lat: median(points.map(p => p.lat)), lng: median(points.map(p => p.lng)), source, region };
  }

  function regionTokens(region) {
    const first = normalize(String(region || "").split(",")[0]);
    const ignored = new Set(["jardim","jd","vila","bairro","parque","regiao","distrito","sao","sp"]);
    return first.split(" ").filter(token => token.length >= 3 && !ignored.has(token));
  }

  function matchesRegion(lead, region) {
    const tokens = regionTokens(region);
    if (!tokens.length) return false;
    const hay = normalize(`${lead?.address || ""} ${lead?.neighborhood || ""} ${lead?.city || ""}`);
    return tokens.every(token => hay.includes(token)) || tokens.some(token => hay.includes(token));
  }

  function coverage(center, leads, radiusKm) {
    if (!center) return 0;
    return leads.reduce((sum, lead) => {
      const point = pointOf(lead);
      return sum + (point && haversineKm(center, point) <= radiusKm ? 1 : 0);
    }, 0);
  }

  function matchedCoverage(center, leads, radiusKm, region) {
    if (!center) return 0;
    return leads.reduce((sum, lead) => {
      const point = pointOf(lead);
      return sum + (point && matchesRegion(lead, region) && haversineKm(center, point) <= radiusKm ? 1 : 0);
    }, 0);
  }

  function densestCenter(leads, radiusKm, region) {
    const points = leads.map(pointOf).filter(Boolean);
    if (!points.length) return null;
    const clusterRadius = Math.max(1.5, Math.min(5, radiusKm * .8));
    let best = [];
    for (const seed of points) {
      const cluster = points.filter(point => haversineKm(seed, point) <= clusterRadius);
      if (cluster.length > best.length) best = cluster;
    }
    return medianCenter(best.length ? best : points, "recovery-cluster", region);
  }

  function bestCenter(leads, meta) {
    const region = String(meta.region || "").trim();
    const radiusKm = Number(meta.radiusKm || 5) || 5;
    const points = leads.map(pointOf).filter(Boolean);
    if (!points.length) return null;

    const candidates = [];
    const saved = meta.v4Center && Number.isFinite(Number(meta.v4Center.lat)) && Number.isFinite(Number(meta.v4Center.lng))
      ? { ...meta.v4Center, lat: Number(meta.v4Center.lat), lng: Number(meta.v4Center.lng), source: meta.v4Center.source || "saved" }
      : null;
    if (saved) candidates.push(saved);

    const regionPoints = leads.filter(lead => matchesRegion(lead, region)).map(pointOf).filter(Boolean);
    const regionMedian = medianCenter(regionPoints, "recovery-region-address", region);
    if (regionMedian) candidates.push(regionMedian);

    const dense = densestCenter(leads, radiusKm, region);
    if (dense) candidates.push(dense);

    const global = medianCenter(points, "recovery-global-median", region);
    if (global) candidates.push(global);

    let best = null;
    for (const center of candidates) {
      const inside = coverage(center, leads, radiusKm);
      const matched = matchedCoverage(center, leads, radiusKm, region);
      const rank = inside + matched * 4 + (center.source === "recovery-region-address" ? 2 : 0);
      if (!best || rank > best.rank) best = { center, inside, matched, rank };
    }
    return best;
  }

  function repair() {
    const leads = load(STORAGE_KEY, []);
    const meta = load(META_KEY, {});
    if (!Array.isArray(leads) || !leads.length || !meta.region) return false;

    const radiusKm = Number(meta.radiusKm || 5) || 5;
    const current = meta.v4Center && Number.isFinite(Number(meta.v4Center.lat)) && Number.isFinite(Number(meta.v4Center.lng))
      ? { lat: Number(meta.v4Center.lat), lng: Number(meta.v4Center.lng) }
      : null;
    const currentInside = coverage(current, leads, radiusKm);
    const best = bestCenter(leads, meta);
    if (!best || best.inside <= currentInside) return false;

    const significant = currentInside === 0 || best.inside >= currentInside + Math.max(3, Math.ceil(leads.length * .12));
    if (!significant) return false;

    const nextMeta = {
      ...meta,
      v4Center: { ...best.center, region: meta.region, coverage: best.inside, matchedCoverage: best.matched },
      centerCoverage: best.inside,
      centerRecoveredAt: new Date().toISOString()
    };
    localStorage.setItem(META_KEY, JSON.stringify(nextMeta));

    const fingerprint = `${normalize(meta.term)}|${normalize(meta.region)}|${leads.length}|${best.inside}`;
    if (sessionStorage.getItem(RELOAD_KEY) !== fingerprint) {
      sessionStorage.setItem(RELOAD_KEY, fingerprint);
      setTimeout(() => window.location.reload(), 180);
    }
    return true;
  }

  function maybeRepairFromDom() {
    const leads = load(STORAGE_KEY, []);
    if (!Array.isArray(leads) || !leads.length) return;
    const kpi = document.querySelector("#v4Kpis article:first-child strong");
    const listCount = document.querySelector("#v4ListCount");
    const visible = Number(String(kpi?.textContent || listCount?.textContent || "0").replace(/\D/g, "")) || 0;
    if (visible === 0) repair();
  }

  window.addEventListener("radar:maps-data-updated", () => setTimeout(maybeRepairFromDom, 120));
  window.addEventListener("message", event => {
    const data = event.data;
    if (event.source !== window || !data || data.source !== "RADAR_MAPS_COLLECTOR") return;
    if (data.type === "PROGRESS" || ["BATCH_RESULT","SEARCH_RESULT","ENRICH_RESULT","STATE_RESULT"].includes(data.type)) {
      setTimeout(maybeRepairFromDom, 180);
    }
  });

  document.addEventListener("DOMContentLoaded", () => setTimeout(maybeRepairFromDom, 900), { once: true });
  setInterval(maybeRepairFromDom, 2200);
})();
