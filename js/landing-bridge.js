/* =========================================================
   RADAR LOCAL
   LANDING → DIAGNÓSTICO
========================================================= */

(function () {

    const METHOD_VERSION =
        "radar-landing-v1";


    /* =====================================================
       INICIAR
    ====================================================== */

    function startLandingBridge() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        const origem =
            params.get(
                "origem"
            ) || "";


        /*
            Se a pessoa entrou no Radar
            diretamente, não fazemos nada.

            O formulário manual continua
            funcionando normalmente.
        */

        if (
            origem !==
            "posicionamento-local"
        ) {

            return;

        }


        const lead =
            getLeadFromUrl(
                params
            );


        console.log(
            "Lead recebido:",
            lead
        );


        if (
            !lead.company ||
            !lead.region ||
            !lead.segment
        ) {

            console.error(
                "Dados insuficientes para gerar o diagnóstico.",
                lead
            );

            return;

        }


        /*
            Esconde o formulário do Radar.

            Quem veio da landing não precisa
            preencher nada novamente.
        */

        prepareLoadingScreen(
            lead
        );


        /*
            Gera dados estáveis.

            A mesma empresa + região +
            segmento + endereço gera
            os mesmos indicadores.
        */

        const reportData =
            buildReport(
                lead
            );


        /* =================================================
           SALVAR RELATÓRIO
        ================================================== */

        localStorage.setItem(
            "radarProposal",
            JSON.stringify(
                reportData
            )
        );


        if (
            lead.address
        ) {

            localStorage.setItem(
                "radarAddress",
                lead.address
            );

        }


        console.log(
            "Relatório preparado:",
            reportData
        );


        /*
            Mostra a animação e depois
            abre diretamente o relatório.
        */

        runBridgeLoading(
            lead
        );

    }


    /* =====================================================
       RECEBER DADOS DA LANDING
    ====================================================== */

    function getLeadFromUrl(
        params
    ) {

        let stored =
            null;


        try {

            stored =
                JSON.parse(
                    localStorage.getItem(
                        "radarLocalLead"
                    ) ||
                    "null"
                );

        }

        catch (error) {

            console.warn(
                "Não foi possível ler radarLocalLead.",
                error
            );

        }


        const segment =
            (
                params.get(
                    "segmento"
                ) ||
                stored?.segmento ||
                ""
            )
                .trim();


        const segmentName =
            (
                params.get(
                    "segmento_nome"
                ) ||
                stored?.segmentoNome ||
                getDefaultSegmentName(
                    segment
                )
            )
                .trim();


        return {

            company:
                (
                    params.get(
                        "empresa"
                    ) ||
                    stored?.empresa ||
                    ""
                )
                    .trim(),

            segment,

            segmentName,

            region:
                (
                    params.get(
                        "regiao"
                    ) ||
                    stored?.regiao ||
                    stored?.cidade ||
                    ""
                )
                    .trim(),

            address:
                (
                    params.get(
                        "endereco"
                    ) ||
                    stored?.endereco ||
                    ""
                )
                    .trim(),

            phone:
                (
                    params.get(
                        "telefone"
                    ) ||
                    stored?.telefone ||
                    ""
                )
                    .trim(),

            lat:
                Number(
                    params.get(
                        "lat"
                    ) ||
                    stored?.lat ||
                    0
                ),

            lon:
                Number(
                    params.get(
                        "lon"
                    ) ||
                    stored?.lon ||
                    0
                ),

            bairro:
                (
                    params.get(
                        "bairro"
                    ) ||
                    stored?.bairro ||
                    ""
                )
                    .trim(),

            cep:
                (
                    params.get(
                        "cep"
                    ) ||
                    stored?.cep ||
                    ""
                )
                    .trim(),

            placeId:
                (
                    params.get(
                        "place_id"
                    ) ||
                    stored?.placeId ||
                    ""
                )
                    .trim()

        };

    }


    /* =====================================================
       NOMES DOS SEGMENTOS
    ====================================================== */

    function getDefaultSegmentName(
        segment
    ) {

        const names = {

            estetica:
                "Clínica de estética",

            podologia:
                "Podologia",

            odontologia:
                "Odontologia",

            beleza:
                "Salão / Beleza",

            barbearia:
                "Barbearia",

            manicure:
                "Manicure / Nail Designer",

            cilios:
                "Cílios / Sobrancelhas",

            "energia-solar":
                "Energia Solar",

            assistencia:
                "Assistência Técnica",

            vidracaria:
                "Vidraçaria",

            limpeza:
                "Limpeza de Estofados",

            seguros:
                "Corretora de Seguros",

            advocacia:
                "Advocacia",

            outro:
                "Negócio local"

        };


        return (
            names[
                segment
            ] ||
            "Negócio local"
        );

    }


    /* =====================================================
       SEGMENTO VISUAL DA PROPOSTA
    ====================================================== */

    function getReportSegmentKey(
        segment
    ) {

        /*
            Algumas especialidades usam
            o visual de beleza.
        */

        if (
            [
                "barbearia",
                "manicure",
                "cilios"
            ].includes(
                segment
            )
        ) {

            return "beleza";

        }


        /*
            Segmentos não configurados
            visualmente usam "outro".
        */

        const supported = [

            "estetica",
            "podologia",
            "odontologia",
            "beleza",
            "assistencia",
            "limpeza",
            "vidracaria",
            "energia-solar",
            "seguros",
            "advocacia"

        ];


        if (
            supported.includes(
                segment
            )
        ) {

            return segment;

        }


        return "outro";

    }


    /* =====================================================
       PERFIL DE SIMULAÇÃO
    ====================================================== */

    function getSegmentProfile(
        segment
    ) {

        const profiles = {

            estetica: {
                monthly: [90, 190],
                score: [28, 58]
            },

            podologia: {
                monthly: [55, 125],
                score: [30, 62]
            },

            odontologia: {
                monthly: [100, 220],
                score: [30, 64]
            },

            beleza: {
                monthly: [90, 200],
                score: [28, 60]
            },

            barbearia: {
                monthly: [90, 210],
                score: [28, 60]
            },

            manicure: {
                monthly: [70, 170],
                score: [28, 60]
            },

            cilios: {
                monthly: [65, 165],
                score: [28, 60]
            },

            "energia-solar": {
                monthly: [45, 110],
                score: [28, 60]
            },

            assistencia: {
                monthly: [65, 155],
                score: [28, 62]
            },

            vidracaria: {
                monthly: [45, 120],
                score: [28, 60]
            },

            limpeza: {
                monthly: [60, 155],
                score: [28, 62]
            },

            seguros: {
                monthly: [120, 280],
                score: [28, 58]
            },

            advocacia: {
                monthly: [70, 165],
                score: [30, 62]
            },

            outro: {
                monthly: [55, 135],
                score: [28, 62]
            }

        };


        return (
            profiles[
                segment
            ] ||
            profiles.outro
        );

    }


    /* =====================================================
       GERAR RELATÓRIO
    ====================================================== */

    function buildReport(
        lead
    ) {

        const profile =
            getSegmentProfile(
                lead.segment
            );


        /*
            A identidade do negócio
            vira a semente da análise.

            Resultado:
            mesma entrada = mesmos números.
        */

        const seedText =
            [
                METHOD_VERSION,
                lead.company,
                lead.region,
                lead.segment,
                lead.segmentName,
                lead.address,
                lead.placeId
            ]
                .join("|");


        const rng =
            createSeededRandom(
                seedText
            );


        const monthly =
            randomBetween(
                rng,
                profile.monthly[0],
                profile.monthly[1]
            );


        const weekly =
            Math.max(
                5,
                Math.round(
                    monthly /
                    4.33
                )
            );


        const presence =
            randomBetween(
                rng,
                profile.score[0],
                profile.score[1]
            );


        const googleScore =
            clamp(
                presence +
                randomBetween(
                    rng,
                    -8,
                    7
                ),
                15,
                82
            );


        const authorityScore =
            clamp(
                presence +
                randomBetween(
                    rng,
                    -9,
                    9
                ),
                15,
                84
            );


        const reviewsScore =
            clamp(
                presence +
                randomBetween(
                    rng,
                    -10,
                    10
                ),
                12,
                86
            );


        const overall =
            Math.round(
                (
                    googleScore *
                    0.40
                ) +
                (
                    authorityScore *
                    0.32
                ) +
                (
                    reviewsScore *
                    0.28
                )
            );


        const uncaptured =
            clamp(
                100 -
                overall +
                randomBetween(
                    rng,
                    -4,
                    5
                ),
                30,
                88
            );


        const demand =
            getDemandLevel(
                monthly
            );


        const competition =
            getCompetitionLevel(
                rng
            );


        const keywords =
            buildKeywords(
                lead.segmentName,
                lead.region
            );


        const keywordData =
            buildKeywordData(
                keywords,
                monthly,
                rng
            );


        const snapshotHash =
            hashString(
                seedText
            )
                .toString(36)
                .toUpperCase()
                .slice(
                    0,
                    7
                );


        return {

            company:
                lead.company,

            segmentKey:
                getReportSegmentKey(
                    lead.segment
                ),

            originalSegmentKey:
                lead.segment,

            segmentLabel:
                lead.segmentName,

            region:
                lead.region,

            address:
                lead.address,

            phone:
                lead.phone,

            lat:
                lead.lat,

            lon:
                lead.lon,

            bairro:
                lead.bairro,

            cep:
                lead.cep,

            placeId:
                lead.placeId,

            radius:
                "3",

            weekly,

            monthly,

            presence,

            overall,

            googleScore,

            authorityScore,

            reviewsScore,

            uncaptured,

            demandLevel:
                demand.label,

            demandMeter:
                demand.meter,

            competitionLevel:
                competition.label,

            competitionMeter:
                competition.meter,

            visibilityLevel:
                presence < 40
                    ? "Baixa"
                    : presence < 65
                        ? "Média"
                        : "Alta",

            visibilityMeter:
                presence,

            nearbyCompetitors:
                randomBetween(
                    rng,
                    6,
                    22
                ),

            keywordData,

            selectedServices:
                keywords.slice(
                    0,
                    3
                ),

            snapshotId:
                `RL-${snapshotHash}`,

            analysisId:
                `RL-${snapshotHash}`,

            analysisDate:
                new Date()
                    .toISOString(),

            methodVersion:
                METHOD_VERSION,

            source:
                "posicionamento-local",

            /*
                Importante:
                estes indicadores são
                estimativas estratégicas.
            */

            simulated:
                true

        };

    }


    /* =====================================================
       TERMOS DE BUSCA
    ====================================================== */

    function buildKeywords(
        segmentName,
        region
    ) {

        const name =
            segmentName ||
            "serviço";


        const city =
            String(
                region ||
                ""
            )
                .split("-")[0]
                .trim();


        return [

            `${name} perto de mim`,

            `${name} em ${city}`,

            `melhor ${name}`,

            `${name} próximo`,

            `${name} preço`,

            `${name} atendimento`

        ];

    }


    function buildKeywordData(
        keywords,
        monthly,
        rng
    ) {

        const weights =
            keywords.map(
                function (
                    _,
                    index
                ) {

                    return Math.max(
                        0.20,
                        0.62 -
                        (
                            index *
                            0.065
                        ) +
                        (
                            rng() *
                            0.10
                        )
                    );

                }
            );


        const total =
            weights.reduce(
                function (
                    sum,
                    value
                ) {

                    return (
                        sum +
                        value
                    );

                },
                0
            );


        return keywords.map(
            function (
                keyword,
                index
            ) {

                return {

                    keyword,

                    volume:
                        Math.max(
                            4,
                            Math.round(
                                monthly *
                                (
                                    weights[index] /
                                    total
                                )
                            )
                        )

                };

            }
        );

    }


    /* =====================================================
       DEMANDA / CONCORRÊNCIA
    ====================================================== */

    function getDemandLevel(
        monthly
    ) {

        if (
            monthly < 70
        ) {

            return {
                label:
                    "Moderada",

                meter:
                    48
            };

        }


        if (
            monthly < 140
        ) {

            return {
                label:
                    "Relevante",

                meter:
                    68
            };

        }


        return {
            label:
                "Alta",

            meter:
                88
        };

    }


    function getCompetitionLevel(
        rng
    ) {

        const options = [

            {
                label:
                    "Média",

                meter:
                    60
            },

            {
                label:
                    "Média-alta",

                meter:
                    74
            },

            {
                label:
                    "Alta",

                meter:
                    86
            }

        ];


        return options[
            randomBetween(
                rng,
                0,
                options.length - 1
            )
        ];

    }


    /* =====================================================
       RANDOM DETERMINÍSTICO
    ====================================================== */

    function hashString(
        text
    ) {

        let hash =
            2166136261;


        const value =
            String(
                text ||
                ""
            );


        for (
            let index = 0;
            index < value.length;
            index++
        ) {

            hash ^=
                value.charCodeAt(
                    index
                );


            hash =
                Math.imul(
                    hash,
                    16777619
                );

        }


        return (
            hash >>>
            0
        );

    }


    function createSeededRandom(
        seedText
    ) {

        let seed =
            hashString(
                seedText
            ) || 1;


        return function () {

            seed +=
                0x6D2B79F5;


            let value =
                seed;


            value =
                Math.imul(
                    value ^
                    (
                        value >>>
                        15
                    ),
                    value |
                    1
                );


            value ^=
                value +
                Math.imul(
                    value ^
                    (
                        value >>>
                        7
                    ),
                    value |
                    61
                );


            return (
                (
                    value ^
                    (
                        value >>>
                        14
                    )
                ) >>>
                0
            ) /
            4294967296;

        };

    }


    function randomBetween(
        rng,
        min,
        max
    ) {

        return (
            Math.floor(
                rng() *
                (
                    max -
                    min +
                    1
                )
            ) +
            min
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


    /* =====================================================
       PREPARAR TELA
    ====================================================== */

    function prepareLoadingScreen(
        lead
    ) {

        const hero =
            document.querySelector(
                ".hero"
            );


        const searchPanel =
            document.querySelector(
                ".search-panel"
            );


        const entryContext =
            document.getElementById(
                "entryContext"
            );


        const loadingSection =
            document.getElementById(
                "loadingSection"
            );


        if (hero) {

            hero.style.display =
                "none";

        }


        if (searchPanel) {

            searchPanel.style.display =
                "none";

        }


        if (entryContext) {

            entryContext.classList.remove(
                "hidden"
            );


            const text =
                document.getElementById(
                    "entryContextText"
                );


            if (text) {

                text.textContent =
                    `${lead.company} identificado em ${lead.region}`;

            }

        }


        if (loadingSection) {

            loadingSection.classList.remove(
                "hidden"
            );


            loadingSection.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "center"
            });

        }

    }


    /* =====================================================
       ANIMAÇÃO
    ====================================================== */

    function runBridgeLoading(
        lead
    ) {

        const title =
            document.getElementById(
                "loadingTitle"
            );


        const text =
            document.getElementById(
                "loadingText"
            );


        const progress =
            document.getElementById(
                "progressBar"
            );


        const steps =
            Array.from(
                document.querySelectorAll(
                    ".loading-step"
                )
            );


        const sequence = [

            {
                title:
                    "Localizando seu negócio...",

                text:
                    `Confirmando a região de ${lead.company}.`,

                progress:
                    22
            },

            {
                title:
                    "Analisando a demanda local...",

                text:
                    `Mapeando intenções relacionadas a ${lead.segmentName}.`,

                progress:
                    48
            },

            {
                title:
                    "Comparando presença e oportunidade...",

                text:
                    "Organizando os principais sinais da análise.",

                progress:
                    76
            },

            {
                title:
                    "Diagnóstico pronto.",

                text:
                    "Abrindo seu relatório personalizado...",

                progress:
                    100
            }

        ];


        let index =
            0;


        function next() {

            const item =
                sequence[
                    index
                ];


            if (title) {

                title.textContent =
                    item.title;

            }


            if (text) {

                text.textContent =
                    item.text;

            }


            if (progress) {

                progress.style.width =
                    `${item.progress}%`;

            }


            steps.forEach(
                function (
                    step,
                    stepIndex
                ) {

                    step.classList.toggle(
                        "active",
                        stepIndex ===
                        index
                    );


                    step.classList.toggle(
                        "done",
                        stepIndex <
                        index
                    );

                }
            );


            index++;


            if (
                index <
                sequence.length
            ) {

                setTimeout(
                    next,
                    650
                );

                return;

            }


            setTimeout(
                function () {

                    window.location.replace(
                        "proposta.html"
                    );

                },
                550
            );

        }


        next();

    }


    /* =====================================================
       EXECUTAR
    ====================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            startLandingBridge
        );

    }

    else {

        startLandingBridge();

    }

})();
