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

  function scanFeed() {
    const feed = document.querySelector('[role="feed"]');
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

  async function scanAndScroll(maxScrolls = 35) {
    const feed = document.querySelector('[role="feed"]');
    if (!feed) return scanFeed();
    let previousCount = 0;
    let stalls = 0;
    const all = new Map();

    for (let i = 0; i < maxScrolls; i += 1) {
      scanFeed().forEach(lead => all.set(lead.mapsUrl || lead.name, lead));
      feed.scrollTop = feed.scrollHeight;
      await sleep(850 + Math.round(Math.random() * 500));
      const count = all.size;
      if (count === previousCount) stalls += 1;
      else stalls = 0;
      previousCount = count;
      if (stalls >= 6) break;
    }
    scanFeed().forEach(lead => all.set(lead.mapsUrl || lead.name, lead));
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

  function extractDetail() {
    const name = detailValue(["h1.DUwDvf", "h1"]);
    const address = detailValue(['button[data-item-id="address"] .Io6YTe','button[data-item-id="address"]']);
    let phone = detailValue(['button[data-item-id^="phone:tel:"] .Io6YTe','button[data-item-id^="phone:tel:"]']);
    const phoneButton = document.querySelector('button[data-item-id^="phone:tel:"]');
    if (!phone && phoneButton) phone = phoneButton.getAttribute("data-item-id")?.replace(/^phone:tel:/, "") || "";
    const websiteEl = document.querySelector('a[data-item-id="authority"],a[aria-label*="site" i],a[aria-label*="website" i]');
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
    const hours = detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]']);
    const mapsUrl = location.href;
    const coords = parseCoords(mapsUrl);

    return {
      name,
      address,
      phone: digits(phone),
      website,
      category,
      rating,
      reviews,
      hours,
      lat: coords.lat,
      lng: coords.lng,
      mapsUrl,
      detailedAt: new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "SCAN_VISIBLE") {
      sendResponse({ ok: true, leads: scanFeed() });
      return;
    }
    if (message?.cmd === "SCAN_SCROLL") {
      scanAndScroll(Number(message.maxScrolls) || 35)
        .then(leads => sendResponse({ ok: true, leads }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.cmd === "EXTRACT_DETAIL") {
      setTimeout(() => sendResponse({ ok: true, lead: extractDetail() }), 450);
      return true;
    }
  });
})();
