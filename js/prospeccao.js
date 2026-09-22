/* =========================================================
   RADAR LOCAL — PROSPECÇÃO V1
   Fontes: Minha Receita (CNPJ/QSA) + IBGE (municípios)
   Descoberta sem Google Places.
========================================================= */
(() => {
  const MY_RECEITA_BASE = "https://minhareceita.org";
  const IBGE_MUNICIPALITIES_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
  const SAVED_KEY = "radarProspectingSavedV1";
  const CACHE_KEY = "radarProspectingCacheV1";
  const MAX_CACHE = 1200;
  const STATUSES = ["Novo", "Prioridade", "Abordado", "Respondeu", "Reunião", "Proposta", "Cliente"];

  const state = {
    rows: [],
    visibleRows: [],
    cursorByCnae: {},
    lastSearch: null,
    busy: false,
    saved: loadSaved()
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const cleanCnpj = value => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

  function formatCnpj(value) {
    const v = cleanCnpj(value);
    if (v.length !== 14) return v;
    return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
  }

  function formatCnpjTyping(value) {
    const v = cleanCnpj(value);
    if (v.length <= 2) return v;
    if (v.length <= 5) return `${v.slice(0,2)}.${v.slice(2)}`;
    if (v.length <= 8) return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`;
    if (v.length <= 12) return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`;
    return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
  }

  function formatPhone(value) {
    const v = digits(value).replace(/^55(?=\d{10,11}$)/, "");
    if (v.length === 11) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return String(value || "");
  }

  const segmentSearchForm = $("#segmentSearchForm");
  const cnpjSearchForm = $("#cnpjSearchForm");
  const resultsSection = $("#resultsSection");
  const companiesList = $("#companiesList");
  const loadingPanel = $("#loadingPanel");
  const errorPanel = $("#errorPanel");
  const errorText = $("#errorText");
  const loadMoreBtn = $("#loadMoreBtn");
  const quickFilter = $("#quickFilter");
  const exportCsvBtn = $("#exportCsvBtn");
  const exportSavedBtn = $("#exportSavedBtn");
  const saveVisibleBtn = $("#saveVisibleBtn");
  const clearSavedBtn = $("#clearSavedBtn");
  const cardTemplate = $("#companyCardTemplate");
  const sourceStatus = $("#sourceStatus");
  const toast = $("#toast");

  function loadSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved));
    } catch (error) {
      console.warn("[RadarProspecting] Não foi possível salvar a lista.", error);
      showToast("A lista atingiu o limite de armazenamento deste navegador.");
    }
    renderSaved();
    updateHeroMetrics();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("visible"), 1900);
  }

  function setBusy(busy, title = "Consultando dados públicos...", text = "Resolvendo município e buscando empresas.") {
    state.busy = busy;
    loadingPanel.classList.toggle("hidden", !busy);
    $("#loadingTitle").textContent = title;
    $("#loadingText").textContent = text;
    $$("button[type='submit']").forEach(button => button.disabled = busy);
    loadMoreBtn.disabled = busy;
  }

  function showError(message) {
    errorText.textContent = message;
    errorPanel.classList.remove("hidden");
  }

  function clearError() {
    errorPanel.classList.add("hidden");
    errorText.textContent = "";
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, {
        ...options,
        mode: "cors",
        signal: options.signal || controller.signal,
        headers: { Accept: "application/json", ...(options.headers || {}) }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(body?.message || `HTTP_${response.status}`);
        err.status = response.status;
        throw err;
      }
      return response.json();
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("A fonte de dados demorou demais para responder. Tente novamente.");
      if (error instanceof TypeError) throw new Error("Não foi possível acessar a fonte pública agora. Verifique a conexão e tente novamente.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadDataFreshness() {
    try {
      const data = await fetchJson(`${MY_RECEITA_BASE}/updated`);
      const raw = data?.updated || data?.updated_at || data?.date || data?.data || Object.values(data || {})[0] || "";
      const label = raw ? `Base pública · ${String(raw).slice(0,10)}` : "Base pública conectada";
      sourceStatus.classList.add("ready");
      sourceStatus.classList.remove("error");
      sourceStatus.querySelector("b").textContent = label;
    } catch {
      sourceStatus.classList.add("error");
      sourceStatus.querySelector("b").textContent = "Base pública indisponível";
    }
  }

  async function resolveMunicipality(uf, cityName) {
    const url = `${IBGE_MUNICIPALITIES_BASE}/${encodeURIComponent(uf)}/municipios?orderBy=nome`;
    const rows = await fetchJson(url);
    const wanted = normalize(cityName);
    const exact = rows.find(item => normalize(item.nome) === wanted);
    if (exact) return { id: String(exact.id), name: exact.nome };
    const starts = rows.find(item => normalize(item.nome).startsWith(wanted));
    if (starts) return { id: String(starts.id), name: starts.nome };
    throw new Error(`Município “${cityName}” não encontrado no IBGE para ${uf}.`);
  }

  function getSelectedCnaes() {
    const preset = digits($("#segmentPreset").value);
    const manual = $("#cnaeInput").value.split(",").map(digits).map(v => v.slice(0,7)).filter(v => v.length === 7);
    const values = [...new Set([preset, ...manual].filter(v => v.length === 7))];
    if (!values.length) throw new Error("Selecione um segmento ou informe pelo menos um CNAE com 7 dígitos.");
    return values;
  }

  function getSegmentLabel() {
    const select = $("#segmentPreset");
    const option = select.options[select.selectedIndex];
    const manual = $("#cnaeInput").value.split(",").map(digits).filter(Boolean);
    return option?.dataset?.label || (manual.length ? `CNAE ${manual.join(", ")}` : "Negócio local");
  }

  function buildSearchUrl(search, cnae, cursor = "") {
    const params = new URLSearchParams();
    params.set("uf", search.uf);
    params.set("municipio", search.municipalityId);
    params.set("cnae", cnae);
    params.set("limit", String(search.limit || 100));
    if (cursor) params.set("cursor", cursor);
    return `${MY_RECEITA_BASE}/?${params.toString()}`;
  }

  function pickDecisionMaker(company) {
    const qsa = Array.isArray(company?.qsa) ? company.qsa : [];
    if (!qsa.length) return null;
    const priority = ["socio-administrador", "sócio-administrador", "administrador", "titular", "empresario", "empresário", "presidente", "diretor", "socio", "sócio"];
    return qsa
      .map(person => ({ person, rank: priority.findIndex(term => normalize(person.qualificacao_socio).includes(normalize(term))) }))
      .sort((a,b) => (a.rank < 0 ? 999 : a.rank) - (b.rank < 0 ? 999 : b.rank))[0]?.person || qsa[0];
  }

  function phoneValues(company) {
    return [...new Set([company?.ddd_telefone_1, company?.ddd_telefone_2].map(digits).filter(v => v.length >= 10))];
  }

  function getCompanyName(company) {
    return String(company?.nome_fantasia || "").trim() || String(company?.razao_social || "").trim() || "Empresa sem nome fantasia";
  }

  function isActive(company) {
    const desc = normalize(company?.descricao_situacao_cadastral);
    if (desc) return desc === "ativa";
    const code = Number(company?.situacao_cadastral || 0);
    return !code || code === 2;
  }

  function companyMatchesFilters(company, search = state.lastSearch) {
    if (!search) return true;
    if (!isActive(company)) return false;
    if (search.neighborhood && !normalize(company.bairro).includes(normalize(search.neighborhood))) return false;
    if (search.companySize && normalize(company.porte || company.descricao_porte) !== normalize(search.companySize)) return false;
    if (search.qsaOnly && (!Array.isArray(company.qsa) || !company.qsa.length)) return false;
    return true;
  }

  function companySearchText(company) {
    const qsa = Array.isArray(company.qsa) ? company.qsa.map(item => `${item.nome_socio || ""} ${item.qualificacao_socio || ""}`).join(" ") : "";
    return normalize([getCompanyName(company), company.razao_social, company.cnpj, company.bairro, company.municipio, company.cnae_fiscal_descricao, qsa].join(" "));
  }

  function applyQuickFilter() {
    const query = normalize(quickFilter.value);
    state.visibleRows = state.rows.filter(company => companyMatchesFilters(company) && (!query || companySearchText(company).includes(query)));
    renderResults();
  }

  function dedupeCompanies(rows) {
    const map = new Map();
    rows.forEach(company => {
      const key = cleanCnpj(company?.cnpj) || `${company?.razao_social}|${company?.municipio}`;
      if (!map.has(key)) map.set(key, company);
    });
    return [...map.values()];
  }

  function compactCompany(company) {
    return {
      cnpj: company.cnpj || "",
      nome_fantasia: company.nome_fantasia || "",
      razao_social: company.razao_social || "",
      cnae_fiscal: company.cnae_fiscal || "",
      cnae_fiscal_descricao: company.cnae_fiscal_descricao || "",
      descricao_situacao_cadastral: company.descricao_situacao_cadastral || "",
      situacao_cadastral: company.situacao_cadastral ?? null,
      porte: company.porte || company.descricao_porte || "",
      logradouro: company.logradouro || "",
      descricao_tipo_de_logradouro: company.descricao_tipo_de_logradouro || "",
      numero: company.numero || "",
      complemento: company.complemento || "",
      bairro: company.bairro || "",
      municipio: company.municipio || "",
      uf: company.uf || "",
      cep: company.cep || "",
      ddd_telefone_1: company.ddd_telefone_1 || "",
      ddd_telefone_2: company.ddd_telefone_2 || "",
      email: company.email || "",
      data_inicio_atividade: company.data_inicio_atividade || "",
      qsa: Array.isArray(company.qsa) ? company.qsa.map(person => ({ nome_socio: person.nome_socio || "", qualificacao_socio: person.qualificacao_socio || "", data_entrada_sociedade: person.data_entrada_sociedade || "" })).slice(0,20) : []
    };
  }

  function cacheCompanies(rows) {
    try {
      const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
      rows.forEach(company => {
        const key = cleanCnpj(company.cnpj);
        if (key) existing[key] = { savedAt: Date.now(), company: compactCompany(company) };
      });
      const entries = Object.entries(existing).sort((a,b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0)).slice(0, MAX_CACHE);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (error) {
      console.warn("[RadarProspecting] Cache local indisponível.", error);
    }
  }

  function updateHeroMetrics() {
    $("#heroFound").textContent = state.visibleRows.length.toLocaleString("pt-BR");
    $("#heroQsa").textContent = state.visibleRows.filter(c => Array.isArray(c.qsa) && c.qsa.length).length.toLocaleString("pt-BR");
    $("#heroSaved").textContent = state.saved.length.toLocaleString("pt-BR");
  }

  function isSaved(company) {
    const key = cleanCnpj(company.cnpj);
    return state.saved.some(item => cleanCnpj(item.company?.cnpj) === key);
  }

  function saveCompany(company, silent = false) {
    const key = cleanCnpj(company.cnpj);
    if (!key) return false;
    if (state.saved.some(item => cleanCnpj(item.company?.cnpj) === key)) return false;
    state.saved.unshift({ id: key, status: "Novo", savedAt: new Date().toISOString(), company: compactCompany(company) });
    persistSaved();
    if (!silent) showToast("Prospect adicionado à sua lista.");
    return true;
  }

  function removeSaved(id) {
    state.saved = state.saved.filter(item => item.id !== id);
    persistSaved();
    applyQuickFilter();
    showToast("Prospect removido.");
  }

  function renderResults() {
    companiesList.replaceChildren();
    state.visibleRows.forEach(company => companiesList.appendChild(renderCompanyCard(company)));

    const total = state.visibleRows.length;
    const withQsa = state.visibleRows.filter(c => Array.isArray(c.qsa) && c.qsa.length).length;
    const withPhone = state.visibleRows.filter(c => phoneValues(c).length).length;
    const withEmail = state.visibleRows.filter(c => String(c.email || "").trim()).length;
    $("#summaryTotal").textContent = total.toLocaleString("pt-BR");
    $("#summaryQsa").textContent = withQsa.toLocaleString("pt-BR");
    $("#summaryPhone").textContent = withPhone.toLocaleString("pt-BR");
    $("#summaryEmail").textContent = withEmail.toLocaleString("pt-BR");
    $("#resultsTitle").textContent = `${total.toLocaleString("pt-BR")} empresas na lista`;

    if (state.lastSearch?.type === "segment") {
      $("#resultsMeta").textContent = `${state.lastSearch.segmentLabel} · ${state.lastSearch.municipalityName}/${state.lastSearch.uf} · CNAE ${state.lastSearch.cnaes.join(", ")}`;
    } else {
      $("#resultsMeta").textContent = "Consulta direta por CNPJ";
    }

    resultsSection.classList.remove("hidden");
    const hasMore = Object.values(state.cursorByCnae).some(Boolean);
    loadMoreBtn.classList.toggle("hidden", !hasMore || state.lastSearch?.type !== "segment");
    updateHeroMetrics();
  }

  function renderCompanyCard(company) {
    const fragment = cardTemplate.content.cloneNode(true);
    const decisionMaker = pickDecisionMaker(company);
    const phones = phoneValues(company);
    const address = [company.logradouro, company.numero, company.complemento].filter(Boolean).join(", ");
    const location = [company.bairro, company.municipio, company.uf].filter(Boolean).join(" · ");
    const cnae = company.cnae_fiscal ? `${company.cnae_fiscal} — ${company.cnae_fiscal_descricao || "Atividade principal"}` : "Não informado";

    fragment.querySelector("[data-company-name]").textContent = getCompanyName(company);
    fragment.querySelector("[data-legal-name]").textContent = company.razao_social || "Razão social não informada";
    fragment.querySelector("[data-company-size]").textContent = company.porte || company.descricao_porte || "Porte não informado";
    fragment.querySelector("[data-cnpj]").textContent = formatCnpj(company.cnpj);
    fragment.querySelector("[data-cnae]").textContent = cnae;
    fragment.querySelector("[data-location]").textContent = location || address || "Local não informado";

    const dm = fragment.querySelector("[data-decision-maker]");
    if (decisionMaker) {
      dm.innerHTML = `<span class="dm-label">DECISOR / QSA</span><strong>${escapeHtml(decisionMaker.nome_socio || "Sócio identificado")}</strong><span>${escapeHtml(decisionMaker.qualificacao_socio || "Integrante do quadro societário")}</span>`;
    } else {
      dm.innerHTML = `<span class="dm-label">DECISOR / QSA</span><strong>Não identificado nessa ficha</strong><span>O estabelecimento não retornou integrantes do QSA.</span>`;
    }

    const phoneEl = fragment.querySelector("[data-phone]");
    if (phones.length) {
      phoneEl.innerHTML = phones.map(phone => {
        const localPhone = digits(phone).replace(/^55(?=\d{10,11}$)/, "");
        return `<a href="https://wa.me/55${localPhone}" target="_blank" rel="noopener">${escapeHtml(formatPhone(localPhone))}</a>`;
      }).join(" · ");
    } else phoneEl.textContent = "Telefone não informado";

    const emailEl = fragment.querySelector("[data-email]");
    if (company.email) emailEl.innerHTML = `<a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>`;
    else emailEl.textContent = "E-mail não informado";

    const saveBtn = fragment.querySelector("[data-save]");
    if (isSaved(company)) {
      saveBtn.textContent = "Salvo na lista";
      saveBtn.classList.add("saved-tag");
    }
    saveBtn.addEventListener("click", event => {
      if (saveCompany(company)) {
        event.currentTarget.textContent = "Salvo na lista";
        event.currentTarget.classList.add("saved-tag");
      } else showToast("Esse prospect já está na sua lista.");
    });

    fragment.querySelector("[data-diagnose]").addEventListener("click", () => sendToDiagnosis(company));
    fragment.querySelector("[data-copy]").addEventListener("click", async event => {
      const text = buildCopyText(company, decisionMaker, phones);
      try {
        await navigator.clipboard.writeText(text);
        const button = event.currentTarget;
        const old = button.textContent;
        button.textContent = "Copiado";
        setTimeout(() => button.textContent = old, 1200);
      } catch {
        window.prompt("Copie os dados:", text);
      }
    });
    return fragment;
  }

  function buildCopyText(company, decisionMaker = pickDecisionMaker(company), phones = phoneValues(company)) {
    return [
      getCompanyName(company),
      `CNPJ: ${formatCnpj(company.cnpj)}`,
      decisionMaker ? `Decisor/QSA: ${decisionMaker.nome_socio} — ${decisionMaker.qualificacao_socio || ""}` : "Decisor/QSA: não identificado",
      phones.length ? `Telefone cadastral: ${phones.map(formatPhone).join(", ")}` : "Telefone cadastral: não informado",
      company.email ? `E-mail cadastral: ${company.email}` : "E-mail cadastral: não informado",
      `Endereço: ${[company.descricao_tipo_de_logradouro, company.logradouro, company.numero, company.bairro, company.municipio, company.uf].filter(Boolean).join(", ")}`
    ].join("\n");
  }

  function sendToDiagnosis(company) {
    const phone = phoneValues(company)[0] || "";
    const address = [company.descricao_tipo_de_logradouro, company.logradouro, company.numero, company.complemento, company.bairro, company.municipio, company.uf, company.cep].filter(Boolean).join(", ");
    const params = new URLSearchParams({
      origem: "posicionamento-local",
      empresa: getCompanyName(company),
      regiao: `${company.municipio || ""} - ${company.uf || ""}`.replace(/^\s*-\s*$/, ""),
      segmento: "outro",
      segmento_nome: company.cnae_fiscal_descricao || state.lastSearch?.segmentLabel || "Negócio local",
      endereco: address,
      telefone: phone,
      bairro: company.bairro || "",
      cep: String(company.cep || "")
    });
    localStorage.setItem("radarProspectingSource", JSON.stringify({ cnpj: company.cnpj, qsa: company.qsa || [], source: "prospecting" }));
    window.location.href = `./?${params.toString()}`;
  }

  async function fetchCnaeBatch(search, cnae, cursor = "") {
    const data = await fetchJson(buildSearchUrl(search, cnae, cursor));
    return { cnae, data: Array.isArray(data?.data) ? data.data : [], cursor: String(data?.cursor || "") };
  }

  async function runSegmentSearch({ append = false } = {}) {
    clearError();
    let search = state.lastSearch;

    if (!append) {
      const uf = $("#uf").value;
      const city = $("#city").value.trim();
      if (!city) throw new Error("Informe a cidade.");
      const cnaes = getSelectedCnaes();
      const segmentLabel = getSegmentLabel();
      setBusy(true, "Resolvendo município...", `Localizando ${city}/${uf} no IBGE.`);
      const municipality = await resolveMunicipality(uf, city);
      search = {
        type: "segment",
        uf,
        municipalityId: municipality.id,
        municipalityName: municipality.name,
        cnaes,
        segmentLabel,
        neighborhood: $("#neighborhood").value.trim(),
        companySize: $("#companySize").value,
        qsaOnly: $("#qsaOnly").value === "yes",
        limit: Number($("#limit").value) || 100
      };
      state.lastSearch = search;
      state.rows = [];
      state.cursorByCnae = Object.fromEntries(cnaes.map(code => [code, ""]));
      quickFilter.value = "";
    }

    setBusy(true, "Buscando empresas...", `${search.segmentLabel} em ${search.municipalityName}/${search.uf}.`);
    const batches = [];
    for (const cnae of search.cnaes) {
      const previousCursor = state.cursorByCnae[cnae];
      if (append && previousCursor === null) continue;
      const result = await fetchCnaeBatch(search, cnae, append ? (previousCursor || "") : "");
      batches.push(...result.data);
      state.cursorByCnae[cnae] = result.cursor || null;
    }

    state.rows = dedupeCompanies(append ? [...state.rows, ...batches] : batches);
    cacheCompanies(state.rows);
    applyQuickFilter();
  }

  async function runCnpjSearch() {
    clearError();
    const cnpj = cleanCnpj($("#cnpjDirect").value);
    if (cnpj.length !== 14) throw new Error("Informe um CNPJ válido com 14 caracteres.");
    setBusy(true, "Consultando CNPJ...", `Buscando ${formatCnpj(cnpj)} nos dados cadastrais.`);
    const company = await fetchJson(`${MY_RECEITA_BASE}/${encodeURIComponent(cnpj)}`);
    state.lastSearch = { type: "cnpj" };
    state.rows = [company];
    state.visibleRows = [company];
    state.cursorByCnae = {};
    quickFilter.value = "";
    cacheCompanies([company]);
    renderResults();
  }

  function renderSaved() {
    const tbody = $("#savedTableBody");
    tbody.replaceChildren();
    $("#savedTotal").textContent = state.saved.length.toLocaleString("pt-BR");
    $("#savedQsa").textContent = state.saved.filter(item => Array.isArray(item.company?.qsa) && item.company.qsa.length).length.toLocaleString("pt-BR");
    $("#savedPhone").textContent = state.saved.filter(item => phoneValues(item.company).length).length.toLocaleString("pt-BR");
    $("#savedEmail").textContent = state.saved.filter(item => String(item.company?.email || "").trim()).length.toLocaleString("pt-BR");
    $("#savedEmpty").classList.toggle("hidden", state.saved.length > 0);
    $("#savedTableWrap").classList.toggle("hidden", state.saved.length === 0);

    state.saved.forEach(item => {
      const company = item.company || {};
      const dm = pickDecisionMaker(company);
      const phones = phoneValues(company);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(getCompanyName(company))}</strong><small>${escapeHtml(formatCnpj(company.cnpj))} · ${escapeHtml([company.bairro, company.municipio, company.uf].filter(Boolean).join(" / "))}</small></td>
        <td><strong>${escapeHtml(dm?.nome_socio || "Não identificado")}</strong><small>${escapeHtml(dm?.qualificacao_socio || "QSA não retornado")}</small></td>
        <td><strong>${escapeHtml(phones[0] ? formatPhone(phones[0]) : "Sem telefone")}</strong><small>${escapeHtml(company.email || "Sem e-mail")}</small></td>
        <td></td><td></td>`;

      const statusCell = tr.children[3];
      const select = document.createElement("select");
      STATUSES.forEach(status => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = status === item.status;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        item.status = select.value;
        persistSaved();
      });
      statusCell.appendChild(select);

      const actionCell = tr.children[4];
      const actions = document.createElement("div");
      actions.className = "saved-actions-row";
      const diagnose = document.createElement("button");
      diagnose.className = "mini-button";
      diagnose.type = "button";
      diagnose.textContent = "Diagnóstico";
      diagnose.addEventListener("click", () => sendToDiagnosis(company));
      actions.appendChild(diagnose);

      if (phones[0]) {
        const whatsapp = document.createElement("button");
        whatsapp.className = "mini-button";
        whatsapp.type = "button";
        whatsapp.textContent = "WhatsApp";
        whatsapp.addEventListener("click", () => {
          const number = digits(phones[0]).replace(/^55(?=\d{10,11}$)/, "");
          window.open(`https://wa.me/55${number}`, "_blank", "noopener");
        });
        actions.appendChild(whatsapp);
      }

      const remove = document.createElement("button");
      remove.className = "mini-button remove";
      remove.type = "button";
      remove.textContent = "Remover";
      remove.addEventListener("click", () => removeSaved(item.id));
      actions.appendChild(remove);
      actionCell.appendChild(actions);
      tbody.appendChild(tr);
    });
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function downloadCsv(companies, filename, statuses = null) {
    if (!companies.length) {
      showToast("Não há dados para exportar.");
      return;
    }
    const header = ["Nome fantasia","Razão social","CNPJ","CNAE","Descrição CNAE","Município","UF","Bairro","Porte","Decisor/QSA","Qualificação","Telefone cadastral","E-mail cadastral","Status"];
    const lines = [header.map(csvCell).join(";")];
    companies.forEach((company, index) => {
      const dm = pickDecisionMaker(company);
      lines.push([
        company.nome_fantasia || "", company.razao_social || "", formatCnpj(company.cnpj), company.cnae_fiscal || "", company.cnae_fiscal_descricao || "", company.municipio || "", company.uf || "", company.bairro || "", company.porte || "", dm?.nome_socio || "", dm?.qualificacao_socio || "", phoneValues(company).map(formatPhone).join(" | "), company.email || "", statuses?.[index] || ""
      ].map(csvCell).join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    const url = link.href;
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $$("[data-search-tab]").forEach(button => button.addEventListener("click", () => {
    $$("[data-search-tab]").forEach(tab => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    const target = button.dataset.searchTab;
    $$("[data-search-panel]").forEach(panel => panel.classList.toggle("hidden", panel.dataset.searchPanel !== target));
    clearError();
  }));

  $("#segmentPreset").addEventListener("change", event => {
    if (event.target.value) $("#cnaeInput").value = "";
  });

  $("#cnpjDirect").addEventListener("input", event => {
    event.target.value = formatCnpjTyping(event.target.value);
  });

  segmentSearchForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await runSegmentSearch();
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("[RadarProspecting]", error);
      showError(error.message || "Falha ao consultar empresas.");
    } finally {
      setBusy(false);
    }
  });

  cnpjSearchForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await runCnpjSearch();
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("[RadarProspecting]", error);
      showError(error.message || "Falha ao consultar o CNPJ.");
    } finally {
      setBusy(false);
    }
  });

  loadMoreBtn.addEventListener("click", async () => {
    if (state.busy || !Object.values(state.cursorByCnae).some(Boolean)) return;
    try {
      await runSegmentSearch({ append: true });
    } catch (error) {
      console.error("[RadarProspecting]", error);
      showError(error.message || "Falha ao carregar mais empresas.");
    } finally {
      setBusy(false);
    }
  });

  quickFilter.addEventListener("input", applyQuickFilter);
  exportCsvBtn.addEventListener("click", () => downloadCsv(state.visibleRows, `radar-resultados-${new Date().toISOString().slice(0,10)}.csv`));
  exportSavedBtn.addEventListener("click", () => downloadCsv(state.saved.map(item => item.company), `radar-prospects-${new Date().toISOString().slice(0,10)}.csv`, state.saved.map(item => item.status)));

  saveVisibleBtn.addEventListener("click", () => {
    let added = 0;
    state.visibleRows.forEach(company => { if (saveCompany(company, true)) added += 1; });
    applyQuickFilter();
    showToast(added ? `${added} prospect${added === 1 ? "" : "s"} adicionados.` : "Todos os resultados visíveis já estão salvos.");
  });

  clearSavedBtn.addEventListener("click", () => {
    if (!state.saved.length) return;
    if (!window.confirm("Limpar toda a lista de prospects salva neste navegador?")) return;
    state.saved = [];
    persistSaved();
    applyQuickFilter();
    showToast("Lista limpa.");
  });

  renderSaved();
  updateHeroMetrics();
  loadDataFreshness();
})();
