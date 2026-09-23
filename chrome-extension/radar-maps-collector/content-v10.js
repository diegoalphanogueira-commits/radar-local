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

  function parseRating(value) {
    const match = String(value || "").match(/\b([1-5](?:[.,]\d)?)\b/);
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  function parseReviews(value) {
    const raw = String(value || "");
    let match = raw.match(/\(([\d.,]+)\)/);
    if (!match) match = raw.match(/([\d.,]+)\s+(?:avalia[cç][õo]es|reviews)/i);
    if (!match) return null;
    const n = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function parsePhone(raw) {
    const matches = String(raw || "").match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g) || [];
    for (const match of matches) {
      let value = digits(match);
      if (value.length > 11 && value.startsWith("55")) value = value.slice(2);
      if (value.length === 10 || value.length === 11) return value;
    }
    return "";
  }

  function closestCard(link) {
    return link.closest("div.Nv2PK") || link.closest('[role="article"]') || link.parentElement?.parentElement?.parentElement || link.parentElement;
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
      if (category && address) break;
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
      const name = String(link.getAttribute("aria-label") || text(link)).trim();
      if (!name) return;
      const cardText = String(card?.innerText || "").trim();
      const coords = placeCoords(href);
      const ratingNode = card?.querySelector('span[role="img"][aria-label*="estrela" i],span[role="img"][aria-label*="star" i],span.MW4etd');
      const meta = extractCategoryAndAddress(card);
      leads.push({
        name,
        category: meta.category,
        address: meta.address,
        rating: parseRating(ratingNode?.getAttribute("aria-label") || text(ratingNode) || cardText),
        reviews: parseReviews(cardText),
        phone: parsePhone(cardText),
        website: websiteFromCard(card),
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

  function mergeInto(map, leads) {
    for (const lead of leads) {
      const key = String(lead.mapsUrl || "").split("?")[0] || `${lead.name}|${lead.address}`;
      const previous = map.get(key) || {};
      const merged = { ...previous };
      Object.entries(lead).forEach(([field, value]) => {
        if (value !== "" && value !== null && value !== undefined) merged[field] = value;
      });
      map.set(key, merged);
    }
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

  async function report(sessionId, all, round, rounds, endSeen) {
    if (!sessionId) return;
    const percent = Math.min(68, 5 + Math.round(Math.min(1, round / Math.max(1, rounds)) * 58));
    try {
      await chrome.runtime.sendMessage({
        cmd: "SCAN_FEED_PROGRESS",
        sessionId,
        unique: all.size,
        round,
        rounds,
        endDetected: endSeen,
        percent
      });
    } catch {}
  }

  function roundsForMode(mode) {
    if (mode === "30") return 75;
    if (mode === "50") return 100;
    if (mode === "100") return 130;
    return 160;
  }

  async function scanAndScroll(mode = "50", sessionId = "") {
    let feed = document.querySelector('[role="feed"]');
    const waitStarted = Date.now();
    while (!feed && Date.now() - waitStarted < 15000) {
      await sleep(300);
      feed = document.querySelector('[role="feed"]');
    }
    if (!feed) {
      const leads = scanFeed();
      const all = new Map();
      mergeInto(all, leads);
      await report(sessionId, all, 0, 1, false);
      return { leads: [...all.values()], metrics: { feedFound: false, unique: all.size, stopReason: "no-feed" } };
    }

    // Esta é a lógica comprovada dos RC6/RC7: o próprio feed do Maps é rolado.
    const all = new Map();
    let previousCount = 0;
    let stableRounds = 0;
    let endSeenRounds = 0;
    let stopReason = "round-limit";
    const rounds = roundsForMode(mode);

    for (let i = 0; i < rounds; i += 1) {
      mergeInto(all, scanFeed());
      const countBefore = all.size;

      const step = Math.max(900, Math.round(Number(feed.clientHeight || 650) * (i % 3 === 0 ? 1.8 : 1.25)));
      feed.scrollBy({ top: step, behavior: "auto" });
      await sleep(1050 + Math.round(Math.random() * 650));

      mergeInto(all, scanFeed());
      const count = all.size;
      const grew = count > Math.max(previousCount, countBefore);
      stableRounds = grew ? 0 : stableRounds + 1;
      previousCount = count;

      if (mapsReachedEnd(feed)) endSeenRounds += 1;
      else endSeenRounds = 0;

      await report(sessionId, all, i + 1, rounds, mapsReachedEnd(feed));

      // Mantém o mecanismo que funcionava antes para provocar novo lote quando o Maps aparenta travar.
      if (stableRounds > 0 && stableRounds % 4 === 0) {
        feed.scrollBy({ top: -Math.max(320, Math.round(Number(feed.clientHeight || 650) * 0.35)), behavior: "auto" });
        await sleep(450);
        feed.scrollTop = feed.scrollHeight;
        await sleep(1450 + Math.round(Math.random() * 700));
        mergeInto(all, scanFeed());
      }

      if (endSeenRounds >= 2 && stableRounds >= 4) {
        stopReason = "google-end";
        break;
      }

      // Fallback de segurança: bem mais conservador que o atual para não encerrar cedo.
      if (stableRounds >= 20) {
        feed.scrollTop = feed.scrollHeight;
        await sleep(1800);
        const beforeFinal = all.size;
        mergeInto(all, scanFeed());
        if (all.size === beforeFinal && !mapsReachedEnd(feed)) {
          stopReason = "stable-feed";
          break;
        }
        stableRounds = 0;
      }
    }

    feed.scrollTop = feed.scrollHeight;
    await sleep(1400);
    mergeInto(all, scanFeed());
    await report(sessionId, all, rounds, rounds, mapsReachedEnd(feed));

    return {
      leads: [...all.values()],
      metrics: {
        feedFound: true,
        unique: all.size,
        stopReason,
        endDetected: mapsReachedEnd(feed),
        scrollTop: Number(feed.scrollTop || 0),
        scrollHeight: Number(feed.scrollHeight || 0)
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
    const mapsUrl = location.href;
    const coords = placeCoords(mapsUrl);
    const websiteEl = document.querySelector('a[data-item-id="authority"],a[aria-label*="site" i],a[aria-label*="website" i],a[data-tooltip*="site" i]');
    return {
      name: detailValue(["h1.DUwDvf", "h1"]),
      address: detailValue(['button[data-item-id="address"] .Io6YTe','button[data-item-id="address"]','button[aria-label*="endereço" i]','button[aria-label*="address" i]']),
      phone: extractPhone(),
      website: websiteEl?.href || "",
      category: detailValue(['button[jsaction*="category"]','.DkEaL']),
      rating: parseRating(detailValue(['div.F7nice span[aria-hidden="true"]','span[role="img"][aria-label*="estrela" i]','span[role="img"][aria-label*="star" i]'])),
      reviews: parseReviews(String(document.body?.innerText || "")),
      hours: detailValue(['div[aria-label*="horário" i]','div[aria-label*="hours" i]','button[data-item-id*="oh"]','button[aria-label*="horário" i]','button[aria-label*="hours" i]']),
      lat: coords.lat,
      lng: coords.lng,
      coordSource: coords.coordSource,
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
      scanAndScroll(String(message.mode || "50"), String(message.sessionId || ""))
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
