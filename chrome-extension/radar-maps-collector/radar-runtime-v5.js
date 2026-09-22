(() => {
  "use strict";

  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const TARGET_KEY = "radarV1CoverageTargetV3";
  const RUNTIME_ID = "radar-rc14-runtime";
  let active = false;
  let context = null;
  let firstPartialWritten = false;
  let syncTimer = null;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const GROUPS = [
    { id:"barbearia", test:/barbear|barber|corte masculino|barba e cabelo|salao masculino/, terms:["barbearia","barbeiro","barber shop","barbearia masculina","corte masculino","barba e cabelo","salão masculino","barbearia premium","cabelo masculino"] },
    { id:"odontologia", test:/odont|dentist|dental|ortodont|implantodont|endodont/, terms:["dentista","clínica odontológica","odontologia","consultório odontológico","cirurgião-dentista","ortodontista","implantodontista","implante dentário","odontopediatra","endodontista","prótese dentária","clareamento dental"] },
    { id:"estetica", test:/estet|beleza|harmoniza|depila|limpeza de pele|spa/, terms:["clínica de estética","centro de estética","estética facial","estética corporal","estética avançada","harmonização facial","limpeza de pele","depilação a laser","esteticista","spa estético","clínica de beleza"] },
    { id:"manicure", test:/manicure|pedicure|unha|nail|esmalter/, terms:["manicure","pedicure","esmalteria","nail designer","salão de unhas","alongamento de unhas","unhas em gel","manicure e pedicure","studio de unhas"] },
    { id:"podologia", test:/podolog/, terms:["podologia","clínica de podologia","podólogo","podóloga","tratamento dos pés","podologia clínica"] },
    { id:"pet-veterinaria", test:/pet|veterin|banho e tosa/, terms:["pet shop","petshop","banho e tosa","clínica veterinária","veterinário","hospital veterinário","hotel para cães","creche para cães","loja de ração"] },
    { id:"padaria", test:/padaria|panific|confeitaria|bakery/, terms:["padaria","panificadora","confeitaria","padaria artesanal","bakery","café e padaria","pães artesanais","padaria e confeitaria"] },
    { id:"seguros", test:/seguro|corretor/, terms:["corretora de seguros","seguros","corretor de seguros","seguro auto","seguro empresarial"] },
    { id:"imobiliaria", test:/imobili|imoveis/, terms:["imobiliária","corretora de imóveis","corretor de imóveis","imóveis","imobiliária venda aluguel"] },
    { id:"contabilidade", test:/contab|contador/, terms:["escritório de contabilidade","contabilidade","contador","assessoria contábil"] },
    { id:"advocacia", test:/advoc|advog/, terms:["escritório de advocacia","advogado","advocacia","assessoria jurídica"] },
    { id:"academia", test:/academia|fitness|muscul/, terms:["academia","academia musculação","centro de treinamento","personal trainer","fitness"] },
    { id:"restaurante", test:/restaurante|pizzaria|lanchonete|hamburg/, terms:["restaurante","pizzaria","lanchonete","hamburgueria","comida delivery"] }
  ];

  function canonical(term) {
    const n = normalize(term);
    return GROUPS.find(g => g.test.test(n))?.id || n;
  }

  function queryVariants(term, region) {
    const raw = String(term || "").trim();
    const group = GROUPS.find(g => g.id === canonical(raw));
    const values = group ? [...group.terms] : [raw, `${raw} perto`, `${raw} serviços`, `${raw} especialista`, `${raw} loja`];
    if (raw && !values.some(v => normalize(v) === normalize(raw))) values.unshift(raw);
    return [...new Set(values.map(v => `${v} ${region}`.trim()))].slice(0, 12);
  }

  function cleanMapsUrl(url) {
    return String(url || "").split("?")[0].replace(/\/$/, "");
  }

  function leadKey(lead) {
    return cleanMapsUrl(lead?.mapsUrl) || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || "")}`);
  }

  function dedupe(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(lead => {
      if (!lead?.name) return;
      const key = leadKey(lead);
      if (!key) return;
      const prev = map.get(key) || {};
      const next = { ...prev };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) next[field] = value;
      });
      map.set(key, next);
    });
    return [...map.values()];
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  }

  function exactSeed(next) {
    const meta = loadJson(META_KEY, {});
    const same = canonical(meta.term || "") === next.segment
      && normalize(meta.region || "") === normalize(next.region)
      && Number(meta.radiusKm || 5) === Number(next.radiusKm || 5);
    return same ? dedupe(loadJson(LEADS_KEY, [])) : [];
  }

  function statusBox(title, text, mode = "busy") {
    const legacy = document.querySelector("#mapsCollectorState");
    if (legacy) {
      legacy.className = `maps-collector-state${mode === "ready" ? " ready" : ""}`;
      legacy.querySelector("b") && (legacy.querySelector("b").textContent = title);
      legacy.querySelector("span") && (legacy.querySelector("span").textContent = text);
    }
    const batch = document.querySelector("#v4BatchStatus");
    if (batch) {
      batch.querySelector("b") && (batch.querySelector("b").textContent = title);
      batch.querySelector("span") && (batch.querySelector("span").textContent = text);
    }
  }

  function setButtons(value) {
    ["#mapsOpenGoogleButton", "#v4BatchSearch", "#v4Enrich"].forEach(selector => {
      const button = document.querySelector(selector);
      if (!button) return;
      button.disabled = value;
      button.classList.toggle("collecting", value);
      button.classList.toggle("is-busy", value);
    });
  }

  function notifyPage(leads, patch = {}) {
    if (!context) return;
    const clean = dedupe(leads);
    const previous = loadJson(META_KEY, {});
    const next = {
      ...previous,
      term: context.term,
      region: context.region,
      radiusKm: context.radiusKm,
      activeSearchSegment: context.segment,
      coverageTarget: context.targetMode,
      count: clean.length,
      source: RUNTIME_ID,
      ...patch
    };
    localStorage.setItem(META_KEY, JSON.stringify(next));
    localStorage.setItem(LEADS_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: clean.length, source: RUNTIME_ID } }));
  }

  async function syncPartial(force = false) {
    if (!active || !context) return [];
    try {
      const response = await chrome.runtime.sendMessage({ cmd: "GET_STATE" });
      const leads = dedupe(response?.leads || []);
      if (!leads.length && !force) return [];
      if (leads.length) {
        firstPartialWritten = true;
        notifyPage(leads, { searchInProgress: true, searchHeartbeatAt: new Date().toISOString(), v4Center: context.center || null });
      }
      return leads;
    } catch {
      return [];
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncPartial(false), 80);
  }

  function targetMode() {
    const value = String(document.querySelector("#radarCoverageTarget")?.value || localStorage.getItem(TARGET_KEY) || "max");
    return ["30","50","100","max"].includes(value) ? value : "max";
  }

  function targetLabel(value) {
    return value === "max" ? "Máxima" : `${value}+`;
  }

  async function run() {
    if (active) return;
    const term = String(document.querySelector("#mapsSearchTerm")?.value || "").trim();
    const region = String(document.querySelector("#mapsSearchCity")?.value || "").trim();
    const radiusKm = Number(document.querySelector("#v4Radius")?.value || 5) || 5;
    if (!term || !region) return;

    context = {
      term,
      region,
      radiusKm,
      segment: canonical(term),
      targetMode: targetMode(),
      center: null
    };
    const seed = exactSeed(context);
    active = true;
    firstPartialWritten = false;
    setButtons(true);
    statusBox("Mapeando região...", `Cobertura ${targetLabel(context.targetMode)} · a lista será atualizada durante a coleta.`);

    // Não apaga a tela imediatamente. A primeira parcial da nova sessão substitui a coleta anterior.
    const previous = loadJson(META_KEY, {});
    localStorage.setItem(META_KEY, JSON.stringify({
      ...previous,
      term,
      region,
      radiusKm,
      activeSearchSegment: context.segment,
      coverageTarget: context.targetMode,
      searchInProgress: true,
      searchStartedAt: new Date().toISOString(),
      searchHeartbeatAt: new Date().toISOString()
    }));

    try {
      const result = await chrome.runtime.sendMessage({
        cmd: "RUN_MARKET_SEARCH_V3",
        term,
        segment: context.segment,
        region,
        radiusKm,
        queries: queryVariants(term, region),
        targetMode: context.targetMode,
        maxScrolls: 125,
        seedLeads: seed
      });
      if (!result?.ok) throw new Error(result?.error || "Falha na descoberta do Google Maps.");

      context.center = result?.context?.center || null;
      let leads = dedupe(result.leads || []);
      notifyPage(leads, {
        searchInProgress: true,
        discoveryCompletedAt: new Date().toISOString(),
        coverageTargetLabel: result.targetLabel || targetLabel(context.targetMode),
        coverageSearchesDone: result.searchesDone || 0,
        coverageUsefulCount: result.usefulCount || 0,
        v4Center: context.center ? { ...context.center, region } : null
      });

      statusBox("Empresas encontradas", `${leads.length} negócios consolidados. Agora completando telefone, site e horário em 3 abas paralelas.`);
      const limit = Math.min(150, Math.max(50, leads.length));
      const enriched = await chrome.runtime.sendMessage({ cmd: "ENRICH_ALL", limit });
      if (enriched?.ok && Array.isArray(enriched.leads)) leads = dedupe(enriched.leads);

      const phones = leads.filter(lead => digits(lead.phone).length >= 10).length;
      const sites = leads.filter(lead => String(lead.website || "").trim()).length;
      notifyPage(leads, {
        searchInProgress: false,
        searchCompletedAt: new Date().toISOString(),
        phoneCount: phones,
        siteCount: sites,
        v4Center: context.center ? { ...context.center, region } : null
      });
      statusBox("Mapeamento concluído", `${leads.length} negócios · ${phones} com telefone · ${sites} com site.`, "ready");
    } catch (error) {
      const partial = await syncPartial(true);
      const count = partial.length || dedupe(loadJson(LEADS_KEY, [])).length;
      const text = count
        ? `${count} negócios já encontrados foram preservados. Você pode repetir a busca para continuar ampliando a cobertura.`
        : (error?.message || "A busca foi interrompida antes de encontrar empresas.");
      const meta = loadJson(META_KEY, {});
      localStorage.setItem(META_KEY, JSON.stringify({ ...meta, searchInProgress: false, searchStoppedAt: new Date().toISOString() }));
      statusBox(count ? "Coleta parcial preservada" : "A coleta foi interrompida", text);
      console.error("[Radar RC14]", error);
    } finally {
      active = false;
      setButtons(false);
    }
  }

  chrome.runtime.onMessage.addListener(message => {
    if (!active || !message?.event) return;
    if (message.event === "SEARCH_PROGRESS" && message.stage === "done") {
      statusBox("Descoberta em andamento", message.text || `${message.accumulated || 0} negócios acumulados.`);
      scheduleSync();
      return;
    }
    if (message.event === "BATCH_PROGRESS") {
      if (["pass_done", "done"].includes(message.stage)) scheduleSync();
      const current = Number(message.current || 0);
      const total = Number(message.total || 0);
      const prefix = total ? `Varredura ${current}/${total}` : "Mapeando";
      statusBox(prefix, message.text || "Buscando empresas no Google Maps...");
      return;
    }
    if (message.event === "ENRICH_PROGRESS") {
      statusBox(`Completando ${message.current || 0}/${message.total || 0}`, "Telefone, site e horário estão sendo atualizados em tempo real.");
      if (message.lead?.name) {
        const current = dedupe(loadJson(LEADS_KEY, []));
        notifyPage(dedupe([...current, message.lead]), { searchInProgress: true, enrichInProgress: true });
      }
    }
  });

  document.addEventListener("click", event => {
    const button = event.target.closest?.("#mapsOpenGoogleButton, #v4BatchSearch");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    run();
  }, true);
})();
