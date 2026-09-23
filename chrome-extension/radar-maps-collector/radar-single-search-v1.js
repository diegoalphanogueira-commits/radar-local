(() => {
  "use strict";

  const TOP_BUTTON = "#mapsOpenGoogleButton";
  const BATCH_BUTTON = "#v4BatchSearch";

  function syncSingleSearchUi() {
    const top = document.querySelector(TOP_BUTTON);
    const batch = document.querySelector(BATCH_BUTTON);
    const controls = document.querySelector("#v4SearchControls");

    if (top) {
      const nextLabel = `Mapear região completa <span>→</span>`;
      if (top.innerHTML !== nextLabel) top.innerHTML = nextLabel;
      if (!top.classList.contains("radar-single-search-button")) top.classList.add("radar-single-search-button");

      if (batch) {
        const shouldDisable = !!batch.disabled;
        const nextTitle = batch.title || "Mapeia a região e completa os contatos automaticamente";
        if (top.disabled !== shouldDisable) top.disabled = shouldDisable;
        if (top.title !== nextTitle) top.title = nextTitle;
      }
    }

    if (controls && !controls.classList.contains("radar-single-search-controls")) {
      controls.classList.add("radar-single-search-controls");
    }
  }

  document.addEventListener("click", event => {
    const top = event.target?.closest?.(TOP_BUTTON);
    if (!top) return;

    // Intercepta o fluxo legado antes que ele abra uma segunda busca.
    // Outros listeners do document (ex.: progresso) ainda recebem o clique.
    event.preventDefault();
    event.stopPropagation();

    const batch = document.querySelector(BATCH_BUTTON);
    if (!batch || batch.disabled) return;
    batch.click();
  }, true);

  const observer = new MutationObserver(syncSingleSearchUi);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"]
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncSingleSearchUi, { once: true });
  } else {
    syncSingleSearchUi();
  }

  setInterval(syncSingleSearchUi, 700);
})();
