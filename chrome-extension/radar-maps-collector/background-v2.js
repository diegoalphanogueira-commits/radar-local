/* Radar Maps Collector — V1 RC10 canonical coverage wrapper */
importScripts("background.js", "site-enrichment.js");

(() => {
  "use strict";

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

  const SEGMENTS = [
    { id: "barbearia", re: /barbear|barber|corte masculino|barba e cabelo|salao masculino/ },
    { id: "odontologia", re: /odont|dentist|dental|ortodont|implantodont|endodont|protese dentaria/ },
    { id: "estetica", re: /estet|harmoniza|depila|limpeza de pele|spa estet|beleza/ },
    { id: "manicure", re: /manicure|pedicure|esmalter|nail|unha/ },
    { id: "podologia", re: /podolog/ },
    { id: "pet-veterinaria", re: /pet shop|petshop|veterin|banho e tosa|hotel para caes|creche para caes/ },
    { id: "seguros", re: /seguro|corretor de seguro/ },
    { id: "imobiliaria", re: /imobili|imoveis|corretor de imovel/ },
    { id: "contabilidade", re: /contab|contador/ },
    { id: "advocacia", re: /advoc|advog/ },
    { id: "academia", re: /academia|fitness|muscul|personal trainer/ },
    { id: "restaurante", re: /restaurante|pizzaria|lanchonete|hamburg/ }
  ];

  function canonicalSegment(queries = []) {
    const hay = normalize((Array.isArray(queries) ? queries : []).join(" "));
    return SEGMENTS.find(item => item.re.test(hay))?.id || "";
  }

  if (typeof searchFingerprint === "function") {
    const originalSearchFingerprint = searchFingerprint;
    searchFingerprint = function(queries, context = {}) {
      const segment = canonicalSegment(queries);
      const region = normalize(context.region || "");
      const radius = Math.max(1, Number(context.radiusKm || 5) || 5);
      if (segment && region) return `segment:${segment}|region:${region}|radius:${radius}`;
      return originalSearchFingerprint(queries, context);
    };
  }

  if (typeof runQueryExhaustive === "function") {
    runQueryExhaustive = async function(query, maxScrolls, queryIndex, queryTotal, context = {}) {
      let result = { leads: await getLeads(), found: [], added: 0 };
      const spatial = !!(context?.center && Number.isFinite(Number(context.center.lat)) && Number.isFinite(Number(context.center.lng)));
      const targetPasses = spatial ? 3 : 2;
      const anchors = coverageAnchors(context.center, context.radiusKm);

      for (let pass = 1; pass <= targetPasses; pass += 1) {
        const anchor = anchors[(queryIndex + pass - 1) % anchors.length] || context.center || null;
        broadcast({
          event: "BATCH_PROGRESS",
          stage: "searching",
          current: queryIndex + 1,
          total: queryTotal,
          pass,
          totalPasses: targetPasses,
          query,
          text: `Busca ${queryIndex + 1}/${queryTotal} · passagem ${pass}/${targetPasses}${anchor?.label ? ` · ${anchor.label}` : ""}: ${query}`
        });

        result = await runSearch(query, Math.max(90, Number(maxScrolls) || 90), pass, targetPasses, context, anchor);

        broadcast({
          event: "BATCH_PROGRESS",
          stage: "pass_done",
          current: queryIndex + 1,
          total: queryTotal,
          pass,
          totalPasses: targetPasses,
          query,
          added: result.added,
          accumulated: result.leads.length,
          text: `Passagem ${pass}: ${result.added} empresas novas · ${result.leads.length} únicas acumuladas.`
        });

        if (!spatial && pass >= 2 && result.added === 0) break;
        if (pass < targetPasses) await sleep(1500 + Math.round(Math.random() * 900));
      }
      return result;
    };
  }

  if (typeof runBatchSearch !== "function") {
    console.error("[Radar V1 RC10] runBatchSearch indisponível");
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
    if (finalCount > 0 && spatial && successRate >= 0.9 && queryCount >= 5) level = "high";
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
