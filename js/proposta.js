/* =========================================================
   RADAR LOCAL — PROPOSTA V3
========================================================= */


/* =========================================================
   CARREGAR DADOS
========================================================= */

const proposalRaw =
  localStorage.getItem(
    "radarProposal"
  );


let proposalData = null;


try {

  proposalData =
    JSON.parse(
      proposalRaw
    );

} catch (error) {

  console.error(
    "Erro ao carregar proposta:",
    error
  );

}



/* =========================================================
   BOTÕES
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
   FUNÇÕES BÁSICAS
========================================================= */

function getElement(id) {

  return document.getElementById(
    id
  );

}


function setText(
  id,
  value
) {

  const element =
    getElement(id);


  if (!element) {
    return;
  }


  element.textContent =
    value;

}


function safeText(
  value,
  fallback = "—"
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return fallback;

  }


  return String(value);

}


function formatNumber(
  value
) {

  return new Intl.NumberFormat(
    "pt-BR"
  ).format(
    Number(value) || 0
  );

}


function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      Number(value) || 0,
      min
    ),
    max
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



/* =========================================================
   CONFIGURAÇÃO DOS SEGMENTOS
========================================================= */

const WEBSITE_TEMPLATES = {


  estetica: {

    category:
      "Estética e bem-estar",

    headline:
      "Realce sua beleza com atendimento profissional e personalizado.",

    description:
      "Tratamentos pensados para cuidar da sua beleza, autoestima e bem-estar.",

    visual:
      "linear-gradient(145deg, #f9edfc, #edf3ff)",

    accent:
      "#b44fce"

  },


  podologia: {

    category:
      "Podologia e cuidado",

    headline:
      "Cuidado especializado para a saúde e o conforto dos seus pés.",

    description:
      "Atendimento profissional com foco em prevenção, cuidado e bem-estar.",

    visual:
      "linear-gradient(145deg, #edf9f4, #eef7ff)",

    accent:
      "#2e9a75"

  },


  odontologia: {

    category:
      "Odontologia",

    headline:
      "Seu sorriso merece cuidado, confiança e atenção profissional.",

    description:
      "Atendimento odontológico para cuidar da saúde e da estética do seu sorriso.",

    visual:
      "linear-gradient(145deg, #eaf6ff, #f7fbff)",

    accent:
      "#2389cf"

  },


  beleza: {

    category:
      "Beleza e cuidados",

    headline:
      "Beleza, cuidado e autoestima em cada atendimento.",

    description:
      "Serviços profissionais para quem busca cuidado, beleza e bem-estar.",

    visual:
      "linear-gradient(145deg, #fff0f5, #f8f2ff)",

    accent:
      "#cf5e90"

  },


  assistencia: {

    category:
      "Assistência técnica",

    headline:
      "Seu equipamento funcionando novamente com rapidez e confiança.",

    description:
      "Assistência especializada e atendimento profissional na sua região.",

    visual:
      "linear-gradient(145deg, #edf3ff, #f4f8ff)",

    accent:
      "#276fd3"

  },


  limpeza: {

    category:
      "Limpeza e higienização",

    headline:
      "Seu estofado limpo, renovado e pronto para receber sua família.",

    description:
      "Limpeza e higienização profissional com atendimento na sua região.",

    visual:
      "linear-gradient(145deg, #e9faf5, #eef7ff)",

    accent:
      "#229d83"

  },


  vidracaria: {

    category:
      "Vidros sob medida",

    headline:
      "Soluções em vidro que valorizam seu ambiente.",

    description:
      "Projetos sob medida para residências, comércios e empresas.",

    visual:
      "linear-gradient(145deg, #edf8fb, #f4faff)",

    accent:
      "#4186a5"

  },


  marmoraria: {

    category:
      "Mármore e granito",

    headline:
      "Acabamentos sob medida que transformam seu projeto.",

    description:
      "Soluções profissionais para cozinhas, banheiros e ambientes personalizados.",

    visual:
      "linear-gradient(145deg, #f3f1ed, #fafafa)",

    accent:
      "#776f65"

  },


  "ar-condicionado": {

    category:
      "Climatização",

    headline:
      "Mais conforto para sua casa ou empresa.",

    description:
      "Instalação, manutenção e limpeza com atendimento especializado.",

    visual:
      "linear-gradient(145deg, #e8f5ff, #f6fbff)",

    accent:
      "#3188ce"

  },


  dedetizacao: {

    category:
      "Controle de pragas",

    headline:
      "Proteção profissional para sua casa ou empresa.",

    description:
      "Controle de pragas com atendimento rápido, seguro e especializado.",

    visual:
      "linear-gradient(145deg, #eff8e9, #f8fbf4)",

    accent:
      "#5c943d"

  },


  "energia-solar": {

    category:
      "Energia solar",

    headline:
      "Transforme a luz do sol em economia.",

    description:
      "Soluções solares para residências e empresas que querem reduzir custos.",

    visual:
      "linear-gradient(145deg, #fff7db, #edf7ff)",

    accent:
      "#dca000"

  },


  oficina: {

    category:
      "Oficina mecânica",

    headline:
      "Seu carro em boas mãos.",

    description:
      "Diagnóstico e manutenção com atendimento profissional e transparente.",

    visual:
      "linear-gradient(145deg, #edf1f5, #f8fafc)",

    accent:
      "#4f6477"

  },


  outro: {

    category:
      "Atendimento especializado",

    headline:
      "Uma presença profissional para quem procura seus serviços.",

    description:
      "Apresente sua empresa com clareza e facilite o contato com novos clientes.",

    visual:
      "linear-gradient(145deg, #eaf2ff, #f7faff)",

    accent:
      "#1a73e8"

  }

};



/* =========================================================
   TEMPLATE DO SEGMENTO
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
   NÍVEL DE DEMANDA
========================================================= */

function getDemandLevel(
  monthly
) {

  const value =
    Number(monthly) || 0;


  if (value >= 120) {

    return {
      label:
        "Alta",

      width:
        88
    };

  }


  if (value >= 70) {

    return {
      label:
        "Relevante",

      width:
        72
    };

  }


  if (value >= 35) {

    return {
      label:
        "Moderada",

      width:
        55
    };

  }


  return {
    label:
      "Pontual",

    width:
      38
  };

}



/* =========================================================
   NÍVEL DE PRESENÇA
========================================================= */

function getPresenceLevel(
  score
) {

  const value =
    Number(score) || 0;


  if (value >= 75) {

    return "Forte";

  }


  if (value >= 55) {

    return "Boa";

  }


  if (value >= 35) {

    return "Intermediária";

  }


  return "Baixa";

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
      data.segmentLabel,
      "Negócio local"
    );


  const region =
    safeText(
      data.region,
      "sua região"
    );


  const radius =
    safeText(
      data.radius,
      "3"
    );


  setText(
    "companyNameHero",
    company
  );


  setText(
    "companyNameCard",
    company
  );


  setText(
    "segmentHero",
    segment
  );


  setText(
    "regionHero",
    region
  );


  setText(
    "radiusHero",
    `${radius} km`
  );


  const coverDescription =
    getElement(
      "coverDescription"
    );


  if (coverDescription) {

    coverDescription.textContent =
      `Analisamos a procura por serviços de ${segment.toLowerCase()} em ${region} e o quanto a presença digital da empresa está preparada para aproveitar essa demanda.`;

  }


  document.title =
    `Radar Local — ${company}`;

}



/* =========================================================
   MÉTRICAS PRINCIPAIS
========================================================= */

function renderMetrics(data) {

  setText(
    "weeklyDemand",
    formatNumber(
      data.weekly
    )
  );


  setText(
    "monthlyDemand",
    formatNumber(
      data.monthly
    )
  );


  setText(
    "presenceScore",
    formatNumber(
      data.presence
    )
  );


  setText(
    "uncapturedDemand",
    `${formatNumber(
      data.uncaptured
    )}%`
  );

}



/* =========================================================
   LEITURA ESTRATÉGICA
========================================================= */

function renderStrategicReading(
  data
) {

  const uncaptured =
    Number(
      data.uncaptured
    ) || 0;


  let message =
    "Existe procura acontecendo e espaço para fortalecer a presença digital da empresa.";


  if (uncaptured >= 70) {

    message =
      "Existe uma diferença importante entre a procura existente e a capacidade atual da empresa de capturar essa oportunidade.";

  } else if (
    uncaptured >= 50
  ) {

    message =
      "Existe procura relevante pelos serviços analisados, mas a presença atual ainda pode ser fortalecida para capturar uma parcela maior dessa oportunidade.";

  } else if (
    uncaptured >= 30
  ) {

    message =
      "A empresa já apresenta sinais de presença, mas ainda existe espaço para ampliar visibilidade e confiança.";

  } else {

    message =
      "A presença atual é relativamente forte, com oportunidades pontuais de melhoria e fortalecimento.";

  }


  setText(
    "opportunityStatement",
    message
  );

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
      "a região analisada"
    );


  const intro =
    getElement(
      "opportunityIntro"
    );


  if (intro) {

    intro.textContent =
      `O Radar estimou aproximadamente ${formatNumber(
        data.weekly
      )} buscas por semana e ${formatNumber(
        data.monthly
      )} buscas por mês relacionadas aos serviços avaliados em ${region}.`;

  }


  /*
    Demanda
  */

  const demand =
    getDemandLevel(
      data.monthly
    );


  setText(
    "demandLevelLabel",
    demand.label
  );


  const demandBar =
    getElement(
      "demandBar"
    );


  if (demandBar) {

    demandBar.style.width =
      `${demand.width}%`;

  }


  /*
    Presença
  */

  const presence =
    clamp(
      data.presence,
      0,
      100
    );


  setText(
    "presenceLevelLabel",
    getPresenceLevel(
      presence
    )
  );


  const presenceBar =
    getElement(
      "presenceBar"
    );


  if (presenceBar) {

    presenceBar.style.width =
      `${Math.max(
        presence,
        8
      )}%`;

  }


  /*
    Oportunidade
  */

  setText(
    "opportunityHighlight",
    `${formatNumber(
      data.uncaptured
    )}%`
  );


  /*
    Atualiza texto do destaque
    com nome da empresa
  */

  const highlightText =
    document.querySelector(
      ".opportunity-highlight p"
    );


  if (highlightText) {

    highlightText.textContent =
      `Existe uma diferença entre a procura estimada na região e a capacidade atual de presença e captura da ${company}.`;

  }

}



/* =========================================================
   PALAVRAS-CHAVE
========================================================= */

function renderKeywords(
  data
) {

  const container =
    getElement(
      "proposalKeywords"
    );


  if (!container) {
    return;
  }


  container.innerHTML =
    "";


  const keywords =
    Array.isArray(
      data.keywordData
    )
      ? data.keywordData.slice(
          0,
          6
        )
      : [];


  if (!keywords.length) {

    const card =
      document.createElement(
        "div"
      );


    card.className =
      "proposal-keyword";


    const label =
      document.createElement(
        "span"
      );


    label.textContent =
      "Serviços relacionados";


    const value =
      document.createElement(
        "strong"
      );


    value.textContent =
      "procura local";


    card.appendChild(
      label
    );


    card.appendChild(
      value
    );


    container.appendChild(
      card
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


      const keyword =
        document.createElement(
          "span"
        );


      keyword.textContent =
        safeText(
          item.keyword,
          "Serviço"
        );


      const volume =
        document.createElement(
          "strong"
        );


      volume.textContent =
        `${formatNumber(
          item.volume
        )}/mês`;


      card.appendChild(
        keyword
      );


      card.appendChild(
        volume
      );


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

  setText(
    "googleScore",
    formatNumber(
      data.googleScore
    )
  );


  setText(
    "authorityScore",
    formatNumber(
      data.authorityScore
    )
  );


  setText(
    "reviewsScore",
    formatNumber(
      data.reviewsScore
    )
  );

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


  const region =
    safeText(
      data.region,
      "Sua região"
    );


  setText(
    "previewCategory",
    template.category
  );


  setText(
    "previewCompany",
    company
  );


  setText(
    "previewHeadline",
    template.headline
  );


  /*
    Serviço principal
  */

  const services =
    Array.isArray(
      data.selectedServices
    )
      ? data.selectedServices
      : [];


  const firstService =
    services.length
      ? services[0]
      : safeText(
          data.segmentLabel,
          "Atendimento profissional"
        );


  setText(
    "previewServiceOne",
    firstService
  );


  setText(
    "previewRegion",
    region
  );


  /*
    Descrição
  */

  let description =
    template.description;


  if (services.length >= 2) {

    description =
      `Especialistas em ${services[0].toLowerCase()} e ${services[1].toLowerCase()}, com atendimento na região.`;

  } else if (
    services.length === 1
  ) {

    description =
      `Atendimento especializado em ${services[0].toLowerCase()}, com foco em qualidade e confiança.`;

  }


  setText(
    "previewDescription",
    description
  );


  /*
    URL visual
  */

  const browserAddress =
    document.querySelector(
      ".browser-address"
    );


  if (browserAddress) {

    const companySlug =
      slugify(
        company
      ) ||
      "suaempresa";


    browserAddress.textContent =
      `www.${companySlug}.com.br`;

  }


  /*
    Visual personalizado
  */

  const previewVisual =
    getElement(
      "previewVisual"
    );


  if (previewVisual) {

    previewVisual.style.background =
      template.visual;


    const previewIcon =
      previewVisual.querySelector(
        ".preview-icon"
      );


    if (previewIcon) {

      previewIcon.style.color =
        template.accent;

    }

  }


  /*
    Botão do mockup
  */

  const primaryButton =
    document.querySelector(
      ".preview-primary"
    );


  if (primaryButton) {

    primaryButton.style.background =
      template.accent;

  }


  /*
    Categoria também recebe
    a cor do segmento
  */

  const previewCategory =
    getElement(
      "previewCategory"
    );


  if (previewCategory) {

    previewCategory.style.color =
      template.accent;

  }

}



/* =========================================================
   PERSONALIZAR TEXTO SIMPLES
========================================================= */

function renderSimpleReading(
  data
) {

  const company =
    safeText(
      data.company,
      "sua empresa"
    );


  const element =
    document.querySelector(
      ".simple-reading strong"
    );


  if (!element) {
    return;
  }


  element.textContent =
    `As pessoas já procuram serviços como os oferecidos pela ${company}. O plano recomendado fortalece a estrutura digital para aumentar as chances de essa procura encontrar a empresa e entrar em contato.`;

}



/* =========================================================
   INICIALIZAÇÃO
========================================================= */

function renderProposal() {

  if (!proposalData) {

    alert(
      "Nenhuma análise foi encontrada. Faça uma análise no Radar Local antes de gerar o relatório."
    );


    window.location.href =
      "index.html";


    return;

  }


  renderCover(
    proposalData
  );


  renderMetrics(
    proposalData
  );


  renderStrategicReading(
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


  renderSimpleReading(
    proposalData
  );

}



/* =========================================================
   SALVAR EM PDF
========================================================= */

if (printButton) {

  printButton.addEventListener(
    "click",
    () => {

      window.print();

    }
  );

}



/* =========================================================
   VOLTAR
========================================================= */

if (backButton) {

  backButton.addEventListener(
    "click",
    () => {

      window.location.href =
        "index.html";

    }
  );

}



/* =========================================================
   START
========================================================= */

renderProposal();
