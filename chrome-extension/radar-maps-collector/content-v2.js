(() => {
  "use strict";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  function parseCoords(url) {
    const raw = String(url || "");
    let match = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    match = raw.match(/!3d(-?\d+(?:\.\d+)?).*?!4d(-?\d+(?:\.\d+)?)/);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
    return { lat: null, lng: null };
  }

  function parseRatingFromCard(cardText) {
    const match = String(cardText || "").match(/\b([1-5](?:[.,]\d)?)\b/);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function parseReviewsFromCard(cardText) {
    const match = String(cardText || "").match(/\(([\d.,]+)\)/);
    if (!match) return null;
    const n = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function closestCard(link) {
    return link.closest("div.Nv2PK") || link.closest('[role="article"]') || link.parentElement?.parentElement?.parentElement || link.parentElement;
  }

  function extractCategoryAndAddress(card) {
    const lines = String(card?.innerText || "").split(/\n+/).map(v => v.trim()).filter(Boolean);
    let category = "";
    let address = "";
    for (const line of lines) {
      if (!line.includes("·")) continue;
      const parts = line.split("·").map(v => v.trim()).filter(Boolean);
      if (!parts.length) continue;
      if (!category) category = parts[0];
      if (!address && parts.length > 1) address = parts.slice(1).join(" · ");
      if (category || address) break;
    }
    if (!address) {
      address = lines.find(line => /\b(R\.|Rua|Av\.|Avenida|Rod\.|Rodovia|Estrada|Travessa|Alameda|Praça|Praca)\b/i.test(line)) || "";
    }
    return { category, address };
  }

  function currentFeed() {
    return document.querySelector('[role="feed"]');
  }

  async function waitForFeed(timeoutMs = 12000) {
    const started = Date.now();
    let feed = currentFeed();
    while (!feed && Date.now() - started < timeoutMs) {
      await sleep(450);
      feed = currentFeed();
    }
    return feed;
  }

  function scanFeed(feed = currentFeed()) {
    const scope = feed || document;
    const links = [...scope.querySelectorAll('a[href*="/maps/place/"]')];
    const seen = new Set();
    const leads = [];

    links.forEach(link => {
      const href = link.href || "";
      if (!href || seen.has(href)) return;
      seen.add(href);
      const card = closestCard(link);
      const name = (link.getAttribute("aria-label") || text(link)).trim();
      if (!name) return;
      const cardText = String(card?.innerText || "").trim();
      const coords = parseCoords(href);
      const ratingNode = card?.querySelector('span[role="img"][aria-label*="estrela" i],span[role="img"][aria-label*="star" i],span.MW4etd');
      const ratingLabel = ratingNode?.getAttribute("aria-label") || text(ratingNode);
      const rating = parseRatingFromCard(ratingLabel || cardText);
      const reviews = parseReviewsFromCard(cardText);
      const meta = extractCategoryAndAddress(card);

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
        mapsUrl: href,
        rawText: cardText,
        collectedAt: new Date().toISOString()
      });
    });
    return leads;
  }

  function mapsReachedEnd(feed) {
    const hay = String(feed?.innerText || document.body?.innerText || "").toLowerCase();
    return [
      "você chegou ao final da lista",
      "voce chegou ao final da lista",
      "you've reached the end of the list",
      "you have reached the end of the list"
    ].some(marker => hay.includes(marker));
  }

  function scrollCandidates(feed) {
    const rows = [];
    let node = feed;
    for (let i = 0; node && i < 6; i += 1, node = node.parentElement) rows.push(node);
    if (feed) rows.push(...feed.querySelectorAll("div"));
    return [...new Set(rows)].filter(Boolean);
  }

  function findScroller(feed) {
    const candidates = scrollCandidates(feed).map(node => {
      const style = getComputedStyle(node);
      const overflow = `${style.overflowY || ""} ${style.overflow || ""}`;
      const range = Number(node.scrollHeight || 0) - Number(node.clientHeight || 0);
      const score = range + (/auto|scroll/i.test(overflow) ? 10000 : 0) + (node === feed ? 500 : 0);
      return { node, range, score };
    }).filter(item => item.range > 120);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.node || feed || document.scrollingElement || document.documentElement;
  }

  function collectInto(map, feed) {
    scanFeed(feed).forEach(lead => map.set(lead.mapsUrl || `${lead.name}|${lead.address}`, lead));
  }

  function forceLastResultIntoView(feed) {
    const links = feed ? [...feed.querySelectorAll('a[href*="/maps/place/"]')] : [];
    const last = links[links.length - 1];
    try { last?.scrollIntoView({ block: "end", behavior: "auto" }); } catch {}
  }

  async function scanAndScroll(maxScrolls = 90) {
    const feed = await waitForFeed();
    if (!feed) return scanFeed(null);

    const scroller = findScroller(feed);
    const all = new Map();
    const rounds = Math.max(35, Math.min(Number(maxScrolls) || 90, 120));
    let stableNoNew = 0;
    let noMovement = 0;
    let endSeenRounds = 0;
    let lastHeight = Number(scroller.scrollHeight || 0);
    let lastTop = Number(scroller.scrollTop || 0);

    collectInto(all, feed);

    for (let i = 0; i < rounds; i += 1) {
      const beforeCount = all.size;
      const beforeTop = Number(scroller.scrollTop || 0);
      const beforeHeight = Number(scroller.scrollHeight || 0);
      const viewport = Math.max(650, Number(scroller.clientHeight || feed.clientHeight || 700));
      const step = Math.max(850, Math.round(viewport * (i % 4 === 0 ? 1.75 : 1.15)));
      const maxTop = Math.max(0, beforeHeight - viewport);
      const target = Math.min(maxTop, beforeTop + step);

      try { scroller.scrollTo({ top: target, behavior: "auto" }); }
      catch { scroller.scrollTop = target; }
      forceLastResultIntoView(feed);
      await sleep(1350 + Math.round(Math.random() * 850));

      collectInto(all, feed);
      const afterTop = Number(scroller.scrollTop || 0);
      const afterHeight = Number(scroller.scrollHeight || 0);
      const grew = all.size > beforeCount;
      const moved = Math.abs(afterTop - beforeTop) > 5 || afterHeight > beforeHeight + 5 || afterTop > lastTop + 5 || afterHeight > lastHeight + 5;

      stableNoNew = grew ? 0 : stableNoNew + 1;
      noMovement = moved ? 0 : noMovement + 1;
      lastTop = afterTop;
      lastHeight = afterHeight;

      if (mapsReachedEnd(feed)) endSeenRounds += 1;
      else endSeenRounds = 0;

      if (!grew && (i + 1) % 5 === 0) {
        const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
        try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
        catch { scroller.scrollTop = bottom; }
        forceLastResultIntoView(feed);
        await sleep(1750 + Math.round(Math.random() * 800));
        collectInto(all, feed);
      }

      if (endSeenRounds >= 2 && stableNoNew >= 3) break;
      if (noMovement >= 9 && stableNoNew >= 12) break;
    }

    for (let probe = 0; probe < 3; probe += 1) {
      const bottom = Math.max(0, Number(scroller.scrollHeight || 0) - Number(scroller.clientHeight || 0));
      try { scroller.scrollTo({ top: bottom, behavior: "auto" }); }
      catch { scroller.scrollTop = bottom; }
      forceLastResultIntoView(feed);
      await sleep(1450 + probe * 350);
      collectInto(all, feed);
    }

    return [...all.values()];
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
      const itemId = el.getAttribute("data-item-id") || "";
      const href = el.getAttribute("href") || "";
      const aria = el.getAttribute("aria-label") || "";
      const value = text(el) || aria || href || itemId;
      const phone = digits(value.replace(/^phone:tel:/i, "").replace(/^tel:/i, ""));
      if (phone.length >= 10) return phone;
    }
    const body = String(document.body?.innerText || "");
    const match = body.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
    return match ? digits(match[0]) : "";
  }

  function extractDetail() {
    const name = detailValue(["h1.DUwDvf", "h1"]);
    const address = detailValue([
      'button[data-item-id="address"] .Io6YTe', 'button[data-item-id="address"]',
      'button[aria-label*="endereço" i]', 'button[aria-label*="address" i]'
    ]);
    const phone = extractPhone();
    const websiteEl = document.querySelector('a[data-item-id="authority"],a[aria-label*="site" i],a[aria-label*="website" i],a[data-tooltip*="site" i]');
    const website = websiteEl?.href || "";
    const category = detailValue(['button[jsaction*="category"]','.DkEaL']);
    const ratingLabel = detailValue(['div.F7nice span[aria-hidden="true"]','span[role="img"][aria-label*="estrela" i]','span[role="img"][aria-label*="star" i]']);
    const rating = parseRatingFromCard(ratingLabel);
    const bodyText = String(document.body?.innerText || "");
    let reviews = null;
    const reviewMatch = bodyText.match(/([\d.,]+)\s+(?:avalia[cç][õo]es|reviews)/i);
    if (reviewMatch) {
      const n = Number(reviewMatch[1].replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n)) reviews = Math.round(n);
    }
    const hours = detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]','button[aria-label*="horário" i]','button[aria-label*="hours" i]']);
    const mapsUrl = location.href;
    const coords = parseCoords(mapsUrl);
    return { name, address, phone, website, category, rating, reviews, hours, lat: coords.lat, lng: coords.lng, mapsUrl, detailedAt: new Date().toISOString() };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "SCAN_VISIBLE") {
      sendResponse({ ok: true, leads: scanFeed() });
      return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanAndScroll(Number(message.maxScrolls) || 90)
        .then(leads => sendResponse({ ok: true, leads }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok: true, lead: extractDetail() }), 650);
      return true;
    }
  });
})();
