// RC26 importa o fluxo RC25 e otimiza apenas a etapa de enriquecimento.
// Objetivos:
// 1) não gastar tempo abrindo empresas sabidamente fora do raio;
// 2) reduzir espera por ficha do Google Maps;
// 3) encerrar o enriquecimento com dados parciais em vez de travar o fluxo inteiro.
importScripts("background-v10.js");

const rc26SessionContext = new Map();
const rc26BaseRunMarket = runMarket;

runMarket = async function runMarketRc26(message) {
  const result = await rc26BaseRunMarket(message);
  const sessionId = String(message?.sessionId || "");
  if (sessionId) {
    rc26SessionContext.set(sessionId, {
      center: result?.context?.center || null,
      radiusKm: Number(result?.context?.radiusKm || message?.radiusKm || 5),
      createdAt: Date.now()
    });
    const ordered = [...rc26SessionContext.entries()].sort((a, b) => Number(b[1]?.createdAt || 0) - Number(a[1]?.createdAt || 0));
    ordered.slice(12).forEach(([key]) => rc26SessionContext.delete(key));
  }
  return result;
};

function rc26GeoStatus(lead, context) {
  const center = context?.center;
  if (!center) return "unknown";
  const lat = Number(lead?.lat);
  const lng = Number(lead?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "unknown";
  const distance = haversineKm(center, { lat, lng });
  if (!Number.isFinite(distance)) return "unknown";
  return distance <= Number(context?.radiusKm || 5) ? "inside" : "outside";
}

enrichOne = async function enrichOneRc26(lead, job) {
  if (!lead?.mapsUrl || !enrichAlive(job)) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  job.tabs.add(tab.id);
  let mergedLead = { ...lead };
  try {
    await waitTab(tab.id, 8000);
    if (!enrichAlive(job)) throw new Error("CANCELLED");
    await sleep(220);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!enrichAlive(job)) throw new Error("CANCELLED");
      const response = await sendRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 2).catch(() => null);
      if (response?.ok && response.lead) mergedLead = merge([mergedLead], [response.lead])[0];

      const hasPhone = String(mergedLead.phone || "").replace(/\D/g, "").length >= 10;
      const hasWebsiteField = Object.prototype.hasOwnProperty.call(mergedLead, "website");
      if (hasPhone && hasWebsiteField) break;
      if (attempt < 1) await sleep(320);
    }

    return { ...mergedLead, detailCheckedAt: new Date().toISOString() };
  } finally {
    job.tabs.delete(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {});
  }
};

enrichAll = async function enrichAllRc26(limit = 300, sessionId = "") {
  await cancelEnrich("new-enrich");
  const job = {
    id: String(sessionId || `enrich-${Date.now()}`),
    cancelled: false,
    tabs: new Set(),
    startedAt: Date.now()
  };
  activeEnrich = job;

  let leads = await getLeads();
  const context = rc26SessionContext.get(job.id) || null;
  const requestedLimit = Math.min(Math.max(1, Number(limit || leads.length || 300)), 140);
  const deadline = Date.now() + 165000;

  const queue = leads
    .map((lead, index) => ({
      lead,
      index,
      geo: rc26GeoStatus(lead, context),
      score: (!String(lead.phone || "").trim() ? 100 : 0) + (!String(lead.website || "").trim() ? 35 : 0)
    }))
    .filter(item => item.lead?.mapsUrl && item.score > 0 && item.geo !== "outside")
    .sort((a, b) => {
      const geoDiff = (a.geo === "inside" ? 1 : 0) - (b.geo === "inside" ? 1 : 0);
      if (geoDiff) return -geoDiff;
      return b.score - a.score;
    })
    .slice(0, requestedLimit);

  let cursor = 0;
  let done = 0;
  let budgetReached = false;
  const phoneCount0 = leads.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const siteCount0 = leads.filter(x => String(x.website || "").trim()).length;

  await setProgress({
    sessionId: job.id,
    phase: "enrich",
    state: "running",
    current: 0,
    total: queue.length,
    percent: 70,
    accumulated: leads.length,
    phoneCount: phoneCount0,
    siteCount: siteCount0,
    text: `Completando somente fichas úteis do raio em até 6 abas paralelas.`
  });

  async function worker() {
    while (true) {
      if (!enrichAlive(job)) return;
      if (Date.now() >= deadline) {
        budgetReached = true;
        return;
      }

      const pos = cursor++;
      if (pos >= queue.length) return;
      const item = queue[pos];

      try {
        leads[item.index] = await enrichOne(item.lead, job);
        if (enrichAlive(job)) leads = await setLeads(leads);
      } catch (error) {
        if (error?.message === "CANCELLED") return;
      }

      if (!enrichAlive(job)) return;
      done += 1;
      const phoneCount = leads.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
      const siteCount = leads.filter(x => String(x.website || "").trim()).length;
      const percent = 70 + Math.min(1, done / Math.max(1, queue.length)) * 29;

      await setProgress({
        sessionId: job.id,
        phase: "enrich",
        state: "running",
        current: done,
        total: queue.length,
        percent,
        accumulated: leads.length,
        phoneCount,
        siteCount,
        text: `${done}/${queue.length} fichas úteis · ${phoneCount} telefones · ${siteCount} sites.`
      });
      emit(job, {
        event: "ENRICH_PROGRESS",
        current: done,
        total: queue.length,
        accumulated: leads.length,
        phoneCount,
        siteCount,
        lead: leads[item.index]
      });
    }
  }

  const workers = Math.min(6, Math.max(1, queue.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  if (!enrichAlive(job)) throw new Error("CANCELLED");

  const final = await setLeads(leads);
  const phoneCount = final.filter(x => String(x.phone || "").replace(/\D/g, "").length >= 10).length;
  const siteCount = final.filter(x => String(x.website || "").trim()).length;

  await setProgress({
    sessionId: job.id,
    phase: "done",
    state: "done",
    current: done,
    total: queue.length,
    percent: 100,
    accumulated: final.length,
    phoneCount,
    siteCount,
    text: budgetReached
      ? `${final.length} negócios · ${phoneCount} com telefone · ${siteCount} com site · limite de tempo aplicado.`
      : `${final.length} negócios · ${phoneCount} com telefone · ${siteCount} com site.`
  });

  if (activeEnrich?.id === job.id) activeEnrich = null;
  rc26SessionContext.delete(job.id);
  return final;
};
