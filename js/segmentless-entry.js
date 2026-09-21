/* =========================================================
   RADAR LOCAL — ENTRADA SEM SEGMENTO
   Remove o campo de segmento da interface sem quebrar
   o motor legado que ainda espera um valor interno.
========================================================= */

(() => {
  const select = document.getElementById("segment");
  if (!select) return;

  /*
    Mantemos um valor interno neutro apenas por compatibilidade
    com o app legado. Ele não representa um segmento real.
  */
  select.innerHTML = "";

  const neutral = document.createElement("option");
  neutral.value = "custom:negocio-local";
  neutral.textContent = "Negócio local";
  neutral.selected = true;
  select.appendChild(neutral);
  select.required = false;

  const field = select.closest(".field");
  if (field) {
    field.style.display = "none";
    field.setAttribute("aria-hidden", "true");
  }

  const grid = select.closest(".form-grid");
  if (grid) {
    grid.style.gridTemplateColumns = "1fr";
  }

  const company = document.getElementById("company");
  if (company) {
    company.placeholder = "Ex.: Pizzaria Roma, Clínica Moura, Pensou Seguros";
  }

  /*
    O resultado intermediário também deixa de exibir qualquer
    classificação de segmento recebida por URL ou snapshot.
  */
  const cleanResultSubtitle = () => {
    const subtitle = document.getElementById("resultsSubtitle");
    const region = document.getElementById("region")?.value?.trim();
    const radius = document.getElementById("radius")?.value || "3";

    if (subtitle && region) {
      subtitle.textContent = `${region} • raio de ${radius} km`;
    }
  };

  const observer = new MutationObserver(cleanResultSubtitle);
  const subtitle = document.getElementById("resultsSubtitle");
  if (subtitle) {
    observer.observe(subtitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
})();
