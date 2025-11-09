import { currentConfig } from "./config";
import { track } from "./core";
import { log, logError } from "./utils";
import { WebVitalsData } from "./types";
import { Metric, onLCP, onCLS, onINP, onFCP, onTTFB } from "web-vitals";

let webVitalsData: WebVitalsData = {
  lcp: null,
  cls: null,
  inp: null,
  fcp: null,
  ttfb: null,
};

let webVitalsSent = false;
let webVitalsTimeout: ReturnType<typeof setTimeout> | null = null;

function checkAndSendWebVitals(): void {
  if (webVitalsSent) {
    return;
  }

  const allMetricsCollected = Object.values(webVitalsData).every(
    (value) => value !== null
  );

  if (allMetricsCollected) {
    sendWebVitals();
  }
}

function sendWebVitals(): void {
  if (webVitalsSent) {
    return;
  }
  webVitalsSent = true;

  if (webVitalsTimeout) {
    clearTimeout(webVitalsTimeout);
    webVitalsTimeout = null;
  }

  log("Sending web vitals data:", webVitalsData);

  track("performance", {
    eventName: "web-vitals",
    webVitals: webVitalsData,
  });
}

function collectMetric(metric: Metric): void {
  if (webVitalsSent) {
    return;
  }

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

  try {
    onLCP(collectMetric);
    onCLS(collectMetric);
    onINP(collectMetric);
    onFCP(collectMetric);
    onTTFB(collectMetric);

    webVitalsTimeout = setTimeout(() => {
      if (!webVitalsSent) {
        log("Web vitals timeout reached, sending collected metrics.");
        sendWebVitals();
      }
    }, 20000);

    window.addEventListener("beforeunload", () => {
      if (!webVitalsSent) {
        sendWebVitals();
      }
    });

    log("Web vitals tracking initialized successfully.");
  } catch (e) {
    logError("Error setting up web vitals tracking:", e);
  }
}
