import { currentConfig } from "./config";
import { track } from "./core";
import { log, logError } from "./utils";
import { WebVitalsData } from "./types";

let webVitalsData: WebVitalsData = {
  lcp: null,
  cls: null,
  inp: null,
  fcp: null,
  ttfb: null,
};

let webVitalsSent = false;
let webVitalsTimeout: ReturnType<typeof setTimeout> | null = null;
let webVitalsLibLoaded = false;

function loadWebVitals(): Promise<void> {
  if (webVitalsLibLoaded) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js";
    script.onload = () => {
      webVitalsLibLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Failed to load web-vitals library"));
    };
    document.head.appendChild(script);
  });
}

function checkAndSendWebVitals(): void {
  if (webVitalsSent) return;

  const allMetricsCollected = Object.values(webVitalsData).every(
    (value) => value !== null
  );

  if (allMetricsCollected) {
    sendWebVitals();
  }
}

function sendWebVitals(): void {
  if (webVitalsSent) return;
  webVitalsSent = true;

  if (webVitalsTimeout) {
    clearTimeout(webVitalsTimeout);
    webVitalsTimeout = null;
  }

  log("Sending web vitals data:", webVitalsData);

  const payload = {
    site_id: currentConfig.siteId,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    querystring: currentConfig.trackQuerystring ? window.location.search : "",
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    language: navigator.language,
    page_title: document.title,
    referrer: document.referrer || "direct",
    type: "performance" as const,
    event_name: "web-vitals",
    lcp: webVitalsData.lcp,
    cls: webVitalsData.cls,
    inp: webVitalsData.inp,
    fcp: webVitalsData.fcp,
    ttfb: webVitalsData.ttfb,
  };

  const data = JSON.stringify(payload);
  const endpoint = `${currentConfig.analyticsHost}/track`;

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(endpoint, new Blob([data], { type: "application/json" }));
    if (!sent) {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
        mode: "cors",
        keepalive: true,
      }).catch(error => logError("Failed to send web vitals:", error));
    }
  } else {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      mode: "cors",
      keepalive: true,
    }).catch(error => logError("Failed to send web vitals:", error));
  }
}

function collectMetric(metric: any): void {
  if (webVitalsSent) return;

  const metricName = metric.name.toLowerCase() as keyof WebVitalsData;
  webVitalsData[metricName] = metric.value;

  log(`Collected ${metricName}:`, metric.value);
  checkAndSendWebVitals();
}

export function initWebVitals(): void {
  if (!currentConfig.trackWebVitals) {
    log("Web vitals tracking is disabled.");
    return;
  }

  log("Initializing web vitals tracking...");

  loadWebVitals()
    .then(() => {
      log("Web vitals library loaded successfully.");

      if (typeof (window as any).webVitals !== "undefined") {
        const webVitals = (window as any).webVitals;

        try {
          webVitals.getLCP(collectMetric);
          webVitals.getCLS(collectMetric);
          webVitals.getINP(collectMetric);

          webVitals.getFCP(collectMetric);
          webVitals.getTTFB(collectMetric);

          webVitalsTimeout = setTimeout(() => {
            if (!webVitalsSent) {
              log("Web vitals timeout reached, sending collected metrics.");
              sendWebVitals();
            }
          }, currentConfig.webVitalsTimeout || 20000);

          window.addEventListener("beforeunload", () => {
            if (!webVitalsSent) {
              sendWebVitals();
            }
          });

          log("Web vitals tracking initialized successfully.");
        } catch (e) {
          logError("Error setting up web vitals tracking:", e);
        }
      } else {
        logError("Web vitals library loaded but not available globally.");
      }
    })
    .catch((e) => {
      logError("Failed to load web vitals library:", e);
    });
}
