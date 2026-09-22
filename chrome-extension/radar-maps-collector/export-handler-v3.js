(() => {
  "use strict";
  const STORAGE_KEY = "radarMapsCollectorLeadsV3";

  async function leads() {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function makeCsv(rows) {
    const header = ["Nome","Categoria","Nota","Avaliacoes","Telefone","Site","Endereco","Lat","Lng","LinkMaps","Horario","DataColeta"];
    const out = [header.map(csvCell).join(";")];
    rows.forEach(lead => out.push([
      lead.name || "", lead.category || "", lead.rating ?? "", lead.reviews ?? "",
      lead.phone || "", lead.website || "", lead.address || "", lead.lat ?? "", lead.lng ?? "",
      lead.mapsUrl || "", lead.hours || "", lead.collectedAt || lead.detailedAt || ""
    ].map(csvCell).join(";")));
    return "\uFEFF" + out.join("\n");
  }

  async function download(text, mime, filename) {
    const url = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    await chrome.downloads.download({ url, filename, saveAs: true });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["EXPORT_JSON", "EXPORT_CSV"].includes(message?.cmd)) return;
    (async () => {
      const rows = await leads();
      const date = new Date().toISOString().slice(0, 10);
      if (message.cmd === "EXPORT_JSON") {
        await download(JSON.stringify(rows, null, 2), "application/json", `radar-maps-${date}.json`);
      } else {
        await download(makeCsv(rows), "text/csv", `radar-maps-${date}.csv`);
      }
      sendResponse({ ok: true, count: rows.length });
    })().catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });
})();
