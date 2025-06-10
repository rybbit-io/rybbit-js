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
    window.addEventListener("hashchange", pageviewTracker);
  } else {
    log("SPA route change tracking is disabled.");
  }

  isAutoTrackingSetup = true;
}

export function setupDataAttributeTracking(): void {
  if (!currentConfig.trackDataAttributes) {
    log("Data attribute tracking is disabled.");
    return;
  }

  log("Setting up data attribute and outbound link tracking.");
  document.addEventListener("click", handleClick, true);
}

function handleClick(event: MouseEvent): void {
  const target = event.target as Element;

  let element = target as Element | null;
  while (element) {
    if (element.hasAttribute("data-rybbit-event")) {
      const eventName = element.getAttribute("data-rybbit-event");
      if (eventName) {
        const properties: Record<string, string> = {};
        for (const attr of element.attributes) {
          if (attr.name.startsWith("data-rybbit-prop-")) {
            const propName = attr.name.replace("data-rybbit-prop-", "");
            properties[propName] = attr.value;
          }
        }
        log("Data attribute event triggered:", eventName, properties);
        track("custom_event", { eventName, properties });
      }
      break;
    }
    element = element.parentElement;
  }

  if (currentConfig.trackOutboundLinks) {
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
}

export function cleanupAutoTracking(): void {
  if (!isAutoTrackingSetup) return;

  log("Cleaning up automatic tracking listeners.");

  if (currentConfig.autoTrackSpaRoutes) {
    window.removeEventListener("popstate", pageviewTracker);
    window.removeEventListener("hashchange", pageviewTracker);
  }

  document.removeEventListener("click", handleClick, true);

  isAutoTrackingSetup = false;
}
