/* =========================================================
   RADAR LOCAL — BENCHMARK TOP 5
   Usa os 5 concorrentes de maior prova social dentro da
   amostra local como referência para médias do benchmark.
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

  const average = values => {
    const valid = values
      .map(Number)
      .filter(Number.isFinite);

    if (!valid.length) return null;

    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  };

  const formatRating = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    }).format(n);
  };

  const formatReviews = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0
    }).format(Math.round(n));
  };

  const applyTop5Benchmark = benchmarkOverride => {
    const proposal = readProposal();
    const benchmark = benchmarkOverride || proposal?.benchmark;
    const page = document.querySelector('[data-page="benchmark"]');

    if (!benchmark || !page) return false;

    const topFive = Array.isArray(benchmark.topCompetitors)
      ? benchmark.topCompetitors.slice(0, 5)
      : [];

    if (!topFive.length) return false;

    const averageRating = average(
      topFive.map(item => item?.rating)
    );

    const averageReviews = average(
      topFive.map(item => item?.userRatingCount)
    );

    const subjectReviews = Number(
      benchmark.subject?.userRatingCount
    );

    const hasReviewAverage = Number.isFinite(averageReviews);
    const hasSubjectReviews = Number.isFinite(subjectReviews);
    const gap = hasReviewAverage && hasSubjectReviews
      ? Math.max(0, Math.ceil(averageReviews - subjectReviews))
      : null;

    const marketCard = page.querySelector('.bl-card.market');

    if (marketCard) {
      const count = marketCard.querySelector('.bl-market-count');
      if (count) {
        count.textContent = `${topFive.length} principais concorrentes`;
      }

      const metricValues = marketCard.querySelectorAll('.bl-metric-copy strong');
      const metricLabels = marketCard.querySelectorAll('.bl-metric-copy span');

      if (metricValues[0]) {
        metricValues[0].textContent = formatRating(averageRating);
      }

      if (metricLabels[0]) {
        metricLabels[0].textContent = 'nota média dos 5 principais';
      }

      if (metricValues[1]) {
        metricValues[1].textContent = formatReviews(averageReviews);
      }

      if (metricLabels[1]) {
        metricLabels[1].textContent = 'média de avaliações';
      }
    }

    const gapBlock = page.querySelector('.bl-gap');
    const gapNumber = page.querySelector('.bl-gap-number');
    const gapTitle = page.querySelector('.bl-gap-copy strong');
    const gapText = page.querySelector('.bl-gap-copy p');

    if (gapBlock && gap !== null) {
      gapBlock.classList.toggle('attention', gap > 0);
      gapBlock.classList.toggle('positive', gap === 0);
    }

    if (gapNumber && gap !== null) {
      gapNumber.textContent = gap > 0 ? formatReviews(gap) : '✓';
    }

    if (gapTitle && gap !== null) {
      gapTitle.textContent = gap > 0
        ? 'Seu principal gap hoje está na prova social.'
        : 'Sua prova social já está no nível dos principais concorrentes.';
    }

    if (gapText && gap !== null) {
      gapText.textContent = gap > 0
        ? `Sua nota pode ser forte, mas faltam cerca de ${formatReviews(gap)} avaliações para alcançar a média dos 5 principais concorrentes do raio analisado.`
        : 'Seu volume de avaliações já alcança ou supera a média dos 5 principais concorrentes usados como referência.';
    }

    const topSubtitle = page.querySelector('.bl-top-head p');
    if (topSubtitle) {
      topSubtitle.textContent = 'Três destaques entre os 5 concorrentes usados como referência.';
    }

    const method = page.querySelector('.bl-method');
    if (method) {
      const total = Number(benchmark.sample?.competitorCount);
      const totalText = Number.isFinite(total)
        ? `${Math.round(total)} negócios semelhantes foram observados no raio. `
        : '';

      method.textContent = `* ${totalText}As médias desta página usam os 5 concorrentes com maior volume de avaliações dentro da amostra retornada pelo Google Places. Não representam ranking oficial do Google.`;
    }

    return true;
  };

  window.addEventListener('radar:benchmark-ready', event => {
    setTimeout(() => applyTop5Benchmark(event.detail), 80);
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;

    if (applyTop5Benchmark() || attempts >= 40) {
      clearInterval(timer);
    }
  }, 250);
})();
