import { currentConfig } from "./config";
import { findMatchingPattern, log, logError } from "./utils";
import { EventType, TrackPayload, TrackProperties } from "./types";

let isTrackingPaused = false;

export function track(
  eventType: EventType,
  eventData: {
    eventName?: string;
    properties?: TrackProperties;
    pathOverride?: string;
  } = {}
): void {
  if (isTrackingPaused) {
    log("Tracking is paused.");
    return;
  }

  if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
    logError("Rybbit config not available. Ensure rybbit.init() was called successfully.");
    return;
  }

  const { eventName, properties = {}, pathOverride } = eventData;

  if (eventType === "custom_event" && !eventName) {
    logError("Event name is required and must be a string for custom events.");
    return;
  }

  try {
    const url = new URL(window.location.href);
    let pathForTracking: string;
    let searchForTracking: string = ""; // Default query string

    if (eventType === "pageview" && typeof pathOverride === "string" && pathOverride.trim()) {
      log(`Using path override: ${pathOverride}`);
      // Check if override includes query params
      try {
        // Use a dummy base to parse the override path/query correctly
        const overrideUrl = new URL(pathOverride, "http://dummybase");
        pathForTracking = overrideUrl.pathname;
        searchForTracking = overrideUrl.search || "";
        log(`Parsed override path: ${pathForTracking}, search: ${searchForTracking}`);
      } catch (e) {
        logError(`Invalid pathOverride format: ${pathOverride}. Using window location.`);
        pathForTracking = url.pathname;
        searchForTracking = currentConfig.trackQuerystring ? url.search : "";
      }
    } else {
      // Default behavior: use window location
      pathForTracking = url.pathname;
      searchForTracking = currentConfig.trackQuerystring ? url.search : "";
    }

    if (findMatchingPattern(pathForTracking, currentConfig.skipPatterns)) {
      log(`Skipping track for path: ${pathForTracking}`);
      return;
    }

    const maskMatch = findMatchingPattern(pathForTracking, currentConfig.maskPatterns);
    if (maskMatch) {
      log(`Masking path ${pathForTracking} as ${maskMatch}`);
      pathForTracking = maskMatch;
      // When masking, clear the query string as it belongs to the original path
      searchForTracking = "";
    }

    const payload: TrackPayload = {
      site_id: currentConfig.siteId,
      hostname: url.hostname,
      pathname: pathForTracking,
      querystring: searchForTracking,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      language: navigator.language,
      page_title: document.title,
      referrer: document.referrer || "direct",
      type: eventType,
      ...(eventType === "custom_event" && { event_name: eventName }),
      ...((eventType === "custom_event" || eventType === "outbound") && Object.keys(properties).length > 0 && {
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
