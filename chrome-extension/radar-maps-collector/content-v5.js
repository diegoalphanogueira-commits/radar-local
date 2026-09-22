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
      const key = lead.mapsUrl || `${lead.name}|${lead.address}`;
      map.set(key, { ...(map.get(key) || {}), ...lead });
    }
  }

  async function waitFeed(timeout = 7000) {
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
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
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
    return ["você chegou ao final da lista","voce chegou ao final da lista","you've reached the end of the list","you have reached the end of the list"].some(v => hay.includes(v));
  }

  function profile(mode) {
    if (mode === "30") return { rounds: 15, stable: 4, hardMs: 22000, waitA: 380, waitB: 620, probes: 1 };
    if (mode === "50") return { rounds: 22, stable: 5, hardMs: 32000, waitA: 420, waitB: 680, probes: 1 };
    if (mode === "100") return { rounds: 30, stable: 6, hardMs: 44000, waitA: 480, waitB: 760, probes: 2 };
    return { rounds: 38, stable: 8, hardMs: 56000, waitA: 520, waitB: 820, probes: 2 };
  }

  async function scanScroll(message = {}) {
    const mode = ["30","50","100","max"].includes(String(message.mode)) ? String(message.mode) : "50";
    const p = profile(mode);
    const feed = await waitFeed();
    const all = new Map();
    if (!feed) {
      collect(all, document);
      return { leads: [...all.values()], metrics: { unique: all.size, feedFound: false, rounds: 0, stopReason: "no-feed" } };
    }

    const scroller = scrollerFor(feed);
    const observer = new MutationObserver(() => collect(all, feed));
    observer.observe(feed, { childList: true, subtree: true });
    const started = Date.now();
    let stable = 0, executed = 0, stopReason = "round-limit";

    try {
      collect(all, feed);
      for (let i = 0; i < p.rounds; i += 1) {
        if (Date.now() - started >= p.hardMs) { stopReason = "time-limit"; break; }
        executed = i + 1;
        const before = all.size;
        const viewport = Math.max(550, Number(scroller.clientHeight || feed.clientHeight || 650));
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - viewport);
        const current = Number(scroller.scrollTop || 0);
        const next = Math.min(bottom, current + Math.max(900, Math.round(viewport * 1.45)));
        try { scroller.scrollTo({ top: next, behavior: "auto" }); } catch { scroller.scrollTop = next; }
        try { links(feed).at(-1)?.scrollIntoView({ block: "end", behavior: "auto" }); } catch {}
        await sleep(p.waitA + Math.round(Math.random() * (p.waitB - p.waitA)));
        collect(all, feed);
        stable = all.size > before ? 0 : stable + 1;
        if (ended(feed) && stable >= 2) { stopReason = "end-detected"; break; }
        if (stable >= p.stable) { stopReason = "stable"; break; }
      }
      for (let i = 0; i < p.probes && Date.now() - started < p.hardMs; i += 1) {
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); } catch { scroller.scrollTop = bottom; }
        await sleep(500 + i * 140);
        collect(all, feed);
      }
    } finally {
      observer.disconnect();
    }

    return { leads: [...all.values()], metrics: { unique: all.size, feedFound: true, rounds: executed, stopReason, endDetected: ended(feed), elapsedMs: Date.now() - started } };
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
      phone: phone(), website: websiteEl?.href || "",
      category: detailValue(['button[jsaction*="category"]','.DkEaL']),
      rating: parseRating(detailValue(['div.F7nice span[aria-hidden="true"]','span[role="img"][aria-label*="estrela" i]','span[role="img"][aria-label*="star" i]'])),
      reviews: parseReviews(String(document.body?.innerText || "")),
      hours: detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]']),
      lat: coords.lat, lng: coords.lng, coordSource: coords.coordSource, mapsUrl: location.href, detailedAt: new Date().toISOString()
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
