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

    Importante: só alteramos o texto quando ele realmente mudou.
    Isso evita um loop de MutationObserver que poderia travar a tela
    exatamente no fim do carregamento.
  */
  const cleanResultSubtitle = () => {
    const subtitle = document.getElementById("resultsSubtitle");
    const region = document.getElementById("region")?.value?.trim();
    const radius = document.getElementById("radius")?.value || "3";

    if (!subtitle || !region) return;

    const nextText = `${region} • raio de ${radius} km`;

    if (subtitle.textContent?.trim() !== nextText) {
      subtitle.textContent = nextText;
    }
  };

  const subtitle = document.getElementById("resultsSubtitle");

  if (subtitle) {
    const observer = new MutationObserver(cleanResultSubtitle);

    observer.observe(subtitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
})();
