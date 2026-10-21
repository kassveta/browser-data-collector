"use strict";

const consent = document.getElementById("consent");
const collectButton = document.getElementById("collect");
const downloadButton = document.getElementById("download");
const clearButton = document.getElementById("clear");
const output = document.getElementById("output");
const status = document.getElementById("status");

let result = null;
let collecting = false;

// Сохраняем false и 0; отсутствующие значения обозначаем null.
function read(getter) {
  try {
    return getter() ?? null;
  } catch {
    return null;
  }
}

function getWebGLInfo() {
  const canvas = document.createElement("canvas");
  let gl = null;

  try {
    gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    if (!gl) {
      return { available: false };
    }

    const debug = gl.getExtension("WEBGL_debug_renderer_info");

    return {
      available: true,
      vendor: read(() => gl.getParameter(gl.VENDOR)),
      renderer: read(() => gl.getParameter(gl.RENDERER)),
      version: read(() => gl.getParameter(gl.VERSION)),
      shadingLanguageVersion: read(
        () => gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      ),
      unmaskedVendor: debug
        ? read(() => gl.getParameter(debug.UNMASKED_VENDOR_WEBGL))
        : null,
      unmaskedRenderer: debug
        ? read(() => gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
        : null,
      maxTextureSize: read(
        () => gl.getParameter(gl.MAX_TEXTURE_SIZE)
      )
    };
  } catch {
    return { available: false, error: "WebGL access failed" };
  } finally {
    try {
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // Освобождение контекста необязательно.
    }
  }
}

function getConnectionInfo() {
  const connection = read(
    () => navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection
  );

  if (!connection) return null;

  return {
    effectiveType: read(() => connection.effectiveType),
    downlinkMbps: read(() => connection.downlink),
    rttMs: read(() => connection.rtt),
    saveData: read(() => connection.saveData)
  };
}

function getClientHints() {
  const uaData = read(() => navigator.userAgentData);

  if (!uaData) return null;

  return {
    brands: read(() =>
      Array.from(uaData.brands, item => ({
        brand: item.brand,
        version: item.version
      }))
    ),
    mobile: read(() => uaData.mobile),
    platform: read(() => uaData.platform)
  };
}

async function collectBrowserData() {
  return {
    schemaVersion: "1.0",
    collectedAt: new Date().toISOString(),

    browser: {
      userAgent: read(() => navigator.userAgent),
      clientHints: getClientHints(),
      vendor: read(() => navigator.vendor),
      platform: read(() => navigator.platform),
      language: read(() => navigator.language),
      languages: read(() => Array.from(navigator.languages)),
      cookieEnabled: read(() => navigator.cookieEnabled),
      doNotTrack: read(() => navigator.doNotTrack),
      globalPrivacyControl: read(
        () => navigator.globalPrivacyControl
      ),
      webdriver: read(() => navigator.webdriver),
      pdfViewerEnabled: read(() => navigator.pdfViewerEnabled)
    },

    device: {
      logicalProcessors: read(
        () => navigator.hardwareConcurrency
      ),
      approximateMemoryGB: read(
        () => navigator.deviceMemory
      ),
      maxTouchPoints: read(() => navigator.maxTouchPoints),
      touchEventSupported: read(
        () => "ontouchstart" in window
      )
    },

    screen: {
      width: read(() => window.screen.width),
      height: read(() => window.screen.height),
      availableWidth: read(() => window.screen.availWidth),
      availableHeight: read(() => window.screen.availHeight),
      colorDepth: read(() => window.screen.colorDepth),
      pixelDepth: read(() => window.screen.pixelDepth),
      devicePixelRatio: read(() => window.devicePixelRatio),
      orientation: read(() => window.screen.orientation.type)
    },

    viewport: {
      width: read(() => window.innerWidth),
      height: read(() => window.innerHeight)
    },

    locale: {
      timeZone: read(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone
      ),
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      intlLocale: read(
        () => Intl.DateTimeFormat().resolvedOptions().locale
      )
    },

    preferences: {
      darkMode: read(
        () => matchMedia("(prefers-color-scheme: dark)").matches
      ),
      reducedMotion: read(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
      coarsePointer: read(
        () => matchMedia("(pointer: coarse)").matches
      )
    },

    network: {
      online: read(() => navigator.onLine),
      connection: getConnectionInfo()
    },

    graphics: getWebGLInfo(),

    capabilities: {
      secureContext: read(() => window.isSecureContext),
      webAssembly: read(
        () => typeof WebAssembly !== "undefined"
      ),
      serviceWorker: read(
        () => "serviceWorker" in navigator
      ),
      webSocket: read(() => "WebSocket" in window),
      indexedDB: read(
        () => typeof window.indexedDB !== "undefined"
      )
    }
  };
}

function updateButtons() {
  collectButton.disabled = !consent.checked || collecting;
  clearButton.disabled = collecting;
  downloadButton.disabled = result === null || collecting;
}

consent.addEventListener("change", () => {
  updateButtons();

  status.textContent = consent.checked
    ? "Нажмите «Собрать данные»."
    : "Сбор отключён. Ожидание согласия.";
});

collectButton.addEventListener("click", async () => {
  if (!consent.checked || collecting) return;

  collecting = true;
  updateButtons();
  status.textContent = "Сбор данных…";

  try {
    const data = await collectBrowserData();

    // Если согласие отозвали до завершения, результат не сохраняем.
    if (!consent.checked) {
      result = null;
      output.textContent = "Согласие отозвано. Результат не сохранён.";
      status.textContent = "Сбор отменён.";
      return;
    }

    result = data;
    output.textContent = JSON.stringify(result, null, 2);
    status.textContent =
      "Готово. Результат находится только в памяти этой вкладки.";
  } catch (error) {
    result = null;
    output.textContent = "Не удалось собрать данные.";
    status.textContent = `Ошибка: ${error.message}`;
  } finally {
    collecting = false;
    updateButtons();
  }
});

downloadButton.addEventListener("click", () => {
  if (!result) return;

  const blob = new Blob(
    [JSON.stringify(result, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `browser-data-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

clearButton.addEventListener("click", () => {
  result = null;
  output.textContent = "Результат очищен.";
  status.textContent =
    "Данные удалены из интерфейса и переменной результата.";
  updateButtons();
});
