/* =========================================================
   RADAR LOCAL — RELATÓRIO SEM SEGMENTO
   Remove classificações manuais de segmento da leitura final.
========================================================= */

(() => {
  const readProposal = () => {
    try {
      return JSON.parse(localStorage.getItem("radarProposal") || "null");
    } catch {
      return null;
    }
  };

  const apply = () => {
    const proposal = readProposal();
    if (!proposal) return false;

    const region = proposal.region || "região analisada";
    const company = proposal.company || "Sua empresa";

    /* CAPA — remove o card visual de segmento. */
    const segmentHero = document.getElementById("segmentHero");
    const segmentCard = segmentHero?.closest("article");
    if (segmentCard) segmentCard.remove();

    const companyGrid = document.querySelector(".cover-page .company-grid");
    if (companyGrid) {
      companyGrid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    }

    const coverDescription = document.getElementById("coverDescription");
    if (coverDescription) {
      coverDescription.textContent =
        `Analisamos o cenário local em ${region} para entender quanto da procura pode estar passando sem chegar até a ${company}.`;
    }

    /* DEMANDA — remove qualquer rótulo de segmento da frase. */
    const demandPage = document.querySelector('[data-page="demand"]');
    const demandHeroText = demandPage?.querySelector(".dl-hero p");
    if (demandHeroText) {
      demandHeroText.textContent =
        `O Radar estimou sinais de procura relacionados ao negócio dentro do raio analisado em ${region}.`;
    }

    const legacyDemandIntro = document.getElementById("demandIntro");
    if (legacyDemandIntro) {
      legacyDemandIntro.textContent =
        `O Radar estimou sinais de procura relacionados ao negócio dentro do raio analisado em ${region}.`;
    }

    return true;
  };

  if (apply()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (apply() || attempts >= 30) clearInterval(timer);
  }, 300);
})();
