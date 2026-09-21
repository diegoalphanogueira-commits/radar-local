/* =========================================================
   RADAR LOCAL — PITCH / PROPOSTA FINAL
   Transforma a última página em proposta comercial executiva.
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
      const url = new URL(currentHref, window.location.href);
      const message = `Oi Diego, vi o diagnóstico do Radar Local da ${company} e quero garantir a reestruturação da nossa presença local. Quero avançar com o plano de até 7 dias.`;
      url.searchParams.set("text", message);
      return url.toString();
    } catch {
      return currentHref || "#";
    }
  };

  const icon = name => {
    const icons = {
      google: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5h5.4M17.4 7.5v4.2H13"></path><path d="M17 16.5a7 7 0 1 1 .4-8"></path></svg>`,
      site: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"></rect><path d="M3 9h18M7 6.5h.01M10 6.5h.01"></path></svg>`,
      review: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z"></path></svg>`,
      check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"></path></svg>`,
      arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"></path></svg>`
    };
    return icons[name] || "";
  };

  const injectStyles = () => {
    const old = document.getElementById("radarPitchProposalStyles");
    if (old) old.remove();

    const style = document.createElement("style");
    style.id = "radarPitchProposalStyles";
    style.textContent = `
      .cta-page.pitch-proposal-page {
        background:
          radial-gradient(circle at 92% 4%, rgba(47,107,255,.11), transparent 24%),
          #f7f9fc;
      }

      .pitch-proposal-page,
      .pitch-proposal-page * { box-sizing:border-box; }

      .pitch-proposal-page .pp-hero {
        max-width:690px;
        margin:30px 0 22px;
      }

      .pitch-proposal-page .pp-eyebrow,
      .pitch-proposal-page .pp-label {
        display:block;
        color:#2f6bff;
        font-size:10.5px;
        font-weight:850;
        letter-spacing:.85px;
        text-transform:uppercase;
      }

      .pitch-proposal-page .pp-hero h2 {
        margin:8px 0 11px;
        color:#101828;
        font-size:39px;
        font-weight:880;
        line-height:1.03;
        letter-spacing:-1.9px;
      }

      .pitch-proposal-page .pp-hero h2 em {
        color:#2f6bff;
        font-style:normal;
      }

      .pitch-proposal-page .pp-hero p {
        max-width:640px;
        margin:0;
        color:#667085;
        font-size:14px;
        line-height:1.5;
      }

      .pp-offer-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:16px;
        margin-bottom:12px;
        padding:15px 18px;
        border:1px solid #d9e4f7;
        border-radius:18px;
        background:#fff;
      }

      .pp-offer-head strong {
        display:block;
        margin-top:4px;
        color:#101828;
        font-size:19px;
        line-height:1.2;
      }

      .pp-time {
        flex:0 0 auto;
        padding:10px 13px;
        border-radius:999px;
        background:#eef4ff;
        color:#2f6bff;
        font-size:12px;
        font-weight:850;
      }

      .pp-solutions {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:11px;
        margin-bottom:12px;
      }

      .pp-solution {
        position:relative;
        min-height:190px;
        padding:18px;
        border:1px solid #e3e8ef;
        border-radius:21px;
        background:#fff;
        box-shadow:0 8px 24px rgba(16,24,40,.035);
      }

      .pp-solution-icon {
        display:grid;
        place-items:center;
        width:46px;
        height:46px;
        margin-bottom:15px;
        border-radius:14px;
        background:#eef4ff;
        color:#2f6bff;
      }

      .pp-solution:nth-child(2) .pp-solution-icon {
        background:#ecfdf3;
        color:#168553;
      }

      .pp-solution:nth-child(3) .pp-solution-icon {
        background:#fff7df;
        color:#c88900;
      }

      .pp-solution-icon svg,
      .pp-check svg,
      .pp-action-arrow svg {
        width:23px;
        height:23px;
        fill:none;
        stroke:currentColor;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
      }

      .pp-solution h3 {
        margin:0 0 7px;
        color:#101828;
        font-size:17px;
        line-height:1.18;
      }

      .pp-solution p {
        margin:0;
        color:#667085;
        font-size:12.2px;
        line-height:1.45;
      }

      .pp-solution b {
        display:block;
        margin-top:11px;
        color:#344054;
        font-size:11.5px;
        line-height:1.35;
      }

      .pp-seven {
        display:grid;
        grid-template-columns:auto 1fr;
        gap:16px;
        align-items:center;
        margin-bottom:12px;
        padding:17px 19px;
        border-radius:20px;
        background:linear-gradient(135deg,#111827,#19305d);
        color:#fff;
      }

      .pp-seven-number {
        display:grid;
        place-items:center;
        width:72px;
        height:72px;
        border-radius:18px;
        background:rgba(255,255,255,.09);
        border:1px solid rgba(255,255,255,.12);
        font-size:34px;
        font-weight:880;
        line-height:1;
      }

      .pp-seven-copy span {
        display:block;
        color:#91b3ff;
        font-size:10.5px;
        font-weight:850;
        letter-spacing:.8px;
        text-transform:uppercase;
      }

      .pp-seven-copy strong {
        display:block;
        margin-top:4px;
        font-size:20px;
        line-height:1.18;
      }

      .pp-seven-copy p {
        margin:5px 0 0;
        color:#c8d4e8;
        font-size:12px;
        line-height:1.45;
      }

      .pp-result {
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:9px;
        margin-bottom:12px;
      }

      .pp-result-item {
        display:flex;
        align-items:center;
        gap:9px;
        padding:12px 13px;
        border:1px solid #e5e9ef;
        border-radius:15px;
        background:#fff;
        color:#344054;
        font-size:11.7px;
        font-weight:720;
        line-height:1.3;
      }

      .pp-check {
        display:grid;
        place-items:center;
        flex:0 0 28px;
        width:28px;
        height:28px;
        border-radius:9px;
        background:#ecfdf3;
        color:#168553;
      }

      .pp-check svg { width:16px; height:16px; stroke-width:2.2; }

      .pp-action {
        display:grid;
        grid-template-columns:1fr auto;
        align-items:center;
        gap:15px;
        padding:20px 22px;
        border-radius:21px;
        background:#20b15a;
        color:#fff;
        text-decoration:none;
        box-shadow:0 18px 35px rgba(32,177,90,.20);
        transition:transform .18s ease, box-shadow .18s ease;
      }

      .pp-action:hover {
        transform:translateY(-2px);
        box-shadow:0 22px 42px rgba(32,177,90,.27);
      }

      .pp-action small {
        display:block;
        margin-bottom:4px;
        color:rgba(255,255,255,.82);
        font-size:10.5px;
        font-weight:780;
        letter-spacing:.45px;
        text-transform:uppercase;
      }

      .pp-action strong {
        display:block;
        color:#fff;
        font-size:20px;
        line-height:1.18;
      }

      .pp-action-arrow {
        display:grid;
        place-items:center;
        width:48px;
        height:48px;
        border-radius:50%;
        background:rgba(255,255,255,.16);
      }

      .pp-action-arrow svg { width:22px; height:22px; }

      .pp-helper {
        margin:8px 0 0;
        color:#7b8492;
        font-size:10.5px;
        text-align:center;
      }

      @media (max-width:720px) {
        .pitch-proposal-page .pp-hero { margin:26px 0 18px; }
        .pitch-proposal-page .pp-hero h2 {
          font-size:31px;
          line-height:1.05;
          letter-spacing:-1.25px;
        }
        .pitch-proposal-page .pp-hero p { font-size:14px; }
        .pp-offer-head { align-items:flex-start; flex-direction:column; }
        .pp-solutions,
        .pp-result { grid-template-columns:1fr; }
        .pp-solution { min-height:0; padding:17px; }
        .pp-seven { grid-template-columns:auto 1fr; }
        .pp-action strong { font-size:18px; }
      }

      @media print {
        .pp-action { box-shadow:none !important; }
      }
    `;

    document.head.appendChild(style);
  };

  const render = () => {
    const proposal = readProposal();
    const page = document.querySelector('[data-page="cta"]');
    if (!proposal || !page) return false;

    injectStyles();

    const companyRaw = proposal.company || "sua empresa";
    const company = esc(companyRaw);
    const currentHref = page.querySelector("#whatsappReportBtn")?.href || "#";
    const whatsappHref = buildWhatsappUrl(currentHref, companyRaw);

    page.classList.remove("cta-light-page");
    page.classList.add("pitch-proposal-page");

    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">07 · Plano de ação</span>
        <span class="mini-company">${company}</span>
      </div>

      <div class="pp-hero">
        <span class="pp-eyebrow">Proposta de reestruturação local</span>
        <h2>O diagnóstico mostrou o problema. <em>Agora vamos corrigir a estrutura.</em></h2>
        <p>Para ${company}, a estratégia é fortalecer presença, confiança e conversão nos pontos que mais influenciam a decisão antes do contato.</p>
      </div>

      <div class="pp-offer-head">
        <div>
          <span class="pp-label">Plano recomendado</span>
          <strong>Reestruturação de Presença Local</strong>
        </div>
        <span class="pp-time">Execução em até 7 dias</span>
      </div>

      <section class="pp-solutions">
        <article class="pp-solution">
          <span class="pp-solution-icon">${icon("google")}</span>
          <h3>Google reestruturado</h3>
          <p>Reorganizamos o perfil para apresentar melhor a empresa, os serviços, os contatos e os sinais de confiança.</p>
          <b>Objetivo: ser encontrado e considerado com mais força.</b>
        </article>

        <article class="pp-solution">
          <span class="pp-solution-icon">${icon("site")}</span>
          <h3>Site profissional</h3>
          <p>Criamos uma presença própria, rápida e responsiva, conectada ao Google e preparada para conduzir o visitante ao contato.</p>
          <b>Objetivo: transformar pesquisa em confiança e ação.</b>
        </article>

        <article class="pp-solution">
          <span class="pp-solution-icon">${icon("review")}</span>
          <h3>Sistema de avaliações</h3>
          <p>Estruturamos um caminho simples para clientes satisfeitos avaliarem a empresa com link e QR, fortalecendo a prova social.</p>
          <b>Objetivo: aumentar o volume de confiança pública ao longo do tempo.</b>
        </article>
      </section>

      <section class="pp-seven">
        <div class="pp-seven-number">7</div>
        <div class="pp-seven-copy">
          <span>Plano de execução</span>
          <strong>Em até 7 dias, a nova base local fica estruturada.</strong>
          <p>Entramos com Google, site e sistema de avaliações como uma única estratégia — não como ações soltas.</p>
        </div>
      </section>

      <div class="pp-result">
        <div class="pp-result-item"><span class="pp-check">${icon("check")}</span>Mais clareza para ser encontrado</div>
        <div class="pp-result-item"><span class="pp-check">${icon("check")}</span>Mais confiança na comparação</div>
        <div class="pp-result-item"><span class="pp-check">${icon("check")}</span>Contato mais simples e direto</div>
      </div>

      <a
        id="whatsappReportBtn"
        class="pp-action"
        href="${esc(whatsappHref)}"
        target="_blank"
        rel="noopener">
        <div>
          <small>Quero aproveitar esta oportunidade</small>
          <strong>Falar com a equipe e garantir a reestruturação hoje</strong>
        </div>
        <span class="pp-action-arrow">${icon("arrow")}</span>
      </a>

      <p class="pp-helper">Você vai direto para o WhatsApp com o contexto deste diagnóstico.</p>

      <footer class="page-footer"><span>Radar Local · Plano de Reestruturação</span><span>07</span></footer>
    `;

    return true;
  };

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 35) clearInterval(timer);
  }, 250);
})();
