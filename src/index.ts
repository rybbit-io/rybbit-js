import { initializeConfig, readConfigFromScriptTag, currentConfig } from "./config";
import { track } from "./core";
import { setupAutoTracking, cleanupAutoTracking } from "./listeners";
import { log, logError } from "./utils";
import { RybbitConfig, RybbitAPI, TrackProperties } from "./types";

let isInitialized = false;

const rybbit: RybbitAPI = {
  /**
   * Initializes the Rybbit SDK. Must be called before any other tracking methods.
   * @param config - Configuration object or the analyticsHost string.
   * @param siteId - Required if the first argument is the analyticsHost string.
   */
  init: (config: RybbitConfig | string, siteId?: string | number) => {
    if (isInitialized) {
      logError("Rybbit SDK already initialized. Call init() only once.");
      return;
    }

    const initSuccess = initializeConfig(config, siteId);
    if (!initSuccess) {
      return;
    }

    isInitialized = true;
    log(`SDK Initialized. Version: ${process.env.SDK_VERSION || "dev"}`);
    log("Config:", { ...currentConfig });

    setupAutoTracking();
  },

  /**
   * Tracks a pageview event.
   * Automatically called on initial load and SPA navigation if autoTrackPageviews is enabled.
   * Can be called manually for more control.
   * @param path - Optional. Override the detected path. Useful for virtual pageviews.
   */
  pageview: (path?: string) => {
    if (!isInitialized) {
      logError("Rybbit SDK not initialized. Call rybbit.init() first.");
      return;
    }
    // If a path override is provided, we might need to adjust the track function
    // For now, just track the current state but log the intention.
    // TODO: Enhance track() to accept path override if needed.
    if (path) {
      log(`Manual pageview called with path override: ${path} (override not yet implemented in core track)`);
    }
    track("pageview");
  },

  /**
   * Tracks a custom event.
   * @param name - The name of the custom event (e.g., "signup", "button_click").
   * @param properties - Optional. An object containing additional data about the event.
   */
  event: (name: string, properties?: TrackProperties) => {
    if (!isInitialized) {
      logError("Rybbit SDK not initialized. Call rybbit.init() first.");
      return;
    }
    if (!name) {
      logError("Event name is required and must be a string.");
      return;
    }
    track("custom_event", name, properties);
  },

  /**
   * Manually tracks an outbound link click.
   * Useful if automatic tracking is disabled or for links generated dynamically after load.
   * @param url - The destination URL of the link.
   * @param text - Optional. The text content of the link.
   * @param target - Optional. The target attribute of the link (e.g., "_blank").
   */
  trackOutboundLink: (
    url: string,
    text: string = "",
    target: string = "_self"
  ) => {
    if (!isInitialized) {
      logError("Rybbit SDK not initialized. Call rybbit.init() first.");
      return;
    }
    if (!url) {
      logError("Outbound link URL is required and must be a string.");
      return;
    }
    track("outbound", undefined, { url, text, target });
  },

  /**
   * Cleans up event listeners set up by the SDK. Useful in SPA environments
   * where the SDK might be re-initialized or removed.
   */
  // cleanup: cleanupAutoTracking // Maybe expose later if needed
};

// --- Auto-initialization for <script> tag usage ---
// Check if the script is loaded via a regular <script> tag
// and if rybbit hasn"t been defined already (e.g., by an import)
if (typeof window !== "undefined" && !window.rybbit) {
  const scriptConfig = readConfigFromScriptTag();

  if (scriptConfig.analyticsHost && scriptConfig.siteId) {
    log("Attempting auto-initialization from script tag attributes.");
    rybbit.init(scriptConfig as RybbitConfig);
  } else {
    // Make the API available, but require manual init
    log("Rybbit loaded via script tag, but missing data-rybbit-host or data-site-id. Manual rybbit.init() required.");
  }

  window.rybbit = rybbit;
}

export default rybbit;
