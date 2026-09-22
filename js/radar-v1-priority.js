/* Radar Local V1 — inteligencia de oportunidade e prioridade comercial */
(() => {
  "use strict";

  if (window.RadarV1Priority) return;
  window.RadarV1Priority = true;

  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const THIRD_PARTY = [
    "wa.me", "whatsapp.com", "instagram.com", "facebook.com", "linktr.ee",
    "linkr.bio", "trinks.com", "beacons.ai", "bio.site", "bit.ly", "cutt.ly"
  ];

  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  let filterHighOnly = false;
  let scheduled = false;

  function loadLeads() {
    try {
      const rows = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }

  function siteHost(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
    } catch { return ""; }
  }

  function isThirdParty(host) {
    return !!host && THIRD_PARTY.some(item => host === item || host.endsWith(`.${item}`));
  }

  function leadForCard(card, leads) {
    const name = card.querySelector("h3")?.textContent?.trim() || "";
    const address = card.querySelector(".v4-card-head p")?.textContent?.trim() || "";
    return leads.find(lead => normalize(lead.name) === normalize(name) && normalize(lead.address) === normalize(address))
      || leads.find(lead => normalize(lead.name) === normalize(name))
      || null;
  }

  function priorityFor(lead) {
    let score = 8;
    const reasons = [];
    const readiness = [];

    const host = siteHost(lead?.website || lead?.publicWebsite || "");
    const thirdParty = isThirdParty(host);
    const reviews = Number(lead?.reviews);
    const rating = Number(lead?.rating);
    const phone = digits(lead?.phone || lead?.publicPhone || lead?.companyPhone || "");
    const email = String(lead?.publicEmail || lead?.companyEmail || "").trim();
    const hasSocial = !!(lead?.instagram || lead?.facebook || lead?.linkedin || lead?.tiktok);
    const decision = lead?.decisionMaker?.name ? String(lead.decisionMaker.name).trim() : "";
    const confidence = String(lead?.decisionConfidence || lead?.revenueStatus || "").toLowerCase();

    if (!host) {
      score += 28;
      reasons.push("Sem site próprio");
    } else if (thirdParty) {
      score += 20;
      reasons.push("Depende de link de terceiros");
    }

    if (Number.isFinite(reviews)) {
      if (reviews < 20) {
        score += 20;
        reasons.push("Poucas avaliações no Google");
      } else if (reviews < 50) {
        score += 14;
        reasons.push("Avaliações ainda podem crescer");
      } else if (reviews < 100) {
        score += 7;
      }
    }

    if (Number.isFinite(rating) && rating > 0) {
      if (rating < 4.3) {
        score += 14;
        reasons.push("Reputação digital precisa de atenção");
      } else if (rating < 4.6) {
        score += 7;
      } else if (rating >= 4.8) {
        readiness.push("boa reputação");
      }
    }

    if (phone.length >= 10) {
      score += 12;
      readiness.push("telefone disponível");
    } else if (email) {
      score += 5;
      readiness.push("e-mail disponível");
    } else {
      score -= 8;
    }

    if (decision) {
      if (confidence === "safe" || confidence === "matched") {
        score += 12;
        readiness.push("decisor identificado");
      } else {
        score += 7;
        readiness.push("decisor provável");
      }
    }

    if (hasSocial) {
      score += 4;
      readiness.push("presença social encontrada");
    }

    if (!reasons.length) {
      if (!hasSocial) reasons.push("Presença digital pouco conectada");
      else if (Number.isFinite(reviews) && reviews < 100) reasons.push("Espaço para fortalecer presença local");
      else reasons.push("Oportunidade de otimização digital");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const level = score >= 60 ? "high" : score >= 40 ? "medium" : "low";
    const label = level === "high" ? "Prioridade alta" : level === "medium" ? "Prioridade média" : "Prioridade baixa";
    const summary = [...reasons.slice(0, 1), ...readiness.slice(0, 2)].join(" · ");

    return { score, level, label, summary, reasons, readiness };
  }

  function ensureFilter() {
    const toolbar = document.querySelector(".v4-toolbar");
    if (!toolbar || document.querySelector("#v1HighPriorityOnly")) return;

    const label = document.createElement("label");
    label.className = "v1-priority-filter";
    label.innerHTML = `<input id="v1HighPriorityOnly" type="checkbox"> Só prioridade alta`;
    toolbar.appendChild(label);
    label.querySelector("input")?.addEventListener("change", event => {
      filterHighOnly = !!event.target.checked;
      decorateAll();
    });
  }

  function decorateCard(card, lead) {
    if (!lead) return null;
    const info = priorityFor(lead);
    card.dataset.v1Priority = info.level;
    card.dataset.v1PriorityScore = String(info.score);

    let insight = card.querySelector("[data-v1-priority-insight]");
    if (!insight) {
      insight = document.createElement("div");
      insight.dataset.v1PriorityInsight = "1";
      insight.className = "v1-priority-insight";
      const signalRow = card.querySelector(".v4-signal-row");
      if (signalRow) signalRow.insertAdjacentElement("afterend", insight);
      else card.querySelector(".v4-data-grid")?.insertAdjacentElement("beforebegin", insight);
    }

    insight.className = `v1-priority-insight is-${info.level}`;
    insight.innerHTML = `
      <span class="v1-priority-badge">${info.label}</span>
      <span class="v1-priority-copy"><b>Por que abordar agora</b><em>${info.summary}</em></span>
      <strong class="v1-priority-number">${info.score}</strong>`;

    card.classList.toggle("v1-filter-hidden", filterHighOnly && info.level !== "high");
    return info;
  }

  function updateSummary(infos) {
    const head = document.querySelector(".v4-list-head");
    if (!head) return;
    let summary = head.querySelector("[data-v1-priority-summary]");
    if (!summary) {
      summary = document.createElement("span");
      summary.dataset.v1PrioritySummary = "1";
      summary.className = "v1-priority-summary";
      const sort = head.querySelector(".v4-sort-label");
      (sort || head).insertAdjacentElement(sort ? "beforebegin" : "beforeend", summary);
    }

    const counts = { high: 0, medium: 0, low: 0 };
    infos.forEach(info => { if (info?.level) counts[info.level] += 1; });
    summary.innerHTML = `<b>${counts.high}</b> altas <i>·</i> ${counts.medium} médias <i>·</i> ${counts.low} baixas`;

    const listCount = document.querySelector("#v4ListCount");
    if (listCount) {
      listCount.textContent = filterHighOnly
        ? `${counts.high} prioridade${counts.high === 1 ? "" : "s"} alta${counts.high === 1 ? "" : "s"}`
        : `${infos.length} empresa${infos.length === 1 ? "" : "s"}`;
    }
  }

  function applyMarkerFilter() {
    const visibleIndexes = new Set(
      [...document.querySelectorAll(".v4-lead-card")]
        .filter(card => !card.classList.contains("v1-filter-hidden"))
        .map(card => Number(card.dataset.cardIndex) + 1)
        .filter(Number.isFinite)
    );

    document.querySelectorAll(".v4-marker-shell").forEach(shell => {
      const index = Number(shell.querySelector(".v4-marker b")?.textContent || NaN);
      shell.classList.toggle("v1-filter-hidden", filterHighOnly && Number.isFinite(index) && !visibleIndexes.has(index));
    });
  }

  function decorateAll() {
    ensureFilter();
    const leads = loadLeads();
    const infos = [];
    document.querySelectorAll(".v4-lead-card").forEach(card => {
      const info = decorateCard(card, leadForCard(card, leads));
      if (info) infos.push(info);
    });
    updateSummary(infos);
    applyMarkerFilter();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateAll();
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("radar:maps-data-updated", () => setTimeout(schedule, 40));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();

  setInterval(schedule, 1800);
  console.info("[Radar Local] Priorizacao comercial V1 ativa.");
})();
