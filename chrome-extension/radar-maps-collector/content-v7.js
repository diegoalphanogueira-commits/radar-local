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
      name, category, address,
      rating: parseRating(ratingNode?.getAttribute("aria-label") || text(ratingNode) || raw),
      reviews: parseReviews(raw),
      phone: "", website: "", hours: "",
      lat: coords.lat, lng: coords.lng, coordSource: coords.coordSource,
      mapsUrl: href, rawText: raw, collectedAt: new Date().toISOString()
    };
  }

  function collect(map, scope = document) {
    for (const link of links(scope)) {
      const lead = toLead(link);
      if (!lead) continue;
      const key = String(lead.mapsUrl || "").split("?")[0] || `${lead.name}|${lead.address}`;
      map.set(key, { ...(map.get(key) || {}), ...lead });
    }
  }

  async function waitFeed(timeout = 12000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const feed = document.querySelector('[role="feed"]');
      if (feed) return feed;
      await sleep(300);
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
      "fim da lista",
      "you've reached the end of the list",
      "you have reached the end of the list",
      "end of the list"
    ].some(value => hay.includes(value));
  }

  function loadingVisible(feed) {
    const candidates = [
      ...feed.querySelectorAll('[role="progressbar"]'),
      ...feed.querySelectorAll('[aria-label*="carregando" i],[aria-label*="loading" i]'),
      ...document.querySelectorAll('[role="progressbar"]')
    ];
    return candidates.some(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function profile(mode) {
    // Todos os modos tentam esgotar a lista. A opção de cobertura só altera o teto de segurança.
    if (mode === "30") return { hardMs: 240000, minMs: 35000, idleMs: 30000, waitMin: 850, waitMax: 1300, maxRounds: 360 };
    if (mode === "50") return { hardMs: 360000, minMs: 45000, idleMs: 38000, waitMin: 900, waitMax: 1400, maxRounds: 480 };
    if (mode === "100") return { hardMs: 480000, minMs: 55000, idleMs: 45000, waitMin: 950, waitMax: 1500, maxRounds: 620 };
    return { hardMs: 600000, minMs: 65000, idleMs: 55000, waitMin: 1000, waitMax: 1600, maxRounds: 760 };
  }

  async function report(sessionId, all, round, p, started, lastGrowthAt, endSeen, state = "scanning") {
    if (!sessionId) return;
    const elapsedMs = Date.now() - started;
    const idleMs = Date.now() - lastGrowthAt;
    // Descoberta ocupa 5–68%. Não pula para 70 até o scanner realmente terminar.
    const timeRatio = Math.min(1, elapsedMs / Math.max(1, p.hardMs));
    const percent = Math.min(68, 5 + Math.round(timeRatio * 55));
    try {
      await chrome.runtime.sendMessage({
        cmd: "SCAN_FEED_PROGRESS",
        sessionId,
        unique: all.size,
        round,
        rounds: p.maxRounds,
        elapsedMs,
        idleMs,
        endDetected: endSeen,
        state,
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
      await report(sessionId, all, 0, p, started, started, false, "no-feed");
      return { leads: [...all.values()], metrics: { unique: all.size, feedFound: false, rounds: 0, stopReason: "no-feed" } };
    }

    const scroller = scrollerFor(feed);
    const observer = new MutationObserver(() => collect(all, feed));
    observer.observe(feed, { childList: true, subtree: true });

    let executed = 0;
    let stopReason = "round-limit";
    let lastGrowthAt = Date.now();
    let lastUnique = 0;
    let lastHeight = Number(scroller.scrollHeight || 0);
    let bottomAttempts = 0;
    let explicitEndConfirmations = 0;

    try {
      collect(all, feed);
      lastUnique = all.size;
      await report(sessionId, all, 0, p, started, lastGrowthAt, endDetected(feed));

      for (let i = 0; i < p.maxRounds; i += 1) {
        const now = Date.now();
        if (now - started >= p.hardMs) { stopReason = "safety-time-limit"; break; }
        executed = i + 1;

        const beforeUnique = all.size;
        const beforeHeight = Number(scroller.scrollHeight || 0);
        const viewport = Math.max(500, Number(scroller.clientHeight || feed.clientHeight || 650));
        const maxTop = Math.max(0, beforeHeight - viewport);
        const currentTop = Number(scroller.scrollTop || 0);
        const nearBottom = maxTop - currentTop <= Math.max(180, viewport * 0.2);

        // Avança progressivamente para permitir que o Maps virtualize/carregue lotes intermediários.
        const step = nearBottom ? viewport * 0.9 : viewport * 1.35;
        const nextTop = Math.min(maxTop, currentTop + Math.max(650, Math.round(step)));
        try { scroller.scrollTo({ top: nextTop, behavior: "auto" }); }
        catch { scroller.scrollTop = nextTop; }
        try { links(feed).at(-1)?.scrollIntoView({ block: "end", behavior: "auto" }); } catch {}

        await sleep(p.waitMin + Math.round(Math.random() * (p.waitMax - p.waitMin)));

        // Se o Google está exibindo carregamento, dê tempo para ele terminar antes de julgar estabilidade.
        if (loadingVisible(feed)) {
          const loadingStart = Date.now();
          while (loadingVisible(feed) && Date.now() - loadingStart < 9000 && Date.now() - started < p.hardMs) {
            await sleep(650);
            collect(all, feed);
          }
        }

        collect(all, feed);
        const afterHeight = Number(scroller.scrollHeight || 0);
        const grew = all.size > beforeUnique || afterHeight > beforeHeight + 60;
        if (grew) {
          lastGrowthAt = Date.now();
          bottomAttempts = 0;
          explicitEndConfirmations = 0;
        }

        const atBottom = Math.max(0, afterHeight - Number(scroller.clientHeight || 0)) - Number(scroller.scrollTop || 0) <= 160;
        const ended = endDetected(feed);
        if (ended && atBottom) explicitEndConfirmations += 1;
        else if (!ended) explicitEndConfirmations = 0;

        if (grew || executed % 2 === 0 || ended) {
          await report(sessionId, all, executed, p, started, lastGrowthAt, ended);
        }

        // Fim explícito do Google: confirme algumas vezes para garantir que o MutationObserver capturou o último lote.
        if (ended && explicitEndConfirmations >= 3 && Date.now() - started >= p.minMs) {
          await sleep(1800);
          collect(all, feed);
          if (endDetected(feed)) { stopReason = "google-end-confirmed"; break; }
        }

        if (atBottom && !grew) {
          bottomAttempts += 1;

          // Repetidamente "acorda" a lista: sobe um pouco, volta ao fim e aguarda novo lote.
          if (bottomAttempts % 3 === 0) {
            const wakeTop = Math.max(0, Number(scroller.scrollTop || 0) - viewport * (0.55 + Math.min(0.8, bottomAttempts * 0.03)));
            try { scroller.scrollTo({ top: wakeTop, behavior: "auto" }); } catch { scroller.scrollTop = wakeTop; }
            await sleep(700);
            collect(all, feed);
            const newBottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
            try { scroller.scrollTo({ top: newBottom, behavior: "auto" }); } catch { scroller.scrollTop = newBottom; }
            await sleep(1200);
            collect(all, feed);
            if (all.size > beforeUnique || Number(scroller.scrollHeight || 0) > afterHeight + 60) {
              lastGrowthAt = Date.now();
              bottomAttempts = 0;
            }
          }
        } else if (!atBottom) {
          bottomAttempts = 0;
        }

        // Fallback quando o Google não exibe o texto de fim: só encerra após ficar MUITO tempo no fundo,
        // sem spinner, sem novos cards e após várias tentativas de despertar a lista.
        const idleFor = Date.now() - lastGrowthAt;
        if (
          Date.now() - started >= p.minMs &&
          atBottom &&
          !loadingVisible(feed) &&
          bottomAttempts >= 8 &&
          idleFor >= p.idleMs
        ) {
          // última confirmação longa antes de liberar o enriquecimento
          const snapshot = all.size;
          for (let probe = 0; probe < 3; probe += 1) {
            const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
            try { scroller.scrollTo({ top: bottom, behavior: "auto" }); } catch { scroller.scrollTop = bottom; }
            await sleep(1800);
            collect(all, feed);
          }
          if (all.size === snapshot && !loadingVisible(feed)) {
            stopReason = "long-idle-at-bottom-confirmed";
            break;
          }
          lastGrowthAt = Date.now();
          bottomAttempts = 0;
        }

        lastUnique = all.size;
        lastHeight = afterHeight;
      }

      // Captura final: segura a aba alguns segundos no fundo antes de devolver os dados.
      for (let i = 0; i < 4 && Date.now() - started < p.hardMs; i += 1) {
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); } catch { scroller.scrollTop = bottom; }
        await sleep(1000 + i * 250);
        collect(all, feed);
        await report(sessionId, all, executed + i + 1, p, started, lastGrowthAt, endDetected(feed), "final-probe");
      }
    } finally {
      observer.disconnect();
    }

    return {
      leads: [...all.values()],
      metrics: {
        unique: all.size,
        feedFound: true,
        rounds: executed,
        stopReason,
        endDetected: endDetected(feed),
        elapsedMs: Date.now() - started,
        idleMs: Date.now() - lastGrowthAt,
        bottomAttempts,
        scrollHeight: Number(scroller.scrollHeight || lastHeight),
        lastUnique
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
      sendResponse({ ok: true, leads: [...all.values()] });
      return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanScroll(message).then(result => sendResponse({ ok: true, ...result })).catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok: true, lead: detail() }), 400);
      return true;
    }
  });
})();
