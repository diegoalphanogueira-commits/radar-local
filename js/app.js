/* =========================================================
   RADAR LOCAL — APP.JS V2
========================================================= */


/* =========================================================
   ELEMENTOS PRINCIPAIS
========================================================= */

const form =
  document.getElementById("analysisForm");

const searchPanel =
  document.getElementById("searchPanel");

const loadingSection =
  document.getElementById("loadingSection");

const resultsSection =
  document.getElementById("resultsSection");

const segmentSelect =
  document.getElementById("segment");

const customSegmentField =
  document.getElementById("customSegmentField");

const customSegmentInput =
  document.getElementById("customSegment");

const servicesField =
  document.getElementById("servicesField");

const servicesList =
  document.getElementById("servicesList");

const selectAllServicesBtn =
  document.getElementById("selectAllServices");

const newAnalysisBtn =
  document.getElementById("newAnalysisBtn");

const toggleKeywordsBtn =
  document.getElementById("toggleKeywordsBtn");


/* =========================================================
   ELEMENTOS DO LOADING
========================================================= */

const loadingTitle =
  document.getElementById("loadingTitle");

const loadingText =
  document.getElementById("loadingText");

const progressBar =
  document.getElementById("progressBar");

const loadingSteps =
  [...document.querySelectorAll(".loading-step")];


/* =========================================================
   ESTADO
========================================================= */

let currentKeywordData = [];

let keywordsExpanded = false;


/* =========================================================
   FUNÇÕES UTILITÁRIAS
========================================================= */

function randomBetween(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}


function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}


function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


function formatNumber(number) {
  return new Intl.NumberFormat(
    "pt-BR"
  ).format(number);
}


function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim();
}


/* =========================================================
   SCORE
========================================================= */

function getScoreLabel(score) {

  if (score < 35) {
    return "Presença baixa";
  }

  if (score < 55) {
    return "Presença intermediária";
  }

  if (score < 75) {
    return "Boa presença";
  }

  return "Presença forte";
}


function getVisibilityLabel(score) {

  if (score < 35) {
    return "Baixa";
  }

  if (score < 60) {
    return "Média";
  }

  return "Alta";
}


/* =========================================================
   DEMANDA
========================================================= */

function getDemandLevel(monthly) {

  if (monthly < 60) {
    return {
      label: "Moderada",
      meter: 48
    };
  }

  if (monthly < 110) {
    return {
      label: "Relevante",
      meter: 68
    };
  }

  if (monthly < 170) {
    return {
      label: "Alta",
      meter: 84
    };
  }

  return {
    label: "Muito alta",
    meter: 95
  };
}


function getCompetitionLevel() {

  const options = [
    {
      label: "Média",
      meter: 58
    },

    {
      label: "Média-alta",
      meter: 72
    },

    {
      label: "Alta",
      meter: 85
    }
  ];

  return options[
    randomBetween(
      0,
      options.length - 1
    )
  ];
}


/* =========================================================
   SERVIÇOS DINÂMICOS
========================================================= */

function renderServices(segmentKey) {

  servicesList.innerHTML = "";

  if (
    !segmentKey ||
    !RADAR_SEGMENTS[segmentKey]
  ) {

    servicesField.classList.add(
      "hidden"
    );

    return;
  }


  const segment =
    RADAR_SEGMENTS[segmentKey];


  segment.services.forEach(
    (service, index) => {

      const wrapper =
        document.createElement("div");

      wrapper.className =
        "service-option";


      const checkbox =
        document.createElement("input");

      checkbox.type =
        "checkbox";

      checkbox.name =
        "services";

      checkbox.value =
        service;

      checkbox.id =
        `service-${segmentKey}-${index}`;


      /*
        Primeiros 4 serviços
        já vêm selecionados.
      */

      checkbox.checked =
        index < 4;


      const label =
        document.createElement("label");

      label.htmlFor =
        checkbox.id;

      label.textContent =
        service;


      wrapper.appendChild(
        checkbox
      );

      wrapper.appendChild(
        label
      );

      servicesList.appendChild(
        wrapper
      );


      checkbox.addEventListener(
        "change",
        updateSelectAllText
      );

    }
  );


  servicesField.classList.remove(
    "hidden"
  );

  updateSelectAllText();
}


/* =========================================================
   SELECIONAR TODOS
========================================================= */

function updateSelectAllText() {

  const checkboxes =
    [
      ...servicesList.querySelectorAll(
        'input[type="checkbox"]'
      )
    ];

  if (!checkboxes.length) {
    return;
  }


  const allSelected =
    checkboxes.every(
      checkbox =>
        checkbox.checked
    );


  selectAllServicesBtn.textContent =
    allSelected
      ? "Limpar seleção"
      : "Selecionar todos";
}


selectAllServicesBtn.addEventListener(
  "click",
  () => {

    const checkboxes =
      [
        ...servicesList.querySelectorAll(
          'input[type="checkbox"]'
        )
      ];


    const allSelected =
      checkboxes.every(
        checkbox =>
          checkbox.checked
      );


    checkboxes.forEach(
      checkbox => {

        checkbox.checked =
          !allSelected;

      }
    );


    updateSelectAllText();

  }
);


/* =========================================================
   ALTERAÇÃO DO SEGMENTO
========================================================= */

segmentSelect.addEventListener(
  "change",
  () => {

    const segmentKey =
      segmentSelect.value;


    if (
      segmentKey === "outro"
    ) {

      customSegmentField.classList.remove(
        "hidden"
      );

    } else {

      customSegmentField.classList.add(
        "hidden"
      );

      customSegmentInput.value =
        "";

    }


    renderServices(
      segmentKey
    );

  }
);


/* =========================================================
   SERVIÇOS SELECIONADOS
========================================================= */

function getSelectedServices() {

  return [
    ...servicesList.querySelectorAll(
      'input[name="services"]:checked'
    )
  ].map(
    checkbox =>
      checkbox.value
  );

}


/* =========================================================
   CRIAÇÃO DAS PALAVRAS-CHAVE
========================================================= */

function buildKeywordPool(
  segment,
  selectedServices,
  customSegment
) {

  let pool = [];


  /*
    Serviços selecionados têm prioridade
  */

  selectedServices.forEach(
    service => {

      pool.push(
        service.toLowerCase()
      );

    }
  );


  /*
    Depois entram keywords
    pré-configuradas
  */

  segment.keywords.forEach(
    keyword => {

      pool.push(keyword);

    }
  );


  /*
    Segmento personalizado
  */

  if (
    customSegment &&
    customSegment.trim()
  ) {

    const custom =
      customSegment
        .trim()
        .toLowerCase();

    pool.unshift(
      custom,
      `${custom} perto de mim`,
      `${custom} na região`
    );

  }


  /*
    Remove duplicatas
  */

  const unique = [];

  const seen =
    new Set();


  pool.forEach(
    item => {

      const normalized =
        normalizeText(item);

      if (
        !seen.has(normalized)
      ) {

        seen.add(normalized);

        unique.push(item);

      }

    }
  );


  return unique.slice(0, 10);

}


/* =========================================================
   VOLUME POR PALAVRA
========================================================= */

function makeKeywordData(
  keywords,
  monthly
) {

  if (!keywords.length) {
    return [];
  }


  const weights =
    keywords.map(
      (_, index) => {

        const base =
          1 -
          index * 0.07;

        return Math.max(
          0.25,
          base +
          Math.random() * 0.18
        );

      }
    );


  const totalWeight =
    weights.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  return keywords.map(
    (keyword, index) => {

      const share =
        weights[index] /
        totalWeight;


      const volume =
        Math.max(
          4,
          Math.round(
            monthly * share
          )
        );


      return {
        keyword,
        volume
      };

    }
  );

}


/* =========================================================
   MOTOR DA SIMULAÇÃO
========================================================= */

function buildSimulation(
  segmentKey,
  radius,
  selectedServices,
  customSegment
) {

  const segment =
    RADAR_SEGMENTS[
      segmentKey
    ];


  const radiusMultiplier =
    RADIUS_MULTIPLIER[
      radius
    ] || 1;


  /*
    Quanto mais serviços selecionados,
    maior a amplitude potencial.
  */

  const servicesMultiplier =
    clamp(
      0.9 +
      selectedServices.length * 0.035,
      0.9,
      1.18
    );


  const monthlyBase =
    randomBetween(
      segment.baseMonthly[0],
      segment.baseMonthly[1]
    );


  const monthly =
    Math.round(
      monthlyBase *
      radiusMultiplier *
      servicesMultiplier
    );


  const weekly =
    Math.max(
      5,
      Math.round(
        monthly / 4.33
      )
    );


  /*
    Score de presença
  */

  const presence =
    clamp(
      randomBetween(
        segment.scoreRange[0],
        segment.scoreRange[1]
      ) -
      Math.round(
        (radiusMultiplier - 1) * 5
      ),
      18,
      78
    );


  /*
    Demanda não capturada
  */

  const uncaptured =
    clamp(
      100 -
      presence +
      randomBetween(
        -4,
        7
      ),
      28,
      88
    );


  /*
    3 mecanismos
  */

  const googleScore =
    clamp(
      presence +
      randomBetween(
        -8,
        5
      ),
      14,
      82
    );


  const authorityScore =
    clamp(
      presence +
      randomBetween(
        -10,
        8
      ),
      12,
      84
    );


  const reviewsScore =
    clamp(
      presence +
      randomBetween(
        -12,
        11
      ),
      10,
      88
    );


  /*
    Score geral
  */

  const overall =
    Math.round(
      googleScore * 0.4 +
      authorityScore * 0.32 +
      reviewsScore * 0.28
    );


  const keywordPool =
    buildKeywordPool(
      segment,
      selectedServices,
      customSegment
    );


  const keywordData =
    makeKeywordData(
      keywordPool,
      monthly
    );


  const demand =
    getDemandLevel(
      monthly
    );


  const competition =
    getCompetitionLevel();


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

    demandLevel:
      demand.label,

    demandMeter:
      demand.meter,

    competitionLevel:
      competition.label,

    competitionMeter:
      competition.meter,

    visibilityLevel:
      getVisibilityLabel(
        presence
      ),

    visibilityMeter:
      presence

  };

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
        `Localizando ${company} e delimitando a área de análise em ${region}.`,

      progress:
        22
    },

    {
      title:
        "Identificando demanda...",

      text:
        "Organizando serviços, intenções de busca e oportunidades locais.",

      progress:
        48
    },

    {
      title:
        "Comparando presença...",

      text:
        "Analisando visibilidade, concorrência e capacidade de captura.",

      progress:
        74
    },

    {
      title:
        "Calculando o score...",

      text:
        "Consolidando demanda, relevância, autoridade e confiança.",

      progress:
        100
    }

  ];


  progressBar.style.width =
    "5%";


  loadingSteps.forEach(
    step => {

      step.classList.remove(
        "active",
        "done"
      );

    }
  );


  for (
    let index = 0;
    index < steps.length;
    index++
  ) {

    const step =
      steps[index];


    loadingTitle.textContent =
      step.title;


    loadingText.textContent =
      step.text;


    progressBar.style.width =
      `${step.progress}%`;


    loadingSteps.forEach(
      (
        element,
        elementIndex
      ) => {

        element.classList.remove(
          "active"
        );


        if (
          elementIndex < index
        ) {

          element.classList.add(
            "done"
          );

        }


        if (
          elementIndex === index
        ) {

          element.classList.add(
            "active"
          );

        }

      }
    );


    await wait(720);

  }


  await wait(300);


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
   ANIMAÇÃO DE NÚMEROS
========================================================= */

function animateNumber(
  element,
  target,
  duration = 800,
  suffix = ""
) {

  if (!element) {
    return;
  }


  const start =
    performance.now();


  function frame(now) {

    const progress =
      Math.min(
        (now - start) /
        duration,
        1
      );


    const eased =
      1 -
      Math.pow(
        1 - progress,
        3
      );


    const current =
      Math.round(
        target * eased
      );


    element.textContent =
      formatNumber(current) +
      suffix;


    if (
      progress < 1
    ) {

      requestAnimationFrame(
        frame
      );

    }

  }


  requestAnimationFrame(
    frame
  );

}


/* =========================================================
   PALAVRAS-CHAVE
========================================================= */

function renderKeywords() {

  const list =
    document.getElementById(
      "keywordsList"
    );


  list.innerHTML =
    "";


  if (
    !currentKeywordData.length
  ) {

    toggleKeywordsBtn.classList.add(
      "hidden"
    );

    return;

  }


  const mobile =
    window.matchMedia(
      "(max-width: 680px)"
    ).matches;


  const limit =
    mobile
      ? 4
      : 5;


  const visibleData =
    keywordsExpanded
      ? currentKeywordData
      : currentKeywordData.slice(
          0,
          limit
        );


  const maxVolume =
    Math.max(
      ...currentKeywordData.map(
        item =>
          item.volume
      )
    );


  visibleData.forEach(
    (item, index) => {

      const width =
        Math.max(
          20,
          Math.round(
            item.volume /
            maxVolume *
            100
          )
        );


      const row =
        document.createElement(
          "div"
        );


      row.className =
        "keyword-row result-enter";


      row.style.animationDelay =
        `${index * 50}ms`;


      row.innerHTML = `
        <div class="keyword-name">
          ${item.keyword}
        </div>

        <div class="keyword-bar">
          <span
            style="
              --target-width:
              ${width}%;
            "
          ></span>
        </div>

        <div class="keyword-volume">
          <strong>
            ${formatNumber(item.volume)}
          </strong>

          <span>
            estimativa/mês
          </span>
        </div>
      `;


      list.appendChild(
        row
      );

    }
  );


  /*
    Anima as barras
  */

  requestAnimationFrame(
    () => {

      const bars =
        list.querySelectorAll(
          ".keyword-bar span"
        );


      bars.forEach(
        bar => {

          bar.style.width =
            bar.style.getPropertyValue(
              "--target-width"
            );

        }
      );

    }
  );


  /*
    Botão ver mais
  */

  if (
    currentKeywordData.length >
    limit
  ) {

    toggleKeywordsBtn.classList.remove(
      "hidden"
    );


    toggleKeywordsBtn.textContent =
      keywordsExpanded
        ? "Mostrar menos"
        : `Ver todas as ${currentKeywordData.length} buscas`;

  } else {

    toggleKeywordsBtn.classList.add(
      "hidden"
    );

  }

}


/* =========================================================
   BOTÃO VER TODAS
========================================================= */

toggleKeywordsBtn.addEventListener(
  "click",
  () => {

    keywordsExpanded =
      !keywordsExpanded;


    renderKeywords();

  }
);


/* =========================================================
   TEXTO DA OPORTUNIDADE
========================================================= */

function getOpportunityMessage(
  uncaptured,
  presence
) {

  if (
    uncaptured >= 70
  ) {

    return (
      "Uma parcela elevada da oportunidade estimada " +
      "ainda está fora da capacidade atual de captura " +
      "da empresa."
    );

  }


  if (
    uncaptured >= 50
  ) {

    return (
      "Existe procura relevante na região, mas a presença " +
      "digital estimada ainda não acompanha todo esse potencial."
    );

  }


  if (
    presence >= 65
  ) {

    return (
      "A empresa já possui uma presença consistente, " +
      "mas ainda existem pontos que podem ampliar sua captura."
    );

  }


  return (
    "Existe espaço para aumentar a visibilidade e transformar " +
    "mais procura local em oportunidades de contato."
  );

}


/* =========================================================
   RENDERIZAÇÃO
========================================================= */

function renderSimulation(
  data,
  formData
) {

  const company =
    formData.get(
      "company"
    );


  const region =
    formData.get(
      "region"
    );


  const segmentKey =
    formData.get(
      "segment"
    );


  const radius =
    formData.get(
      "radius"
    );


  const customSegment =
    formData.get(
      "customSegment"
    );


  const segment =
    RADAR_SEGMENTS[
      segmentKey
    ];


  const segmentLabel =
    segmentKey === "outro" &&
    customSegment &&
    customSegment.trim()
      ? customSegment.trim()
      : segment.label;


  /*
    Cabeçalho
  */

  document.getElementById(
    "toolbarCompany"
  ).textContent =
    company;


  document.getElementById(
    "resultsTitle"
  ).textContent =
    `Análise de ${company}`;


  document.getElementById(
    "resultsSubtitle"
  ).textContent =
    `${segmentLabel} • ${region} • raio de ${radius} km`;


  /*
    Números principais
  */

  animateNumber(
    document.getElementById(
      "weeklyDemand"
    ),
    data.weekly
  );


  animateNumber(
    document.getElementById(
      "monthlyDemand"
    ),
    data.monthly
  );


  animateNumber(
    document.getElementById(
      "presenceScore"
    ),
    data.presence
  );


  animateNumber(
    document.getElementById(
      "uncapturedDemand"
    ),
    data.uncaptured,
    850,
    "%"
  );


  animateNumber(
    document.getElementById(
      "bigOpportunityNumber"
    ),
    data.uncaptured,
    900,
    "%"
  );


  animateNumber(
    document.getElementById(
      "mainScore"
    ),
    data.overall
  );


  /*
    Labels
  */

  document.getElementById(
    "presenceLabel"
  ).textContent =
    getScoreLabel(
      data.presence
    );


  document.getElementById(
    "scoreStatus"
  ).textContent =
    getScoreLabel(
      data.overall
    );


  /*
    Mensagem score
  */

  const scoreMessage =
    document.getElementById(
      "scoreMessage"
    );


  if (
    data.overall < 35
  ) {

    scoreMessage.textContent =
      "A empresa possui baixa presença estimada e espaço significativo para evolução.";

  } else if (
    data.overall < 55
  ) {

    scoreMessage.textContent =
      "A empresa já possui alguns sinais positivos, mas ainda existe espaço importante para evolução.";

  } else if (
    data.overall < 75
  ) {

    scoreMessage.textContent =
      "A empresa possui uma estrutura razoável, com oportunidades claras para ampliar sua visibilidade.";

  } else {

    scoreMessage.textContent =
      "A empresa apresenta uma presença forte, com oportunidades de refinamento e expansão.";

  }


  /*
    Oportunidade
  */

  document.getElementById(
    "opportunityMessage"
  ).textContent =
    getOpportunityMessage(
      data.uncaptured,
      data.presence
    );


  /*
    Capture status
  */

  const captureStatus =
    document.getElementById(
      "captureStatus"
    );


  if (
    data.uncaptured >= 70
  ) {

    captureStatus.textContent =
      "alto espaço para recuperação";

  } else if (
    data.uncaptured >= 50
  ) {

    captureStatus.textContent =
      "espaço relevante para evolução";

  } else {

    captureStatus.textContent =
      "captura parcialmente estruturada";

  }


  /*
    Indicadores
  */

  document.getElementById(
    "demandLevel"
  ).textContent =
    data.demandLevel;


  document.getElementById(
    "competitionLevel"
  ).textContent =
    data.competitionLevel;


  document.getElementById(
    "visibilityLevel"
  ).textContent =
    data.visibilityLevel;


  /*
    Leitura sistema
  */

  const systemReading =
    document.getElementById(
      "systemReading"
    );


  if (
    data.presence < 40
  ) {

    systemReading.textContent =
      "Existe demanda relevante na região, mas a presença estimada do negócio ainda é baixa para capturar essa oportunidade.";

  } else if (
    data.presence < 60
  ) {

    systemReading.textContent =
      "A empresa possui presença intermediária, porém ainda existem lacunas importantes entre procura e capacidade de captura.";

  } else {

    systemReading.textContent =
      "A empresa apresenta boa presença, com oportunidades pontuais para ampliar relevância e autoridade local.";

  }


  /*
    Scores dos mecanismos
  */

  animateNumber(
    document.getElementById(
      "googleScore"
    ),
    data.googleScore
  );


  animateNumber(
    document.getElementById(
      "authorityScore"
    ),
    data.authorityScore
  );


  animateNumber(
    document.getElementById(
      "reviewsScore"
    ),
    data.reviewsScore
  );


  /*
    Keywords
  */

  currentKeywordData =
    data.keywordData;


  keywordsExpanded =
    false;


  document.getElementById(
    "keywordsCount"
  ).textContent =
    `${data.keywordData.length} termos`;


  renderKeywords();


  /*
    Barras
  */

  const presenceThermometer =
    document.getElementById(
      "presenceThermometer"
    );


  const demandMeter =
    document.getElementById(
      "demandMeter"
    );


  const competitionMeter =
    document.getElementById(
      "competitionMeter"
    );


  const visibilityMeter =
    document.getElementById(
      "visibilityMeter"
    );


  presenceThermometer.style.width =
    "0%";


  demandMeter.style.width =
    "0%";


  competitionMeter.style.width =
    "0%";


  visibilityMeter.style.width =
    "0%";


  setTimeout(
    () => {

      presenceThermometer.style.width =
        `${data.presence}%`;


      demandMeter.style.width =
        `${data.demandMeter}%`;


      competitionMeter.style.width =
        `${data.competitionMeter}%`;


      visibilityMeter.style.width =
        `${data.visibilityMeter}%`;

    },
    150
  );


  /*
    Gauge
  */

  const scoreGauge =
    document.getElementById(
      "scoreGauge"
    );


  const degrees =
    Math.round(
      data.overall /
      100 *
      360
    );


  scoreGauge.style.background =
    `
      conic-gradient(
        #1a73e8 0deg ${degrees}deg,
        #edf1f6 ${degrees}deg 360deg
      )
    `;


  /*
    Anima entrada
  */

  const animatedElements =
    resultsSection.querySelectorAll(
      ".metric-card, .opportunity-message, .panel, .solution-card"
    );


  animatedElements.forEach(
    (element, index) => {

      element.classList.remove(
        "result-enter"
      );


      void element.offsetWidth;


      element.classList.add(
        "result-enter"
      );


      element.style.animationDelay =
        `${
          Math.min(
            index * 60,
            420
          )
        }ms`;

    }
  );

}


/* =========================================================
   SUBMIT
========================================================= */

form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const formData =
      new FormData(form);


    const company =
      formData
        .get("company")
        .trim();


    const region =
      formData
        .get("region")
        .trim();


    const segmentKey =
      formData.get(
        "segment"
      );


    const radius =
      formData.get(
        "radius"
      );


    const customSegment =
      formData.get(
        "customSegment"
      );


    if (
      !company ||
      !region ||
      !segmentKey
    ) {

      return;

    }


    /*
      Se escolher Outro,
      exige nome do segmento.
    */

    if (
      segmentKey === "outro" &&
      (
        !customSegment ||
        !customSegment.trim()
      )
    ) {

      customSegmentInput.focus();

      return;

    }


    const selectedServices =
      getSelectedServices();


    const data =
      buildSimulation(
        segmentKey,
        radius,
        selectedServices,
        customSegment
      );


    /*
      Esconde resultados antigos
    */

    resultsSection.classList.add(
      "hidden"
    );


    /*
      Mostra loading
    */

    loadingSection.classList.remove(
      "hidden"
    );


    loadingSection.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });


    /*
      Executa carregamento
    */

    await runLoadingSequence(
      company,
      region
    );


    /*
      Renderiza
    */

    loadingSection.classList.add(
      "hidden"
    );


    renderSimulation(
      data,
      formData
    );


    resultsSection.classList.remove(
      "hidden"
    );


    /*
      Scroll resultado
    */

    resultsSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }
);


/* =========================================================
   NOVA ANÁLISE
========================================================= */

newAnalysisBtn.addEventListener(
  "click",
  () => {

    resultsSection.classList.add(
      "hidden"
    );


    searchPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }
);


/* =========================================================
   ACCORDION DO DIAGNÓSTICO
========================================================= */

const diagnosisTriggers =
  document.querySelectorAll(
    ".diagnosis-trigger"
  );


diagnosisTriggers.forEach(
  trigger => {

    trigger.addEventListener(
      "click",
      () => {

        const accordion =
          trigger.closest(
            ".diagnosis-accordion"
          );


        const isOpen =
          accordion.classList.contains(
            "open"
          );


        /*
          Fecha os outros
        */

        document
          .querySelectorAll(
            ".diagnosis-accordion"
          )
          .forEach(
            item => {

              item.classList.remove(
                "open"
              );

            }
          );


        /*
          Abre o selecionado
        */

        if (!isOpen) {

          accordion.classList.add(
            "open"
          );

        }

      }
    );

  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function initializeRadar() {

  const initialSegment =
    segmentSelect.value;


  if (initialSegment) {

    renderServices(
      initialSegment
    );

  }

}


initializeRadar();
