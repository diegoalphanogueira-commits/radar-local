/* =========================================================
   LANDING → RADAR LOCAL
========================================================= */

(async function () {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const origem =
        params.get("origem");


    if (
        origem !==
        "posicionamento-local"
    ) {

        return;

    }


    /* =====================================================
       DADOS RECEBIDOS
    ====================================================== */

    const company =
        (
            params.get("empresa") ||
            ""
        ).trim();


    const rawSegment =
        (
            params.get("segmento") ||
            ""
        ).trim();


    const segmentName =
        (
            params.get("segmento_nome") ||
            rawSegment ||
            "Outro segmento"
        ).trim();


    const region =
        (
            params.get("regiao") ||
            ""
        ).trim();


    const address =
        (
            params.get("endereco") ||
            ""
        ).trim();


    const phone =
        (
            params.get("telefone") ||
            ""
        ).trim();


    const lat =
        params.get("lat") ||
        "";


    const lon =
        params.get("lon") ||
        "";


    const bairro =
        params.get("bairro") ||
        "";


    const cep =
        params.get("cep") ||
        "";


    const placeId =
        params.get("place_id") ||
        "";


    const radius =
        "3";


    console.log(
        "Lead recebido da landing:",
        {
            company,
            rawSegment,
            segmentName,
            region,
            address
        }
    );


    if (
        !company ||
        !region ||
        !rawSegment
    ) {

        console.warn(
            "Dados insuficientes para iniciar o Radar."
        );

        return;

    }


    /* =====================================================
       SEGMENTO
    ====================================================== */

    let segmentKey =
        rawSegment;


    const beautyAliases = {

        barbearia:
            "beleza",

        manicure:
            "beleza",

        cilios:
            "beleza"

    };


    /*
        Segmentos relacionados à beleza.
    */

    if (
        beautyAliases[
            rawSegment
        ]
    ) {

        const baseKey =
            beautyAliases[
                rawSegment
            ];


        if (
            !RADAR_SEGMENTS[
                rawSegment
            ] &&
            RADAR_SEGMENTS[
                baseKey
            ]
        ) {

            RADAR_SEGMENTS[
                rawSegment
            ] = {

                ...RADAR_SEGMENTS[
                    baseKey
                ],

                label:
                    segmentName,

                keywords:
                    [
                        ...RADAR_SEGMENTS[
                            baseKey
                        ].keywords
                    ]

            };

        }

    }


    /*
        Outro segmento.
    */

    if (
        rawSegment ===
        "outro"
    ) {

        const slug =
            segmentName
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


        segmentKey =
            `outro-${slug || "segmento"}`;


        if (
            !RADAR_SEGMENTS[
                segmentKey
            ]
        ) {

            RADAR_SEGMENTS[
                segmentKey
            ] = {

                label:
                    segmentName,

                baseMonthly:
                    [
                        55,
                        135
                    ],

                scoreRange:
                    [
                        28,
                        62
                    ],

                keywords:
                    [
                        `${segmentName} perto de mim`,
                        `${segmentName} em ${region}`,
                        `${segmentName} próximo`,
                        `melhor ${segmentName}`,
                        `${segmentName} preço`,
                        `${segmentName} atendimento`
                    ]

            };

        }

    }


    /*
        Qualquer segmento da landing que
        ainda não exista no Radar recebe
        uma configuração genérica.
    */

    if (
        !RADAR_SEGMENTS[
            segmentKey
        ]
    ) {

        RADAR_SEGMENTS[
            segmentKey
        ] = {

            label:
                segmentName,

            baseMonthly:
                [
                    55,
                    135
                ],

            scoreRange:
                [
                    28,
                    62
                ],

            keywords:
                [
                    `${segmentName} perto de mim`,
                    `${segmentName} em ${region}`,
                    `${segmentName} próximo`,
                    `melhor ${segmentName}`,
                    `${segmentName} preço`,
                    `${segmentName} atendimento`
                ]

        };

    }


    /* =====================================================
       PREENCHER FORMULÁRIO
    ====================================================== */

    const companyInput =
        document.getElementById(
            "company"
        );


    const addressInput =
        document.getElementById(
            "address"
        );


    const segmentInput =
        document.getElementById(
            "segment"
        );


    const regionInput =
        document.getElementById(
            "region"
        );


    const radiusInput =
        document.getElementById(
            "radius"
        );


    if (companyInput) {

        companyInput.value =
            company;

    }


    if (addressInput) {

        addressInput.value =
            address;

    }


    if (regionInput) {

        regionInput.value =
            region;

    }


    if (radiusInput) {

        radiusInput.value =
            radius;

    }


    if (segmentInput) {

        const exists =
            Array.from(
                segmentInput.options
            )
                .some(
                    option =>
                        option.value ===
                        segmentKey
                );


        if (!exists) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                segmentKey;


            option.textContent =
                segmentName;


            segmentInput.appendChild(
                option
            );

        }


        segmentInput.value =
            segmentKey;

    }


    /* =====================================================
       SALVAR ENDEREÇO
    ====================================================== */

    if (address) {

        localStorage.setItem(
            "radarAddress",
            address
        );

    }


    /* =====================================================
       GERAR DIAGNÓSTICO
    ====================================================== */

    const data =
        getOrCreateSnapshot({

            company,

            region,

            segmentKey,

            radius

        });


    const enrichedData = {

        ...data,

        company,

        region,

        segmentKey,

        segmentLabel:
            segmentName,

        address,

        phone,

        lat,

        lon,

        bairro,

        cep,

        placeId,

        source:
            "posicionamento-local"

    };


    saveCurrentReport(
        enrichedData
    );


    /*
        Atualizar snapshot com
        os dados reais da landing.
    */

    try {

        const store =
            loadSnapshotStore();


        if (
            store[
                data.snapshotKey
            ]
        ) {

            store[
                data.snapshotKey
            ].data =
                enrichedData;


            saveSnapshotStore(
                store
            );

        }

    }

    catch (error) {

        console.warn(
            "Erro ao atualizar snapshot:",
            error
        );

    }


    /* =====================================================
       CARREGAMENTO
    ====================================================== */

    resultsSection
        .classList
        .add(
            "hidden"
        );


    loadingSection
        .classList
        .remove(
            "hidden"
        );


    loadingSection.scrollIntoView({

        behavior:
            "smooth",

        block:
            "center"

    });


    await runLoadingSequence(
        company,
        region
    );


    loadingSection
        .classList
        .add(
            "hidden"
        );


    /* =====================================================
       RESULTADO
    ====================================================== */

    renderSimulation(
        enrichedData
    );


    resultsSection
        .classList
        .remove(
            "hidden"
        );


    resultsSection.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });


    console.log(
        "Radar iniciado automaticamente."
    );

})();
