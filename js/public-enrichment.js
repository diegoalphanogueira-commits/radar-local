/* =========================================================
   RADAR LOCAL — ENRIQUECIMENTO PÚBLICO V1
   Complementa CNPJ/QSA com fontes públicas e links de descoberta.

   Regras:
   - não raspa Google Maps/Instagram;
   - não depende de Google Places pago;
   - usa OpenStreetMap/Overpass sob demanda e com cache;
   - contatos exibidos continuam sendo contatos empresariais/públicos.
========================================================= */
(() => {
  "use strict";

  const MY_RECEITA_BASE = "https://minhareceita.org";
  const OVERPASS_ENDPOINT = "https://overpass.private.coffee/api/interpreter";
  const CACHE_KEY = "radarPublicEnrichmentV1";
  const DAILY_KEY = "radarPublicEnrichmentDailyV1";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const DAILY_LIMIT = 80;
  const MIN_REQUEST_GAP = 2500;

  const GENERIC_EMAIL_DOMAINS = new Set([
    "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
    "yahoo.com", "yahoo.com.br", "icloud.com", "uol.com.br", "bol.com.br",
    "terra.com.br", "proton.me", "protonmail.com"
  ]);

  const CORPORATE_WORDS = new Set([
    "ltda", "me", "eireli", "sa", "s/a", "empresa", "servicos", "servico",
    "comercio", "comercial", "industria", "brasil", "grupo", "holding"
  ]);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@._+\-:/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const cleanCnpj = value => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
  const escapeRegex = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapeOverpass = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  function installStyles() {
    if (document.getElementById("radar-public-enrichment-styles")) return;
    const style = document.createElement("style");
    style.id = "radar-public-enrichment-styles";
    style.textContent = `
      .public-enrichment-btn{background:#f1f7ff!important;border-color:#cfe0fa!important;color:#125fc5!important}
      .public-enrichment-btn.is-loading{opacity:.68;cursor:wait}
      .public-enrichment-box{grid-column:1/-1;padding:18px 20px;border-top:1px solid #e6edf5;background:linear-gradient(180deg,#fbfdff,#f7faff)}
      .public-enrichment-box.hidden{display:none!important}
      .pe-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}
      .pe-head strong{font-size:.82rem;color:#26384c}.pe-head span{padding:5px 8px;border-radius:999px;background:#eaf7ee;color:#17713a;font-size:.61rem;font-weight:800;letter-spacing:.05em}
      .pe-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.pe-item{min-width:0;padding:11px;border:1px solid #e2e9f2;border-radius:12px;background:#fff}.pe-item b{display:block;color:#8a96a6;font-size:.58rem;text-transform:uppercase;letter-spacing:.06em}.pe-item a,.pe-item em{display:block;margin-top:5px;color:#31506f;font-style:normal;font-size:.7rem;line-height:1.45;word-break:break-word}.pe-item a{color:#1264d3;text-decoration:none}.pe-item a:hover{text-decoration:underline}
      .pe-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.pe-action{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border:1px solid #d8e2ee;border-radius:10px;background:#fff;color:#3f5268;text-decoration:none;font-size:.66rem;font-weight:750}.pe-action:hover{background:#f2f6fb}.pe-note{margin:12px 0 0;color:#8a96a6;font-size:.61rem;line-height:1.55}.pe-note a{color:#687b91}.pe-empty{padding:12px;border:1px dashed #d7e2ee;border-radius:11px;color:#758498;font-size:.69rem;line-height:1.55;background:#fff}.pe-warning{color:#8a5a16}.pe-confidence{display:inline-block;margin-left:6px;color:#7e8c9e;font-size:.61rem;font-weight:650}
      @media(max-width:900px){.pe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:580px){.pe-grid{grid-template-columns:1fr}.public-enrichment-box{padding:16px}.pe-actions{display:grid;grid-template-columns:1fr 1fr}.pe-action{justify-content:center;text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function loadCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return cache && typeof cache === "object" ? cache : {};
    } catch {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn("[RadarPublicEnrichment] cache indisponível", error);
    }
  }

  function getCached(cnpj) {
    const cache = loadCache();
    const item = cache[cnpj];
    if (!item) return null;
    if (Date.now() - Number(item.savedAt || 0) > CACHE_TTL) {
      delete cache[cnpj];
      saveCache(cache);
      return null;
    }
    return item.data || null;
  }

  function setCached(cnpj, data) {
    const cache = loadCache();
    cache[cnpj] = { savedAt: Date.now(), data };
    const trimmed = Object.fromEntries(
      Object.entries(cache)
        .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
        .slice(0, 500)
    );
    saveCache(trimmed);
  }

  function readDailyUsage() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const value = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
      if (!value || value.date !== today) return { date: today, count: 0, lastAt: 0 };
      return value;
    } catch {
      return { date: today, count: 0, lastAt: 0 };
    }
  }

  function consumeDailyUsage() {
    const usage = readDailyUsage();
    usage.count += 1;
    usage.lastAt = Date.now();
    localStorage.setItem(DAILY_KEY, JSON.stringify(usage));
  }

  function canUseOverpass() {
    const usage = readDailyUsage();
    if (usage.count >= DAILY_LIMIT) {
      return { ok: false, reason: `Limite de ${DAILY_LIMIT} enriquecimentos públicos por dia atingido neste navegador.` };
    }
    const wait = Math.max(0, MIN_REQUEST_GAP - (Date.now() - Number(usage.lastAt || 0)));
    if (wait > 0) {
      return { ok: false, reason: `Aguarde ${Math.ceil(wait / 1000)}s antes do próximo enriquecimento.` };
    }
    return { ok: true };
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch(url, {
        ...options,
        mode: "cors",
        signal: options.signal || controller.signal,
        headers: { Accept: "application/json", ...(options.headers || {}) }
      });
      if (!response.ok) {
        const err = new Error(`HTTP_${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function companyName(company) {
    return String(company?.nome_fantasia || "").trim() || String(company?.razao_social || "").trim() || "Empresa";
  }

  function companyAddress(company) {
    return [
      company?.descricao_tipo_de_logradouro,
      company?.logradouro,
      company?.numero,
      company?.complemento,
      company?.bairro,
      company?.municipio,
      company?.uf,
      company?.cep
    ].filter(Boolean).join(", ");
  }

  function getEmailDomain(email) {
    const raw = normalize(email);
    const domain = raw.includes("@") ? raw.split("@").pop() : "";
    if (!domain || GENERIC_EMAIL_DOMAINS.has(domain) || !domain.includes(".")) return "";
    return domain;
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw.replace(/^\/+/, "")}`;
  }

  function socialUrl(value, network) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const handle = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
    const bases = {
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
      linkedin: "https://www.linkedin.com/company/",
      whatsapp: "https://wa.me/"
    };
    return bases[network] ? `${bases[network]}${handle}` : "";
  }

  function buildDiscoveryLinks(company) {
    const name = companyName(company);
    const address = companyAddress(company);
    const city = company?.municipio || "";
    const state = company?.uf || "";
    const query = [name, address].filter(Boolean).join(" ");
    const quoted = `"${name}" ${city} ${state}`.trim();
    return {
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      googleSearch: `https://www.google.com/search?q=${encodeURIComponent(quoted)}`,
      instagramSearch: `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${quoted}`)}`,
      facebookSearch: `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com ${quoted}`)}`,
      linkedinSearch: `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/company ${quoted}`)}`
    };
  }

  function buildNamePattern(name) {
    const tokens = normalize(name)
      .split(" ")
      .filter(token => token.length >= 3 && !CORPORATE_WORDS.has(token))
      .slice(0, 4)
      .map(escapeRegex);
    if (!tokens.length) return escapeRegex(normalize(name));
    return tokens.join(".*");
  }

  function scoreCandidate(company, element) {
    const tags = element?.tags || {};
    const sourceTokens = new Set(normalize(companyName(company)).split(" ").filter(token => token.length >= 3 && !CORPORATE_WORDS.has(token)));
    const targetTokens = new Set(normalize(tags.name || tags.brand || tags.operator || "").split(" ").filter(token => token.length >= 3));
    let matched = 0;
    sourceTokens.forEach(token => { if (targetTokens.has(token)) matched += 1; });
    let score = sourceTokens.size ? matched / sourceTokens.size : 0;

    const companyPhones = [company?.ddd_telefone_1, company?.ddd_telefone_2].map(digits).filter(Boolean);
    const osmPhones = [tags.phone, tags["contact:phone"], tags["contact:mobile"]].map(digits).filter(Boolean);
    if (companyPhones.some(phone => osmPhones.some(osm => phone.slice(-8) === osm.slice(-8)))) score += .45;

    const companyEmail = normalize(company?.email);
    const osmEmail = normalize(tags.email || tags["contact:email"]);
    if (companyEmail && osmEmail && companyEmail === osmEmail) score += .4;

    const companyBairro = normalize(company?.bairro);
    const osmBairro = normalize(tags["addr:suburb"] || tags["addr:district"]);
    if (companyBairro && osmBairro && (companyBairro.includes(osmBairro) || osmBairro.includes(companyBairro))) score += .15;

    return score;
  }

  async function lookupOverpass(company) {
    const allowance = canUseOverpass();
    if (!allowance.ok) throw new Error(allowance.reason);

    const city = String(company?.municipio || "").trim();
    const name = companyName(company);
    if (!city || !name) return null;

    const pattern = buildNamePattern(name);
    const q = `[out:json][timeout:15];
      area["name"="${escapeOverpass(city)}"]["boundary"="administrative"]["admin_level"="8"]->.searchArea;
      (
        nwr(area.searchArea)["name"~"${escapeOverpass(pattern)}",i];
        nwr(area.searchArea)["brand"~"${escapeOverpass(pattern)}",i];
        nwr(area.searchArea)["operator"~"${escapeOverpass(pattern)}",i];
      );
      out center tags 20;`;

    consumeDailyUsage();
    const data = await fetchJson(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(q)}`
    });

    const candidates = Array.isArray(data?.elements) ? data.elements : [];
    if (!candidates.length) return null;

    const ranked = candidates
      .map(element => ({ element, score: scoreCandidate(company, element) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best || best.score < .28) return null;
    const element = best.element;
    const tags = element.tags || {};

    return {
      score: Math.min(1, best.score),
      name: tags.name || tags.brand || tags.operator || "",
      website: normalizeUrl(tags.website || tags["contact:website"] || tags.url),
      instagram: socialUrl(tags["contact:instagram"] || tags.instagram, "instagram"),
      facebook: socialUrl(tags["contact:facebook"] || tags.facebook, "facebook"),
      linkedin: socialUrl(tags["contact:linkedin"] || tags.linkedin, "linkedin"),
      whatsapp: socialUrl(tags["contact:whatsapp"] || tags.whatsapp, "whatsapp"),
      phone: tags["contact:phone"] || tags.phone || tags["contact:mobile"] || "",
      email: tags["contact:email"] || tags.email || "",
      openingHours: tags.opening_hours || "",
      category: tags.amenity || tags.shop || tags.office || tags.healthcare || tags.craft || "",
      lat: element.lat || element.center?.lat || null,
      lon: element.lon || element.center?.lon || null,
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
    };
  }

  async function buildEnrichment(cnpj) {
    const company = await fetchJson(`${MY_RECEITA_BASE}/${encodeURIComponent(cnpj)}`);
    const links = buildDiscoveryLinks(company);
    const emailDomain = getEmailDomain(company?.email);
    let osm = null;
    let osmError = "";

    try {
      osm = await lookupOverpass(company);
    } catch (error) {
      osmError = error?.message || "Fonte cartográfica indisponível.";
      console.warn("[RadarPublicEnrichment] Overpass", error);
    }

    return {
      company: {
        name: companyName(company),
        cnpj: cleanCnpj(company?.cnpj),
        city: company?.municipio || "",
        uf: company?.uf || "",
        address: companyAddress(company),
        email: company?.email || "",
        phone: company?.ddd_telefone_1 || ""
      },
      domainCandidate: emailDomain ? `https://${emailDomain}` : "",
      links,
      osm,
      osmError,
      enrichedAt: new Date().toISOString()
    };
  }

  function item(label, content, href = "") {
    if (!content) return "";
    const value = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(content)}</a>`
      : `<em>${escapeHtml(content)}</em>`;
    return `<div class="pe-item"><b>${escapeHtml(label)}</b>${value}</div>`;
  }

  function renderEnrichment(box, data) {
    const osm = data?.osm || null;
    const links = data?.links || {};
    const website = osm?.website || data?.domainCandidate || "";
    const instagram = osm?.instagram || "";
    const facebook = osm?.facebook || "";
    const linkedin = osm?.linkedin || "";
    const phone = osm?.phone || "";
    const email = osm?.email || "";
    const hours = osm?.openingHours || "";
    const confidence = osm ? `${Math.round((osm.score || 0) * 100)}%` : "";

    const grid = [
      item(osm?.website ? "Site público" : "Domínio provável", website ? website.replace(/^https?:\/\//i, "") : "", website),
      item("Instagram", instagram ? instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@") : "", instagram),
      item("Facebook", facebook ? "Perfil/página encontrado" : "", facebook),
      item("LinkedIn", linkedin ? "Página encontrada" : "", linkedin),
      item("Telefone público", phone, phone ? `tel:${digits(phone)}` : ""),
      item("E-mail público", email, email ? `mailto:${email}` : ""),
      item("Horário", hours),
      item("Categoria OSM", osm?.category || "")
    ].filter(Boolean).join("");

    const source = osm
      ? `<a href="${escapeHtml(osm.osmUrl)}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a><span class="pe-confidence">match ${confidence}</span>`
      : "nenhum registro cartográfico correspondente foi confirmado";

    box.innerHTML = `
      <div class="pe-head"><strong>Enriquecimento público</strong><span>SEM GOOGLE PLACES PAGO</span></div>
      ${grid ? `<div class="pe-grid">${grid}</div>` : `<div class="pe-empty">Não encontrei site ou rede social confirmada nas fontes públicas consultadas. Use os atalhos abaixo para a pesquisa manual.</div>`}
      <div class="pe-actions">
        <a class="pe-action" href="${escapeHtml(links.googleMaps)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
        <a class="pe-action" href="${escapeHtml(links.googleSearch)}" target="_blank" rel="noopener noreferrer">Pesquisar no Google</a>
        <a class="pe-action" href="${escapeHtml(links.instagramSearch)}" target="_blank" rel="noopener noreferrer">Buscar Instagram</a>
        <a class="pe-action" href="${escapeHtml(links.facebookSearch)}" target="_blank" rel="noopener noreferrer">Buscar Facebook</a>
        <a class="pe-action" href="${escapeHtml(links.linkedinSearch)}" target="_blank" rel="noopener noreferrer">Buscar LinkedIn</a>
      </div>
      <p class="pe-note">Fonte adicional: ${source}. Dados cartográficos © OpenStreetMap contributors. Nota e avaliações do Google não são raspadas: esses campos exigem Google Places/serviço autorizado. ${data?.osmError ? `<span class="pe-warning">${escapeHtml(data.osmError)}</span>` : ""}</p>
    `;
    box.classList.remove("hidden");
  }

  async function enrichCard(card, button) {
    const cnpj = cleanCnpj($("[data-cnpj]", card)?.textContent);
    if (!cnpj || cnpj.length !== 14) {
      alert("Não foi possível identificar o CNPJ desta empresa.");
      return;
    }

    const box = $(".public-enrichment-box", card);
    const cached = getCached(cnpj);
    if (cached) {
      renderEnrichment(box, cached);
      button.textContent = "Dados públicos carregados";
      return;
    }

    button.disabled = true;
    button.classList.add("is-loading");
    const original = button.textContent;
    button.textContent = "Cruzando fontes...";
    try {
      const data = await buildEnrichment(cnpj);
      setCached(cnpj, data);
      renderEnrichment(box, data);
      button.textContent = "Dados públicos carregados";
    } catch (error) {
      console.error("[RadarPublicEnrichment]", error);
      box.innerHTML = `<div class="pe-empty pe-warning">Não foi possível cruzar as fontes públicas agora. ${escapeHtml(error?.message || "Tente novamente em alguns instantes.")}</div>`;
      box.classList.remove("hidden");
      button.textContent = original;
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }

  function decorateCard(card) {
    if (!card || card.dataset.publicEnrichmentReady === "1") return;
    card.dataset.publicEnrichmentReady = "1";
    const actions = $(".card-actions", card);
    if (!actions) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button public-enrichment-btn";
    button.textContent = "Cruzar fontes grátis";
    button.addEventListener("click", () => enrichCard(card, button));
    actions.insertBefore(button, actions.firstChild);

    const box = document.createElement("div");
    box.className = "public-enrichment-box hidden";
    card.appendChild(box);
  }

  function decorateAll() {
    $$(".company-card").forEach(decorateCard);
  }

  function boot() {
    installStyles();
    decorateAll();
    const list = document.getElementById("companiesList");
    if (list) {
      const observer = new MutationObserver(() => decorateAll());
      observer.observe(list, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
