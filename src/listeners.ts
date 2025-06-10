import { currentConfig } from "./config";
import { track } from "./core";
import { debounce, isOutboundLink, log } from "./utils";
import { OutboundLinkProperties } from "./types";

let pageviewTracker: () => void;
let isAutoTrackingSetup = false;

export function setupAutoTracking(): void {
  if (isAutoTrackingSetup) {
    log("Automatic tracking already set up.");
    return;
  }

  if (!currentConfig.autoTrackPageviews) {
    log("Automatic pageview tracking is disabled.");
    return;
  }

  log("Setting up automatic tracking...");

  pageviewTracker = currentConfig.debounce && currentConfig.debounce > 0
    ? debounce(() => track("pageview"), currentConfig.debounce)
    : () => track("pageview");

  requestAnimationFrame(() => {
    pageviewTracker();
  });

  if (currentConfig.autoTrackSpaRoutes) {
    log("Setting up SPA route change tracking.");
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      pageviewTracker();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      pageviewTracker();
    };

    window.addEventListener("popstate", pageviewTracker);

    if (currentConfig.trackHashRoutes) {
      window.addEventListener("hashchange", pageviewTracker);
    }
  } else {
    log("SPA route change tracking is disabled.");
  }

  if (currentConfig.trackOutboundLinks) {
    log("Setting up outbound link tracking.");
    document.addEventListener("click", handleOutboundLinkClick, true);
  } else {
    log("Outbound link tracking is disabled.");
  }

  isAutoTrackingSetup = true;
}

function handleOutboundLinkClick(event: MouseEvent): void {
  const target = event.target as Element;
  const link = target.closest("a");

  if (link && link.href && isOutboundLink(link.href)) {
    log("Outbound link clicked:", link.href);
    const properties: OutboundLinkProperties = {
      url: link.href,
      text: link.innerText || link.textContent || "",
      target: link.target || "_self",
    };
    track("outbound", { properties });
  }
}

export function cleanupAutoTracking(): void {
  if (!isAutoTrackingSetup) return;

  log("Cleaning up automatic tracking listeners.");

  if (currentConfig.autoTrackSpaRoutes) {
    window.removeEventListener("popstate", pageviewTracker);

    if (currentConfig.trackHashRoutes) {
      window.removeEventListener("hashchange", pageviewTracker);
    }
  }

  if (currentConfig.trackOutboundLinks) {
    document.removeEventListener("click", handleOutboundLinkClick, true);
  }

  isAutoTrackingSetup = false;
}
