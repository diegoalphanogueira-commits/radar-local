const STORAGE_KEY = "radarMapsCollectorLeadsV1";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getLeads() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setLeads(leads) {
  await chrome.storage.local.set({ [STORAGE_KEY]: leads });
  return leads;
}

function leadKey(lead) {
  return String(lead?.mapsUrl || `${lead?.name || ""}|${lead?.address || ""}`).trim();
}

function mergeLeads(existing, incoming) {
  const map = new Map();
  [...existing, ...incoming].forEach(lead => {
    if (!lead) return;
    const key = leadKey(lead);
    if (!key) return;
    const prev = map.get(key) || {};
    const merged = { ...prev };
    Object.entries(lead).forEach(([field, value]) => {
      if (value !== "" && value !== null && value !== undefined) merged[field] = value;
    });
    map.set(key, merged);
  });
  return [...map.values()];
}

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("TIMEOUT"));
    }, timeoutMs);

    function listener(updatedId, info) {
      if (updatedId !== tabId || info.status !== "complete" || done) return;
      done = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function sendToTabWithRetry(tabId, message, attempts = 5) {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response) return response;
    } catch (error) {
      lastError = error;
    }
    await sleep(900 + i * 450);
  }
  throw lastError || new Error("CONTENT_SCRIPT_UNAVAILABLE");
}

async function runSearch(query, maxScrolls = 45) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) throw new Error("Informe segmento e região.");

  broadcast({ event: "SEARCH_PROGRESS", stage: "opening", text: "Abrindo a busca no Google Maps...", query: cleanQuery });
  const url = `https://www.google.com/maps/search/${encodeURIComponent(cleanQuery)}`;
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabComplete(tab.id, 35000).catch(() => {});
    await sleep(2200);
    broadcast({ event: "SEARCH_PROGRESS", stage: "scanning", text: "Percorrendo os resultados da região...", query: cleanQuery });

    const response = await sendToTabWithRetry(tab.id, { cmd: "SCAN_SCROLL", maxScrolls }, 6);
    if (!response?.ok) throw new Error(response?.error || "Falha ao ler os resultados do Maps.");

    const existing = await getLeads();
    const leads = mergeLeads(existing, Array.isArray(response.leads) ? response.leads : []);
    await setLeads(leads);

    broadcast({
      event: "SEARCH_PROGRESS",
      stage: "done",
      text: `${response.leads?.length || 0} negócios encontrados nesta busca.`,
      query: cleanQuery,
      count: response.leads?.length || 0
    });
    return leads;
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function runBatchSearch(rawQueries, maxScrolls = 32, replace = true) {
  const queries = [...new Set((Array.isArray(rawQueries) ? rawQueries : [])
    .map(query => String(query || "").trim())
    .filter(Boolean))].slice(0, 12);
  if (!queries.length) throw new Error("Nenhuma busca válida foi informada.");
  if (replace) await setLeads([]);

  const errors = [];
  for (let index = 0; index < queries.length; index += 1) {
    const query = queries[index];
    broadcast({
      event: "BATCH_PROGRESS",
      stage: "searching",
      current: index + 1,
      total: queries.length,
      query,
      text: `Busca ${index + 1} de ${queries.length}: ${query}`
    });
    try {
      await runSearch(query, Math.max(10, Math.min(Number(maxScrolls) || 32, 60)));
    } catch (error) {
      errors.push({ query, error: error?.message || "SEARCH_FAILED" });
      console.warn("[RadarMapsCollector] batch", query, error);
    }
    await sleep(800 + Math.round(Math.random() * 600));
  }

  const leads = await getLeads();
  broadcast({
    event: "BATCH_PROGRESS",
    stage: "done",
    current: queries.length,
    total: queries.length,
    text: `${leads.length} negócios únicos acumulados.`
  });
  return { leads, errors, queries };
}

async function enrichOne(lead) {
  if (!lead?.mapsUrl) return lead;
  const tab = await chrome.tabs.create({ url: lead.mapsUrl, active: false });
  try {
    await waitForTabComplete(tab.id, 25000).catch(() => {});
    await sleep(1500 + Math.round(Math.random() * 650));
    const response = await sendToTabWithRetry(tab.id, { cmd: "EXTRACT_DETAIL" }, 4).catch(() => null);
    if (!response?.ok || !response.lead) return lead;
    return mergeLeads([lead], [response.lead])[0];
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function enrichAll(limit = 60) {
  let leads = await getLeads();
  const indexes = leads
    .map((lead, index) => ({ lead, index }))
    .filter(item => item.lead?.mapsUrl)
    .slice(0, Math.max(1, Math.min(Number(limit) || 60, 120)));

  for (let position = 0; position < indexes.length; position += 1) {
    const item = indexes[position];
    try {
      leads[item.index] = await enrichOne(item.lead);
      await setLeads(leads);
      broadcast({
        event: "ENRICH_PROGRESS",
        current: position + 1,
        total: indexes.length,
        lead: leads[item.index]
      });
      await sleep(650 + Math.round(Math.random() * 500));
    } catch (error) {
      console.warn("[RadarMapsCollector] detail", error);
    }
  }
  return leads;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function makeCsv(leads) {
  const header = ["Nome","Categoria","Nota","Avaliacoes","Telefone","Site","Endereco","Lat","Lng","LinkMaps","Horario","DataColeta"];
  const rows = [header.map(csvCell).join(";")];
  leads.forEach(lead => {
    rows.push([
      lead.name || "", lead.category || "", lead.rating ?? "", lead.reviews ?? "", lead.phone || "", lead.website || "", lead.address || "", lead.lat ?? "", lead.lng ?? "", lead.mapsUrl || "", lead.hours || "", lead.collectedAt || lead.detailedAt || ""
    ].map(csvCell).join(";"));
  });
  return "\uFEFF" + rows.join("\n");
}

async function downloadText(text, mime, filename) {
  const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.cmd === "GET_STATE") {
      const leads = await getLeads();
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "RUN_SEARCH") {
      if (message.replace !== false) await setLeads([]);
      let leads = await runSearch(message.query, Number(message.maxScrolls) || 45);
      if (message.enrich !== false && leads.length) {
        broadcast({ event: "SEARCH_PROGRESS", stage: "enriching", text: "Completando telefone, site e horário das empresas..." });
        leads = await enrichAll(Number(message.enrichLimit) || 60);
      }
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "RUN_BATCH_SEARCH") {
      const result = await runBatchSearch(message.queries, Number(message.maxScrolls) || 32, message.replace !== false);
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message?.cmd === "STORE_LEADS") {
      const existing = await getLeads();
      const leads = mergeLeads(existing, Array.isArray(message.leads) ? message.leads : []);
      await setLeads(leads);
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "CLEAR") {
      await setLeads([]);
      sendResponse({ ok: true, leads: [] });
      return;
    }

    if (message?.cmd === "ENRICH_ALL") {
      const leads = await enrichAll(Number(message.limit) || 60);
      sendResponse({ ok: true, leads });
      return;
    }

    if (message?.cmd === "EXPORT_JSON") {
      const leads = await getLeads();
      await downloadText(JSON.stringify(leads, null, 2), "application/json", `radar-maps-${new Date().toISOString().slice(0,10)}.json`);
      sendResponse({ ok: true });
      return;
    }

    if (message?.cmd === "EXPORT_CSV") {
      const leads = await getLeads();
      await downloadText(makeCsv(leads), "text/csv", `radar-maps-${new Date().toISOString().slice(0,10)}.csv`);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "UNKNOWN_COMMAND" });
  })().catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
