/* =========================================================
   RADAR LOCAL — DIAGNÓSTICO V4
   Objetivo: conscientizar e gerar uma call de 10 minutos.
   Sem preço, sem proposta e sem exposição da solução.
========================================================= */

const proposalRaw = localStorage.getItem("radarProposal");
let proposalData = null;

try {
  proposalData = proposalRaw ? JSON.parse(proposalRaw) : null;
} catch (error) {
  console.error("Erro ao carregar diagnóstico:", error);
}

const printButton = document.getElementById("printButton");
const backButton = document.getElementById("backButton");
const RADAR_WHATSAPP_NUMBER = "5511970349654";

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTheme(data) {
  const key = safeText(data?.segmentKey, "").toLowerCase();
  const label = safeText(data?.segmentLabel, "").toLowerCase();
  const match = key || label;

  if (match.includes("podolog")) {
    return { accent: "#2f8b73", dark: "#236753", soft: "#e8f3ef" };
  }
  if (match.includes("odont")) {
    return { accent: "#3d7fa6", dark: "#2c617f", soft: "#e8f1f6" };
  }
  if (match.includes("estet") || match.includes("beleza") || match.includes("salão") || match.includes("salao")) {
    return { accent: "#9a5a76", dark: "#734057", soft: "#f3e8ed" };
  }
  if (match.includes("energia")) {
    return { accent: "#b37d27", dark: "#845b1b", soft: "#f7efdf" };
  }
  return { accent: "#667085", dark: "#48515f", soft: "#eceff3" };
}

function applyTheme(data) {
  const theme = getTheme(data);
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-dark", theme.dark);
  root.style.setProperty("--accent-soft", theme.soft);
}

function getDemandLevel(monthly, fallback) {
  if (fallback) return fallback;
  const value = Number(monthly) || 0;
  if (value >= 120) return "Alta";
  if (value >= 70) return "Relevante";
  if (value >= 35) return "Moderada";
  return "Pontual";
}

function getDemandMeter(monthly, fallback) {
  if (Number.isFinite(Number(fallback))) return clamp(fallback, 25, 94);
  const value = Number(monthly) || 0;
  if (value >= 120) return 88;
  if (value >= 70) return 72;
  if (value >= 35) return 55;
  return 38;
}

function getScoreHeadline(score) {
  if (score < 40) return "Existe uma lacuna importante entre procura e captura.";
  if (score < 65) return "Existe espaço relevante para transformar presença em mais oportunidade.";
  if (score < 80) return "A base é positiva, mas ainda há pontos que podem transferir oportunidades aos concorrentes.";
  return "A presença é forte, com oportunidades pontuais de refinamento.";
}

function getExecutiveStatement(data) {
  const score = Number(data?.overall ?? data?.presence ?? 0);
  const monthly = Number(data?.monthly || 0);
  if (monthly >= 70 && score < 60) {
    return "O problema não parece ser falta de mercado. Existe procura, mas a capacidade atual de capturar essa oportunidade ainda pode evoluir.";
  }
  if (score < 45) {
    return "Há sinais de procura na região e uma diferença relevante entre estar presente e estar preparado para ser escolhido.";
  }
  return "A empresa já possui sinais positivos de presença, mas ainda existem pontos que podem estar desviando oportunidades antes do contato.";
}

function getPillars(data) {
  const discovery = clamp(data?.googleScore ?? data?.presence ?? data?.overall, 0, 100);
  const authority = clamp(data?.authorityScore ?? data?.presence ?? data?.overall, 0, 100);
  const trust = clamp(data?.reviewsScore ?? data?.presence ?? data?.overall, 0, 100);

  return [
    {
      key: "discovery",
      title: "Descoberta local",
      score: discovery,
      description: "A facilidade estimada de ser percebido no momento em que alguém procura pelo serviço na região."
    },
    {
      key: "authority",
      title: "Autoridade percebida",
      score: authority,
      description: "Os sinais que ajudam o potencial cliente a entender, comparar e considerar o negócio como uma opção."
    },
    {
      key: "trust",
      title: "Confiança pública",
      score: trust,
      description: "Os sinais de segurança e confiança que reduzem a dúvida antes de a pessoa iniciar uma conversa."
    }
  ];
}

function getAnalysisId(data) {
  if (data?.snapshotId) return String(data.snapshotId).toUpperCase();
  const base = `${safeText(data?.company, "empresa")}|${safeText(data?.region, "regiao")}|${safeText(data?.segmentKey, data?.segmentLabel)}|${safeText(data?.radius, "3")}`;
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `RL-${(hash >>> 0).toString(36).slice(0, 7).toUpperCase()}`;
}

function renderKeywords(data) {
  const container = byId("keywordChips");
  if (!container) return;
  const items = Array.isArray(data?.keywordData) ? data.keywordData : [];
  container.innerHTML = "";
  items.slice(0, 6).forEach(item => {
    const chip = document.createElement("span");
    chip.textContent = safeText(item?.keyword, "busca local");
    container.appendChild(chip);
  });
}

function getReportWhatsappUrl() {
  const company = safeText(proposalData?.company, "minha empresa");
  const message = `Oi Diego, vi o diagnóstico da ${company} e quero entender como corrigir os pontos que vocês encontraram.`;
  return `https://wa.me/${RADAR_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function renderReport() {
  if (!proposalData) {
    alert("Nenhuma análise foi encontrada. Faça uma análise no Radar Local antes de gerar o diagnóstico.");
    window.location.href = "index.html";
    return;
  }

  applyTheme(proposalData);

  const company = safeText(proposalData.company, "Sua empresa");
  const segment = safeText(proposalData.segmentLabel, "Negócio local");
  const region = safeText(proposalData.region, "Sua região");
  const radius = safeText(proposalData.radius, "3");
  const monthly = Number(proposalData.monthly) || 0;
  const weekly = Number(proposalData.weekly) || 0;
  const overall = clamp(proposalData.overall ?? proposalData.presence, 0, 100);
  const uncaptured = clamp(proposalData.uncaptured ?? (100 - overall), 0, 100);
  const pillars = getPillars(proposalData);
  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];
  const analysisId = getAnalysisId(proposalData);

  document.title = `Diagnóstico de Oportunidade Local — ${company}`;
  document.querySelectorAll("[data-company]").forEach(el => { el.textContent = company; });

  setText("analysisId", `RADAR • ${analysisId}`);
  setText("companyNameHero", company);
  setText("companyNameCard", company);
  setText("segmentHero", segment);
  setText("regionHero", region);
  setText("radiusHero", `${radius} km`);
  setText("coverDescription", `Analisamos o cenário de ${segment.toLowerCase()} em ${region} para entender quanto da procura local pode estar passando sem chegar até a ${company}.`);
  setText("executiveStatement", getExecutiveStatement(proposalData));

  setText("monthlyDemand", formatNumber(monthly));
  setText("weeklyDemand", formatNumber(weekly));
  setText("demandLevelLabel", getDemandLevel(monthly, proposalData.demandLevel));
  setText("competitionLevel", safeText(proposalData.competitionLevel, "Relevante"));
  setText("demandIntro", `O Radar estimou sinais de procura por serviços de ${segment.toLowerCase()} dentro do raio analisado em ${region}.`);
  const demandMeter = byId("demandMeter");
  if (demandMeter) demandMeter.style.width = `${getDemandMeter(monthly, proposalData.demandMeter)}%`;
  renderKeywords(proposalData);

  setText("overallScore", overall);
  setText("scoreHeadline", getScoreHeadline(overall));
  const scoreRing = byId("scoreRing");
  if (scoreRing) {
    const degrees = Math.round((overall / 100) * 360);
    scoreRing.style.background = `conic-gradient(var(--accent) 0deg ${degrees}deg, #ece8e3 ${degrees}deg 360deg)`;
  }

  setText("discoveryScore", pillars[0].score);
  setText("authorityScore", pillars[1].score);
  setText("trustScore", pillars[2].score);
  [["discoveryMeter", pillars[0].score], ["authorityMeter", pillars[1].score], ["trustMeter", pillars[2].score]].forEach(([id, score]) => {
    const meter = byId(id);
    if (meter) meter.style.width = `${score}%`;
  });

  setText("uncapturedDemand", `${uncaptured}%`);
  setText("uncapturedText", uncaptured >= 65
    ? "A leitura indica uma distância importante entre a procura estimada e a capacidade atual de transformar essa atenção em oportunidade de contato."
    : uncaptured >= 45
      ? "Existe espaço relevante para melhorar a forma como a presença local transforma procura em consideração e contato."
      : "A empresa já captura parte da oportunidade, mas ainda há pontos que podem ser refinados para reduzir perdas no caminho.");

  setText("weakestScore", weakest.score);
  setText("weakestTitle", weakest.title);
  setText("weakestDescription", weakest.description);
  setText("businessReading", `Na ${company}, o ponto com maior espaço estimado para evolução é ${weakest.title.toLowerCase()}. Isso pode fazer parte da oportunidade se perder antes mesmo de o cliente iniciar uma conversa.`);

  const whatsappButton = byId("whatsappReportBtn");
  if (whatsappButton) whatsappButton.href = getReportWhatsappUrl();
}

function getPdfFileName() {
  const cleanCompany = safeText(proposalData?.company, "Empresa")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return `Diagnóstico de Oportunidade Local - ${cleanCompany}.pdf`;
}

async function generateVisualPdf() {
  if (typeof html2canvas === "undefined" || !window.jspdf) {
    throw new Error("As bibliotecas de PDF não foram carregadas.");
  }

  if (document.fonts?.ready) await document.fonts.ready;

  document.body.classList.add("pdf-exporting");
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const pages = Array.from(document.querySelectorAll(".pdf-page"));
    if (!pages.length) throw new Error("Nenhuma página do diagnóstico foi encontrada.");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWidth = 210;
    const pageHeight = 297;

    pdf.setProperties({
      title: `Diagnóstico de Oportunidade Local — ${safeText(proposalData?.company, "Empresa")}`,
      subject: "Análise de oportunidade e capacidade de captura local",
      author: "Radar Local",
      creator: "Radar Local",
      keywords: `Radar Local, oportunidade local, ${safeText(proposalData?.segmentLabel, "negócio local")}`
    });

    for (let index = 0; index < pages.length; index++) {
      if (index > 0) pdf.addPage("a4", "portrait");
      const page = pages[index];
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#fbfaf8",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123
      });

      const imageData = canvas.toDataURL("image/jpeg", 0.94);
      pdf.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

      if (page.classList.contains("cta-page")) {
        const button = page.querySelector("#whatsappReportBtn");
        if (button) {
          const pageRect = page.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const x = ((buttonRect.left - pageRect.left) / pageRect.width) * pageWidth;
          const y = ((buttonRect.top - pageRect.top) / pageRect.height) * pageHeight;
          const w = (buttonRect.width / pageRect.width) * pageWidth;
          const h = (buttonRect.height / pageRect.height) * pageHeight;
          pdf.link(x, y, w, h, { url: getReportWhatsappUrl() });
        }
      }

      canvas.width = 1;
      canvas.height = 1;
    }

    return pdf;
  } finally {
    document.body.classList.remove("pdf-exporting");
  }
}

async function deliverPdf(pdf) {
  const fileName = getPdfFileName();
  const pdfBlob = pdf.output("blob");

  try {
    if (typeof File !== "undefined" && navigator.share) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      const canShare = !navigator.canShare || navigator.canShare({ files: [file] });
      if (canShare) {
        await navigator.share({
          title: `Diagnóstico de Oportunidade Local — ${safeText(proposalData?.company, "Empresa")}`,
          text: `Segue o diagnóstico personalizado preparado pelo Radar Local para ${safeText(proposalData?.company, "a empresa")}.`,
          files: [file]
        });
        return;
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.warn("Compartilhamento direto não disponível:", error);
  }

  const pdfUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement("a");
  anchor.href = pdfUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 5000);
}

if (printButton) {
  printButton.addEventListener("click", async () => {
    const originalText = printButton.textContent;
    try {
      printButton.disabled = true;
      printButton.textContent = "Gerando PDF...";
      await new Promise(resolve => setTimeout(resolve, 100));
      const pdf = await generateVisualPdf();
      printButton.textContent = "PDF pronto";
      await deliverPdf(pdf);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF. Atualize a página e tente novamente.");
    } finally {
      printButton.disabled = false;
      printButton.textContent = originalText;
    }
  });
}

if (backButton) {
  backButton.addEventListener("click", () => { window.location.href = "index.html"; });
}

renderReport();
