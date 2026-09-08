/* =========================================================
   RADAR LOCAL — PROPOSTA.JS V3
========================================================= */


/* =========================================================
   CONFIGURAÇÕES COMERCIAIS
========================================================= */

const BASE_PRICE = 1290;


/*
  Taxas de referência para link de pagamento.

  A lógica abaixo considera que queremos preservar
  R$ 1.290 líquidos.

  Fórmula:

  valor cobrado =
  valor líquido / (1 - taxa)

  Exemplo:
  R$ 1.290 / (1 - 0.0967)

  Depois dividimos pelo número de parcelas.

  IMPORTANTE:
  Antes de usar comercialmente, atualize esta tabela
  caso a operadora altere as taxas.
*/

const INSTALLMENT_FEES = {

  2: 0.0609,
  3: 0.0701,
  4: 0.0791,
  5: 0.0880,
  6: 0.0967

};


/* =========================================================
   CARREGAR DADOS DA ANÁLISE
========================================================= */

const storedProposal =
  localStorage.getItem(
    "radarProposal"
  );


let proposalData = null;


try {

  proposalData =
    JSON.parse(
      storedProposal
    );

} catch (error) {

  console.error(
    "Erro ao carregar proposta:",
    error
  );

}


/* =========================================================
   ELEMENTOS PRINCIPAIS
========================================================= */

const printButton =
  document.getElementById(
    "printButton"
  );


const backButton =
  document.getElementById(
    "backButton"
  );


/* =========================================================
   UTILITÁRIOS
========================================================= */

function safeNumber(value) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}


function safeText(
  value,
  fallback = "—"
) {

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {

    return fallback;

  }

  return String(value);

}


function formatNumber(value) {

  return new Intl.NumberFormat(
    "pt-BR"
  ).format(
    safeNumber(value)
  );

}


function formatCurrency(value) {

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  ).format(
    safeNumber(value)
  );

}


function slugify(text) {

  return String(text || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );

}


function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

}


/* =========================================================
   NÍVEIS
========================================================= */

function getPresenceLabel(score) {

  score =
    safeNumber(score);


  if (score < 35) {

    return "Baixa";

  }


  if (score < 55) {

    return "Intermediária";

  }


  if (score < 75) {

    return "Boa";

  }


  return "Alta";

}


function getDemandLabel(monthly) {

  monthly =
    safeNumber(monthly);


  if (monthly < 60) {

    return "Moderada";

  }


  if (monthly < 110) {

    return "Relevante";

  }


  if (monthly < 170) {

    return "Alta";

  }


  return "Muito alta";

}


/* =========================================================
   TEMPLATE VISUAL POR SEGMENTO
========================================================= */

const WEBSITE_TEMPLATES = {


  estetica: {

    category:
      "Estética e bem-estar",

    headline:
      "Realce sua beleza com atendimento profissional e personalizado.",

    description:
      "Tratamentos pensados para valorizar sua beleza, autoestima e bem-estar.",

    background:
      "linear-gradient(145deg, #faedf8, #eef4ff)",

    accent:
      "#b552c7",

    icon:
      "✦"

  },


  podologia: {

    category:
      "Saúde e cuidado dos pés",

    headline:
      "Cuidado especializado para seus pés, conforto e bem-estar.",

    description:
      "Atendimento profissional para prevenção, tratamento e saúde dos pés.",

    background:
      "linear-gradient(145deg, #edf9f3, #eef7ff)",

    accent:
      "#3a9a74",

    icon:
      "◎"

  },


  odontologia: {

    category:
      "Odontologia",

    headline:
      "Seu sorriso merece cuidado, segurança e confiança.",

    description:
      "Atendimento odontológico completo para cuidar da saúde e estética do seu sorriso.",

    background:
      "linear-gradient(145deg, #eaf7ff, #f5fbff)",

    accent:
      "#288fd3",

    icon:
      "✦"

  },


  beleza: {

    category:
      "Beleza e autoestima",

    headline:
      "Cuidado, beleza e autoestima em cada atendimento.",

    description:
      "Serviços profissionais pensados para valorizar você em cada detalhe.",

    background:
      "linear-gradient(145deg, #fff0f5, #f6efff)",

    accent:
      "#ce5d91",

    icon:
      "✦"

  },


  assistencia: {

    category:
      "Assistência técnica",

    headline:
      "Seu equipamento funcionando novamente com rapidez e confiança.",

    description:
      "Assistência especializada para celulares, notebooks e equipamentos.",

    background:
      "linear-gradient(145deg, #eaf1ff, #f4f8ff)",

    accent:
      "#286fd2",

    icon:
      "⚙"

  },


  limpeza: {

    category:
      "Limpeza e higienização",

    headline:
      "Renove seus estofados com limpeza profissional.",

    description:
      "Higienização especializada para deixar seu ambiente mais limpo, seguro e confortável.",

    background:
      "linear-gradient(145deg, #eafbf7, #edf6ff)",

    accent:
      "#249a83",

    icon:
      "✦"

  },


  vidracaria: {

    category:
      "Vidros sob medida",

    headline:
      "Soluções em vidro que valorizam seu ambiente.",

    description:
      "Projetos personalizados para residências, comércios e empresas.",

    background:
      "linear-gradient(145deg, #eef8fb, #f4faff)",

    accent:
      "#4389a5",

    icon:
      "◇"

  },


  marmoraria: {

    category:
      "Mármore e granito",

    headline:
      "Acabamentos que transformam seu projeto.",

    description:
      "Bancadas, pias e projetos personalizados com acabamento profissional.",

    background:
      "linear-gradient(145deg, #f2f0ed, #fafafa)",

    accent:
      "#756e67",

    icon:
      "◆"

  },


  "ar-condicionado": {

    category:
      "Climatização",

    headline:
      "Mais conforto para sua casa ou empresa.",

    description:
      "Instalação, manutenção e higienização de ar-condicionado com atendimento especializado.",

    background:
      "linear-gradient(145deg, #e8f5ff, #f5fbff)",

    accent:
      "#3287cf",

    icon:
      "❄"

  },


  dedetizacao: {

    category:
      "Controle de pragas",

    headline:
      "Proteção profissional para sua casa ou empresa.",

    description:
      "Controle de pragas com atendimento especializado e soluções para diferentes ambientes.",

    background:
      "linear-gradient(145deg, #eef8e9, #f7fbf3)",

    accent:
      "#5c913d",

    icon:
      "✓"

  },


  "energia-solar": {

    category:
      "Energia solar",

    headline:
      "Transforme energia solar em economia para sua casa ou empresa.",

    description:
      "Projetos fotovoltaicos desenvolvidos para eficiência, economia e segurança.",

    background:
      "linear-gradient(145deg, #fff7dc, #edf7ff)",

    accent:
      "#dfa300",

    icon:
      "☀"

  },


  oficina: {

    category:
      "Oficina mecânica",

    headline:
      "Seu carro em boas mãos, do diagnóstico à manutenção.",

    description:
      "Serviços automotivos com atendimento profissional, clareza e confiança.",

    background:
      "linear-gradient(145deg, #edf0f4, #f8fafc)",

    accent:
      "#506479",

    icon:
      "⚙"

  },


  outro: {

    category:
      "Atendimento especializado",

    headline:
      "Uma presença profissional para quem procura seus serviços.",

    description:
      "Apresente sua empresa, seus diferenciais e facilite o contato com novos clientes.",

    background:
      "linear-gradient(145deg, #eaf2ff, #f6faff)",

    accent:
      "#1a73e8",

    icon:
      "↗"

  }

};


/* =========================================================
   PEGAR TEMPLATE
========================================================= */

function getWebsiteTemplate(
  segmentKey
) {

  return (
    WEBSITE_TEMPLATES[
      segmentKey
    ] ||
    WEBSITE_TEMPLATES.outro
  );

}


/* =========================================================
   CAPA
========================================================= */

function renderCover(data) {

  const company =
    safeText(
      data.company,
      "Sua empresa"
    );


  const segment =
    safeText(
      data.segmentLabel
    );


  const region =
    safeText(
      data.region
    );


  const radius =
    safeText(
      data.radius,
      "3"
    );


  const weekly =
    safeNumber(
      data.weekly
    );


  const monthly =
    safeNumber(
      data.monthly
    );


  const presence =
    safeNumber(
      data.presence
    );


  const uncaptured =
    safeNumber(
      data.uncaptured
    );


  const overall =
    safeNumber(
      data.overall
    );


  document.getElementById(
    "companyNameHero"
  ).textContent =
    company;


  document.getElementById(
    "companyMeta"
  ).textContent =
    company;


  document.getElementById(
    "segmentHero"
  ).textContent =
    segment;


  document.getElementById(
    "regionHero"
  ).textContent =
    region;


  document.getElementById(
    "radiusHero"
  ).textContent =
    `${radius} km`;


  document.getElementById(
    "heroScore"
  ).textContent =
    formatNumber(
      overall
    );


  document.getElementById(
    "coverWeekly"
  ).textContent =
    formatNumber(
      weekly
    );


  document.getElementById(
    "coverMonthly"
  ).textContent =
    formatNumber(
      monthly
    );


  document.getElementById(
    "coverPresence"
  ).textContent =
    formatNumber(
      presence
    );


  document.getElementById(
    "coverUncaptured"
  ).textContent =
    `${formatNumber(
      uncaptured
    )}%`;


  document.getElementById(
    "coverSummary"
  ).textContent =
    `O cenário analisado em ${region} indica uma procura estimada de ${formatNumber(
      weekly
    )} buscas por semana relacionadas aos serviços avaliados. O objetivo deste plano é fortalecer a presença da ${company} para aproveitar melhor essa demanda.`;


  const coverInsight =
    document.getElementById(
      "coverInsight"
    );


  if (
    uncaptured >= 70
  ) {

    coverInsight.textContent =
      "O Radar identificou uma diferença expressiva entre a procura estimada e a presença atual da empresa. Existe um espaço importante para evolução.";

  } else if (
    uncaptured >= 50
  ) {

    coverInsight.textContent =
      "Existe demanda relevante na região e uma parcela importante dessa oportunidade ainda pode ser melhor capturada pela empresa.";

  } else {

    coverInsight.textContent =
      "A empresa já apresenta sinais positivos de presença, mas ainda existem oportunidades para ampliar relevância, autoridade e confiança.";

  }


  /*
    Score circular
  */

  const ring =
    document.getElementById(
      "heroScoreRing"
    );


  const degrees =
    Math.round(
      clamp(
        overall,
        0,
        100
      ) /
      100 *
      360
    );


  ring.style.background =
    `
      conic-gradient(
        #1a73e8 0deg ${degrees}deg,
        #edf1f6 ${degrees}deg 360deg
      )
    `;

}


/* =========================================================
   PÁGINA DE OPORTUNIDADE
========================================================= */

function renderOpportunity(
  data
) {

  const company =
    safeText(
      data.company,
      "a empresa"
    );


  const region =
    safeText(
      data.region,
      "região analisada"
    );


  const weekly =
    safeNumber(
      data.weekly
    );


  const monthly =
    safeNumber(
      data.monthly
    );


  const presence =
    safeNumber(
      data.presence
    );


  const uncaptured =
    safeNumber(
      data.uncaptured
    );


  document.getElementById(
    "opportunityIntro"
  ).textContent =
    `Na análise da ${company}, identificamos aproximadamente ${formatNumber(
      weekly
    )} buscas semanais e ${formatNumber(
      monthly
    )} buscas mensais relacionadas aos serviços considerados na região de ${region}.`;


  const demandLevel =
    safeText(
      data.demandLevel,
      getDemandLabel(
        monthly
      )
    );


  document.getElementById(
    "demandLevelText"
  ).textContent =
    demandLevel;


  document.getElementById(
    "presenceLevelText"
  ).textContent =
    getPresenceLabel(
      presence
    );


  /*
    A barra de demanda trabalha como
    índice visual de 0 a 100.
  */

  let demandPercentage =
    50;


  if (monthly >= 170) {

    demandPercentage =
      95;

  } else if (monthly >= 110) {

    demandPercentage =
      84;

  } else if (monthly >= 60) {

    demandPercentage =
      68;

  }


  document.getElementById(
    "demandChartBar"
  ).style.width =
    `${demandPercentage}%`;


  document.getElementById(
    "presenceChartBar"
  ).style.width =
    `${clamp(
      presence,
      0,
      100
    )}%`;


  document.getElementById(
    "gapNumber"
  ).textContent =
    `${formatNumber(
      uncaptured
    )}%`;


  const gapText =
    document.getElementById(
      "gapText"
    );


  if (
    uncaptured >= 70
  ) {

    gapText.textContent =
      "Uma parcela elevada da oportunidade analisada está fora da capacidade atual de captura da empresa.";

  } else if (
    uncaptured >= 50
  ) {

    gapText.textContent =
      "Existe uma diferença relevante entre a procura estimada e a presença atual da empresa.";

  } else {

    gapText.textContent =
      "A empresa já possui alguma capacidade de captura, mas ainda existem oportunidades claras para evolução.";

  }


  const conclusion =
    document.getElementById(
      "demandConclusion"
    );


  conclusion.textContent =
    `A procura já acontece. O objetivo agora é aumentar a capacidade da ${company} de aparecer, gerar confiança e transformar parte maior dessa procura em oportunidades de contato.`;

}


/* =========================================================
   KEYWORDS
========================================================= */

function renderKeywords(
  data
) {

  const container =
    document.getElementById(
      "proposalKeywords"
    );


  container.innerHTML =
    "";


  const keywords =
    Array.isArray(
      data.keywordData
    )
      ? data.keywordData.slice(
          0,
          8
        )
      : [];


  if (!keywords.length) {

    const item =
      document.createElement(
        "div"
      );


    item.className =
      "proposal-keyword";


    item.innerHTML =
      `
        <span>
          Serviços relacionados
        </span>

        <strong>
          análise local
        </strong>
      `;


    container.appendChild(
      item
    );


    return;

  }


  keywords.forEach(
    item => {

      const card =
        document.createElement(
          "div"
        );


      card.className =
        "proposal-keyword";


      card.innerHTML =
        `
          <span>
            ${safeText(
              item.keyword
            )}
          </span>

          <strong>
            ${formatNumber(
              item.volume
            )}/mês
          </strong>
        `;


      container.appendChild(
        card
      );

    }
  );

}


/* =========================================================
   DIAGNÓSTICO
========================================================= */

function renderDiagnosis(
  data
) {

  const google =
    clamp(
      safeNumber(
        data.googleScore
      ),
      0,
      100
    );


  const authority =
    clamp(
      safeNumber(
        data.authorityScore
      ),
      0,
      100
    );


  const reviews =
    clamp(
      safeNumber(
        data.reviewsScore
      ),
      0,
      100
    );


  document.getElementById(
    "googleScore"
  ).textContent =
    formatNumber(
      google
    );


  document.getElementById(
    "authorityScore"
  ).textContent =
    formatNumber(
      authority
    );


  document.getElementById(
    "reviewsScore"
  ).textContent =
    formatNumber(
      reviews
    );


  document.getElementById(
    "googleScoreBar"
  ).style.width =
    `${google}%`;


  document.getElementById(
    "authorityScoreBar"
  ).style.width =
    `${authority}%`;


  document.getElementById(
    "reviewsScoreBar"
  ).style.width =
    `${reviews}%`;

}


/* =========================================================
   PREVIEW DO SITE
========================================================= */

function renderWebsitePreview(
  data
) {

  const template =
    getWebsiteTemplate(
      data.segmentKey
    );


  const company =
    safeText(
      data.company,
      "Sua empresa"
    );


  document.getElementById(
    "previewCategory"
  ).textContent =
    template.category;


  document.getElementById(
    "previewCompany"
  ).textContent =
    company;


  document.getElementById(
    "previewHeadline"
  ).textContent =
    template.headline;


  /*
    Serviços escolhidos
  */

  const services =
    Array.isArray(
      data.selectedServices
    )
      ? data.selectedServices
      : [];


  let description =
    template.description;


  if (
    services.length >= 2
  ) {

    description =
      `Especialistas em ${services[0].toLowerCase()}, ${services[1].toLowerCase()} e outros serviços para clientes da região.`;

  } else if (
    services.length === 1
  ) {

    description =
      `Atendimento especializado em ${services[0].toLowerCase()} e serviços relacionados na região.`;

  }


  document.getElementById(
    "previewDescription"
  ).textContent =
    description;


  /*
    Serviços no rodapé do mockup
  */

  const defaultServices = [

    "Serviço principal",
    "Atendimento especializado",
    "Solução personalizada"

  ];


  document.getElementById(
    "mockService1"
  ).textContent =
    safeText(
      services[0],
      defaultServices[0]
    );


  document.getElementById(
    "mockService2"
  ).textContent =
    safeText(
      services[1],
      defaultServices[1]
    );


  document.getElementById(
    "mockService3"
  ).textContent =
    safeText(
      services[2],
      defaultServices[2]
    );


  /*
    Visual
  */

  const previewVisual =
    document.getElementById(
      "previewVisual"
    );


  previewVisual.style.background =
    template.background;


  const icon =
    document.getElementById(
      "previewVisualIcon"
    );


  icon.textContent =
    template.icon;


  icon.style.color =
    template.accent;


  const primaryButton =
    document.getElementById(
      "previewPrimaryButton"
    );


  primaryButton.style.background =
    template.accent;


  /*
    URL
  */

  const domain =
    slugify(
      company
    ) ||
    "suaempresa";


  document.getElementById(
    "browserAddress"
  ).textContent =
    `www.${domain}.com.br`;

}


/* =========================================================
   PARCELAMENTO
========================================================= */

function calculateInstallment(
  installments,
  fee
) {

  /*
    Valor que precisa ser cobrado
    para preservar R$ 1.290
    depois da taxa.
  */

  const totalCharged =
    BASE_PRICE /
    (
      1 - fee
    );


  const installmentValue =
    totalCharged /
    installments;


  return {

    totalCharged,
    installmentValue

  };

}


/* =========================================================
   RENDER PARCELAS
========================================================= */

function renderInstallments() {

  const container =
    document.getElementById(
      "installmentOptions"
    );


  container.innerHTML =
    "";


  Object.entries(
    INSTALLMENT_FEES
  ).forEach(
    (
      [
        installments,
        fee
      ]
    ) => {

      const number =
        Number(
          installments
        );


      const values =
        calculateInstallment(
          number,
          fee
        );


      const option =
        document.createElement(
          "div"
        );


      option.className =
        "installment-option";


      /*
        Destacamos 6x
        como maior facilidade.
      */

      if (
        number === 6
      ) {

        option.classList.add(
          "highlight"
        );

      }


      option.innerHTML =
        `
          <span>
            ${number}x
          </span>

          <strong>
            ${formatCurrency(
              values.installmentValue
            )}
          </strong>
        `;


      container.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   FECHAMENTO
========================================================= */

function renderClosing(
  data
) {

  document.getElementById(
    "closingCompany"
  ).textContent =
    safeText(
      data.company,
      "sua empresa"
    );

}


/* =========================================================
   TÍTULO
========================================================= */

function updateDocumentTitle(
  data
) {

  const company =
    safeText(
      data.company,
      "Empresa"
    );


  document.title =
    `Proposta - ${company} - Plano de Captura Local`;

}


/* =========================================================
   RENDERIZAÇÃO COMPLETA
========================================================= */

function renderProposal() {

  if (!proposalData) {

    alert(
      "Nenhuma análise foi encontrada. Faça uma análise no Radar Local antes de gerar a proposta."
    );


    window.location.href =
      "index.html";


    return;

  }


  updateDocumentTitle(
    proposalData
  );


  renderCover(
    proposalData
  );


  renderOpportunity(
    proposalData
  );


  renderKeywords(
    proposalData
  );


  renderDiagnosis(
    proposalData
  );


  renderWebsitePreview(
    proposalData
  );


  renderInstallments();


  renderClosing(
    proposalData
  );

}


/* =========================================================
   SALVAR PDF
========================================================= */

printButton.addEventListener(
  "click",
  () => {

    window.print();

  }
);


/* =========================================================
   VOLTAR
========================================================= */

backButton.addEventListener(
  "click",
  () => {

    window.location.href =
      "index.html";

  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

renderProposal();
