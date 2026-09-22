(() => {
  "use strict";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => String(el?.textContent || "").replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  function placeCoords(url) {
    const raw = String(url || "");
    let match = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]), coordSource: "place" };
    match = raw.match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]), coordSource: "query" };
    return { lat: null, lng: null, coordSource: "unknown" };
  }

  function detailCoords(url) {
    const precise = placeCoords(url);
    if (precise.lat !== null) return precise;
    const match = String(url || "").match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]), coordSource: "detail-camera" };
    return precise;
  }

  function parseRating(value) {
    const match = String(value || "").match(/\b([1-5](?:[.,]\d)?)\b/);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function parseReviews(value) {
    const raw = String(value || "");
    let match = raw.match(/\(([\d.,]+)\)/);
    if (!match) match = raw.match(/([\d.,]+)\s+(?:avalia[cç][õo]es|reviews)/i);
    if (!match) return null;
    const number = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function closestCard(link) {
    return link.closest("div.Nv2PK")
      || link.closest('[role="article"]')
      || link.closest("div[jsaction]")
      || link.parentElement?.parentElement?.parentElement
      || link.parentElement;
  }

  function extractName(link, card) {
    return String(
      link.getAttribute("aria-label")
      || card?.querySelector(".qBF1Pd")?.textContent
      || card?.querySelector(".fontHeadlineSmall")?.textContent
      || text(link)
      || ""
    ).trim();
  }

  function extractCategoryAddress(card) {
    const lines = String(card?.innerText || "").split(/\n+/).map(v => v.trim()).filter(Boolean);
    let category = "";
    let address = "";

    for (const line of lines) {
      if (!line.includes("·")) continue;
      const parts = line.split("·").map(v => v.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!category) category = parts[0];
      if (!address && parts.length > 1) address = parts.slice(1).join(" · ");
      if (category && address) break;
    }

    if (!address) {
      address = lines.find(line => /\b(R\.|Rua|Av\.|Avenida|Rod\.|Rodovia|Estrada|Travessa|Alameda|Praça|Praca)\b/i.test(line)) || "";
    }
    return { category, address };
  }

  function resultLinks(scope = document) {
    const selectors = [
      'a.hfpxzc[href*="/maps/place/"]',
      'a[href*="/maps/place/"][aria-label]',
      '[role="feed"] a[href*="/maps/place/"]'
    ];
    const rows = [];
    selectors.forEach(selector => rows.push(...scope.querySelectorAll(selector)));
    return [...new Set(rows)].filter(link => !!link?.href);
  }

  function scan(scope = document) {
    const seen = new Set();
    const leads = [];

    resultLinks(scope).forEach(link => {
      const href = String(link.href || "");
      if (!href || seen.has(href)) return;
      seen.add(href);
      const card = closestCard(link);
      const name = extractName(link, card);
      if (!name) return;
      const cardText = String(card?.innerText || "").trim();
      const meta = extractCategoryAddress(card);
      const coords = placeCoords(href);
      const ratingNode = card?.querySelector('span[role="img"][aria-label*="estrela" i],span[role="img"][aria-label*="star" i],span.MW4etd');
      const rating = parseRating(ratingNode?.getAttribute("aria-label") || text(ratingNode) || cardText);
      const reviews = parseReviews(cardText);

      leads.push({
        name,
        category: meta.category,
        address: meta.address,
        rating,
        reviews,
        phone: "",
        website: "",
        hours: "",
        lat: coords.lat,
        lng: coords.lng,
        coordSource: coords.coordSource,
        mapsUrl: href,
        rawText: cardText,
        collectedAt: new Date().toISOString()
      });
    });

    return leads;
  }

  function feedNode() {
    return document.querySelector('[role="feed"]');
  }

  async function waitForFeed(timeoutMs = 15000) {
    const started = Date.now();
    let feed = feedNode();
    while (!feed && Date.now() - started < timeoutMs) {
      await sleep(400);
      feed = feedNode();
    }
    return feed;
  }

  function findScroller(feed) {
    if (!feed) return document.scrollingElement || document.documentElement;
    const candidates = [];
    let node = feed;
    for (let i = 0; node && i < 8; i += 1, node = node.parentElement) {
      const style = getComputedStyle(node);
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      const scrollable = /auto|scroll/i.test(`${style.overflowY || ""} ${style.overflow || ""}`);
      if (range > 100) candidates.push({ node, range, scrollable, depth: i });
    }
    candidates.sort((a, b) => {
      if (a.scrollable !== b.scrollable) return a.scrollable ? -1 : 1;
      if (a.depth !== b.depth) return a.depth - b.depth;
      return b.range - a.range;
    });
    return candidates[0]?.node || feed;
  }

  function reachedEnd(feed) {
    const hay = String(feed?.innerText || document.body?.innerText || "").toLowerCase();
    return [
      "você chegou ao final da lista",
      "voce chegou ao final da lista",
      "you've reached the end of the list",
      "you have reached the end of the list"
    ].some(marker => hay.includes(marker));
  }

  function addScanned(target, scope) {
    scan(scope).forEach(lead => {
      const key = lead.mapsUrl || `${lead.name}|${lead.address}`;
      const previous = target.get(key) || {};
      target.set(key, { ...previous, ...lead });
    });
  }

  function nudgeScroller(scroller, feed) {
    const links = resultLinks(feed || document);
    const last = links[links.length - 1];
    try { last?.scrollIntoView({ block: "end", behavior: "auto" }); } catch {}
    try {
      scroller.dispatchEvent(new WheelEvent("wheel", { deltaY: 1200, bubbles: true, cancelable: true }));
    } catch {}
  }

  async function scanAndScroll(maxScrolls = 110) {
    const feed = await waitForFeed();
    if (!feed) {
      const leads = scan(document);
      return { leads, metrics: { unique: leads.length, rounds: 0, feedFound: false } };
    }

    const scroller = findScroller(feed);
    const all = new Map();
    const rounds = Math.max(45, Math.min(Number(maxScrolls) || 110, 160));
    let stableRounds = 0;
    let motionlessRounds = 0;
    let endRounds = 0;
    let executed = 0;

    const observer = new MutationObserver(() => addScanned(all, feed));
    observer.observe(feed, { childList: true, subtree: true });

    try {
      addScanned(all, feed);

      for (let i = 0; i < rounds; i += 1) {
        executed = i + 1;
        const beforeCount = all.size;
        const beforeTop = Number(scroller.scrollTop || 0);
        const beforeHeight = Number(scroller.scrollHeight || 0);
        const viewport = Math.max(600, Number(scroller.clientHeight || feed.clientHeight || 700));
        const step = Math.max(900, Math.round(viewport * (i % 4 === 0 ? 1.7 : 1.15)));
        const maxTop = Math.max(0, beforeHeight - viewport);
        const targetTop = Math.min(maxTop, beforeTop + step);

        try { scroller.scrollTo({ top: targetTop, behavior: "auto" }); }
        catch { scroller.scrollTop = targetTop; }
        nudgeScroller(scroller, feed);
        await sleep(1200 + Math.round(Math.random() * 700));
        addScanned(all, feed);

        const afterTop = Number(scroller.scrollTop || 0);
        const afterHeight = Number(scroller.scrollHeight || 0);
        const grew = all.size > beforeCount;
        const moved = Math.abs(afterTop - beforeTop) > 4 || afterHeight > beforeHeight + 4;

        stableRounds = grew ? 0 : stableRounds + 1;
        motionlessRounds = moved ? 0 : motionlessRounds + 1;
        endRounds = reachedEnd(feed) ? endRounds + 1 : 0;

        if (!grew && (i + 1) % 4 === 0) {
          const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
          try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
          catch { scroller.scrollTop = bottom; }
          nudgeScroller(scroller, feed);
          await sleep(1500 + Math.round(Math.random() * 700));
          addScanned(all, feed);
        }

        if (endRounds >= 2 && stableRounds >= 5) break;
        if (stableRounds >= 16 && motionlessRounds >= 8) break;
      }

      for (let probe = 0; probe < 4; probe += 1) {
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
        catch { scroller.scrollTop = bottom; }
        nudgeScroller(scroller, feed);
        await sleep(1250 + probe * 250);
        addScanned(all, feed);
      }
    } finally {
      observer.disconnect();
    }

    return {
      leads: [...all.values()],
      metrics: {
        unique: all.size,
        rounds: executed,
        feedFound: true,
        endDetected: reachedEnd(feed),
        scrollTop: Number(scroller.scrollTop || 0),
        scrollHeight: Number(scroller.scrollHeight || 0)
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

  function extractPhone() {
    const selectors = [
      'button[data-item-id^="phone:tel:"]',
      'a[href^="tel:"]',
      'button[aria-label*="telefone" i]',
      'button[aria-label*="phone" i]',
      'button[aria-label*="ligar" i]',
      '[data-tooltip*="telefone" i]',
      '[data-tooltip*="phone" i]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const raw = text(el) || el.getAttribute("aria-label") || el.getAttribute("href") || el.getAttribute("data-item-id") || "";
      const phone = digits(raw.replace(/^phone:tel:/i, "").replace(/^tel:/i, ""));
      if (phone.length >= 10) return phone;
    }
    const match = String(document.body?.innerText || "").match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
    return match ? digits(match[0]) : "";
  }

  function extractDetail() {
    const name = detailValue(["h1.DUwDvf", "h1"]);
    const address = detailValue([
      'button[data-item-id="address"] .Io6YTe',
      'button[data-item-id="address"]',
      'button[aria-label*="endereço" i]',
      'button[aria-label*="address" i]'
    ]);
    const phone = extractPhone();
    const websiteEl = document.querySelector('a[data-item-id="authority"],a[aria-label*="site" i],a[aria-label*="website" i],a[data-tooltip*="site" i]');
    const website = websiteEl?.href || "";
    const category = detailValue(['button[jsaction*="category"]', '.DkEaL']);
    const rating = parseRating(detailValue(['div.F7nice span[aria-hidden="true"]','span[role="img"][aria-label*="estrela" i]','span[role="img"][aria-label*="star" i]']));
    const reviews = parseReviews(String(document.body?.innerText || ""));
    const hours = detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]','button[aria-label*="horário" i]','button[aria-label*="hours" i]']);
    const mapsUrl = location.href;
    const coords = detailCoords(mapsUrl);

    return {
      name,
      address,
      phone,
      website,
      category,
      rating,
      reviews,
      hours,
      lat: coords.lat,
      lng: coords.lng,
      coordSource: coords.coordSource,
      mapsUrl,
      detailedAt: new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "SCAN_VISIBLE") {
      sendResponse({ ok: true, leads: scan(document) });
      return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanAndScroll(Number(message.maxScrolls) || 110)
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok: true, lead: extractDetail() }), 650);
      return true;
    }
  });
})();
