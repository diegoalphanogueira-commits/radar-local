/* =========================================================
   RADAR LOCAL — BENCHMARK CAPTURE
   Mantém uma única consulta Nearby e reaproveita o benchmark
   devolvido pelo backend para o relatório atual.
========================================================= */

(() => {
  if (window.__radarBenchmarkCaptureInstalled) return;
  window.__radarBenchmarkCaptureInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const PROPOSAL_KEY = "radarProposal";

  const getUrl = input => {
    if (typeof input === "string") return input;
    if (input instanceof Request) return input.url;
    return String(input || "");
  };

  const readProposal = () => {
    try {
      return JSON.parse(localStorage.getItem(PROPOSAL_KEY) || "null");
    } catch {
      return null;
    }
  };

  const writeProposal = data => {
    if (!data) return;
    try {
      localStorage.setItem(PROPOSAL_KEY, JSON.stringify(data));
    } catch {}
  };

  const enrichNearbyRequest = (url, init) => {
    if (!url.includes("/radar/local-diagnostic/nearby")) return init;
    if (!init || typeof init.body !== "string") return init;

    try {
      const body = JSON.parse(init.body);
      const proposal = readProposal();
      const placeId = String(
        body?.placeId ||
        proposal?.placeId ||
        proposal?.googlePlace?.placeId ||
        ""
      ).trim();

      if (!placeId || body.placeId) return init;

      return {
        ...init,
        body: JSON.stringify({
          ...body,
          placeId
        })
      };
    } catch {
      return init;
    }
  };

  const captureSearchResponse = async response => {
    try {
      const payload = await response.clone().json();
      const place = Array.isArray(payload?.places) ? payload.places[0] : null;
      if (!place) return;

      const proposal = readProposal();
      if (!proposal) return;

      proposal.placeId = place.placeId || proposal.placeId || "";
      proposal.latitude = Number.isFinite(Number(place.latitude))
        ? Number(place.latitude)
        : proposal.latitude;
      proposal.longitude = Number.isFinite(Number(place.longitude))
        ? Number(place.longitude)
        : proposal.longitude;
      proposal.primaryType = place.primaryType || proposal.primaryType || "";
      proposal.googlePlace = {
        ...(proposal.googlePlace || {}),
        placeId: proposal.placeId,
        latitude: proposal.latitude,
        longitude: proposal.longitude,
        primaryType: proposal.primaryType,
        name: place.name || proposal.company || "",
        address: place.address || proposal.address || ""
      };

      writeProposal(proposal);
    } catch {}
  };

  const persistBenchmark = (benchmark, payload) => {
    const proposal = readProposal();
    if (!proposal || !benchmark) return;

    proposal.benchmark = benchmark;
    proposal.benchmarkUpdatedAt = new Date().toISOString();
    proposal.googleNearbyRawCount = Number(payload?.count) || proposal.googleNearbyRawCount || 0;
    proposal.googleNearbyProvider = payload?.provider || proposal.googleNearbyProvider || "google_places";

    writeProposal(proposal);
  };

  const captureNearbyResponse = async response => {
    try {
      const payload = await response.clone().json();
      if (!payload?.benchmark) return;

      /*
        Salva imediatamente e repete o merge logo depois.
        O mapa também persiste radarProposal ao terminar de renderizar;
        por isso o segundo merge impede que um objeto antigo apague o benchmark.
      */
      persistBenchmark(payload.benchmark, payload);

      setTimeout(
        () => persistBenchmark(payload.benchmark, payload),
        300
      );

      setTimeout(
        () => persistBenchmark(payload.benchmark, payload),
        1200
      );

      window.dispatchEvent(new CustomEvent("radar:benchmark-ready", {
        detail: payload.benchmark
      }));
    } catch {}
  };

  window.fetch = async (input, init) => {
    const url = getUrl(input);
    const nextInit = enrichNearbyRequest(url, init);
    const response = await originalFetch(input, nextInit);

    if (response.ok && url.includes("/radar/local-diagnostic/search")) {
      await captureSearchResponse(response);
    }

    if (response.ok && url.includes("/radar/local-diagnostic/nearby")) {
      await captureNearbyResponse(response);
    }

    return response;
  };
})();
