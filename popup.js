const $ = selector => document.querySelector(selector);

let activeTab = null;
let busy = false;

function setStatus(kind, title, text) {
  const dot = $("#statusDot");
  dot.className = `status-dot${kind ? ` ${kind}` : ""}`;
  $("#statusTitle").textContent = title;
  $("#statusText").textContent = text;
}

function setBusy(value) {
  busy = value;
  ["#scanVisible", "#scanScroll", "#enrichDetails", "#exportJson", "#exportCsv", "#clearData"]
    .forEach(selector => {
      const button = $(selector);
      if (button) button.disabled = value;
    });
}

function detailCount(leads) {
  return leads.filter(lead => lead.phone || lead.website || lead.hours).length;
}

function updateMetrics(leads = []) {
  $("#leadCount").textContent = leads.length.toLocaleString("pt-BR");
  $("#detailCount").textContent = detailCount(leads).toLocaleString("pt-BR");
}

async function getState() {
  const response = await chrome.runtime.sendMessage({ cmd: "GET_STATE" });
  const leads = response?.leads || [];
  updateMetrics(leads);
  return leads;
}

async function ensureMapsTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  const url = String(tab?.url || "");
  const ok = /^https:\/\/(www\.)?google\.(com|com\.br)\/maps\//i.test(url);
  if (ok) {
    setStatus("ready", "Google Maps pronto", "Você pode capturar os resultados desta busca.");
    return true;
  }
  setStatus("error", "Abra o Google Maps", "Faça uma busca no Maps e depois abra o coletor.");
  return false;
}

async function scan(cmd) {
  if (busy || !(await ensureMapsTab())) return;
  setBusy(true);
  setStatus("", "Coletando resultados...", cmd === "SCAN_SCROLL" ? "Rolando o feed para carregar mais empresas." : "Lendo os cards já carregados.");
  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, { cmd, maxScrolls: 40 });
    if (!response?.ok) throw new Error(response?.error || "Falha na coleta.");
    const stored = await chrome.runtime.sendMessage({ cmd: "STORE_LEADS", leads: response.leads || [] });
    updateMetrics(stored?.leads || []);
    setStatus("ready", "Coleta concluída", `${(response.leads || []).length} registros lidos nesta página.`);
  } catch (error) {
    console.error(error);
    setStatus("error", "Não consegui ler a página", "Atualize o Google Maps e tente novamente.");
  } finally {
    setBusy(false);
  }
}

async function enrich() {
  if (busy) return;
  const leads = await getState();
  if (!leads.length) {
    setStatus("error", "Nada para completar", "Capture os resultados do Maps primeiro.");
    return;
  }
  setBusy(true);
  setStatus("", "Completando fichas...", "O Chrome abrirá cada ficha em segundo plano para buscar telefone, site e horário.");
  try {
    const response = await chrome.runtime.sendMessage({ cmd: "ENRICH_ALL", limit: 80 });
    if (!response?.ok) throw new Error(response?.error || "Falha ao completar detalhes.");
    updateMetrics(response.leads || []);
    setStatus("ready", "Detalhes concluídos", `${detailCount(response.leads || [])} empresas possuem informações detalhadas.`);
  } catch (error) {
    console.error(error);
    setStatus("error", "A coleta de detalhes foi interrompida", "Você pode exportar o que já foi coletado e continuar depois.");
  } finally {
    setBusy(false);
  }
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.event !== "ENRICH_PROGRESS") return;
  setStatus("", "Completando fichas...", `${message.current} de ${message.total} empresas processadas.`);
});

$("#scanVisible").addEventListener("click", () => scan("SCAN_VISIBLE"));
$("#scanScroll").addEventListener("click", () => scan("SCAN_SCROLL"));
$("#enrichDetails").addEventListener("click", enrich);
$("#exportJson").addEventListener("click", async () => chrome.runtime.sendMessage({ cmd: "EXPORT_JSON" }));
$("#exportCsv").addEventListener("click", async () => chrome.runtime.sendMessage({ cmd: "EXPORT_CSV" }));
$("#clearData").addEventListener("click", async () => {
  if (!confirm("Limpar todos os negócios coletados pela extensão?")) return;
  await chrome.runtime.sendMessage({ cmd: "CLEAR" });
  updateMetrics([]);
  setStatus("ready", "Coleta limpa", "Faça uma nova busca no Google Maps.");
});

(async () => {
  await ensureMapsTab();
  await getState();
})();
