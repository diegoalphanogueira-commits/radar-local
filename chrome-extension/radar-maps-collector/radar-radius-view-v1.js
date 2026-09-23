(() => {
  "use strict";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
  const load = (key,fallback) => { try { return JSON.parse(localStorage.getItem(key)||"") || fallback; } catch { return fallback; } };

  function refresh() {
    const leads = load(LEADS_KEY,[]), meta = load(META_KEY,{});
    if (!Array.isArray(leads)) return;
    const inside = leads.filter(x => x.radiusStatus === "inside").length;
    const outside = leads.filter(x => x.radiusStatus === "outside").length;
    const unknown = Math.max(0, leads.length - inside - outside);

    const firstKpi = document.querySelector("#v4Kpis article:first-child");
    if (firstKpi) {
      const span = firstKpi.querySelector("span"), strong = firstKpi.querySelector("strong"), small = firstKpi.querySelector("small");
      if (span) span.textContent = "Extraídas";
      if (strong) strong.textContent = leads.length.toLocaleString("pt-BR");
      if (small) small.textContent = `${inside.toLocaleString("pt-BR")} dentro do raio${unknown ? ` · ${unknown} sem posição` : ""}`;
    }
    const subtitle = document.querySelector("#v4MapSubtitle");
    if (subtitle && leads.length) subtitle.textContent = `Raio de ${Number(meta.radiusKm || 5)} km · ${inside} dentro · todos os ${leads.length} extraídos permanecem na lista`;

    const byName = new Map();
    leads.forEach(lead => {
      const key = normalize(lead.name);
      if (!key) return;
      const list = byName.get(key) || [];
      list.push(lead);
      byName.set(key,list);
    });
    document.querySelectorAll(".v4-lead-card").forEach(card => {
      const key = normalize(card.querySelector("h3")?.textContent || "");
      const lead = byName.get(key)?.[0];
      if (!lead) return;
      const distance = card.querySelector(".v4-distance");
      if (lead.radiusStatus === "outside") {
        const km = Number(lead.distanceFromCenterKm);
        if (distance) {
          distance.textContent = Number.isFinite(km) ? `Fora do raio · ${km.toFixed(1).replace(".",",")} km` : "Fora do raio";
          distance.classList.add("v4-radius-outside");
        }
        card.dataset.radiusStatus = "outside";
      } else if (lead.radiusStatus === "unknown") {
        if (distance) distance.textContent = "Localização a confirmar";
        card.dataset.radiusStatus = "unknown";
      } else {
        card.dataset.radiusStatus = "inside";
      }
    });
  }

  const observer = new MutationObserver(() => requestAnimationFrame(refresh));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("radar:maps-data-updated",()=>setTimeout(refresh,40));
  document.addEventListener("DOMContentLoaded",refresh,{once:true});
  setInterval(refresh,1200);
})();
