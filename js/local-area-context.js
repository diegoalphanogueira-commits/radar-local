/* =========================================================
   RADAR LOCAL — CONTEXTO DE ÁREA LOCAL
   Prioriza bairro/vila/localidade do endereço real do Google
   nas leituras do relatório. A cidade fica como fallback quando
   não existe uma localidade mais granular confiável.
========================================================= */

(() => {
  const PROPOSAL_KEY = "radarProposal";

  const readProposal = () => {
    try {
      return JSON.parse(localStorage.getItem(PROPOSAL_KEY) || "null");
    } catch {
      return null;
    }
  };

  const clean = value => String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  const normalize = value => clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const cityFromRegion = region => {
    const raw = clean(region);
    if (!raw) return "";
    return clean(raw.split("-")[0]);
  };

  const rejectCandidate = (candidate, city) => {
    const raw = clean(candidate);
    if (!raw) return true;

    const value = normalize(raw);
    const normalizedCity = normalize(city);

    if (normalizedCity && value === normalizedCity) return true;
    if (/^\d/.test(raw)) return true;
    if (/^\d{5}-?\d{3}$/.test(raw)) return true;
    if (/^(brasil|brazil)$/i.test(raw)) return true;
    if (/^[a-z]{2}$/i.test(raw)) return true;

    const streetLike = /^(r\.?|rua|av\.?|avenida|al\.?|alameda|rod\.?|rodovia|estr\.?|estrada|trav\.?|travessa|pra[cç]a|largo)\b/i;
    if (streetLike.test(raw)) return true;

    return false;
  };

  const extractLocalArea = (address, city) => {
    const raw = clean(address);
    if (!raw) return "";

    /*
      Formato brasileiro mais comum do Google:
      Av. X, 123 - Jardim Y, Guarulhos - SP, 00000-000
    */
    const statePattern = /-\s*([^,]+),\s*[^,]+?\s*-\s*[A-Z]{2}(?:,|$)/i;
    const stateMatch = raw.match(statePattern);

    if (stateMatch?.[1]) {
      const candidate = clean(stateMatch[1]);
      if (!rejectCandidate(candidate, city)) return candidate;
    }

    /*
      Segundo caminho: procura o texto após o hífen do bloco
      de logradouro/número antes da cidade.
    */
    const parts = raw.split(",").map(clean).filter(Boolean);

    for (const part of parts) {
      if (!part.includes(" - ")) continue;
      const candidate = clean(part.split(" - ").pop());
      if (!rejectCandidate(candidate, city)) return candidate;
    }

    /*
      Terceiro caminho para endereços no formato:
      Rua X, 123, Bairro Y, Cidade - SP, CEP
    */
    const cityIndex = parts.findIndex(part => {
      const normalized = normalize(part);
      return city && normalized.startsWith(normalize(city));
    });

    if (cityIndex > 1) {
      for (let index = cityIndex - 1; index >= 1; index -= 1) {
        const candidate = clean(parts[index]);
        if (!rejectCandidate(candidate, city)) return candidate;
      }
    }

    return "";
  };

  const replaceLocationInKeyword = (keyword, city, localArea) => {
    let value = clean(keyword);
    if (!value) return value;

    const rawRegion = city ? new RegExp(`\\b${city.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "gi") : null;

    if (rawRegion && localArea && normalize(localArea) !== normalize(city)) {
      value = value.replace(rawRegion, localArea);
    }

    return value;
  };

  const updateKeywordChips = keywordData => {
    const chips = [...document.querySelectorAll('[data-page="demand"] .dl-keyword-list .dl-chip')];
    if (!chips.length) return;

    chips.forEach((chip, index) => {
      const keyword = keywordData[index]?.keyword;
      if (keyword) chip.textContent = keyword;
    });
  };

  const apply = () => {
    const proposal = readProposal();
    if (!proposal) return false;

    const originalRegion = clean(proposal.originalRegion || proposal.region);
    const city = cityFromRegion(originalRegion);
    const address = clean(
      proposal.googlePlace?.address ||
      proposal.address ||
      localStorage.getItem("radarAddress")
    );

    const extractedArea = extractLocalArea(address, city);
    const localArea = extractedArea || city || originalRegion || "região analisada";
    const hasNeighborhood = Boolean(extractedArea && normalize(extractedArea) !== normalize(city));
    const narrativeArea = hasNeighborhood
      ? `${localArea} e região`
      : localArea;

    const currentKeywordData = Array.isArray(proposal.keywordData)
      ? proposal.keywordData
      : [];

    const keywordData = currentKeywordData.map(item => ({
      ...item,
      keyword: replaceLocationInKeyword(item?.keyword, city, localArea)
    }));

    const enriched = {
      ...proposal,
      originalRegion,
      city,
      localArea,
      reportRegion: narrativeArea,
      localAreaSource: hasNeighborhood ? "google_formatted_address" : "city_fallback",
      keywordData
    };

    try {
      localStorage.setItem(PROPOSAL_KEY, JSON.stringify(enriched));
    } catch (error) {
      console.warn("[RadarLocalArea] Não foi possível persistir a área local.", error);
    }

    /* CAPA */
    const coverDescription = document.getElementById("coverDescription");
    if (coverDescription) {
      coverDescription.textContent =
        `Analisamos o cenário em ${narrativeArea} para entender quanto da procura local pode estar passando sem chegar até a ${proposal.company || "empresa"}.`;
    }

    const regionHero = document.getElementById("regionHero");
    if (regionHero) regionHero.textContent = localArea;

    /* DEMANDA */
    const demandPage = document.querySelector('[data-page="demand"]');
    const demandHero = demandPage?.querySelector(".dl-hero p");
    if (demandHero) {
      demandHero.textContent =
        `O Radar estimou sinais de procura relacionados ao negócio dentro do raio analisado em ${narrativeArea}.`;
    }

    const demandIntro = document.getElementById("demandIntro");
    if (demandIntro) {
      demandIntro.textContent =
        `O Radar estimou sinais de procura relacionados ao negócio dentro do raio analisado em ${narrativeArea}.`;
    }

    updateKeywordChips(keywordData);

    window.RadarLocalArea = {
      city,
      localArea,
      reportRegion: narrativeArea,
      source: enriched.localAreaSource
    };

    window.dispatchEvent(new CustomEvent("radar:local-area-ready", {
      detail: window.RadarLocalArea
    }));

    return true;
  };

  if (apply()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (apply() || attempts >= 30) clearInterval(timer);
  }, 300);
})();
