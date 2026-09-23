(() => {
  "use strict";

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const META_KEY = "radarMapsImportedMetaV2";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const TARGET_KEY = "radarV1CoverageTargetV3";
  const MEMORY_KEY = "radarV1BestSearchMemoryV5";
  let activeSession = null;
  let startLock = false;

  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const GROUPS = [
    { id:"barbearia", test:/barbear|barber|corte masculino|barba e cabelo|salao masculino/, terms:["barbearia","barbeiro","barber shop","barbearia masculina","corte masculino","barba e cabelo","salão masculino","barbearia premium","cabelo masculino"] },
    { id:"odontologia", test:/odont|dentist|dental|ortodont|implantodont|endodont/, terms:["dentista","clínica odontológica","odontologia","consultório odontológico","cirurgião-dentista","ortodontista","implantodontista","odontopediatra","endodontista","prótese dentária"] },
    { id:"estetica", test:/estet|beleza|harmoniza|depila|limpeza de pele|spa/, terms:["clínica de estética","centro de estética","estética facial","estética corporal","harmonização facial","depilação a laser","esteticista","spa estético"] },
    { id:"manicure", test:/manicure|pedicure|unha|nail|esmalter/, terms:["manicure","pedicure","esmalteria","nail designer","salão de unhas","alongamento de unhas","unhas em gel"] },
    { id:"podologia", test:/podolog/, terms:["podologia","clínica de podologia","podólogo","podóloga","tratamento dos pés"] },
    { id:"pet-veterinaria", test:/pet|veterin|banho e tosa/, terms:["pet shop","petshop","banho e tosa","clínica veterinária","veterinário","hospital veterinário","loja de ração"] },
    { id:"padaria", test:/padaria|panific|confeitaria|bakery/, terms:["padaria","panificadora","confeitaria","padaria artesanal","bakery","café e padaria"] },
    { id:"seguros", test:/seguro|corretor/, terms:["corretora de seguros","seguros","corretor de seguros","seguro auto","seguro empresarial"] },
    { id:"imobiliaria", test:/imobili|imoveis/, terms:["imobiliária","corretora de imóveis","corretor de imóveis","imóveis"] },
    { id:"contabilidade", test:/contab|contador/, terms:["escritório de contabilidade","contabilidade","contador","assessoria contábil"] },
    { id:"advocacia", test:/advoc|advog/, terms:["escritório de advocacia","advogado","advocacia","assessoria jurídica"] },
    { id:"academia", test:/academia|fitness|muscul/, terms:["academia","academia musculação","centro de treinamento","personal trainer"] },
    { id:"restaurante", test:/restaurante|pizzaria|lanchonete|hamburg/, terms:["restaurante","pizzaria","lanchonete","hamburgueria"] }
  ];

  function canonical(term) { const n = normalize(term); return GROUPS.find(g => g.test.test(n))?.id || n; }
  function variants(term, region) {
    const raw = String(term || "").trim();
    const group = GROUPS.find(g => g.id === canonical(raw));
    const list = group ? [...group.terms] : [raw, `${raw} perto`, `${raw} serviços`, `${raw} especialista`];
    if (raw && !list.some(v => normalize(v) === normalize(raw))) list.unshift(raw);
    return [...new Set(list.map(v => `${v} ${region}`.trim()))].slice(0, 12);
  }
  function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; } }
  function cleanUrl(url) { return String(url || "").split("?")[0].replace(/\/$/, ""); }
  function leadKey(lead) { return cleanUrl(lead?.mapsUrl) || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || "")}`); }
  function dedupe(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(lead => {
      if (!lead?.name) return;
      const key = leadKey(lead); if (!key) return;
      const next = { ...(map.get(key) || {}) };
      Object.entries(lead).forEach(([field, value]) => { if (value !== "" && value !== null && value !== undefined) next[field] = value; });
      map.set(key, next);
    });
    return [...map.values()];
  }
  function haversineKm(a,b) {
    if (!a || !b) return null;
    const values = [a.lat,a.lng,b.lat,b.lng].map(Number);
    if (!values.every(Number.isFinite)) return null;
    const [lat1,lng1,lat2,lng2] = values, rad = n => n * Math.PI / 180;
    const dLat = rad(lat2-lat1), dLng = rad(lng2-lng1);
    const h = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
  function prepareForWorkspace(rows, center, radiusKm) {
    return dedupe(rows).map(lead => {
      const lat = Number(lead.lat), lng = Number(lead.lng);
      if (!center || !Number.isFinite(lat) || !Number.isFinite(lng)) return { ...lead, radiusStatus: "unknown" };
      const distance = haversineKm(center, { lat, lng });
      if (!Number.isFinite(distance)) return { ...lead, radiusStatus: "unknown" };
      if (distance <= Number(radiusKm || 5)) return { ...lead, radiusStatus: "inside", distanceFromCenterKm: distance };
      return {
        ...lead,
        sourceLat: lat,
        sourceLng: lng,
        distanceFromCenterKm: distance,
        radiusStatus: "outside",
        lat: null,
        lng: null
      };
    });
  }
  function targetMode() {
    const value = String(document.querySelector("#radarCoverageTarget")?.value || localStorage.getItem(TARGET_KEY) || "50");
    return ["30","50","100","max"].includes(value) ? value : "50";
  }
  function contextNow() {
    const term = String(document.querySelector("#mapsSearchTerm")?.value || "").trim();
    const region = String(document.querySelector("#mapsSearchCity")?.value || "").trim();
    const radiusKm = Number(document.querySelector("#v4Radius")?.value || 5) || 5;
    return { term, region, radiusKm, segment: canonical(term), targetMode: targetMode() };
  }
  function contextKey(ctx) { return `${ctx.segment}|${normalize(ctx.region)}|${ctx.radiusKm}`; }
  function exactSeed(ctx) { return dedupe(loadJson(MEMORY_KEY, {})[contextKey(ctx)]?.leads || []); }
  function saveMemory(ctx, rows) {
    const memory = loadJson(MEMORY_KEY, {}), key = contextKey(ctx);
    const merged = dedupe([...(memory[key]?.leads || []), ...rows]).slice(0,700);
    memory[key] = { term:ctx.term, segment:ctx.segment, region:ctx.region, radiusKm:ctx.radiusKm, updatedAt:Date.now(), bestCount:Math.max(Number(memory[key]?.bestCount || 0), merged.length), leads:merged };
    localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(Object.entries(memory).sort((a,b)=>Number(b[1]?.updatedAt||0)-Number(a[1]?.updatedAt||0)).slice(0,30))));
    return merged;
  }

  function ensureCoverageControl() {
    if (document.querySelector("#radarCoverageControl")) return;
    const radius = document.querySelector("#v4Radius");
    if (!radius?.parentElement) return;
    const box = document.createElement("div");
    box.id = "radarCoverageControl";
    box.className = "radar-coverage-control";
    box.innerHTML = `<label for="radarCoverageTarget">Cobertura</label><select id="radarCoverageTarget"><option value="30">30+ empresas</option><option value="50">50+ empresas</option><option value="100">100+ empresas</option><option value="max">Máxima</option></select><small>Meta considera empresas dentro do raio.</small>`;
    radius.parentElement.insertAdjacentElement("afterend", box);
    const select = box.querySelector("select");
    select.value = localStorage.getItem(TARGET_KEY) || "50";
    if (!["30","50","100","max"].includes(select.value)) select.value = "50";
    select.addEventListener("change", () => localStorage.setItem(TARGET_KEY, select.value));
  }
  function status(title, text, ready=false) {
    const state = document.querySelector("#mapsCollectorState");
    if (state) {
      state.className = `maps-collector-state${ready ? " ready" : ""}`;
      state.querySelector("b") && (state.querySelector("b").textContent = title);
      state.querySelector("span") && (state.querySelector("span").textContent = text);
    }
    const batch = document.querySelector("#v4BatchStatus");
    if (batch) {
      batch.querySelector("b") && (batch.querySelector("b").textContent = title);
      batch.querySelector("span") && (batch.querySelector("span").textContent = text);
    }
  }
  function buttonsBusy(value) {
    ["#mapsOpenGoogleButton","#v4Enrich"].forEach(selector => {
      const button = document.querySelector(selector); if (!button) return;
      button.disabled = value; button.classList.toggle("collecting", value); button.classList.toggle("is-busy", value);
    });
  }
  function write(ctx, rawRows, center, patch={}) {
    if (!activeSession || activeSession.id !== ctx.sessionId) return;
    const clean = prepareForWorkspace(rawRows, center, ctx.radiusKm);
    const previous = loadJson(META_KEY, {});
    const inside = clean.filter(x => x.radiusStatus === "inside").length;
    const outside = clean.filter(x => x.radiusStatus === "outside").length;
    const unknown = clean.length - inside - outside;
    localStorage.setItem(LEADS_KEY, JSON.stringify(clean));
    localStorage.setItem(META_KEY, JSON.stringify({ ...previous, term:ctx.term, region:ctx.region, radiusKm:ctx.radiusKm, activeSearchSegment:ctx.segment, activeSearchSession:ctx.sessionId, coverageTarget:ctx.targetMode, count:clean.length, inRadiusCount:inside, outsideRadiusCount:outside, unknownRadiusCount:unknown, ...patch }));
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail:{ count:clean.length, source:"radar-rc17" } }));
  }
  async function syncPartial(ctx, center=null) {
    if (!activeSession || activeSession.id !== ctx.sessionId) return [];
    try {
      const response = await chrome.runtime.sendMessage({ cmd:"GET_STATE" });
      if (!activeSession || activeSession.id !== ctx.sessionId) return [];
      const rows = dedupe(response?.leads || []);
      if (rows.length) write(ctx, rows, center, { searchInProgress:true, searchHeartbeatAt:new Date().toISOString() });
      return rows;
    } catch { return []; }
  }
  async function cancelCurrent() {
    const previous = activeSession; activeSession = null;
    if (previous) await chrome.runtime.sendMessage({ cmd:"CANCEL_MARKET_SEARCH", sessionId:previous.id }).catch(()=>{});
  }

  async function startSearch() {
    if (startLock) return;
    startLock = true;
    let ctx = null;
    try {
      const base = contextNow();
      if (!base.term || !base.region) return;
      await cancelCurrent();
      ctx = { ...base, sessionId:`radar-${Date.now()}-${Math.random().toString(36).slice(2,8)}` };
      activeSession = { id:ctx.sessionId, phase:"discovery", ctx, center:null };
      const seed = exactSeed(ctx);
      buttonsBusy(true);
      status("Mapeando região...", `${ctx.segment} · cobertura ${ctx.targetMode === "max" ? "Máxima" : `${ctx.targetMode}+`} · meta dentro do raio.`);
      write(ctx, seed, null, { searchInProgress:true, searchStartedAt:new Date().toISOString(), v4Center:null });

      const result = await chrome.runtime.sendMessage({ cmd:"RUN_MARKET_SEARCH_V5", sessionId:ctx.sessionId, term:ctx.term, segment:ctx.segment, region:ctx.region, radiusKm:ctx.radiusKm, queries:variants(ctx.term,ctx.region), targetMode:ctx.targetMode, seedLeads:seed });
      if (!activeSession || activeSession.id !== ctx.sessionId) return;
      if (!result?.ok) { if (result?.cancelled) return; throw new Error(result?.error || "Falha na descoberta."); }

      const center = result?.context?.center || null;
      activeSession.center = center;
      let rows = saveMemory(ctx, dedupe(result.leads || []));
      const geo = result.geoStats || {};
      write(ctx, rows, center, { searchInProgress:true, discoveryCompletedAt:new Date().toISOString(), coverageSearchesDone:result.searchesDone || 0, v4Center:center ? { ...center, region:ctx.region } : null });
      activeSession.phase = "enrich";
      status("Empresas encontradas", `${rows.length} extraídas · ${geo.inRadius ?? "—"} dentro do raio. Completando todos os contatos possíveis.`);

      const enriched = await chrome.runtime.sendMessage({ cmd:"ENRICH_ALL", sessionId:ctx.sessionId, limit:Math.min(300, Math.max(1, rows.length)) });
      if (!activeSession || activeSession.id !== ctx.sessionId) return;
      if (enriched?.ok && Array.isArray(enriched.leads)) rows = saveMemory(ctx, dedupe(enriched.leads));
      const phones = rows.filter(x => digits(x.phone).length >= 10).length;
      const sites = rows.filter(x => String(x.website || "").trim()).length;
      const prepared = prepareForWorkspace(rows, center, ctx.radiusKm);
      const inside = prepared.filter(x => x.radiusStatus === "inside").length;
      write(ctx, rows, center, { searchInProgress:false, searchCompletedAt:new Date().toISOString(), phoneCount:phones, siteCount:sites, v4Center:center ? { ...center, region:ctx.region } : null });
      status("Mapeamento concluído", `${rows.length} extraídas · ${inside} dentro do raio · ${phones} com telefone · ${sites} com site.`, true);
      activeSession = null;
    } catch (error) {
      if (activeSession && ctx) {
        const partial = await syncPartial(ctx, activeSession.center);
        status(partial.length ? "Coleta parcial preservada" : "A coleta foi interrompida", partial.length ? `${partial.length} negócios já foram preservados.` : (error?.message || "Tente novamente."));
        const meta = loadJson(META_KEY, {});
        localStorage.setItem(META_KEY, JSON.stringify({ ...meta, searchInProgress:false, searchStoppedAt:new Date().toISOString() }));
        activeSession = null;
      }
    } finally {
      buttonsBusy(false); startLock = false;
    }
  }

  const post = (type,payload={}) => window.postMessage({ source:TARGET, type, ...payload }, location.origin);
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data; if (!message || message.source !== SOURCE) return;
    if (message.type === "PING") { post("PONG", { version:chrome.runtime.getManifest().version }); return; }
    if (message.type === "GET_STATE") { chrome.runtime.sendMessage({ cmd:"GET_STATE" }).then(response=>post("STATE_RESULT",{requestId:message.requestId||"",response})).catch(error=>post("STATE_RESULT",{requestId:message.requestId||"",response:{ok:false,error:error.message}})); return; }
    if (message.type === "ENRICH") { const sessionId=activeSession?.id||`manual-${Date.now()}`; chrome.runtime.sendMessage({cmd:"ENRICH_ALL",sessionId,limit:Number(message.limit)||300}).then(response=>post("ENRICH_RESULT",{requestId:message.requestId||"",response})).catch(error=>post("ENRICH_RESULT",{requestId:message.requestId||"",response:{ok:false,error:error.message}})); return; }
    if (message.type === "SITE_ENRICH") { chrome.runtime.sendMessage({cmd:"SITE_ENRICH_ONE",website:String(message.website||"").trim(),force:!!message.force}).then(response=>post("SITE_ENRICH_RESULT",{requestId:message.requestId||"",response})).catch(error=>post("SITE_ENRICH_RESULT",{requestId:message.requestId||"",response:{ok:false,error:error.message}})); return; }
    if (message.type === "CLEAR") { cancelCurrent().then(()=>chrome.runtime.sendMessage({cmd:"CLEAR"})).then(response=>post("CLEAR_RESULT",{requestId:message.requestId||"",response})).catch(error=>post("CLEAR_RESULT",{requestId:message.requestId||"",response:{ok:false,error:error.message}})); }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (!message?.event || !activeSession || message.sessionId !== activeSession.id) return;
    const ctx = activeSession.ctx;
    if (message.event === "MARKET_PARTIAL") {
      status(`Varredura ${message.current || 0}/${message.total || 0}`, `${message.accumulated || 0} extraídas · ${message.inRadiusCount || 0} dentro do raio.`);
      syncPartial(ctx, activeSession.center);
      return;
    }
    if (message.event === "SEARCH_PROGRESS" && message.stage === "opening") { status(`Abrindo busca ${message.current || 0}/${message.total || 0}`, `${message.query || ctx.term} · ${message.area || "região"}`); return; }
    if (message.event === "ENRICH_PROGRESS") { status(`Completando ${message.current || 0}/${message.total || 0}`, `${message.phoneCount || 0} telefones · ${message.siteCount || 0} sites encontrados.`); syncPartial(ctx, activeSession.center); }
  });

  document.addEventListener("click", event => {
    const button = event.target.closest?.("#mapsOpenGoogleButton, #v4BatchSearch");
    if (!button) return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); startSearch();
  }, true);

  const observer = new MutationObserver(ensureCoverageControl);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureCoverageControl, { once:true }); else ensureCoverageControl();
  setInterval(ensureCoverageControl, 1200);
})();
