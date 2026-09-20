/* =========================================================
   RADAR LOCAL — BUSCA REAL DE EMPRESAS
   Google Places via backend protegido
========================================================= */

(() => {
  const companyInput = document.getElementById("company");
  const addressInput = document.getElementById("address");
  const regionInput = document.getElementById("region");
  const form = document.getElementById("analysisForm");

  if (!companyInput || !form) {
    return;
  }

  const MIN_CHARS = 3;
  const DEBOUNCE_MS = 450;

  let debounceTimer = null;
  let requestController = null;
  let activeIndex = -1;
  let currentPlaces = [];
  let selectedPlace = null;

  const injectStyles = () => {
    if (document.getElementById("radarPlaceSearchStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "radarPlaceSearchStyles";
    style.textContent = `
      .radar-place-field {
        position: relative;
      }

      .radar-place-results {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 8500;
        overflow: hidden;
        border: 1px solid #dfe5ee;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 18px 48px rgba(38, 55, 79, 0.16);
      }

      .radar-place-results[hidden] {
        display: none;
      }

      .radar-place-result,
      .radar-place-state {
        width: 100%;
        padding: 13px 15px;
        border: 0;
        border-bottom: 1px solid #edf1f6;
        background: #ffffff;
        text-align: left;
        font-family: "Inter", sans-serif;
      }

      .radar-place-result:last-child,
      .radar-place-state:last-child {
        border-bottom: 0;
      }

      .radar-place-result {
        display: block;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .radar-place-result:hover,
      .radar-place-result.is-active {
        background: #f4f8ff;
      }

      .radar-place-name {
        display: block;
        color: #202124;
        font-size: 0.86rem;
        font-weight: 750;
        line-height: 1.35;
      }

      .radar-place-address {
        display: block;
        margin-top: 4px;
        color: #6f7b8b;
        font-size: 0.74rem;
        line-height: 1.45;
      }

      .radar-place-state {
        color: #6f7b8b;
        font-size: 0.78rem;
        line-height: 1.45;
      }

      .radar-place-state.error {
        color: #b3261e;
      }

      .radar-place-selected {
        display: none;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        color: #188038;
        font-size: 0.72rem;
        font-weight: 650;
      }

      .radar-place-selected.visible {
        display: inline-flex;
      }

      .radar-place-selected-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #34a853;
      }
    `;

    document.head.appendChild(style);
  };

  const companyField = companyInput.closest(".field");
  if (!companyField) {
    return;
  }

  injectStyles();
  companyField.classList.add("radar-place-field");

  const resultsBox = document.createElement("div");
  resultsBox.id = "radarPlaceResults";
  resultsBox.className = "radar-place-results";
  resultsBox.hidden = true;
  resultsBox.setAttribute("role", "listbox");
  companyField.appendChild(resultsBox);

  const selectedStatus = document.createElement("div");
  selectedStatus.className = "radar-place-selected";
  selectedStatus.innerHTML = `
    <span class="radar-place-selected-dot" aria-hidden="true"></span>
    <span>Empresa localizada no Google</span>
  `;
  companyField.appendChild(selectedStatus);

  const ensureHiddenInput = name => {
    let input = form.querySelector(`input[name="${name}"]`);

    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }

    return input;
  };

  const placeIdInput = ensureHiddenInput("placeId");
  const latitudeInput = ensureHiddenInput("latitude");
  const longitudeInput = ensureHiddenInput("longitude");
  const primaryTypeInput = ensureHiddenInput("primaryType");

  const closeResults = () => {
    resultsBox.hidden = true;
    resultsBox.replaceChildren();
    currentPlaces = [];
    activeIndex = -1;
    companyInput.setAttribute("aria-expanded", "false");
  };

  const showState = (message, isError = false) => {
    const row = document.createElement("div");
    row.className = `radar-place-state${isError ? " error" : ""}`;
    row.textContent = message;

    resultsBox.replaceChildren(row);
    resultsBox.hidden = false;
    companyInput.setAttribute("aria-expanded", "true");
    activeIndex = -1;
  };

  const extractRegion = address => {
    if (!address) {
      return "";
    }

    const matches = [
      ...String(address).matchAll(/,\s*([^,]+?)\s*-\s*([A-Z]{2})(?=,|$)/g)
    ];

    if (!matches.length) {
      return "";
    }

    const match = matches[matches.length - 1];
    return `${match[1].trim()} - ${match[2].trim()}`;
  };

  const clearSelectedPlace = () => {
    selectedPlace = null;
    window.RadarSelectedPlace = null;

    placeIdInput.value = "";
    latitudeInput.value = "";
    longitudeInput.value = "";
    primaryTypeInput.value = "";

    selectedStatus.classList.remove("visible");
  };

  const selectPlace = place => {
    selectedPlace = place;
    window.RadarSelectedPlace = place;

    companyInput.value = place.name || companyInput.value;

    if (addressInput && place.address) {
      addressInput.value = place.address;
      addressInput.dispatchEvent(new Event("input", { bubbles: true }));
      addressInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (regionInput && place.address) {
      const detectedRegion = extractRegion(place.address);

      if (detectedRegion) {
        regionInput.value = detectedRegion;
        regionInput.dispatchEvent(new Event("input", { bubbles: true }));
        regionInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    placeIdInput.value = place.placeId || "";
    latitudeInput.value =
      Number.isFinite(Number(place.latitude))
        ? String(place.latitude)
        : "";
    longitudeInput.value =
      Number.isFinite(Number(place.longitude))
        ? String(place.longitude)
        : "";
    primaryTypeInput.value = place.primaryType || "";

    companyInput.dispatchEvent(new Event("change", { bubbles: true }));
    selectedStatus.classList.add("visible");
    closeResults();
  };

  const renderResults = places => {
    resultsBox.replaceChildren();
    currentPlaces = Array.isArray(places) ? places : [];
    activeIndex = -1;

    if (!currentPlaces.length) {
      showState("Nenhuma empresa encontrada. Tente incluir a cidade ou região.");
      return;
    }

    currentPlaces.forEach((place, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "radar-place-result";
      button.setAttribute("role", "option");
      button.dataset.index = String(index);

      const name = document.createElement("span");
      name.className = "radar-place-name";
      name.textContent = place.name || "Empresa";

      const address = document.createElement("span");
      address.className = "radar-place-address";
      address.textContent = place.address || "Endereço não informado";

      button.append(name, address);
      button.addEventListener("mousedown", event => {
        event.preventDefault();
        selectPlace(place);
      });

      resultsBox.appendChild(button);
    });

    resultsBox.hidden = false;
    companyInput.setAttribute("aria-expanded", "true");
  };

  const setActiveIndex = index => {
    const buttons = [...resultsBox.querySelectorAll(".radar-place-result")];

    if (!buttons.length) {
      activeIndex = -1;
      return;
    }

    activeIndex = Math.max(0, Math.min(index, buttons.length - 1));

    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === activeIndex);
      button.setAttribute(
        "aria-selected",
        buttonIndex === activeIndex ? "true" : "false"
      );
    });

    buttons[activeIndex]?.scrollIntoView({ block: "nearest" });
  };

  const buildQuery = () => {
    const company = companyInput.value.trim();
    const region = regionInput?.value.trim() || "";

    return [company, region]
      .filter(Boolean)
      .join(" ")
      .trim();
  };

  const runSearch = async () => {
    const company = companyInput.value.trim();

    if (company.length < MIN_CHARS) {
      closeResults();
      return;
    }

    if (!window.RadarAuth?.authFetch) {
      showState("A sessão do Radar ainda não está pronta.", true);
      return;
    }

    requestController?.abort();
    requestController = new AbortController();

    showState("Buscando empresas no Google...");

    try {
      const response = await window.RadarAuth.authFetch(
        "/radar/local-diagnostic/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: buildQuery()
          }),
          signal: requestController.signal
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          showState("Muitas buscas em sequência. Aguarde alguns segundos.", true);
          return;
        }

        throw new Error(`SEARCH_HTTP_${response.status}`);
      }

      const data = await response.json();
      renderResults(data?.places || []);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      if (
        error instanceof Error &&
        error.message === "RADAR_SESSION_EXPIRED"
      ) {
        closeResults();
        return;
      }

      console.error("[RadarPlaceSearch]", error);
      showState("Não foi possível buscar empresas agora. Tente novamente.", true);
    }
  };

  const scheduleSearch = () => {
    clearTimeout(debounceTimer);

    const value = companyInput.value.trim();

    if (
      selectedPlace &&
      value !== String(selectedPlace.name || "").trim()
    ) {
      clearSelectedPlace();
    }

    if (value.length < MIN_CHARS) {
      closeResults();
      return;
    }

    debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
  };

  companyInput.setAttribute("autocomplete", "off");
  companyInput.setAttribute("aria-autocomplete", "list");
  companyInput.setAttribute("aria-controls", "radarPlaceResults");
  companyInput.setAttribute("aria-expanded", "false");

  companyInput.addEventListener("input", scheduleSearch);

  companyInput.addEventListener("focus", () => {
    if (
      companyInput.value.trim().length >= MIN_CHARS &&
      !selectedPlace &&
      resultsBox.hidden
    ) {
      scheduleSearch();
    }
  });

  companyInput.addEventListener("keydown", event => {
    if (resultsBox.hidden) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(activeIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(activeIndex <= 0 ? currentPlaces.length - 1 : activeIndex - 1);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const place = currentPlaces[activeIndex];
      if (place) {
        selectPlace(place);
      }
      return;
    }

    if (event.key === "Escape") {
      closeResults();
    }
  });

  regionInput?.addEventListener("input", () => {
    if (
      companyInput.value.trim().length >= MIN_CHARS &&
      !selectedPlace
    ) {
      scheduleSearch();
    }
  });

  document.addEventListener("mousedown", event => {
    if (!companyField.contains(event.target)) {
      closeResults();
    }
  });

  window.addEventListener("radar:locked", closeResults);

  window.RadarPlaceSearch = {
    search: runSearch,
    getSelectedPlace: () => selectedPlace,
    clearSelectedPlace
  };
})();