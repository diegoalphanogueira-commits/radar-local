const form = document.getElementById("analysisForm");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const newAnalysisBtn = document.getElementById("newAnalysisBtn");

const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const progressBar = document.getElementById("progressBar");

const loadingSteps = [
  ...document.querySelectorAll(".loading-step")
];

const randomBetween = (min, max) => {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
};

const clamp = (value, min, max) => {
  return Math.min(
    Math.max(value, min),
    max
  );
};

const wait = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

function formatNumber(number) {
  return new Intl.NumberFormat("pt-BR").format(number);
}

function getScoreLabel(score) {
  if (score < 40) {
    return "Presença baixa";
  }

  if (score < 70) {
    return "Presença intermediária";
  }

  return "Presença forte";
}

function getDemandLevel(monthly) {
  if (monthly < 55) {
    return ["Moderada", 48];
  }

  if (monthly < 105) {
    return ["Relevante", 68];
  }

  return ["Alta", 88];
}

function getCompetitionLevel() {
  const options = [
    ["Média", 60],
    ["Média-alta", 74],
    ["Alta", 86]
  ];

  return options[
    randomBetween(
      0,
      options.length - 1
    )
  ];
}

function makeKeywordData(
  keywords,
  monthly
) {
  const weights = keywords.map(
    (_, index) => {
      return Math.max(
        0.18,
        0.62 -
        (index * 0.06) +
        (Math.random() * 0.12)
      );
    }
  );

  const totalWeight =
    weights.reduce(
      (sum, value) => {
        return sum + value;
      },
      0
    );

  return keywords.map(
    (keyword, index) => {
      const raw =
        monthly *
        (
          weights[index] /
          totalWeight
        );

      const volume =
        Math.max(
          4,
          Math.round(raw)
        );

      return {
        keyword,
        volume
      };
    }
  );
}

function buildSimulation(
  segmentKey,
  radius
) {
  const segment =
    RADAR_SEGMENTS[segmentKey];

  const multiplier =
    RADIUS_MULTIPLIER[radius] || 1;

  const monthlyBase =
    randomBetween(
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
        monthly / 4.33
      )
    );

  const presence =
    clamp(
      randomBetween(
        segment.scoreRange[0],
        segment.scoreRange[1]
      ) -
      Math.round(
        (multiplier - 1) * 5
      ),
      18,
      76
    );

  const uncaptured =
    clamp(
      100 -
      presence +
      randomBetween(-5, 5),
      30,
      88
    );

  const googleScore =
    clamp(
      presence +
      randomBetween(-8, 6),
      15,
      82
    );

  const authorityScore =
    clamp(
      presence +
      randomBetween(-10, 9),
      12,
      86
    );

  const reviewsScore =
    clamp(
      presence +
      randomBetween(-12, 12),
      10,
      88
    );

  const overall =
    Math.round(
      (googleScore * 0.4) +
      (authorityScore * 0.32) +
      (reviewsScore * 0.28)
    );

  const keywordData =
    makeKeywordData(
      segment.keywords,
      monthly
    );

  const [
    demandLevel,
    demandMeter
  ] =
    getDemandLevel(monthly);

  const [
    competitionLevel,
    competitionMeter
  ] =
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
        "Simulando o nível de disputa e visibilidade na área analisada.",

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
    (step) => {
      step.classList.remove(
        "active",
        "done"
      );
    }
  );

  progressBar.style.width =
    "5%";

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

    await wait(700);
  }

  await wait(350);

  loadingSteps.forEach(
    (step) => {
      step.classList.remove(
        "active"
      );

      step.classList.add(
        "done"
      );
    }
  );
}

function renderKeywords(
  keywordData
) {
  const list =
    document.getElementById(
      "keywordsList"
    );

  const maxVolume =
    Math.max(
      ...keywordData.map(
        (item) => {
          return item.volume;
        }
      )
    );

  list.innerHTML = "";

  keywordData.forEach(
    (item, index) => {
      const width =
        Math.max(
          22,
          Math.round(
            (
              item.volume /
              maxVolume
            ) * 100
          )
        );

      const row =
        document.createElement(
          "div"
        );

      row.className =
        "keyword-row result-enter";

      row.style.animationDelay =
        `${index * 55}ms`;

      row.innerHTML = `
        <div class="keyword-name">
          ${item.keyword}
        </div>

        <div class="keyword-bar">
          <span
            style="--target-width:${width}%"
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

      list.appendChild(row);
    }
  );

  requestAnimationFrame(
    () => {
      const bars =
        list.querySelectorAll(
          ".keyword-bar span"
        );

      bars.forEach(
        (bar) => {
          bar.style.width =
            bar.style.getPropertyValue(
              "--target-width"
            );
        }
      );
    }
  );
}

function renderSimulation(
  data,
  formData
) {
  const company =
    formData.get("company");

  const region =
    formData.get("region");

  const segmentKey =
    formData.get("segment");

  const radius =
    formData.get("radius");

  const segment =
    RADAR_SEGMENTS[
      segmentKey
    ];

  document.getElementById(
    "resultsTitle"
  ).textContent =
    `Análise de ${company}`;

  document.getElementById(
    "resultsSubtitle"
  ).textContent =
    `${segment.label} • ${region} • raio de ${radius} km`;

  document.getElementById(
    "weeklyDemand"
  ).textContent =
    formatNumber(
      data.weekly
    );

  document.getElementById(
    "monthlyDemand"
  ).textContent =
    formatNumber(
      data.monthly
    );

  document.getElementById(
    "presenceScore"
  ).textContent =
    data.presence;

  document.getElementById(
    "presenceLabel"
  ).textContent =
    getScoreLabel(
      data.presence
    );

  document.getElementById(
    "uncapturedDemand"
  ).textContent =
    `${data.uncaptured}%`;

  document.getElementById(
    "mainScore"
  ).textContent =
    data.overall;

  document.getElementById(
    "scoreStatus"
  ).textContent =
    getScoreLabel(
      data.overall
    );

  document.getElementById(
    "scoreMessage"
  ).textContent =
    data.overall < 40
      ? "A empresa possui espaço relevante para ganhar visibilidade e melhorar a capacidade de captura local."
      : data.overall < 70
        ? "A empresa já possui alguns sinais positivos, mas ainda existe espaço importante para evolução."
        : "A presença simulada é consistente, com oportunidade de refinamento e expansão.";

  document.getElementById(
    "googleScore"
  ).textContent =
    data.googleScore;

  document.getElementById(
    "authorityScore"
  ).textContent =
    data.authorityScore;

  document.getElementById(
    "reviewsScore"
  ).textContent =
    data.reviewsScore;

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

  document.getElementById(
    "keywordsCount"
  ).textContent =
    `${data.keywordData.length} termos`;

  document.getElementById(
    "systemReading"
  ).textContent =
    data.presence < 45
      ? "Existe procura relevante na região, mas a presença estimada do negócio ainda é baixa para capturar essa oportunidade."
      : "A empresa já possui alguma presença, porém ainda existem lacunas que podem transferir oportunidades para concorrentes.";

  document.getElementById(
    "captureStatus"
  ).textContent =
    data.uncaptured > 65
      ? "alto espaço para recuperação"
      : data.uncaptured > 45
        ? "espaço relevante para evolução"
        : "captura parcialmente estruturada";

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

  const scoreGauge =
    document.getElementById(
      "scoreGauge"
    );

  presenceThermometer.style.width =
    "0%";

  demandMeter.style.width =
    "0%";

  competitionMeter.style.width =
    "0%";

  visibilityMeter.style.width =
    "0%";

  const degrees =
    Math.round(
      (
        data.overall /
        100
      ) * 360
    );

  scoreGauge.style.background =
    `conic-gradient(
      #1a73e8 0deg ${degrees}deg,
      #edf1f6 ${degrees}deg 360deg
    )`;

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

  renderKeywords(
    data.keywordData
  );

  const animatedElements =
    resultsSection.querySelectorAll(
      ".metric-card, .panel, .solution-banner"
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
        `${Math.min(
          index * 60,
          420
        )}ms`;
    }
  );
}

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

    if (
      !company ||
      !region ||
      !segmentKey
    ) {
      return;
    }

    const data =
      buildSimulation(
        segmentKey,
        radius
      );

    resultsSection.classList.add(
      "hidden"
    );

    loadingSection.classList.remove(
      "hidden"
    );

    loadingSection.scrollIntoView({
      behavior:
        "smooth",

      block:
        "center"
    });

    await runLoadingSequence(
      company,
      region
    );

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

    resultsSection.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start"
    });
  }
);

newAnalysisBtn.addEventListener(
  "click",
  () => {
    resultsSection.classList.add(
      "hidden"
    );

    document
      .querySelector(
        ".search-panel"
      )
      .scrollIntoView({
        behavior:
          "smooth",

        block:
          "center"
      });
  }
);
