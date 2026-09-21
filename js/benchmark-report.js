/* =========================================================
   RADAR LOCAL — BENCHMARK EXECUTIVO
   Insere uma página de inteligência competitiva no relatório
   usando somente o benchmark já devolvido pelo backend.
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

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const formatNumber = value => {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value));
  };

  const formatDistance = meters => {
    const value = Number(meters);
    if (!Number.isFinite(value)) return "—";
    if (value < 1000) return `${Math.round(value)} m`;
    return `${(value / 1000).toFixed(1).replace(".", ",")} km`;
  };

  const injectStyles = () => {
    if (document.getElementById("radarBenchmarkReportStyles")) return;

    const style = document.createElement("style");
    style.id = "radarBenchmarkReportStyles";
    style.textContent = `
      .benchmark-executive-page {
        background:
          radial-gradient(circle at 92% 8%, rgba(40,120,240,.09), transparent 27%),
          #fbfaf8;
      }

      .benchmark-executive-page .benchmark-hero {
        display:flex;
        justify-content:space-between;
        gap:28px;
        align-items:flex-end;
        margin:34px 0 26px;
      }

      .benchmark-executive-page .benchmark-hero-copy {
        max-width:560px;
      }

      .benchmark-executive-page .benchmark-hero h2 {
        margin:8px 0 10px;
        color:#16181d;
        font-size:34px;
        line-height:1.05;
        letter-spacing:-1.6px;
      }

      .benchmark-executive-page .benchmark-hero h2 em {
        color:#2878f0;
        font-style:normal;
      }

      .benchmark-executive-page .benchmark-hero p {
        margin:0;
        color:#667085;
        font-size:13px;
        line-height:1.6;
      }

      .benchmark-source-pill {
        flex:0 0 auto;
        padding:9px 13px;
        border:1px solid #dbe6f6;
        border-radius:999px;
        color:#45617e;
        background:#f5f9ff;
        font-size:10px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.7px;
      }

      .benchmark-kpis {
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:10px;
        margin-bottom:18px;
      }

      .benchmark-kpi {
        min-height:116px;
        padding:16px;
        border:1px solid #e3e8ef;
        border-radius:17px;
        background:#fff;
      }

      .benchmark-kpi span {
        display:block;
        color:#7a8492;
        font-size:9px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.7px;
      }

      .benchmark-kpi strong {
        display:block;
        margin-top:8px;
        color:#151922;
        font-size:28px;
        line-height:1;
        letter-spacing:-1px;
      }

      .benchmark-kpi small {
        display:block;
        margin-top:7px;
        color:#667085;
        font-size:9px;
        line-height:1.4;
      }

      .benchmark-kpi.primary {
        border-color:#bcd4fb;
        background:#f3f7ff;
      }

      .benchmark-kpi.primary strong { color:#1769e8; }

      .benchmark-insight {
        display:grid;
        grid-template-columns:1.15fr .85fr;
        gap:14px;
        margin-bottom:18px;
      }

      .benchmark-reading,
      .benchmark-digital {
        padding:18px;
        border:1px solid #e3e8ef;
        border-radius:18px;
        background:#fff;
      }

      .benchmark-reading > span,
      .benchmark-digital > span,
      .benchmark-top > span {
        color:#2878f0;
        font-size:9px;
        font-weight:850;
        text-transform:uppercase;
        letter-spacing:.8px;
      }

      .benchmark-reading strong {
        display:block;
        margin-top:9px;
        color:#20242b;
        font-size:17px;
        line-height:1.35;
      }

      .benchmark-reading p {
        margin:8px 0 0;
        color:#667085;
        font-size:10px;
        line-height:1.55;
      }

      .benchmark-digital-list {
        display:grid;
        gap:10px;
        margin-top:12px;
      }

      .benchmark-digital-row {
        display:grid;
        grid-template-columns:88px 1fr 42px;
        align-items:center;
        gap:8px;
        color:#556070;
        font-size:9px;
        font-weight:650;
      }

      .benchmark-digital-row b {
        color:#20242b;
        text-align:right;
      }

      .benchmark-track {
        height:6px;
        overflow:hidden;
        border-radius:999px;
        background:#edf1f5;
      }

      .benchmark-track i {
        display:block;
        height:100%;
        border-radius:999px;
        background:#2878f0;
      }

      .benchmark-top {
        padding:18px;
        border:1px solid #e3e8ef;
        border-radius:18px;
        background:#fff;
      }

      .benchmark-table {
        width:100%;
        margin-top:12px;
        border-collapse:collapse;
        table-layout:fixed;
      }

      .benchmark-table th {
        padding:0 8px 7px;
        color:#98a1ad;
        font-size:8px;
        font-weight:800;
        text-align:left;
        text-transform:uppercase;
        letter-spacing:.5px;
      }

      .benchmark-table td {
        padding:8px;
        border-top:1px solid #edf0f4;
        color:#4e5968;
        font-size:9px;
        vertical-align:middle;
      }

      .benchmark-table td:first-child {
        color:#20242b;
        font-weight:750;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .benchmark-table .star { color:#f9ab00; font-weight:850; }

      .benchmark-method-note {
        margin:12px 0 0;
        color:#8b94a1;
        font-size:8px;
        line-height:1.45;
      }
    `;

    document.head.appendChild(style);
  };

  const buildReading = (proposal, benchmark) => {
    const subject = benchmark?.subject || {};
    const reputation = benchmark?.reputation || {};
    const reviews = Number(subject?.userRatingCount);
    const median = Number(reputation?.medianReviews);
    const needed = Number(reputation?.reviewsNeededToMedian);

    if (Number.isFinite(reviews) && Number.isFinite(median) && reviews < median) {
      return {
        title: `A nota é positiva, mas a prova social está abaixo do padrão local observado.`,
        text: `${escapeHtml(proposal?.company || "A empresa")} possui ${formatNumber(reviews)} avaliação(ões), enquanto a mediana entre os concorrentes avaliados é ${formatNumber(median)}. Para alcançar essa mediana, seriam necessárias aproximadamente ${formatNumber(needed)} novas avaliações.`
      };
    }

    return {
      title: `A reputação está competitiva dentro da amostra local observada.`,
      text: `O próximo passo é transformar essa base em maior diferenciação de presença, confiança e descoberta local.`
    };
  };

  const renumberPages = () => {
    const labelMap = {
      demand: "02 · Demanda local",
      map: "03 · Mapa de oportunidade local",
      score: "04 · Presença local",
      journey: "05 · Onde a oportunidade escapa",
      cta: "06 · Próximo passo"
    };

    document.querySelectorAll(".pdf-page").forEach((page, index) => {
      const footerNumber = page.querySelector(".page-footer span:last-child");
      if (footerNumber) footerNumber.textContent = String(index + 1).padStart(2, "0");

      const key = page.getAttribute("data-page");
      const label = page.querySelector(".page-topline .page-label");
      if (label && labelMap[key]) label.textContent = labelMap[key];
    });
  };

  const render = benchmarkOverride => {
    const proposal = readProposal();
    const benchmark = benchmarkOverride || proposal?.benchmark;
    if (!proposal || !benchmark) return false;

    injectStyles();

    const existing = document.querySelector('[data-page="benchmark"]');
    if (existing) existing.remove();

    const subject = benchmark.subject || {};
    const reputation = benchmark.reputation || {};
    const digital = benchmark.digitalPresence || {};
    const sample = benchmark.sample || {};
    const top = Array.isArray(benchmark.topCompetitors) ? benchmark.topCompetitors.slice(0, 5) : [];
    const reading = buildReading(proposal, benchmark);

    const page = document.createElement("section");
    page.className = "pdf-page benchmark-executive-page";
    page.dataset.page = "benchmark";

    const rows = top.length
      ? top.map((item, index) => `
          <tr>
            <td>${index + 1}. ${escapeHtml(item?.name || "Concorrente")}</td>
            <td><span class="star">★</span> ${formatNumber(item?.rating)}</td>
            <td>${formatNumber(item?.userRatingCount)}</td>
            <td>${formatDistance(item?.distanceMeters)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">Nenhum concorrente com dados suficientes para o ranking.</td></tr>`;

    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">01 · Benchmark competitivo</span>
        <span class="mini-company">${escapeHtml(proposal.company || "Sua empresa")}</span>
      </div>

      <div class="benchmark-hero">
        <div class="benchmark-hero-copy">
          <span class="eyebrow">Inteligência competitiva local</span>
          <h2>Como sua empresa se compara <em>ao mercado ao redor.</em></h2>
          <p>Comparamos sinais públicos da sua empresa com os negócios semelhantes retornados pelo Google dentro do raio analisado.</p>
        </div>
        <div class="benchmark-source-pill">Dados observados · Google</div>
      </div>

      <div class="benchmark-kpis">
        <article class="benchmark-kpi primary">
          <span>Sua nota</span>
          <strong>${formatNumber(subject.rating)}</strong>
          <small>Média local observada: ${formatNumber(reputation.averageRating)}</small>
        </article>

        <article class="benchmark-kpi">
          <span>Suas avaliações</span>
          <strong>${formatNumber(subject.userRatingCount)}</strong>
          <small>Mediana local: ${formatNumber(reputation.medianReviews)}</small>
        </article>

        <article class="benchmark-kpi">
          <span>Concorrentes observados</span>
          <strong>${formatNumber(sample.competitorCount)}</strong>
          <small>${sample.capped ? "Consulta atingiu o limite de resultados" : "Dentro do raio analisado"}</small>
        </article>

        <article class="benchmark-kpi">
          <span>Gap até a mediana</span>
          <strong>${formatNumber(reputation.reviewsNeededToMedian)}</strong>
          <small>avaliações para alcançar a mediana observada</small>
        </article>
      </div>

      <div class="benchmark-insight">
        <article class="benchmark-reading">
          <span>Leitura principal</span>
          <strong>${reading.title}</strong>
          <p>${reading.text}</p>
        </article>

        <article class="benchmark-digital">
          <span>Padrão digital dos concorrentes</span>
          <div class="benchmark-digital-list">
            <div class="benchmark-digital-row">
              <span>Com site</span>
              <div class="benchmark-track"><i style="width:${Math.min(100, Number(digital.websiteCoveragePercent) || 0)}%"></i></div>
              <b>${formatNumber(digital.websiteCoveragePercent)}%</b>
            </div>
            <div class="benchmark-digital-row">
              <span>Com telefone</span>
              <div class="benchmark-track"><i style="width:${Math.min(100, Number(digital.phoneCoveragePercent) || 0)}%"></i></div>
              <b>${formatNumber(digital.phoneCoveragePercent)}%</b>
            </div>
            <div class="benchmark-digital-row">
              <span>Com horários</span>
              <div class="benchmark-track"><i style="width:${Math.min(100, Number(digital.openingHoursCoveragePercent) || 0)}%"></i></div>
              <b>${formatNumber(digital.openingHoursCoveragePercent)}%</b>
            </div>
          </div>
        </article>
      </div>

      <article class="benchmark-top">
        <span>Top 5 por volume de avaliações</span>
        <table class="benchmark-table">
          <thead>
            <tr>
              <th style="width:52%">Concorrente</th>
              <th style="width:16%">Nota</th>
              <th style="width:16%">Avaliações</th>
              <th style="width:16%">Distância</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </article>

      <p class="benchmark-method-note">
        Benchmark baseado na amostra de negócios retornada pelo Google Places no momento da análise. Não representa ranking oficial do Google nem necessariamente o total de empresas existentes na região.
      </p>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>02</span></footer>
    `;

    const cover = document.querySelector('[data-page="cover"]');
    if (cover) cover.insertAdjacentElement("afterend", page);

    renumberPages();
    return true;
  };

  window.addEventListener("radar:benchmark-ready", event => {
    render(event.detail);
  });

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 30) clearInterval(timer);
  }, 300);
})();
