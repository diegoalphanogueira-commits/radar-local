/* =========================================================
   RADAR LOCAL V1 — INTELIGÊNCIA EMPRESARIAL / DECISOR 4
   Empresa e decisor são camadas independentes:
   CNPJ pode ser identificado mesmo quando o QSA não entrega
   um tomador de decisão utilizável.
========================================================= */
(() => {
  "use strict";

  if (window.RadarV1Intelligence) return;
  window.RadarV1Intelligence = true;

  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const META_KEY = "radarMapsImportedMetaV2";
  const MY_RECEITA_BASE = "https://minhareceita.org";
  const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";
  const RUN_KEY = "radarV1DecisionMatchRunV4";

  const SEGMENT_CNAES = [
    { re: /odont|dentist|dental/, cnaes: ["8630504"] },
    { re: /manicure|pedicure|esmalter|unha|nail|cabele|salao|salão|beleza/, cnaes: ["9602501","9602502"] },
    { re: /estet|harmoniza|depila|limpeza de pele|spa/, cnaes: ["9602502","9602501"] },
    { re: /podolog/, cnaes: ["8690999","9602502"] },
    { re: /barbear|barber/, cnaes: ["9602501"] },
    { re: /pet|banho e tosa/, cnaes: ["4789004","9609208","7500100"] },
    { re: /veterin/, cnaes: ["7500100","4789004"] },
    { re: /seguro|corretor/, cnaes: ["6622300"] },
    { re: /imobili|imoveis|imóveis/, cnaes: ["6821801"] },
    { re: /contab/, cnaes: ["6920601"] },
    { re: /advoc|advog/, cnaes: ["6911701"] },
    { re: /academia|fitness|muscul/, cnaes: ["9313100"] },
    { re: /restaurante|pizzaria|lanchonete|hamburg/, cnaes: ["5611201","5611203"] }
  ];

  const STOPWORDS = new Set([
    "de","da","do","das","dos","e","a","o","ltda","me","eireli","sa","s a",
    "servicos","servico","comercio","comercial","clinica","consultorio","odontologica","odontologico",
    "studio","centro","grupo","empresa","loja","unidade","especialidades"
  ]);

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  let busy = false;
  let lastFingerprint = "";

  function loadLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function saveLeads(leads) {
    try { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); } catch {}
    window.dispatchEvent(new CustomEvent("radar:maps-data-updated", { detail: { count: leads.length, source: "company-decision-v1" } }));
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function tokenSet(value) {
    return new Set(normalize(value).split(" ").filter(token => token.length >= 3 && !STOPWORDS.has(token)));
  }

  function overlapScore(a, b) {
    const A = tokenSet(a), B = tokenSet(b);
    if (!A.size || !B.size) return 0;
    let common = 0;
    A.forEach(token => { if (B.has(token)) common += 1; });
    return common / Math.min(A.size, B.size);
  }

  function parseRegion(raw) {
    const text = String(raw || "").trim();
    const ufMatch = text.match(/-?\s*([A-Z]{2})\s*$/i);
    const uf = ufMatch ? ufMatch[1].toUpperCase() : "SP";
    const noUf = text.replace(/-?\s*[A-Z]{2}\s*$/i, "").trim().replace(/,$/, "");
    const parts = noUf.split(",").map(v => v.trim()).filter(Boolean);
    return { city: parts.length > 1 ? parts[parts.length - 1] : noUf, uf };
  }

  function inferCnaes(term) {
    const item = SEGMENT_CNAES.find(entry => entry.re.test(normalize(term)));
    return item?.cnaes || [];
  }

  function normalizePhone(value) {
    let phone = digits(value);
    if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
    return phone;
  }

  function normalizeCnpj(value) {
    const raw = digits(value);
    return raw.length === 14 ? raw : "";
  }

  function extractCep(value) {
    const match = String(value || "").match(/\b(\d{5})[-\s]?(\d{3})\b/);
    return match ? `${match[1]}${match[2]}` : "";
  }

  function extractStreetNumber(value) {
    const raw = String(value || "");
    const matches = [...raw.matchAll(/(?:,|\s)\s*(\d{1,6})(?=\s*(?:-|,|$))/g)];
    return matches.length ? matches[0][1] : "";
  }

  function companyPhones(company) {
    return [company?.ddd_telefone_1, company?.ddd_telefone_2].map(normalizePhone).filter(Boolean);
  }

  function candidateSignals(lead, company) {
    const name = Math.max(
      overlapScore(lead.name, company?.nome_fantasia),
      overlapScore(lead.name, company?.razao_social)
    );
    const addressText = [company?.logradouro, company?.numero, company?.bairro].filter(Boolean).join(" ");
    const address = overlapScore(lead.address, addressText);
    const leadPhone = normalizePhone(lead.phone || lead.companyPhone || lead.publicPhone);
    const phone = !!leadPhone && companyPhones(company).some(item => item.slice(-8) === leadPhone.slice(-8));
    const leadCep = extractCep(lead.address || lead.cep);
    const companyCep = digits(company?.cep || "").slice(-8);
    const cep = !!leadCep && !!companyCep && leadCep === companyCep;
    const leadNumber = extractStreetNumber(lead.address);
    const companyNumber = digits(company?.numero || "");
    const number = !!leadNumber && !!companyNumber && leadNumber === companyNumber;
    const bairro = !!company?.bairro && normalize(lead.address).includes(normalize(company.bairro));
    const leadCnpj = normalizeCnpj(lead.cnpj);
    const companyCnpj = normalizeCnpj(company?.cnpj);
    const exactCnpj = !!leadCnpj && !!companyCnpj && leadCnpj === companyCnpj;

    let score = name * 0.58 + address * 0.16;
    if (phone) score += 0.64;
    if (cep) score += 0.30;
    if (number) score += 0.12;
    if (bairro) score += 0.10;
    if (exactCnpj) score = 1;
    score = Math.min(1, score);

    return { name, address, phone, cep, number, bairro, exactCnpj, score };
  }

  function classify(best, second) {
    if (!best) return { level: "none", label: "Não identificado", gap: 0 };
    const gap = best.score - Number(second?.score || 0);
    const s = best.signals;

    if (s.exactCnpj) return { level: "safe", label: "CNPJ confirmado", gap: 1 };

    const safe = s.phone ||
      (s.cep && s.name >= 0.35) ||
      (s.score >= 0.68 && gap >= 0.04) ||
      (s.name >= 0.82 && (s.bairro || s.number || s.address >= 0.45));

    if (safe) return { level: "safe", label: "Match seguro", gap };

    const probable =
      (s.score >= 0.50 && gap >= 0.07) ||
      (s.name >= 0.70 && s.score >= 0.46 && gap >= 0.05) ||
      (s.cep && s.score >= 0.44);

    if (probable) return { level: "probable", label: "Match provável", gap };
    return { level: "none", label: "Não identificado", gap };
  }

  function decisionMaker(company) {
    const qsa = Array.isArray(company?.qsa) ? company.qsa : [];
    if (!qsa.length) return null;
    const priority = ["socio administrador","administrador","titular","empresario","presidente","diretor","socio"];
    const ranked = qsa.map(person => {
      const role = normalize(person.qualificacao_socio || person.role);
      const index = priority.findIndex(item => role.includes(normalize(item)));
      return { person, rank: index < 0 ? 999 : index };
    }).sort((a, b) => a.rank - b.rank);
    const person = ranked[0]?.person;
    const name = person?.nome_socio || person?.name || "";
    if (!name) return null;
    return { name, role: person.qualificacao_socio || person.role || "Sócio" };
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return response.json();
    } finally { clearTimeout(timer); }
  }

  async function resolveMunicipality(uf, city) {
    const rows = await fetchJson(`${IBGE_BASE}/${encodeURIComponent(uf)}/municipios?orderBy=nome`);
    const wanted = normalize(city);
    return rows.find(item => normalize(item.nome) === wanted) || rows.find(item => normalize(item.nome).startsWith(wanted)) || null;
  }

  function attachCompany(lead, candidate, classification) {
    const company = candidate.company;
    const dm = decisionMaker(company);
    const qsa = Array.isArray(company.qsa) ? company.qsa : [];
    const hasDecision = !!dm?.name;

    return {
      ...lead,
      cnpj: company.cnpj || lead.cnpj || "",
      legalName: company.razao_social || lead.legalName || "",
      tradeName: company.nome_fantasia || lead.tradeName || "",
      companyEmail: company.email || lead.companyEmail || "",
      companyPhone: company.ddd_telefone_1 || lead.companyPhone || "",
      qsa,
      decisionMaker: hasDecision ? dm : (lead.decisionMaker || null),
      cnae: company.cnae_fiscal || lead.cnae || "",
      cnaeDescription: company.cnae_fiscal_descricao || lead.cnaeDescription || "",
      revenueMatchScore: candidate.score,
      revenueStatus: classification.level === "safe" ? "matched" : "probable",
      companyConfidence: classification.level,
      companyConfidenceLabel: classification.label,
      companyMatchSignals: candidate.signals,
      companyMatchedAt: new Date().toISOString(),
      decisionConfidence: hasDecision ? classification.level : "none",
      decisionConfidenceLabel: hasDecision ? classification.label : "Sem QSA utilizável",
      decisionMatchSignals: hasDecision ? candidate.signals : null,
      decisionMatchedAt: hasDecision ? new Date().toISOString() : (lead.decisionMatchedAt || ""),
      qsaStatus: hasDecision ? "identified" : (qsa.length ? "without_priority_role" : "not_available")
    };
  }

  function findLeadForCard(card, leads) {
    const name = card.querySelector("h3")?.textContent?.trim() || "";
    const address = card.querySelector(".v4-card-head p")?.textContent?.trim() || "";
    return leads.find(item => normalize(item.name) === normalize(name) && normalize(item.address) === normalize(address)) ||
      leads.find(item => normalize(item.name) === normalize(name)) || null;
  }

  function updateCardLabels() {
    const leads = loadLeads();
    document.querySelectorAll(".v4-lead-card").forEach(card => {
      const lead = findLeadForCard(card, leads);
      if (!lead) return;

      const source = card.querySelector(".li-source");
      if (source) {
        const pct = Math.round(Number(lead.revenueMatchScore || 0) * 100);
        source.classList.remove("v1-probable", "v1-company-only");
        if (lead.decisionMaker?.name) {
          if (lead.decisionConfidence === "probable") {
            source.textContent = `QSA provável · match ${pct}%`;
            source.classList.add("v1-probable");
            source.title = "Há bons sinais de correspondência, mas o Radar não trata este vínculo como confirmação absoluta.";
          } else {
            source.textContent = `QSA identificado · match ${pct}%`;
            source.title = "Correspondência forte entre a empresa do mapa, o CNPJ e o quadro societário.";
          }
        } else if (lead.cnpj) {
          source.textContent = lead.companyConfidence === "probable" ? `Empresa provável · match ${pct}%` : "Empresa identificada · sem QSA";
          if (lead.companyConfidence === "probable") source.classList.add("v1-probable");
          else source.classList.add("v1-company-only");
          source.title = lead.qsaStatus === "not_available"
            ? "O CNPJ foi identificado, mas a fonte não trouxe QSA utilizável."
            : "A empresa foi identificada, mas não há um tomador de decisão seguro para exibir.";
        }
      }

      const dmBox = card.querySelector(".v4-data-grid > div:nth-child(3) strong");
      if (dmBox && lead.decisionMaker?.name) dmBox.textContent = lead.decisionMaker.name;
    });
    renderSummary(leads);
  }

  function ensureSummary() {
    let summary = document.querySelector("#v1CompanySummary");
    if (summary) return summary;
    const revenue = document.querySelector(".v4-revenue-details");
    if (!revenue?.parentNode) return null;
    summary = document.createElement("section");
    summary.id = "v1CompanySummary";
    summary.className = "v1-company-summary";
    summary.innerHTML = `
      <div class="v1-company-summary-head"><div><span>INTELIGÊNCIA EMPRESARIAL</span><strong>CNPJ & QSA da coleta</strong></div><small>qualidade do enriquecimento</small></div>
      <div class="v1-company-summary-grid">
        <div><span>CNPJ identificado</span><strong data-company-cnpj>0</strong></div>
        <div><span>QSA seguro</span><strong data-company-safe>0</strong></div>
        <div><span>QSA provável</span><strong data-company-probable>0</strong></div>
        <div><span>Sem decisor</span><strong data-company-none>0</strong></div>
      </div>`;
    revenue.parentNode.insertBefore(summary, revenue);
    return summary;
  }

  function renderSummary(leads = loadLeads()) {
    const summary = ensureSummary();
    if (!summary) return;
    const total = leads.length;
    const cnpj = leads.filter(lead => !!normalizeCnpj(lead.cnpj)).length;
    const safe = leads.filter(lead => lead.decisionMaker?.name && lead.decisionConfidence !== "probable").length;
    const probable = leads.filter(lead => lead.decisionMaker?.name && lead.decisionConfidence === "probable").length;
    const none = Math.max(0, total - safe - probable);
    summary.querySelector("[data-company-cnpj]").textContent = `${cnpj}/${total}`;
    summary.querySelector("[data-company-safe]").textContent = String(safe);
    summary.querySelector("[data-company-probable]").textContent = String(probable);
    summary.querySelector("[data-company-none]").textContent = String(none);
  }

  function fingerprintFor(term, region, leads) {
    return `${normalize(term)}|${normalize(region)}|${leads.map(item => [
      item.mapsUrl || item.name,
      normalizePhone(item.phone || item.companyPhone || item.publicPhone),
      normalizeCnpj(item.cnpj),
      item.siteEnrichedAt || ""
    ].join("#")).join("~")}`;
  }

  async function run(force = false) {
    if (busy) return;
    const leads = loadLeads();
    const meta = loadMeta();
    const term = meta.term || document.querySelector("#mapsSearchTerm")?.value || "";
    const region = meta.region || document.querySelector("#mapsSearchCity")?.value || "";
    const cnaes = inferCnaes(term);
    renderSummary(leads);
    if (!leads.length || !region || !cnaes.length) return;

    const unresolved = leads.filter(lead =>
      !lead.cnpj ||
      !lead.companyConfidence ||
      !lead.decisionMaker?.name ||
      lead.decisionConfidence === "probable"
    );
    if (!unresolved.length) {
      updateCardLabels();
      return;
    }

    const fingerprint = fingerprintFor(term, region, leads);
    if (!force && fingerprint === lastFingerprint) return;
    if (!force && sessionStorage.getItem(RUN_KEY) === fingerprint) return;

    lastFingerprint = fingerprint;
    busy = true;
    try {
      const { city, uf } = parseRegion(region);
      const municipality = await resolveMunicipality(uf, city);
      if (!municipality) return;

      const params = new URLSearchParams({
        uf,
        municipio: String(municipality.id),
        cnae: cnaes.join(","),
        limit: "1024"
      });
      const data = await fetchJson(`${MY_RECEITA_BASE}/?${params.toString()}`);
      const companies = (Array.isArray(data?.data) ? data.data : []).filter(company => {
        const status = normalize(company?.descricao_situacao_cadastral);
        return !status || status === "ativa";
      });
      if (!companies.length) return;

      const byCnpj = new Map(companies.map(company => [normalizeCnpj(company.cnpj), company]).filter(([key]) => key));
      let changed = false;
      const next = leads.map(lead => {
        if (lead.cnpj && lead.companyConfidence === "safe" && lead.decisionMaker?.name && lead.decisionConfidence === "safe") return lead;

        let ranked;
        const exact = normalizeCnpj(lead.cnpj) ? byCnpj.get(normalizeCnpj(lead.cnpj)) : null;
        if (exact) {
          const signals = candidateSignals(lead, exact);
          ranked = [{ company: exact, score: 1, signals: { ...signals, exactCnpj: true, score: 1 } }];
        } else {
          ranked = companies
            .map(company => {
              const signals = candidateSignals(lead, company);
              return { company, score: signals.score, signals };
            })
            .sort((a, b) => b.score - a.score);
        }

        const best = ranked[0];
        const second = ranked[1];
        const classification = classify(best, second);
        if (classification.level === "none") return lead;

        const enriched = attachCompany(lead, best, classification);
        if (JSON.stringify(enriched) !== JSON.stringify(lead)) changed = true;
        return enriched;
      });

      if (changed) saveLeads(next);
      sessionStorage.setItem(RUN_KEY, fingerprintFor(term, region, changed ? next : leads));
      setTimeout(updateCardLabels, 250);
    } catch (error) {
      console.warn("[Radar V1 Intelligence]", error);
    } finally {
      busy = false;
    }
  }

  const style = document.createElement("style");
  style.id = "radar-v1-intelligence-style";
  style.textContent = `
    .li-source.v1-probable{background:#fff7e8!important;color:#996515!important;border:1px solid #f1ddb6}
    .li-source.v1-company-only{background:#eef7ff!important;color:#2563a7!important;border:1px solid #d7e9fb}
    .v1-company-summary{margin:18px 0 12px;padding:14px 16px;border:1px solid #dfe8f3;border-radius:18px;background:linear-gradient(180deg,#fff,#f8fbff);box-shadow:0 10px 30px rgba(44,73,110,.045)}
    .v1-company-summary-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:11px}
    .v1-company-summary-head div{display:flex;align-items:baseline;gap:9px;min-width:0}.v1-company-summary-head span{font-size:.61rem;font-weight:850;letter-spacing:.07em;color:#2474ee}.v1-company-summary-head strong{font-size:.82rem;color:#233851}.v1-company-summary-head small{font-size:.61rem;color:#8a98aa;white-space:nowrap}
    .v1-company-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.v1-company-summary-grid>div{padding:9px 11px;border:1px solid #edf2f7;border-radius:12px;background:#fff}.v1-company-summary-grid span{display:block;font-size:.58rem;color:#8896a7}.v1-company-summary-grid strong{display:block;margin-top:3px;font-size:.92rem;color:#20364d}
    @media(max-width:760px){.v1-company-summary-grid{grid-template-columns:1fr 1fr}.v1-company-summary-head small{display:none}.v1-company-summary-head div{display:block}.v1-company-summary-head strong{display:block;margin-top:3px}}
  `;
  document.head.appendChild(style);

  window.addEventListener("radar:maps-data-updated", () => setTimeout(() => run(false), 220));
  document.addEventListener("click", event => {
    if (!event.target.closest("[data-li-refresh]")) return;
    setTimeout(() => run(true), 180);
  }, true);

  const observer = new MutationObserver(() => { updateCardLabels(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const boot = () => { run(false); updateCardLabels(); renderSummary(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  setTimeout(() => run(false), 1200);
  setInterval(() => { run(false); updateCardLabels(); }, 4500);
})();
