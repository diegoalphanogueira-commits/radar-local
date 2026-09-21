/* =========================================================
   RADAR LOCAL — PDF MOBILE VISUAL HQ
   Exporta cada seção com o mesmo layout usado no celular,
   em qualidade próxima de 300 DPI e com CTA clicável.
========================================================= */

(() => {
  const MOBILE_VIEWPORT_WIDTH = 430;
  const MOBILE_VIEWPORT_HEIGHT = 932;
  const PDF_WIDTH_MM = 108;
  const CAPTURE_SCALE = 3;
  const JPEG_QUALITY = 0.985;

  const waitFrame = () =>
    new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const pageSelector = page => {
    const key = page?.getAttribute?.("data-page");
    return key ? `.pdf-page[data-page="${CSS.escape(key)}"]` : null;
  };

  const waitForImages = async root => {
    const images = Array.from(root?.querySelectorAll?.("img") || []);

    await Promise.all(
      images.map(async image => {
        if (image.complete && image.naturalWidth > 0) {
          try {
            if (typeof image.decode === "function") await image.decode();
          } catch {}
          return;
        }

        await new Promise(resolve => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      })
    );
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
      documentElement.style.boxSizing = "border-box";
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
      page.style.boxSizing = "border-box";
    }
  };

  async function captureMobilePage(page) {
    const selector = pageSelector(page);

    return html2canvas(page, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#f1f3f4",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: MOBILE_VIEWPORT_WIDTH,
      windowHeight: MOBILE_VIEWPORT_HEIGHT,
      imageTimeout: 15000,
      removeContainer: true,
      onclone: clonedDoc => prepareMobileClone(clonedDoc, selector)
    });
  }

  const currentWhatsappHref = button => {
    const directHref = button?.href || button?.getAttribute?.("href") || "";

    if (/^https?:\/\//i.test(directHref)) {
      return directHref;
    }

    if (typeof getReportWhatsappUrl === "function") {
      try {
        return getReportWhatsappUrl() || directHref;
      } catch {
        return directHref;
      }
    }

    return directHref;
  };

  /*
    Mede a posição do botão dentro de um iframe de 430 px.
    Assim a anotação do PDF acompanha exatamente o layout mobile,
    mesmo quando o PDF é gerado a partir de um computador.
  */
  const measureMobileButton = async page => {
    const iframe = document.createElement("iframe");

    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = `${MOBILE_VIEWPORT_WIDTH}px`;
    iframe.style.height = `${MOBILE_VIEWPORT_HEIGHT}px`;
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    iframe.style.pointerEvents = "none";

    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentDocument;
      if (!doc) return null;

      const headAssets = Array.from(
        document.head.querySelectorAll('style, link[rel="stylesheet"]')
      )
        .map(node => node.outerHTML)
        .join("\n");

      doc.open();
      doc.write(`<!doctype html>
        <html>
          <head>
            <base href="${document.baseURI}">
            ${headAssets}
          </head>
          <body style="margin:0;background:#f1f3f4;">
            <div class="proposal-document" style="width:${MOBILE_VIEWPORT_WIDTH}px;max-width:${MOBILE_VIEWPORT_WIDTH}px;min-width:0;padding:8px;box-sizing:border-box;overflow:visible;">
              ${page.outerHTML}
            </div>
          </body>
        </html>`);
      doc.close();

      await wait(80);

      if (doc.fonts?.ready) {
        try {
          await doc.fonts.ready;
        } catch {}
      }

      await waitForImages(doc);
      await wait(30);

      const clonedPage = doc.querySelector(".pdf-page");
      const clonedButton = doc.querySelector("#whatsappReportBtn");

      if (!clonedPage || !clonedButton) return null;

      clonedPage.style.width = "100%";
      clonedPage.style.maxWidth = "100%";
      clonedPage.style.minWidth = "0";
      clonedPage.style.height = "auto";
      clonedPage.style.minHeight = "0";
      clonedPage.style.maxHeight = "none";
      clonedPage.style.margin = "0";
      clonedPage.style.overflow = "hidden";
      clonedPage.style.boxSizing = "border-box";

      await wait(20);

      const pageRect = clonedPage.getBoundingClientRect();
      const buttonRect = clonedButton.getBoundingClientRect();

      if (
        !pageRect.width ||
        !pageRect.height ||
        !buttonRect.width ||
        !buttonRect.height
      ) {
        return null;
      }

      return {
        xRatio: (buttonRect.left - pageRect.left) / pageRect.width,
        yRatio: (buttonRect.top - pageRect.top) / pageRect.height,
        widthRatio: buttonRect.width / pageRect.width,
        heightRatio: buttonRect.height / pageRect.height
      };
    } catch (error) {
      console.warn("Não foi possível medir o CTA mobile do PDF:", error);
      return null;
    } finally {
      iframe.remove();
    }
  };

  const addWhatsappLink = async ({ pdf, page, pdfHeightMm }) => {
    const button = page.querySelector("#whatsappReportBtn");
    if (!button) return;

    const href = currentWhatsappHref(button);
    if (!href) return;

    const measured = await measureMobileButton(page);

    if (measured) {
      const paddingMm = 1.2;
      const x = Math.max(0, measured.xRatio * PDF_WIDTH_MM - paddingMm);
      const y = Math.max(0, measured.yRatio * pdfHeightMm - paddingMm);
      const width = Math.min(
        PDF_WIDTH_MM - x,
        measured.widthRatio * PDF_WIDTH_MM + paddingMm * 2
      );
      const height = Math.min(
        pdfHeightMm - y,
        measured.heightRatio * pdfHeightMm + paddingMm * 2
      );

      if (width > 0 && height > 0) {
        pdf.link(x, y, width, height, { url: href });
        return;
      }
    }

    /* Fallback seguro caso algum visualizador/browser impeça a medição. */
    const fallbackY = Math.max(0, pdfHeightMm * 0.78);
    pdf.link(
      8,
      fallbackY,
      PDF_WIDTH_MM - 16,
      Math.min(34, pdfHeightMm - fallbackY - 5),
      { url: href }
    );
  };

  /*
    Sobrescreve a função global usada pelo botão já existente.
    O listener legado continua funcionando, mas passa a chamar
    esta versão no momento do clique.
  */
  window.generateVisualPdf = async function generateVisualPdfMobileHQ() {
    if (typeof html2canvas === "undefined" || !window.jspdf) {
      throw new Error("As bibliotecas de PDF não foram carregadas.");
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await waitForImages(document);

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
          compress: true,
          precision: 12
        });

        pdf.setProperties({
          title: `Diagnóstico de Oportunidade Local - ${typeof safeText === "function" ? safeText(proposalData?.company, "Empresa") : "Empresa"}`,
          subject: "Análise de oportunidade e capacidade de captura local",
          author: "Radar Local",
          creator: "Radar Local",
          keywords: "Radar Local, oportunidade local, diagnóstico local"
        });
      } else {
        pdf.addPage(format, orientation);
      }

      /*
        430 px x escala 3 = 1290 px para 108 mm.
        Isso entrega aproximadamente 303 DPI na largura.
      */
      const imageData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      pdf.addImage(
        imageData,
        "JPEG",
        0,
        0,
        PDF_WIDTH_MM,
        pdfHeightMm,
        undefined,
        "NONE"
      );

      if (page.classList.contains("cta-page")) {
        await addWhatsappLink({ pdf, page, pdfHeightMm });
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
