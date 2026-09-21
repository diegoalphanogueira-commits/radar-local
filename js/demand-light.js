/* =========================================================
   RADAR LOCAL — DEMANDA LIGHT
   Reorganiza a página de demanda para leitura premium,
   leve no desktop e confortável no celular.
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
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
  };

  const keywordLabel = item => {
    if (typeof item === "string") return item;
    return item?.label || item?.keyword || item?.term || item?.name || item?.text || "";
  };

  const getDemandLevel = proposal => {
    if (proposal?.demandLevel) return String(proposal.demandLevel);
    const monthly = Number(proposal?.monthly || 0);
    if (monthly >= 100) return "Alta";
    if (monthly >= 50) return "Moderada";
    return "Baixa";
  };

  const injectStyles = () => {
    if (document.getElementById("radarDemandLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarDemandLightStyles";
    style.textContent = `
      .demand-light-page {
        background: radial-gradient(circle at 92% 6%, rgba(40,120,240,.08), transparent 25%), #fbfaf8;
      }

      .demand-light-page .dl-hero {
        margin: 34px 0 24px;
        max-width: 700px;
      }

      .demand-light-page .dl-hero h2 {
        margin: 8px 0 12px;
        color: #17191e;
        font-size: 38px;
        line-height: 1.03;
        letter-spacing: -1.8px;
      }

      .demand-light-page .dl-hero h2 em {
        color: #2878f0;
        font-style: normal;
      }

      .demand-light-page .dl-hero p {
        margin: 0;
        color: #667085;
        font-size: 14px;
        line-height: 1.55;
        max-width: 650px;
      }

      .dl-main-card {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: 1.1fr .9fr;
        gap: 26px;
        align-items: end;
        padding: 28px;
        border-radius: 24px;
        background: linear-gradient(135deg, #172033 0%, #16284c 100%);
        color: #fff;
        box-shadow: 0 18px 40px rgba(14,30,62,.14);
      }

      .dl-main-card::after {
        content: "";
        position: absolute;
        width: 250px;
        height: 250px;
        right: -90px;
        top: -110px;
        border-radius: 50%;
        background: rgba(47,107,255,.18);
        filter: blur(4px);
      }

      .dl-kicker,
      .dl-section-label {
        color: #8fb4ff;
        font-size: 10px;
        font-weight: 850;
        text-transform: uppercase;
        letter-spacing: .75px;
      }

      .dl-big-number {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        margin-top: 9px;
      }

      .dl-big-number strong {
        font-size: 76px;
        line-height: .9;
        letter-spacing: -4px;
      }

      .dl-big-number span {
        padding-bottom: 7px;
        color: #cbd5e1;
        font-size: 14px;
      }

      .dl-meter {
        height: 8px;
        margin-top: 22px;
        border-radius: 999px;
        background: rgba(255,255,255,.14);
        overflow: hidden;
      }

      .dl-meter i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg,#80aaff,#2f6bff);
      }

      .dl-main-side {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        position: relative;
        z-index: 1;
      }

      .dl-main-stat {
        padding: 16px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        background: rgba(255,255,255,.07);
        backdrop-filter: blur(4px);
      }

      .dl-main-stat span {
        display: block;
        color: #b9c5d8;
        font-size: 10.5px;
      }

      .dl-main-stat strong {
        display: block;
        margin-top: 7px;
        font-size: 25px;
        line-height: 1;
      }

      .dl-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-top: 14px;
      }

      .dl-card {
        padding: 20px;
        border: 1px solid #e2e7ef;
        border-radius: 20px;
        background: #fff;
      }

      .dl-card h3 {
        margin: 8px 0 6px;
        color: #20242b;
        font-size: 20px;
        line-height: 1.2;
      }

      .dl-card p {
        margin: 0;
        color: #667085;
        font-size: 12.5px;
        line-height: 1.5;
      }

      .dl-demand-signal {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .dl-icon {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: #eef4ff;
        color: #2f6bff;
        font-size: 19px;
        font-weight: 900;
      }

      .dl-keywords {
        margin-top: 14px;
        padding: 20px;
        border: 1px solid #e2e7ef;
        border-radius: 20px;
        background: #fff;
      }

      .dl-keyword-list {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 14px;
      }

      .dl-chip {
        padding: 9px 12px;
        border: 1px solid #dce4ee;
        border-radius: 999px;
        background: #fbfcfe;
        color: #374151;
        font-size: 12px;
        font-weight: 700;
      }

      .dl-note {
        margin: 12px 0 0;
        color: #8a94a3;
        font-size: 10px;
        line-height: 1.45;
      }

      @media (max-width: 720px) {
        .demand-light-page .dl-hero h2 {
          font-size: 31px;
          line-height: 1.06;
        }

        .demand-light-page .dl-hero p {
          font-size: 13.5px;
        }

        .dl-main-card {
          grid-template-columns: 1fr;
          gap: 18px;
          padding: 22px;
        }

        .dl-big-number strong {
          font-size: 64px;
        }

        .dl-main-side,
        .dl-grid {
          grid-template-columns: 1fr;
        }

        .dl-main-stat strong {
          font-size: 27px;
        }

        .dl-card {
          padding: 18px;
        }

        .dl-card h3 {
          font-size: 19px;
        }

        .dl-card p,
        .dl-chip {
          font-size: 13px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const proposal = readProposal();
    const page = document.querySelector('[data-page="demand"]');
    if (!proposal || !page) return false;

    injectStyles();

    const monthly = Number(proposal.monthly || 0);
    const weekly = Number(proposal.weekly || Math.round(monthly / 4.33));
    const level = getDemandLevel(proposal);
    const competition = String(proposal.competitionLevel || "Relevante");
    const meter = Math.max(8, Math.min(100, Number(proposal.demandMeter || (monthly >= 100 ? 82 : monthly >= 50 ? 58 : 34))));
    const segment = proposal.segmentLabel || "negócio local";
    const region = proposal.region || "região analisada";

    const keywords = (Array.isArray(proposal.keywordData) ? proposal.keywordData : [])
      .map(keywordLabel)
      .filter(Boolean)
      .slice(0, 6);

    page.classList.add("demand-light-page");
    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">03 · Demanda local</span>
        <span class="mini-company">${esc(proposal.company || "Sua empresa")}</span>
      </div>

      <div class="dl-hero">
        <span class="eyebrow">O mercado está se movimentando</span>
        <h2>Existe procura. <em>A disputa por ela também.</em></h2>
        <p>O Radar estimou sinais de procura por serviços de ${esc(String(segment).toLowerCase())} dentro do raio analisado em ${esc(region)}.</p>
      </div>

      <section class="dl-main-card">
        <div>
          <span class="dl-kicker">Procura estimada por mês</span>
          <div class="dl-big-number">
            <strong>${num(monthly)}</strong>
            <span>buscas relacionadas*</span>
          </div>
          <div class="dl-meter"><i style="width:${meter}%"></i></div>
        </div>

        <div class="dl-main-side">
          <div class="dl-main-stat">
            <span>Nível de demanda</span>
            <strong>${esc(level)}</strong>
          </div>
          <div class="dl-main-stat">
            <span>Disputa local</span>
            <strong>${esc(competition)}</strong>
          </div>
        </div>
      </section>

      <div class="dl-grid">
        <article class="dl-card">
          <div class="dl-demand-signal">
            <div class="dl-icon">↗</div>
            <div>
              <span class="dl-section-label">Ritmo semanal</span>
              <h3>${num(weekly)} intenções relacionadas</h3>
            </div>
          </div>
          <p>Uma leitura simples para visualizar a frequência com que essa procura pode aparecer ao longo das semanas.</p>
        </article>

        <article class="dl-card">
          <div class="dl-demand-signal">
            <div class="dl-icon">◎</div>
            <div>
              <span class="dl-section-label">Leitura do Radar</span>
              <h3>Há espaço real sendo disputado.</h3>
            </div>
          </div>
          <p>Quando existe procura e concorrência ativa, presença digital e confiança passam a influenciar quem entra na consideração do cliente.</p>
        </article>
      </div>

      <section class="dl-keywords">
        <span class="dl-section-label">O que as pessoas procuram</span>
        <h3 style="margin:8px 0 0;color:#20242b;font-size:20px;line-height:1.2;">Principais intenções relacionadas ao serviço</h3>
        <div class="dl-keyword-list">
          ${keywords.length ? keywords.map(item => `<span class="dl-chip">${esc(item)}</span>`).join("") : `<span class="dl-chip">Termos relacionados ao serviço analisado</span>`}
        </div>
      </section>

      <p class="dl-note">*Estimativas estratégicas usadas para leitura comercial. Não representam volume oficial medido em tempo real pelo Google.</p>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>03</span></footer>
    `;

    return true;
  };

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 30) clearInterval(timer);
  }, 300);
})();
