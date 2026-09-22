/* Radar Maps Collector — V1 coverage wrapper */
importScripts("background.js");

(() => {
  "use strict";

  if (typeof runBatchSearch !== "function") {
    console.error("[Radar V1] runBatchSearch indisponível");
    return;
  }

  const originalRunBatchSearch = runBatchSearch;

  function finitePoint(point) {
    return !!point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
  }

  function coverageReport(result, elapsedMs) {
    const queryCount = Array.isArray(result?.queries) ? result.queries.length : 0;
    const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;
    const successCount = Math.max(0, queryCount - errorCount);
    const successRate = queryCount ? successCount / queryCount : 0;
    const spatial = finitePoint(result?.context?.center);
    const finalCount = Array.isArray(result?.leads) ? result.leads.length : 0;
    const freshCount = Number(result?.freshCount || 0);
    const restoredCount = Number(result?.restoredCount || 0);

    let level = "low";
    if (finalCount > 0 && spatial && successRate >= 0.9 && queryCount >= 4) level = "high";
    else if (finalCount > 0 && successRate >= 0.65) level = "medium";

    const labels = {
      high: "Alta",
      medium: "Média",
      low: "Baixa"
    };

    const descriptions = {
      high: "Varredura espacial concluída com poucas ou nenhuma falha.",
      medium: "A coleta foi útil, mas parte da cobertura pode ter ficado incompleta.",
      low: "A cobertura ficou incompleta. Vale repetir a busca antes de prospectar."
    };

    return {
      level,
      label: labels[level],
      description: descriptions[level],
      mode: spatial ? "spatial" : "text",
      spatial,
      queryCount,
      successCount,
      errorCount,
      successRate: Math.round(successRate * 100),
      freshCount,
      restoredCount,
      finalCount,
      cacheHit: !!result?.cacheHit,
      radiusKm: Number(result?.context?.radiusKm || 0) || null,
      region: String(result?.context?.region || "").trim(),
      elapsedMs: Math.max(0, Number(elapsedMs || 0)),
      generatedAt: new Date().toISOString()
    };
  }

  runBatchSearch = async function(...args) {
    const startedAt = Date.now();
    const result = await originalRunBatchSearch(...args);
    const report = coverageReport(result, Date.now() - startedAt);

    broadcast({
      event: "BATCH_PROGRESS",
      stage: "coverage_report",
      current: report.queryCount,
      total: report.queryCount,
      coverageReport: report,
      text: `Cobertura ${report.label.toLowerCase()} · ${report.successCount}/${report.queryCount} buscas concluídas · ${report.finalCount} negócios consolidados.`
    });

    return { ...result, coverageReport: report };
  };
})();
