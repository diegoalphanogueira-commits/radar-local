/* =========================================================
   RADAR LOCAL — CTA LIGHT
   Fechamento comercial forte, visual e responsivo.
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

  const buildWhatsappUrl = (currentHref, company) => {
    try {
      const url = new URL(currentHref);
      const message = `Oi Diego, vi o diagnóstico do Radar Local da ${company} e quero avançar para corrigir os principais pontos. Quero entender como funciona o plano de 7 dias.`;
      url.searchParams.set("text", message);
      return url.toString();
    } catch {
      return currentHref || "#";
    }
  };

  const injectStyles = () => {
    if (document.getElementById("radarCtaLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarCtaLightStyles";
    style.textContent = `
      .cta-page.cta-light-page {
        background:
          radial-gradient(circle at 90% 8%, rgba(47,107,255,.10), transparent 26%),
          #f7f9fc;
      }

      .cta-light-page .cl-hero {
        max-width: 650px;
        margin: 42px 0 28px;
      }

      .cta-light-page .cl-hero h2 {
        margin: 10px 0 14px;
        color: #101828;
        font-size: 42px;
        line-height: 1.02;
        letter-spacing: -2px;
      }

      .cta-light-page .cl-hero h2 em {
        color: #2f6bff;
        font-style: normal;
      }

      .cta-light-page .cl-hero p {
        max-width: 610px;
        margin: 0;
        color: #667085;
        font-size: 16px;
        line-height: 1.55;
      }

      .cl-offer {
        position: relative;
        overflow: hidden;
        margin-bottom: 18px;
        padding: 28px;
        border-radius: 26px;
        background:
          radial-gradient(circle at 90% 16%, rgba(74,128,255,.28), transparent 30%),
          linear-gradient(135deg, #101828 0%, #172a52 100%);
        color: #fff;
        box-shadow: 0 22px 55px rgba(16,24,40,.16);
      }

      .cl-offer::after {
        content: "";
        position: absolute;
        right: -55px;
        bottom: -75px;
        width: 190px;
        height: 190px;
        border-radius: 50%;
        border: 28px solid rgba(255,255,255,.05);
      }

      .cl-offer-kicker {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: #dbe7ff;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: .75px;
        text-transform: uppercase;
      }

      .cl-offer h3 {
        max-width: 600px;
        margin: 18px 0 10px;
        font-size: 31px;
        line-height: 1.08;
        letter-spacing: -1.2px;
      }

      .cl-offer > p {
        max-width: 590px;
        margin: 0;
        color: #c7d2e8;
        font-size: 14px;
        line-height: 1.55;
      }

      .cl-benefits {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 11px;
        margin: 22px 0 0;
      }

      .cl-benefit {
        min-height: 118px;
        padding: 16px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px;
        background: rgba(255,255,255,.065);
        backdrop-filter: blur(4px);
      }

      .cl-benefit i {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        margin-bottom: 12px;
        border-radius: 11px;
        background: #2f6bff;
        color: #fff;
        font-size: 16px;
        font-style: normal;
        font-weight: 850;
      }

      .cl-benefit strong {
        display: block;
        font-size: 14px;
        line-height: 1.25;
      }

      .cl-benefit span {
        display: block;
        margin-top: 5px;
        color: #b8c5dc;
        font-size: 11.5px;
        line-height: 1.4;
      }

      .cl-urgency {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 18px;
        padding: 18px 20px;
        border: 1px solid #f3d59b;
        border-radius: 20px;
        background: #fff8e8;
      }

      .cl-urgency-left {
        display: flex;
        align-items: center;
        gap: 13px;
      }

      .cl-urgency-icon {
        display: grid;
        place-items: center;
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        background: #fff0c7;
        color: #b77900;
        font-size: 20px;
      }

      .cl-urgency strong {
        display: block;
        color: #5b430d;
        font-size: 14px;
        line-height: 1.25;
      }

      .cl-urgency p {
        margin: 4px 0 0;
        color: #7b6736;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .cl-urgency-badge {
        flex: 0 0 auto;
        padding: 9px 12px;
        border-radius: 999px;
        background: #fff;
        color: #9a6a00;
        font-size: 10.5px;
        font-weight: 850;
        letter-spacing: .55px;
        text-transform: uppercase;
        box-shadow: 0 1px 0 rgba(0,0,0,.04);
      }

      .cl-action {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 16px;
        padding: 22px 24px;
        border-radius: 22px;
        background: #20b15a;
        color: #fff;
        text-decoration: none;
        box-shadow: 0 18px 35px rgba(32,177,90,.20);
        transition: transform .18s ease, box-shadow .18s ease;
      }

      .cl-action:hover {
        transform: translateY(-2px);
        box-shadow: 0 22px 42px rgba(32,177,90,.26);
      }

      .cl-action small {
        display: block;
        margin-bottom: 4px;
        color: rgba(255,255,255,.80);
        font-size: 11px;
        font-weight: 750;
        letter-spacing: .45px;
        text-transform: uppercase;
      }

      .cl-action strong {
        display: block;
        color: #fff;
        font-size: 20px;
        line-height: 1.2;
      }

      .cl-action-arrow {
        display: grid;
        place-items: center;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(255,255,255,.16);
        font-size: 25px;
        font-weight: 800;
      }

      .cl-helper {
        margin: 10px 0 0;
        color: #7b8492;
        font-size: 11px;
        text-align: center;
      }

      .cl-close {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 24px;
        padding-top: 18px;
        border-top: 1px solid #e4e7ec;
        color: #667085;
      }

      .cl-close-mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border: 1px solid #dfe4eb;
        border-radius: 50%;
        background: #fff;
        color: #2f6bff;
        font-weight: 900;
      }

      .cl-close strong {
        display: block;
        color: #344054;
        font-size: 13px;
      }

      .cl-close span {
        display: block;
        margin-top: 2px;
        font-size: 11px;
      }

      @media (max-width: 720px) {
        .cta-light-page .cl-hero {
          margin: 30px 0 22px;
        }

        .cta-light-page .cl-hero h2 {
          font-size: 33px;
          line-height: 1.04;
          letter-spacing: -1.4px;
        }

        .cta-light-page .cl-hero p {
          font-size: 15px;
        }

        .cl-offer {
          padding: 22px;
          border-radius: 22px;
        }

        .cl-offer h3 {
          font-size: 27px;
        }

        .cl-benefits {
          grid-template-columns: 1fr;
        }

        .cl-benefit {
          min-height: 0;
          display: grid;
          grid-template-columns: 34px 1fr;
          column-gap: 12px;
          align-items: center;
        }

        .cl-benefit i {
          grid-row: 1 / span 2;
          margin: 0;
        }

        .cl-benefit strong,
        .cl-benefit span {
          grid-column: 2;
        }

        .cl-benefit span {
          margin-top: 3px;
        }

        .cl-urgency {
          align-items: flex-start;
          flex-direction: column;
        }

        .cl-action {
          grid-template-columns: 1fr auto;
          padding: 20px;
        }

        .cl-action strong {
          font-size: 18px;
        }

        .cl-action-arrow {
          width: 44px;
          height: 44px;
        }
      }

      @media print {
        .cl-action { box-shadow: none !important; }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const proposal = readProposal();
    const page = document.querySelector('[data-page="cta"]');
    if (!proposal || !page) return false;

    injectStyles();

    const company = esc(proposal.company || "sua empresa");
    const oldHref = page.querySelector("#whatsappReportBtn")?.href || "#";
    const whatsappHref = buildWhatsappUrl(oldHref, proposal.company || "minha empresa");

    page.classList.add("cta-light-page");
    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">07 · Próximo passo</span>
        <span class="mini-company">${company}</span>
      </div>

      <div class="cl-hero">
        <span class="eyebrow">Você já viu o cenário</span>
        <h2>Agora é hora de <em>corrigir o que está fazendo oportunidades escaparem.</em></h2>
        <p>O diagnóstico mostrou onde sua presença perde força. O próximo passo é transformar essa leitura em execução.</p>
      </div>

      <section class="cl-offer">
        <span class="cl-offer-kicker">⚡ Plano de correção local · 7 dias</span>
        <h3>Saia do diagnóstico com prioridade, execução e próximo passo definidos.</h3>
        <p>Em vez de receber mais uma lista de problemas, você avança com uma rota prática para corrigir os pontos que mais pesam na sua presença local.</p>

        <div class="cl-benefits">
          <article class="cl-benefit">
            <i>1</i>
            <strong>Prioridade certa</strong>
            <span>Começamos pelo ponto que mais pode estar desviando oportunidades.</span>
          </article>

          <article class="cl-benefit">
            <i>2</i>
            <strong>Correção da base</strong>
            <span>Organizamos os sinais essenciais de presença, confiança e contato.</span>
          </article>

          <article class="cl-benefit">
            <i>3</i>
            <strong>Plano executável</strong>
            <span>Você sabe exatamente o que fazer agora e o que vem depois.</span>
          </article>
        </div>
      </section>

      <div class="cl-urgency">
        <div class="cl-urgency-left">
          <span class="cl-urgency-icon">◷</span>
          <div>
            <strong>Atendimento por lotes para preservar velocidade de execução.</strong>
            <p>Entramos com poucas empresas por vez para manter a entrega rápida e o acompanhamento próximo.</p>
          </div>
        </div>
        <span class="cl-urgency-badge">Próximo lote</span>
      </div>

      <a
        id="whatsappReportBtn"
        class="cl-action"
        href="${esc(whatsappHref)}"
        target="_blank"
        rel="noopener">
        <div>
          <small>Quero avançar com este diagnóstico</small>
          <strong>Quero corrigir minha presença local</strong>
        </div>
        <span class="cl-action-arrow">→</span>
      </a>

      <p class="cl-helper">Você vai direto para o WhatsApp com o contexto deste diagnóstico.</p>

      <div class="cl-close">
        <span class="cl-close-mark">R</span>
        <div>
          <strong>Radar Local</strong>
          <span>Diagnóstico que transforma dados locais em prioridade de ação.</span>
        </div>
      </div>

      <footer class="page-footer"><span>Radar Local</span><span>07</span></footer>
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
