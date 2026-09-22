/* =========================================================
   RADAR LOCAL — MAPS COLLECTOR V2
   Importa CSV/JSON de extensões de Google Maps e renderiza
   mapa, métricas e cards visuais sem usar Places API.
========================================================= */
(() => {
  "use strict";

  const STORAGE_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";

  const state = {
    leads: loadLeads(),
    filtered: [],
    map: null,
    markers: null,
    selectedId: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
  const digits = value => String(value || "").replace(/\D/g, "");

  const fieldAliases = {
    name: ["nome", "name", "business name", "empresa", "company", "title", "estabelecimento"],
    category: ["categoria", "category", "segmento", "tipo", "type", "primary category"],
    rating: ["nota", "rating", "avaliacao", "avaliação", "stars", "star rating"],
    reviews: ["avaliacoes", "avaliações", "reviews", "reviews count", "review count", "numero de avaliacoes", "número de avaliações"],
    phone: ["telefone", "phone", "telefone normalizado", "telefonenormalizado", "mobile", "celular", "whatsapp"],
    website: ["site", "website", "website url", "url site", "authority"],
    address: ["endereco", "endereço", "address", "full address"],
    city: ["cidade", "city", "municipio", "município"],
    state: ["estado", "state", "uf", "province"],
    neighborhood: ["bairro", "neighborhood", "district", "suburb"],
    lat: ["lat", "latitude"],
    lng: ["lng", "lon", "long", "longitude"],
    mapsUrl: ["linkmaps", "link maps", "google maps url", "maps url", "google url", "place url", "url", "link"],
    hours: ["horario", "horário", "hours", "opening hours", "schedule"],
    plusCode: ["plus code", "pluscode", "codigo plus", "código plus"],
    searchTerm: ["termo", "search term", "keyword", "consulta"],
    quadrant: ["quadrante", "quadrant", "ponto", "coverage point"],
    collectedAt: ["datacoleta", "data coleta", "collected at", "date", "timestamp"]
  };

  function loadLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveLeads() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leads));
    } catch (error) {
      console.warn("[RadarMapsCollector] storage", error);
    }
  }

  function saveMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {}
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const raw = String(value).trim().replace(/\s/g, "");
    if (!raw) return null;
    const compact = raw.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const number = Number(compact.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(number) ? number : null;
  }

  function parseReviews(value) {
    if (value === null || value === undefined || value === "") return null;
    const raw = normalize(value);
    const match = raw.match(/([0-9]+(?:[.,][0-9]+)?)\s*([km])?/i);
    if (!match) return parseNumber(value);
    let n = Number(match[1].replace(",", "."));
    if (match[2] === "k") n *= 1000;
    if (match[2] === "m") n *= 1000000;
    return Math.round(n);
  }

  function normalizePhone(value) {
    let v = digits(value);
    if (!v) return "";
    if (v.length > 11 && v.startsWith("55")) v = v.slice(2);
    return v;
  }

  function formatPhone(value) {
    const v = normalizePhone(value);
    if (v.length === 11) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return String(value || "");
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^www\./i.test(raw)) return `https://${raw}`;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)) return `https://${raw}`;
    return raw;
  }

  function parseCoordinatesFromUrl(url) {
    const raw = String(url || "");
    let match = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    match = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    match = raw.match(/[?&](?:query|q)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    return { lat: null, lng: null };
  }

  function getField(row, field) {
    const aliases = fieldAliases[field] || [];
    const entries = Object.entries(row || {});
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      const match = entries.find(([key]) => normalize(key) === normalizedAlias);
      if (match && String(match[1] ?? "").trim() !== "") return match[1];
    }
    return "";
  }

  function standardizeRow(row, index = 0) {
    const mapsUrl = normalizeUrl(getField(row, "mapsUrl"));
    const urlCoords = parseCoordinatesFromUrl(mapsUrl);
    const lat = parseNumber(getField(row, "lat"));
    const lng = parseNumber(getField(row, "lng"));
    const name = String(getField(row, "name") || "").trim();
    const address = String(getField(row, "address") || "").trim();
    const phone = normalizePhone(getField(row, "phone"));
    const website = normalizeUrl(getField(row, "website"));
    const city = String(getField(row, "city") || "").trim();
    const stateCode = String(getField(row, "state") || "").trim();
    const idSeed = [name, address, phone, mapsUrl, index].join("|");
    let hash = 0;
    for (let i = 0; i < idSeed.length; i += 1) hash = ((hash << 5) - hash + idSeed.charCodeAt(i)) | 0;

    return {
      id: `maps-${Math.abs(hash)}`,
      source: "google-maps-import",
      name: name || "Empresa sem nome",
      category: String(getField(row, "category") || "").trim(),
      rating: parseNumber(getField(row, "rating")),
      reviews: parseReviews(getField(row, "reviews")),
      phone,
      website,
      address,
      city,
      state: stateCode,
      neighborhood: String(getField(row, "neighborhood") || "").trim(),
      lat: Number.isFinite(lat) ? lat : urlCoords.lat,
      lng: Number.isFinite(lng) ? lng : urlCoords.lng,
      mapsUrl,
      hours: String(getField(row, "hours") || "").trim(),
      plusCode: String(getField(row, "plusCode") || "").trim(),
      searchTerm: String(getField(row, "searchTerm") || "").trim(),
      quadrant: String(getField(row, "quadrant") || "").trim(),
      collectedAt: String(getField(row, "collectedAt") || "").trim(),
      raw: row
    };
  }

  function detectDelimiter(text) {
    const line = String(text || "").split(/\r?\n/).find(Boolean) || "";
    const options = [";", "\t", ","];
    return options
      .map(delimiter => ({ delimiter, count: line.split(delimiter).length - 1 }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter || ";";
  }

  function parseDelimited(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (quoted && next === '"') {
          value += '"';
          i += 1;
        } else quoted = !quoted;
        continue;
      }
      if (char === delimiter && !quoted) {
        row.push(value);
        value = "";
        continue;
      }
      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        value = "";
        if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
        row = [];
        continue;
      }
      value += char;
    }
    if (value || row.length) {
      row.push(value);
      if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
    }
    if (!rows.length) return [];

    const headers = rows.shift().map(header => String(header || "").replace(/^\uFEFF/, "").trim());
    return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function parseJson(text) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.leads)) return parsed.leads;
    if (Array.isArray(parsed?.data)) return parsed.data;
    if (Array.isArray(parsed?.businesses)) return parsed.businesses;
    return [parsed];
  }

  function dedupe(leads) {
    const map = new Map();
    leads.forEach(lead => {
      const key = normalize([
        lead.mapsUrl || "",
        lead.name,
        lead.address,
        lead.phone
      ].filter(Boolean).join("|"));
      if (!map.has(key)) map.set(key, lead);
      else {
        const previous = map.get(key);
        map.set(key, { ...previous, ...Object.fromEntries(Object.entries(lead).filter(([,v]) => v !== "" && v !== null)) });
      }
    });
    return [...map.values()];
  }

  async function importFile(file) {
    if (!file) return;
    const text = await file.text();
    const lower = file.name.toLowerCase();
    let rows;
    if (lower.endsWith(".json")) rows = parseJson(text);
    else rows = parseDelimited(text);

    const leads = rows.map((row, index) => standardizeRow(row, index)).filter(lead => lead.name && lead.name !== "Empresa sem nome");
    if (!leads.length) throw new Error("Nenhum negócio reconhecido no arquivo. Verifique se ele possui uma coluna de nome/empresa.");

    state.leads = dedupe([...state.leads, ...leads]);
    saveLeads();
    saveMeta({ fileName: file.name, importedAt: new Date().toISOString(), count: leads.length });
    render();
    showWorkspace();
    toast(`${leads.length} negócio${leads.length === 1 ? "" : "s"} importado${leads.length === 1 ? "" : "s"}.`);
  }

  function clearImported() {
    state.leads = [];
    state.filtered = [];
    saveLeads();
    localStorage.removeItem(META_KEY);
    render();
    toast("Coleta importada limpa.");
  }

  function filterLeads() {
    const query = normalize($("#mapsLocalFilter")?.value || "");
    const onlyNoSite = $("#mapsNoSiteOnly")?.checked;
    const onlyWithPhone = $("#mapsWithPhoneOnly")?.checked;
    const minRating = parseNumber($("#mapsMinRating")?.value) || 0;
    state.filtered = state.leads.filter(lead => {
      if (onlyNoSite && lead.website) return false;
      if (onlyWithPhone && !lead.phone) return false;
      if (minRating && (!lead.rating || lead.rating < minRating)) return false;
      if (!query) return true;
      return normalize([lead.name, lead.category, lead.address, lead.city, lead.neighborhood, lead.phone, lead.website].join(" ")).includes(query);
    });
  }

  function showWorkspace() {
    $("#mapsWorkspace")?.classList.remove("hidden");
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 100);
  }

  function createMap() {
    if (state.map || !window.L || !$("#prospectingMap")) return;
    state.map = L.map("prospectingMap", { zoomControl: true }).setView([-23.45, -46.53], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(state.map);
    state.markers = L.featureGroup().addTo(state.map);
  }

  function mapPopup(lead) {
    const stars = lead.rating ? `★ ${String(lead.rating).replace(".", ",")}` : "Sem nota";
    const reviews = lead.reviews !== null && lead.reviews !== undefined ? `${Number(lead.reviews).toLocaleString("pt-BR")} avaliações` : "";
    return `
      <div class="maps-popup">
        <strong>${escapeHtml(lead.name)}</strong>
        <span>${escapeHtml(lead.category || "Negócio local")}</span>
        <b>${escapeHtml([stars, reviews].filter(Boolean).join(" · "))}</b>
        <small>${escapeHtml(lead.address || [lead.neighborhood, lead.city, lead.state].filter(Boolean).join(" · "))}</small>
      </div>`;
  }

  function renderMap() {
    createMap();
    if (!state.map || !state.markers) return;
    state.markers.clearLayers();
    const bounds = [];
    state.filtered.forEach(lead => {
      if (!Number.isFinite(lead.lat) || !Number.isFinite(lead.lng)) return;
      const marker = L.marker([lead.lat, lead.lng]).bindPopup(mapPopup(lead));
      marker.on("click", () => highlightLead(lead.id));
      marker.addTo(state.markers);
      bounds.push([lead.lat, lead.lng]);
    });
    if (bounds.length === 1) state.map.setView(bounds[0], 15);
    else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [28, 28] });
  }

  function highlightLead(id) {
    state.selectedId = id;
    $$(".maps-lead-card").forEach(card => card.classList.toggle("selected", card.dataset.id === id));
    const target = document.querySelector(`.maps-lead-card[data-id="${CSS.escape(id)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function formatRating(lead) {
    if (!lead.rating) return "Sem nota";
    const reviews = Number.isFinite(lead.reviews) ? ` · ${lead.reviews.toLocaleString("pt-BR")} avaliações` : "";
    return `★ ${String(lead.rating).replace(".", ",")}${reviews}`;
  }

  function renderLeadCard(lead) {
    const article = document.createElement("article");
    article.className = "maps-lead-card";
    article.dataset.id = lead.id;
    const phoneDisplay = lead.phone ? formatPhone(lead.phone) : "Sem telefone";
    const websiteLabel = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] : "Sem site";
    const mapsHref = lead.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name, lead.address, lead.city, lead.state].filter(Boolean).join(" "))}`;
    const whatsappHref = lead.phone ? `https://wa.me/55${normalizePhone(lead.phone)}` : "";

    article.innerHTML = `
      <div class="maps-lead-top">
        <div>
          <span class="maps-source-tag">GOOGLE MAPS</span>
          <h3>${escapeHtml(lead.name)}</h3>
          <p>${escapeHtml(lead.category || "Categoria não informada")}</p>
        </div>
        <div class="maps-rating"><strong>${escapeHtml(lead.rating ? `★ ${String(lead.rating).replace(".", ",")}` : "—")}</strong><span>${lead.reviews !== null && lead.reviews !== undefined ? `${Number(lead.reviews).toLocaleString("pt-BR")} avaliações` : "sem avaliações"}</span></div>
      </div>
      <div class="maps-lead-info">
        <div><span>Endereço</span><strong>${escapeHtml(lead.address || [lead.neighborhood, lead.city, lead.state].filter(Boolean).join(" · ") || "Não informado")}</strong></div>
        <div><span>Telefone</span><strong>${escapeHtml(phoneDisplay)}</strong></div>
        <div class="${lead.website ? "" : "missing"}"><span>Site</span><strong>${escapeHtml(websiteLabel)}</strong></div>
        <div><span>Horário</span><strong>${escapeHtml(lead.hours || "Não informado")}</strong></div>
      </div>
      <div class="maps-lead-actions">
        <a href="${escapeHtml(mapsHref)}" target="_blank" rel="noopener">Google Maps</a>
        ${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">Abrir site</a>` : ""}
        ${whatsappHref ? `<a href="${escapeHtml(whatsappHref)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button type="button" data-copy>Copiar dados</button>
      </div>`;

    article.querySelector("[data-copy]")?.addEventListener("click", async () => {
      const text = [
        lead.name,
        lead.category ? `Categoria: ${lead.category}` : "",
        lead.rating ? `Google: ${formatRating(lead)}` : "",
        lead.phone ? `Telefone: ${formatPhone(lead.phone)}` : "",
        lead.website ? `Site: ${lead.website}` : "Site: não possui/encontrado",
        lead.address ? `Endereço: ${lead.address}` : "",
        mapsHref ? `Google Maps: ${mapsHref}` : ""
      ].filter(Boolean).join("\n");
      try { await navigator.clipboard.writeText(text); toast("Dados copiados."); }
      catch { window.prompt("Copie os dados:", text); }
    });

    article.addEventListener("mouseenter", () => {
      if (state.selectedId !== lead.id) article.classList.add("hovered");
    });
    article.addEventListener("mouseleave", () => article.classList.remove("hovered"));
    return article;
  }

  function renderList() {
    const list = $("#mapsLeadList");
    if (!list) return;
    list.replaceChildren();
    if (!state.filtered.length) {
      const empty = document.createElement("div");
      empty.className = "maps-empty";
      empty.textContent = state.leads.length ? "Nenhum negócio corresponde aos filtros atuais." : "Importe uma coleta para visualizar os negócios no mapa.";
      list.appendChild(empty);
      return;
    }
    state.filtered.forEach(lead => list.appendChild(renderLeadCard(lead)));
  }

  function renderMetrics() {
    const total = state.filtered.length;
    const withPhone = state.filtered.filter(lead => lead.phone).length;
    const withSite = state.filtered.filter(lead => lead.website).length;
    const noSite = total - withSite;
    const ratings = state.filtered.map(lead => lead.rating).filter(Number.isFinite);
    const avgRating = ratings.length ? (ratings.reduce((sum, n) => sum + n, 0) / ratings.length).toFixed(1).replace(".", ",") : "—";
    const mapped = state.filtered.filter(lead => Number.isFinite(lead.lat) && Number.isFinite(lead.lng)).length;

    const pairs = {
      mapsMetricTotal: total,
      mapsMetricPhone: withPhone,
      mapsMetricNoSite: noSite,
      mapsMetricRating: avgRating,
      mapsMetricMapped: mapped
    };
    Object.entries(pairs).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = typeof value === "number" ? value.toLocaleString("pt-BR") : value;
    });
    const source = $("#mapsSourceLabel");
    if (source) source.textContent = state.leads.length ? `${state.leads.length.toLocaleString("pt-BR")} registros importados` : "Nenhuma coleta carregada";
  }

  function render() {
    filterLeads();
    renderMetrics();
    renderList();
    renderMap();
  }

  function openGoogleMapsSearch() {
    const term = $("#mapsSearchTerm")?.value.trim() || $("#segmentPreset")?.selectedOptions?.[0]?.dataset?.label || "clínica de estética";
    const city = $("#mapsSearchCity")?.value.trim() || $("#city")?.value.trim() || "Guarulhos SP";
    const query = [term, city].filter(Boolean).join(" ");
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, "_blank", "noopener");
  }

  function exportJson() {
    if (!state.filtered.length) return toast("Não há negócios para exportar.");
    const blob = new Blob([JSON.stringify(state.filtered, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `radar-maps-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    const url = link.href;
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("visible"), 1900);
  }

  function wireEvents() {
    $("#mapsImportButton")?.addEventListener("click", () => $("#mapsImportInput")?.click());
    $("#mapsImportInput")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importFile(file); }
      catch (error) { console.error("[RadarMapsCollector]", error); alert(error.message || "Não foi possível importar a coleta."); }
      finally { event.target.value = ""; }
    });
    $("#mapsOpenGoogleButton")?.addEventListener("click", openGoogleMapsSearch);
    $("#mapsClearButton")?.addEventListener("click", () => {
      if (!state.leads.length) return;
      if (window.confirm("Remover toda a coleta importada deste navegador?")) clearImported();
    });
    $("#mapsExportButton")?.addEventListener("click", exportJson);
    ["#mapsLocalFilter", "#mapsMinRating", "#mapsNoSiteOnly", "#mapsWithPhoneOnly"].forEach(selector => {
      const el = $(selector);
      if (!el) return;
      el.addEventListener(el.type === "search" ? "input" : "change", render);
    });
  }

  function boot() {
    wireEvents();
    createMap();
    if (state.leads.length) showWorkspace();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.RadarMapsCollector = {
    getLeads: () => [...state.leads],
    clear: clearImported,
    render
  };
})();
