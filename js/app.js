/* =========================================================
   RADAR LOCAL
   APP.JS — V5
   Integração Landing + Radar
========================================================= */


/* =========================================================
   ELEMENTOS PRINCIPAIS
========================================================= */

const form =
  document.getElementById("analysisForm");

const loadingSection =
  document.getElementById("loadingSection");

const resultsSection =
  document.getElementById("resultsSection");

const newAnalysisBtn =
  document.getElementById("newAnalysisBtn");

const generateReportBtn =
  document.getElementById("generateReportBtn");

const loadingTitle =
  document.getElementById("loadingTitle");

const loadingText =
  document.getElementById("loadingText");

const progressBar =
  document.getElementById("progressBar");

const loadingSteps = [
  ...document.querySelectorAll(".loading-step")
];


/* =========================================================
   STORAGE / VERSÃO
========================================================= */

const SNAPSHOT_STORAGE_KEY =
  "radarLocalSnapshotsV1";

const CURRENT_REPORT_KEY =
  "radarProposal";

const LEAD_CONTEXT_KEY =
  "radarLeadContext";

const ADDRESS_STORAGE_KEY =
  "radarAddress";

const METHOD_VERSION =
  "radar-local-v5";


/* =========================================================
   CONTEXTO RECEBIDO DA LANDING
========================================================= */

let entryLeadContext = {
  phone: "",
  origin: "",
  incomingSegment: ""
};


/* =========================================================
   HELPERS
========================================================= */

const clamp = (
  value,
  min,
  max
) =>
  Math.min(
    Math.max(
      Number(value) || 0,
      min
    ),
    max
  );


const wait = ms =>
  new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );


function byId(id) {

  return document.getElementById(id);

}


function setText(
  id,
  value
) {

  const element =
    byId(id);

  if (!element) {
    return;
  }

  element.textContent =
    value;

}


function formatNumber(number) {

  return new Intl.NumberFormat(
    "pt-BR"
  ).format(
    Number(number) || 0
  );

}


/* =========================================================
   NORMALIZAÇÃO
========================================================= */

function normalizeKeyPart(value) {

  return String(
    value || ""
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .replace(
      /[^a-z0-9 ]/g,
      ""
    );

}


function slugify(value) {

  return normalizeKeyPart(
    value
  )
    .replace(
      /\s+/g,
      "-"
    );

}


/* =========================================================
   HASH / RANDOM DETERMINÍSTICO
========================================================= */

function hashString(text) {

  let hash =
    2166136261;

  const value =
    String(
      text || ""
    );


  for (
    let i = 0;
    i < value.length;
    i++
  ) {

    hash ^=
      value.charCodeAt(i);

    hash =
      Math.imul(
        hash,
        16777619
      );

  }


  return (
    hash >>> 0
  );

}


function createSeededRandom(
  seedText
) {

  let seed =
    hashString(seedText) ||
    1;


  return function seededRandom() {

    seed +=
      0x6D2B79F5;


    let t =
      seed;


    t =
      Math.imul(
        t ^ (t >>> 15),
        t | 1
      );


    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61
      );


    return (
      (
        (
          t ^
          (t >>> 14)
        ) >>> 0
      ) /
      4294967296
    );

  };

}


function randomBetween(
  rng,
  min,
  max
) {

  return Math.floor(
    rng() *
    (
      max -
      min +
      1
    )
  ) + min;

}


/* =========================================================
   SEGMENTOS DE FALLBACK

   Usados quando um segmento ainda não existe
   no data.js.
========================================================= */

const FALLBACK_SEGMENTS = {

  seguros: {

    label:
      "Seguro / Corretora de Seguros",

    baseMonthly:
      [250, 350],

    scoreRange:
      [30, 48],

    keywords: [
      "Seguro Auto",
      "Seguro Residencial",
      "Seguro de Vida",
      "Seguro Empresarial",
      "Seguro Moto",
      "Cotação de Seguro"
    ]

  },


  advocacia: {

    label:
      "Advocacia",

    baseMonthly:
      [75, 150],

    scoreRange:
      [28, 55],

    keywords: [
      "Advogado perto de mim",
      "Advogado na região",
      "Escritório de advocacia",
      "Advogado trabalhista",
      "Advogado civil",
      "Consulta com advogado"
    ]

  },


  generic: {

    label:
      "Negócio local",

    baseMonthly:
      [60, 130],

    scoreRange:
      [25, 58],

    keywords: [
      "Serviço perto de mim",
      "Empresa na região",
      "Profissional próximo",
      "Melhor serviço na região",
      "Atendimento perto de mim",
      "Empresa próxima"
    ]

  }

};


/* =========================================================
   BUSCAR CONFIGURAÇÃO DO SEGMENTO
========================================================= */

function getSegmentConfig(
  segmentKey,
  customLabel = ""
) {

  /*
      Primeiro tenta usar o data.js real.
  */

  if (
    typeof RADAR_SEGMENTS !==
      "undefined" &&
    RADAR_SEGMENTS &&
    RADAR_SEGMENTS[
      segmentKey
    ]
  ) {

    return {
      ...RADAR_SEGMENTS[
        segmentKey
      ],

      key:
        segmentKey,

      label:
        RADAR_SEGMENTS[
          segmentKey
        ].label ||
        customLabel ||
        segmentKey
    };

  }


  /*
      Segmentos adicionais.
  */

  if (
    FALLBACK_SEGMENTS[
      segmentKey
    ]
  ) {

    return {
      ...FALLBACK_SEGMENTS[
        segmentKey
      ],

      key:
        segmentKey
    };

  }


  /*
      Segmento recebido como texto livre
      da landing.
  */

  return {

    ...FALLBACK_SEGMENTS
      .generic,

    key:
      segmentKey,

    label:
      customLabel ||
      "Negócio local"

  };

}


/* =========================================================
   MULTIPLICADOR DO RAIO
========================================================= */

function getRadiusMultiplier(
  radius
) {

  if (
    typeof RADIUS_MULTIPLIER !==
      "undefined" &&
    RADIUS_MULTIPLIER &&
    Number.isFinite(
      Number(
        RADIUS_MULTIPLIER[
          radius
        ]
      )
    )
  ) {

    return Number(
      RADIUS_MULTIPLIER[
        radius
      ]
    );

  }


  /*
      Fallback compatível com
      o novo formulário.
  */

  const fallback = {

    "1":
      0.72,

    "3":
      1,

    "5":
      1.32,

    "8":
      1.65,

    "10":
      1.9

  };


  return (
    fallback[
      radius
    ] ||
    1
  );

}


/* =========================================================
   SNAPSHOT
========================================================= */

function getSnapshotKey({
  company,
  region,
  address,
  segmentKey,
  radius
}) {

  return [

    normalizeKeyPart(
      company
    ),

    normalizeKeyPart(
      region
    ),

    normalizeKeyPart(
      address
    ),

    normalizeKeyPart(
      segmentKey
    ),

    normalizeKeyPart(
      radius
    )

  ].join("|");

}


function getSnapshotId(
  snapshotKey
) {

  return (
    `RL-${
      hashString(
        snapshotKey
      )
        .toString(36)
        .slice(0, 7)
        .toUpperCase()
    }`
  );

}


/* =========================================================
   STORAGE
========================================================= */

function loadSnapshotStore() {

  try {

    const raw =
      localStorage.getItem(
        SNAPSHOT_STORAGE_KEY
      );


    const parsed =
      raw
        ? JSON.parse(raw)
        : {};


    return (
      parsed &&
      typeof parsed ===
        "object"
    )
      ? parsed
      : {};

  }

  catch (error) {

    console.warn(
      "Não foi possível ler os snapshots do Radar.",
      error
    );

    return {};

  }

}


function saveSnapshotStore(
  store
) {

  try {

    localStorage.setItem(
      SNAPSHOT_STORAGE_KEY,
      JSON.stringify(
        store
      )
    );

  }

  catch (error) {

    console.warn(
      "Não foi possível salvar os snapshots.",
      error
    );

  }

}


function saveCurrentReport(
  reportData
) {

  try {

    localStorage.setItem(
      CURRENT_REPORT_KEY,
      JSON.stringify(
        reportData
      )
    );

  }

  catch (error) {

    console.warn(
      "Não foi possível salvar o relatório.",
      error
    );

  }

}


/* =========================================================
   LABELS
========================================================= */

function getScoreLabel(score) {

  if (
    score < 40
  ) {
    return "Presença baixa";
  }


  if (
    score < 70
  ) {
    return "Presença intermediária";
  }


  return "Presença forte";

}


function getDemandLevel(
  monthly
) {

  if (
    monthly < 55
  ) {

    return [
      "Moderada",
      48
    ];

  }


  if (
    monthly < 105
  ) {

    return [
      "Relevante",
      68
    ];

  }


  return [
    "Alta",
    88
  ];

}


function getCompetitionLevel(
  rng
) {

  const options = [

    [
      "Média",
      60
    ],

    [
      "Média-alta",
      74
    ],

    [
      "Alta",
      86
    ]

  ];


  return options[
    randomBetween(
      rng,
      0,
      options.length - 1
    )
  ];

}


/* =========================================================
   PALAVRAS-CHAVE
========================================================= */

function makeKeywordData(
  keywords,
  monthly,
  rng
) {

  const safeKeywords =
    Array.isArray(
      keywords
    ) &&
    keywords.length
      ? keywords
      : FALLBACK_SEGMENTS
          .generic
          .keywords;


  const weights =
    safeKeywords.map(
      (
        _,
        index
      ) =>
        Math.max(
          0.18,
          0.62 -
          (
            index *
            0.06
          ) +
          (
            rng() *
            0.12
          )
        )
    );


  const totalWeight =
    weights.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );


  return safeKeywords.map(
    (
      keyword,
      index
    ) => {

      const raw =
        monthly *
        (
          weights[
            index
          ] /
          totalWeight
        );


      return {

        keyword,

        volume:
          Math.max(
            4,
            Math.round(raw)
          )

      };

    }
  );

}


/* =========================================================
   SIMULAÇÃO
========================================================= */

function buildSimulation(
  segmentKey,
  segmentLabel,
  radius,
  rng
) {

  const segment =
    getSegmentConfig(
      segmentKey,
      segmentLabel
    );


  const multiplier =
    getRadiusMultiplier(
      radius
    );


  const monthlyBase =
    randomBetween(
      rng,
      segment.baseMonthly[0],
      segment.baseMonthly[1]
    );


  const monthly =
    Math.round(
      monthlyBase *
      multiplier
    );


  const weekly =
    Math.max(
      6,
      Math.round(
        monthly /
        4.33
      )
    );


  const presence =
    clamp(
      randomBetween(
        rng,
        segment.scoreRange[0],
        segment.scoreRange[1]
      ) -
      Math.round(
        (
          multiplier -
          1
        ) *
        5
      ),
      18,
      76
    );


  const uncaptured =
    clamp(
      100 -
      presence +
      randomBetween(
        rng,
        -5,
        5
      ),
      30,
      88
    );


  const googleScore =
    clamp(
      presence +
      randomBetween(
        rng,
        -8,
        6
      ),
      15,
      82
    );


  const authorityScore =
    clamp(
      presence +
      randomBetween(
        rng,
        -10,
        9
      ),
      12,
      86
    );


  const reviewsScore =
    clamp(
      presence +
      randomBetween(
        rng,
        -12,
        12
      ),
      10,
      88
    );


  const overall =
    Math.round(

      (
        googleScore *
        0.40
      ) +

      (
        authorityScore *
        0.32
      ) +

      (
        reviewsScore *
        0.28
      )

    );


  const keywordData =
    makeKeywordData(
      segment.keywords,
      monthly,
      rng
    );


  const [
    demandLevel,
    demandMeter
  ] =
    getDemandLevel(
      monthly
    );


  const [
    competitionLevel,
    competitionMeter
  ] =
    getCompetitionLevel(
      rng
    );


  return {

    monthly,

    weekly,

    presence,

    uncaptured,

    overall,

    googleScore,

    authorityScore,

    reviewsScore,

    keywordData,

    demandLevel,

    demandMeter,

    competitionLevel,

    competitionMeter,

    visibilityLevel:
      presence < 40
        ? "Baixa"
        : presence < 65
          ? "Média"
          : "Alta",

    visibilityMeter:
      presence

  };

}


/* =========================================================
   CRIAR / RECUPERAR ANÁLISE
========================================================= */

function getOrCreateSnapshot({

  company,

  region,

  address,

  segmentKey,

  segmentLabel,

  radius,

  phone,

  origin

}) {

  const segment =
    getSegmentConfig(
      segmentKey,
      segmentLabel
    );


  const snapshotKey =
    getSnapshotKey({

      company,

      region,

      address,

      segmentKey,

      radius

    });


  const store =
    loadSnapshotStore();


  /*
      Se já existe análise,
      mantém indicadores,
      mas atualiza dados
      de contexto.
  */

  if (
    store[
      snapshotKey
    ]?.data
  ) {

    const existing = {

      ...store[
        snapshotKey
      ].data,

      company,

      region,

      address,

      phone:
        phone ||
        store[
          snapshotKey
        ].data.phone ||
        "",

      origin:
        origin ||
        store[
          snapshotKey
        ].data.origin ||
        "",

      segmentLabel:
        segment.label

    };


    store[
      snapshotKey
    ].data =
      existing;


    saveSnapshotStore(
      store
    );


    saveCurrentReport(
      existing
    );


    return existing;

  }


  const rng =
    createSeededRandom(
      `${METHOD_VERSION}|${snapshotKey}`
    );


  const simulation =
    buildSimulation(
      segmentKey,
      segment.label,
      radius,
      rng
    );


  const reportData = {

    ...simulation,

    company,

    region,

    address,

    phone:
      phone || "",

    origin:
      origin || "",

    segmentKey,

    segmentLabel:
      segment.label,

    radius,

    snapshotKey,

    snapshotId:
      getSnapshotId(
        snapshotKey
      ),

    analysisDate:
      new Date()
        .toISOString(),

    methodVersion:
      METHOD_VERSION

  };


  store[
    snapshotKey
  ] = {

    createdAt:
      reportData.analysisDate,

    version:
      2,

    data:
      reportData

  };


  saveSnapshotStore(
    store
  );


  saveCurrentReport(
    reportData
  );


  return reportData;

}


/* =========================================================
   LOADING
========================================================= */

async function runLoadingSequence(
  company,
  region
) {

  const steps = [

    {

      title:
        "Mapeando a região...",

      text:
        `Localizando ${company} e delimitando o cenário em ${region}.`,

      progress:
        22

    },

    {

      title:
        "Identificando intenções de busca...",

      text:
        "Organizando os principais tipos de procura relacionados ao segmento.",

      progress:
        48

    },

    {

      title:
        "Comparando presença e concorrência...",

      text:
        "Estimando o nível de disputa e visibilidade na área analisada.",

      progress:
        74

    },

    {

      title:
        "Calculando o score local...",

      text:
        "Consolidando demanda, presença, autoridade e confiança.",

      progress:
        100

    }

  ];


  loadingSteps.forEach(
    step => {

      step.classList.remove(
        "active",
        "done"
      );

    }
  );


  if (
    progressBar
  ) {

    progressBar.style.width =
      "5%";

  }


  for (
    let index = 0;
    index < steps.length;
    index++
  ) {

    const step =
      steps[
        index
      ];


    if (
      loadingTitle
    ) {

      loadingTitle.textContent =
        step.title;

    }


    if (
      loadingText
    ) {

      loadingText.textContent =
        step.text;

    }


    if (
      progressBar
    ) {

      progressBar.style.width =
        `${step.progress}%`;

    }


    loadingSteps.forEach(
      (
        element,
        elementIndex
      ) => {

        element.classList.remove(
          "active"
        );


        if (
          elementIndex <
          index
        ) {

          element.classList.add(
            "done"
          );

        }


        if (
          elementIndex ===
          index
        ) {

          element.classList.add(
            "active"
          );

        }

      }
    );


    await wait(
      520
    );

  }


  await wait(
    200
  );


  loadingSteps.forEach(
    step => {

      step.classList.remove(
        "active"
      );

      step.classList.add(
        "done"
      );

    }
  );

}


/* =========================================================
   RENDER DAS PALAVRAS-CHAVE
========================================================= */

function renderKeywords(
  keywordData
) {

  const list =
    byId(
      "keywordsList"
    );


  if (!list) {
    return;
  }


  list.innerHTML =
    "";


  if (
    !Array.isArray(
      keywordData
    ) ||
    !keywordData.length
  ) {

    const empty =
      document.createElement(
        "span"
      );


    empty.textContent =
      "Buscas relacionadas ao serviço";


    list.appendChild(
      empty
    );


    return;

  }


  keywordData.forEach(
    item => {

      const chip =
        document.createElement(
          "span"
        );


      chip.textContent =
        `${item.keyword} · ${formatNumber(
          item.volume
        )}/mês`;


      list.appendChild(
        chip
      );

    }
  );

}


/* =========================================================
   SINCRONIZAR TEXTOS ESPELHADOS
========================================================= */

function updateMirrors(
  name,
  value
) {

  document
    .querySelectorAll(
      `[data-mirror="${name}"]`
    )
    .forEach(
      element => {

        element.textContent =
          value;

      }
    );

}


/* =========================================================
   RENDER DO RESULTADO
========================================================= */

function renderSimulation(
  data
) {

  const company =
    data.company;


  const region =
    data.region;


  const radius =
    data.radius;


  const segmentLabel =
    data.segmentLabel ||
    getSegmentConfig(
      data.segmentKey
    ).label;


  setText(
    "resultsTitle",
    `Análise de ${company}`
  );


  setText(
    "resultsSubtitle",
    `${segmentLabel} • ${region} • raio de ${radius} km`
  );


  setText(
    "weeklyDemand",
    formatNumber(
      data.weekly
    )
  );


  setText(
    "monthlyDemand",
    formatNumber(
      data.monthly
    )
  );


  setText(
    "presenceScore",
    data.presence
  );


  setText(
    "presenceLabel",
    getScoreLabel(
      data.presence
    )
  );


  setText(
    "uncapturedDemand",
    `${data.uncaptured}%`
  );


  setText(
    "mainScore",
    data.overall
  );


  setText(
    "scoreStatus",
    getScoreLabel(
      data.overall
    )
  );


  updateMirrors(
    "mainScore",
    data.overall
  );


  updateMirrors(
    "scoreStatus",
    getScoreLabel(
      data.overall
    )
  );


  setText(
    "scoreMessage",

    data.overall < 40

      ? "Existe uma lacuna relevante entre a procura estimada e a capacidade atual de captura local."

      : data.overall < 70

        ? "A empresa já possui sinais positivos, mas ainda existe espaço importante para transformar presença em mais oportunidade."

        : "A presença estimada é consistente, com oportunidades pontuais de refinamento."

  );


  setText(
    "googleScore",
    data.googleScore
  );


  setText(
    "authorityScore",
    data.authorityScore
  );


  setText(
    "reviewsScore",
    data.reviewsScore
  );


  setText(
    "demandLevel",
    data.demandLevel
  );


  setText(
    "competitionLevel",
    data.competitionLevel
  );


  setText(
    "visibilityLevel",
    data.visibilityLevel
  );


  setText(
    "keywordsCount",
    `${data.keywordData.length} termos`
  );


  setText(
    "systemReading",

    data.presence < 45

      ? "Existe procura relevante na região, mas a presença estimada do negócio ainda é baixa para capturar essa oportunidade."

      : "A empresa já possui alguma presença, porém ainda existem lacunas que podem transferir oportunidades para concorrentes."

  );


  setText(
    "captureStatus",

    data.uncaptured > 65

      ? "alto espaço para recuperação"

      : data.uncaptured > 45

        ? "espaço relevante para evolução"

        : "captura parcialmente estruturada"

  );


  const presenceThermometer =
    byId(
      "presenceThermometer"
    );


  const demandMeter =
    byId(
      "demandMeter"
    );


  const competitionMeter =
    byId(
      "competitionMeter"
    );


  const visibilityMeter =
    byId(
      "visibilityMeter"
    );


  const scoreGauge =
    byId(
      "scoreGauge"
    );


  if (
    presenceThermometer
  ) {

    presenceThermometer
      .style.width =
      "0%";

  }


  if (
    demandMeter
  ) {

    demandMeter
      .style.width =
      "0%";

  }


  if (
    competitionMeter
  ) {

    competitionMeter
      .style.width =
      "0%";

  }


  if (
    visibilityMeter
  ) {

    visibilityMeter
      .style.width =
      "0%";

  }


  if (
    scoreGauge
  ) {

    const degrees =
      Math.round(
        (
          data.overall /
          100
        ) *
        360
      );


    scoreGauge
      .style.background =
      `conic-gradient(
        #2878f0 0deg ${degrees}deg,
        #e7ebf1 ${degrees}deg 360deg
      )`;

  }


  setTimeout(
    () => {

      if (
        presenceThermometer
      ) {

        presenceThermometer
          .style.width =
          `${data.presence}%`;

      }


      if (
        demandMeter
      ) {

        demandMeter
          .style.width =
          `${data.demandMeter}%`;

      }


      if (
        competitionMeter
      ) {

        competitionMeter
          .style.width =
          `${data.competitionMeter}%`;

      }


      if (
        visibilityMeter
      ) {

        visibilityMeter
          .style.width =
          `${data.visibilityMeter}%`;

      }

    },
    150
  );


  renderKeywords(
    data.keywordData
  );


  if (
    resultsSection
  ) {

    [
      ...resultsSection
        .querySelectorAll(
          ".metric-card, .panel, .report-generation-card"
        )
    ]
      .forEach(
        (
          element,
          index
        ) => {

          element.classList.remove(
            "result-enter"
          );


          void element.offsetWidth;


          element.classList.add(
            "result-enter"
          );


          element.style
            .animationDelay =
            `${
              Math.min(
                index * 60,
                420
              )
            }ms`;

        }
      );

  }

}


/* =========================================================
   SEGMENTO RECEBIDO DA LANDING
========================================================= */

function findExistingSegmentOption(
  rawSegment
) {

  const select =
    byId(
      "segment"
    );


  if (
    !select ||
    !rawSegment
  ) {

    return "";

  }


  const normalized =
    normalizeKeyPart(
      rawSegment
    );


  /*
      Primeiro tenta bater
      diretamente com value ou label.
  */

  const direct =
    [
      ...select.options
    ]
      .find(
        option => {

          return (

            normalizeKeyPart(
              option.value
            ) === normalized ||

            normalizeKeyPart(
              option.textContent
            ) === normalized

          );

        }
      );


  if (
    direct
  ) {

    return direct.value;

  }


  /*
      Sinônimos comuns.
  */

  const aliases = [

    {
      terms: [
        "estetica",
        "clinica estetica",
        "harmonizacao"
      ],
      key:
        "estetica"
    },

    {
      terms: [
        "podologia",
        "podologo",
        "podologa"
      ],
      key:
        "podologia"
    },

    {
      terms: [
        "odontologia",
        "dentista",
        "clinica odontologica"
      ],
      key:
        "odontologia"
    },

    {
      terms: [
        "energia solar",
        "solar"
      ],
      key:
        "energia-solar"
    },

    {
      terms: [
        "beleza",
        "salao",
        "barbearia",
        "cabeleireiro"
      ],
      key:
        "beleza"
    },

    {
      terms: [
        "assistencia",
        "assistencia tecnica"
      ],
      key:
        "assistencia"
    },

    {
      terms: [
        "vidracaria",
        "vidros"
      ],
      key:
        "vidracaria"
    },

    {
      terms: [
        "limpeza",
        "limpeza de estofados"
      ],
      key:
        "limpeza"
    },

    {
      terms: [
        "seguro",
        "seguros",
        "corretora",
        "corretora de seguros"
      ],
      key:
        "seguros"
    },

    {
      terms: [
        "advocacia",
        "advogado",
        "escritorio de advocacia"
      ],
      key:
        "advocacia"
    }

  ];


  const matched =
    aliases.find(
      item => {

        return item.terms
          .some(
            term => {

              return (
                normalized ===
                  normalizeKeyPart(
                    term
                  ) ||

                normalized.includes(
                  normalizeKeyPart(
                    term
                  )
                )

              );

            }
          );

      }
    );


  if (
    matched
  ) {

    const optionExists =
      [
        ...select.options
      ]
        .some(
          option =>
            option.value ===
            matched.key
        );


    if (
      optionExists
    ) {

      return matched.key;

    }

  }


  /*
      Segmento livre.

      Exemplo:
      ?segmento=Clínica

      Cria uma opção temporária,
      sem obrigar a alterar o HTML.
  */

  const customValue =
    `custom:${
      slugify(
        rawSegment
      ) ||
      "segmento"
    }`;


  const option =
    document.createElement(
      "option"
    );


  option.value =
    customValue;


  option.textContent =
    rawSegment;


  option.dataset.custom =
    "true";


  select.appendChild(
    option
  );


  return customValue;

}


/* =========================================================
   LEITURA DOS PARÂMETROS DA LANDING
========================================================= */

function prefillFromLanding() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const company =
    params.get(
      "empresa"
    )?.trim() ||
    "";


  const incomingSegment =
    params.get(
      "segmento"
    )?.trim() ||
    "";


  const region =
    params.get(
      "regiao"
    )?.trim() ||
    "";


  const phone =
    (
      params.get(
        "telefone"
      ) ||
      ""
    )
      .replace(
        /\D/g,
        ""
      );


  const origin =
    params.get(
      "origem"
    )?.trim() ||
    "";


  const address =
    (
      params.get(
        "endereco"
      ) ||
      params.get(
        "address"
      ) ||
      ""
    ).trim();


  const radius =
    params.get(
      "raio"
    )?.trim() ||
    "";


  const companyInput =
    byId(
      "company"
    );


  const regionInput =
    byId(
      "region"
    );


  const addressInput =
    byId(
      "address"
    );


  const radiusSelect =
    byId(
      "radius"
    );


  const segmentSelect =
    byId(
      "segment"
    );


  if (
    company &&
    companyInput
  ) {

    companyInput.value =
      company;

  }


  if (
    region &&
    regionInput
  ) {

    regionInput.value =
      region;

  }


  if (
    address &&
    addressInput
  ) {

    addressInput.value =
      address;

  }


  if (
    radius &&
    radiusSelect
  ) {

    const hasRadius =
      [
        ...radiusSelect.options
      ]
        .some(
          option =>
            option.value ===
            radius
        );


    if (
      hasRadius
    ) {

      radiusSelect.value =
        radius;

    }

  }


  if (
    incomingSegment &&
    segmentSelect
  ) {

    const segmentKey =
      findExistingSegmentOption(
        incomingSegment
      );


    if (
      segmentKey
    ) {

      segmentSelect.value =
        segmentKey;

    }

  }


  entryLeadContext = {

    phone,

    origin,

    incomingSegment

  };


  /*
      Salva contexto do lead,
      inclusive telefone vindo
      da landing.
  */

  if (
    company ||
    region ||
    phone ||
    origin
  ) {

    try {

      localStorage.setItem(
        LEAD_CONTEXT_KEY,
        JSON.stringify({

          company,

          region,

          phone,

          origin,

          incomingSegment

        })
      );

    }

    catch (error) {

      console.warn(
        "Não foi possível salvar o contexto do lead.",
        error
      );

    }

  }


  /*
      Mostra "Continuando sua análise"
      quando vier da landing.
  */

  if (
    company ||
    region ||
    incomingSegment ||
    origin ===
      "posicionamento-local"
  ) {

    const entryContext =
      byId(
        "entryContext"
      );


    const entryContextText =
      byId(
        "entryContextText"
      );


    if (
      entryContext
    ) {

      entryContext
        .classList
        .remove(
          "hidden"
        );

    }


    if (
      entryContextText
    ) {

      let text =
        "Recebemos os dados informados anteriormente.";


      if (
        company &&
        region
      ) {

        text =
          `${company} em ${region}. Complete o endereço para iniciar a análise.`;

      }

      else if (
        company
      ) {

        text =
          `${company}. Complete os dados abaixo para continuar.`;

      }


      entryContextText
        .textContent =
        text;

    }

  }

}


/* =========================================================
   ENDEREÇO LOCAL
========================================================= */

function setupAddressStorage() {

  const addressInput =
    byId(
      "address"
    );


  if (
    !addressInput
  ) {
    return;
  }


  const savedAddress =
    localStorage.getItem(
      ADDRESS_STORAGE_KEY
    );


  /*
      Só usa endereço antigo
      se não veio endereço novo
      pela URL.
  */

  if (
    savedAddress &&
    !addressInput.value
  ) {

    addressInput.value =
      savedAddress;

  }


  addressInput.addEventListener(
    "input",
    () => {

      localStorage.setItem(
        ADDRESS_STORAGE_KEY,
        addressInput.value.trim()
      );

    }
  );

}


/* =========================================================
   FORMULÁRIO
========================================================= */

if (
  form
) {

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const formData =
        new FormData(
          form
        );


      const company =
        String(
          formData.get(
            "company"
          ) ||
          ""
        ).trim();


      const region =
        String(
          formData.get(
            "region"
          ) ||
          ""
        ).trim();


      const address =
        String(
          formData.get(
            "address"
          ) ||
          ""
        ).trim();


      const segmentKey =
        String(
          formData.get(
            "segment"
          ) ||
          ""
        );


      const radius =
        String(
          formData.get(
            "radius"
          ) ||
          "3"
        );


      const segmentSelect =
        byId(
          "segment"
        );


      const segmentLabel =
        segmentSelect
          ?.selectedOptions?.[0]
          ?.textContent
          ?.trim() ||
        entryLeadContext
          .incomingSegment ||
        "Negócio local";


      /*
          Validação adicional.
      */

      if (
        !company
      ) {

        alert(
          "Informe o nome da empresa."
        );

        return;

      }


      if (
        !segmentKey
      ) {

        alert(
          "Selecione o segmento."
        );

        return;

      }


      if (
        !address
      ) {

        alert(
          "Informe o endereço completo da empresa."
        );

        byId(
          "address"
        )?.focus();

        return;

      }


      if (
        !region
      ) {

        alert(
          "Informe a cidade ou região."
        );

        return;

      }


      localStorage.setItem(
        ADDRESS_STORAGE_KEY,
        address
      );


      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );


      const originalButtonHTML =
        submitButton
          ?.innerHTML ||
        "";


      if (
        submitButton
      ) {

        submitButton.disabled =
          true;

        submitButton.innerHTML =
          `
            <span>
              Analisando sua região...
            </span>
            <b>↗</b>
          `;

      }


      /*
          Agora TODOS os segmentos,
          inclusive seguros,
          passam pelo mesmo motor.
      */

      const data =
        getOrCreateSnapshot({

          company,

          region,

          address,

          segmentKey,

          segmentLabel,

          radius,

          phone:
            entryLeadContext
              .phone,

          origin:
            entryLeadContext
              .origin

        });


      if (
        resultsSection
      ) {

        resultsSection
          .classList
          .add(
            "hidden"
          );

      }


      if (
        loadingSection
      ) {

        loadingSection
          .classList
          .remove(
            "hidden"
          );


        loadingSection
          .scrollIntoView({

            behavior:
              "smooth",

            block:
              "center"

          });

      }


      try {

        await runLoadingSequence(
          company,
          region
        );


        if (
          loadingSection
        ) {

          loadingSection
            .classList
            .add(
              "hidden"
            );

        }


        renderSimulation(
          data
        );


        if (
          resultsSection
        ) {

          resultsSection
            .classList
            .remove(
              "hidden"
            );


          resultsSection
            .scrollIntoView({

              behavior:
                "smooth",

              block:
                "start"

            });

        }

      }

      catch (error) {

        console.error(
          "Erro durante a análise:",
          error
        );


        alert(
          "Não foi possível concluir a análise. Atualize a página e tente novamente."
        );


        loadingSection
          ?.classList
          .add(
            "hidden"
          );

      }

      finally {

        if (
          submitButton
        ) {

          submitButton.disabled =
            false;


          submitButton.innerHTML =
            originalButtonHTML;

        }

      }

    }
  );

}


/* =========================================================
   ABRIR RELATÓRIO
========================================================= */

if (
  generateReportBtn
) {

  generateReportBtn
    .addEventListener(
      "click",
      () => {

        const report =
          localStorage.getItem(
            CURRENT_REPORT_KEY
          );


        if (
          !report
        ) {

          alert(
            "Faça uma análise antes de abrir o diagnóstico."
          );

          return;

        }


        window.location.href =
          "proposta.html";

      }
    );

}


/* =========================================================
   NOVA ANÁLISE
========================================================= */

if (
  newAnalysisBtn
) {

  newAnalysisBtn
    .addEventListener(
      "click",
      () => {

        if (
          resultsSection
        ) {

          resultsSection
            .classList
            .add(
              "hidden"
            );

        }


        document
          .querySelector(
            ".search-panel"
          )
          ?.scrollIntoView({

            behavior:
              "smooth",

            block:
              "center"

          });

      }
    );

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

prefillFromLanding();

setupAddressStorage();
/* =========================================================
   ENTRADA AUTOMÁTICA VINDO DA LANDING
========================================================= */

function getLandingLead() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  let savedLead =
    null;


  try {

    savedLead =
      JSON.parse(
        localStorage.getItem(
          "radarLocalLead"
        ) ||
        "null"
      );

  }

  catch (error) {

    console.warn(
      "Não foi possível ler radarLocalLead:",
      error
    );

  }


  /*
    Só usamos o localStorage como fallback
    se o lead acabou de ser criado.
  */

  const savedTimestamp =
    savedLead?.timestamp
      ? new Date(
          savedLead.timestamp
        ).getTime()
      : 0;


  const savedIsRecent =
    savedTimestamp &&
    (
      Date.now() -
      savedTimestamp
    ) <
    (
      10 *
      60 *
      1000
    );


  const origem =
    params.get(
      "origem"
    ) ||
    (
      savedIsRecent
        ? savedLead?.origem
        : ""
    ) ||
    "";


  if (
    origem !==
    "posicionamento-local"
  ) {

    return null;

  }


  return {

    company:
      (
        params.get(
          "empresa"
        ) ||
        savedLead?.empresa ||
        ""
      ).trim(),


    rawSegment:
      (
        params.get(
          "segmento"
        ) ||
        savedLead?.segmento ||
        ""
      ).trim(),


    segmentName:
      (
        params.get(
          "segmento_nome"
        ) ||
        savedLead?.segmentoNome ||
        ""
      ).trim(),


    region:
      (
        params.get(
          "regiao"
        ) ||
        savedLead?.regiao ||
        savedLead?.cidade ||
        ""
      ).trim(),


    address:
      (
        params.get(
          "endereco"
        ) ||
        savedLead?.endereco ||
        ""
      ).trim(),


    phone:
      (
        params.get(
          "telefone"
        ) ||
        savedLead?.telefone ||
        ""
      ).trim(),


    lat:
      (
        params.get(
          "lat"
        ) ||
        savedLead?.lat ||
        ""
      ).toString(),


    lon:
      (
        params.get(
          "lon"
        ) ||
        savedLead?.lon ||
        ""
      ).toString(),


    placeId:
      (
        params.get(
          "place_id"
        ) ||
        savedLead?.placeId ||
        ""
      ).toString(),


    bairro:
      (
        params.get(
          "bairro"
        ) ||
        savedLead?.bairro ||
        ""
      ).trim(),


    cep:
      (
        params.get(
          "cep"
        ) ||
        savedLead?.cep ||
        ""
      ).trim()

  };

}


/* =========================================================
   GARANTIR SEGMENTO NO RADAR
========================================================= */

function ensureRadarSegment(
  rawSegment,
  segmentName
) {

  const label =
    segmentName ||
    rawSegment ||
    "Outro segmento";


  let segmentKey =
    rawSegment;


  /*
    Segmentos relacionados à beleza
    usam a mesma base, mas preservamos
    o nome correto na tela.
  */

  const aliases = {

    barbearia:
      "beleza",

    manicure:
      "beleza",

    cilios:
      "beleza"

  };


  /*
    Para segmento personalizado,
    criamos uma chave própria.

    Exemplo:
    outro + Imobiliária
    →
    outro-imobiliaria
  */

  if (
    rawSegment ===
    "outro"
  ) {

    const customSlug =
      normalizeKeyPart(
        label
      )
        .replace(
          /\s+/g,
          "-"
        ) ||
      "personalizado";


    segmentKey =
      `outro-${customSlug}`;

  }


  /*
    Já existe normalmente.
  */

  if (
    RADAR_SEGMENTS[
      segmentKey
    ]
  ) {

    return segmentKey;

  }


  /*
    Se for uma especialidade de beleza,
    clonamos a configuração de beleza.
  */

  const baseKey =
    aliases[
      rawSegment
    ];


  if (
    baseKey &&
    RADAR_SEGMENTS[
      baseKey
    ]
  ) {

    RADAR_SEGMENTS[
      segmentKey
    ] = {

      ...RADAR_SEGMENTS[
        baseKey
      ],

      label:
        label,

      keywords:
        [
          ...RADAR_SEGMENTS[
            baseKey
          ].keywords
        ]

    };


    return segmentKey;

  }


  /*
    Fallback genérico para segmentos
    que ainda não possuem configuração própria.

    Os números continuam sendo estimativas
    determinísticas do Radar.
  */

  RADAR_SEGMENTS[
    segmentKey
  ] = {

    label:
      label,

    baseMonthly:
      [
        55,
        135
      ],

    scoreRange:
      [
        28,
        62
      ],

    keywords:
      [
        `${label} perto de mim`,
        `${label} próximo`,
        `${label} na minha região`,
        `melhor ${label}`,
        `${label} preço`,
        `${label} atendimento`
      ]

  };


  return segmentKey;

}


/* =========================================================
   PREENCHER RADAR E GERAR DIAGNÓSTICO
========================================================= */

async function runRadarFromLanding() {

  const lead =
    getLandingLead();


  if (
    !lead
  ) {

    return;

  }


  if (
    !lead.company ||
    !lead.region ||
    !lead.rawSegment
  ) {

    console.warn(
      "Dados recebidos da landing estão incompletos:",
      lead
    );

    return;

  }


  const segmentKey =
    ensureRadarSegment(
      lead.rawSegment,
      lead.segmentName
    );


  const radius =
    "3";


  /* =====================================================
     PREENCHER FORMULÁRIO
  ====================================================== */

  const companyInput =
    document.getElementById(
      "company"
    );


  const addressInput =
    document.getElementById(
      "address"
    );


  const segmentInput =
    document.getElementById(
      "segment"
    );


  const regionInput =
    document.getElementById(
      "region"
    );


  const radiusInput =
    document.getElementById(
      "radius"
    );


  if (
    companyInput
  ) {

    companyInput.value =
      lead.company;

  }


  if (
    addressInput
  ) {

    addressInput.value =
      lead.address;

  }


  if (
    regionInput
  ) {

    regionInput.value =
      lead.region;

  }


  if (
    radiusInput
  ) {

    radiusInput.value =
      radius;

  }


  /*
    Caso seja "Outro segmento"
    ou alguma opção nova,
    adicionamos no select do Radar.
  */

  if (
    segmentInput
  ) {

    const optionExists =
      Array
        .from(
          segmentInput.options
        )
        .some(
          option =>
            option.value ===
            segmentKey
        );


    if (
      !optionExists
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        segmentKey;


      option.textContent =
        RADAR_SEGMENTS[
          segmentKey
        ].label;


      segmentInput.appendChild(
        option
      );

    }


    segmentInput.value =
      segmentKey;

  }


  /* =====================================================
     SALVAR ENDEREÇO
  ====================================================== */

  if (
    lead.address
  ) {

    localStorage.setItem(
      "radarAddress",
      lead.address
    );

  }


  /* =====================================================
     AVISO DE CONTEXTO
  ====================================================== */

  const entryContext =
    document.getElementById(
      "entryContext"
    );


  const entryContextText =
    document.getElementById(
      "entryContextText"
    );


  if (
    entryContext
  ) {

    entryContext
      .classList
      .remove(
        "hidden"
      );

  }


  if (
    entryContextText
  ) {

    entryContextText.textContent =
      `${lead.company} localizado em ${lead.region}`;

  }


  /* =====================================================
     GERAR SNAPSHOT
  ====================================================== */

  const data =
    getOrCreateSnapshot({

      company:
        lead.company,

      region:
        lead.region,

      segmentKey:
        segmentKey,

      radius:
        radius

    });


  /*
    Acrescentar informações reais
    coletadas na landing.
  */

  const enrichedData = {

    ...data,

    company:
      lead.company,

    region:
      lead.region,

    segmentKey:
      segmentKey,

    segmentLabel:
      RADAR_SEGMENTS[
        segmentKey
      ].label,

    address:
      lead.address,

    phone:
      lead.phone,

    lat:
      lead.lat,

    lon:
      lead.lon,

    placeId:
      lead.placeId,

    bairro:
      lead.bairro,

    cep:
      lead.cep,

    source:
      "posicionamento-local"

  };


  saveCurrentReport(
    enrichedData
  );


  /*
    Atualizar também o snapshot salvo.
  */

  try {

    const store =
      loadSnapshotStore();


    if (
      store[
        data.snapshotKey
      ]
    ) {

      store[
        data.snapshotKey
      ].data =
        enrichedData;


      saveSnapshotStore(
        store
      );

    }

  }

  catch (error) {

    console.warn(
      "Erro ao atualizar snapshot:",
      error
    );

  }


  /* =====================================================
     CARREGAMENTO
  ====================================================== */

  resultsSection
    .classList
    .add(
      "hidden"
    );


  loadingSection
    .classList
    .remove(
      "hidden"
    );


  loadingSection.scrollIntoView({

    behavior:
      "smooth",

    block:
      "center"

  });


  await runLoadingSequence(
    lead.company,
    lead.region
  );


  loadingSection
    .classList
    .add(
      "hidden"
    );


  /* =====================================================
     RESULTADO
  ====================================================== */

  renderSimulation(
    enrichedData
  );


  resultsSection
    .classList
    .remove(
      "hidden"
    );


  resultsSection.scrollIntoView({

    behavior:
      "smooth",

    block:
      "start"

  });

}


/* =========================================================
   INICIAR AUTOMATICAMENTE
========================================================= */

setTimeout(
  function () {

    runRadarFromLanding();

  },
  200
);
