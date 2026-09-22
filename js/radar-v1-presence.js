/* Radar Local V1 — presença pública a partir do site oficial */
(() => {
  "use strict";

  if (window.RadarV1Presence) return;
  window.RadarV1Presence = true;

  const SOURCE = "RADAR_LOCAL_WEB";
  const TARGET = "RADAR_MAPS_COLLECTOR";
  const LEADS_KEY = "radarMapsImportedLeadsV2";
  const MAX_AUTO_SCANS = 18;
  const SCAN_TTL = 30 * 24 * 60 * 60 * 1000;
  const THIRD_PARTY = /(instagram\.com|facebook\.com|linkedin\.com|linktr\.ee|trinks\.com|beacons\.ai|bio\.site|wa\.me|whatsapp\.com)/i;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = value => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  let autoScans = 0;
  const pending = new Map();
  const inFlight = new Set();
  const observed = new WeakSet();

  function loadLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function saveLeads(leads) {
    try { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); }
    catch {}
  }

  function leadKey(lead) {
    return String(lead?.cnpj || lead?.mapsUrl || `${lead?.name || ""}|${lead?.address || ""}`).toLowerCase();
  }

  function getCardLead(card) {
    const name = $("h3", card)?.textContent?.trim() || "";
    const address = $(".v4-card-head p", card)?.textContent?.trim() || "";
    const leads = loadLeads();
    return leads.find(lead => normalize(lead.name) === normalize(name) && normalize(lead.address) === normalize(address))
      || leads.find(lead => normalize(lead.name) === normalize(name))
      || null;
  }

  function websiteFor(lead) {
    const raw = String(lead?.website || lead?.publicWebsite || "").trim();
    if (!raw || THIRD_PARTY.test(raw)) return "";
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).href;
    } catch { return ""; }
  }

  function whatsappPhone(url) {
    try {
      const u = new URL(url);
      const fromQuery = String(u.searchParams.get("phone") || "").replace(/\D/g, "");
      if (fromQuery.length >= 10) return fromQuery;
      const fromPath = u.pathname.replace(/\D/g, "");
      return fromPath.length >= 10 ? fromPath : "";
    } catch { return ""; }
  }

  function mergeLead(target, data) {
    const leads = loadLeads();
    const key = leadKey(target);
    const index = leads.findIndex(lead => leadKey(lead) === key);
    if (index < 0) return;

    const publicPhone = String(data?.phone || whatsappPhone(data?.whatsapp || "") || "").replace(/\D/g, "");
    const patch = {
      siteEnrichedAt: data?.scannedAt || new Date().toISOString(),
      sitePresenceSource: data?.sourceWebsite || websiteFor(target),
      sitePagesScanned: Array.isArray(data?.pagesScanned) ? data.pagesScanned : [],
      siteSameAs: Array.isArray(data?.sameAs) ? data.sameAs : []
    };
    if (data?.instagram) patch.instagram = data.instagram;
    if (data?.facebook) patch.facebook = data.facebook;
    if (data?.linkedin) patch.linkedin = data.linkedin;
    if (data?.tiktok) patch.tiktok = data.tiktok;
    if (data?.email) patch.publicEmail = data.email;
    if (publicPhone) patch.publicPhone = publicPhone;
    if (data?.whatsapp) patch.publicWhatsapp = data.whatsapp;
    if (data?.sourceWebsite) patch.publicWebsite = data.sourceWebsite;

    leads[index] = { ...leads[index], ...patch };
    saveLeads(leads);
  }

  function freshEnough(lead) {
    const time = Date.parse(lead?.siteEnrichedAt || "");
    return Number.isFinite(time) && Date.now() - time < SCAN_TTL;
  }

  function requestScan(lead, force = false) {
    const website = websiteFor(lead);
    const key = leadKey(lead);
    if (!website || inFlight.has(key) || (!force && freshEnough(lead))) return Promise.resolve(null);

    const requestId = `presence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    inFlight.add(key);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        inFlight.delete(key);
        resolve(null);
      }, 60000);
      pending.set(requestId, { lead, key, resolve, timer });
      window.postMessage({ source: SOURCE, type: "SITE_ENRICH", requestId, website, force }, window.location.origin);
    });
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== TARGET || message.type !== "SITE_ENRICH_RESULT") return;
    const job = pending.get(message.requestId);
    if (!job) return;
    clearTimeout(job.timer);
    pending.delete(message.requestId);
    inFlight.delete(job.key);
    if (message.response?.ok && message.response?.data) mergeLead(job.lead, message.response.data);
    job.resolve(message.response?.data || null);
  });

  function decoratePresence(card) {
    const lead = getCardLead(card);
    const panel = $("[data-li-panel]", card);
    if (!lead || !panel) return;

    const actions = $(".li-actions", panel);
    if (lead.facebook && actions && !$("[data-v1-facebook]", actions)) {
      const a = document.createElement("a");
      a.dataset.v1Facebook = "1";
      a.className = "found";
      a.href = lead.facebook;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Facebook encontrado";
      actions.insertBefore(a, actions.querySelector("button"));
    }

    const details = $(".li-details", panel);
    if (lead.siteEnrichedAt && details && !$("[data-v1-site-source]", details)) {
      const span = document.createElement("span");
      span.className = "li-badge";
      span.dataset.v1SiteSource = "1";
      span.textContent = "Site oficial analisado";
      details.prepend(span);
    }
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      observer.unobserve(card);
      const lead = getCardLead(card);
      if (!lead || !websiteFor(lead) || freshEnough(lead) || autoScans >= MAX_AUTO_SCANS) return;
      autoScans++;
      requestScan(lead, false);
    });
  }, { rootMargin: "500px 0px" });

  function observeCards() {
    $$(".v4-lead-card").forEach(card => {
      decoratePresence(card);
      if (!observed.has(card)) {
        observed.add(card);
        observer.observe(card);
      }
    });
  }

  document.addEventListener("click", event => {
    const refresh = event.target.closest("[data-li-refresh]");
    if (!refresh) return;
    const card = refresh.closest(".v4-lead-card");
    const lead = card ? getCardLead(card) : null;
    if (lead && websiteFor(lead)) setTimeout(() => requestScan(lead, true), 80);
  }, true);

  function boot() {
    const mutation = new MutationObserver(() => observeCards());
    mutation.observe(document.documentElement, { childList: true, subtree: true });
    observeCards();
    setInterval(observeCards, 2200);
    console.info("[Radar Local] Presença pública pelo site oficial ativa.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
