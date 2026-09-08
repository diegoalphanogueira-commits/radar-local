/* =========================================================
   RADAR LOCAL — PROPOSTA.JS V4
   RELATÓRIO + DECISOR + PAGAMENTO + WHATSAPP
========================================================= */


/* =========================================================
   CONFIGURAÇÕES COMERCIAIS
========================================================= */

const BASE_PRICE =
  1290;


/*
  IMPORTANTE

  Coloque aqui o número que deve receber
  as mensagens da proposta.

  Formato:
  código do país + DDD + número

  Exemplo:
  5511999999999

  Não use:
  +
  espaços
  parênteses
  traços
*/

const WHATSAPP_NUMBER =
  "";


/*
  Taxas de referência configuráveis.

  PIX:
  sem acréscimo.

  CARTÃO:
  o cálculo abaixo preserva aproximadamente
  R$ 1.290 após a taxa configurada.

  Se a operadora mudar as taxas,
  altere somente estes números.
*/

const PAYMENT_FEES = {

  1: 0.0420,

  2: 0.0609,

  3: 0.0701,

  4: 0.0791,

  5: 0.0880,

  6: 0.0967

};


/* =========================================================
   CARREGAR ANÁLISE
========================================================= */

const storedProposal =
  localStorage.getItem(
    "radarProposal"
  );


let proposalData =
  null;


try {

  proposalData =
    JSON.parse(
      storedProposal
    );

} catch (error) {

  console.error(
    "Erro ao carregar os dados da proposta:",
    error
  );

}


/* =========================================================
   ESTADO
========================================================= */

let selectedPaymentOption = {

  type:
    "pix",

  installments:
    0,

  fee:
    0,

  installmentValue:
    BASE_PRICE,

  total:
    BASE_PRICE,

  label:
    "Pix"

};


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


const paymentScroller =
  document.getElementById(
    "paymentScroller"
  );


const selectedPaymentLabel =
  document.getElementById(
    "selectedPaymentLabel"
  );


const selectedPaymentValue =
  document.getElementById(
    "selectedPaymentValue"
  );


const selectedPaymentTotal =
  document.getElementById(
    "selectedPaymentTotal"
  );


const paymentFeeNote =
  document.getElementById(
    "paymentFeeNote"
  );


const whatsappProposalButton =
  document.getElementById(
    "whatsappProposalButton"
  );


/* =========================================================
   UTILITÁRIOS
========================================================= */

function safeNumber(value) {

  const number =
    Number(value);


  return Number.isFinite(
    number
  )
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


  return String(
    value
  );

}


function formatNumber(value) {

  return new Intl.NumberFormat(
    "pt-BR"
  ).format(
    safeNumber(
      value
    )
  );

}


function formatCurrency(value) {

  return new Intl.NumberFormat(
    "pt-BR",
    {

      style:
        "currency",

      currency:
        "BRL"

    }
  ).format(
    safeNumber(
      value
    )
  );

}


function formatPercentage(value) {

  return new Intl.NumberFormat(
    "pt-BR",
    {

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2

    }
  ).format(
    safeNumber(
      value
    ) * 100
  );

}


function slugify(text) {

  return String(
    text || ""
  )
    .normalize(
      "NFD"
    )
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


/*
  Arredondamento para cima em centavos.

  Isso evita que um arredondamento faça
  o valor cobrado ficar alguns centavos
  abaixo do necessário.
*/

function ceilCurrency(value) {

  return (
    Math.ceil(
      safeNumber(
        value
      ) * 100
    ) /
    100
  );

}


/* =========================================================
   CLASSIFICAÇÃO
========================================================= */

function getPresenceLabel(score) {

  score =
    safeNumber(
      score
    );


  if (
    score < 35
  ) {

    return "Baixa";

  }


  if (
    score < 55
  ) {

    return "Intermediária";

  }


  if (
    score < 75
  ) {

    return "Boa";

  }


  return "Alta";

}


function getDemandLabel(monthly) {

  monthly =
    safeNumber(
      monthly
    );


  if (
    monthly < 60
  ) {

    return "Moderada";

  }


  if (
    monthly < 110
  ) {

    return "Relevante";

  }


  if (
    monthly < 170
  ) {

    return "Alta";

  }


  return "Muito alta";

}


/* =========================================================
   TEMPLATES DE SITE
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
   TEMPLATE
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
      data.segmentLabel,
      "Segmento analisado"
    );


  const region =
    safeText(
      data.region,
      "Região analisada"
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
    clamp(
      safeNumber(
        data.overall
      ),
      0,
      100
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


  /*
    Explicação da análise
  */

  document.getElementById(
    "coverSummary"
  ).textContent =
    `A ${company} participou de uma análise estratégica de presença digital para entender o cenário de procura por ${segment.toLowerCase()} na região de ${region} e avaliar o quanto sua estrutura atual está preparada para aproveitar essa oportunidade.`;


  /*
    Bloco para decisor
  */

  document.getElementById(
    "forwardedTitle"
  ).textContent =
    `Este relatório apresenta o cenário identificado para a ${company}.`;


  document.getElementById(
    "forwardedText"
  ).textContent =
    `A empresa foi analisada pelo Radar Local considerando seu segmento, serviços e região de atuação. Nas próximas páginas você verá a procura estimada existente em ${region}, os pontos que hoje podem limitar a presença digital da empresa e o plano recomendado para fortalecer sua capacidade de ser encontrada e gerar novos contatos.`;


  /*
    Insight
  */

  const insight =
    document.getElementById(
      "coverInsight"
    );


  if (
    uncaptured >= 70
  ) {

    insight.textContent =
      `Existe uma diferença expressiva entre a procura identificada e a força atual da presença digital da ${company}. O cenário indica uma oportunidade relevante de estruturação.`;

  } else if (
    uncaptured >= 50
  ) {

    insight.textContent =
      `Existe procura relevante pelos serviços analisados, mas a presença atual da ${company} ainda pode ser fortalecida para capturar uma parcela maior dessa oportunidade.`;

  } else {

    insight.textContent =
      `A ${company} já apresenta sinais positivos de presença, mas ainda existem oportunidades para ampliar relevância, autoridade e confiança na região.`;

  }


  /*
    Gauge
  */

  const ring =
    document.getElementById(
      "heroScoreRing"
    );


  const degrees =
    Math.round(
      overall /
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
   OPORTUNIDADE
========================================================= */

function renderOpportunity(data) {

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
    clamp(
      safeNumber(
        data.presence
      ),
      0,
      100
    );


  const uncaptured =
    clamp(
      safeNumber(
        data.uncaptured
      ),
      0,
      100
    );


  document.getElementById(
    "opportunityIntro"
  ).textContent =
    `O Radar estimou aproximadamente ${formatNumber(
      weekly
    )} buscas por semana e ${formatNumber(
      monthly
    )} buscas por mês relacionadas aos serviços avaliados em ${region}. Isso indica que existe procura acontecendo antes mesmo de qualquer nova campanha de divulgação.`;


  /*
    Demanda
  */

  const demandLabel =
    safeText(
      data.demandLevel,
      getDemandLabel(
        monthly
      )
    );


  document.getElementById(
    "demandLevelText"
  ).textContent =
    demandLabel;


  document.getElementById(
    "presenceLevelText"
  ).textContent =
    getPresenceLabel(
      presence
    );


  /*
    Barra visual da demanda
  */

  let demandPercentage =
    50;


  if (
    monthly >= 170
  ) {

    demandPercentage =
      95;

  } else if (
    monthly >= 110
  ) {

    demandPercentage =
      84;

  } else if (
    monthly >= 60
  ) {

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
    `${presence}%`;


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
      `O cenário sugere que uma parcela elevada da oportunidade analisada ainda não está sendo bem capturada pela presença digital atual da ${company}.`;

  } else if (
    uncaptured >= 50
  ) {

    gapText.textContent =
      `Existe uma diferença relevante entre a procura estimada na região e a capacidade atual de presença e captura da ${company}.`;

  } else {

    gapText.textContent =
      `A empresa já possui algum nível de presença, mas ainda existem oportunidades para fortalecer sua participação na procura local.`;

  }


  document.getElementById(
    "demandConclusion"
  ).textContent =
    `Em outras palavras: as pessoas já procuram serviços como os oferecidos pela ${company}. O trabalho recomendado é fortalecer a estrutura digital para aumentar as chances de que parte maior dessa procura encontre a empresa, entenda sua oferta e entre em contato.`;

}


/* =========================================================
   KEYWORDS
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

    const card =
      document.createElement(
        "div"
      );


    card.className =
      "proposal-keyword";


    card.innerHTML =
      `
        <span>
          Serviços relacionados
        </span>

        <strong>
          procura local
        </strong>
      `;


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

function renderWebsitePreview(data) {

  const template =
    getWebsiteTemplate(
      data.segmentKey
    );


  const company =
    safeText(
      data.company,
      "Sua empresa"
    );


  const services =
    Array.isArray(
      data.selectedServices
    )
      ? data.selectedServices
      : [];


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


  let description =
    template.description;


  if (
    services.length >= 2
  ) {

    description =
      `Atendimento especializado em ${services[0].toLowerCase()}, ${services[1].toLowerCase()} e outros serviços para clientes da região.`;

  } else if (
    services.length === 1
  ) {

    description =
      `Atendimento especializado em ${services[0].toLowerCase()} e soluções relacionadas para clientes da região.`;

  }


  document.getElementById(
    "previewDescription"
  ).textContent =
    description;


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


  const visualIcon =
    document.getElementById(
      "previewVisualIcon"
    );


  visualIcon.textContent =
    template.icon;


  visualIcon.style.color =
    template.accent;


  const primaryButton =
    document.getElementById(
      "previewPrimaryButton"
    );


  primaryButton.style.background =
    template.accent;


  /*
    Domínio visual
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
   CÁLCULO DAS PARCELAS
========================================================= */

function calculateCardPayment(
  installments,
  fee
) {

  /*
    Valor total que precisa ser cobrado
    para preservar aproximadamente
    BASE_PRICE depois da taxa.
  */

  const rawTotal =
    BASE_PRICE /
    (
      1 - fee
    );


  const rawInstallment =
    rawTotal /
    installments;


  /*
    Parcela arredondada para cima.
  */

  const installmentValue =
    ceilCurrency(
      rawInstallment
    );


  /*
    Total real exibido é exatamente
    parcela x quantidade.
  */

  const total =
    ceilCurrency(
      installmentValue *
      installments
    );


  return {

    installments,
    fee,
    installmentValue,
    total

  };

}


/* =========================================================
   GERAR OPÇÕES DE PAGAMENTO
========================================================= */

function getPaymentOptions() {

  const options = [

    {

      type:
        "pix",

      installments:
        0,

      fee:
        0,

      installmentValue:
        BASE_PRICE,

      total:
        BASE_PRICE,

      label:
        "Pix"

    }

  ];


  Object.entries(
    PAYMENT_FEES
  ).forEach(
    (
      [
        installmentCount,
        fee
      ]
    ) => {

      const installments =
        Number(
          installmentCount
        );


      const calculation =
        calculateCardPayment(
          installments,
          fee
        );


      options.push({

        type:
          "card",

        installments,

        fee,

        installmentValue:
          calculation.installmentValue,

        total:
          calculation.total,

        label:
          installments === 1
            ? "1x no cartão"
            : `${installments}x no cartão`

      });

    }
  );


  return options;

}


/* =========================================================
   TEXTO RESUMIDO DA FORMA DE PAGAMENTO
========================================================= */

function getPaymentDisplayText(
  payment
) {

  if (
    payment.type === "pix"
  ) {

    return formatCurrency(
      BASE_PRICE
    );

  }


  if (
    payment.installments === 1
  ) {

    return formatCurrency(
      payment.installmentValue
    );

  }


  return (
    `${payment.installments}x de ` +
    `${formatCurrency(
      payment.installmentValue
    )}`
  );

}


/* =========================================================
   CARD DE PAGAMENTO
========================================================= */

function createPaymentButton(
  payment,
  index
) {

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.className =
    "payment-option";


  button.dataset.paymentIndex =
    String(
      index
    );


  button.setAttribute(
    "aria-pressed",
    "false"
  );


  /*
    Pix
  */

  if (
    payment.type === "pix"
  ) {

    button.innerHTML =
      `
        <span>
          Melhor valor
        </span>

        <strong>
          Pix
        </strong>

        <small>
          ${formatCurrency(
            BASE_PRICE
          )}
        </small>
      `;

  }

  /*
    1x
  */

  else if (
    payment.installments === 1
  ) {

    button.innerHTML =
      `
        <span>
          Cartão
        </span>

        <strong>
          1x
        </strong>

        <small>
          ${formatCurrency(
            payment.installmentValue
          )}
        </small>
      `;

  }

  /*
    2x a 6x
  */

  else {

    button.innerHTML =
      `
        <span>
          Cartão
        </span>

        <strong>
          ${payment.installments}x
        </strong>

        <small>
          ${formatCurrency(
            payment.installmentValue
          )}
        </small>
      `;

  }


  button.addEventListener(
    "click",
    () => {

      selectPayment(
        index
      );

    }
  );


  return button;

}


/* =========================================================
   RENDERIZAR PAGAMENTOS
========================================================= */

function renderPaymentOptions() {

  paymentScroller.innerHTML =
    "";


  const options =
    getPaymentOptions();


  options.forEach(
    (
      payment,
      index
    ) => {

      const button =
        createPaymentButton(
          payment,
          index
        );


      paymentScroller.appendChild(
        button
      );

    }
  );


  /*
    Inicialmente Pix
  */

  selectPayment(
    0,
    false
  );

}


/* =========================================================
   SELECIONAR PAGAMENTO
========================================================= */

function selectPayment(
  index,
  shouldScroll = true
) {

  const options =
    getPaymentOptions();


  const payment =
    options[index];


  if (
    !payment
  ) {

    return;

  }


  selectedPaymentOption =
    payment;


  /*
    Estado visual dos botões
  */

  const buttons =
    paymentScroller.querySelectorAll(
      ".payment-option"
    );


  buttons.forEach(
    (
      button,
      buttonIndex
    ) => {

      const selected =
        buttonIndex === index;


      button.classList.toggle(
        "selected",
        selected
      );


      button.setAttribute(
        "aria-pressed",
        selected
          ? "true"
          : "false"
      );

    }
  );


  /*
    Faz o card selecionado aparecer
    no scroller mobile.
  */

  if (
    shouldScroll &&
    buttons[index]
  ) {

    buttons[index].scrollIntoView({

      behavior:
        "smooth",

      block:
        "nearest",

      inline:
        "center"

    });

  }


  updateSelectedPayment();


  updateWhatsappLink();

}


/* =========================================================
   ATUALIZAR RESUMO DO PAGAMENTO
========================================================= */

function updateSelectedPayment() {

  const payment =
    selectedPaymentOption;


  /*
    Pix
  */

  if (
    payment.type === "pix"
  ) {

    selectedPaymentLabel.textContent =
      "Pix";


    selectedPaymentValue.textContent =
      formatCurrency(
        BASE_PRICE
      );


    selectedPaymentTotal.textContent =
      formatCurrency(
        BASE_PRICE
      );


    paymentFeeNote.textContent =
      "Pix sem acréscimo.";


    return;

  }


  /*
    1x cartão
  */

  if (
    payment.installments === 1
  ) {

    selectedPaymentLabel.textContent =
      "1x no cartão";


    selectedPaymentValue.textContent =
      formatCurrency(
        payment.installmentValue
      );


    selectedPaymentTotal.textContent =
      formatCurrency(
        payment.total
      );


    paymentFeeNote.textContent =
      `Valor já corrigido considerando taxa estimada de ${formatPercentage(
        payment.fee
      )}% da operadora.`;


    return;

  }


  /*
    Parcelado
  */

  selectedPaymentLabel.textContent =
    `${payment.installments}x no cartão`;


  selectedPaymentValue.textContent =
    `${payment.installments}x de ${formatCurrency(
      payment.installmentValue
    )}`;


  selectedPaymentTotal.textContent =
    formatCurrency(
      payment.total
    );


  paymentFeeNote.textContent =
    `Valor total já corrigido considerando taxa estimada de ${formatPercentage(
      payment.fee
    )}% da operadora.`;

}


/* =========================================================
   RESUMO DA FORMA DE PAGAMENTO PARA WHATSAPP
========================================================= */

function getWhatsappPaymentText() {

  const payment =
    selectedPaymentOption;


  if (
    payment.type === "pix"
  ) {

    return (
      `Pix de ${formatCurrency(
        BASE_PRICE
      )}`
    );

  }


  if (
    payment.installments === 1
  ) {

    return (
      `1x no cartão de ${formatCurrency(
        payment.installmentValue
      )}`
    );

  }


  return (
    `${payment.installments}x de ` +
    `${formatCurrency(
      payment.installmentValue
    )} no cartão`
  );

}


/* =========================================================
   MENSAGEM DO WHATSAPP
========================================================= */

function buildWhatsappMessage() {

  const company =
    safeText(
      proposalData?.company,
      "minha empresa"
    );


  const region =
    safeText(
      proposalData?.region,
      "minha região"
    );


  const paymentText =
    getWhatsappPaymentText();


  return (
    `Olá, Diego! Recebi o Relatório de Oportunidade Digital da ${company}.\n\n` +
    `Vi a análise da nossa presença digital e o Plano de Captura Local recomendado para a região de ${region}.\n\n` +
    `Quero iniciar a estruturação digital da empresa.\n\n` +
    `A condição que estou considerando é: ${paymentText}.\n\n` +
    `Pode me orientar sobre o próximo passo?`
  );

}


/* =========================================================
   LINK WHATSAPP
========================================================= */

function updateWhatsappLink() {

  if (
    !whatsappProposalButton
  ) {

    return;

  }


  const message =
    buildWhatsappMessage();


  const encodedMessage =
    encodeURIComponent(
      message
    );


  /*
    Se o número estiver configurado,
    abre diretamente sua conversa.

    Se ainda estiver vazio,
    abre o WhatsApp com a mensagem
    pronta para compartilhamento.
  */

  if (
    WHATSAPP_NUMBER.trim()
  ) {

    whatsappProposalButton.href =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  } else {

    whatsappProposalButton.href =
      `https://wa.me/?text=${encodedMessage}`;

  }

}


/* =========================================================
   CTA PERSONALIZADO
========================================================= */

function renderFinalCTA(data) {

  const company =
    safeText(
      data.company,
      "sua empresa"
    );


  const region =
    safeText(
      data.region,
      "sua região"
    );


  document.getElementById(
    "finalCtaText"
  ).textContent =
    `Se fizer sentido fortalecer a presença da ${company} e aproveitar melhor a procura identificada em ${region}, podemos iniciar a implantação do Plano de Captura Local agora.`;

}


/* =========================================================
   TÍTULO DO DOCUMENTO
========================================================= */

function updateDocumentTitle(data) {

  const company =
    safeText(
      data.company,
      "Empresa"
    );


  document.title =
    `Relatório de Oportunidade Digital - ${company}`;

}


/* =========================================================
   RENDER COMPLETO
========================================================= */

function renderProposal() {

  if (
    !proposalData
  ) {

    alert(
      "Nenhuma análise foi encontrada. Faça uma análise no Radar Local antes de gerar o relatório."
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


  renderPaymentOptions();


  renderFinalCTA(
    proposalData
  );


  updateWhatsappLink();

}


/* =========================================================
   SALVAR PDF
========================================================= */

printButton.addEventListener(
  "click",
  () => {

    /*
      O estado de pagamento selecionado
      permanece visualmente destacado
      quando o documento é impresso.
    */

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
