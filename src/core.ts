import { currentConfig } from "./config";
import { findMatchingPattern, log, logError, getPathname } from "./utils";
import { EventType, TrackPayload, TrackProperties, WebVitalsData } from "./types";

let customUserId: string | null = null;
let isOptedOut = false;

try {
  const storedUserId = localStorage.getItem("rybbit-user-id");
  if (storedUserId) {
    customUserId = storedUserId;
  }

  const optOutStatus = localStorage.getItem("disable-rybbit");
  if (optOutStatus !== null) {
    isOptedOut = true;
  }
} catch (e) {
  logError("localStorage unavailable");
}

if (typeof window !== "undefined" && (window as any).__RYBBIT_OPTOUT__) {
  isOptedOut = true;
}

export function track(
  eventType: EventType,
  eventData: {
    eventName?: string;
    properties?: TrackProperties;
    pathOverride?: string;
    webVitals?: WebVitalsData;
  } = {}
): void {
  if (isOptedOut) {
    log("Opted out of tracking.");
    return;
  }

  if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
    logError("Rybbit config not available. Ensure rybbit.init() was called successfully.");
    return;
  }

  const { eventName, properties, pathOverride, webVitals } = eventData;

  if ((eventType === "custom_event" || eventType === "performance") && !eventName) {
    logError("Event name is required and must be a string for performance or custom events.");
    return;
  }

  try {
    const url = new URL(window.location.href);
    let pathForTracking: string;
    let searchForTracking: string = ""; // Default query string

    if (eventType === "pageview" && typeof pathOverride === "string" && pathOverride.trim()) {
      log(`Using path override: ${pathOverride}`);
      try {
        if (!/^\//.test(pathOverride.trim()) && !/^https?:\/\//.test(pathOverride.trim())) {
          throw new Error("pathOverride must start with /");
        }
        const overrideUrl = new URL(pathOverride.trim(), "http://dummybase");
        pathForTracking = overrideUrl.pathname;
        searchForTracking = overrideUrl.search || "";
        log(`Parsed override path: ${pathForTracking}, search: ${searchForTracking}`);
      } catch (e) {
        logError(`Invalid pathOverride format: ${pathOverride}. Using window location.`);
        pathForTracking = getPathname();
        searchForTracking = currentConfig.trackQuerystring ? url.search : "";
      }
    } else {
      pathForTracking = getPathname();
      searchForTracking = currentConfig.trackQuerystring ? url.search : "";
    }

    if (eventType !== "performance" && findMatchingPattern(pathForTracking, currentConfig.skipPatterns)) {
      log(`Skipping track for path: ${pathForTracking}`);
      return;
    }

    const maskMatch = findMatchingPattern(pathForTracking, currentConfig.maskPatterns);
    if (maskMatch && eventType !== "performance") {
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
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      page_title: document.title,
      referrer: document.referrer,
      type: eventType,
      ...((eventType === "custom_event" || eventType === "performance" || eventType === "error") && { event_name: eventName }),
      ...((eventType === "custom_event" || eventType === "outbound" || eventType === "error" || eventType === "button_click" || eventType === "copy" || eventType === "form_submit" || eventType === "input_change") && Object.keys(properties ?? {}).length > 0 && {
        properties: JSON.stringify(properties),
      }),
      ...(eventType === "performance" && webVitals && { ...webVitals }),
      ...(customUserId && { user_id: customUserId }),
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

async function sendIdentifyEvent(
  userId: string,
  traits?: Record<string, unknown>,
  isNewIdentify: boolean = true
): Promise<void> {
  if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
    logError("Rybbit config not available. Ensure rybbit.init() was called successfully.");
    return;
  }

  try {
    await fetch(`${currentConfig.analyticsHost}/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        site_id: currentConfig.siteId,
        user_id: userId,
        traits: traits,
        is_new_identify: isNewIdentify,
      }),
      mode: "cors",
      keepalive: true,
    });
    log("Identify event sent:", { userId, traits, isNewIdentify });
  } catch (error) {
    logError("Failed to send identify event:", error);
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (userId.trim() === "") {
    logError("User ID must be a non-empty string");
    return;
  }
  customUserId = userId.trim();
  try {
    localStorage.setItem("rybbit-user-id", customUserId);
    log("User identified:", customUserId);
  } catch (e) {
    logError("Could not persist user ID to localStorage");
  }

  sendIdentifyEvent(customUserId, traits, true);
}

export function setTraits(traits: Record<string, unknown>): void {
  if (!traits || typeof traits !== "object") {
    logError("Traits must be an object");
    return;
  }

  const userId = customUserId;
  if (!userId) {
    logError("Cannot set traits without identifying user first. Call identify() first.");
    return;
  }

  sendIdentifyEvent(userId, traits, false);
}

export function clearUserId(): void {
  customUserId = null;
  try {
    localStorage.removeItem("rybbit-user-id");
    log("User ID cleared");
  } catch (e) {
    logError("Could not remove user ID from localStorage");
  }
}

export function getUserId(): string | null {
  return customUserId;
}
