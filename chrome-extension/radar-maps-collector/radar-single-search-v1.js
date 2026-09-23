(() => {
  "use strict";

  const TOP_BUTTON = "#mapsOpenGoogleButton";
  const BATCH_BUTTON = "#v4BatchSearch";

  function syncSingleSearchUi() {
    const top = document.querySelector(TOP_BUTTON);
    const batch = document.querySelector(BATCH_BUTTON);
    const controls = document.querySelector("#v4SearchControls");

    if (top) {
      top.innerHTML = `Mapear região completa <span>→</span>`;
      top.classList.add("radar-single-search-button");
      if (batch) {
        top.disabled = !!batch.disabled;
        top.title = batch.title || "Mapeia a região e completa os contatos automaticamente";
      }
    }

    controls?.classList.add("radar-single-search-controls");
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
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "class"] });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncSingleSearchUi, { once: true });
  } else {
    syncSingleSearchUi();
  }

  setInterval(syncSingleSearchUi, 700);
})();
