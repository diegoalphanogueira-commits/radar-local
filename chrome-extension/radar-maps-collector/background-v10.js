// RC25 mantém todo o background RC24 e substitui apenas a descoberta de mercado.
// O objetivo é evitar varreduras espaciais extras quando a primeira passagem já
// atingiu a cobertura solicitada dentro do raio.
importScripts("background-v9.js");

function rc25PhoneDigits(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
  return phone.length === 10 || phone.length === 11 ? phone : "";
}

function rc25WithWhatsApp(lead) {
  const out = { ...(lead || {}) };
  const website = String(out.website || "").trim();
  if (!out.whatsapp && /(?:wa\.me\/|api\.whatsapp\.com\/send|whatsapp\.com\/send)/i.test(website)) {
    out.whatsapp = website;
    out.whatsappStatus = "explicit";
  }
  const phone = rc25PhoneDigits(out.phone || out.companyPhone);
  if (phone && !out.whatsappCandidate) {
    out.whatsappCandidate = `https://wa.me/55${phone}`;
    if (!out.whatsappStatus) out.whatsappStatus = "phone-candidate";
  }
  return out;
}

const rc25BaseSetLeads = setLeads;
setLeads = async function setLeadsRc25(rows) {
  return rc25BaseSetLeads((Array.isArray(rows) ? rows : []).map(rc25WithWhatsApp));
};

const rc25TargetCount = mode => mode === "30" ? 30 : mode === "50" ? 50 : mode === "100" ? 100 : Infinity;

runMarket = async function runMarketRc25(message) {
  await cancelAll("new-search");
  const run = {
    id: String(message.sessionId || `run-${Date.now()}`),
    cancelled: false,
    tabs: new Set(),
    term: message.term,
    region: message.region,
    discoveryPass: 1,
    discoveryPasses: 1
  };
  activeRun = run;

  const center = await geocode(message.region);
  run.center = center;
  const context = { region: message.region, radiusKm: Number(message.radiusKm || 5), center };
  const cached = await getCached(message);
  let leads = merge(cached?.leads || [], message.seedLeads || []);
  leads = await setLeads(leads);

  const mode = ["30", "50", "100", "max"].includes(String(message.targetMode)) ? String(message.targetMode) : "50";
  const target = rc25TargetCount(mode);
  const anchors = coverageAnchors(center, context.radiusKm, mode);
  const plannedPasses = Math.max(1, anchors.length);

  await setProgress({
    sessionId: run.id,
    phase: "discovery",
    state: "running",
    current: 0,
    total: plannedPasses,
    percent: 3,
    accumulated: leads.length,
    ...geoStats(leads, center, context.radiusKm),
    text: `Carregando “${message.term}” até o fim. Só amplia a cobertura se a primeira passagem não atingir a meta.`
  });

  const firstUrl = mapsUrl(message.term, message.region, anchors[0] || center, context.radiusKm);
  const tab = await chrome.tabs.create({ url: firstUrl, active: false });
  run.tabs.add(tab.id);

  let scansDone = 0;
  let stoppedOnTarget = false;
  const scanMetrics = [];

  try {
    for (let index = 0; index < anchors.length; index += 1) {
      if (!runAlive(run)) throw new Error("CANCELLED");
      const anchor = anchors[index];
      const pass = index + 1;
      run.discoveryPass = pass;
      run.discoveryPasses = plannedPasses;
      run.discoveryLabel = anchor?.label || "região";

      if (index > 0) {
        const nextUrl = mapsUrl(message.term, message.region, anchor || center, context.radiusKm);
        await chrome.tabs.update(tab.id, { url: nextUrl, active: false });
      }

      await waitTab(tab.id, 25000);
      if (!runAlive(run)) throw new Error("CANCELLED");
      await sleep(index === 0 ? 500 : 650);

      emit(run, {
        event: "SEARCH_PROGRESS",
        stage: "opening",
        current: pass,
        total: plannedPasses,
        query: message.term,
        area: run.discoveryLabel,
        text: `Varredura ${pass}/${plannedPasses} · ${run.discoveryLabel}`
      });

      const scanMode = index === 0 ? mode : (mode === "max" ? "50" : "30");
      const response = await sendRetry(tab.id, { cmd: "SCAN_SCROLL", mode: scanMode, sessionId: run.id }, 5);
      if (!response?.ok) continue;

      const before = leads.length;
      leads = await setLeads(merge(leads, response.leads || []));
      leads = await saveCached(message, leads, center);
      const added = Math.max(0, leads.length - before);
      scansDone += 1;

      const stats = geoStats(leads, center, context.radiusKm);
      scanMetrics.push({
        area: anchor?.label || "região",
        added,
        unique: response.metrics?.unique || 0,
        stopReason: response.metrics?.stopReason || ""
      });

      const percent = 5 + Math.round((scansDone / plannedPasses) * 63);
      const reachedTarget = mode !== "max" && Number.isFinite(target) && stats.inRadius >= target;
      const statusText = reachedTarget && scansDone < plannedPasses
        ? `${stats.inRadius} empresas dentro do raio: meta atingida sem repetir a região.`
        : `${leads.length} empresas únicas · ${stats.inRadius} dentro do raio · +${added} na área ${anchor?.label || "região"}.`;

      await setProgress({
        sessionId: run.id,
        phase: "discovery",
        state: "running",
        current: scansDone,
        total: plannedPasses,
        percent,
        accumulated: leads.length,
        ...stats,
        text: statusText
      });

      emit(run, {
        event: "MARKET_PARTIAL",
        current: scansDone,
        total: plannedPasses,
        accumulated: leads.length,
        inRadiusCount: stats.inRadius,
        added,
        area: anchor?.label || "região",
        text: statusText
      });

      if (reachedTarget) {
        stoppedOnTarget = scansDone < plannedPasses;
        break;
      }
    }
  } finally {
    run.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }

  leads = await setLeads(merge(leads, await getLeads()));
  leads = await saveCached(message, leads, center);
  const stats = geoStats(leads, center, context.radiusKm);
  const completedPasses = Math.max(1, scansDone);

  await setProgress({
    sessionId: run.id,
    phase: "discovery_done",
    state: "running",
    current: completedPasses,
    total: completedPasses,
    percent: 70,
    accumulated: leads.length,
    ...stats,
    text: stoppedOnTarget
      ? `Descoberta concluída em ${completedPasses} passagem: ${stats.inRadius} empresas no raio. Agora completando telefone e site.`
      : `Descoberta concluída: ${leads.length} empresas únicas. Agora completando telefone e site.`
  });

  emit(run, {
    event: "BATCH_PROGRESS",
    stage: "done",
    current: completedPasses,
    total: completedPasses,
    accumulated: leads.length,
    inRadiusCount: stats.inRadius,
    text: stoppedOnTarget
      ? `Meta atingida cedo; ${plannedPasses - completedPasses} varredura(s) desnecessária(s) foram evitadas.`
      : `${leads.length} empresas únicas após cobertura espacial.`
  });

  if (activeRun?.id === run.id) activeRun = null;
  return {
    leads,
    context,
    errors: [],
    searchesDone: scansDone,
    plannedSearches: plannedPasses,
    bestCount: leads.length,
    geoStats: stats,
    scanMetrics,
    adaptiveStop: stoppedOnTarget
  };
};
