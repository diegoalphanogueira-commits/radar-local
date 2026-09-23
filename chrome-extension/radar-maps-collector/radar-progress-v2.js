(() => {
  "use strict";
  const ID = "radarExtractionProgressV1";
  const PROGRESS_KEY = "radarExtractionProgressV2";
  let last = {};
  const $ = (selector, root=document) => root.querySelector(selector);

  function forceAutoEnrich() {
    const input = [...document.querySelectorAll('input[type="checkbox"]')].find(el => /completar\s+telefone|telefone,\s*site|hor[aá]rio\s+automaticamente/i.test(el.closest("label")?.innerText || ""));
    if (!input) return;
    input.checked = true;
    input.disabled = true;
    input.setAttribute("checked","checked");
    const label = input.closest("label");
    if (label) label.style.display = "none"; else input.style.display = "none";
  }
  function ensurePanel() {
    let panel = document.getElementById(ID);
    if (panel) return panel;
    const anchor = $("#mapsCollectorState") || $("#v4SearchControls") || $(".maps-search-row");
    if (!anchor) return null;
    panel = document.createElement("section");
    panel.id = ID;
    panel.className = "radar-extraction-progress is-idle";
    panel.innerHTML = `<div class="rep-head"><div class="rep-copy"><span class="rep-kicker">PROGRESSO DA EXTRAÇÃO</span><strong id="repTitle">Pronto para mapear</strong><span id="repText">O Radar mostrará o andamento em tempo real.</span></div><div class="rep-percent" id="repPercent">0%</div></div><div class="rep-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="rep-bar" id="repBar"></div></div><div class="rep-footer"><span id="repPhase"><i></i>Aguardando busca</span><span id="repCount">0 empresas extraídas</span></div>`;
    anchor.insertAdjacentElement("afterend", panel);
    return panel;
  }
  function render(p={}) {
    last = { ...last, ...p };
    const panel = ensurePanel(); if (!panel) return;
    const value = Math.max(0, Math.min(100, Number(last.percent || 0)));
    $("#repBar",panel).style.width = `${value}%`;
    $("#repPercent",panel).textContent = `${Math.round(value)}%`;
    const phase = String(last.phase || "idle");
    const accumulated = Number(last.accumulated || 0);
    const inside = Number(last.inRadius ?? last.inRadiusCount ?? 0);
    const current = Number(last.current || 0), total = Number(last.total || 0);
    const phones = Number(last.phoneCount || 0), sites = Number(last.siteCount || 0);
    let title = "Preparando a busca...", phaseLabel = "Descoberta", text = last.text || "Organizando a operação.";
    if (phase === "discovery") {
      title = "Descobrindo empresas...";
      phaseLabel = total ? `Descoberta · ${current}/${total} varreduras` : "Descoberta";
      text = last.text || `${accumulated} extraídas · ${inside} dentro do raio.`;
    } else if (phase === "discovery_done") {
      title = "Empresas encontradas";
      phaseLabel = "Completando dados";
      text = last.text || `${accumulated} extraídas · ${inside} dentro do raio.`;
    } else if (phase === "enrich") {
      title = "Completando contatos...";
      phaseLabel = total ? `Dados · ${current}/${total}` : "Dados";
      text = last.text || `${phones} telefones · ${sites} sites encontrados.`;
    } else if (phase === "done") {
      title = "Mapeamento concluído";
      phaseLabel = "Concluído";
      text = last.text || `${accumulated} negócios · ${phones} com telefone · ${sites} com site.`;
    }
    $("#repTitle",panel).textContent = title;
    $("#repText",panel).textContent = text;
    $("#repPhase",panel).innerHTML = `<i></i>${phaseLabel}`;
    $("#repCount",panel).textContent = `${accumulated.toLocaleString("pt-BR")} empresas extraídas${inside ? ` · ${inside.toLocaleString("pt-BR")} no raio` : ""}`;
    $(".rep-track",panel).setAttribute("aria-valuenow",String(Math.round(value)));
    panel.classList.remove("is-idle","is-running","is-done","is-error");
    panel.classList.add(last.state === "done" || phase === "done" ? "is-done" : last.state === "error" ? "is-error" : value > 0 ? "is-running" : "is-idle");
  }
  function reset() { last = {}; render({ phase:"discovery", state:"running", percent:3, current:0, total:0, accumulated:0, inRadius:0, text:"Preparando região, nicho e meta de cobertura." }); }
  async function poll() {
    try {
      const response = await chrome.runtime.sendMessage({cmd:"GET_STATE"});
      if (response?.progress) render(response.progress);
    } catch {}
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[PROGRESS_KEY]?.newValue) return;
    render(changes[PROGRESS_KEY].newValue);
  });
  document.addEventListener("click", event => {
    if (event.target.closest?.("#mapsOpenGoogleButton, #v4BatchSearch")) reset();
  }, true);
  const observer = new MutationObserver(() => { forceAutoEnrich(); ensurePanel(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",()=>{forceAutoEnrich();ensurePanel();poll();},{once:true}); else {forceAutoEnrich();ensurePanel();poll();}
  setInterval(poll, 700);
})();
