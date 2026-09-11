const form = document.getElementById("analysisForm");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const newAnalysisBtn = document.getElementById("newAnalysisBtn");
const generateReportBtn = document.getElementById("generateReportBtn");

const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const progressBar = document.getElementById("progressBar");
const loadingSteps = [...document.querySelectorAll(".loading-step")];

const SNAPSHOT_STORAGE_KEY = "radarLocalSnapshotsV1";
const CURRENT_REPORT_KEY = "radarProposal";
const METHOD_VERSION = "radar-local-v4";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatNumber(number) {
  return new Intl.NumberFormat("pt-BR").format(number);
}

function normalizeKeyPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function hashString(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedText) {
  let seed = hashString(seedText) || 1;
  return function seededRandom() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function getSnapshotKey({ company, region, segmentKey, radius }) {
  return [
    normalizeKeyPart(company),
    normalizeKeyPart(region),
    normalizeKeyPart(segmentKey),
    normalizeKeyPart(radius)
  ].join("|");
}

function getSnapshotId(snapshotKey) {
  return `RL-${hashString(snapshotKey).toString(36).slice(0, 7).toUpperCase()}`;
}

function loadSnapshotStore() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Não foi possível ler snapshots do Radar:", error);
    return {};
  }
}

function saveSnapshotStore(store) {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("Não foi possível salvar snapshots do Radar:", error);
  }
}

function saveCurrentReport(reportData) {
  localStorage.setItem(CURRENT_REPORT_KEY, JSON.stringify(reportData));
}

function getScoreLabel(score) {
  if (score < 40) return "Presença baixa";
  if (score < 70) return "Presença intermediária";
  return "Presença forte";
}

function getDemandLevel(monthly) {
  if (monthly < 55) return ["Moderada", 48];
  if (monthly < 105) return ["Relevante", 68];
  return ["Alta", 88];
}

function getCompetitionLevel(rng) {
  const options = [
    ["Média", 60],
    ["Média-alta", 74],
    ["Alta", 86]
  ];
  return options[randomBetween(rng, 0, options.length - 1)];
}

function makeKeywordData(keywords, monthly, rng) {
  const weights = keywords.map((_, index) =>
    Math.max(0.18, 0.62 - (index * 0.06) + (rng() * 0.12))
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return keywords.map((keyword, index) => {
    const raw = monthly * (weights[index] / totalWeight);
    return { keyword, volume: Math.max(4, Math.round(raw)) };
  });
}

function buildSimulation(segmentKey, radius, rng) {
  const segment = RADAR_SEGMENTS[segmentKey];
  const multiplier = RADIUS_MULTIPLIER[radius] || 1;

  const monthlyBase = randomBetween(rng, segment.baseMonthly[0], segment.baseMonthly[1]);
  const monthly = Math.round(monthlyBase * multiplier);
  const weekly = Math.max(6, Math.round(monthly / 4.33));

  const presence = clamp(
    randomBetween(rng, segment.scoreRange[0], segment.scoreRange[1])
      - Math.round((multiplier - 1) * 5),
    18,
    76
  );

  const uncaptured = clamp(100 - presence + randomBetween(rng, -5, 5), 30, 88);
  const googleScore = clamp(presence + randomBetween(rng, -8, 6), 15, 82);
  const authorityScore = clamp(presence + randomBetween(rng, -10, 9), 12, 86);
  const reviewsScore = clamp(presence + randomBetween(rng, -12, 12), 10, 88);

  const overall = Math.round(
    (googleScore * 0.4) +
    (authorityScore * 0.32) +
    (reviewsScore * 0.28)
  );

  const keywordData = makeKeywordData(segment.keywords, monthly, rng);
  const [demandLevel, demandMeter] = getDemandLevel(monthly);
  const [competitionLevel, competitionMeter] = getCompetitionLevel(rng);

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
    visibilityLevel: presence < 40 ? "Baixa" : presence < 65 ? "Média" : "Alta",
    visibilityMeter: presence
  };
}

function getOrCreateSnapshot({ company, region, segmentKey, radius }) {
  const segment = RADAR_SEGMENTS[segmentKey];
  const snapshotKey = getSnapshotKey({ company, region, segmentKey, radius });
  const store = loadSnapshotStore();

  if (store[snapshotKey]?.data) {
    const existing = store[snapshotKey].data;
    saveCurrentReport(existing);
    return existing;
  }

  /*
    O seed é a própria identidade da análise.
    Mesmo sem localStorage, os mesmos inputs reproduzem os mesmos indicadores.
  */
  const rng = createSeededRandom(`${METHOD_VERSION}|${snapshotKey}`);
  const simulation = buildSimulation(segmentKey, radius, rng);

  const reportData = {
    ...simulation,
    company,
    region,
    segmentKey,
    segmentLabel: segment.label,
    radius,
    snapshotKey,
    snapshotId: getSnapshotId(snapshotKey),
    analysisDate: new Date().toISOString(),
    methodVersion: METHOD_VERSION
  };

  store[snapshotKey] = {
    createdAt: reportData.analysisDate,
    version: 1,
    data: reportData
  };

  saveSnapshotStore(store);
  saveCurrentReport(reportData);
  return reportData;
}

async function runLoadingSequence(company, region) {
  const steps = [
    { title: "Mapeando a região...", text: `Localizando ${company} e delimitando o cenário em ${region}.`, progress: 22 },
    { title: "Identificando intenções de busca...", text: "Organizando os principais tipos de procura relacionados ao segmento.", progress: 48 },
    { title: "Comparando presença e concorrência...", text: "Estimando o nível de disputa e visibilidade na área analisada.", progress: 74 },
    { title: "Calculando o score local...", text: "Consolidando demanda, presença, autoridade e confiança.", progress: 100 }
  ];

  loadingSteps.forEach(step => step.classList.remove("active", "done"));
  progressBar.style.width = "5%";

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    loadingTitle.textContent = step.title;
    loadingText.textContent = step.text;
    progressBar.style.width = `${step.progress}%`;

    loadingSteps.forEach((element, elementIndex) => {
      element.classList.remove("active");
      if (elementIndex < index) element.classList.add("done");
      if (elementIndex === index) element.classList.add("active");
    });

    await wait(550);
  }

  await wait(220);
  loadingSteps.forEach(step => {
    step.classList.remove("active");
    step.classList.add("done");
  });
}

function renderKeywords(keywordData) {
  const list = document.getElementById("keywordsList");
  const maxVolume = Math.max(...keywordData.map(item => item.volume));
  list.innerHTML = "";

  keywordData.forEach((item, index) => {
    const width = Math.max(22, Math.round((item.volume / maxVolume) * 100));
    const row = document.createElement("div");
    row.className = "keyword-row result-enter";
    row.style.animationDelay = `${index * 55}ms`;
    row.innerHTML = `
      <div class="keyword-name">${item.keyword}</div>
      <div class="keyword-bar"><span style="--target-width:${width}%"></span></div>
      <div class="keyword-volume"><strong>${formatNumber(item.volume)}</strong><span>estimativa/mês</span></div>
    `;
    list.appendChild(row);
  });

  requestAnimationFrame(() => {
    [...list.querySelectorAll(".keyword-bar span")].forEach(bar => {
      bar.style.width = bar.style.getPropertyValue("--target-width");
    });
  });
}

function renderSimulation(data) {
  const company = data.company;
  const region = data.region;
  const radius = data.radius;
  const segment = RADAR_SEGMENTS[data.segmentKey];

  document.getElementById("resultsTitle").textContent = `Análise de ${company}`;
  document.getElementById("resultsSubtitle").textContent = `${segment.label} • ${region} • raio de ${radius} km`;
  document.getElementById("weeklyDemand").textContent = formatNumber(data.weekly);
  document.getElementById("monthlyDemand").textContent = formatNumber(data.monthly);
  document.getElementById("presenceScore").textContent = data.presence;
  document.getElementById("presenceLabel").textContent = getScoreLabel(data.presence);
  document.getElementById("uncapturedDemand").textContent = `${data.uncaptured}%`;
  document.getElementById("mainScore").textContent = data.overall;
  document.getElementById("scoreStatus").textContent = getScoreLabel(data.overall);
  document.getElementById("scoreMessage").textContent =
    data.overall < 40
      ? "Existe uma lacuna relevante entre a procura estimada e a capacidade atual de captura local."
      : data.overall < 70
        ? "A empresa já possui sinais positivos, mas ainda existe espaço importante para transformar presença em mais oportunidade."
        : "A presença estimada é consistente, com oportunidades pontuais de refinamento.";

  document.getElementById("googleScore").textContent = data.googleScore;
  document.getElementById("authorityScore").textContent = data.authorityScore;
  document.getElementById("reviewsScore").textContent = data.reviewsScore;
  document.getElementById("demandLevel").textContent = data.demandLevel;
  document.getElementById("competitionLevel").textContent = data.competitionLevel;
  document.getElementById("visibilityLevel").textContent = data.visibilityLevel;
  document.getElementById("keywordsCount").textContent = `${data.keywordData.length} termos`;

  document.getElementById("systemReading").textContent =
    data.presence < 45
      ? "Existe procura relevante na região, mas a presença estimada do negócio ainda é baixa para capturar essa oportunidade."
      : "A empresa já possui alguma presença, porém ainda existem lacunas que podem transferir oportunidades para concorrentes.";

  document.getElementById("captureStatus").textContent =
    data.uncaptured > 65
      ? "alto espaço para recuperação"
      : data.uncaptured > 45
        ? "espaço relevante para evolução"
        : "captura parcialmente estruturada";

  const presenceThermometer = document.getElementById("presenceThermometer");
  const demandMeter = document.getElementById("demandMeter");
  const competitionMeter = document.getElementById("competitionMeter");
  const visibilityMeter = document.getElementById("visibilityMeter");
  const scoreGauge = document.getElementById("scoreGauge");

  presenceThermometer.style.width = "0%";
  demandMeter.style.width = "0%";
  competitionMeter.style.width = "0%";
  visibilityMeter.style.width = "0%";

  const degrees = Math.round((data.overall / 100) * 360);
  scoreGauge.style.background = `conic-gradient(#1a73e8 0deg ${degrees}deg, #edf1f6 ${degrees}deg 360deg)`;

  setTimeout(() => {
    presenceThermometer.style.width = `${data.presence}%`;
    demandMeter.style.width = `${data.demandMeter}%`;
    competitionMeter.style.width = `${data.competitionMeter}%`;
    visibilityMeter.style.width = `${data.visibilityMeter}%`;
  }, 150);

  renderKeywords(data.keywordData);

  [...resultsSection.querySelectorAll(".metric-card, .panel, .solution-banner, .report-generation-card")]
    .forEach((element, index) => {
      element.classList.remove("result-enter");
      void element.offsetWidth;
      element.classList.add("result-enter");
      element.style.animationDelay = `${Math.min(index * 60, 420)}ms`;
    });
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const formData = new FormData(form);
  const company = String(formData.get("company") || "").trim();
  const region = String(formData.get("region") || "").trim();
  const segmentKey = String(formData.get("segment") || "");
  const radius = String(formData.get("radius") || "3");

  if (!company || !region || !segmentKey || !RADAR_SEGMENTS[segmentKey]) return;

  const data = getOrCreateSnapshot({ company, region, segmentKey, radius });

  resultsSection.classList.add("hidden");
  loadingSection.classList.remove("hidden");
  loadingSection.scrollIntoView({ behavior: "smooth", block: "center" });

  await runLoadingSequence(company, region);

  loadingSection.classList.add("hidden");
  renderSimulation(data);
  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

if (generateReportBtn) {
  generateReportBtn.addEventListener("click", () => {
    const report = localStorage.getItem(CURRENT_REPORT_KEY);
    if (!report) {
      alert("Faça uma análise antes de gerar o diagnóstico.");
      return;
    }
    window.location.href = "proposta.html";
  });
}

newAnalysisBtn.addEventListener("click", () => {
  resultsSection.classList.add("hidden");
  document.querySelector(".search-panel").scrollIntoView({ behavior: "smooth", block: "center" });
});
