(() => {
  "use strict";

  const ID = "radarExtractionProgressV1";
  let phase = "idle";
  let lastCount = 0;

  const $ = (selector, root = document) => root.querySelector(selector);

  function forceAutoEnrich() {
    const candidates = [
      "#mapsAutoDetail",
      "#v4AutoDetail",
      'input[type="checkbox"][name*="detail" i]',
      'input[type="checkbox"][id*="detail" i]'
    ];

    let input = null;
    for (const selector of candidates) {
      input = $(selector);
      if (input) break;
    }

    if (!input) {
      input = [...document.querySelectorAll('input[type="checkbox"]')].find(el => {
        const label = el.closest("label")?.innerText || "";
        return /completar\s+telefone|telefone,\s*site|hor[aá]rio\s+automaticamente/i.test(label);
      }) || null;
    }

    if (!input) return;
    input.checked = true;
    input.setAttribute("checked", "checked");
    input.disabled = true;
    input.setAttribute("aria-hidden", "true");

    const label = input.closest("label");
    if (label) {
      label.style.display = "none";
      label.setAttribute("aria-hidden", "true");
    } else {
      input.style.display = "none";
    }
  }

  function ensurePanel() {
    let panel = document.getElementById(ID);
    if (panel) return panel;

    const anchor = $("#mapsCollectorState") || $("#v4SearchControls") || $(".maps-search-row");
    if (!anchor) return null;

    panel = document.createElement("section");
    panel.id = ID;
    panel.className = "radar-extraction-progress is-idle";
    panel.innerHTML = `
      <div class="rep-head">
        <div class="rep-copy">
          <span class="rep-kicker">PROGRESSO DA EXTRAÇÃO</span>
          <strong id="repTitle">Pronto para mapear</strong>
          <span id="repText">O Radar mostrará o andamento da coleta em tempo real.</span>
        </div>
        <div class="rep-percent" id="repPercent">0%</div>
      </div>
      <div class="rep-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="rep-bar" id="repBar"></div>
      </div>
      <div class="rep-footer">
        <span id="repPhase"><i></i>Aguardando busca</span>
        <span id="repCount">0 empresas encontradas</span>
      </div>`;

    anchor.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function render({ percent, title, text, phaseLabel, count, state } = {}) {
    const panel = ensurePanel();
    if (!panel) return;

    const value = Math.max(0, Math.min(100, Number(percent ?? 0)));
    const bar = $("#repBar", panel);
    const percentNode = $("#repPercent", panel);
    const titleNode = $("#repTitle", panel);
    const textNode = $("#repText", panel);
    const phaseNode = $("#repPhase", panel);
    const countNode = $("#repCount", panel);
    const track = $(".rep-track", panel);

    if (bar) bar.style.width = `${value}%`;
    if (percentNode) percentNode.textContent = `${Math.round(value)}%`;
    if (titleNode && title) titleNode.textContent = title;
    if (textNode && text) textNode.textContent = text;
    if (phaseNode && phaseLabel) phaseNode.innerHTML = `<i></i>${phaseLabel}`;
    if (Number.isFinite(Number(count))) {
      lastCount = Number(count);
      if (countNode) countNode.textContent = `${lastCount.toLocaleString("pt-BR")} ${lastCount === 1 ? "empresa encontrada" : "empresas encontradas"}`;
    }
    if (track) track.setAttribute("aria-valuenow", String(Math.round(value)));

    panel.classList.remove("is-idle", "is-running", "is-done", "is-error");
    panel.classList.add(state || (value >= 100 ? "is-done" : value > 0 ? "is-running" : "is-idle"));
  }

  function resetProgress() {
    phase = "discovery";
    lastCount = 0;
    render({
      percent: 3,
      title: "Preparando a busca...",
      text: "Organizando região, nicho e meta de cobertura.",
      phaseLabel: "Descoberta",
      count: 0,
      state: "is-running"
    });
  }

  function handleBatch(message) {
    const current = Number(message.current || 0);
    const total = Number(message.total || 0);
    const accumulated = Number(message.accumulated ?? message.usefulCount ?? lastCount);

    if (["coverage_start", "searching", "pass_done"].includes(message.stage)) {
      phase = "discovery";
      let fraction = total > 0 ? current / total : 0.08;
      if (message.stage === "coverage_start") fraction = 0.02;
      const percent = 5 + Math.min(1, fraction) * 63;
      render({
        percent,
        title: "Descobrindo empresas...",
        text: message.text || (total ? `Varredura ${current} de ${total}.` : "Percorrendo o Google Maps."),
        phaseLabel: total ? `Descoberta · ${current}/${total} varreduras` : "Descoberta",
        count: Number.isFinite(accumulated) ? accumulated : lastCount,
        state: "is-running"
      });
      return;
    }

    if (message.stage === "done") {
      phase = "enrich";
      render({
        percent: 70,
        title: "Empresas encontradas",
        text: message.text || "A descoberta terminou. Agora o Radar vai completar os dados das empresas.",
        phaseLabel: "Completando dados",
        count: Number.isFinite(accumulated) ? accumulated : lastCount,
        state: "is-running"
      });
    }
  }

  function handleSearch(message) {
    if (message.stage !== "done") return;
    const accumulated = Number(message.accumulated ?? lastCount);
    const current = Number(message.pass || 0);
    const total = Number(message.totalPasses || 0);
    const fraction = total > 0 ? current / total : 0.35;
    render({
      percent: 7 + Math.min(1, fraction) * 60,
      title: "Descobrindo empresas...",
      text: message.text || `${accumulated || lastCount} negócios acumulados até agora.`,
      phaseLabel: total ? `Descoberta · ${current}/${total}` : "Descoberta",
      count: Number.isFinite(accumulated) ? accumulated : lastCount,
      state: "is-running"
    });
  }

  function handleEnrich(message) {
    phase = "enrich";
    const current = Number(message.current || 0);
    const total = Math.max(1, Number(message.total || 1));
    const percent = 70 + Math.min(1, current / total) * 30;
    render({
      percent,
      title: current >= total ? "Mapeamento concluído" : "Completando contatos...",
      text: current >= total
        ? "Empresas mapeadas e dados disponíveis atualizados."
        : `Telefone, site e horário: ${current} de ${total} fichas processadas.`,
      phaseLabel: current >= total ? "Concluído" : `Dados · ${current}/${total}`,
      count: lastCount,
      state: current >= total ? "is-done" : "is-running"
    });
  }

  function watchLegacyStatus() {
    const node = $("#mapsCollectorState");
    if (!node || node.dataset.repWatching === "1") return;
    node.dataset.repWatching = "1";

    const sync = () => {
      const value = String(node.innerText || "");
      if (/mapeamento conclu[ií]do/i.test(value)) {
        render({ percent: 100, title: "Mapeamento concluído", text: value.replace(/mapeamento conclu[ií]do/i, "").trim() || "Extração finalizada.", phaseLabel: "Concluído", count: lastCount, state: "is-done" });
      } else if (/interrompida|falha|erro/i.test(value)) {
        render({ percent: Math.max(4, Number($("#repPercent")?.textContent?.replace("%", "") || 4)), title: "Coleta parcial", text: value.trim(), phaseLabel: "Atenção", count: lastCount, state: "is-error" });
      }
    };
    new MutationObserver(sync).observe(node, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  chrome.runtime.onMessage.addListener(message => {
    if (!message?.event) return;
    if (message.event === "BATCH_PROGRESS") handleBatch(message);
    else if (message.event === "SEARCH_PROGRESS") handleSearch(message);
    else if (message.event === "ENRICH_PROGRESS") handleEnrich(message);
  });

  document.addEventListener("click", event => {
    if (!event.target.closest?.("#mapsOpenGoogleButton, #v4BatchSearch")) return;
    resetProgress();
  }, true);

  const observer = new MutationObserver(() => {
    forceAutoEnrich();
    ensurePanel();
    watchLegacyStatus();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      forceAutoEnrich();
      ensurePanel();
      watchLegacyStatus();
    }, { once: true });
  } else {
    forceAutoEnrich();
    ensurePanel();
    watchLegacyStatus();
  }
})();
