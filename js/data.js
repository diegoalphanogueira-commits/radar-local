const RADAR_SEGMENTS = {
  estetica: {
    label: "Estética",
    baseMonthly: [78, 142],
    scoreRange: [24, 52],
    keywords: [
      "clínica de estética",
      "limpeza de pele",
      "estética facial",
      "botox",
      "preenchimento facial",
      "depilação",
      "harmonização facial"
    ]
  },

  podologia: {
    label: "Podologia",
    baseMonthly: [48, 96],
    scoreRange: [28, 58],
    keywords: [
      "podóloga perto de mim",
      "podologia",
      "tratamento de unha encravada",
      "calos nos pés",
      "podologia clínica",
      "cuidados com os pés",
      "podóloga"
    ]
  },

  odontologia: {
    label: "Odontologia",
    baseMonthly: [90, 178],
    scoreRange: [30, 62],
    keywords: [
      "dentista perto de mim",
      "clínica odontológica",
      "clareamento dental",
      "implante dentário",
      "dentista emergência",
      "aparelho dentário",
      "limpeza dental"
    ]
  },

  "energia-solar": {
    label: "Energia Solar",
    baseMonthly: [34, 88],
    scoreRange: [22, 55],
    keywords: [
      "energia solar",
      "placa solar residencial",
      "empresa de energia solar",
      "orçamento energia solar",
      "instalação de placa solar",
      "energia fotovoltaica",
      "kit energia solar"
    ]
  },

  beleza: {
    label: "Salão / Beleza",
    baseMonthly: [86, 164],
    scoreRange: [25, 56],
    keywords: [
      "salão de beleza",
      "cabeleireiro perto de mim",
      "manicure",
      "alongamento de unhas",
      "design de sobrancelha",
      "cílios",
      "escova"
    ]
  },

  assistencia: {
    label: "Assistência Técnica",
    baseMonthly: [62, 138],
    scoreRange: [26, 59],
    keywords: [
      "assistência técnica",
      "conserto de celular",
      "manutenção de notebook",
      "troca de tela celular",
      "conserto de iphone",
      "técnico de informática",
      "assistência perto de mim"
    ]
  },

  vidracaria: {
    label: "Vidraçaria",
    baseMonthly: [28, 72],
    scoreRange: [20, 50],
    keywords: [
      "vidraçaria",
      "box de banheiro",
      "espelho sob medida",
      "vidro temperado",
      "fechamento de sacada",
      "porta de vidro",
      "vidraceiro perto de mim"
    ]
  },

  limpeza: {
    label: "Limpeza de Estofados",
    baseMonthly: [45, 112],
    scoreRange: [24, 53],
    keywords: [
      "limpeza de sofá",
      "higienização de estofados",
      "limpeza de colchão",
      "lavagem de sofá",
      "limpeza de estofados",
      "impermeabilização de sofá",
      "limpeza de sofá perto de mim"
    ]
  },

  advocacia: {
    label: "Advocacia",
    baseMonthly: [42, 102],
    scoreRange: [28, 64],
    keywords: [
      "advogado perto de mim",
      "advogado trabalhista",
      "advogado previdenciário",
      "advogado de família",
      "escritório de advocacia",
      "advogado civil",
      "consulta advogado"
    ]
  }
};

const RADIUS_MULTIPLIER = {
  1: 0.58,
  3: 1,
  5: 1.27,
  8: 1.55,
  10: 1.78
};
