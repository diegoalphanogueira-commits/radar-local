/* =========================================================
   RADAR LOCAL — ACESSO INTERNO
   Sessão temporária via API da Korax
========================================================= */

(() => {
  const API_BASE = "https://api.usekorax.com";
  const TOKEN_KEY = "radarAuthTokenV1";
  let expiryTimer = null;

  const getToken = () =>
    sessionStorage.getItem(TOKEN_KEY) || "";

  const clearToken = () =>
    sessionStorage.removeItem(TOKEN_KEY);

  const decodeJwtPayload = token => {
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;

      const normalized = payload
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const padded = normalized.padEnd(
        Math.ceil(normalized.length / 4) * 4,
        "="
      );

      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const isTokenValid = token => {
    const payload = decodeJwtPayload(token);

    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  };

  const injectStyles = () => {
    if (document.getElementById("radarAuthStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "radarAuthStyles";
    style.textContent = `
      body.radar-auth-locked {
        overflow: hidden;
      }

      .radar-auth-gate {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 50% 18%, rgba(40, 120, 240, 0.12), transparent 34%),
          #f4f7fc;
      }

      .radar-auth-gate[hidden] {
        display: none;
      }

      .radar-auth-card {
        width: min(100%, 430px);
        padding: 34px;
        border: 1px solid #e2e8f0;
        border-radius: 28px;
        background: #ffffff;
        box-shadow: 0 28px 80px rgba(38, 55, 79, 0.13);
        font-family: "Inter", sans-serif;
      }

      .radar-auth-brand {
        display: flex;
        align-items: center;
        gap: 13px;
        margin-bottom: 28px;
      }

      .radar-auth-mark {
        width: 44px;
        height: 44px;
        padding: 10px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        gap: 4px;
        border-radius: 14px;
        background: #f8fafd;
        box-shadow: 0 8px 24px rgba(38, 55, 79, 0.06);
      }

      .radar-auth-dot {
        border-radius: 50%;
      }

      .radar-auth-dot.blue { background: #2878f0; }
      .radar-auth-dot.red { background: #ea4335; }
      .radar-auth-dot.yellow { background: #f9ab00; }
      .radar-auth-dot.green { background: #34a853; }

      .radar-auth-brand-copy {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .radar-auth-brand-copy strong {
        color: #202124;
        font-size: 0.95rem;
        font-weight: 800;
      }

      .radar-auth-brand-copy span {
        margin-top: 4px;
        color: #7d8898;
        font-size: 0.72rem;
      }

      .radar-auth-kicker {
        display: inline-block;
        margin-bottom: 8px;
        color: #2878f0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .radar-auth-card h1 {
        margin: 0;
        color: #202124;
        font-size: clamp(1.65rem, 5vw, 2rem);
        line-height: 1.15;
      }

      .radar-auth-card p {
        margin: 12px 0 24px;
        color: #526071;
        font-size: 0.92rem;
        line-height: 1.6;
      }

      .radar-auth-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .radar-auth-field label {
        color: #202124;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .radar-auth-field input {
        width: 100%;
        height: 52px;
        padding: 0 15px;
        border: 1px solid #d7dee8;
        border-radius: 14px;
        outline: none;
        background: #ffffff;
        color: #202124;
        font: inherit;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .radar-auth-field input:focus {
        border-color: #2878f0;
        box-shadow: 0 0 0 4px rgba(40, 120, 240, 0.1);
      }

      .radar-auth-submit {
        width: 100%;
        min-height: 52px;
        margin-top: 16px;
        border: 0;
        border-radius: 14px;
        background: #2878f0;
        color: #ffffff;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.18s ease, opacity 0.18s ease;
      }

      .radar-auth-submit:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .radar-auth-submit:disabled {
        cursor: wait;
        opacity: 0.7;
      }

      .radar-auth-error {
        min-height: 20px;
        margin-top: 12px;
        color: #c5221f;
        font-size: 0.78rem;
        font-weight: 600;
      }

      .radar-auth-security {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid #edf1f6;
        color: #7d8898;
        font-size: 0.72rem;
        text-align: center;
      }

      .radar-auth-logout {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9000;
        display: none;
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        color: #526071;
        font: 600 0.75rem "Inter", sans-serif;
        box-shadow: 0 8px 24px rgba(38, 55, 79, 0.08);
        cursor: pointer;
      }

      .radar-auth-logout.visible {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      @media (max-width: 520px) {
        .radar-auth-gate {
          padding: 16px;
        }

        .radar-auth-card {
          padding: 26px 22px;
          border-radius: 22px;
        }

        .radar-auth-logout {
          right: 12px;
          bottom: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const createGate = () => {
    const existing = document.getElementById("radarAuthGate");
    if (existing) return existing;

    const gate = document.createElement("section");
    gate.id = "radarAuthGate";
    gate.className = "radar-auth-gate";
    gate.setAttribute("aria-label", "Acesso ao Radar Local");

    gate.innerHTML = `
      <div class="radar-auth-card">
        <div class="radar-auth-brand">
          <div class="radar-auth-mark" aria-hidden="true">
            <span class="radar-auth-dot blue"></span>
            <span class="radar-auth-dot red"></span>
            <span class="radar-auth-dot yellow"></span>
            <span class="radar-auth-dot green"></span>
          </div>

          <div class="radar-auth-brand-copy">
            <strong>Radar Local</strong>
            <span>Diagnóstico de oportunidade local</span>
          </div>
        </div>

        <span class="radar-auth-kicker">ACESSO INTERNO</span>
        <h1>Entre no Radar.</h1>
        <p>
          Área reservada para análises e diagnósticos locais.
        </p>

        <form id="radarAuthForm">
          <div class="radar-auth-field">
            <label for="radarAuthPassword">Senha de acesso</label>
            <input
              id="radarAuthPassword"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Digite sua senha"
              required
            >
          </div>

          <button
            id="radarAuthSubmit"
            class="radar-auth-submit"
            type="submit"
          >
            Entrar no Radar
          </button>

          <div
            id="radarAuthError"
            class="radar-auth-error"
            role="alert"
            aria-live="polite"
          ></div>
        </form>

        <div class="radar-auth-security">
          Sessão temporária protegida • acesso expira automaticamente
        </div>
      </div>
    `;

    document.body.prepend(gate);
    return gate;
  };

  const createLogoutButton = () => {
    const existing = document.getElementById("radarAuthLogout");
    if (existing) return existing;

    const button = document.createElement("button");
    button.id = "radarAuthLogout";
    button.className = "radar-auth-logout";
    button.type = "button";
    button.textContent = "Sair do Radar";
    document.body.appendChild(button);
    return button;
  };

  injectStyles();

  const gate = createGate();
  const logoutButton = createLogoutButton();
  const form = document.getElementById("radarAuthForm");
  const passwordInput = document.getElementById("radarAuthPassword");
  const submitButton = document.getElementById("radarAuthSubmit");
  const errorBox = document.getElementById("radarAuthError");

  const stopExpiryTimer = () => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  const lock = (message = "") => {
    stopExpiryTimer();
    clearToken();
    document.body.classList.add("radar-auth-locked");
    gate.hidden = false;
    logoutButton.classList.remove("visible");

    if (errorBox) {
      errorBox.textContent = message;
    }

    setTimeout(() => {
      passwordInput?.focus();
    }, 50);

    window.dispatchEvent(new CustomEvent("radar:locked"));
  };

  const scheduleExpiry = token => {
    stopExpiryTimer();

    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;

    const delay = Math.max(
      payload.exp * 1000 - Date.now(),
      0
    );

    expiryTimer = setTimeout(() => {
      lock("Sua sessão expirou. Entre novamente.");
    }, delay + 250);
  };

  const unlock = token => {
    document.body.classList.remove("radar-auth-locked");
    gate.hidden = true;
    logoutButton.classList.add("visible");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if (passwordInput) {
      passwordInput.value = "";
    }

    scheduleExpiry(token);
    window.dispatchEvent(new CustomEvent("radar:authenticated"));
  };

  const authFetch = async (path, options = {}) => {
    const token = getToken();

    if (!isTokenValid(token)) {
      lock("Sua sessão expirou. Entre novamente.");
      throw new Error("RADAR_SESSION_EXPIRED");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(
      path.startsWith("http")
        ? path
        : `${API_BASE}${path}`,
      {
        ...options,
        headers
      }
    );

    if (response.status === 401 || response.status === 403) {
      lock("Sua sessão expirou. Entre novamente.");
    }

    return response;
  };

  window.RadarAuth = {
    apiBase: API_BASE,
    getToken,
    logout: () => lock("Sessão encerrada."),
    authFetch
  };

  logoutButton.addEventListener("click", () => {
    lock("Sessão encerrada.");
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    const password = String(passwordInput?.value || "");

    if (!password) {
      errorBox.textContent = "Digite a senha de acesso.";
      passwordInput?.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Entrando...";
    errorBox.textContent = "";

    try {
      const response = await fetch(
        `${API_BASE}/radar/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.token) {
        if (response.status === 401) {
          throw new Error("INVALID_PASSWORD");
        }

        if (response.status === 429) {
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        throw new Error("LOGIN_FAILED");
      }

      sessionStorage.setItem(TOKEN_KEY, data.token);
      unlock(data.token);
    } catch (error) {
      const code =
        error instanceof Error
          ? error.message
          : "LOGIN_FAILED";

      if (code === "INVALID_PASSWORD") {
        errorBox.textContent = "Senha incorreta. Tente novamente.";
      } else if (code === "TOO_MANY_ATTEMPTS") {
        errorBox.textContent = "Muitas tentativas. Aguarde alguns minutos.";
      } else {
        errorBox.textContent = "Não foi possível acessar o Radar agora. Tente novamente.";
      }

      passwordInput?.select();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Entrar no Radar";
    }
  });

  const currentToken = getToken();

  if (isTokenValid(currentToken)) {
    unlock(currentToken);
  } else {
    lock();
  }
})();
