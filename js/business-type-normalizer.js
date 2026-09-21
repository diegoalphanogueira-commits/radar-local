/* =========================================================
   RADAR LOCAL — NORMALIZAÇÃO DE TIPO DE NEGÓCIO
   Evita benchmarks com categorias genéricas do Google Places.
   Ex.: "Veículos" não deve comparar com lojas/alimentos genéricos.
========================================================= */

(() => {
  const REPORT_KEY = "radarProposal";
  const SELECTED_PLACE_KEY = "radarSelectedPlaceV1";

  const GENERIC_TYPES = new Set([
    "",
    "store",
    "establishment",
    "point_of_interest",
    "food",
    "health",
    "local_service",
    "premise"
  ]);

  const normalizeText = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const normalizeType = value => String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  const inferFromName = name => {
    const text = normalizeText(name);
    if (!text) return "";

    if (/\b(veiculos?|automoveis?|seminovos?|multimarcas|revenda|concessionaria|carros?)\b/.test(text)) {
      return "car_dealer";
    }

    if (/\b(oficina|mecanica|auto center|autocenter)\b/.test(text)) {
      return "car_repair";
    }

    if (/\b(pizzaria|pizza)\b/.test(text)) return "pizza_restaurant";
    if (/\b(padaria|panificadora|paes)\b/.test(text)) return "bakery";
    if (/\b(barbearia|barber)\b/.test(text)) return "barber_shop";
    if (/\b(imobiliaria|imoveis)\b/.test(text)) return "real_estate_agency";
    if (/\b(seguro|seguros|corretora de seguros)\b/.test(text)) return "insurance_agency";
    if (/\b(dentista|odontologia|odonto|odontologica)\b/.test(text)) return "dentist";
    if (/\b(estetica|clinica de estetica|salao de beleza)\b/.test(text)) return "beauty_salon";
    if (/\b(academia|fitness)\b/.test(text)) return "gym";
    if (/\b(advocacia|advogado|escritorio juridico)\b/.test(text)) return "lawyer";
    if (/\b(restaurante|lanchonete)\b/.test(text)) return "restaurant";

    return "";
  };

  const resolvePrimaryType = (name, rawType) => {
    const raw = normalizeType(rawType);
    const inferred = inferFromName(name);

    if (!inferred) return raw;

    /*
      Veículos e oficina recebem override forte porque o Google pode
      devolver "store" para alguns perfis, o que mistura categorias.
    */
    if (inferred === "car_dealer" || inferred === "car_repair") {
      return inferred;
    }

    if (GENERIC_TYPES.has(raw)) {
      return inferred;
    }

    return raw || inferred;
  };

  const clearCompetitiveData = report => {
    [
      "benchmark",
      "benchmarkUpdatedAt",
      "googleNearbyCount",
      "googleNearbyRawCount",
      "googleNearbyCapped",
      "googleNearbyProvider",
      "googleNearbyFetchedAt",
      "competitionLevel"
    ].forEach(key => {
      try { delete report[key]; } catch {}
    });
  };

  const normalizeStoredReport = () => {
    let report = null;

    try {
      report = JSON.parse(localStorage.getItem(REPORT_KEY) || "null");
    } catch {
      return null;
    }

    if (!report || typeof report !== "object") return null;

    const canonicalName = String(
      report?.googlePlace?.name ||
      report?.company ||
      ""
    ).trim();

    const rawType = normalizeType(
      report?.primaryType ||
      report?.googlePlace?.primaryType ||
      ""
    );

    const resolvedType = resolvePrimaryType(canonicalName, rawType);
    if (!resolvedType) return report;

    const typeChanged = rawType !== resolvedType;

    if (canonicalName && (report.googleMatched || report?.googlePlace?.matched)) {
      report.company = canonicalName;
    }

    report.primaryType = resolvedType;
    report.comparablePrimaryType = resolvedType;
    report.googlePlace = {
      ...(report.googlePlace || {}),
      primaryType: resolvedType
    };

    if (typeChanged) {
      clearCompetitiveData(report);
    }

    try {
      localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    } catch {}

    return report;
  };

  const normalizeSubmitContext = () => {
    const form = document.getElementById("analysisForm");
    if (!form) return;

    const companyInput = document.getElementById("company");
    const typeInput = form.querySelector('input[name="primaryType"]');

    form.addEventListener("submit", () => {
      const selected =
        window.RadarPlaceSearch?.getSelectedPlace?.() ||
        window.RadarSelectedPlace ||
        null;

      const name = String(
        selected?.name ||
        companyInput?.value ||
        ""
      ).trim();

      const rawType = String(
        selected?.primaryType ||
        typeInput?.value ||
        ""
      ).trim();

      const resolvedType = resolvePrimaryType(name, rawType);
      if (!resolvedType) return;

      if (typeInput) typeInput.value = resolvedType;
      if (selected) selected.primaryType = resolvedType;
      if (window.RadarSelectedPlace) {
        window.RadarSelectedPlace.primaryType = resolvedType;
      }

      try {
        const stored = JSON.parse(localStorage.getItem(SELECTED_PLACE_KEY) || "null");
        if (stored && typeof stored === "object") {
          stored.primaryType = resolvedType;
          if (name) stored.name = name;
          localStorage.setItem(SELECTED_PLACE_KEY, JSON.stringify(stored));
        }
      } catch {}
    }, true);
  };

  window.RadarBusinessType = {
    inferFromName,
    resolvePrimaryType,
    normalizeStoredReport
  };

  normalizeStoredReport();
  normalizeSubmitContext();
})();
