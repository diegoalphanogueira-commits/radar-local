/* =========================================================
   RADAR LOCAL — CTA POLISH
   Ajustes finais do fechamento para desktop/mobile.
========================================================= */

(() => {
  const apply = () => {
    const page = document.querySelector('[data-page="cta"].cta-light-page');
    if (!page) return false;

    if (!document.getElementById("radarCtaPolishStyles")) {
      const style = document.createElement("style");
      style.id = "radarCtaPolishStyles";
      style.textContent = `
        .cta-light-page .cl-helper {
          margin: 11px 0 0;
          color: #667085;
          font-size: 11.5px;
          font-weight: 500;
        }

        .cta-light-page .cl-close {
          min-height: 0;
          margin-top: 16px;
          padding: 13px 0 0;
          border-top: 1px solid #e4e7ec;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cta-light-page .cl-close-mark {
          width: auto;
          height: auto;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #2f6bff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .8px;
          text-transform: uppercase;
        }

        .cta-light-page .cl-close strong {
          font-size: 12px;
          line-height: 1.2;
        }

        .cta-light-page .cl-close span:not(.cl-close-mark) {
          margin-top: 1px;
          font-size: 10px;
          line-height: 1.25;
        }

        .cta-light-page .page-footer {
          margin-top: 12px;
        }

        @media (max-width: 720px) {
          .cta-light-page .cl-close {
            margin-top: 14px;
            padding-top: 12px;
          }

          .cta-light-page .cl-close span:not(.cl-close-mark) {
            font-size: 10.5px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const mark = page.querySelector('.cl-close-mark');
    if (mark) mark.textContent = 'RADAR';

    const brandText = page.querySelector('.cl-close > div > span');
    if (brandText) brandText.textContent = 'Diagnóstico local para transformar leitura em ação.';

    return true;
  };

  if (apply()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (apply() || attempts >= 30) clearInterval(timer);
  }, 250);
})();
