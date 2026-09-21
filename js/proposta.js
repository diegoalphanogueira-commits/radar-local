/* =========================================================
   RADAR LOCAL — LOADER V9
   Mantém o relatório atual, carrega Google Maps/Places
   e aplica páginas leves de benchmark e demanda.
========================================================= */

(() => {
  const VERSION = "20260920-report-light-v2";

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
    .then(() => loadScript(`js/demand-light.js?v=${VERSION}`))
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
