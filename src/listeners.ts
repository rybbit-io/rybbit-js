import { currentConfig } from "./config";
import { track } from "./core";
import { debounce, isOutboundLink, log, logError, getPathname } from "./utils";
import { OutboundLinkProperties, PageChangeCallback } from "./types";

let pageviewTracker: () => void;
let isAutoTrackingSetup = false;
let pageChangeCallbacks: PageChangeCallback[] = [];
let currentPathname: string = "";

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

  currentPathname = getPathname();

  pageviewTracker = currentConfig.debounce && currentConfig.debounce > 0
    ? debounce(() => {
        const newPath = getPathname();
        notifyPageChange(newPath);
        track("pageview");
      }, currentConfig.debounce)
    : () => {
        const newPath = getPathname();
        notifyPageChange(newPath);
        track("pageview");
      };

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
  } else {
    log("SPA route change tracking is disabled.");
  }

  window.addEventListener("hashchange", pageviewTracker);

  isAutoTrackingSetup = true;
}

export function setupDataAttributeTracking(): void {
  log("Setting up data attribute and outbound link tracking.");
  document.addEventListener("click", handleClick, true);
}

function handleClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) {
    return;
  }

  let element: Element | null = event.target;
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

  if (currentConfig.trackOutboundLinks && event.target instanceof Element) {
    const link = event.target.closest("a");
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

export function addPageChangeCallback(callback: PageChangeCallback): () => void {
  pageChangeCallbacks.push(callback);
  log("Page change callback added");

  return () => {
    pageChangeCallbacks = pageChangeCallbacks.filter(cb => cb !== callback);
    log("Page change callback removed");
  };
}

function notifyPageChange(newPath: string): void {
  const previousPath = currentPathname;
  currentPathname = newPath;

  if (previousPath !== newPath) {
    log(`Page changed from ${previousPath} to ${newPath}`);
    pageChangeCallbacks.forEach(callback => {
      try {
        callback(newPath, previousPath);
      } catch (error) {
        logError("Error in page change callback:", error);
      }
    });
  }
}

export function cleanupAutoTracking(): void {
  if (!isAutoTrackingSetup) return;

  log("Cleaning up automatic tracking listeners.");

  window.removeEventListener("popstate", pageviewTracker);
  window.removeEventListener("hashchange", pageviewTracker);
  document.removeEventListener("click", handleClick, true);

  pageChangeCallbacks = [];

  isAutoTrackingSetup = false;
}
