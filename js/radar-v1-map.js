/* Radar Local V1 — consistência geográfica + declutter visual do mapa */
(() => {
  "use strict";

  if (window.RadarV1MapQuality) return;
  window.RadarV1MapQuality = true;

  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

  function finiteCenter(center) {
    return !!center && Number.isFinite(Number(center.lat)) && Number.isFinite(Number(center.lng));
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

  function geographyReport() {
    const meta = load(META_KEY, {});
    const leads = load(LEADS_KEY, []);
    const region = String(meta.region || "").trim();
    const center = finiteCenter(meta.v4Center) ? { lat: Number(meta.v4Center.lat), lng: Number(meta.v4Center.lng) } : null;
    const centerRegion = String(meta.v4Center?.region || "").trim();
    const radiusKm = Math.max(1, Number(meta.radiusKm || 5) || 5);
    const regionMatch = !region || !centerRegion || normalize(region) === normalize(centerRegion);

    let withCoords = 0;
    let inside = 0;
    let outside = 0;
    (Array.isArray(leads) ? leads : []).forEach(lead => {
      const point = pointOf(lead);
      if (!point) return;
      withCoords += 1;
      if (center && haversineKm(center, point) <= radiusKm) inside += 1;
      else if (center) outside += 1;
    });

    const total = Array.isArray(leads) ? leads.length : 0;
    const coordRate = total ? withCoords / total : 0;
    let level = "empty";
    let label = "Aguardando mapa";
    let detail = "Faça uma busca para validar a região.";

    if (total && center && regionMatch && inside > 0) {
      level = coordRate >= .75 ? "ok" : "partial";
      label = level === "ok" ? "Região validada" : "Região válida";
      detail = `${inside} no raio de ${radiusKm} km${outside ? ` · ${outside} fora` : ""}${withCoords < total ? ` · ${total - withCoords} sem coordenadas` : ""}`;
    } else if (total) {
      level = "warning";
      label = "Revisar localização";
      detail = !center ? "Centro geográfico indisponível." : !regionMatch ? "O centro salvo pertence a outra região." : "Nenhuma empresa caiu dentro do raio atual.";
    }

    return { level, label, detail, total, withCoords, inside, outside, radiusKm, region, centerRegion, regionMatch };
  }

  function ensureGeoPill() {
    const head = $(".v4-map-head");
    if (!head) return null;
    let pill = $("#v1GeoStatus", head);
    if (pill) return pill;

    const legend = $(".v4-map-legend", head);
    const wrap = document.createElement("div");
    wrap.className = "v1-map-head-tools";
    pill = document.createElement("div");
    pill.id = "v1GeoStatus";
    pill.className = "v1-geo-pill is-empty";
    pill.innerHTML = `<span class="v1-geo-dot"></span><div><strong id="v1GeoLabel">Aguardando mapa</strong><small id="v1GeoDetail">Faça uma busca para validar a região.</small></div>`;
    wrap.appendChild(pill);
    if (legend) wrap.appendChild(legend);
    head.appendChild(wrap);
    return pill;
  }

  function renderGeoStatus() {
    const pill = ensureGeoPill();
    if (!pill) return;
    const report = geographyReport();
    pill.classList.remove("is-ok", "is-partial", "is-warning", "is-empty");
    pill.classList.add(`is-${report.level}`);
    $("#v1GeoLabel", pill).textContent = report.label;
    $("#v1GeoDetail", pill).textContent = report.detail;
    pill.title = report.region ? `${report.region} · raio ${report.radiusKm} km` : report.detail;
  }

  function markerPoint(shell) {
    const style = shell.getAttribute("style") || "";
    let match = style.match(/translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/i);
    if (!match) match = style.match(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/i);
    if (match) return { x: Number(match[1]), y: Number(match[2]) };
    const left = Number.parseFloat(shell.style.left);
    const top = Number.parseFloat(shell.style.top);
    return Number.isFinite(left) && Number.isFinite(top) ? { x: left, y: top } : null;
  }

  function clearClusters(shells) {
    shells.forEach(shell => {
      shell.classList.remove("v1-cluster-hidden", "v1-cluster-anchor");
      shell.querySelector(":scope > .v1-cluster-count")?.remove();
    });
  }

  function clusterMarkers() {
    const map = $("#v4OpportunityMap");
    if (!map || map.offsetParent === null) return;
    const shells = $$(".v4-marker-shell", map);
    if (!shells.length) return;
    clearClusters(shells);

    // Com poucos pontos, mantemos todos os pins individuais.
    if (shells.length < 18) return;

    const items = shells.map(shell => ({ shell, point: markerPoint(shell) })).filter(item => item.point);
    const used = new Set();
    const threshold = 34;

    for (let i = 0; i < items.length; i += 1) {
      if (used.has(i)) continue;
      const group = [i];
      used.add(i);
      for (let j = i + 1; j < items.length; j += 1) {
        if (used.has(j)) continue;
        const dx = items[i].point.x - items[j].point.x;
        const dy = items[i].point.y - items[j].point.y;
        if (Math.hypot(dx, dy) <= threshold) {
          group.push(j);
          used.add(j);
        }
      }
      if (group.length < 2) continue;

      const anchor = items[group[0]].shell;
      anchor.classList.add("v1-cluster-anchor");
      const badge = document.createElement("span");
      badge.className = "v1-cluster-count";
      badge.textContent = `+${group.length - 1}`;
      badge.title = `${group.length} empresas muito próximas. Aproxime o mapa para separar os pontos.`;
      anchor.appendChild(badge);
      group.slice(1).forEach(index => items[index].shell.classList.add("v1-cluster-hidden"));
    }
  }

  let clusterTimer = null;
  function scheduleCluster() {
    clearTimeout(clusterTimer);
    clusterTimer = setTimeout(clusterMarkers, 120);
  }

  function strictCenterGuard() {
    const meta = load(META_KEY, {});
    if (!meta.region || !meta.v4Center || !meta.v4Center.region) return;
    if (normalize(meta.region) === normalize(meta.v4Center.region)) return;
    const next = { ...meta };
    delete next.v4Center;
    delete next.centerCoverage;
    localStorage.setItem(META_KEY, JSON.stringify(next));
    if (sessionStorage.getItem("radarV1GeoGuard") !== "1") {
      sessionStorage.setItem("radarV1GeoGuard", "1");
      setTimeout(() => window.location.reload(), 100);
    }
  }

  function refresh() {
    strictCenterGuard();
    renderGeoStatus();
    scheduleCluster();
  }

  window.addEventListener("radar:maps-data-updated", () => setTimeout(refresh, 100));
  window.addEventListener("storage", event => {
    if ([META_KEY, LEADS_KEY].includes(event.key)) refresh();
  });
  document.addEventListener("click", event => {
    if (event.target.closest(".leaflet-control-zoom, #v4Radius, #v4BatchSearch")) setTimeout(scheduleCluster, 350);
  });
  document.addEventListener("wheel", event => {
    if (event.target.closest("#v4OpportunityMap")) setTimeout(scheduleCluster, 350);
  }, { passive: true });

  const observer = new MutationObserver(() => {
    renderGeoStatus();
    scheduleCluster();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
  setInterval(() => { renderGeoStatus(); clusterMarkers(); }, 1800);
})();
