const RADAR_SEGMENTS = {
  estetica: {
    label: "Clínica de Estética",

    baseMonthly: [88, 168],

    scoreRange: [24, 54],

    services: [
      "Limpeza de pele",
      "Botox",
      "Preenchimento facial",
      "Harmonização facial",
      "Depilação",
      "Estética facial",
      "Microagulhamento",
      "Peeling"
    ],

    keywords: [
      "clínica de estética",
      "estética perto de mim",
      "limpeza de pele",
      "botox",
      "preenchimento facial",
      "harmonização facial",
      "estética facial",
      "microagulhamento"
    ]
  },

  podologia: {
    label: "Podologia",

    baseMonthly: [52, 110],

    scoreRange: [26, 58],

    services: [
      "Podologia clínica",
      "Unha encravada",
      "Calos e calosidades",
      "Micose",
      "Verruga plantar",
      "Podologia preventiva",
      "Cuidados com os pés",
      "Podologia para idosos"
    ],

    keywords: [
      "podóloga perto de mim",
      "podologia",
      "unha encravada",
      "tratamento de calos",
      "podologia clínica",
      "cuidados com os pés",
      "podóloga",
      "tratamento de micose"
    ]
  },

  odontologia: {
    label: "Odontologia",

    baseMonthly: [105, 210],

    scoreRange: [30, 64],

    services: [
      "Clareamento dental",
      "Implante dentário",
      "Limpeza dental",
      "Aparelho ortodôntico",
      "Tratamento de canal",
      "Prótese dentária",
      "Odontologia estética",
      "Urgência odontológica"
    ],

    keywords: [
      "dentista perto de mim",
      "clínica odontológica",
      "clareamento dental",
      "implante dentário",
      "dentista emergência",
      "aparelho dentário",
      "limpeza dental",
      "tratamento de canal"
    ]
  },

  beleza: {
    label: "Salão / Beleza",

    baseMonthly: [95, 190],

    scoreRange: [24, 56],

    services: [
      "Corte feminino",
      "Escova",
      "Progressiva",
      "Coloração",
      "Manicure",
      "Alongamento de unhas",
      "Design de sobrancelha",
      "Extensão de cílios"
    ],

    keywords: [
      "salão de beleza",
      "cabeleireiro perto de mim",
      "manicure",
      "alongamento de unhas",
      "design de sobrancelha",
      "extensão de cílios",
      "progressiva",
      "escova"
    ]
  },

  assistencia: {
    label: "Assistência Técnica",

    baseMonthly: [72, 155],

    scoreRange: [24, 60],

    services: [
      "Conserto de celular",
      "Troca de tela",
      "Conserto de iPhone",
      "Manutenção de notebook",
      "Conserto de computador",
      "Troca de bateria",
      "Formatação",
      "Recuperação de dados"
    ],

    keywords: [
      "assistência técnica",
      "conserto de celular",
      "troca de tela celular",
      "conserto de iphone",
      "manutenção de notebook",
      "conserto de computador",
      "assistência perto de mim",
      "troca de bateria celular"
    ]
  },

  limpeza: {
    label: "Limpeza de Estofados",

    baseMonthly: [48, 118],

    scoreRange: [22, 54],

    services: [
      "Limpeza de sofá",
      "Higienização de estofados",
      "Limpeza de colchão",
      "Limpeza de banco automotivo",
      "Impermeabilização",
      "Limpeza de tapete",
      "Limpeza de poltrona",
      "Higienização residencial"
    ],

    keywords: [
      "limpeza de sofá",
      "higienização de estofados",
      "limpeza de colchão",
      "lavagem de sofá",
      "limpeza de estofados",
      "impermeabilização de sofá",
      "limpeza de sofá perto de mim",
      "limpeza de tapete"
    ]
  },

  vidracaria: {
    label: "Vidraçaria",

    baseMonthly: [30, 82],

    scoreRange: [20, 50],

    services: [
      "Box de banheiro",
      "Espelho sob medida",
      "Vidro temperado",
      "Porta de vidro",
      "Fechamento de sacada",
      "Janela de vidro",
      "Guarda-corpo",
      "Cobertura de vidro"
    ],

    keywords: [
      "vidraçaria",
      "box de banheiro",
      "espelho sob medida",
      "vidro temperado",
      "fechamento de sacada",
      "porta de vidro",
      "vidraceiro perto de mim",
      "guarda corpo de vidro"
    ]
  },

  marmoraria: {
    label: "Marmoraria",

    baseMonthly: [26, 74],

    scoreRange: [20, 52],

    services: [
      "Pia de granito",
      "Bancada de mármore",
      "Bancada de granito",
      "Quartzo",
      "Mármore sob medida",
      "Granito sob medida",
      "Escada de mármore",
      "Nichos para banheiro"
    ],

    keywords: [
      "marmoraria",
      "marmoraria perto de mim",
      "pia de granito",
      "bancada de mármore",
      "bancada de granito",
      "mármore sob medida",
      "granito sob medida",
      "quartzo para cozinha"
    ]
  },

  "ar-condicionado": {
    label: "Ar-condicionado",

    baseMonthly: [60, 145],

    scoreRange: [22, 56],

    services: [
      "Instalação de ar-condicionado",
      "Manutenção",
      "Limpeza",
      "Higienização",
      "Recarga de gás",
      "Conserto de ar-condicionado",
      "Ar-condicionado residencial",
      "Ar-condicionado comercial"
    ],

    keywords: [
      "instalação de ar condicionado",
      "manutenção de ar condicionado",
      "limpeza de ar condicionado",
      "conserto de ar condicionado",
      "ar condicionado perto de mim",
      "recarga de gás ar condicionado",
      "higienização de ar condicionado",
      "técnico de ar condicionado"
    ]
  },

  dedetizacao: {
    label: "Dedetização",

    baseMonthly: [44, 108],

    scoreRange: [20, 54],

    services: [
      "Dedetização residencial",
      "Dedetização comercial",
      "Controle de baratas",
      "Controle de cupins",
      "Controle de ratos",
      "Descupinização",
      "Desratização",
      "Controle de pragas"
    ],

    keywords: [
      "dedetização",
      "dedetizadora perto de mim",
      "controle de pragas",
      "descupinização",
      "desratização",
      "dedetização de baratas",
      "dedetização residencial",
      "empresa de dedetização"
    ]
  },

  "energia-solar": {
    label: "Energia Solar",

    baseMonthly: [35, 92],

    scoreRange: [20, 56],

    services: [
      "Energia solar residencial",
      "Energia solar comercial",
      "Instalação de placas solares",
      "Projeto fotovoltaico",
      "Orçamento energia solar",
      "Manutenção de sistema solar",
      "Kit energia solar",
      "Consultoria fotovoltaica"
    ],

    keywords: [
      "energia solar",
      "empresa de energia solar",
      "placa solar residencial",
      "orçamento energia solar",
      "instalação de placa solar",
      "energia fotovoltaica",
      "kit energia solar",
      "energia solar para empresa"
    ]
  },

  oficina: {
    label: "Oficina Mecânica",

    baseMonthly: [80, 170],

    scoreRange: [24, 60],

    services: [
      "Mecânica geral",
      "Troca de óleo",
      "Freios",
      "Suspensão",
      "Alinhamento",
      "Balanceamento",
      "Diagnóstico automotivo",
      "Revisão preventiva"
    ],

    keywords: [
      "oficina mecânica",
      "mecânico perto de mim",
      "troca de óleo",
      "revisão de carro",
      "alinhamento e balanceamento",
      "manutenção automotiva",
      "oficina perto de mim",
      "mecânica automotiva"
    ]
  },

  outro: {
    label: "Outro segmento",

    baseMonthly: [45, 110],

    scoreRange: [22, 55],

    services: [
      "Serviço principal",
      "Serviço complementar",
      "Atendimento local",
      "Orçamento",
      "Consulta",
      "Instalação",
      "Manutenção",
      "Atendimento especializado"
    ],

    keywords: [
      "serviço perto de mim",
      "empresa especializada",
      "serviço local",
      "orçamento",
      "atendimento na região",
      "empresa perto de mim",
      "serviço especializado",
      "profissional perto de mim"
    ]
  }
};


/* =========================
   MULTIPLICADOR POR RAIO
========================= */

const RADIUS_MULTIPLIER = {
  1: 0.58,
  3: 1,
  5: 1.28,
  8: 1.58,
  10: 1.82
};
