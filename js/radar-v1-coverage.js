/* Radar Local V1 — visual de cobertura da descoberta */
(() => {
  "use strict";

  if (window.RadarV1CoverageUi) return;
  window.RadarV1CoverageUi = true;

  const META_KEY = "radarMapsImportedMetaV2";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const $ = (selector, root = document) => root.querySelector(selector);

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveCoverage(report) {
    if (!report || !report.level) return;
    const meta = loadMeta();
    localStorage.setItem(META_KEY, JSON.stringify({ ...meta, discoveryCoverage: report }));
  }

  function coverageCopy(report) {
    if (!report) return { label: "Aguardando", detail: "Faça uma busca completa para medir a cobertura." };
    const success = `${Number(report.successCount || 0)}/${Number(report.queryCount || 0)} buscas`;
    const mode = report.spatial ? "raio validado" : "busca textual";
    const recovered = Number(report.restoredCount || 0) > 0 ? ` · +${Number(report.restoredCount)} da memória` : "";
    return {
      label: report.label || "—",
      detail: `${success} concluídas · ${mode}${recovered}`
    };
  }

  function ensureHeaderCard() {
    const header = $(".v4-header");
    const history = $(".v4-history-badge", header || document);
    if (!header || !history) return null;

    let side = $(".v1-header-metrics", header);
    if (!side) {
      side = document.createElement("div");
      side.className = "v1-header-metrics";
      history.parentNode.insertBefore(side, history);
      side.appendChild(history);
    }

    let card = $("#v1CoverageCard", side);
    if (!card) {
      card = document.createElement("div");
      card.id = "v1CoverageCard";
      card.className = "v1-coverage-card level-empty";
      card.innerHTML = `
        <span class="v1-coverage-kicker">Cobertura da busca</span>
        <div class="v1-coverage-value"><i></i><strong id="v1CoverageLabel">Aguardando</strong></div>
        <small id="v1CoverageDetail">Faça uma busca completa para medir a cobertura.</small>`;
      side.appendChild(card);
    }
    return card;
  }

  function render(report = loadMeta().discoveryCoverage) {
    const card = ensureHeaderCard();
    if (!card) return;
    const data = coverageCopy(report);
    card.classList.remove("level-high", "level-medium", "level-low", "level-empty");
    card.classList.add(report?.level ? `level-${report.level}` : "level-empty");
    $("#v1CoverageLabel", card).textContent = data.label;
    $("#v1CoverageDetail", card).textContent = data.detail;
    card.title = report?.description || "A cobertura mede a execução da varredura, não o tamanho total do banco interno do Google.";

    const badge = $("#rlpBadge");
    if (badge && report?.label) {
      badge.textContent = `COBERTURA ${String(report.label).toUpperCase()}`;
      badge.dataset.coverage = report.level;
    }
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== TARGET) return;

    if (message.type === "PROGRESS" && message.progress?.coverageReport) {
      saveCoverage(message.progress.coverageReport);
      render(message.progress.coverageReport);
      return;
    }

    if (message.type === "BATCH_RESULT" && message.response?.coverageReport) {
      saveCoverage(message.response.coverageReport);
      render(message.response.coverageReport);
    }
  });

  window.addEventListener("radar:maps-data-updated", () => setTimeout(() => render(), 80));
  const observer = new MutationObserver(() => render());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => render(), { once: true });
  else render();
  setTimeout(() => render(), 900);
})();
