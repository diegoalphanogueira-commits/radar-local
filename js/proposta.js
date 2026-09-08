/* =========================================================
   RADAR LOCAL — PROPOSTA.JS
========================================================= */


/* =========================================================
   DADOS DA ANÁLISE
========================================================= */

const proposalDataRaw =
  localStorage.getItem("radarProposal");

let proposalData = null;


try {

  proposalData =
    JSON.parse(proposalDataRaw);

} catch (error) {

  console.error(
    "Erro ao carregar dados da proposta:",
    error
  );

}


/* =========================================================
   ELEMENTOS
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
   FUNÇÕES UTILITÁRIAS
========================================================= */

function formatNumber(number) {

  return new Intl.NumberFormat(
    "pt-BR"
  ).format(
    Number(number) || 0
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

  return value;

}


/* =========================================================
   TEMPLATES DO PREVIEW DO SITE
========================================================= */

const WEBSITE_TEMPLATES = {

  estetica: {

    category:
      "Estética e bem-estar",

    headline:
      "Realce sua beleza com atendimento profissional e personalizado.",

    description:
      "Conheça nossos tratamentos e encontre o cuidado ideal para você.",

    visual:
      "linear-gradient(145deg, #f9eefa, #eef5ff)",

    accent:
      "#b45acb"

  },


  podologia: {

    category:
      "Saúde e cuidado dos pés",

    headline:
      "Cuide dos seus pés com atendimento especializado.",

    description:
      "Tratamentos profissionais para conforto, prevenção e bem-estar.",

    visual:
      "linear-gradient(145deg, #eef9f5, #eff7ff)",

    accent:
      "#3f9b79"

  },


  odontologia: {

    category:
      "Odontologia",

    headline:
      "Seu sorriso merece cuidado, segurança e confiança.",

    description:
      "Atendimento odontológico completo para cuidar da sua saúde e estética.",

    visual:
      "linear-gradient(145deg, #eaf7ff, #f6fbff)",

    accent:
      "#2d8fd5"

  },


  beleza: {

    category:
      "Beleza e cuidados",

    headline:
      "Beleza, cuidado e autoestima em cada atendimento.",

    description:
      "Conheça nossos serviços e encontre o atendimento ideal para você.",

    visual:
      "linear-gradient(145deg, #fff0f5, #f8f2ff)",

    accent:
      "#d05f91"

  },


  assistencia: {

    category:
      "Assistência técnica",

    headline:
      "Seu equipamento funcionando novamente com rapidez e confiança.",

    description:
      "Assistência especializada para celulares, notebooks e equipamentos.",

    visual:
      "linear-gradient(145deg, #edf3ff, #f3f8ff)",

    accent:
      "#276fd3"

  },


  limpeza: {

    category:
      "Limpeza e higienização",

    headline:
      "Seu sofá limpo, renovado e pronto para receber sua família.",

    description:
      "Higienização profissional de estofados com atendimento na sua região.",

    visual:
      "linear-gradient(145deg, #eafbf7, #edf7ff)",

    accent:
      "#249d85"

  },


  vidracaria: {

    category:
      "Vidros sob medida",

    headline:
      "Soluções em vidro que valorizam cada detalhe do seu ambiente.",

    description:
      "Projetos sob medida para residências, comércios e empresas.",

    visual:
      "linear-gradient(145deg, #eef8fb, #f4faff)",

    accent:
      "#4285a4"

  },


  marmoraria: {

    category:
      "Mármore e granito",

    headline:
      "Acabamentos que transformam seu projeto.",

    description:
      "Bancadas, pias e projetos sob medida com acabamento profissional.",

    visual:
      "linear-gradient(145deg, #f3f1ee, #fafafa)",

    accent:
      "#7c746a"

  },


  "ar-condicionado": {

    category:
      "Climatização",

    headline:
      "Conforto e climatização para sua casa ou empresa.",

    description:
      "Instalação, manutenção e limpeza de ar-condicionado com atendimento especializado.",

    visual:
      "linear-gradient(145deg, #e9f5ff, #f5fbff)",

    accent:
      "#3287cf"

  },


  dedetizacao: {

    category:
      "Controle de pragas",

    headline:
      "Proteja seu ambiente com um controle de pragas profissional.",

    description:
      "Soluções para residências e empresas com atendimento rápido e especializado.",

    visual:
      "linear-gradient(145deg, #eff8ea, #f7fbf3)",

    accent:
      "#5b923c"

  },


  "energia-solar": {

    category:
      "Energia solar",

    headline:
      "Transforme a luz do sol em economia para sua casa ou empresa.",

    description:
      "Projetos de energia solar pensados para reduzir custos e gerar eficiência.",

    visual:
      "linear-gradient(145deg, #fff8df, #edf7ff)",

    accent:
      "#e4a500"

  },


  oficina: {

    category:
      "Oficina mecânica",

    headline:
      "Seu carro em boas mãos, do diagnóstico à manutenção.",

    description:
      "Serviços automotivos com atendimento profissional e transparente.",

    visual:
      "linear-gradient(145deg, #eef1f5, #f8fafc)",

    accent:
      "#4d6377"

  },


  outro: {

    category:
      "Atendimento especializado",

    headline:
      "Uma presença profissional para quem procura seus serviços.",

    description:
      "Apresente sua empresa, seus serviços e facilite o contato com novos clientes.",

    visual:
      "linear-gradient(145deg, #eaf2ff, #f6faff)",

    accent:
      "#1a73e8"

  }

};


/* =========================================================
   PREPARAR TEMPLATE DO SITE
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
   PREENCHER CAPA
========================================================= */

function renderHero(data) {

  document.getElementById(
    "companyNameHero"
  ).textContent =
    safeText(
      data.company,
      "sua empresa"
    );


  document.getElementById(
    "segmentHero"
  ).textContent =
    safeText(
      data.segmentLabel
    );


  document.getElementById(
    "regionHero"
  ).textContent =
    safeText(
      data.region
    );


  document.getElementById(
    "radiusHero"
  ).textContent =
    `${safeText(
      data.radius,
      "3"
    )} km`;


  document.getElementById(
    "heroScore"
  ).textContent =
    formatNumber(
      data.overall
    );


  /*
    Gauge dinâmico
  */

  const heroRadarRing =
    document.querySelector(
      ".hero-radar-ring"
    );


  if (heroRadarRing) {

    const score =
      Math.min(
        Math.max(
          Number(
            data.overall
          ) || 0,
          0
        ),
        100
      );


    const degrees =
      Math.round(
        score / 100 * 360
      );


    heroRadarRing.style.background =
      `
        conic-gradient(
          #1a73e8 0deg ${degrees}deg,
          #edf1f6 ${degrees}deg 360deg
        )
      `;

  }

}


/* =========================================================
   OPORTUNIDADE
========================================================= */

function renderOpportunity(data) {

  document.getElementById(
    "weeklyDemand"
  ).textContent =
    formatNumber(
      data.weekly
    );


  document.getElementById(
    "monthlyDemand"
  ).textContent =
    formatNumber(
      data.monthly
    );


  document.getElementById(
    "presenceScore"
  ).textContent =
    formatNumber(
      data.presence
    );


  document.getElementById(
    "uncapturedDemand"
  ).textContent =
    `${formatNumber(
      data.uncaptured
    )}%`;


  const intro =
    document.getElementById(
      "opportunityIntro"
    );


  intro.textContent =
    `Na análise de ${safeText(
      data.company,
      "sua empresa"
    )}, identificamos uma estimativa de ${formatNumber(
      data.weekly
    )} buscas por semana e ${formatNumber(
      data.monthly
    )} buscas por mês relacionadas aos serviços avaliados na região de ${safeText(
      data.region,
      "atuação"
    )}.`;


  const statement =
    document.getElementById(
      "opportunityStatement"
    );


  const uncaptured =
    Number(
      data.uncaptured
    ) || 0;


  if (
    uncaptured >= 70
  ) {

    statement.textContent =
      "Existe uma oportunidade expressiva de melhorar a capacidade da empresa de aparecer e captar essa procura local.";

  } else if (
    uncaptured >= 50
  ) {

    statement.textContent =
      "A demanda já existe. A oportunidade está em fortalecer a presença da empresa para capturar uma parcela maior dessa procura.";

  } else {

    statement.textContent =
      "A empresa já possui sinais de presença, mas ainda existe espaço para ampliar visibilidade, autoridade e geração de contatos.";

  }

}


/* =========================================================
   PALAVRAS-CHAVE
========================================================= */

function renderKeywords(data) {

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


  if (
    !keywords.length
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "proposal-keyword";


    empty.innerHTML =
      `
        <span>
          Serviços relacionados
        </span>

        <strong>
          análise local
        </strong>
      `;


    container.appendChild(
      empty
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

function renderDiagnosis(data) {

  document.getElementById(
    "googleScore"
  ).textContent =
    formatNumber(
      data.googleScore
    );


  document.getElementById(
    "authorityScore"
  ).textContent =
    formatNumber(
      data.authorityScore
    );


  document.getElementById(
    "reviewsScore"
  ).textContent =
    formatNumber(
      data.reviewsScore
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


  document.getElementById(
    "previewCategory"
  ).textContent =
    template.category;


  document.getElementById(
    "previewCompany"
  ).textContent =
    safeText(
      data.company,
      "Sua empresa"
    );


  document.getElementById(
    "previewHeadline"
  ).textContent =
    template.headline;


  /*
    Se houver serviços,
    usa os primeiros no texto.
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
      `Atendimento especializado em ${services[0].toLowerCase()} e soluções relacionadas na região.`;

  }


  document.getElementById(
    "previewDescription"
  ).textContent =
    description;


  /*
    Visual do mockup
  */

  const previewVisual =
    document.getElementById(
      "previewVisual"
    );


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


  /*
    Botão primário
  */

  const previewPrimary =
    document.querySelector(
      ".preview-primary"
    );


  if (previewPrimary) {

    previewPrimary.style.background =
      template.accent;

  }


  /*
    URL fictícia
  */

  const browserAddress =
    document.querySelector(
      ".browser-address"
    );


  if (browserAddress) {

    const slug =
      slugify(
        data.company
      ) ||
      "suaempresa";


    browserAddress.textContent =
      `www.${slug}.com.br`;

  }

}


/* =========================================================
   TÍTULO DA PÁGINA
========================================================= */

function updatePageTitle(data) {

  const company =
    safeText(
      data.company,
      "Empresa"
    );


  document.title =
    `Plano de Captura Local — ${company}`;

}


/* =========================================================
   RENDER PRINCIPAL
========================================================= */

function renderProposal() {

  if (
    !proposalData
  ) {

    alert(
      "Nenhuma análise foi encontrada. Faça uma análise no Radar Local antes de gerar a proposta."
    );


    window.location.href =
      "index.html";


    return;

  }


  updatePageTitle(
    proposalData
  );


  renderHero(
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

    /*
      Volta para o Radar sem apagar
      os dados da análise.
    */

    window.location.href =
      "index.html";

  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

renderProposal();
