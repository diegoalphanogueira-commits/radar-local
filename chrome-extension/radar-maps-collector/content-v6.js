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
  async function waitFeed(timeout = 9000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
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
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      if (range <= 100) continue;
      const style = getComputedStyle(node);
      candidates.push({ node, depth, range, scrollable: /auto|scroll/i.test(`${style.overflowY || ""} ${style.overflow || ""}`) });
    }
    candidates.sort((a,b) => Number(b.scrollable) - Number(a.scrollable) || a.depth - b.depth || b.range - a.range);
    return candidates[0]?.node || feed;
  }
  function ended(feed) {
    const hay = String(feed?.innerText || "").toLowerCase();
    return [
      "você chegou ao final da lista",
      "voce chegou ao final da lista",
      "you've reached the end of the list",
      "you have reached the end of the list"
    ].some(value => hay.includes(value));
  }
  function profile(mode) {
    if (mode === "30") return { rounds: 90, stable: 12, hardMs: 90000, waitMin: 520, waitMax: 850 };
    if (mode === "50") return { rounds: 130, stable: 14, hardMs: 135000, waitMin: 560, waitMax: 900 };
    if (mode === "100") return { rounds: 190, stable: 16, hardMs: 210000, waitMin: 600, waitMax: 960 };
    return { rounds: 280, stable: 20, hardMs: 300000, waitMin: 620, waitMax: 1000 };
  }
  async function report(sessionId, all, round, p, started, stable, endDetected) {
    if (!sessionId) return;
    const elapsedMs = Date.now() - started;
    const percent = Math.min(68, 5 + Math.round((elapsedMs / Math.max(1, p.hardMs)) * 58));
    try {
      await chrome.runtime.sendMessage({
        cmd: "SCAN_FEED_PROGRESS",
        sessionId,
        unique: all.size,
        round,
        rounds: p.rounds,
        elapsedMs,
        stable,
        endDetected,
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
    if (!feed) {
      collect(all, document);
      await report(sessionId, all, 0, p, Date.now(), 0, false);
      return { leads: [...all.values()], metrics: { unique: all.size, feedFound: false, rounds: 0, stopReason: "no-feed" } };
    }

    const scroller = scrollerFor(feed);
    const observer = new MutationObserver(() => collect(all, feed));
    observer.observe(feed, { childList: true, subtree: true });
    const started = Date.now();
    let stable = 0, executed = 0, stopReason = "round-limit";
    let lastHeight = Number(scroller.scrollHeight || 0);
    let lastUnique = 0;

    try {
      collect(all, feed);
      await report(sessionId, all, 0, p, started, 0, ended(feed));

      for (let i = 0; i < p.rounds; i += 1) {
        if (Date.now() - started >= p.hardMs) { stopReason = "time-limit"; break; }
        executed = i + 1;
        const beforeUnique = all.size;
        const beforeHeight = Number(scroller.scrollHeight || 0);
        const bottom = Math.max(0, beforeHeight - Number(scroller.clientHeight || 0));

        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
        catch { scroller.scrollTop = bottom; }
        try { links(feed).at(-1)?.scrollIntoView({ block: "end", behavior: "auto" }); } catch {}

        await sleep(p.waitMin + Math.round(Math.random() * (p.waitMax - p.waitMin)));
        collect(all, feed);

        const afterHeight = Number(scroller.scrollHeight || 0);
        const grew = all.size > beforeUnique || afterHeight > beforeHeight + 80;
        stable = grew ? 0 : stable + 1;
        lastHeight = afterHeight;

        if (grew || executed % 3 === 0 || stable >= p.stable - 2) {
          await report(sessionId, all, executed, p, started, stable, ended(feed));
        }

        if (ended(feed) && stable >= 3) { stopReason = "end-detected"; break; }

        if (stable >= p.stable) {
          const nearBottom = Math.abs(Number(scroller.scrollTop || 0) + Number(scroller.clientHeight || 0) - Number(scroller.scrollHeight || 0)) < 180;
          if (nearBottom) { stopReason = "stable-at-bottom"; break; }
          stable = Math.max(2, Math.floor(stable / 2));
        }

        if (stable > 0 && stable % 5 === 0) {
          const viewport = Math.max(500, Number(scroller.clientHeight || 650));
          try { scroller.scrollTo({ top: Math.max(0, Number(scroller.scrollTop || 0) - viewport * .45), behavior: "auto" }); } catch {}
          await sleep(250);
          try { scroller.scrollTo({ top: Math.max(0, Number(scroller.scrollHeight || 0) - viewport), behavior: "auto" }); } catch {}
          await sleep(400);
          collect(all, feed);
        }

        lastUnique = all.size;
      }

      for (let i = 0; i < 3 && Date.now() - started < p.hardMs; i += 1) {
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); } catch { scroller.scrollTop = bottom; }
        await sleep(650 + i * 180);
        collect(all, feed);
        await report(sessionId, all, executed + i + 1, p, started, stable, ended(feed));
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
        endDetected: ended(feed),
        elapsedMs: Date.now() - started,
        scrollHeight: lastHeight,
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
      const all = new Map(); collect(all, document); sendResponse({ ok: true, leads: [...all.values()] }); return;
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
