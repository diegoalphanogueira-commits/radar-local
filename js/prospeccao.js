/* =========================================================
   RADAR LOCAL — PROSPECÇÃO V1
   Fontes: Minha Receita (dados CNPJ/QSA) + IBGE (municípios)
   Não usa Google Places.
========================================================= */
(() => {
  const MY_RECEITA_BASE = "https://minhareceita.org";
  const IBGE_MUNICIPALITIES_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
  const state = {
    rows: [],
    visibleRows: [],
    cursor: "",
    lastSearch: null,
    busy: false
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const formatCnpj = value => {
    const v = digits(value).slice(0, 14);
    if (v.length !== 14) return v;
    return `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
  };
  const formatPhone = value => {
    const v = digits(value);
    if (v.length === 11) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return value || "";
  };

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
  const cardTemplate = $("#companyCardTemplate");

  function setBusy(busy, title = "Consultando dados públicos...", text = "Resolvendo município e buscando empresas.") {
    state.busy = busy;
    loadingPanel.classList.toggle("hidden", !busy);
    $("#loadingTitle").textContent = title;
    $("#loadingText").textContent = text;
    $$("button[type='submit']").forEach(button => button.disabled = busy);
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
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const err = new Error(body?.message || `HTTP_${response.status}`);
      err.status = response.status;
      throw err;
    }
    return response.json();
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
    const manual = $("#cnaeInput").value.split(",").map(digits).filter(Boolean);
    const values = [...new Set([preset, ...manual].filter(Boolean))];
    if (!values.length) throw new Error("Selecione um segmento ou informe pelo menos um CNAE.");
    return values;
  }

  function getSegmentLabel() {
    const select = $("#segmentPreset");
    const option = select.options[select.selectedIndex];
    return option?.dataset?.label || (digits($("#cnaeInput").value) ? `CNAE ${digits($("#cnaeInput").value)}` : "Negócio local");
  }

  function buildSearchUrl(search, cursor = "") {
    const params = new URLSearchParams();
    params.set("uf", search.uf);
    params.set("municipio", search.municipalityId);
    search.cnaes.forEach(code => params.append("cnae", code));
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
    return company?.nome_fantasia?.trim() || company?.razao_social?.trim() || "Empresa sem nome fantasia";
  }

  function companyMatchesFilters(company, search = state.lastSearch) {
    if (!search) return true;
    if (normalize(company.descricao_situacao_cadastral) && normalize(company.descricao_situacao_cadastral) !== "ativa") return false;
    if (search.neighborhood && !normalize(company.bairro).includes(normalize(search.neighborhood))) return false;
    if (search.companySize && normalize(company.porte) !== normalize(search.companySize) && normalize(company.descricao_porte) !== normalize(search.companySize)) return false;
    if (search.qsaOnly && (!Array.isArray(company.qsa) || !company.qsa.length)) return false;
    return true;
  }

  function applyQuickFilter() {
    const query = normalize(quickFilter.value);
    state.visibleRows = state.rows.filter(company => {
      if (!companyMatchesFilters(company)) return false;
      if (!query) return true;
      return [getCompanyName(company), company.razao_social, company.cnpj, company.bairro, company.municipio, company.cnae_fiscal_descricao]
        .some(value => normalize(value).includes(query));
    });
    renderResults();
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
    loadMoreBtn.classList.toggle("hidden", !state.cursor || state.lastSearch?.type !== "segment");
  }

  function renderCompanyCard(company) {
    const fragment = cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".company-card");
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
        const display = formatPhone(phone);
        return `<a href="https://wa.me/55${phone}" target="_blank" rel="noopener">${escapeHtml(display)}</a>`;
      }).join(" · ");
    } else {
      phoneEl.textContent = "Telefone não informado";
    }

    const emailEl = fragment.querySelector("[data-email]");
    if (company.email) {
      emailEl.innerHTML = `<a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>`;
    } else {
      emailEl.textContent = "E-mail não informado";
    }

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

    card.dataset.search = normalize([getCompanyName(company), company.razao_social, company.cnpj, company.bairro].join(" "));
    return fragment;
  }

  function buildCopyText(company, decisionMaker, phones) {
    return [
      getCompanyName(company),
      `CNPJ: ${formatCnpj(company.cnpj)}`,
      decisionMaker ? `Decisor/QSA: ${decisionMaker.nome_socio} — ${decisionMaker.qualificacao_socio || ""}` : "Decisor/QSA: não identificado",
      phones.length ? `Telefone cadastral: ${phones.map(formatPhone).join(", ")}` : "Telefone cadastral: não informado",
      company.email ? `E-mail cadastral: ${company.email}` : "E-mail cadastral: não informado",
      `Endereço: ${[company.logradouro, company.numero, company.bairro, company.municipio, company.uf].filter(Boolean).join(", ")}`
    ].join("\n");
  }

  function sendToDiagnosis(company) {
    const phone = phoneValues(company)[0] || "";
    const address = [company.descricao_tipo_de_logradouro, company.logradouro, company.numero, company.complemento, company.bairro, company.municipio, company.uf, company.cep]
      .filter(Boolean).join(", ");
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

  async function runSegmentSearch({ append = false } = {}) {
    clearError();
    const uf = $("#uf").value;
    const city = $("#city").value.trim();
    const cnaes = getSelectedCnaes();
    const segmentLabel = getSegmentLabel();
    if (!city) throw new Error("Informe a cidade.");

    let search = state.lastSearch;
    let cursor = "";
    if (!append) {
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
      state.cursor = "";
      quickFilter.value = "";
    } else {
      cursor = state.cursor;
    }

    setBusy(true, "Buscando empresas...", `${search.segmentLabel} em ${search.municipalityName}/${search.uf}.`);
    const data = await fetchJson(buildSearchUrl(search, cursor));
    const batch = Array.isArray(data?.data) ? data.data : [];
    state.rows = append ? [...state.rows, ...batch] : batch;
    state.cursor = String(data?.cursor || "");
    applyQuickFilter();
  }

  async function runCnpjSearch() {
    clearError();
    const cnpj = digits($("#cnpjDirect").value);
    if (cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");
    setBusy(true, "Consultando CNPJ...", `Buscando ${formatCnpj(cnpj)} nos dados cadastrais.`);
    const company = await fetchJson(`${MY_RECEITA_BASE}/${cnpj}`);
    state.lastSearch = { type: "cnpj" };
    state.rows = [company];
    state.visibleRows = [company];
    state.cursor = "";
    quickFilter.value = "";
    renderResults();
  }

  function csvCell(value) {
    const str = String(value ?? "").replace(/"/g, '""');
    return `"${str}"`;
  }

  function exportCsv() {
    if (!state.visibleRows.length) return;
    const header = ["Nome fantasia","Razão social","CNPJ","CNAE","Descrição CNAE","Município","UF","Bairro","Porte","Decisor/QSA","Qualificação","Telefone cadastral","E-mail cadastral"];
    const lines = [header.map(csvCell).join(";")];
    state.visibleRows.forEach(company => {
      const dm = pickDecisionMaker(company);
      lines.push([
        company.nome_fantasia || "", company.razao_social || "", formatCnpj(company.cnpj), company.cnae_fiscal || "", company.cnae_fiscal_descricao || "", company.municipio || "", company.uf || "", company.bairro || "", company.porte || "", dm?.nome_socio || "", dm?.qualificacao_socio || "", phoneValues(company).map(formatPhone).join(" | "), company.email || ""
      ].map(csvCell).join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `radar-prospeccao-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
    const v = digits(event.target.value).slice(0, 14);
    event.target.value = v.length <= 2 ? v : v.length <= 5 ? `${v.slice(0,2)}.${v.slice(2)}` : v.length <= 8 ? `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}` : v.length <= 12 ? `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}` : `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
  });

  segmentSearchForm.addEventListener("submit", async event => {
    event.preventDefault();
    try { await runSegmentSearch(); resultsSection.scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (error) { console.error("[RadarProspecting]", error); showError(error.message || "Falha ao consultar empresas."); }
    finally { setBusy(false); }
  });

  cnpjSearchForm.addEventListener("submit", async event => {
    event.preventDefault();
    try { await runCnpjSearch(); resultsSection.scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch (error) { console.error("[RadarProspecting]", error); showError(error.message || "Falha ao consultar o CNPJ."); }
    finally { setBusy(false); }
  });

  loadMoreBtn.addEventListener("click", async () => {
    if (!state.cursor || state.busy) return;
    try { await runSegmentSearch({ append: true }); }
    catch (error) { console.error("[RadarProspecting]", error); showError(error.message || "Falha ao carregar mais empresas."); }
    finally { setBusy(false); }
  });

  quickFilter.addEventListener("input", applyQuickFilter);
  exportCsvBtn.addEventListener("click", exportCsv);
})();
