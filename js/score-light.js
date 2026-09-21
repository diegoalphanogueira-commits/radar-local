/* =========================================================
   RADAR LOCAL — PRESENÇA LOCAL LIGHT
   Reorganiza a página de presença para leitura rápida,
   visual e confortável no desktop e no celular.
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

  const text = id => document.getElementById(id)?.textContent?.trim() || "";

  const numberFrom = value => {
    const normalized = String(value ?? "").replace(",", ".").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const scoreLabel = value => {
    const score = clamp(value);
    if (score >= 75) return "Presença forte";
    if (score >= 55) return "Presença consistente";
    if (score >= 35) return "Presença intermediária";
    return "Presença frágil";
  };

  const scoreHeadline = value => {
    const score = clamp(value);
    if (score >= 75) return "Sua base local já transmite força e consistência.";
    if (score >= 55) return "Sua presença já funciona, mas ainda há espaço para ganhar preferência.";
    if (score >= 35) return "Existe espaço relevante para transformar presença em mais oportunidades.";
    return "Sua presença ainda precisa ganhar força para competir melhor pela atenção local.";
  };

  const injectStyles = () => {
    if (document.getElementById("radarScoreLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarScoreLightStyles";
    style.textContent = `
      .score-light-page {
        background: radial-gradient(circle at 92% 7%, rgba(47,107,255,.08), transparent 26%), #fbfaf8;
      }

      .score-light-page .sl-hero {
        margin: 32px 0 22px;
        max-width: 680px;
      }

      .score-light-page .sl-hero h2 {
        margin: 8px 0 10px;
        color: #101828;
        font-size: 36px;
        line-height: 1.04;
        letter-spacing: -1.7px;
      }

      .score-light-page .sl-hero h2 em {
        color: #2f6bff;
        font-style: normal;
      }

      .score-light-page .sl-hero p {
        margin: 0;
        color: #667085;
        font-size: 13.5px;
        line-height: 1.55;
      }

      .sl-stage {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 18px;
        align-items: stretch;
        margin-bottom: 16px;
      }

      .sl-score-card,
      .sl-reading-card,
      .sl-pillar,
      .sl-focus-card {
        border: 1px solid #e4e7ec;
        border-radius: 22px;
        background: #fff;
      }

      .sl-score-card {
        display: grid;
        place-items: center;
        padding: 22px;
        text-align: center;
        background: linear-gradient(180deg, #f7faff 0%, #eef4ff 100%);
        border-color: #bfd3ff;
      }

      .sl-ring {
        --score: 0;
        width: 138px;
        height: 138px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: conic-gradient(#2f6bff calc(var(--score) * 1%), #dfe8f7 0);
        position: relative;
      }

      .sl-ring::after {
        content: "";
        position: absolute;
        inset: 12px;
        border-radius: 50%;
        background: #fff;
      }

      .sl-ring-value {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: baseline;
        gap: 3px;
      }

      .sl-ring-value strong {
        color: #101828;
        font-size: 46px;
        line-height: 1;
        letter-spacing: -2px;
      }

      .sl-ring-value span {
        color: #7c8798;
        font-size: 14px;
        font-weight: 700;
      }

      .sl-score-card > strong {
        margin-top: 14px;
        color: #2f6bff;
        font-size: 15px;
      }

      .sl-reading-card {
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .sl-kicker,
      .sl-section-label {
        color: #2f6bff;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .75px;
        text-transform: uppercase;
      }

      .sl-reading-card h3 {
        margin: 9px 0 9px;
        color: #101828;
        font-size: 24px;
        line-height: 1.15;
        letter-spacing: -.6px;
      }

      .sl-reading-card p {
        margin: 0;
        color: #667085;
        font-size: 13px;
        line-height: 1.55;
        max-width: 520px;
      }

      .sl-pillars {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .sl-pillar {
        padding: 18px;
      }

      .sl-pillar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .sl-pillar-name {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #1d2939;
        font-size: 15px;
        font-weight: 800;
      }

      .sl-pillar-icon {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 11px;
        font-size: 15px;
        font-weight: 900;
      }

      .sl-pillar strong {
        color: #101828;
        font-size: 28px;
        line-height: 1;
      }

      .sl-pillar small {
        display: block;
        margin-top: 14px;
        color: #667085;
        font-size: 11.5px;
        line-height: 1.4;
      }

      .sl-bar {
        height: 8px;
        margin-top: 14px;
        overflow: hidden;
        border-radius: 999px;
        background: #edf1f5;
      }

      .sl-bar i {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      .sl-pillar.discovery .sl-pillar-icon { background: #eef4ff; color: #2f6bff; }
      .sl-pillar.discovery .sl-bar i { background: #2f6bff; }
      .sl-pillar.authority .sl-pillar-icon { background: #ecfdf3; color: #22a95a; }
      .sl-pillar.authority .sl-bar i { background: #22a95a; }
      .sl-pillar.trust .sl-pillar-icon { background: #fff7e8; color: #d99700; }
      .sl-pillar.trust .sl-bar i { background: #f4b400; }

      .sl-focus-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 20px;
        align-items: center;
        padding: 20px 22px;
        margin-bottom: 16px;
        background: #fffaf0;
        border-color: #f4dfaa;
      }

      .sl-focus-card h4 {
        margin: 7px 0 5px;
        color: #101828;
        font-size: 20px;
        line-height: 1.2;
      }

      .sl-focus-card p {
        margin: 0;
        color: #667085;
        font-size: 12px;
        line-height: 1.5;
      }

      .sl-focus-score {
        min-width: 92px;
        text-align: right;
      }

      .sl-focus-score strong {
        display: block;
        color: #d99700;
        font-size: 38px;
        line-height: 1;
      }

      .sl-focus-score span {
        display: block;
        margin-top: 4px;
        color: #8a7a52;
        font-size: 10px;
      }

      .sl-uncaptured {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 22px;
        align-items: center;
        padding: 22px 24px;
        border-radius: 22px;
        color: #fff;
        background: linear-gradient(135deg, #111827 0%, #1d3567 100%);
      }

      .sl-uncaptured strong {
        display: block;
        font-size: 50px;
        line-height: 1;
        letter-spacing: -2px;
      }

      .sl-uncaptured-copy span {
        display: block;
        color: #b9c7e6;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .7px;
        text-transform: uppercase;
      }

      .sl-uncaptured-copy h4 {
        margin: 8px 0 6px;
        font-size: 18px;
        line-height: 1.25;
      }

      .sl-uncaptured-copy p {
        margin: 0;
        color: #d6ddec;
        font-size: 12px;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        .score-light-page .sl-hero h2 {
          font-size: 31px;
        }

        .score-light-page .sl-hero p {
          font-size: 13.5px;
        }

        .sl-stage {
          grid-template-columns: 1fr;
        }

        .sl-score-card {
          padding: 20px;
        }

        .sl-reading-card {
          padding: 20px;
        }

        .sl-reading-card h3 {
          font-size: 22px;
        }

        .sl-pillars {
          grid-template-columns: 1fr;
        }

        .sl-pillar {
          padding: 17px;
        }

        .sl-pillar small,
        .sl-focus-card p,
        .sl-uncaptured-copy p {
          font-size: 12.5px;
        }

        .sl-focus-card {
          grid-template-columns: 1fr;
        }

        .sl-focus-score {
          text-align: left;
        }

        .sl-uncaptured {
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .sl-uncaptured strong {
          font-size: 46px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const page = document.querySelector('[data-page="score"]');
    if (!page) return false;

    const proposal = readProposal() || {};
    const company = proposal.company || document.querySelector('[data-page="score"] [data-company]')?.textContent || "Sua empresa";

    const overall = clamp(numberFrom(text("overallScore")));
    const discovery = clamp(numberFrom(text("discoveryScore")));
    const authority = clamp(numberFrom(text("authorityScore")));
    const trust = clamp(numberFrom(text("trustScore")));
    const uncapturedRaw = text("uncapturedDemand") || `${Math.max(0, 100 - overall)}%`;
    const uncaptured = Math.max(0, Math.min(100, numberFrom(uncapturedRaw)));

    const pillars = [
      { key: "Descoberta", score: discovery, className: "discovery", icon: "◎", short: "Ser encontrado pelas pessoas certas." },
      { key: "Autoridade", score: authority, className: "authority", icon: "◆", short: "Transmitir estrutura e relevância." },
      { key: "Confiança", score: trust, className: "trust", icon: "★", short: "Reduzir dúvida e facilitar a escolha." }
    ];

    const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];

    injectStyles();
    page.classList.add("score-light-page");

    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">05 · Presença local</span>
        <span class="mini-company">${esc(company)}</span>
      </div>

      <div class="sl-hero">
        <span class="eyebrow">Capacidade de captura</span>
        <h2>Não basta aparecer. <em>É preciso ser escolhido.</em></h2>
        <p>Este índice resume os sinais que ajudam sua empresa a ser encontrada, considerada e escolhida no ambiente local.</p>
      </div>

      <div class="sl-stage">
        <article class="sl-score-card">
          <div class="sl-ring" style="--score:${overall}">
            <div class="sl-ring-value">
              <strong>${Math.round(overall)}</strong>
              <span>/100</span>
            </div>
          </div>
          <strong>${scoreLabel(overall)}</strong>
        </article>

        <article class="sl-reading-card">
          <span class="sl-kicker">Índice de presença local</span>
          <h3>${scoreHeadline(overall)}</h3>
          <p>O score mostra a força atual da sua presença antes do cliente iniciar uma conversa com a empresa.</p>
        </article>
      </div>

      <div class="sl-pillars">
        ${pillars.map(item => `
          <article class="sl-pillar ${item.className}">
            <div class="sl-pillar-head">
              <div class="sl-pillar-name">
                <span class="sl-pillar-icon">${item.icon}</span>
                <span>${item.key}</span>
              </div>
              <strong>${Math.round(item.score)}</strong>
            </div>
            <div class="sl-bar"><i style="width:${item.score}%"></i></div>
            <small>${item.short}</small>
          </article>
        `).join("")}
      </div>

      <article class="sl-focus-card">
        <div>
          <span class="sl-section-label">Ponto que merece atenção agora</span>
          <h4>${weakest.key}</h4>
          <p>${weakest.key === "Confiança"
            ? "Fortalecer prova social e sinais de segurança pode reduzir a dúvida antes do contato."
            : weakest.key === "Descoberta"
              ? "Ganhar presença nas buscas locais pode aumentar a chance de entrar no radar de quem já está procurando."
              : "Reforçar os sinais de estrutura e autoridade pode aumentar a consideração frente aos concorrentes."}
          </p>
        </div>
        <div class="sl-focus-score">
          <strong>${Math.round(weakest.score)}</strong>
          <span>de 100</span>
        </div>
      </article>

      <article class="sl-uncaptured">
        <strong>${Math.round(uncaptured)}%</strong>
        <div class="sl-uncaptured-copy">
          <span>Oportunidade ainda não capturada</span>
          <h4>Ainda existe espaço para melhorar sua capacidade de transformar procura em contato.</h4>
          <p>Quanto mais fortes os sinais de descoberta, autoridade e confiança, menor tende a ser essa distância.</p>
        </div>
      </article>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>05</span></footer>
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
