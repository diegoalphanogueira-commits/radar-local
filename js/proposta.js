/* =========================================================
   RADAR LOCAL — LOADER V16
   Mantém o relatório atual, carrega Google Maps/Places,
   aplica páginas leves e benchmark baseado no Top 5 local.
========================================================= */

(() => {
  const VERSION = "20260920-report-light-v9";

  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  window.L = undefined;

  loadScript(`js/proposta-legacy.js?v=${VERSION}`)
    .then(() => loadScript(`js/benchmark-capture.js?v=${VERSION}`))
    .then(() => loadScript(`js/google-report-map.js?v=${VERSION}`))
    .then(() => loadScript(`js/benchmark-report.js?v=${VERSION}`))
    .then(() => loadScript(`js/benchmark-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/benchmark-top5.js?v=${VERSION}`))
    .then(() => loadScript(`js/demand-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/map-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/score-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/journey-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/cta-light.js?v=${VERSION}`))
    .then(() => loadScript(`js/cta-polish.js?v=${VERSION}`))
    .then(() => loadScript(`js/segmentless-report.js?v=${VERSION}`))
    .catch(error => {
      console.error("[RadarLoader]", error);

      const mapElement = document.getElementById("opportunityMap");
      if (mapElement) {
        mapElement.innerHTML = `
          <div style="height:100%;min-height:300px;display:grid;place-items:center;text-align:center;padding:30px;color:#7b8798;">
            Não foi possível carregar o mapa neste momento.
          </div>
        `;
      }
    });
})();
