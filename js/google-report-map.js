/* =========================================================
   RADAR LOCAL — GOOGLE MAPS + GOOGLE PLACES
   Fonte dos negócios semelhantes: backend protegido do Radar.
   O mapa usa a chave browser restrita ao domínio do Radar.
========================================================= */

(() => {
  const API_BASE = "https://api.usekorax.com";
  const TOKEN_KEY = "radarAuthTokenV1";
  const MAX_GOOGLE_RESULTS = 20;

  const mapElement = document.getElementById("opportunityMap");
  if (!mapElement) return;

  const byId = id => document.getElementById(id);
  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const safeJson = value => {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  };

  const normalizeName = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const setMapState = message => {
    mapElement.innerHTML = `
      <div style="height:100%;min-height:300px;display:grid;place-items:center;text-align:center;padding:30px;color:#7b8798;font-family:Inter,Arial,sans-serif;line-height:1.5;">
        ${message}
      </div>
    `;
  };

  const getToken = () => sessionStorage.getItem(TOKEN_KEY) || "";

  const radarFetch = async (path, options = {}) => {
    const token = getToken();
    if (!token) throw new Error("RADAR_SESSION_MISSING");

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("RADAR_SESSION_EXPIRED");
    }

    return response;
  };

  const getPrimaryType = data => {
    const explicit = String(
      data?.primaryType ||
      data?.googlePlace?.primaryType ||
      ""
    ).trim();

    if (/^[a-z0-9_]+$/.test(explicit)) return explicit;

    const text = `${data?.segmentKey || ""} ${data?.segmentLabel || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (text.includes("seguro")) return "insurance_agency";
    if (text.includes("advoc")) return "lawyer";
    if (text.includes("odont") || text.includes("dent")) return "dentist";
    if (text.includes("estet") || text.includes("beleza") || text.includes("salao")) return "beauty_salon";
    if (text.includes("imobili")) return "real_estate_agency";
    if (text.includes("barbear")) return "barber_shop";
    if (text.includes("concession")) return "car_dealer";

    return "";
  };

  const getCompetitionLevel = count => {
    if (count >= 15) return "Alta";
    if (count >= 8) return "Média-alta";
    if (count >= 4) return "Moderada";
    return "Baixa";
  };

  const loadGoogleMaps = apiKey => new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }

    const existing = document.querySelector('script[data-radar-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google?.maps));
      existing.addEventListener("error", () => reject(new Error("GOOGLE_MAPS_LOAD_ERROR")));
      return;
    }

    const callbackName = `__radarGoogleMapsReady_${Date.now()}`;
    let finished = false;

    const cleanup = () => {
      try { delete window[callbackName]; } catch {}
    };

    window[callbackName] = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.dataset.radarGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("GOOGLE_MAPS_LOAD_ERROR"));
    };

    document.head.appendChild(script);
  });

  const resolvePlace = async data => {
    let latitude = Number(
      data?.latitude ??
      data?.googlePlace?.latitude ??
      data?.lat
    );

    let longitude = Number(
      data?.longitude ??
      data?.googlePlace?.longitude ??
      data?.lon
    );

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude !== 0 &&
      longitude !== 0
    ) {
      return {
        latitude,
        longitude,
        placeId: data?.placeId || data?.googlePlace?.placeId || "",
        primaryType: getPrimaryType(data)
      };
    }

    const query = [data?.company, data?.region]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!query) throw new Error("RADAR_PLACE_COORDINATES_MISSING");

    const response = await radarFetch("/radar/local-diagnostic/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    if (!response.ok) throw new Error(`RADAR_PLACE_SEARCH_${response.status}`);

    const payload = await response.json();
    const place = Array.isArray(payload?.places) ? payload.places[0] : null;

    latitude = Number(place?.latitude);
    longitude = Number(place?.longitude);

    if (!place || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("RADAR_PLACE_NOT_FOUND");
    }

    data.placeId = place.placeId || data.placeId || "";
    data.latitude = latitude;
    data.longitude = longitude;
    data.primaryType = place.primaryType || data.primaryType || "";
    data.googlePlace = {
      ...(data.googlePlace || {}),
      placeId: data.placeId,
      latitude,
      longitude,
      primaryType: data.primaryType,
      name: place.name || data.company || "",
      address: place.address || data.address || ""
    };

    try {
      localStorage.setItem("radarProposal", JSON.stringify(data));
    } catch {}

    return {
      latitude,
      longitude,
      placeId: data.placeId,
      primaryType: getPrimaryType(data)
    };
  };

  const fetchMapConfig = async () => {
    const response = await radarFetch("/radar/config/maps");
    if (!response.ok) throw new Error(`RADAR_MAP_CONFIG_${response.status}`);

    const payload = await response.json();
    const apiKey = String(payload?.googleMapsApiKey || "").trim();

    if (!apiKey || apiKey.length < 30) {
      throw new Error("RADAR_MAP_KEY_INVALID");
    }

    return apiKey;
  };

  const fetchNearby = async ({ latitude, longitude, radiusKm, primaryType, placeId }) => {
    if (!primaryType) {
      return {
        success: false,
        places: [],
        rawCount: 0,
        benchmark: null,
        reason: "PRIMARY_TYPE_MISSING"
      };
    }

    const response = await radarFetch("/radar/local-diagnostic/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude,
        longitude,
        radiusMeters: Math.round(radiusKm * 1000),
        primaryType,
        placeId: String(placeId || "").trim()
      })
    });

    if (!response.ok) {
      throw new Error(`RADAR_NEARBY_${response.status}`);
    }

    const payload = await response.json();

    return {
      success: true,
      places: Array.isArray(payload?.places) ? payload.places : [],
      rawCount: Number(payload?.count) || 0,
      provider: payload?.provider || "google_places",
      benchmark: payload?.benchmark || null
    };
  };

  const makeMarker = ({ maps, map, position, fillColor, scale, title, content }) => {
    const marker = new maps.Marker({
      map,
      position,
      title,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale,
        fillColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeOpacity: 1,
        strokeWeight: 2.5
      }
    });

    if (content) {
      const info = new maps.InfoWindow({ content });
      marker.addListener("click", () => info.open({ map, anchor: marker }));
    }

    return marker;
  };

  const renderGoogleMap = async ({ maps, data, place, nearbyResult }) => {
    const radiusKm = Math.max(0.05, Number(data?.radius) || 3);
    const company = String(data?.company || "Sua empresa");
    const address = String(data?.address || data?.googlePlace?.address || data?.region || "");
    const center = { lat: place.latitude, lng: place.longitude };

    mapElement.innerHTML = "";

    const map = new maps.Map(mapElement, {
      center,
      zoom: radiusKm <= 1 ? 15 : radiusKm <= 3 ? 14 : radiusKm <= 5 ? 13 : 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "cooperative",
      backgroundColor: "#eef3f8"
    });

    const radiusCircle = new maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      strokeColor: "#2878f0",
      strokeOpacity: 0.72,
      strokeWeight: 2,
      fillColor: "#2878f0",
      fillOpacity: 0.08,
      clickable: false
    });

    makeMarker({
      maps,
      map,
      position: center,
      fillColor: "#2878f0",
      scale: 11,
      title: company,
      content: `
        <div style="min-width:190px;font-family:Inter,Arial,sans-serif;line-height:1.45;">
          <strong style="display:block;margin-bottom:4px;font-size:14px;color:#202124;">${company.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]))}</strong>
          <span style="font-size:11px;color:#667085;">${address.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]))}</span>
        </div>
      `
    });

    const ownPlaceId = String(place.placeId || data?.placeId || "").trim();
    const ownName = normalizeName(company);

    const competitors = (nearbyResult?.places || []).filter(item => {
      const latitude = Number(item?.latitude);
      const longitude = Number(item?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
      if (String(item?.businessStatus || "").toUpperCase() === "CLOSED_PERMANENTLY") return false;

      const itemPlaceId = String(item?.placeId || "").trim();
      if (ownPlaceId && itemPlaceId && itemPlaceId === ownPlaceId) return false;

      const itemName = normalizeName(item?.name);
      if (ownName && itemName && ownName === itemName) return false;

      return true;
    });

    competitors.forEach(item => {
      const competitorName = String(item?.name || "Negócio semelhante");
      const competitorAddress = String(item?.address || "");

      const escapedName = competitorName.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));
      const escapedAddress = competitorAddress.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char]));

      makeMarker({
        maps,
        map,
        position: { lat: Number(item.latitude), lng: Number(item.longitude) },
        fillColor: "#ea4335",
        scale: 7,
        title: competitorName,
        content: `
          <div style="min-width:180px;font-family:Inter,Arial,sans-serif;line-height:1.45;">
            <strong style="display:block;margin-bottom:4px;font-size:13px;color:#202124;">${escapedName}</strong>
            <span style="font-size:10px;color:#667085;">${escapedAddress}</span>
          </div>
        `
      });
    });

    const rawCount = Number(nearbyResult?.rawCount) || 0;
    const competitorCount = competitors.length;
    const capped = nearbyResult?.success && rawCount >= MAX_GOOGLE_RESULTS;
    const competitionLevel = nearbyResult?.success
      ? getCompetitionLevel(competitorCount)
      : "—";

    setText("mapCompanyName", company);
    setText("mapAddress", address || "Região analisada");
    setText("mapRadius", `${radiusKm} km`);

    if (nearbyResult?.success) {
      setText("nearbyCompetitors", capped ? `${competitorCount}*` : String(competitorCount));
      setText("mapCompetitionLevel", competitionLevel);
      setText("coverCompetitionLevel", competitionLevel);
      setText("competitionLevel", competitionLevel);

      let insight = "";

      if (capped) {
        insight = `O Google retornou ${competitorCount} negócios semelhantes além da sua empresa dentro do raio analisado. A consulta atingiu o limite de resultados, então podem existir outros negócios no entorno.`;
      } else if (competitorCount >= 15) {
        insight = `Foram retornados ${competitorCount} negócios semelhantes dentro do raio analisado. A leitura do Radar indica uma disputa local alta por atenção e escolha.`;
      } else if (competitorCount >= 8) {
        insight = `Foram retornados ${competitorCount} negócios semelhantes dentro do raio analisado. Existe uma presença relevante de concorrentes próximos disputando o mesmo mercado local.`;
      } else if (competitorCount >= 4) {
        insight = `Foram retornados ${competitorCount} negócios semelhantes na região. Existe disputa local, mas também espaço para construir mais destaque.`;
      } else {
        insight = `Foram retornados ${competitorCount} negócios semelhantes no raio analisado. A quantidade observada é menor, o que pode abrir espaço para ganhar presença local com mais força.`;
      }

      setText("mapInsight", insight);

      data.googleNearbyCount = competitorCount;
      data.googleNearbyRawCount = rawCount;
      data.googleNearbyCapped = capped;
      data.googleNearbyProvider = nearbyResult.provider || "google_places";
      data.googleNearbyFetchedAt = new Date().toISOString();
      data.competitionLevel = competitionLevel;

      if (nearbyResult?.benchmark) {
        data.benchmark = nearbyResult.benchmark;
        data.benchmarkUpdatedAt = new Date().toISOString();
      }

      try {
        localStorage.setItem("radarProposal", JSON.stringify(data));
      } catch {}

      if (nearbyResult?.benchmark) {
        window.dispatchEvent(new CustomEvent("radar:benchmark-ready", {
          detail: nearbyResult.benchmark
        }));
      }
    } else {
      setText("nearbyCompetitors", "—");
      setText("mapCompetitionLevel", "—");
      setText("mapInsight", "O mapa foi carregado, mas a categoria deste negócio ainda não está configurada para a consulta de negócios semelhantes.");
    }

    const mapPage = mapElement.closest(".map-page");
    const methodNote = mapPage?.querySelector(".method-note");

    if (methodNote) {
      methodNote.textContent = nearbyResult?.success
        ? `${capped ? "* " : ""}Mapa e negócios semelhantes consultados via Google. A consulta retorna até 20 resultados por vez e não representa necessariamente o total de empresas existentes na região. “Disputa local” é uma interpretação do Radar a partir dos resultados retornados.`
        : "Mapa consultado via Google. A leitura de negócios semelhantes depende da categoria disponível para o estabelecimento selecionado.";
    }

    const opportunityLegend = document.querySelector(".legend-opportunity")?.closest("span");
    if (opportunityLegend) opportunityLegend.style.display = "none";

    const bounds = radiusCircle.getBounds();
    if (bounds) map.fitBounds(bounds, 28);

    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        setTimeout(resolve, 350);
      };

      maps.event.addListenerOnce(map, "idle", finish);
      setTimeout(finish, 4500);
    });

    return { map, competitors };
  };

  const render = async () => {
    const data = safeJson(localStorage.getItem("radarProposal"));

    if (!data) {
      setMapState("Nenhum diagnóstico foi encontrado para carregar o mapa.");
      return;
    }

    setMapState("Carregando mapa e negócios semelhantes do Google...");

    try {
      const place = await resolvePlace(data);
      const radiusKm = Math.max(0.05, Number(data?.radius) || 3);
      const primaryType = place.primaryType || getPrimaryType(data);

      const [apiKey, nearbyResult] = await Promise.all([
        fetchMapConfig(),
        fetchNearby({
          latitude: place.latitude,
          longitude: place.longitude,
          radiusKm,
          primaryType,
          placeId: place.placeId
        })
      ]);

      const maps = await loadGoogleMaps(apiKey);
      await renderGoogleMap({ maps, data, place, nearbyResult });
    } catch (error) {
      console.error("[RadarGoogleMap]", error);

      if (error?.message === "RADAR_SESSION_MISSING" || error?.message === "RADAR_SESSION_EXPIRED") {
        setMapState("Sua sessão do Radar expirou. Volte ao Radar, entre novamente e gere o diagnóstico de novo.");
        return;
      }

      setMapState("Não foi possível carregar o mapa do Google neste momento. Atualize a página e tente novamente.");
    }
  };

  const googleMapReady = render();

  try {
    radarMapReady = googleMapReady;
  } catch {
    window.radarGoogleMapReady = googleMapReady;
  }
})();
