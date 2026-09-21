/* =========================================================
   RADAR LOCAL — BENCHMARK LIGHT
   Reorganiza a página de benchmark para leitura leve,
   confortável no desktop e no celular.
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

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const num = value => {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
  };

  const distance = meters => {
    const n = Number(meters);
    if (!Number.isFinite(n)) return "—";
    if (n < 1000) return `${Math.round(n)} m`;
    return `${(n / 1000).toFixed(1).replace(".", ",")} km`;
  };

  const injectStyles = () => {
    if (document.getElementById("radarBenchmarkLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarBenchmarkLightStyles";
    style.textContent = `
      .benchmark-light-page {
        background: radial-gradient(circle at 92% 6%, rgba(40,120,240,.08), transparent 25%), #fbfaf8;
      }

      .benchmark-light-page .bl-hero {
        margin: 34px 0 24px;
        max-width: 660px;
      }

      .benchmark-light-page .bl-hero h2 {
        margin: 8px 0 12px;
        color: #17191e;
        font-size: 36px;
        line-height: 1.04;
        letter-spacing: -1.7px;
      }

      .benchmark-light-page .bl-hero h2 em {
        color: #2878f0;
        font-style: normal;
      }

      .benchmark-light-page .bl-hero p {
        margin: 0;
        color: #667085;
        font-size: 13px;
        line-height: 1.55;
        max-width: 610px;
      }

      .benchmark-light-page .bl-source {
        display: inline-flex;
        margin-top: 14px;
        padding: 8px 12px;
        border: 1px solid #dbe6f6;
        border-radius: 999px;
        background: #f4f8ff;
        color: #45617e;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .55px;
        text-transform: uppercase;
      }

      .bl-compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 14px;
      }

      .bl-card {
        border: 1px solid #e1e6ed;
        border-radius: 20px;
        background: #fff;
        padding: 19px;
      }

      .bl-card.subject {
        border-color: #aecaFA;
        background: #f4f8ff;
      }

      .bl-card-label,
      .bl-section-label {
        color: #2878f0;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .7px;
        text-transform: uppercase;
      }

      .bl-card h3 {
        margin: 7px 0 16px;
        color: #20242b;
        font-size: 18px;
        line-height: 1.2;
      }

      .bl-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .bl-metric {
        min-width: 0;
      }

      .bl-metric strong {
        display: block;
        color: #171a20;
        font-size: 31px;
        line-height: 1;
        letter-spacing: -1px;
      }

      .subject .bl-metric strong { color: #1769e8; }

      .bl-metric span {
        display: block;
        margin-top: 7px;
        color: #667085;
        font-size: 11px;
        line-height: 1.35;
      }

      .bl-gap {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 18px;
        margin-bottom: 14px;
        padding: 18px 20px;
        border: 1px solid #f2c8c2;
        border-radius: 20px;
        background: #fff4f2;
      }

      .bl-gap-number {
        min-width: 84px;
        color: #d9483b;
        font-size: 42px;
        font-weight: 850;
        line-height: 1;
        letter-spacing: -1.8px;
      }

      .bl-gap-copy strong {
        display: block;
        color: #272a30;
        font-size: 17px;
        line-height: 1.3;
      }

      .bl-gap-copy p {
        margin: 5px 0 0;
        color: #6d7480;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .bl-market {
        margin-bottom: 14px;
        padding: 18px;
        border: 1px solid #e1e6ed;
        border-radius: 20px;
        background: #fff;
      }

      .bl-coverage {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 13px;
      }

      .bl-coverage-item {
        padding: 14px;
        border-radius: 15px;
        background: #f7f9fc;
      }

      .bl-coverage-item strong {
        display: block;
        color: #20242b;
        font-size: 23px;
        line-height: 1;
      }

      .bl-coverage-item span {
        display: block;
        margin-top: 6px;
        color: #687383;
        font-size: 10.5px;
        line-height: 1.35;
      }

      .bl-top {
        padding: 18px;
        border: 1px solid #e1e6ed;
        border-radius: 20px;
        background: #fff;
      }

      .bl-top-list {
        display: grid;
        gap: 9px;
        margin-top: 13px;
      }

      .bl-competitor {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        align-items: center;
        gap: 11px;
        padding: 11px 12px;
        border: 1px solid #edf0f4;
        border-radius: 14px;
        background: #fcfcfd;
      }

      .bl-rank {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #edf4ff;
        color: #2878f0;
        font-size: 11px;
        font-weight: 850;
      }

      .bl-competitor-name {
        min-width: 0;
      }

      .bl-competitor-name strong {
        display: block;
        color: #262a31;
        font-size: 11.5px;
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .bl-competitor-name span {
        display: block;
        margin-top: 3px;
        color: #7a8492;
        font-size: 10px;
      }

      .bl-review-count {
        text-align: right;
      }

      .bl-review-count strong {
        display: block;
        color: #20242b;
        font-size: 17px;
        line-height: 1;
      }

      .bl-review-count span {
        display: block;
        margin-top: 4px;
        color: #7d8795;
        font-size: 9.5px;
      }

      .bl-method {
        margin: 11px 0 0;
        color: #8b94a1;
        font-size: 9.5px;
        line-height: 1.4;
      }

      @media (max-width: 720px) {
        .benchmark-light-page .bl-hero {
          margin: 28px 0 20px;
        }

        .benchmark-light-page .bl-hero h2 {
          font-size: 31px;
          line-height: 1.06;
        }

        .benchmark-light-page .bl-hero p {
          font-size: 13.5px;
        }

        .bl-compare {
          grid-template-columns: 1fr;
        }

        .bl-card {
          padding: 18px;
        }

        .bl-card h3 {
          font-size: 19px;
        }

        .bl-metric strong {
          font-size: 32px;
        }

        .bl-metric span,
        .bl-gap-copy p,
        .bl-coverage-item span,
        .bl-competitor-name strong {
          font-size: 12px;
        }

        .bl-gap {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .bl-gap-number {
          font-size: 40px;
        }

        .bl-coverage {
          grid-template-columns: 1fr;
        }

        .bl-coverage-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .bl-coverage-item span {
          margin: 0;
          text-align: right;
        }

        .bl-competitor {
          grid-template-columns: 28px minmax(0, 1fr);
        }

        .bl-review-count {
          grid-column: 2;
          display: flex;
          align-items: baseline;
          gap: 5px;
          text-align: left;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const renumber = () => {
    const labels = {
      benchmark: "02 · Benchmark competitivo",
      demand: "03 · Demanda local",
      map: "04 · Mapa de oportunidade local",
      score: "05 · Presença local",
      journey: "06 · Onde a oportunidade escapa",
      cta: "07 · Próximo passo"
    };

    document.querySelectorAll(".pdf-page").forEach((page, index) => {
      const footer = page.querySelector(".page-footer span:last-child");
      if (footer) footer.textContent = String(index + 1).padStart(2, "0");

      const key = page.getAttribute("data-page");
      const label = page.querySelector(".page-topline .page-label");
      if (label && labels[key]) label.textContent = labels[key];
    });
  };

  const render = () => {
    const proposal = readProposal();
    const benchmark = proposal?.benchmark;
    const page = document.querySelector('[data-page="benchmark"]');
    if (!proposal || !benchmark || !page) return false;

    injectStyles();

    const subject = benchmark.subject || {};
    const reputation = benchmark.reputation || {};
    const digital = benchmark.digitalPresence || {};
    const sample = benchmark.sample || {};
    const top = Array.isArray(benchmark.topCompetitors)
      ? benchmark.topCompetitors.slice(0, 3)
      : [];

    const reviews = Number(subject.userRatingCount);
    const median = Number(reputation.medianReviews);
    const needed = Number(reputation.reviewsNeededToMedian);
    const hasGap = Number.isFinite(reviews) && Number.isFinite(median) && reviews < median;

    const competitorCards = top.length
      ? top.map((item, index) => `
          <div class="bl-competitor">
            <span class="bl-rank">${index + 1}</span>
            <div class="bl-competitor-name">
              <strong>${esc(item?.name || "Concorrente")}</strong>
              <span>★ ${num(item?.rating)} · ${distance(item?.distanceMeters)}</span>
            </div>
            <div class="bl-review-count">
              <strong>${num(item?.userRatingCount)}</strong>
              <span>avaliações</span>
            </div>
          </div>
        `).join("")
      : `<div class="bl-competitor"><div class="bl-competitor-name"><strong>Sem dados suficientes para destacar concorrentes.</strong></div></div>`;

    page.classList.add("benchmark-light-page");
    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">02 · Benchmark competitivo</span>
        <span class="mini-company">${esc(proposal.company || "Sua empresa")}</span>
      </div>

      <div class="bl-hero">
        <span class="eyebrow">Inteligência competitiva local</span>
        <h2>Como sua empresa se compara <em>ao mercado ao redor.</em></h2>
        <p>Uma leitura rápida de reputação, presença digital e concorrentes próximos.</p>
        <span class="bl-source">Dados observados · Google</span>
      </div>

      <div class="bl-compare">
        <article class="bl-card subject">
          <span class="bl-card-label">Sua empresa</span>
          <h3>${esc(proposal.company || "Empresa analisada")}</h3>
          <div class="bl-metrics">
            <div class="bl-metric">
              <strong>${num(subject.rating)}</strong>
              <span>nota no Google</span>
            </div>
            <div class="bl-metric">
              <strong>${num(subject.userRatingCount)}</strong>
              <span>avaliações</span>
            </div>
          </div>
        </article>

        <article class="bl-card">
          <span class="bl-card-label">Mercado local observado</span>
          <h3>${num(sample.competitorCount)} concorrentes</h3>
          <div class="bl-metrics">
            <div class="bl-metric">
              <strong>${num(reputation.averageRating)}</strong>
              <span>nota média</span>
            </div>
            <div class="bl-metric">
              <strong>${num(reputation.medianReviews)}</strong>
              <span>mediana de avaliações</span>
            </div>
          </div>
        </article>
      </div>

      <div class="bl-gap">
        <div class="bl-gap-number">${hasGap ? num(needed) : "OK"}</div>
        <div class="bl-gap-copy">
          <span class="bl-section-label">Leitura principal</span>
          <strong>${hasGap ? "O principal gap está na prova social." : "A reputação está competitiva na amostra local."}</strong>
          <p>${hasGap ? `Faltam cerca de ${num(needed)} avaliações para alcançar a mediana observada entre os concorrentes.` : "O próximo ganho tende a vir de diferenciação, descoberta local e consistência da presença digital."}</p>
        </div>
      </div>

      <article class="bl-market">
        <span class="bl-section-label">Padrão digital dos concorrentes</span>
        <div class="bl-coverage">
          <div class="bl-coverage-item"><strong>${num(digital.websiteCoveragePercent)}%</strong><span>possuem site</span></div>
          <div class="bl-coverage-item"><strong>${num(digital.phoneCoveragePercent)}%</strong><span>publicam telefone</span></div>
          <div class="bl-coverage-item"><strong>${num(digital.openingHoursCoveragePercent)}%</strong><span>têm horários configurados</span></div>
        </div>
      </article>

      <article class="bl-top">
        <span class="bl-section-label">Concorrentes com maior prova social</span>
        <div class="bl-top-list">${competitorCards}</div>
      </article>

      <p class="bl-method">Amostra observada via Google Places no momento da análise. Não representa ranking oficial do Google nem necessariamente o total de empresas da região.</p>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>02</span></footer>
    `;

    renumber();
    return true;
  };

  const run = () => {
    if (render()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (render() || attempts >= 40) clearInterval(timer);
    }, 250);
  };

  window.addEventListener("radar:benchmark-ready", () => setTimeout(render, 0));
  run();
})();
