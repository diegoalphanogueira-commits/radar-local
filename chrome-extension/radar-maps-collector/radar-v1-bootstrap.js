(() => {
  "use strict";

  if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  const origin = window.location.origin;
  const version = "20260922-v1rc5";

  function injectCss(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    (document.head || document.documentElement).appendChild(link);
  }

  function injectJs(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.defer = true;
    (document.head || document.documentElement).appendChild(script);
  }

  injectCss("radarV1CoverageCss", `${origin}/css/radar-v1-coverage.css?v=${version}`);
  injectCss("radarV1MapCss", `${origin}/css/radar-v1-map.css?v=${version}`);
  injectJs("radarV1CoverageScript", `${origin}/js/radar-v1-coverage.js?v=${version}`);
  injectJs("radarV1MapScript", `${origin}/js/radar-v1-map.js?v=${version}`);
  injectJs("radarV1IntelligenceScript", `${origin}/js/radar-v1-intelligence.js?v=${version}`);
  injectJs("radarV1PresenceScript", `${origin}/js/radar-v1-presence.js?v=${version}`);
})();
