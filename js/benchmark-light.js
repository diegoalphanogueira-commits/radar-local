/* =========================================================
   RADAR LOCAL — BENCHMARK PREMIUM V2
   Leitura consultiva, leve e responsiva.
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
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
  };

  const rating = value => {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    }).format(n);
  };

  const distance = meters => {
    const n = Number(meters);
    if (!Number.isFinite(n)) return "—";
    if (n < 1000) return `${Math.round(n)} m`;
    return `${(n / 1000).toFixed(1).replace(".", ",")} km`;
  };

  const icon = name => {
    const icons = {
      globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z"></path></svg>`,
      phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 10 7.8 8.3 9.4c1.1 2.4 3 4.3 5.4 5.4l1.6-1.7 4.3 2.8-.8 3.3c-.2.8-.9 1.3-1.7 1.3C9.6 20.5 3.5 14.4 3.5 6.9c0-.8.5-1.5 1.3-1.7l2.4-.7Z"></path></svg>`,
      clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3.5 2"></path></svg>`,
      pin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>`
    };
    return icons[name] || "";
  };

  const injectStyles = () => {
    const old = document.getElementById("radarBenchmarkLightStyles");
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = "radarBenchmarkLightStyles";
    style.textContent = `
      .benchmark-light-page {
        --bl-ink:#101828;
        --bl-muted:#667085;
        --bl-border:#e4e7ec;
        --bl-blue:#2f6bff;
        --bl-blue-soft:#eef4ff;
        --bl-gold:#d99a00;
        --bl-gold-soft:#fff8e6;
        --bl-green:#1f9d63;
        --bl-green-soft:#ecfdf3;
        background:
          radial-gradient(circle at 92% 5%, rgba(47,107,255,.08), transparent 25%),
          #f8fafc;
        color:var(--bl-ink);
      }

      .benchmark-light-page,
      .benchmark-light-page * {
        box-sizing:border-box;
      }

      .benchmark-light-page .bl-hero {
        margin:32px 0 24px;
        max-width:690px;
      }

      .benchmark-light-page .bl-eyebrow,
      .benchmark-light-page .bl-label,
      .benchmark-light-page .bl-section-label {
        display:block;
        color:var(--bl-blue);
        font-size:10.5px;
        font-weight:850;
        letter-spacing:.9px;
        text-transform:uppercase;
      }

      .benchmark-light-page .bl-hero h2 {
        margin:8px 0 10px;
        color:var(--bl-ink);
        font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
        font-size:38px;
        font-weight:850;
        line-height:1.04;
        letter-spacing:-1.8px;
      }

      .benchmark-light-page .bl-hero h2 em {
        color:var(--bl-blue);
        font-style:normal;
      }

      .benchmark-light-page .bl-hero p {
        margin:0;
        color:var(--bl-muted);
        font-size:14px;
        line-height:1.55;
      }

      .benchmark-light-page .bl-source {
        display:inline-flex;
        align-items:center;
        gap:7px;
        margin-top:14px;
        padding:8px 12px;
        border:1px solid #d9e4f7;
        border-radius:999px;
        background:#fff;
        color:#516178;
        font-size:10.5px;
        font-weight:800;
        letter-spacing:.55px;
        text-transform:uppercase;
      }

      .benchmark-light-page .bl-source::before {
        content:"";
        width:7px;
        height:7px;
        border-radius:50%;
        background:#4285f4;
        box-shadow:10px 0 0 #34a853,20px 0 0 #fbbc05,30px 0 0 #ea4335;
        margin-right:30px;
      }

      .bl-compare {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
        margin-bottom:14px;
      }

      .bl-card {
        position:relative;
        overflow:hidden;
        min-height:176px;
        padding:20px;
        border:1px solid var(--bl-border);
        border-radius:22px;
        background:#fff;
        box-shadow:0 7px 24px rgba(16,24,40,.035);
      }

      .bl-card.subject::before,
      .bl-card.market::before {
        content:"";
        position:absolute;
        inset:0 auto 0 0;
        width:4px;
      }

      .bl-card.subject::before { background:var(--bl-blue); }
      .bl-card.market::before { background:var(--bl-gold); }

      .bl-card h3 {
        margin:7px 0 17px;
        color:var(--bl-ink);
        font-size:18px;
        font-weight:800;
        line-height:1.25;
      }

      .bl-market-count {
        margin:7px 0 17px;
        color:var(--bl-ink);
        font-size:18px;
        font-weight:800;
      }

      .bl-metrics {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:14px;
      }

      .bl-metric {
        display:flex;
        align-items:center;
        gap:11px;
        min-width:0;
      }

      .bl-metric-icon {
        display:grid;
        place-items:center;
        flex:0 0 auto;
        width:38px;
        height:38px;
        border-radius:12px;
        background:var(--bl-gold-soft);
        color:var(--bl-gold);
        font-size:20px;
        line-height:1;
      }

      .bl-metric-icon.blue {
        background:var(--bl-blue-soft);
        color:var(--bl-blue);
      }

      .bl-metric-copy strong {
        display:block;
        color:var(--bl-ink);
        font-size:30px;
        font-weight:850;
        line-height:1;
        letter-spacing:-1.1px;
      }

      .bl-metric-copy span {
        display:block;
        margin-top:5px;
        color:var(--bl-muted);
        font-size:11.5px;
        line-height:1.35;
      }

      .bl-gap {
        display:grid;
        grid-template-columns:auto 1fr;
        align-items:center;
        gap:18px;
        margin-bottom:14px;
        padding:19px 21px;
        border:1px solid #f1d78e;
        border-radius:22px;
        background:linear-gradient(135deg,#fffaf0,#fff7df);
      }

      .bl-gap.positive {
        border-color:#b9e5ce;
        background:linear-gradient(135deg,#f4fff8,#ecfdf3);
      }

      .bl-gap-number {
        display:grid;
        place-items:center;
        min-width:76px;
        min-height:76px;
        padding:10px;
        border-radius:20px;
        background:#fff;
        color:var(--bl-gold);
        box-shadow:0 6px 20px rgba(16,24,40,.05);
        font-size:38px;
        font-weight:850;
        line-height:1;
        letter-spacing:-1.5px;
      }

      .bl-gap.positive .bl-gap-number { color:var(--bl-green); }

      .bl-gap-copy strong {
        display:block;
        margin-top:5px;
        color:var(--bl-ink);
        font-size:18px;
        font-weight:800;
        line-height:1.28;
      }

      .bl-gap-copy p {
        margin:5px 0 0;
        color:#626d7e;
        font-size:12.5px;
        line-height:1.5;
      }

      .bl-market {
        margin-bottom:14px;
        padding:19px;
        border:1px solid var(--bl-border);
        border-radius:22px;
        background:#fff;
      }

      .bl-market-head {
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
      }

      .bl-market-head p {
        margin:5px 0 0;
        color:var(--bl-muted);
        font-size:12px;
        line-height:1.45;
      }

      .bl-coverage {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:14px;
      }

      .bl-coverage-item {
        display:grid;
        grid-template-columns:40px 1fr;
        align-items:center;
        gap:10px;
        padding:13px;
        border:1px solid #edf0f4;
        border-radius:16px;
        background:#fbfcfe;
      }

      .bl-coverage-icon {
        display:grid;
        place-items:center;
        width:40px;
        height:40px;
        border-radius:12px;
        background:var(--bl-green-soft);
        color:var(--bl-green);
      }

      .bl-coverage-icon svg,
      .bl-badge svg,
      .bl-distance svg {
        width:18px;
        height:18px;
        fill:none;
        stroke:currentColor;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
      }

      .bl-coverage-copy strong {
        display:block;
        color:var(--bl-ink);
        font-size:23px;
        font-weight:850;
        line-height:1;
      }

      .bl-coverage-copy span {
        display:block;
        margin-top:4px;
        color:var(--bl-muted);
        font-size:11px;
        line-height:1.3;
      }

      .bl-top {
        padding:19px;
        border:1px solid var(--bl-border);
        border-radius:22px;
        background:#fff;
      }

      .bl-top-head p {
        margin:5px 0 0;
        color:var(--bl-muted);
        font-size:12px;
        line-height:1.45;
      }

      .bl-top-list {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:14px;
      }

      .bl-competitor {
        position:relative;
        min-width:0;
        padding:15px;
        border:1px solid #e8ebf0;
        border-radius:17px;
        background:#fcfdff;
      }

      .bl-competitor-top {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .bl-rank {
        display:grid;
        place-items:center;
        width:28px;
        height:28px;
        border-radius:10px;
        background:var(--bl-blue-soft);
        color:var(--bl-blue);
        font-size:11px;
        font-weight:850;
      }

      .bl-distance {
        display:inline-flex;
        align-items:center;
        gap:4px;
        color:#7a8492;
        font-size:10.5px;
        font-weight:700;
      }

      .bl-distance svg { width:13px; height:13px; }

      .bl-competitor h4 {
        margin:10px 0 11px;
        color:var(--bl-ink);
        font-size:12.5px;
        font-weight:800;
        line-height:1.35;
        min-height:34px;
      }

      .bl-rating-row {
        display:flex;
        align-items:center;
        gap:7px;
        margin-bottom:10px;
      }

      .bl-stars {
        color:var(--bl-gold);
        font-size:16px;
        line-height:1;
        letter-spacing:1px;
      }

      .bl-rating-row strong {
        color:var(--bl-ink);
        font-size:14px;
      }

      .bl-rating-row span:last-child {
        color:var(--bl-muted);
        font-size:10.5px;
      }

      .bl-badges {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
      }

      .bl-badge {
        display:inline-flex;
        align-items:center;
        gap:4px;
        padding:5px 7px;
        border-radius:999px;
        background:#f2f4f7;
        color:#667085;
        font-size:9.5px;
        font-weight:750;
      }

      .bl-badge.on {
        background:var(--bl-green-soft);
        color:#168553;
      }

      .bl-badge svg { width:12px; height:12px; }

      .bl-method {
        margin:11px 0 0;
        color:#8a94a3;
        font-size:10.5px;
        line-height:1.45;
      }

      @media (max-width:720px) {
        .benchmark-light-page .bl-hero {
          margin:28px 0 21px;
        }

        .benchmark-light-page .bl-hero h2 {
          font-size:30px;
          line-height:1.06;
          letter-spacing:-1.2px;
        }

        .benchmark-light-page .bl-hero p {
          font-size:14px;
        }

        .bl-compare,
        .bl-top-list {
          grid-template-columns:1fr;
        }

        .bl-card {
          min-height:auto;
          padding:18px;
        }

        .bl-card h3,
        .bl-market-count {
          font-size:19px;
        }

        .bl-metric-copy strong {
          font-size:31px;
        }

        .bl-metric-copy span,
        .bl-gap-copy p,
        .bl-market-head p,
        .bl-top-head p {
          font-size:13px;
        }

        .bl-gap {
          grid-template-columns:auto 1fr;
          gap:14px;
          padding:17px;
        }

        .bl-gap-number {
          min-width:68px;
          min-height:68px;
          font-size:34px;
        }

        .bl-gap-copy strong {
          font-size:17px;
        }

        .bl-coverage {
          grid-template-columns:1fr;
        }

        .bl-coverage-item {
          padding:14px;
        }

        .bl-coverage-copy span {
          font-size:12.5px;
        }

        .bl-competitor h4 {
          min-height:0;
          font-size:14px;
        }

        .bl-rating-row strong {
          font-size:15px;
        }

        .bl-rating-row span:last-child,
        .bl-distance,
        .bl-badge,
        .bl-method {
          font-size:11.5px;
        }
      }

      @media (max-width:480px) {
        .bl-metrics {
          gap:10px;
        }

        .bl-metric {
          align-items:flex-start;
        }

        .bl-metric-icon {
          width:34px;
          height:34px;
          border-radius:10px;
          font-size:18px;
        }

        .bl-gap {
          grid-template-columns:1fr;
        }

        .bl-gap-number {
          width:max-content;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const renumber = () => {
    const labels = {
      benchmark:"02 · Benchmark competitivo",
      demand:"03 · Demanda local",
      map:"04 · Mapa de oportunidade local",
      score:"05 · Presença local",
      journey:"06 · Onde a oportunidade escapa",
      cta:"07 · Próximo passo"
    };

    document.querySelectorAll(".pdf-page").forEach((page, index) => {
      const footer = page.querySelector(".page-footer span:last-child");
      if (footer) footer.textContent = String(index + 1).padStart(2, "0");

      const key = page.getAttribute("data-page");
      const label = page.querySelector(".page-topline .page-label");
      if (label && labels[key]) label.textContent = labels[key];
    });
  };

  const renderStars = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return `<span class="bl-stars">☆</span>`;
    return `<span class="bl-stars">★</span>`;
  };

  const render = benchmarkOverride => {
    const proposal = readProposal();
    const benchmark = benchmarkOverride || proposal?.benchmark;
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
    const competitorCount = Number(sample.competitorCount);
    const marketCount = Number.isFinite(competitorCount)
      ? `${num(competitorCount)}${sample.capped ? "+" : ""}`
      : "—";

    const competitorCards = top.length
      ? top.map((item, index) => `
          <article class="bl-competitor">
            <div class="bl-competitor-top">
              <span class="bl-rank">${index + 1}</span>
              <span class="bl-distance">${icon("pin")}${distance(item?.distanceMeters)}</span>
            </div>
            <h4>${esc(item?.name || "Concorrente")}</h4>
            <div class="bl-rating-row">
              ${renderStars(item?.rating)}
              <strong>${rating(item?.rating)}</strong>
              <span>${num(item?.userRatingCount)} avaliações</span>
            </div>
            <div class="bl-badges">
              <span class="bl-badge ${item?.websiteUri ? "on" : ""}">${icon("globe")}${item?.websiteUri ? "Site" : "Sem site"}</span>
              <span class="bl-badge ${item?.phoneNumber ? "on" : ""}">${icon("phone")}${item?.phoneNumber ? "Telefone" : "Sem telefone"}</span>
            </div>
          </article>
        `).join("")
      : `<article class="bl-competitor"><h4>Sem dados suficientes para destacar concorrentes.</h4></article>`;

    page.classList.remove("benchmark-executive-page");
    page.classList.add("benchmark-light-page");

    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">02 · Benchmark competitivo</span>
        <span class="mini-company">${esc(proposal.company || "Sua empresa")}</span>
      </div>

      <div class="bl-hero">
        <span class="bl-eyebrow">Inteligência competitiva local</span>
        <h2>Como sua empresa se posiciona frente ao <em>mercado local.</em></h2>
        <p>Uma leitura rápida de reputação, presença digital e concorrentes próximos.</p>
        <span class="bl-source">Dados observados · Google</span>
      </div>

      <div class="bl-compare">
        <article class="bl-card subject">
          <span class="bl-label">Sua empresa</span>
          <h3>${esc(subject.name || proposal.company || "Empresa analisada")}</h3>
          <div class="bl-metrics">
            <div class="bl-metric">
              <span class="bl-metric-icon">★</span>
              <div class="bl-metric-copy">
                <strong>${rating(subject.rating)}</strong>
                <span>nota no Google</span>
              </div>
            </div>
            <div class="bl-metric">
              <span class="bl-metric-icon blue">✦</span>
              <div class="bl-metric-copy">
                <strong>${num(subject.userRatingCount)}</strong>
                <span>avaliações</span>
              </div>
            </div>
          </div>
        </article>

        <article class="bl-card market">
          <span class="bl-label">Mercado local observado</span>
          <div class="bl-market-count">${marketCount} concorrentes observados</div>
          <div class="bl-metrics">
            <div class="bl-metric">
              <span class="bl-metric-icon">★</span>
              <div class="bl-metric-copy">
                <strong>${rating(reputation.averageRating)}</strong>
                <span>nota média</span>
              </div>
            </div>
            <div class="bl-metric">
              <span class="bl-metric-icon blue">✦</span>
              <div class="bl-metric-copy">
                <strong>${num(reputation.medianReviews)}</strong>
                <span>mediana de avaliações</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <section class="bl-gap ${hasGap ? "attention" : "positive"}">
        <div class="bl-gap-number">${hasGap ? num(needed) : "✓"}</div>
        <div class="bl-gap-copy">
          <span class="bl-section-label">Leitura principal</span>
          <strong>${hasGap ? "Seu principal gap hoje está na prova social." : "Sua reputação está competitiva na amostra local."}</strong>
          <p>${hasGap
            ? `Sua nota transmite qualidade, mas faltam cerca de ${num(needed)} avaliações para alcançar a mediana observada no mercado local.`
            : "Sua base de avaliações já alcança ou supera a mediana observada. O próximo ganho tende a vir de presença e diferenciação local."}</p>
        </div>
      </section>

      <section class="bl-market">
        <div class="bl-market-head">
          <div>
            <span class="bl-section-label">Padrão digital do mercado</span>
            <p>Sinais básicos encontrados entre os concorrentes observados.</p>
          </div>
        </div>
        <div class="bl-coverage">
          <div class="bl-coverage-item">
            <span class="bl-coverage-icon">${icon("globe")}</span>
            <div class="bl-coverage-copy"><strong>${num(digital.websiteCoveragePercent)}%</strong><span>com site</span></div>
          </div>
          <div class="bl-coverage-item">
            <span class="bl-coverage-icon">${icon("phone")}</span>
            <div class="bl-coverage-copy"><strong>${num(digital.phoneCoveragePercent)}%</strong><span>com telefone</span></div>
          </div>
          <div class="bl-coverage-item">
            <span class="bl-coverage-icon">${icon("clock")}</span>
            <div class="bl-coverage-copy"><strong>${num(digital.openingHoursCoveragePercent)}%</strong><span>com horários</span></div>
          </div>
        </div>
      </section>

      <section class="bl-top">
        <div class="bl-top-head">
          <span class="bl-section-label">Quem está mais forte ao redor</span>
          <p>Três referências da amostra com maior volume de avaliações.</p>
        </div>
        <div class="bl-top-list">${competitorCards}</div>
      </section>

      <p class="bl-method">* Benchmark baseado na amostra retornada pelo Google Places no momento da análise. Não representa ranking oficial do Google nem necessariamente o total de empresas da região.</p>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>02</span></footer>
    `;

    renumber();
    return true;
  };

  window.addEventListener("radar:benchmark-ready", event => {
    setTimeout(() => render(event.detail), 20);
  });

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 40) clearInterval(timer);
  }, 250);
})();
