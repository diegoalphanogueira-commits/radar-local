/* =========================================================
   RADAR LOCAL — MAPS DISCOVERY V3
   Google Maps discovery through the companion Chrome extension,
   CSV/JSON fallback, visual map, filters and Receita/QSA matching.
========================================================= */
(() => {
  "use strict";

  const STORAGE_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const MY_RECEITA_BASE = "https://minhareceita.org";
  const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
  const BRIDGE_SOURCE = "RADAR_LOCAL_WEB";
  const BRIDGE_TARGET = "RADAR_MAPS_COLLECTOR";

  const state = {
    leads: loadLeads(),
    filtered: [],
    map: null,
    markers: null,
    selectedId: null,
    extensionConnected: false,
    extensionVersion: "",
    busy: false,
    revenueBusy: false,
    pending: new Map()
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));

  const STOPWORDS = new Set(["de","da","do","das","dos","e","a","o","ltda","me","eireli","sa","servicos","servico","comercio","comercial","clinica","studio","centro","grupo"]);

  const SEGMENT_CNAES = [
    { re: /estet|beleza|depil|sobrancel|micropigment/, cnaes: ["9602502","9602501"] },
    { re: /cabele|barbear|manicure|pedicure|salao/, cnaes: ["9602501"] },
    { re: /odont|dentista/, cnaes: ["8630504"] },
    { re: /medic|clinica medica/, cnaes: ["8630503","8630501"] },
    { re: /seguro|corretora/, cnaes: ["6622300"] },
    { re: /advoc|advogado/, cnaes: ["6911701"] },
    { re: /contab|contador/, cnaes: ["6920601"] },
    { re: /imobili|corretor de imoveis|corretora de imoveis/, cnaes: ["6821801"] },
    { re: /academia|fitness|musculacao/, cnaes: ["9313100"] },
    { re: /veterin|pet clinic/, cnaes: ["7500100"] },
    { re: /restaurante|pizzaria|hamburgueria|lanchonete/, cnaes: ["5611201","5611203"] },
    { re: /padaria|confeitaria/, cnaes: ["4721102"] },
    { re: /oficina|mecanica|auto center/, cnaes: ["4520001"] },
    { re: /material de construcao|construcao/, cnaes: ["4744099"] },
    { re: /limpeza|higienizacao/, cnaes: ["8121400"] }
  ];

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
    collectedAt: ["datacoleta", "data coleta", "collected at", "date", "timestamp"]
  };

  function installExtraStyles() {
    if ($("#radarMapsV3Styles")) return;
    const style = document.createElement("style");
    style.id = "radarMapsV3Styles";
    style.textContent = `
      .maps-collector-status{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding:12px 14px;border:1px solid #dfe7f1;border-radius:14px;background:#f8fbff}.maps-collector-state{display:flex;align-items:center;gap:9px;min-width:0}.maps-collector-state i{width:9px;height:9px;border-radius:50%;background:#f9ab00;box-shadow:0 0 0 4px rgba(249,171,0,.12);flex:none}.maps-collector-state.ready i{background:#34a853;box-shadow:0 0 0 4px rgba(52,168,83,.12)}.maps-collector-state.error i{background:#ea4335;box-shadow:0 0 0 4px rgba(234,67,53,.12)}.maps-collector-state b{display:block;font-size:.75rem;color:#34465b}.maps-collector-state span{display:block;margin-top:2px;color:#7b8796;font-size:.66rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.maps-auto-detail{display:flex;align-items:center;gap:7px;color:#5c6a7b;font-size:.68rem;font-weight:700;white-space:nowrap}.maps-open-google.collecting{opacity:.65;cursor:wait}.maps-qsa-box{margin-top:13px;padding:12px;border:1px solid #dfe7f1;border-radius:13px;background:#f8fbff}.maps-qsa-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.maps-qsa-head span{font-size:.58rem;font-weight:850;letter-spacing:.07em;color:#6e7d90}.maps-qsa-head b{font-size:.61rem;color:#1666d9}.maps-qsa-box strong{display:block;margin-top:6px;color:#243548;font-size:.77rem}.maps-qsa-box small{display:block;margin-top:4px;color:#6f7e90;font-size:.65rem;line-height:1.45}.maps-qsa-missing{color:#8a5a16!important}.maps-qsa-loading{opacity:.65}.maps-lead-actions button[data-qsa]{background:#eef5ff;border-color:#cfe0fa;color:#1666d9}.maps-compliance-note{margin:10px 0 0;color:#8895a5;font-size:.61rem;line-height:1.5}.maps-compliance-note a{color:#687b91}.maps-match-good{color:#188038!important}.maps-match-medium{color:#a05a00!important}
      @media(max-width:720px){.maps-collector-status{align-items:flex-start;flex-direction:column}.maps-auto-detail{white-space:normal}}
    `;
    document.head.appendChild(style);
  }

  function loadLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function saveLeads() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leads)); }
    catch (error) { console.warn("[RadarMapsV3] storage", error); }
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function saveMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify({ ...loadMeta(), ...meta })); }
    catch {}
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

  function hashId(value) {
    let hash = 0;
    const raw = String(value || "");
    for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return `maps-${Math.abs(hash)}`;
  }

  function parseCoordinatesFromUrl(url) {
    const raw = String(url || "");
    let match = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    match = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    return { lat: null, lng: null };
  }

  function getField(row, field) {
    const aliases = fieldAliases[field] || [];
    const entries = Object.entries(row || {});
    for (const alias of aliases) {
      const wanted = normalize(alias);
      const match = entries.find(([key]) => normalize(key) === wanted);
      if (match && String(match[1] ?? "").trim() !== "") return match[1];
    }
    return "";
  }

  function standardizeRow(row) {
    const mapsUrl = normalizeUrl(row?.mapsUrl || getField(row, "mapsUrl"));
    const urlCoords = parseCoordinatesFromUrl(mapsUrl);
    const latValue = row?.lat ?? getField(row, "lat");
    const lngValue = row?.lng ?? getField(row, "lng");
    const name = String(row?.name || getField(row, "name") || "").trim();
    const address = String(row?.address || getField(row, "address") || "").trim();
    const phone = normalizePhone(row?.phone || getField(row, "phone"));
    const website = normalizeUrl(row?.website || getField(row, "website"));
    const key = mapsUrl || [name,address,phone].join("|");

    return {
      ...row,
      id: row?.id || hashId(key),
      source: row?.source || "google-maps-browser",
      name: name || "Empresa sem nome",
      category: String(row?.category || getField(row, "category") || "").trim(),
      rating: parseNumber(row?.rating ?? getField(row, "rating")),
      reviews: parseReviews(row?.reviews ?? getField(row, "reviews")),
      phone,
      website,
      address,
      city: String(row?.city || getField(row, "city") || "").trim(),
      state: String(row?.state || getField(row, "state") || "").trim(),
      neighborhood: String(row?.neighborhood || getField(row, "neighborhood") || "").trim(),
      lat: Number.isFinite(Number(latValue)) ? Number(latValue) : urlCoords.lat,
      lng: Number.isFinite(Number(lngValue)) ? Number(lngValue) : urlCoords.lng,
      mapsUrl,
      hours: String(row?.hours || getField(row, "hours") || "").trim(),
      collectedAt: String(row?.collectedAt || row?.detailedAt || getField(row, "collectedAt") || "").trim()
    };
  }

  function dedupe(leads) {
    const map = new Map();
    leads.forEach(raw => {
      const lead = standardizeRow(raw);
      const key = normalize(lead.mapsUrl || `${lead.name}|${lead.address}|${lead.phone}`);
      if (!key) return;
      const previous = map.get(key) || {};
      const merged = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      merged.id = previous.id || lead.id;
      map.set(key, merged);
    });
    return [...map.values()];
  }

  function detectDelimiter(text) {
    const line = String(text || "").split(/\r?\n/).find(Boolean) || "";
    return [";", "\t", ","].map(delimiter => ({ delimiter, count: line.split(delimiter).length - 1 })).sort((a,b) => b.count - a.count)[0]?.delimiter || ";";
  }

  function parseDelimited(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [], value = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i], next = text[i + 1];
      if (char === '"') {
        if (quoted && next === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
        continue;
      }
      if (char === delimiter && !quoted) { row.push(value); value = ""; continue; }
      if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value); value = "";
        if (row.some(cell => String(cell).trim())) rows.push(row);
        row = [];
        continue;
      }
      value += char;
    }
    if (value || row.length) { row.push(value); if (row.some(cell => String(cell).trim())) rows.push(row); }
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

  async function importFile(file) {
    if (!file) return;
    const text = await file.text();
    const rows = file.name.toLowerCase().endsWith(".json") ? parseJson(text) : parseDelimited(text);
    const imported = rows.map(standardizeRow).filter(lead => lead.name && lead.name !== "Empresa sem nome");
    if (!imported.length) throw new Error("Nenhum negócio reconhecido. O arquivo precisa ter pelo menos uma coluna de nome/empresa.");
    state.leads = dedupe([...state.leads, ...imported]);
    saveLeads();
    saveMeta({ fileName: file.name, importedAt: new Date().toISOString(), count: imported.length, source: "file" });
    showWorkspace();
    render();
    toast(`${imported.length} negócios importados.`);
  }

  function filterLeads() {
    const query = normalize($("#mapsLocalFilter")?.value || "");
    const noSite = $("#mapsNoSiteOnly")?.checked;
    const withPhone = $("#mapsWithPhoneOnly")?.checked;
    const minRating = parseNumber($("#mapsMinRating")?.value) || 0;
    state.filtered = state.leads.filter(lead => {
      if (noSite && lead.website) return false;
      if (withPhone && !lead.phone) return false;
      if (minRating && (!lead.rating || lead.rating < minRating)) return false;
      if (!query) return true;
      return normalize([lead.name,lead.category,lead.address,lead.city,lead.neighborhood,lead.phone,lead.website,lead.decisionMaker?.name,lead.cnpj].join(" ")).includes(query);
    });
  }

  function showWorkspace() {
    $("#mapsWorkspace")?.classList.remove("hidden");
    setTimeout(() => state.map?.invalidateSize(), 120);
  }

  function createMap() {
    if (state.map || !window.L || !$("#prospectingMap")) return;
    state.map = L.map("prospectingMap", { zoomControl: true }).setView([-23.45, -46.53], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(state.map);
    state.markers = L.featureGroup().addTo(state.map);
  }

  function mapPopup(lead) {
    return `<div class="maps-popup"><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.category || "Negócio local")}</span><b>${escapeHtml(lead.rating ? `★ ${String(lead.rating).replace(".",",")}${Number.isFinite(lead.reviews) ? ` · ${lead.reviews.toLocaleString("pt-BR")} avaliações` : ""}` : "Sem nota")}</b><small>${escapeHtml(lead.address || "Endereço não informado")}</small>${lead.decisionMaker?.name ? `<small><b>Decisor:</b> ${escapeHtml(lead.decisionMaker.name)}</small>` : ""}</div>`;
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
    else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [30,30] });
  }

  function highlightLead(id) {
    state.selectedId = id;
    $$(".maps-lead-card").forEach(card => card.classList.toggle("selected", card.dataset.id === id));
    document.querySelector(`.maps-lead-card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function decisionMakerFromCompany(company) {
    const qsa = Array.isArray(company?.qsa) ? company.qsa : [];
    if (!qsa.length) return null;
    const priority = ["socio administrador","sócio administrador","administrador","titular","empresario","empresário","presidente","diretor","socio","sócio"];
    return qsa.map(person => {
      const role = normalize(person.qualificacao_socio);
      const rank = priority.findIndex(item => role.includes(normalize(item)));
      return { person, rank: rank < 0 ? 999 : rank };
    }).sort((a,b) => a.rank - b.rank)[0]?.person || qsa[0];
  }

  function renderQsa(lead) {
    if (lead.revenueStatus === "searching") return `<div class="maps-qsa-box maps-qsa-loading"><div class="maps-qsa-head"><span>RECEITA / QSA</span><b>cruzando...</b></div><small>Buscando a identidade empresarial mais provável.</small></div>`;
    if (!lead.cnpj) return `<div class="maps-qsa-box"><div class="maps-qsa-head"><span>RECEITA / QSA</span><b class="maps-qsa-missing">não identificado</b></div><small>O Google mostra o negócio comercial, mas ainda não houve correspondência segura com um CNPJ.</small></div>`;
    const confidence = Math.round(Number(lead.revenueMatchScore || 0) * 100);
    const dm = lead.decisionMaker;
    const cls = confidence >= 75 ? "maps-match-good" : "maps-match-medium";
    return `<div class="maps-qsa-box"><div class="maps-qsa-head"><span>RECEITA / QSA</span><b class="${cls}">match ${confidence}%</b></div><strong>${escapeHtml(lead.legalName || lead.name)}</strong><small>CNPJ ${escapeHtml(formatCnpj(lead.cnpj))}${dm?.name ? ` · ${escapeHtml(dm.name)} · ${escapeHtml(dm.role || "sócio")}` : " · QSA não retornado"}${lead.companyEmail ? ` · ${escapeHtml(lead.companyEmail)}` : ""}</small></div>`;
  }

  function formatCnpj(value) {
    const v = String(value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (v.length !== 14) return v;
    return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
  }

  function renderLeadCard(lead) {
    const article = document.createElement("article");
    article.className = "maps-lead-card";
    article.dataset.id = lead.id;
    const phoneDisplay = lead.phone ? formatPhone(lead.phone) : "Sem telefone";
    const websiteLabel = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0] : "Sem site";
    const mapsHref = lead.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name,lead.address].filter(Boolean).join(" "))}`;
    const whatsappHref = lead.phone ? `https://wa.me/55${normalizePhone(lead.phone)}` : "";
    const reviews = Number.isFinite(lead.reviews) ? `${lead.reviews.toLocaleString("pt-BR")} avaliações` : "sem avaliações";

    article.innerHTML = `
      <div class="maps-lead-top">
        <div><span class="maps-source-tag">MAPA / EMPRESA REAL</span><h3>${escapeHtml(lead.name)}</h3><p>${escapeHtml(lead.category || "Categoria não informada")}</p></div>
        <div class="maps-rating"><strong>${escapeHtml(lead.rating ? `★ ${String(lead.rating).replace(".",",")}` : "—")}</strong><span>${escapeHtml(reviews)}</span></div>
      </div>
      <div class="maps-lead-info">
        <div><span>Endereço</span><strong>${escapeHtml(lead.address || [lead.neighborhood,lead.city,lead.state].filter(Boolean).join(" · ") || "Não informado")}</strong></div>
        <div><span>Telefone</span><strong>${escapeHtml(phoneDisplay)}</strong></div>
        <div class="${lead.website ? "" : "missing"}"><span>Site</span><strong>${escapeHtml(websiteLabel)}</strong></div>
        <div><span>Horário</span><strong>${escapeHtml(lead.hours || "Não informado")}</strong></div>
      </div>
      ${renderQsa(lead)}
      <div class="maps-lead-actions">
        <a href="${escapeHtml(mapsHref)}" target="_blank" rel="noopener">Google Maps</a>
        ${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">Site</a>` : ""}
        ${whatsappHref ? `<a href="${escapeHtml(whatsappHref)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button type="button" data-qsa>Cruzar CNPJ/QSA</button>
        <button type="button" data-diagnose>Diagnóstico</button>
        <button type="button" data-copy>Copiar</button>
      </div>`;

    article.querySelector("[data-qsa]")?.addEventListener("click", () => runRevenueMatch(lead.id));
    article.querySelector("[data-diagnose]")?.addEventListener("click", () => sendToDiagnosis(lead));
    article.querySelector("[data-copy]")?.addEventListener("click", async () => {
      const dm = lead.decisionMaker;
      const text = [lead.name, lead.category ? `Categoria: ${lead.category}` : "", lead.rating ? `Google: ${lead.rating} · ${reviews}` : "", lead.phone ? `Telefone: ${formatPhone(lead.phone)}` : "", lead.website ? `Site: ${lead.website}` : "Site: não encontrado", lead.address ? `Endereço: ${lead.address}` : "", lead.cnpj ? `CNPJ: ${formatCnpj(lead.cnpj)}` : "", dm?.name ? `Decisor/QSA: ${dm.name} — ${dm.role || ""}` : "", mapsHref ? `Google Maps: ${mapsHref}` : ""].filter(Boolean).join("\n");
      try { await navigator.clipboard.writeText(text); toast("Dados copiados."); }
      catch { window.prompt("Copie os dados:", text); }
    });
    return article;
  }

  function renderList() {
    const list = $("#mapsLeadList");
    if (!list) return;
    list.replaceChildren();
    if (!state.filtered.length) {
      const empty = document.createElement("div");
      empty.className = "maps-empty";
      empty.textContent = state.leads.length ? "Nenhum negócio corresponde aos filtros atuais." : "Pesquise pelo coletor do Radar ou importe uma coleta para visualizar os negócios.";
      list.appendChild(empty);
      return;
    }
    state.filtered.forEach(lead => list.appendChild(renderLeadCard(lead)));
  }

  function renderMetrics() {
    const total = state.filtered.length;
    const withPhone = state.filtered.filter(lead => lead.phone).length;
    const noSite = state.filtered.filter(lead => !lead.website).length;
    const withDecisionMaker = state.filtered.filter(lead => lead.decisionMaker?.name).length;
    const ratings = state.filtered.map(lead => lead.rating).filter(Number.isFinite);
    const avgRating = ratings.length ? (ratings.reduce((sum,n) => sum + n, 0) / ratings.length).toFixed(1).replace(".",",") : "—";
    const mapped = state.filtered.filter(lead => Number.isFinite(lead.lat) && Number.isFinite(lead.lng)).length;
    const values = { mapsMetricTotal: total, mapsMetricPhone: withPhone, mapsMetricNoSite: noSite, mapsMetricRating: avgRating, mapsMetricMapped: mapped, heroFound: total, heroQsa: withDecisionMaker };
    Object.entries(values).forEach(([id,value]) => { const el = document.getElementById(id); if (el) el.textContent = typeof value === "number" ? value.toLocaleString("pt-BR") : value; });
    const source = $("#mapsSourceLabel");
    if (source) source.textContent = state.leads.length ? `${state.leads.length.toLocaleString("pt-BR")} negócios mapeados · ${withDecisionMaker.toLocaleString("pt-BR")} com decisor` : "Nenhuma coleta carregada";
  }

  function render() {
    filterLeads();
    renderMetrics();
    renderList();
    renderMap();
  }

  function setCollectorStatus(kind, title, text) {
    const box = $("#mapsCollectorState");
    if (!box) return;
    box.className = `maps-collector-state${kind ? ` ${kind}` : ""}`;
    box.querySelector("b").textContent = title;
    box.querySelector("span").textContent = text;
  }

  function injectCollectorStatus() {
    if ($("#mapsCollectorStatus")) return;
    const row = document.createElement("div");
    row.id = "mapsCollectorStatus";
    row.className = "maps-collector-status";
    row.innerHTML = `<div id="mapsCollectorState" class="maps-collector-state"><i></i><div><b>Procurando coletor do Radar...</b><span>Se a extensão estiver instalada, a busca acontece automaticamente.</span></div></div><label class="maps-auto-detail"><input id="mapsAutoDetail" type="checkbox" checked> completar telefone, site e horário automaticamente</label>`;
    $(".maps-search-row")?.insertAdjacentElement("afterend", row);
    const note = document.createElement("p");
    note.className = "maps-compliance-note";
    note.textContent = "O coletor roda no seu navegador. O Radar também aceita CSV/JSON da extensão que você já usa. A coleta do Google Maps pode estar sujeita aos termos do Google; use de acordo com as regras aplicáveis.";
    row.insertAdjacentElement("afterend", note);
  }

  function setBusy(value) {
    state.busy = value;
    const button = $("#mapsOpenGoogleButton");
    if (button) {
      button.disabled = value;
      button.classList.toggle("collecting", value);
      if (!value) button.innerHTML = state.extensionConnected ? `Mapear no Google <span>→</span>` : `Abrir busca no Google Maps <span>↗</span>`;
    }
  }

  function randomId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  }

  function bridgeRequest(type, payload, expectedType, timeoutMs = 360000) {
    const requestId = randomId();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(requestId);
        reject(new Error("O coletor demorou demais para responder."));
      }, timeoutMs);
      state.pending.set(requestId, { expectedType, resolve, reject, timer });
      window.postMessage({ source: BRIDGE_SOURCE, type, requestId, ...payload }, window.location.origin);
    });
  }

  function handleBridgeMessage(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== BRIDGE_TARGET) return;
    if (message.type === "READY" || message.type === "PONG") {
      state.extensionConnected = true;
      state.extensionVersion = message.version || "";
      setCollectorStatus("ready", "Coletor do Radar conectado", `Extensão ${state.extensionVersion || "ativa"} · pesquisa e coleta automáticas disponíveis.`);
      setBusy(false);
      return;
    }
    if (message.type === "PROGRESS") {
      const p = message.progress || {};
      if (p.event === "ENRICH_PROGRESS") setCollectorStatus("", "Completando fichas do Google...", `${p.current || 0} de ${p.total || 0} empresas processadas.`);
      else setCollectorStatus("", "Mapeando a região...", p.text || "Navegando pelos resultados do Google Maps.");
      return;
    }
    const pending = state.pending.get(message.requestId);
    if (!pending || pending.expectedType !== message.type) return;
    clearTimeout(pending.timer);
    state.pending.delete(message.requestId);
    pending.resolve(message.response || {});
  }

  function pingExtension() {
    window.postMessage({ source: BRIDGE_SOURCE, type: "PING" }, window.location.origin);
    setTimeout(() => {
      if (!state.extensionConnected) {
        setCollectorStatus("error", "Coletor não detectado", "Você ainda pode usar sua extensão atual e importar CSV/JSON. Para automação total, instale o Radar Maps Collector.");
      }
    }, 1600);
  }

  async function directMapsSearch() {
    const term = $("#mapsSearchTerm")?.value.trim();
    const region = $("#mapsSearchCity")?.value.trim();
    if (!term || !region) { toast("Informe o segmento e a região."); return; }
    const query = `${term} ${region}`.trim();

    if (!state.extensionConnected) {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, "_blank", "noopener");
      setCollectorStatus("error", "Google Maps aberto", "O coletor do Radar não está instalado. Exporte pela sua extensão atual e use “Importar coleta”.");
      return;
    }

    setBusy(true);
    setCollectorStatus("", "Iniciando mapeamento...", `Buscando “${query}”.`);
    try {
      const response = await bridgeRequest("START_SEARCH", {
        query,
        maxScrolls: 55,
        replace: true,
        enrich: $("#mapsAutoDetail")?.checked !== false,
        enrichLimit: 80
      }, "SEARCH_RESULT", 480000);
      if (!response?.ok) throw new Error(response?.error || "Falha ao coletar os resultados.");
      state.leads = dedupe((response.leads || []).map(standardizeRow));
      saveLeads();
      saveMeta({ source: "radar-extension", query, term, region, importedAt: new Date().toISOString(), count: state.leads.length });
      showWorkspace();
      render();
      setCollectorStatus("ready", "Mapa concluído", `${state.leads.length} negócios carregados no Radar. Cruzando CNPJ e QSA quando possível.`);
      await runRevenueMatch();
    } catch (error) {
      console.error("[RadarMapsV3] collector", error);
      setCollectorStatus("error", "A coleta foi interrompida", error.message || "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function parseRegion(raw) {
    const text = String(raw || "").trim();
    const ufMatch = text.match(/-\s*([A-Z]{2})\s*$/i);
    const uf = ufMatch ? ufMatch[1].toUpperCase() : "SP";
    const withoutUf = text.replace(/-\s*[A-Z]{2}\s*$/i, "").trim().replace(/,$/, "");
    const parts = withoutUf.split(",").map(v => v.trim()).filter(Boolean);
    const city = parts.length > 1 ? parts[parts.length - 1] : withoutUf;
    return { city, uf };
  }

  function inferCnaes(term) {
    const raw = normalize(term);
    const lowerPreset = $("#segmentPreset")?.value;
    const manual = String($("#cnaeInput")?.value || "").split(",").map(digits).filter(v => v.length === 7);
    if (digits(lowerPreset).length === 7) manual.unshift(digits(lowerPreset));
    const direct = [...new Set(manual)];
    if (direct.length) return direct;
    const match = SEGMENT_CNAES.find(item => item.re.test(raw));
    return match?.cnaes || [];
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    } finally { clearTimeout(timer); }
  }

  async function resolveMunicipality(uf, city) {
    const rows = await fetchJson(`${IBGE_BASE}/${encodeURIComponent(uf)}/municipios?orderBy=nome`);
    const wanted = normalize(city);
    const exact = rows.find(item => normalize(item.nome) === wanted) || rows.find(item => normalize(item.nome).startsWith(wanted));
    if (!exact) throw new Error(`Município “${city}” não encontrado no IBGE.`);
    return exact;
  }

  function activeCompany(company) {
    const desc = normalize(company?.descricao_situacao_cadastral);
    return desc ? desc === "ativa" : Number(company?.situacao_cadastral || 2) === 2;
  }

  function nameTokens(value) {
    return new Set(normalize(value).split(" ").filter(token => token.length >= 3 && !STOPWORDS.has(token)));
  }

  function overlapScore(a, b) {
    const A = nameTokens(a), B = nameTokens(b);
    if (!A.size || !B.size) return 0;
    let common = 0;
    A.forEach(token => { if (B.has(token)) common += 1; });
    return common / Math.min(A.size, B.size);
  }

  function companyPhoneValues(company) {
    return [company?.ddd_telefone_1, company?.ddd_telefone_2].map(normalizePhone).filter(Boolean);
  }

  function revenueScore(lead, company) {
    const fantasy = company?.nome_fantasia || "";
    const legal = company?.razao_social || "";
    const nameScore = Math.max(overlapScore(lead.name, fantasy), overlapScore(lead.name, legal));
    let score = nameScore * .68;
    const leadPhone = normalizePhone(lead.phone);
    if (leadPhone && companyPhoneValues(company).some(phone => phone.slice(-8) === leadPhone.slice(-8))) score += .55;
    const addrScore = overlapScore(lead.address, [company.logradouro,company.numero,company.bairro].filter(Boolean).join(" "));
    score += addrScore * .2;
    const bairro = normalize(company?.bairro);
    if (bairro && normalize(lead.address).includes(bairro)) score += .1;
    return Math.min(1, score);
  }

  function matchCompany(lead, companies) {
    const ranked = companies.map(company => ({ company, score: revenueScore(lead, company) })).sort((a,b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < .46) return null;
    const second = ranked[1];
    if (second && best.score < .62 && best.score - second.score < .08) return null;
    return best;
  }

  function attachCompany(lead, match) {
    if (!match) { lead.revenueStatus = "not-found"; return; }
    const company = match.company;
    const dm = decisionMakerFromCompany(company);
    lead.revenueStatus = "matched";
    lead.revenueMatchScore = match.score;
    lead.cnpj = company.cnpj || "";
    lead.legalName = company.razao_social || "";
    lead.tradeName = company.nome_fantasia || "";
    lead.companyEmail = company.email || "";
    lead.companyPhone = company.ddd_telefone_1 || "";
    lead.cnae = company.cnae_fiscal || "";
    lead.cnaeDescription = company.cnae_fiscal_descricao || "";
    lead.qsa = Array.isArray(company.qsa) ? company.qsa : [];
    lead.decisionMaker = dm ? { name: dm.nome_socio || "", role: dm.qualificacao_socio || "" } : null;
  }

  async function fetchRevenueCandidates(cnaes, city, uf) {
    const municipality = await resolveMunicipality(uf, city);
    const params = new URLSearchParams({ uf, municipio: String(municipality.id), cnae: cnaes.join(","), limit: "1024" });
    const data = await fetchJson(`${MY_RECEITA_BASE}/?${params.toString()}`);
    return (Array.isArray(data?.data) ? data.data : []).filter(activeCompany);
  }

  async function runRevenueMatch(focusId = "") {
    if (state.revenueBusy || !state.leads.length) return;
    const meta = loadMeta();
    const term = meta.term || $("#mapsSearchTerm")?.value || "";
    const regionText = meta.region || $("#mapsSearchCity")?.value || "";
    const cnaes = inferCnaes(term);
    const { city, uf } = parseRegion(regionText);
    if (!cnaes.length || !city) {
      if (focusId) toast("Não consegui inferir o CNAE. Use a busca Receita & QSA abaixo ou informe o CNAE manualmente.");
      return;
    }

    state.revenueBusy = true;
    state.leads.forEach(lead => { if (!lead.cnpj && (!focusId || lead.id === focusId)) lead.revenueStatus = "searching"; });
    render();
    setCollectorStatus("", "Cruzando com a Receita Federal...", `Buscando CNPJ/QSA de ${city}/${uf}.`);
    try {
      const companies = await fetchRevenueCandidates(cnaes, city, uf);
      state.leads.forEach(lead => {
        if (focusId && lead.id !== focusId) return;
        if (lead.cnpj) return;
        attachCompany(lead, matchCompany(lead, companies));
      });
      saveLeads();
      render();
      const matches = state.leads.filter(lead => lead.cnpj).length;
      setCollectorStatus("ready", "Cruzamento concluído", `${matches} de ${state.leads.length} negócios possuem correspondência segura com CNPJ/QSA.`);
    } catch (error) {
      console.error("[RadarMapsV3] Receita", error);
      state.leads.forEach(lead => { if (lead.revenueStatus === "searching") lead.revenueStatus = "error"; });
      render();
      setCollectorStatus("error", "Receita temporariamente indisponível", "O mapa continua funcionando. Tente o cruzamento novamente depois.");
    } finally { state.revenueBusy = false; }
  }

  function sendToDiagnosis(lead) {
    const params = new URLSearchParams({
      origem: "posicionamento-local",
      empresa: lead.name || "",
      regiao: loadMeta().region || [lead.city,lead.state].filter(Boolean).join(" - "),
      segmento: "outro",
      segmento_nome: lead.category || loadMeta().term || "Negócio local",
      endereco: lead.address || "",
      telefone: lead.phone || ""
    });
    localStorage.setItem("radarProspectingSource", JSON.stringify({ cnpj: lead.cnpj || "", qsa: lead.qsa || [], source: "maps-discovery", mapsUrl: lead.mapsUrl || "" }));
    window.location.href = `./?${params.toString()}`;
  }

  function exportJson() {
    if (!state.filtered.length) return toast("Não há negócios para exportar.");
    const blob = new Blob([JSON.stringify(state.filtered, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `radar-mapa-prospeccao-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link); link.click(); const url = link.href; link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearImported() {
    state.leads = []; state.filtered = []; saveLeads(); localStorage.removeItem(META_KEY); render(); toast("Mapa limpo.");
    if (state.extensionConnected) bridgeRequest("CLEAR", {}, "CLEAR_RESULT", 10000).catch(() => {});
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message; el.classList.add("visible"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("visible"), 2200);
  }

  function wireEvents() {
    $("#mapsImportButton")?.addEventListener("click", () => $("#mapsImportInput")?.click());
    $("#mapsImportInput")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importFile(file); await runRevenueMatch(); }
      catch (error) { alert(error.message || "Não foi possível importar a coleta."); }
      finally { event.target.value = ""; }
    });
    $("#mapsOpenGoogleButton")?.addEventListener("click", event => {
      event.preventDefault(); event.stopImmediatePropagation(); directMapsSearch();
    }, true);
    $("#mapsClearButton")?.addEventListener("click", () => { if (state.leads.length && window.confirm("Remover toda a coleta deste navegador?")) clearImported(); });
    $("#mapsExportButton")?.addEventListener("click", exportJson);
    ["#mapsLocalFilter","#mapsMinRating","#mapsNoSiteOnly","#mapsWithPhoneOnly"].forEach(selector => {
      const el = $(selector); if (!el) return; el.addEventListener(el.type === "search" ? "input" : "change", render);
    });
    window.addEventListener("message", handleBridgeMessage);
  }

  function boot() {
    installExtraStyles();
    injectCollectorStatus();
    wireEvents();
    createMap();
    if (state.leads.length) showWorkspace();
    render();
    setBusy(false);
    pingExtension();
    if (state.leads.length && state.leads.some(lead => !lead.cnpj)) setTimeout(() => runRevenueMatch(), 900);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  window.RadarMapsCollector = {
    getLeads: () => [...state.leads],
    clear: clearImported,
    render,
    matchRevenue: runRevenueMatch,
    extensionConnected: () => state.extensionConnected
  };
})();
