(() => {
  "use strict";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => String(el?.textContent || "").replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  function placeCoords(url) {
    const raw = String(url || "");
    let m = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]), coordSource: "place" };
    m = raw.match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]), coordSource: "query" };
    return { lat: null, lng: null, coordSource: "unknown" };
  }

  function parseRating(value) {
    const m = String(value || "").match(/\b([1-5](?:[.,]\d)?)\b/);
    return m ? Number(m[1].replace(",", ".")) : null;
  }

  function parseReviews(value) {
    const raw = String(value || "");
    let m = raw.match(/\(([\d.,]+)\)/);
    if (!m) m = raw.match(/([\d.,]+)\s+(?:avalia[cç][õo]es|reviews)/i);
    if (!m) return null;
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function parsePhone(raw) {
    const source = String(raw || "");
    const matches = source.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s]?\d{4}/g) || [];
    for (const match of matches) {
      let value = digits(match);
      if (value.length > 11 && value.startsWith("55")) value = value.slice(2);
      if (value.length === 10 || value.length === 11) return value;
    }
    return "";
  }

  function links(scope = document) {
    const rows = [];
    [
      'a.hfpxzc[href*="/maps/place/"]',
      'a[href*="/maps/place/"][aria-label]',
      '[role="feed"] a[href*="/maps/place/"]'
    ].forEach(selector => rows.push(...scope.querySelectorAll(selector)));
    return [...new Set(rows)].filter(a => a?.href);
  }

  function cardOf(link) {
    return link.closest("div.Nv2PK") || link.closest('[role="article"]') || link.closest("div[jsaction]") || link.parentElement?.parentElement?.parentElement || link.parentElement;
  }

  function websiteFromCard(card) {
    if (!card) return "";
    const candidates = [
      ...card.querySelectorAll('a[href^="http"]')
    ];
    for (const a of candidates) {
      const href = String(a.href || "");
      if (!href || /google\./i.test(href) || /\/maps\//i.test(href)) continue;
      const label = `${a.getAttribute("aria-label") || ""} ${text(a)}`;
      if (/site|website|p[aá]gina|web/i.test(label)) return href;
    }
    return "";
  }

  function toLead(link) {
    const href = String(link.href || "");
    const card = cardOf(link);
    const name = String(link.getAttribute("aria-label") || card?.querySelector(".qBF1Pd")?.textContent || card?.querySelector(".fontHeadlineSmall")?.textContent || text(link) || "").trim();
    if (!name) return null;

    const raw = String(card?.innerText || "").trim();
    const lines = raw.split(/\n+/).map(v => v.trim()).filter(Boolean);
    let category = "", address = "";
    for (const line of lines) {
      if (!line.includes("·")) continue;
      const parts = line.split("·").map(v => v.trim()).filter(Boolean);
      if (!category && parts[0]) category = parts[0];
      if (!address && parts.length > 1) address = parts.slice(1).join(" · ");
      if (category && address) break;
    }
    if (!address) address = lines.find(line => /\b(R\.|Rua|Av\.|Avenida|Rod\.|Rodovia|Estrada|Travessa|Alameda|Praça|Praca)\b/i.test(line)) || "";

    const ratingNode = card?.querySelector('span[role="img"][aria-label*="estrela" i],span[role="img"][aria-label*="star" i],span.MW4etd');
    const coords = placeCoords(href);

    return {
      name,
      category,
      address,
      rating: parseRating(ratingNode?.getAttribute("aria-label") || text(ratingNode) || raw),
      reviews: parseReviews(raw),
      phone: parsePhone(raw),
      website: websiteFromCard(card),
      hours: "",
      lat: coords.lat,
      lng: coords.lng,
      coordSource: coords.coordSource,
      mapsUrl: href,
      rawText: raw,
      collectedAt: new Date().toISOString()
    };
  }

  function collect(map, scope = document) {
    for (const link of links(scope)) {
      const lead = toLead(link);
      if (!lead) continue;
      const key = String(lead.mapsUrl || "").split("?")[0] || `${lead.name}|${lead.address}`;
      const previous = map.get(key) || {};
      const merged = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      map.set(key, merged);
    }
  }

  async function waitFeed(timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const feed = document.querySelector('[role="feed"]');
      if (feed) return feed;
      await sleep(250);
    }
    return null;
  }

  function scrollerFor(feed) {
    if (!feed) return document.scrollingElement || document.documentElement;
    const candidates = [];
    let node = feed;
    for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      if (range <= 120) continue;
      const style = getComputedStyle(node);
      candidates.push({ node, depth, range, scrollable: /auto|scroll/i.test(`${style.overflowY || ""} ${style.overflow || ""}`) });
    }
    candidates.sort((a,b) => Number(b.scrollable) - Number(a.scrollable) || a.depth - b.depth || b.range - a.range);
    return candidates[0]?.node || feed;
  }

  function endDetected(feed) {
    const hay = String(feed?.innerText || "").toLowerCase();
    return [
      "você chegou ao final da lista",
      "voce chegou ao final da lista",
      "you've reached the end of the list",
      "you have reached the end of the list"
    ].some(value => hay.includes(value));
  }

  function loadingVisible(feed) {
    const candidates = [
      ...feed.querySelectorAll('[role="progressbar"]'),
      ...feed.querySelectorAll('[aria-label*="carregando" i],[aria-label*="loading" i]')
    ];
    return candidates.some(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function profile(mode) {
    if (mode === "30") return { hardMs: 90000, idleCycles: 5, wait: 650 };
    if (mode === "50") return { hardMs: 120000, idleCycles: 6, wait: 700 };
    if (mode === "100") return { hardMs: 180000, idleCycles: 7, wait: 750 };
    return { hardMs: 240000, idleCycles: 8, wait: 800 };
  }

  async function report(sessionId, all, cycle, elapsedMs, hardMs, endSeen) {
    if (!sessionId) return;
    const percent = Math.min(68, 5 + Math.round(Math.min(1, elapsedMs / Math.max(1, hardMs)) * 58));
    try {
      await chrome.runtime.sendMessage({
        cmd: "SCAN_FEED_PROGRESS",
        sessionId,
        unique: all.size,
        round: cycle,
        rounds: 100,
        elapsedMs,
        endDetected: endSeen,
        percent
      });
    } catch {}
  }

  async function scanScroll(message = {}) {
    const mode = ["30","50","100","max"].includes(String(message.mode)) ? String(message.mode) : "50";
    const sessionId = String(message.sessionId || "");
    const p = profile(mode);
    const feed = await waitFeed();
    const all = new Map();
    const started = Date.now();

    if (!feed) {
      collect(all, document);
      await report(sessionId, all, 0, 0, p.hardMs, false);
      return { leads: [...all.values()], metrics: { unique: all.size, feedFound: false, cycles: 0, stopReason: "no-feed" } };
    }

    const scroller = scrollerFor(feed);
    const observer = new MutationObserver(() => collect(all, feed));
    observer.observe(feed, { childList:true, subtree:true });

    let cycles = 0;
    let idleCycles = 0;
    let endConfirm = 0;
    let stopReason = "time-limit";

    try {
      collect(all, feed);
      await report(sessionId, all, 0, 0, p.hardMs, endDetected(feed));

      while (Date.now() - started < p.hardMs) {
        cycles += 1;
        const beforeCount = all.size;
        const beforeHeight = Number(scroller.scrollHeight || 0);
        const viewport = Math.max(500, Number(scroller.clientHeight || feed.clientHeight || 650));
        const bottom = Math.max(0, beforeHeight - viewport);

        // Regra simples: sempre para baixo. Sem voltar, sem reabrir busca, sem probes extras.
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
        catch { scroller.scrollTop = bottom; }
        try { links(feed).at(-1)?.scrollIntoView({ block:"end", behavior:"auto" }); } catch {}

        await sleep(p.wait);
        if (loadingVisible(feed)) {
          const loadingStarted = Date.now();
          while (loadingVisible(feed) && Date.now() - loadingStarted < 5000) {
            await sleep(350);
            collect(all, feed);
          }
        }

        collect(all, feed);
        const afterHeight = Number(scroller.scrollHeight || 0);
        const grew = all.size > beforeCount || afterHeight > beforeHeight + 40;
        idleCycles = grew ? 0 : idleCycles + 1;

        const ended = endDetected(feed);
        if (ended) endConfirm += 1;
        else endConfirm = 0;

        await report(sessionId, all, cycles, Date.now() - started, p.hardMs, ended);

        // Fim real do Google: duas leituras consecutivas já são suficientes.
        if (ended && endConfirm >= 2) {
          await sleep(900);
          collect(all, feed);
          stopReason = "google-end";
          break;
        }

        // Fallback quando o Google não escreve a mensagem de fim: algumas leituras seguidas
        // sem novos cards, já no fundo, sem spinner.
        const atBottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0)) - Number(scroller.scrollTop || 0) <= 140;
        if (atBottom && !loadingVisible(feed) && idleCycles >= p.idleCycles) {
          await sleep(1100);
          const snapshot = all.size;
          collect(all, feed);
          if (all.size === snapshot && !loadingVisible(feed)) {
            stopReason = "stable-bottom";
            break;
          }
          idleCycles = 0;
        }
      }

      // Uma única captura final, sem repetir ciclos artificiais.
      collect(all, feed);
      await report(sessionId, all, cycles + 1, Date.now() - started, p.hardMs, endDetected(feed));
    } finally {
      observer.disconnect();
    }

    return {
      leads: [...all.values()],
      metrics: {
        unique: all.size,
        feedFound: true,
        cycles,
        stopReason,
        endDetected: endDetected(feed),
        elapsedMs: Date.now() - started
      }
    };
  }

  function detailValue(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const value = text(el) || el.getAttribute("aria-label") || el.getAttribute("href") || "";
      if (value) return value.trim();
    }
    return "";
  }

  function phone() {
    for (const selector of ['button[data-item-id^="phone:tel:"]','a[href^="tel:"]','button[aria-label*="telefone" i]','button[aria-label*="phone" i]','button[aria-label*="ligar" i]']) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const raw = text(el) || el.getAttribute("aria-label") || el.getAttribute("href") || el.getAttribute("data-item-id") || "";
      const value = digits(raw.replace(/^phone:tel:/i, "").replace(/^tel:/i, ""));
      if (value.length >= 10) return value;
    }
    return "";
  }

  function detail() {
    const websiteEl = document.querySelector('a[data-item-id="authority"],a[aria-label*="site" i],a[aria-label*="website" i]');
    const coords = placeCoords(location.href);
    return {
      name: detailValue(["h1.DUwDvf","h1"]),
      address: detailValue(['button[data-item-id="address"] .Io6YTe','button[data-item-id="address"]','button[aria-label*="endereço" i]','button[aria-label*="address" i]']),
      phone: phone(),
      website: websiteEl?.href || "",
      category: detailValue(['button[jsaction*="category"]','.DkEaL']),
      rating: parseRating(detailValue(['div.F7nice span[aria-hidden="true"]','span[role="img"][aria-label*="estrela" i]','span[role="img"][aria-label*="star" i]'])),
      reviews: parseReviews(String(document.body?.innerText || "")),
      hours: detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]']),
      lat: coords.lat,
      lng: coords.lng,
      coordSource: coords.coordSource,
      mapsUrl: location.href,
      detailedAt: new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "SCAN_VISIBLE") {
      const all = new Map();
      collect(all, document);
      sendResponse({ ok:true, leads:[...all.values()] });
      return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanScroll(message).then(result => sendResponse({ ok:true, ...result })).catch(error => sendResponse({ ok:false, error:error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok:true, lead:detail() }), 350);
      return true;
    }
  });
})();
