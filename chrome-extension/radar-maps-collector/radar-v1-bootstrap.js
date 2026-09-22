(() => {
  "use strict";

  if (!/\/prospeccao(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  const origin = window.location.origin;
  const version = "20260922-v1rc1";

  if (!document.getElementById("radarV1CoverageCss")) {
    const link = document.createElement("link");
    link.id = "radarV1CoverageCss";
    link.rel = "stylesheet";
    link.href = `${origin}/css/radar-v1-coverage.css?v=${version}`;
    (document.head || document.documentElement).appendChild(link);
  }

  if (!document.getElementById("radarV1CoverageScript")) {
    const script = document.createElement("script");
    script.id = "radarV1CoverageScript";
    script.src = `${origin}/js/radar-v1-coverage.js?v=${version}`;
    script.defer = true;
    (document.head || document.documentElement).appendChild(script);
  }
})();
