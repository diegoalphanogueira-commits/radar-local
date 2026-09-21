/* =========================================================
   RADAR LOCAL — LOADER V6
   Mantém o relatório atual e substitui somente o mapa
   por Google Maps + Google Places via backend protegido.
   Também captura o benchmark devolvido pela mesma consulta.
========================================================= */

(() => {
  const VERSION = "20260920-benchmark-v2";

  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  /*
    O relatório legado ainda contém o mapa antigo em Leaflet/Geoapify.
    Desabilitamos apenas esse mapa para que o restante do relatório continue
    funcionando normalmente. O novo mapa é carregado logo em seguida.
  */
  window.L = undefined;

  loadScript(`js/proposta-legacy.js?v=${VERSION}`)
    .then(() => loadScript(`js/benchmark-capture.js?v=${VERSION}`))
    .then(() => loadScript(`js/google-report-map.js?v=${VERSION}`))
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
