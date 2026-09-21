/* =========================================================
   RADAR LOCAL — ENTREGA PROFISSIONAL DO PDF
   Usa o nome canônico da empresa e evita compartilhar blob URL.
========================================================= */

(() => {
  const REPORT_KEY = "radarProposal";

  const readReport = () => {
    try {
      return JSON.parse(localStorage.getItem(REPORT_KEY) || "null");
    } catch {
      return null;
    }
  };

  const canonicalCompanyName = () => {
    const report = readReport();

    const name = String(
      report?.googlePlace?.name ||
      report?.company ||
      "Empresa"
    )
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .trim();

    return name || "Empresa";
  };

  const safeFileNamePart = value => String(value || "Empresa")
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110) || "Empresa";

  const getCanonicalPdfFileName = () =>
    `Diagnóstico de Oportunidade Local - ${safeFileNamePart(canonicalCompanyName())}.pdf`;

  const shareText = company =>
    `Segue o diagnóstico personalizado preparado pelo Radar Local para ${company}.`;

  const isAppleMobile = () => {
    const ua = navigator.userAgent || "";
    const classicIOS = /iPad|iPhone|iPod/i.test(ua);
    const modernIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return classicIOS || modernIPad;
  };

  window.getPdfFileName = getCanonicalPdfFileName;

  window.deliverPdf = async function deliverPdfProfessional(pdf) {
    const company = canonicalCompanyName();
    const fileName = getCanonicalPdfFileName();

    try {
      if (typeof pdf?.setProperties === "function") {
        pdf.setProperties({
          title: `Diagnóstico de Oportunidade Local - ${company}`,
          subject: "Análise de oportunidade e capacidade de captura local",
          author: "Radar Local",
          creator: "Radar Local"
        });
      }
    } catch {}

    const pdfBlob = pdf.output("blob");

    if (
      typeof File !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      const file = new File(
        [pdfBlob],
        fileName,
        {
          type: "application/pdf",
          lastModified: Date.now()
        }
      );

      const fullPayload = {
        title: `Diagnóstico de Oportunidade Local - ${company}`,
        text: shareText(company),
        files: [file]
      };

      const fileOnlyPayload = {
        title: `Diagnóstico de Oportunidade Local - ${company}`,
        files: [file]
      };

      const canShareFile =
        typeof navigator.canShare !== "function" ||
        navigator.canShare({ files: [file] });

      /*
        No iPhone/iPad priorizamos arquivo puro. Alguns Safari/iOS,
        especialmente em navegação privada, podem anexar blob:https://...
        como legenda quando texto e arquivo são compartilhados juntos.
      */
      if (isAppleMobile() && canShareFile) {
        try {
          await navigator.share(fileOnlyPayload);
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
          console.warn("Compartilhamento direto do PDF no iOS não disponível:", error);
        }
      }

      try {
        if (canShareFile) {
          await navigator.share(fullPayload);
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("Compartilhamento com texto não disponível:", error);
      }

      try {
        if (canShareFile) {
          await navigator.share(fileOnlyPayload);
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn("Compartilhamento direto do PDF não disponível:", error);
      }
    }

    /*
      Fallback profissional: baixa o arquivo com o nome correto.
      Não abrimos nova aba com URL blob.
    */
    try {
      if (typeof pdf?.save === "function") {
        pdf.save(fileName);
        return;
      }
    } catch (error) {
      console.warn("Download direto pelo jsPDF falhou:", error);
    }

    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  window.RadarPdfDelivery = {
    getCompanyName: canonicalCompanyName,
    getFileName: getCanonicalPdfFileName
  };
})();
