/* Radar Maps Collector — V1 coverage wrapper */
importScripts("background.js", "site-enrichment.js");

(() => {
  "use strict";

  if (typeof runBatchSearch !== "function") {
    console.error("[Radar V1] runBatchSearch indisponível");
    return;
  }

  const originalRunBatchSearch = runBatchSearch;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

  const QUERY_FAMILIES = [
    {
      id: "barbearia",
      test: /barbear|barber|corte masculino|barba e cabelo|salao masculino/,
      terms: ["barbearia","barbeiro","barber shop","barbearia masculina","corte masculino","barba e cabelo","salão masculino","barbearia premium","cabelo masculino","barbearia perto de mim"]
    },
    {
      id: "odontologia",
      test: /odont|dentist|dental|ortodont|implantodont|endodont/,
      terms: ["dentista","clínica odontológica","odontologia","consultório odontológico","cirurgião dentista","ortodontista","implantodontista","implante dentário","odontopediatra","endodontista","prótese dentária","clareamento dental"]
    },
    {
      id: "manicure",
      test: /manicure|pedicure|esmalter|nail|unha/,
      terms: ["manicure","pedicure","manicure e pedicure","esmalteria","nail designer","alongamento de unhas","unhas em gel","salão de manicure","studio de unhas","designer de unhas"]
    },
    {
      id: "estetica",
      test: /estet|harmoniza|depila|limpeza de pele|spa estet|beleza/,
      terms: ["clínica de estética","centro de estética","estética facial","estética corporal","estética avançada","harmonização facial","limpeza de pele","depilação a laser","esteticista","spa estético"]
    },
    {
      id: "podologia",
      test: /podolog/,
      terms: ["podologia","clínica de podologia","podólogo","podóloga","tratamento dos pés","podologia clínica"]
    }
  ];

  function canonicalQueries(rawQueries, context = {}) {
    const queries = Array.isArray(rawQueries) ? rawQueries : [];
    const region = String(context.region || "").trim();
    if (!region || !queries.length) return queries;

    const haystack = normalize(queries.join(" "));
    const family = QUERY_FAMILIES.find(item => item.test.test(haystack));
    if (!family) return queries;

    return family.terms.map(term => `${term} ${region}`.trim());
  }

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

    const labels = { high: "Alta", medium: "Média", low: "Baixa" };
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

  runBatchSearch = async function(rawQueries, maxScrolls, replace, rawContext) {
    const startedAt = Date.now();
    const expandedQueries = canonicalQueries(rawQueries, rawContext || {});
    const result = await originalRunBatchSearch(expandedQueries, maxScrolls, replace, rawContext);
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
