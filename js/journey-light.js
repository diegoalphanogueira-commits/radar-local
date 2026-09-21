/* =========================================================
   RADAR LOCAL — JORNADA LIGHT
   Reorganiza a página de gargalo para leitura rápida,
   visual e confortável no desktop e no celular.
========================================================= */

(() => {
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const text = (page, selector, fallback = "—") => {
    const value = page.querySelector(selector)?.textContent?.trim();
    return value || fallback;
  };

  const injectStyles = () => {
    if (document.getElementById("radarJourneyLightStyles")) return;

    const style = document.createElement("style");
    style.id = "radarJourneyLightStyles";
    style.textContent = `
      .journey-light-page {
        background: radial-gradient(circle at 92% 6%, rgba(47,107,255,.07), transparent 26%), #fbfaf8;
      }

      .journey-light-page .jl-hero {
        margin: 34px 0 24px;
        max-width: 680px;
      }

      .journey-light-page .jl-hero h2 {
        margin: 8px 0 12px;
        color: #101828;
        font-size: 38px;
        line-height: 1.04;
        letter-spacing: -1.8px;
      }

      .journey-light-page .jl-hero h2 em {
        color: #2f6bff;
        font-style: normal;
      }

      .journey-light-page .jl-hero p {
        margin: 0;
        max-width: 620px;
        color: #667085;
        font-size: 14px;
        line-height: 1.55;
      }

      .jl-flow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }

      .jl-step {
        position: relative;
        min-height: 118px;
        padding: 17px;
        border: 1px solid #e4e7ec;
        border-radius: 19px;
        background: #fff;
      }

      .jl-step::after {
        content: "";
        position: absolute;
        left: 17px;
        right: 17px;
        bottom: 0;
        height: 3px;
        border-radius: 99px 99px 0 0;
        background: #e4e7ec;
      }

      .jl-step.active {
        border-color: #bfd3ff;
        background: #f4f7ff;
        box-shadow: 0 8px 22px rgba(47,107,255,.08);
      }

      .jl-step.active::after { background: #2f6bff; }

      .jl-step-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        margin-bottom: 13px;
        border-radius: 10px;
        background: #f2f4f7;
        color: #667085;
        font-size: 11px;
        font-weight: 850;
      }

      .jl-step.active .jl-step-number {
        background: #eaf1ff;
        color: #2f6bff;
      }

      .jl-step strong {
        display: block;
        color: #101828;
        font-size: 16px;
        line-height: 1.25;
      }

      .jl-step small {
        display: block;
        margin-top: 5px;
        color: #7b8494;
        font-size: 11px;
        line-height: 1.35;
      }

      .jl-bottleneck {
        display: grid;
        grid-template-columns: 118px minmax(0, 1fr);
        gap: 22px;
        align-items: center;
        margin-bottom: 15px;
        padding: 22px;
        border-radius: 22px;
        background: linear-gradient(135deg, #17233d, #223b73);
        color: #fff;
        box-shadow: 0 16px 34px rgba(23,35,61,.14);
      }

      .jl-score {
        display: grid;
        place-items: center;
        width: 108px;
        height: 108px;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 50%;
        background: rgba(255,255,255,.07);
      }

      .jl-score div {
        display: flex;
        align-items: baseline;
        gap: 3px;
      }

      .jl-score strong {
        font-size: 42px;
        line-height: 1;
        letter-spacing: -2px;
      }

      .jl-score span {
        color: rgba(255,255,255,.72);
        font-size: 13px;
      }

      .jl-bottleneck-copy > span,
      .jl-reading > span,
      .jl-good-news > span {
        display: block;
        margin-bottom: 7px;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .75px;
        text-transform: uppercase;
      }

      .jl-bottleneck-copy > span { color: #9fbcff; }

      .jl-bottleneck-copy h3 {
        margin: 0;
        font-size: 27px;
        line-height: 1.1;
        letter-spacing: -.7px;
      }

      .jl-bottleneck-copy p {
        margin: 8px 0 0;
        max-width: 520px;
        color: rgba(255,255,255,.76);
        font-size: 13px;
        line-height: 1.5;
      }

      .jl-bottom {
        display: grid;
        grid-template-columns: 1.25fr .75fr;
        gap: 13px;
      }

      .jl-reading,
      .jl-good-news {
        padding: 19px 20px;
        border: 1px solid #e4e7ec;
        border-radius: 20px;
        background: #fff;
      }

      .jl-reading > span { color: #2f6bff; }
      .jl-good-news > span { color: #15803d; }

      .jl-reading strong {
        display: block;
        color: #1d2939;
        font-size: 17px;
        line-height: 1.38;
      }

      .jl-good-news {
        border-color: #cbeed6;
        background: #f1fbf4;
      }

      .jl-good-news strong {
        display: block;
        color: #14532d;
        font-size: 17px;
        line-height: 1.32;
      }

      .jl-good-news p {
        margin: 6px 0 0;
        color: #4f6d59;
        font-size: 12px;
        line-height: 1.45;
      }

      @media (max-width: 720px) {
        .journey-light-page .jl-hero {
          margin: 28px 0 20px;
        }

        .journey-light-page .jl-hero h2 {
          font-size: 31px;
          line-height: 1.06;
        }

        .journey-light-page .jl-hero p {
          font-size: 14px;
        }

        .jl-flow {
          grid-template-columns: 1fr 1fr;
        }

        .jl-step {
          min-height: 112px;
        }

        .jl-bottleneck {
          grid-template-columns: 1fr;
          gap: 14px;
          padding: 20px;
        }

        .jl-score {
          width: 92px;
          height: 92px;
        }

        .jl-score strong { font-size: 36px; }
        .jl-bottleneck-copy h3 { font-size: 24px; }

        .jl-bottom {
          grid-template-columns: 1fr;
        }

        .jl-reading strong,
        .jl-good-news strong {
          font-size: 17px;
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

  const activeStepFromTitle = value => {
    const normalized = String(value || "").toLowerCase();
    if (normalized.includes("descob")) return 2;
    if (normalized.includes("autor") || normalized.includes("confian") || normalized.includes("compar")) return 3;
    if (normalized.includes("contato") || normalized.includes("convers")) return 4;
    return 2;
  };

  const render = () => {
    const page = document.querySelector('[data-page="journey"]');
    if (!page) return false;

    const company = page.querySelector("[data-company]")?.textContent?.trim() || "Sua empresa";
    const weakestScore = text(page, "#weakestScore", "0");
    const weakestTitle = text(page, "#weakestTitle", "Ponto de atenção");
    const weakestDescription = text(page, "#weakestDescription", "Este é o ponto com maior espaço para evolução.");
    const businessReading = text(page, "#businessReading", "Parte da oportunidade pode estar se perdendo antes mesmo de o cliente iniciar uma conversa.");
    const activeStep = activeStepFromTitle(weakestTitle);

    injectStyles();
    page.classList.add("journey-light-page");

    const steps = [
      ["01", "Procura", "preciso disso"],
      ["02", "Descoberta", "quem aparece?"],
      ["03", "Comparação", "em quem confio?"],
      ["04", "Contato", "vou chamar"]
    ].map((step, index) => `
      <article class="jl-step ${activeStep === index + 1 ? "active" : ""}">
        <span class="jl-step-number">${step[0]}</span>
        <strong>${step[1]}</strong>
        <small>“${step[2]}”</small>
      </article>
    `).join("");

    page.innerHTML = `
      <div class="page-topline">
        <span class="page-label">06 · Onde a oportunidade escapa</span>
        <span class="mini-company">${esc(company)}</span>
      </div>

      <div class="jl-hero">
        <span class="eyebrow">Antes do contato</span>
        <h2>A oportunidade pode escapar <em>antes da conversa começar.</em></h2>
        <p>O cliente passa por etapas até decidir com quem falar. Quando uma delas perde força, outra empresa pode entrar na frente.</p>
      </div>

      <div class="jl-flow">${steps}</div>

      <article class="jl-bottleneck">
        <div class="jl-score">
          <div><strong>${esc(weakestScore)}</strong><span>/100</span></div>
        </div>
        <div class="jl-bottleneck-copy">
          <span>Principal ponto de atenção</span>
          <h3>${esc(weakestTitle)}</h3>
          <p>${esc(weakestDescription)}</p>
        </div>
      </article>

      <div class="jl-bottom">
        <article class="jl-reading">
          <span>O que isso significa</span>
          <strong>${esc(businessReading)}</strong>
        </article>

        <article class="jl-good-news">
          <span>Boa notícia</span>
          <strong>Nem sempre é preciso trazer mais tráfego.</strong>
          <p>Primeiro fortaleça o ponto que está fazendo a oportunidade escapar.</p>
        </article>
      </div>

      <footer class="page-footer"><span>Diagnóstico de Oportunidade Local</span><span>06</span></footer>
    `;

    renumber();
    return true;
  };

  if (render()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (render() || attempts >= 20) clearInterval(timer);
  }, 250);
})();
