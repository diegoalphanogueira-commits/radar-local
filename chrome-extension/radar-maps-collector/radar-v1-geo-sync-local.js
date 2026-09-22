(() => {
  "use strict";

  if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  if (window.RadarV1GeoSyncLocal) return;
  window.RadarV1GeoSyncLocal = true;

  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const SOURCE = "RADAR_MAPS_COLLECTOR";
  const RELOAD_KEY = "radarV1GeoSyncReload";

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  }

  function finitePoint(value) {
    const lat = Number(value?.lat ?? value?.latitude);
    const lng = Number(value?.lng ?? value?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function median(values) {
    const rows = values.filter(Number.isFinite).sort((a,b) => a-b);
    if (!rows.length) return null;
    const mid = Math.floor(rows.length / 2);
    return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
  }

  function medianCenter(leads) {
    const points = (Array.isArray(leads) ? leads : []).map(finitePoint).filter(Boolean);
    if (!points.length) return null;
    return { lat: median(points.map(p => p.lat)), lng: median(points.map(p => p.lng)) };
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

  function currentRegion(meta = loadJson(META_KEY, {})) {
    return String(document.querySelector("#mapsSearchCity")?.value || meta.region || "").trim();
  }

  function currentRadius(meta = loadJson(META_KEY, {})) {
    return Number(document.querySelector("#v4Radius")?.value || meta.radiusKm || 5) || 5;
  }

  function saveCenter(center, region, source) {
    if (!center || !region) return false;
    const meta = loadJson(META_KEY, {});
    localStorage.setItem(META_KEY, JSON.stringify({
      ...meta,
      region,
      radiusKm: currentRadius(meta),
      v4Center: { lat: Number(center.lat), lng: Number(center.lng), source, region },
      centerRecoveredAt: new Date().toISOString()
    }));
    return true;
  }

  function scheduleReload(region, center, reason) {
    if (!region || !center) return;
    const key = `${normalize(region)}|${Number(center.lat).toFixed(4)},${Number(center.lng).toFixed(4)}|${reason}`;
    if (sessionStorage.getItem(RELOAD_KEY) === key) return;
    sessionStorage.setItem(RELOAD_KEY, key);
    setTimeout(() => location.reload(), 900);
  }

  function syncFromCollectorResponse(response) {
    if (!response?.ok) return false;
    const region = String(response?.context?.region || currentRegion()).trim();
    const center = finitePoint(response?.context?.center);
    if (!region || !center) return false;

    const meta = loadJson(META_KEY, {});
    const old = finitePoint(meta.v4Center);
    const oldRegion = String(meta.v4Center?.region || "").trim();
    const regionChanged = !!oldRegion && normalize(oldRegion) !== normalize(region);
    const movedFar = old && haversineKm(old, center) > Math.max(2, currentRadius(meta) * 0.8);
    const missing = !old;

    saveCenter(center, region, "collector-context");
    if (regionChanged || movedFar || missing) scheduleReload(region, center, "collector");
    return true;
  }

  function visibleCount() {
    const kpis = [...document.querySelectorAll("#v4Kpis .v4-kpi, #v4Kpis > *")];
    for (const node of kpis) {
      const text = String(node.textContent || "");
      if (/no raio/i.test(text)) {
        const match = text.match(/\b(\d+)\b/);
        if (match) return Number(match[1]);
      }
    }
    const listCount = document.querySelector("#v4ListCount")?.textContent || "";
    const match = listCount.match(/\b(\d+)\b/);
    return match ? Number(match[1]) : null;
  }

  function recoverFromLeads(force = false) {
    const meta = loadJson(META_KEY, {});
    const leads = loadJson(LEADS_KEY, []);
    if (!Array.isArray(leads) || leads.length < 2) return false;

    const region = currentRegion(meta);
    if (!region) return false;

    const oldRegion = String(meta.v4Center?.region || "").trim();
    const mismatch = !!oldRegion && normalize(oldRegion) !== normalize(region);
    const zeroVisible = visibleCount() === 0 && leads.length > 0;
    if (!force && !mismatch && !zeroVisible) return false;

    const center = medianCenter(leads);
    if (!center) return false;
    saveCenter(center, region, "lead-median-recovery");
    scheduleReload(region, center, mismatch ? "region-mismatch" : "zero-visible");
    return true;
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== SOURCE) return;
    if (message.type === "BATCH_RESULT" || message.type === "SEARCH_RESULT") {
      const synced = syncFromCollectorResponse(message.response);
      if (!synced) setTimeout(() => recoverFromLeads(true), 250);
    }
  });

  function boot() {
    setTimeout(() => recoverFromLeads(false), 450);
    setTimeout(() => recoverFromLeads(false), 1600);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  setInterval(() => recoverFromLeads(false), 1800);
  console.info("[Radar Local] Geo Sync local ativo.");
})();
