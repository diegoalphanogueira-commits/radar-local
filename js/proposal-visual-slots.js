/* =========================================================
   RADAR LOCAL — VISUAIS DA PROPOSTA
   Prepara quatro áreas para imagens WEBP na proposta final:
   Google, site, avaliações e visão completa do pacote.
========================================================= */

(() => {
  const ASSET_BASE = "assets/proposta";

  const VISUALS = [
    {
      file: `${ASSET_BASE}/google-estruturado.webp`,
      label: "Google estruturado",
      eyebrow: "Presença no Google"
    },
    {
      file: `${ASSET_BASE}/site-profissional.webp`,
      label: "Site profissional",
      eyebrow: "Presença própria"
    },
    {
      file: `${ASSET_BASE}/sistema-avaliacoes.webp`,
      label: "Sistema de avaliações",
      eyebrow: "Prova social"
    }
  ];

  const PACKAGE_VISUAL = {
    file: `${ASSET_BASE}/pacote-completo-7-dias.webp`,
    label: "Reestruturação de Presença Local",
    eyebrow: "Estratégia completa"
  };

  const injectStyles = () => {
    if (document.getElementById("radarProposalVisualSlotsStyles")) return;

    const style = document.createElement("style");
    style.id = "radarProposalVisualSlotsStyles";
    style.textContent = `
      .pitch-proposal-page .pp-solution {
        display:flex;
        flex-direction:column;
        padding:12px;
      }

      .pitch-proposal-page .pp-solution-visual,
      .pitch-proposal-page .pp-package-visual {
        position:relative;
        overflow:hidden;
        width:100%;
        isolation:isolate;
        border:1px solid #dde5ef;
        background:
          radial-gradient(circle at 20% 18%, rgba(47,107,255,.22), transparent 34%),
          linear-gradient(145deg,#0f172a 0%,#172554 100%);
      }

      .pitch-proposal-page .pp-solution-visual {
        aspect-ratio:16/9;
        min-height:108px;
        margin-bottom:14px;
        border-radius:15px;
      }

      .pitch-proposal-page .pp-solution-visual img,
      .pitch-proposal-page .pp-package-visual img {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
        z-index:2;
      }

      .pitch-proposal-page .pp-solution-visual.is-missing img,
      .pitch-proposal-page .pp-package-visual.is-missing img {
        display:none;
      }

      .pitch-proposal-page .pp-visual-fallback {
        position:absolute;
        inset:0;
        z-index:1;
        display:flex;
        flex-direction:column;
        align-items:flex-start;
        justify-content:flex-end;
        gap:4px;
        padding:14px;
        color:#fff;
      }

      .pitch-proposal-page .pp-visual-fallback::before {
        content:"";
        position:absolute;
        width:92px;
        height:92px;
        right:-22px;
        top:-24px;
        border-radius:50%;
        border:1px solid rgba(255,255,255,.14);
        box-shadow:
          0 0 0 18px rgba(255,255,255,.035),
          0 0 0 36px rgba(255,255,255,.02);
      }

      .pitch-proposal-page .pp-visual-fallback small {
        position:relative;
        color:#9fbdff;
        font-size:8.5px;
        font-weight:850;
        letter-spacing:.8px;
        text-transform:uppercase;
      }

      .pitch-proposal-page .pp-visual-fallback strong {
        position:relative;
        max-width:90%;
        color:#fff;
        font-size:14px;
        line-height:1.15;
      }

      .pitch-proposal-page .pp-solution-icon {
        width:36px;
        height:36px;
        margin-bottom:10px;
        border-radius:11px;
      }

      .pitch-proposal-page .pp-solution-icon svg {
        width:19px;
        height:19px;
      }

      .pitch-proposal-page .pp-solution h3 {
        font-size:16px;
      }

      .pitch-proposal-page .pp-solution p {
        font-size:11.5px;
      }

      .pitch-proposal-page .pp-solution b {
        margin-top:auto;
        padding-top:9px;
        font-size:10.8px;
      }

      .pitch-proposal-page .pp-package-visual {
        display:grid;
        grid-template-columns:minmax(210px,.82fr) 1.18fr;
        min-height:154px;
        margin-bottom:12px;
        border-radius:20px;
        background:#101828;
      }

      .pitch-proposal-page .pp-package-media {
        position:relative;
        min-height:154px;
        overflow:hidden;
        background:
          radial-gradient(circle at 30% 30%, rgba(47,107,255,.32), transparent 40%),
          linear-gradient(145deg,#0b1225,#183a77);
      }

      .pitch-proposal-page .pp-package-media .pp-visual-fallback {
        padding:20px;
      }

      .pitch-proposal-page .pp-package-media .pp-visual-fallback strong {
        font-size:18px;
      }

      .pitch-proposal-page .pp-package-copy {
        display:flex;
        flex-direction:column;
        justify-content:center;
        padding:20px 22px;
        color:#fff;
      }

      .pitch-proposal-page .pp-package-copy span {
        color:#91b3ff;
        font-size:9.5px;
        font-weight:850;
        letter-spacing:.8px;
        text-transform:uppercase;
      }

      .pitch-proposal-page .pp-package-copy strong {
        display:block;
        margin-top:6px;
        font-size:20px;
        line-height:1.15;
      }

      .pitch-proposal-page .pp-package-copy p {
        margin:7px 0 0;
        color:#c8d4e8;
        font-size:11.5px;
        line-height:1.45;
      }

      @media (max-width:720px) {
        .pitch-proposal-page .pp-solution {
          padding:12px;
        }

        .pitch-proposal-page .pp-solution-visual {
          min-height:150px;
        }

        .pitch-proposal-page .pp-package-visual {
          grid-template-columns:1fr;
        }

        .pitch-proposal-page .pp-package-media {
          min-height:190px;
        }

        .pitch-proposal-page .pp-package-copy {
          padding:18px;
        }
      }

      @media print {
        .pitch-proposal-page .pp-solution-visual,
        .pitch-proposal-page .pp-package-visual {
          print-color-adjust:exact;
          -webkit-print-color-adjust:exact;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const visualMarkup = item => `
    <div class="pp-solution-visual is-missing" data-proposal-visual="${item.file}">
      <img src="${item.file}" alt="${item.label}" decoding="async">
      <div class="pp-visual-fallback" aria-hidden="true">
        <small>${item.eyebrow}</small>
        <strong>${item.label}</strong>
      </div>
    </div>
  `;

  const bindImageState = root => {
    root.querySelectorAll("[data-proposal-visual]").forEach(container => {
      const img = container.querySelector("img");
      if (!img) return;

      const loaded = () => container.classList.remove("is-missing");
      const missing = () => container.classList.add("is-missing");

      img.addEventListener("load", loaded, { once:true });
      img.addEventListener("error", missing, { once:true });

      if (img.complete) {
        if (img.naturalWidth > 0) loaded();
        else missing();
      }
    });
  };

  const apply = () => {
    const page = document.querySelector('[data-page="cta"].pitch-proposal-page');
    if (!page) return false;

    injectStyles();

    const cards = [...page.querySelectorAll(".pp-solution")];
    cards.slice(0, 3).forEach((card, index) => {
      if (card.querySelector(".pp-solution-visual")) return;
      const item = VISUALS[index];
      if (!item) return;
      card.insertAdjacentHTML("afterbegin", visualMarkup(item));
    });

    const seven = page.querySelector(".pp-seven");
    if (seven && !page.querySelector(".pp-package-visual")) {
      seven.insertAdjacentHTML("beforebegin", `
        <section class="pp-package-visual is-missing" data-proposal-visual="${PACKAGE_VISUAL.file}">
          <div class="pp-package-media">
            <img src="${PACKAGE_VISUAL.file}" alt="${PACKAGE_VISUAL.label}" decoding="async">
            <div class="pp-visual-fallback" aria-hidden="true">
              <small>${PACKAGE_VISUAL.eyebrow}</small>
              <strong>${PACKAGE_VISUAL.label}</strong>
            </div>
          </div>
          <div class="pp-package-copy">
            <span>Pacote completo</span>
            <strong>Uma única estratégia para corrigir presença, autoridade e confiança.</strong>
            <p>Google, site e avaliações trabalhando juntos para criar uma base local mais forte antes do contato.</p>
          </div>
        </section>
      `);
    }

    bindImageState(page);
    return true;
  };

  if (apply()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (apply() || attempts >= 40) clearInterval(timer);
  }, 200);
})();
