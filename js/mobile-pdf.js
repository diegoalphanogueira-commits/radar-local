/* =========================================================
   RADAR LOCAL — PDF MOBILE VISUAL
   Exporta cada seção com o mesmo layout usado no celular,
   sem forçar A4 e sem distorcer a proporção da página.
========================================================= */

(() => {
  const MOBILE_VIEWPORT_WIDTH = 430;
  const MOBILE_VIEWPORT_HEIGHT = 932;
  const PDF_WIDTH_MM = 108;

  const waitFrame = () =>
    new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

  const pageSelector = page => {
    const key = page?.getAttribute?.("data-page");
    return key ? `.pdf-page[data-page="${CSS.escape(key)}"]` : null;
  };

  const prepareMobileClone = (clonedDoc, selector) => {
    const html = clonedDoc.documentElement;
    const body = clonedDoc.body;

    html.style.width = `${MOBILE_VIEWPORT_WIDTH}px`;
    html.style.maxWidth = `${MOBILE_VIEWPORT_WIDTH}px`;
    html.style.overflow = "visible";
    html.style.background = "#f1f3f4";

    body.style.width = `${MOBILE_VIEWPORT_WIDTH}px`;
    body.style.maxWidth = `${MOBILE_VIEWPORT_WIDTH}px`;
    body.style.minWidth = "0";
    body.style.margin = "0";
    body.style.overflow = "visible";
    body.style.background = "#f1f3f4";

    const toolbar = clonedDoc.querySelector(".proposal-toolbar");
    if (toolbar) toolbar.style.display = "none";

    const documentElement = clonedDoc.querySelector(".proposal-document");
    if (documentElement) {
      documentElement.style.width = "100%";
      documentElement.style.maxWidth = "100%";
      documentElement.style.minWidth = "0";
      documentElement.style.padding = "8px";
      documentElement.style.overflow = "visible";
    }

    const page = selector ? clonedDoc.querySelector(selector) : null;
    if (page) {
      page.style.width = "100%";
      page.style.maxWidth = "100%";
      page.style.minWidth = "0";
      page.style.height = "auto";
      page.style.minHeight = "0";
      page.style.maxHeight = "none";
      page.style.margin = "0";
      page.style.overflow = "hidden";
    }
  };

  async function captureMobilePage(page) {
    const selector = pageSelector(page);

    return html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#f1f3f4",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: MOBILE_VIEWPORT_WIDTH,
      windowHeight: MOBILE_VIEWPORT_HEIGHT,
      onclone: clonedDoc => prepareMobileClone(clonedDoc, selector)
    });
  }

  /*
    Sobrescreve a função global usada pelo botão já existente.
    O listener legado continua funcionando, mas passa a chamar
    esta versão no momento do clique.
  */
  window.generateVisualPdf = async function generateVisualPdfMobile() {
    if (typeof html2canvas === "undefined" || !window.jspdf) {
      throw new Error("As bibliotecas de PDF não foram carregadas.");
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    try {
      if (typeof radarMapReady !== "undefined") {
        await radarMapReady;
      }
    } catch (error) {
      console.warn("Mapa ainda não terminou de carregar:", error);
    }

    await waitFrame();

    const pages = Array.from(document.querySelectorAll(".pdf-page"));
    if (!pages.length) {
      throw new Error("Nenhuma página do diagnóstico foi encontrada.");
    }

    const { jsPDF } = window.jspdf;
    let pdf = null;

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const canvas = await captureMobilePage(page);

      if (!canvas.width || !canvas.height) {
        throw new Error(`Falha ao capturar a página ${index + 1}.`);
      }

      const pdfHeightMm = PDF_WIDTH_MM * (canvas.height / canvas.width);
      const format = [PDF_WIDTH_MM, pdfHeightMm];
      const orientation = pdfHeightMm >= PDF_WIDTH_MM ? "portrait" : "landscape";

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "mm",
          format,
          compress: true
        });

        pdf.setProperties({
          title: `Diagnóstico de Oportunidade Local — ${typeof safeText === "function" ? safeText(proposalData?.company, "Empresa") : "Empresa"}`,
          subject: "Análise de oportunidade e capacidade de captura local",
          author: "Radar Local",
          creator: "Radar Local",
          keywords: "Radar Local, oportunidade local, diagnóstico local"
        });
      } else {
        pdf.addPage(format, orientation);
      }

      const imageData = canvas.toDataURL("image/jpeg", 0.96);
      pdf.addImage(
        imageData,
        "JPEG",
        0,
        0,
        PDF_WIDTH_MM,
        pdfHeightMm,
        undefined,
        "FAST"
      );

      /* Mantém o CTA final clicável no PDF. */
      if (page.classList.contains("cta-page")) {
        const button = page.querySelector("#whatsappReportBtn");
        if (button) {
          const href =
            typeof getReportWhatsappUrl === "function"
              ? getReportWhatsappUrl()
              : button.href;

          if (href) {
            /*
              O botão fica na parte inferior da página no layout mobile.
              A área clicável é propositalmente generosa para funcionar
              bem em visualizadores de PDF no celular.
            */
            const linkY = Math.max(0, pdfHeightMm * 0.72);
            pdf.link(
              8,
              linkY,
              PDF_WIDTH_MM - 16,
              Math.min(28, pdfHeightMm - linkY - 6),
              { url: href }
            );
          }
        }
      }

      canvas.width = 1;
      canvas.height = 1;
    }

    if (!pdf) {
      throw new Error("Não foi possível montar o PDF.");
    }

    return pdf;
  };
})();
