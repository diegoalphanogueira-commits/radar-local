/* =========================================================
   RADAR LOCAL — MAPA LIGHT
   Reorganiza a página de mapa para leitura premium e leve.
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

  const num = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
  };

  const distance = meters => {
    const n = Number(meters);
    if (!Number.isFinite(n)) return "—";
    if (n < 1000) return `${Math.round(n)} m`;
    return `${(n / 1000).toFixed(1).replace(".", ",")} km`;
  };

  const injectStyles = () => {
    if (document.getElementById("radarMapLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarMapLightStyles";
    style.textContent = `
      .map-page.map-light-page {
        background:
          radial-gradient(circle at 92% 6%, rgba(47,107,255,.08), transparent 26%),
          #f8fafc;
      }

      .map-light-page .section-heading {
        margin: 30px 0 20px;
        max-width: 680px;
      }

      .map-light-page .section-heading h2 {
        margin: 8px 0 10px;
        color: #111827;
        font-size: 36px;
        line-height: 1.05;
        letter-spacing: -1.6px;
      }

      .map-light-page .section-heading h2 em {
        color: #2f6bff;
        font-style: normal;
      }

      .map-light-page .section-heading p {
        margin: 0;
        color: #667085;
        font-size: 14px;
        line-height: 1.55;
      }

      .map-light-page .map-shell {
        position: relative;
        overflow: hidden;
        border: 1px solid #dfe5ee;
        border-radius: 24px;
        background: #fff;
        box-shadow: 0 16px 40px rgba(15,23,42,.08);
      }

      .map-light-page .opportunity-map {
        min-height: 360px;
        height: 360px;
      }

      .map-light-page .map-overlay-card {
        top: 18px;
        left: 18px;
        right: auto;
        max-width: 310px;
        padding: 15px 17px;
        border: 1px solid rgba(255,255,255,.7);
        border-radius: 16px;
        background: rgba(255,255,255,.95);
        box-shadow: 0 10px 30px rgba(15,23,42,.14);
        backdrop-filter: blur(8px);
      }

      .map-light-page .map-overlay-card span {
        color: #2f6bff;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .7px;
        text-transform: uppercase;
      }

      .map-light-page .map-overlay-card strong {
        display: block;
        margin-top: 5px;
        color: #111827;
        font-size: 15px;
        line-height: 1.3;
      }

      .map-light-page .map-overlay-card small {
        display: block;
        margin-top: 4px;
        color: #667085;
        font-size: 11.5px;
        line-height: 1.4;
      }

      .map-light-page .map-legend {
        left: 18px;
        right: 18px;
        bottom: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        width: auto;
        padding: 9px 12px;
        border: 1px solid rgba(255,255,255,.7);
        border-radius: 999px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 8px 24px rgba(15,23,42,.10);
        backdrop-filter: blur(8px);
      }

      .map-light-page .map-legend span {
        color: #4b5563;
        font-size: 10.5px;
        font-weight: 700;
      }

      .map-light-page .map-legend span:has(.legend-opportunity) {
        display: none;
      }

      .map-light-page .map-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-top: 14px;
      }

      .map-light-page .map-stat-grid article,
      .map-light-page .map-nearest-card {
        position: relative;
        overflow: hidden;
        min-height: 104px;
        padding: 16px;
        border: 1px solid #e3e8ef;
        border-radius: 18px;
        background: #fff;
      }

      .map-light-page .map-stat-grid article::before,
      .map-light-page .map-nearest-card::before {
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 4px;
        background: #2f6bff;
      }

      .map-light-page .map-stat-grid article:nth-child(2)::before { background: #ef4444; }
      .map-light-page .map-stat-grid article:nth-child(3)::before { background: #f4b400; }
      .map-light-page .map-nearest-card::before { background: #22c55e; }

      .map-light-page .map-stat-grid span,
      .map-light-page .map-nearest-card span {
        display: block;
        color: #7b8492;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .6px;
        text-transform: uppercase;
      }

      .map-light-page .map-stat-grid strong,
      .map-light-page .map-nearest-card strong {
        display: block;
        margin-top: 11px;
        color: #111827;
        font-size: 24px;
        line-height: 1;
        letter-spacing: -.7px;
      }

      .map-light-page .map-nearest-card small {
        display: block;
        margin-top: 7px;
        color: #667085;
        font-size: 11px;
        line-height: 1.35;
      }

      .map-light-page .map-reading-card {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 14px;
        margin-top: 14px;
        padding: 17px 19px;
        border: 1px solid #cfe9d7;
        border-radius: 20px;
        background: linear-gradient(135deg, #effaf2, #f8fdf9);
      }

      .map-light-page .map-reading-card::before {
        content: "◎";
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: #dff4e5;
        color: #159947;
        font-size: 20px;
        font-weight: 850;
      }

      .map-light-page .map-reading-card span {
        display: block;
        color: #159947;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .7px;
        text-transform: uppercase;
      }

      .map-light-page .map-reading-card strong {
        display: block;
        margin-top: 5px;
        color: #173524;
        font-size: 15px;
        line-height: 1.45;
      }

      .map-light-page .method-note {
        margin-top: 12px;
        color: #8a94a3;
        font-size: 10.5px;
        line-height: 1.45;
      }

      @media (max-width: 720px) {
        .map-light-page .section-heading {
          margin: 26px 0 18px;
        }

        .map-light-page .section-heading h2 {
          font-size: 31px;
          line-height: 1.06;
        }

        .map-light-page .section-heading p {
          font-size: 14px;
        }

        .map-light-page .opportunity-map {
          min-height: 350px;
          height: 350px;
        }

        .map-light-page .map-overlay-card {
          left: 14px;
          right: 14px;
          top: 14px;
          max-width: none;
        }

        .map-light-page .map-legend {
          left: 12px;
          right: 12px;
          bottom: 10px;
          justify-content: center;
          border-radius: 16px;
        }

        .map-light-page .map-stat-grid {
          grid-template-columns: 1fr 1fr;
        }

        .map-light-page .map-stat-grid article,
        .map-light-page .map-nearest-card {
          min-height: 100px;
        }

        .map-light-page .map-stat-grid strong,
        .map-light-page .map-nearest-card strong {
          font-size: 25px;
        }

        .map-light-page .map-reading-card {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const proposal = readProposal();
    const page = document.querySelector('[data-page="map"]');
    if (!proposal || !page) return false;

    injectStyles();
    page.classList.add("map-light-page");

    const heading = page.querySelector(".section-heading");
    if (heading) {
      heading.innerHTML = `
        <span class="eyebrow">Leitura da região</span>
        <h2>Veja quem disputa atenção <em>perto da sua empresa.</em></h2>
        <p>O mapa mostra sua empresa, negócios semelhantes e a pressão competitiva dentro do raio analisado.</p>
      `;
    }

    const benchmark = proposal.benchmark || {};
    const nearest = benchmark?.geography?.nearestCompetitor || null;
    const statGrid = page.querySelector(".map-stat-grid");

    if (statGrid && !page.querySelector(".map-nearest-card")) {
      const article = document.createElement("article");
      article.className = "map-nearest-card";
      article.innerHTML = `
        <span>Mais próximo</span>
        <strong>${nearest ? distance(nearest.distanceMeters) : "—"}</strong>
        <small>${nearest?.name ? String(nearest.name) : "Concorrente mais próximo"}</small>
      `;
      statGrid.appendChild(article);
    }

    const method = page.querySelector(".method-note");
    if (method) {
      method.textContent = "Mapa e negócios semelhantes consultados via Google. A busca retorna uma amostra de até 20 resultados por consulta e não representa necessariamente o total de empresas existentes na região.";
    }

    return true;
  };

  if (render()) return;

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (render() || tries >= 30) clearInterval(timer);
  }, 300);
})();
