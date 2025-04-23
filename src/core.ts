import { currentConfig } from "./config";
import { findMatchingPattern, log, logError } from "./utils";
import { EventType, TrackPayload, TrackProperties } from "./types";

let isTrackingPaused = false;

export function track(
  eventType: EventType,
  eventName?: string, // Optional: Only used for "custom_event"
  properties: TrackProperties = {}
): void {
  if (isTrackingPaused) {
    log("Tracking is paused.");
    return;
  }

  if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
    logError("Rybbit config not available. Ensure rybbit.init() was called successfully.");
    return;
  }

  if (eventType === "custom_event" && !eventName) {
    logError("Event name is required and must be a string for custom events.");
    return;
  }

  try {
    const url = new URL(window.location.href);
    let pathname = url.pathname;

    if (findMatchingPattern(pathname, currentConfig.skipPatterns)) {
      log(`Skipping track for path: ${pathname}`);
      return;
    }

    const maskMatch = findMatchingPattern(pathname, currentConfig.maskPatterns);
    if (maskMatch) {
      log(`Masking path ${pathname} as ${maskMatch}`);
      pathname = maskMatch;
    }

    const payload: TrackPayload = {
      site_id: currentConfig.siteId,
      hostname: url.hostname,
      pathname: pathname,
      querystring: currentConfig.trackQuerystring ? url.search : "",
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      language: navigator.language,
      page_title: document.title,
      referrer: document.referrer || "direct",
      type: eventType,
      ...(eventType === "custom_event" && { event_name: eventName }),
      ...((eventType === "custom_event" || eventType === "outbound") && {
        properties: JSON.stringify(properties),
      }),
    };

    log("Sending track event:", payload);

    const data = JSON.stringify(payload);
    const endpoint = `${currentConfig.analyticsHost}/track`;

    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(endpoint, new Blob([data], { type: "application/json" }));
      if (!sent) {
        logError("sendBeacon failed, falling back to fetch.");
        sendWithFetch(endpoint, data);
      }
    } else {
      sendWithFetch(endpoint, data);
    }

  } catch (error) {
    logError("Error during tracking:", error);
  }
}

function sendWithFetch(endpoint: string, data: string): void {
  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: data,
    mode: "cors",
    keepalive: true,
  }).catch(error => {
    logError("Fetch request failed:", error);
  });
}

export function pauseTracking(): void {
  isTrackingPaused = true;
  log("Tracking paused.");
}

export function resumeTracking(): void {
  isTrackingPaused = false;
  log("Tracking resumed.");
}
