/* =========================================================
   RADAR LOCAL — EMPRESA REAL → DIAGNÓSTICO
   Persiste a empresa selecionada no Google Places dentro
   do relatório atual sem alterar o motor estimativo V5.
========================================================= */

(() => {
  const form = document.getElementById("analysisForm");

  if (!form) {
    return;
  }

  const REPORT_KEY = "radarProposal";
  const SNAPSHOTS_KEY = "radarLocalSnapshotsV1";
  const SELECTED_PLACE_KEY = "radarSelectedPlaceV1";

  const getSelectedPlace = () =>
    window.RadarPlaceSearch?.getSelectedPlace?.() ||
    window.RadarSelectedPlace ||
    null;

  const buildGoogleContext = place => {
    if (!place?.placeId) {
      return null;
    }

    const latitude =
      Number.isFinite(Number(place.latitude))
        ? Number(place.latitude)
        : null;

    const longitude =
      Number.isFinite(Number(place.longitude))
        ? Number(place.longitude)
        : null;

    return {
      placeId: String(place.placeId || ""),
      name: String(place.name || ""),
      address: place.address
        ? String(place.address)
        : "",
      primaryType: place.primaryType
        ? String(place.primaryType)
        : "",
      latitude,
      longitude,
      provider: "google_places",
      matched: true
    };
  };

  const persistSelectedPlace = context => {
    try {
      if (context) {
        localStorage.setItem(
          SELECTED_PLACE_KEY,
          JSON.stringify({
            ...context,
            selectedAt: new Date().toISOString()
          })
        );
      } else {
        localStorage.removeItem(SELECTED_PLACE_KEY);
      }
    } catch (error) {
      console.warn(
        "Não foi possível salvar a empresa selecionada.",
        error
      );
    }
  };

  const enrichCurrentReport = context => {
    if (!context) {
      return;
    }

    try {
      const rawReport = localStorage.getItem(REPORT_KEY);

      if (!rawReport) {
        return;
      }

      const report = JSON.parse(rawReport);

      if (!report || typeof report !== "object") {
        return;
      }

      const canonicalCompany = String(context.name || report.company || "").trim();

      const enriched = {
        ...report,
        company: canonicalCompany || report.company,
        placeId: context.placeId,
        latitude: context.latitude,
        longitude: context.longitude,
        primaryType: context.primaryType,
        googleMatched: true,
        locationSource: "google_places",
        googlePlace: {
          ...context
        }
      };

      localStorage.setItem(
        REPORT_KEY,
        JSON.stringify(enriched)
      );

      const snapshotKey = report.snapshotKey;
      const rawSnapshots = localStorage.getItem(SNAPSHOTS_KEY);

      if (!snapshotKey || !rawSnapshots) {
        return;
      }

      const snapshots = JSON.parse(rawSnapshots);

      if (
        snapshots &&
        snapshots[snapshotKey]?.data
      ) {
        snapshots[snapshotKey].data = {
          ...snapshots[snapshotKey].data,
          company: canonicalCompany || snapshots[snapshotKey].data.company,
          placeId: context.placeId,
          latitude: context.latitude,
          longitude: context.longitude,
          primaryType: context.primaryType,
          googleMatched: true,
          locationSource: "google_places",
          googlePlace: {
            ...context
          }
        };

        localStorage.setItem(
          SNAPSHOTS_KEY,
          JSON.stringify(snapshots)
        );
      }
    } catch (error) {
      console.warn(
        "Não foi possível vincular o Google Places ao diagnóstico.",
        error
      );
    }
  };

  form.addEventListener(
    "submit",
    () => {
      const place = getSelectedPlace();
      const context = buildGoogleContext(place);

      persistSelectedPlace(context);

      if (!context) {
        return;
      }

      /*
       * O app.js grava radarProposal de forma síncrona no começo
       * do submit. Este microatraso roda logo depois e acrescenta
       * a identidade real do Google ao mesmo relatório.
       */
      setTimeout(() => {
        enrichCurrentReport(context);
      }, 0);

      /* Reforço após a animação, caso outro fluxo regrave o relatório. */
      setTimeout(() => {
        enrichCurrentReport(context);
      }, 2800);
    },
    true
  );

  window.RadarPlaceDiagnosticBridge = {
    getSelectedPlaceContext: () => {
      const place = getSelectedPlace();
      return buildGoogleContext(place);
    },
    enrichCurrentReport
  };
})();
