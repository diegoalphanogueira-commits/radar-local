/* Radar Local V1 — enriquecimento público pelo site oficial */
(() => {
  "use strict";

  const CACHE_KEY = "radarSiteEnrichmentCacheV1";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const MAX_CONTACT_PAGES = 2;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function normalizedUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (!/^https?:$/.test(url.protocol)) return "";
      url.hash = "";
      return url.href;
    } catch { return ""; }
  }

  function cacheKey(url) {
    try { return new URL(url).origin.toLowerCase(); }
    catch { return String(url || "").toLowerCase(); }
  }

  async function loadCache() {
    const data = await chrome.storage.local.get(CACHE_KEY);
    return data[CACHE_KEY] && typeof data[CACHE_KEY] === "object" ? data[CACHE_KEY] : {};
  }

  async function getCached(url) {
    const cache = await loadCache();
    const item = cache[cacheKey(url)];
    if (!item || Date.now() - Number(item.savedAt || 0) > CACHE_TTL) return null;
    return item.data || null;
  }

  async function putCached(url, data) {
    const cache = await loadCache();
    cache[cacheKey(url)] = { savedAt: Date.now(), data };
    const entries = Object.entries(cache)
      .filter(([, item]) => item && Date.now() - Number(item.savedAt || 0) <= CACHE_TTL)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, 250);
    await chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
  }

  async function waitForTab(tabId, timeoutMs = 14000) {
    try {
      const current = await chrome.tabs.get(tabId);
      if (current.status === "complete") return;
    } catch {}
    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      };
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") finish();
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(finish, timeoutMs);
    });
    await sleep(650);
  }

  async function scanTab(tabId) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const out = {
          instagram: "", facebook: "", linkedin: "", tiktok: "",
          email: "", phone: "", whatsapp: "", sameAs: [],
          candidatePages: [], title: document.title || "", url: location.href
        };
        const urls = new Set();
        const emails = new Set();
        const phones = new Set();
        const sameAs = new Set();
        const candidatePages = new Set();
        const baseOrigin = location.origin;

        const abs = raw => {
          try { return new URL(String(raw || "").trim(), location.href).href; }
          catch { return ""; }
        };
        const cleanPhone = raw => String(raw || "").replace(/\D/g, "");
        const addUrl = raw => {
          const url = abs(raw);
          if (url) urls.add(url);
        };
        const walkJson = value => {
          if (!value) return;
          if (Array.isArray(value)) return value.forEach(walkJson);
          if (typeof value !== "object") return;
          const sa = value.sameAs;
          if (Array.isArray(sa)) sa.forEach(item => { const u = abs(item); if (u) sameAs.add(u); });
          else if (typeof sa === "string") { const u = abs(sa); if (u) sameAs.add(u); }
          if (typeof value.email === "string") emails.add(value.email.replace(/^mailto:/i, "").trim());
          if (typeof value.telephone === "string") phones.add(cleanPhone(value.telephone));
          Object.values(value).forEach(walkJson);
        };

        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
          try { walkJson(JSON.parse(script.textContent || "null")); } catch {}
        });

        document.querySelectorAll("a[href]").forEach(a => {
          const href = a.href || "";
          addUrl(href);
          if (/^mailto:/i.test(a.getAttribute("href") || "")) emails.add((a.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0]);
          if (/^tel:/i.test(a.getAttribute("href") || "")) phones.add(cleanPhone((a.getAttribute("href") || "").replace(/^tel:/i, "")));
          try {
            const u = new URL(href, location.href);
            const hay = `${u.pathname} ${a.textContent || ""}`.toLowerCase();
            if (u.origin === baseOrigin && /(contato|contact|fale-conosco|fale conosco|sobre|about|quem-somos|quem somos|equipe|team)/i.test(hay)) {
              u.hash = "";
              candidatePages.add(u.href);
            }
          } catch {}
        });

        sameAs.forEach(addUrl);

        const bodyText = (document.body?.innerText || "").slice(0, 180000);
        const mailMatches = bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
        mailMatches.slice(0, 8).forEach(v => emails.add(v));

        for (const url of urls) {
          const low = url.toLowerCase();
          if (!out.instagram && /instagram\.com\//.test(low)) out.instagram = url;
          if (!out.facebook && /facebook\.com\//.test(low)) out.facebook = url;
          if (!out.linkedin && /linkedin\.com\//.test(low)) out.linkedin = url;
          if (!out.tiktok && /tiktok\.com\//.test(low)) out.tiktok = url;
          if (!out.whatsapp && /(wa\.me\/|api\.whatsapp\.com\/send|whatsapp\.com\/send)/.test(low)) out.whatsapp = url;
        }

        out.email = [...emails].find(v => v && !/example\.(com|org)|sentry|wixpress|cloudflare/i.test(v)) || "";
        out.phone = [...phones].find(v => v.length >= 10 && v.length <= 13) || "";
        out.sameAs = [...sameAs].slice(0, 15);
        out.candidatePages = [...candidatePages].filter(v => v !== location.href).slice(0, 5);
        return out;
      }
    });
    return results?.[0]?.result || null;
  }

  function mergeResult(base, extra) {
    const out = { ...(base || {}) };
    ["instagram", "facebook", "linkedin", "tiktok", "email", "phone", "whatsapp"].forEach(key => {
      if (!out[key] && extra?.[key]) out[key] = extra[key];
    });
    if (!out.title && extra?.title) out.title = extra.title;
    out.sameAs = [...new Set([...(out.sameAs || []), ...(extra?.sameAs || [])])].slice(0, 20);
    out.candidatePages = [...new Set([...(out.candidatePages || []), ...(extra?.candidatePages || [])])].slice(0, 8);
    out.pagesScanned = [...new Set([...(out.pagesScanned || []), extra?.url].filter(Boolean))];
    return out;
  }

  async function scanWebsite(rawUrl, force = false) {
    const website = normalizedUrl(rawUrl);
    if (!website) throw new Error("SITE_INVALIDO");
    if (!force) {
      const cached = await getCached(website);
      if (cached) return { ...cached, cacheHit: true };
    }

    let tab = null;
    try {
      tab = await chrome.tabs.create({ url: website, active: false });
      await waitForTab(tab.id);
      let result = await scanTab(tab.id);
      if (!result) throw new Error("SITE_SEM_RESPOSTA");
      result = mergeResult({ sourceWebsite: website, pagesScanned: [] }, result);

      const homeOrigin = new URL(website).origin;
      const pages = (result.candidatePages || [])
        .filter(url => { try { return new URL(url).origin === homeOrigin; } catch { return false; } })
        .slice(0, MAX_CONTACT_PAGES);

      for (const page of pages) {
        try {
          await chrome.tabs.update(tab.id, { url: page });
          await waitForTab(tab.id, 10000);
          const extra = await scanTab(tab.id);
          result = mergeResult(result, extra);
        } catch {}
      }

      delete result.candidatePages;
      result.scannedAt = new Date().toISOString();
      await putCached(website, result);
      return { ...result, cacheHit: false };
    } finally {
      if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {});
    }
  }

  let active = 0;
  const queue = [];
  const MAX_CONCURRENT = 2;
  function enqueue(job) {
    return new Promise((resolve, reject) => {
      queue.push({ job, resolve, reject });
      pump();
    });
  }
  function pump() {
    while (active < MAX_CONCURRENT && queue.length) {
      const item = queue.shift();
      active++;
      Promise.resolve().then(item.job).then(item.resolve, item.reject).finally(() => { active--; pump(); });
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd !== "SITE_ENRICH_ONE") return;
    enqueue(() => scanWebsite(message.website, !!message.force))
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({ ok: false, error: error?.message || "Falha ao analisar site" }));
    return true;
  });
})();
