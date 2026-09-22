(() => {
  "use strict";

  if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  if (window.RadarV1SearchMemoryV2Local) return;
  window.RadarV1SearchMemoryV2Local = true;

  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const MEMORY_KEY = "radarV1BestSearchMemoryV2";
  const TTL = 45 * 24 * 60 * 60 * 1000;
  const MAX_SEARCHES = 50;
  const MAX_LEADS = 600;

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  const SEGMENTS = [
    { id: "barbearia", re: /barbear|barber|corte masculino|barba e cabelo|salao masculino/ },
    { id: "odontologia", re: /odont|dentist|dental|ortodont|implantodont|endodont/ },
    { id: "estetica", re: /estet|harmoniza|depila|limpeza de pele|spa estet|beleza/ },
    { id: "manicure", re: /manicure|pedicure|esmalter|nail|unha/ },
    { id: "podologia", re: /podolog/ },
    { id: "pet-veterinaria", re: /pet shop|petshop|veterin|banho e tosa/ },
    { id: "padaria", re: /padaria|panific|confeitaria|bakery/ },
    { id: "seguros", re: /seguro|corretor de seguro/ },
    { id: "imobiliaria", re: /imobili|imoveis|corretor de imovel/ },
    { id: "contabilidade", re: /contab|contador/ },
    { id: "advocacia", re: /advoc|advog/ },
    { id: "academia", re: /academia|fitness|muscul|personal trainer/ },
    { id: "restaurante", re: /restaurante|pizzaria|lanchonete|hamburg/ }
  ];

  const loadJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  };

  function segmentOf(term) {
    const value = normalize(term);
    return SEGMENTS.find(item => item.re.test(value))?.id || value;
  }

  function leadKey(lead) {
    const maps = String(lead?.mapsUrl || "").split("?")[0].replace(/\/$/, "");
    return maps || normalize(`${lead?.name || ""}|${lead?.address || ""}|${digits(lead?.phone || lead?.companyPhone || "")}`);
  }

  function dedupe(rows) {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach(lead => {
      if (!lead?.name) return;
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

  function persist() {
    const meta = loadJson(META_KEY, {});
    const leads = dedupe(loadJson(LEADS_KEY, []));
    const term = String(meta.term || "").trim();
    const region = String(meta.region || "").trim();
    const radiusKm = Number(meta.radiusKm || 5) || 5;
    const segment = segmentOf(term);
    const expectedKey = `${segment}|${normalize(region)}|${radiusKm}`;

    if (!term || !region || !leads.length) return;
    if (!meta.activeSearchSession || String(meta.activeSearchKey || "") !== expectedKey) return;
    if (!meta.searchCompletedAt && !meta.importedAt) return;

    const memory = loadJson(MEMORY_KEY, {});
    const previous = memory[expectedKey];
    const merged = dedupe([...(previous?.leads || []), ...leads]).slice(0, MAX_LEADS);
    memory[expectedKey] = {
      term,
      segment,
      region,
      radiusKm,
      bestCount: Math.max(Number(previous?.bestCount || 0), merged.length),
      updatedAt: Date.now(),
      leads: merged
    };

    const now = Date.now();
    const trimmed = Object.entries(memory)
      .filter(([, entry]) => entry && Number(entry.updatedAt || 0) >= now - TTL)
      .sort((a,b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0))
      .slice(0, MAX_SEARCHES);
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(trimmed))); } catch {}
  }

  let timer = null;
  function queuePersist() {
    clearTimeout(timer);
    timer = setTimeout(persist, 120);
  }

  window.addEventListener("radar:maps-data-updated", queuePersist);
  window.addEventListener("storage", event => {
    if (event.key === LEADS_KEY || event.key === META_KEY) queuePersist();
  });
  setInterval(persist, 1800);

  console.info("[Radar Local] Memória V2 passiva por sessão ativa.");
})();
