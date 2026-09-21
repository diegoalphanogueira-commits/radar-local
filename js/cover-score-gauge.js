/* =========================================================
   RADAR LOCAL — SCORE VISUAL DA CAPA
   Troca o número seco da capa por um gauge horizontal
   vermelho → amarelo → verde, mantendo o score atual.
========================================================= */

(() => {
  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

  const scoreLabel = score => {
    const value = clamp(score);
    if (value >= 80) return "Presença forte";
    if (value >= 60) return "Presença boa";
    if (value >= 35) return "Presença intermediária";
    return "Presença baixa";
  };

  const scoreReading = score => {
    const value = clamp(score);
    if (value >= 80) return "Sua presença local já transmite força. O foco agora é sustentar vantagem e preferência.";
    if (value >= 60) return "Sua base é boa, mas alguns ajustes ainda podem aumentar a captura de oportunidades locais.";
    if (value >= 35) return "Sua empresa já tem presença, mas ainda existe espaço relevante para capturar melhor a procura local.";
    return "Sua presença ainda está abaixo do ideal para transformar a procura local em oportunidades com consistência.";
  };

  const injectStyles = () => {
    if (document.getElementById("radarCoverGaugeStyles")) return;

    const style = document.createElement("style");
    style.id = "radarCoverGaugeStyles";
    style.textContent = `
      .cover-page .summary-card-primary.cover-gauge-card {
        grid-column: 1 / -1;
        display: block;
        padding: 28px 30px 26px;
        text-align: center;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        border: 1px solid #d7e3f4;
        border-top: 5px solid #2f6bff;
        border-radius: 24px;
      }

      .cover-gauge-card .cg-label {
        display: block;
        margin-bottom: 12px;
        color: #2f6bff;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      .cover-gauge-card .cg-score-row {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .cover-gauge-card .cg-score-row strong {
        color: #101828;
        font-size: 64px;
        font-weight: 850;
        line-height: 1;
        letter-spacing: -2.8px;
      }

      .cover-gauge-card .cg-score-row span {
        color: #667085;
        font-size: 18px;
        font-weight: 650;
      }

      .cover-gauge-card .cg-status {
        display: block;
        margin-bottom: 22px;
        color: #344054;
        font-size: 18px;
        font-weight: 800;
      }

      .cover-gauge-card .cg-gauge-wrap {
        width: min(100%, 620px);
        margin: 0 auto;
      }

      .cover-gauge-card .cg-gauge {
        position: relative;
        height: 18px;
        border-radius: 999px;
        background: linear-gradient(90deg,
          #ef4444 0%,
          #f97316 28%,
          #f4b400 50%,
          #84cc16 72%,
          #22c55e 100%);
        box-shadow: inset 0 0 0 1px rgba(16,24,40,.06);
      }

      .cover-gauge-card .cg-marker {
        position: absolute;
        top: 50%;
        width: 28px;
        height: 28px;
        transform: translate(-50%, -50%);
        border: 5px solid #fff;
        border-radius: 50%;
        background: #101828;
        box-shadow: 0 6px 18px rgba(16,24,40,.22);
      }

      .cover-gauge-card .cg-scale {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        margin-top: 11px;
        color: #667085;
        font-size: 11px;
        font-weight: 700;
      }

      .cover-gauge-card .cg-scale span:nth-child(1) { text-align: left; }
      .cover-gauge-card .cg-scale span:nth-child(2) { text-align: center; }
      .cover-gauge-card .cg-scale span:nth-child(3) { text-align: right; }

      .cover-gauge-card .cg-reading {
        max-width: 620px;
        margin: 18px auto 0;
        color: #667085;
        font-size: 14px;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        .cover-page .summary-card-primary.cover-gauge-card {
          padding: 24px 20px 22px;
        }

        .cover-gauge-card .cg-score-row strong {
          font-size: 56px;
        }

        .cover-gauge-card .cg-status {
          font-size: 17px;
        }

        .cover-gauge-card .cg-gauge {
          height: 16px;
        }

        .cover-gauge-card .cg-reading {
          font-size: 13.5px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const card = document.querySelector('.cover-page .summary-card-primary');
    const scoreEl = document.getElementById('coverOverallScore');
    if (!card || !scoreEl) return false;

    const raw = String(scoreEl.textContent || "0").replace(',', '.').replace(/[^0-9.-]/g, '');
    const score = clamp(raw);

    injectStyles();
    card.classList.add('cover-gauge-card');
    card.innerHTML = `
      <span class="cg-label">Score local</span>
      <div class="cg-score-row">
        <strong>${Math.round(score)}</strong>
        <span>/100</span>
      </div>
      <strong class="cg-status">${scoreLabel(score)}</strong>
      <div class="cg-gauge-wrap">
        <div class="cg-gauge" aria-label="Score local ${Math.round(score)} de 100">
          <i class="cg-marker" style="left:${score}%"></i>
        </div>
        <div class="cg-scale">
          <span>Baixo</span>
          <span>Intermediário</span>
          <span>Forte</span>
        </div>
      </div>
      <p class="cg-reading">${scoreReading(score)}</p>
    `;

    return true;
  };

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 30) clearInterval(timer);
  }, 200);
})();
