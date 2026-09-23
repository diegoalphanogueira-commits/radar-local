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
    for (const a of card.querySelectorAll('a[href^="http"]')) {
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

  async function waitFeed(timeout = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const feed = document.querySelector('[role="feed"]');
      if (feed && links(feed).length) return feed;
      await sleep(300);
    }
    return document.querySelector('[role="feed"]');
  }

  function candidateScrollers(feed) {
    const rows = [];
    const seen = new Set();
    const push = node => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      if (range > 80) rows.push(node);
    };
    push(feed);
    let node = feed?.parentElement;
    for (let i = 0; node && i < 10; i += 1, node = node.parentElement) push(node);
    document.querySelectorAll('.m6QEr,.DxyBCb,[role="main"] [style*="overflow"],[role="feed"]').forEach(push);
    return rows.sort((a,b) => (Number(b.scrollHeight||0)-Number(b.clientHeight||0)) - (Number(a.scrollHeight||0)-Number(a.clientHeight||0)));
  }

  async function findRealScroller(feed) {
    const candidates = candidateScrollers(feed);
    for (const node of candidates) {
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      if (range <= 80) continue;
      const before = Number(node.scrollTop || 0);
      const probe = Math.min(range, before + Math.min(320, Math.max(120, Number(node.clientHeight || 500) * .35)));
      try { node.scrollTop = probe; } catch {}
      await sleep(120);
      const after = Number(node.scrollTop || 0);
      if (after > before + 10) {
        try { node.scrollTop = 0; } catch {}
        await sleep(120);
        return node;
      }
      try { node.scrollTop = before; } catch {}
    }
    return feed || document.scrollingElement || document.documentElement;
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
    if (mode === "30") return { hardMs: 120000, idleCycles: 7, wait: 850 };
    if (mode === "50") return { hardMs: 180000, idleCycles: 8, wait: 900 };
    if (mode === "100") return { hardMs: 300000, idleCycles: 10, wait: 950 };
    return { hardMs: 420000, idleCycles: 12, wait: 1000 };
  }

  async function report(sessionId, all, cycle, elapsedMs, hardMs, endSeen, scrollTop = 0, scrollHeight = 0) {
    if (!sessionId) return;
    const percent = Math.min(68, 5 + Math.round(Math.min(1, elapsedMs / Math.max(1, hardMs)) * 58));
    try {
      await chrome.runtime.sendMessage({
        cmd: "SCAN_FEED_PROGRESS",
        sessionId,
        unique: all.size,
        round: cycle,
        rounds: 999,
        elapsedMs,
        endDetected: endSeen,
        scrollTop,
        scrollHeight,
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
      return { leads:[...all.values()], metrics:{ unique:all.size, feedFound:false, cycles:0, stopReason:"no-feed" } };
    }

    let scroller = await findRealScroller(feed);
    const observer = new MutationObserver(() => collect(all, feed));
    observer.observe(feed, { childList:true, subtree:true });

    let cycles = 0;
    let idleCycles = 0;
    let noMovementCycles = 0;
    let stopReason = "time-limit";
    let lastBottomKey = "";

    try {
      try { scroller.scrollTop = 0; } catch {}
      collect(all, feed);
      await report(sessionId, all, 0, 0, p.hardMs, endDetected(feed), Number(scroller.scrollTop||0), Number(scroller.scrollHeight||0));

      while (Date.now() - started < p.hardMs) {
        cycles += 1;
        const beforeCount = all.size;
        const beforeTop = Number(scroller.scrollTop || 0);
        const beforeHeight = Number(scroller.scrollHeight || 0);
        const viewport = Math.max(420, Number(scroller.clientHeight || feed.clientHeight || 650));
        const currentLinks = links(feed);
        const beforeLast = String(currentLinks.at(-1)?.href || "");

        const delta = Math.max(520, Math.round(viewport * .82));
        try {
          scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: delta, bubbles:true, cancelable:true }));
        } catch {}
        try { scroller.scrollBy({ top: delta, behavior:"smooth" }); }
        catch { scroller.scrollTop = Math.min(Number(scroller.scrollHeight||0), beforeTop + delta); }
        try { links(feed).at(-1)?.scrollIntoView({ block:"end", behavior:"smooth" }); } catch {}

        await sleep(p.wait);
        if (loadingVisible(feed)) {
          const loadingStarted = Date.now();
          while (loadingVisible(feed) && Date.now() - loadingStarted < 8000) {
            await sleep(450);
            collect(all, feed);
          }
        }

        collect(all, feed);
        const afterTop = Number(scroller.scrollTop || 0);
        const afterHeight = Number(scroller.scrollHeight || 0);
        const afterLinks = links(feed);
        const afterLast = String(afterLinks.at(-1)?.href || "");
        const moved = afterTop > beforeTop + 8;
        const changedLast = !!afterLast && afterLast !== beforeLast;
        const grew = all.size > beforeCount || afterHeight > beforeHeight + 40 || changedLast;

        if (moved || grew) noMovementCycles = 0;
        else noMovementCycles += 1;
        idleCycles = grew ? 0 : idleCycles + 1;

        // Se não houve movimento real, o elemento escolhido não é o painel correto: redetecta em vez de encerrar.
        if (noMovementCycles >= 2 && !endDetected(feed)) {
          const replacement = await findRealScroller(feed);
          if (replacement && replacement !== scroller) {
            scroller = replacement;
            noMovementCycles = 0;
            idleCycles = 0;
          }
        }

        const ended = endDetected(feed);
        const maxTop = Math.max(0, Number(scroller.scrollHeight||0) - Number(scroller.clientHeight||0));
        const atBottom = maxTop - Number(scroller.scrollTop||0) <= 120;
        await report(sessionId, all, cycles, Date.now()-started, p.hardMs, ended, Number(scroller.scrollTop||0), Number(scroller.scrollHeight||0));

        if (ended && atBottom) {
          await sleep(1400);
          collect(all, feed);
          if (endDetected(feed)) {
            stopReason = "google-end";
            break;
          }
        }

        // Fallback: só encerra depois de muitas tentativas no fundo, com último card idêntico e sem spinner.
        const bottomKey = String(links(feed).at(-1)?.href || "");
        if (atBottom && !loadingVisible(feed) && idleCycles >= p.idleCycles && bottomKey && bottomKey === lastBottomKey) {
          await sleep(1800);
          const snapshot = all.size;
          collect(all, feed);
          if (all.size === snapshot && String(links(feed).at(-1)?.href || "") === bottomKey) {
            stopReason = "stable-real-bottom";
            break;
          }
        }
        if (atBottom && bottomKey) lastBottomKey = bottomKey;
      }

      collect(all, feed);
      await report(sessionId, all, cycles+1, Date.now()-started, p.hardMs, endDetected(feed), Number(scroller.scrollTop||0), Number(scroller.scrollHeight||0));
    } finally {
      observer.disconnect();
    }

    return {
      leads:[...all.values()],
      metrics:{
        unique:all.size,
        feedFound:true,
        cycles,
        stopReason,
        endDetected:endDetected(feed),
        elapsedMs:Date.now()-started,
        scrollTop:Number(scroller.scrollTop||0),
        scrollHeight:Number(scroller.scrollHeight||0)
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
      lat:coords.lat,
      lng:coords.lng,
      coordSource:coords.coordSource,
      mapsUrl:location.href,
      detailedAt:new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "SCAN_VISIBLE") {
      const all = new Map(); collect(all, document); sendResponse({ ok:true, leads:[...all.values()] }); return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanScroll(message).then(result => sendResponse({ ok:true, ...result })).catch(error => sendResponse({ ok:false, error:error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok:true, lead:detail() }), 400);
      return true;
    }
  });
})();
