/* =========================================================
   RADAR LOCAL — PALAVRAS-CHAVE CONTEXTUAIS
   Infere o tipo real da empresa pelo Google Places + nome
   e gera intenções de busca coerentes sem depender do antigo
   seletor manual de segmento.
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

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const cityFromRegion = region => {
    const raw = String(region || "").trim();
    if (!raw) return "";
    return raw.split("-")[0].trim();
  };

  const TYPE_MAP = {
    pizza_restaurant: "pizzaria",
    restaurant: "restaurante",
    brazilian_restaurant: "restaurante",
    fast_food_restaurant: "restaurante",
    hamburger_restaurant: "hamburgueria",
    sandwich_shop: "lanchonete",
    bakery: "padaria",
    cafe: "cafeteria",
    coffee_shop: "cafeteria",
    bar: "bar",

    insurance_agency: "seguros",
    real_estate_agency: "imobiliaria",
    lawyer: "advocacia",
    accounting: "contabilidade",

    beauty_salon: "estetica",
    spa: "estetica",
    skin_care_clinic: "estetica",
    hair_salon: "salao",
    barber_shop: "barbearia",
    nail_salon: "nails",

    dentist: "odontologia",
    dental_clinic: "odontologia",
    doctor: "clinica",
    medical_clinic: "clinica",
    physiotherapist: "fisioterapia",
    physical_therapy_clinic: "fisioterapia",
    psychologist: "psicologia",
    nutritionist: "nutricao",

    gym: "academia",
    fitness_center: "academia",
    personal_trainer: "personal",

    veterinary_care: "veterinaria",
    pet_store: "petshop",
    dog_groomer: "petshop",

    car_repair: "oficina",
    auto_repair_shop: "oficina",
    car_dealer: "concessionaria",
    auto_parts_store: "autopecas",

    electronics_repair_shop: "assistencia",
    cell_phone_store: "celular",

    moving_company: "mudancas",
    storage: "armazenagem",
    courier_service: "transportadora",
    trucking_company: "transportadora",

    home_goods_store: "loja",
    clothing_store: "loja",
    furniture_store: "loja"
  };

  const NAME_RULES = [
    [/pizza|pizzaria|telepizza/i, "pizzaria"],
    [/hamburg|burger/i, "hamburgueria"],
    [/padaria|panificadora/i, "padaria"],
    [/caf[eé]|coffee/i, "cafeteria"],
    [/restaurante|bistr[oô]|cantina/i, "restaurante"],
    [/seguro|corretora/i, "seguros"],
    [/imobili[aá]ria|im[oó]veis|corretor/i, "imobiliaria"],
    [/advoc|jur[ií]dic/i, "advocacia"],
    [/contabil|contabilidade/i, "contabilidade"],
    [/est[eé]tica|harmoniza|botox|facial|beauty/i, "estetica"],
    [/barbearia|barber/i, "barbearia"],
    [/nail|unha|manicure/i, "nails"],
    [/sal[aã]o|cabeleireiro|hair/i, "salao"],
    [/odonto|dent|sorriso/i, "odontologia"],
    [/fisio/i, "fisioterapia"],
    [/psic[oó]log|psico/i, "psicologia"],
    [/nutri/i, "nutricao"],
    [/academia|fitness|gym/i, "academia"],
    [/personal/i, "personal"],
    [/veterin|vet /i, "veterinaria"],
    [/pet shop|petshop|banho e tosa/i, "petshop"],
    [/oficina|auto center|autocenter|mec[aâ]nica/i, "oficina"],
    [/concession[aá]ria|ve[ií]culos|motors/i, "concessionaria"],
    [/assist[eê]ncia|conserto|celular|iphone/i, "assistencia"],
    [/transport|log[ií]stica|frete/i, "transportadora"]
  ];

  const CATALOG = {
    pizzaria: {
      label: "Pizzaria",
      terms: ["pizzaria perto de mim", "pizza delivery", "pizzaria aberta agora", "melhor pizzaria", "pizza em {city}", "pizzaria em {city}"]
    },
    hamburgueria: {
      label: "Hamburgueria",
      terms: ["hamburgueria perto de mim", "hambúrguer delivery", "hamburgueria aberta agora", "melhor hambúrguer", "hamburgueria em {city}", "delivery de hambúrguer"]
    },
    restaurante: {
      label: "Restaurante",
      terms: ["restaurante perto de mim", "restaurante aberto agora", "onde almoçar", "restaurante delivery", "restaurante em {city}", "melhor restaurante em {city}"]
    },
    padaria: {
      label: "Padaria",
      terms: ["padaria perto de mim", "padaria aberta agora", "café da manhã perto de mim", "padaria em {city}", "pão fresco perto de mim", "melhor padaria"]
    },
    cafeteria: {
      label: "Cafeteria",
      terms: ["cafeteria perto de mim", "café perto de mim", "cafeteria aberta agora", "cafeteria em {city}", "onde tomar café", "melhor cafeteria"]
    },
    seguros: {
      label: "Corretora de seguros",
      terms: ["corretora de seguros", "seguro auto", "cotação de seguro", "seguro residencial", "corretora de seguros em {city}", "seguro empresarial"]
    },
    imobiliaria: {
      label: "Imobiliária",
      terms: ["imobiliária perto de mim", "imobiliária em {city}", "apartamento para alugar", "casa à venda", "corretor de imóveis", "imóveis em {city}"]
    },
    advocacia: {
      label: "Advocacia",
      terms: ["advogado perto de mim", "escritório de advocacia", "advogado em {city}", "advogado trabalhista", "advogado de família", "consulta advogado"]
    },
    contabilidade: {
      label: "Contabilidade",
      terms: ["contador perto de mim", "escritório de contabilidade", "contador em {city}", "contabilidade para empresas", "abrir empresa", "assessoria contábil"]
    },
    estetica: {
      label: "Estética",
      terms: ["clínica de estética perto de mim", "estética facial", "limpeza de pele", "botox", "clínica de estética em {city}", "harmonização facial"]
    },
    salao: {
      label: "Salão de beleza",
      terms: ["salão de beleza perto de mim", "cabeleireiro perto de mim", "salão aberto agora", "salão em {city}", "escova cabelo", "corte feminino"]
    },
    barbearia: {
      label: "Barbearia",
      terms: ["barbearia perto de mim", "barbeiro perto de mim", "barbearia aberta agora", "corte masculino", "barbearia em {city}", "barba e cabelo"]
    },
    nails: {
      label: "Nail designer",
      terms: ["nail designer perto de mim", "manicure perto de mim", "alongamento de unhas", "unhas de gel", "nail designer em {city}", "manicure em {city}"]
    },
    odontologia: {
      label: "Odontologia",
      terms: ["dentista perto de mim", "clínica odontológica", "dentista em {city}", "clareamento dental", "implante dentário", "dentista emergência"]
    },
    clinica: {
      label: "Clínica",
      terms: ["clínica perto de mim", "clínica em {city}", "consulta médica", "médico perto de mim", "agendar consulta", "clínica aberta agora"]
    },
    fisioterapia: {
      label: "Fisioterapia",
      terms: ["fisioterapia perto de mim", "fisioterapeuta perto de mim", "fisioterapia em {city}", "clínica de fisioterapia", "fisioterapia particular", "sessão de fisioterapia"]
    },
    psicologia: {
      label: "Psicologia",
      terms: ["psicólogo perto de mim", "psicóloga em {city}", "terapia perto de mim", "consulta psicólogo", "terapia online", "psicólogo particular"]
    },
    nutricao: {
      label: "Nutrição",
      terms: ["nutricionista perto de mim", "nutricionista em {city}", "consulta nutricionista", "nutricionista esportivo", "reeducação alimentar", "nutricionista particular"]
    },
    academia: {
      label: "Academia",
      terms: ["academia perto de mim", "academia aberta agora", "academia em {city}", "musculação perto de mim", "academia mensalidade", "melhor academia"]
    },
    personal: {
      label: "Personal trainer",
      terms: ["personal trainer perto de mim", "personal trainer em {city}", "personal trainer particular", "treino personalizado", "personal academia", "personal para emagrecer"]
    },
    veterinaria: {
      label: "Clínica veterinária",
      terms: ["veterinário perto de mim", "clínica veterinária", "veterinário em {city}", "veterinário 24 horas", "consulta veterinária", "hospital veterinário"]
    },
    petshop: {
      label: "Pet shop",
      terms: ["pet shop perto de mim", "banho e tosa perto de mim", "pet shop em {city}", "pet shop aberto agora", "ração perto de mim", "banho e tosa em {city}"]
    },
    oficina: {
      label: "Oficina mecânica",
      terms: ["oficina mecânica perto de mim", "mecânico perto de mim", "oficina em {city}", "auto center", "troca de óleo", "mecânico em {city}"]
    },
    concessionaria: {
      label: "Concessionária",
      terms: ["concessionária perto de mim", "carros à venda", "concessionária em {city}", "carro seminovo", "comprar carro", "loja de veículos"]
    },
    assistencia: {
      label: "Assistência técnica",
      terms: ["assistência técnica perto de mim", "conserto de celular", "assistência técnica em {city}", "conserto de iphone", "troca de tela celular", "manutenção de celular"]
    },
    transportadora: {
      label: "Transportadora",
      terms: ["transportadora perto de mim", "transportadora em {city}", "cotação de frete", "frete para empresas", "empresa de transporte", "transportadora de cargas"]
    },
    loja: {
      label: "Loja",
      terms: ["loja perto de mim", "loja em {city}", "loja aberta agora", "comprar perto de mim", "lojas na região", "melhor loja em {city}"]
    },
    negocio: {
      label: "Negócio local",
      terms: ["empresa perto de mim", "serviço perto de mim", "empresa em {city}", "serviço em {city}", "negócio local", "atendimento perto de mim"]
    }
  };

  const inferType = proposal => {
    const primaryType = normalize(
      proposal?.primaryType ||
      proposal?.googlePlace?.primaryType ||
      proposal?.benchmark?.subject?.primaryType
    );

    if (primaryType && TYPE_MAP[primaryType]) {
      return {
        key: TYPE_MAP[primaryType],
        source: "google_primary_type",
        confidence: "high"
      };
    }

    const name = normalize(
      proposal?.googlePlace?.name ||
      proposal?.company ||
      ""
    );

    for (const [regex, key] of NAME_RULES) {
      if (regex.test(name)) {
        return {
          key,
          source: "business_name",
          confidence: "medium"
        };
      }
    }

    return {
      key: "negocio",
      source: "fallback",
      confidence: "low"
    };
  };

  const buildKeywords = (config, city) => {
    const safeCity = city || "sua região";

    return config.terms
      .map(term => term.replaceAll("{city}", safeCity))
      .filter((term, index, array) => term && array.indexOf(term) === index)
      .slice(0, 6)
      .map(keyword => ({
        keyword,
        source: "radar_inferred_intent"
      }));
  };

  const applyToPage = (proposal, inferred, config, keywords) => {
    const page = document.querySelector('[data-page="demand"]');
    if (!page) return;

    const list = page.querySelector(".dl-keyword-list");
    if (list) {
      list.innerHTML = keywords
        .map(item => `<span class="dl-chip"></span>`)
        .join("");

      [...list.querySelectorAll(".dl-chip")].forEach((chip, index) => {
        chip.textContent = keywords[index]?.keyword || "";
      });
    }

    const section = page.querySelector(".dl-keywords");
    if (section) {
      const title = section.querySelector("h3");
      if (title) {
        title.textContent = inferred.key === "negocio"
          ? "Principais intenções relacionadas ao negócio"
          : `Buscas relacionadas a ${config.label}`;
      }

      const label = section.querySelector(".dl-section-label");
      if (label) {
        label.textContent = "O que as pessoas procuram";
      }
    }
  };

  const run = () => {
    const proposal = readProposal();
    if (!proposal) return false;

    const inferred = inferType(proposal);
    const config = CATALOG[inferred.key] || CATALOG.negocio;
    const city = cityFromRegion(proposal.region);
    const keywordData = buildKeywords(config, city);

    const enriched = {
      ...proposal,
      inferredBusiness: {
        key: inferred.key,
        label: config.label,
        source: inferred.source,
        confidence: inferred.confidence
      },
      keywordData
    };

    try {
      localStorage.setItem(PROPOSAL_KEY, JSON.stringify(enriched));
    } catch (error) {
      console.warn("[RadarKeywords] Não foi possível salvar as palavras-chave.", error);
    }

    applyToPage(enriched, inferred, config, keywordData);

    window.dispatchEvent(new CustomEvent("radar:keywords-ready", {
      detail: {
        inferredBusiness: enriched.inferredBusiness,
        keywordData
      }
    }));

    return true;
  };

  if (run()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (run() || attempts >= 30) clearInterval(timer);
  }, 300);
})();
