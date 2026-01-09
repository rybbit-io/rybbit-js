import { InternalRybbitConfig, RybbitConfig } from "./types";
import { log, logError } from "./utils";

// Local-only defaults (not controlled by remote config)
const localDefaults: Required<Omit<RybbitConfig, "analyticsHost" | "siteId" | "replayPrivacyConfig">> =
  {
    debounceDuration: 500,
    skipPatterns: [],
    maskPatterns: [],
    debug: false,
  };

// Remote-controlled defaults (when remote config is disabled or fails)
const remoteDefaults = {
  autoTrackPageview: true,
  autoTrackSpa: true,
  trackQuerystring: true,
  trackOutbound: true,
  enableWebVitals: false,
  trackErrors: false,
  enableSessionReplay: false,
};

let internalConfig: InternalRybbitConfig | null = null;

export const currentConfig: Readonly<InternalRybbitConfig> = new Proxy(
  {} as InternalRybbitConfig,
  {
    get: (_, prop: keyof InternalRybbitConfig) => {
      if (!internalConfig) {
        if (prop !== "debug") {
          logError(
            "Rybbit SDK accessed before initialization. Call rybbit.init() first."
          );
        }
        return (localDefaults[prop as keyof typeof localDefaults] ??
                remoteDefaults[prop as keyof typeof remoteDefaults] ??
                undefined);
      }
      return internalConfig[prop];
    },
    set: () => {
      logError("Rybbit config is read-only after initialization.");
      return false;
    },
  }
);

interface RemoteConfig {
  autoTrackPageview: boolean;
  autoTrackSpa: boolean;
  trackQuerystring: boolean;
  trackOutbound: boolean;
  enableWebVitals: boolean;
  trackErrors: boolean;
  enableSessionReplay: boolean;
}

async function fetchRemoteConfig(
  analyticsHost: string,
  siteId: string
): Promise<RemoteConfig | null> {
  try {
    log("Fetching remote configuration...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${analyticsHost}/site/tracking-config/${siteId}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const apiConfig = await response.json();
      log("Remote configuration fetched successfully", apiConfig);

      // Map API field names to internal config field names
      return {
        autoTrackPageview: apiConfig.trackInitialPageView ?? remoteDefaults.autoTrackPageview,
        autoTrackSpa: apiConfig.trackSpaNavigation ?? remoteDefaults.autoTrackSpa,
        trackQuerystring: apiConfig.trackUrlParams ?? remoteDefaults.trackQuerystring,
        trackOutbound: apiConfig.trackOutbound ?? remoteDefaults.trackOutbound,
        enableWebVitals: apiConfig.webVitals ?? remoteDefaults.enableWebVitals,
        trackErrors: apiConfig.trackErrors ?? remoteDefaults.trackErrors,
        enableSessionReplay: apiConfig.sessionReplay ?? remoteDefaults.enableSessionReplay,
      };
    } else {
      logError(`Failed to fetch remote config: ${response.status}`);
      return null;
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      logError("Remote config fetch timed out");
    } else {
      logError("Error fetching remote config:", error);
    }
    return null;
  }
}

export async function initializeConfig(options: RybbitConfig): Promise<boolean> {
  if (internalConfig) {
    logError("Rybbit SDK already initialized.");
    return false;
  }

  if (typeof options !== "object" || options === null) {
    logError(
      "Invalid configuration provided to rybbit.init(). Expected an object."
    );
    return false;
  }

  const analyticsHost = options.analyticsHost;
  if (!analyticsHost || analyticsHost.trim() === "") {
    logError(
      "`analyticsHost` is required in Rybbit config and must be a non-empty string."
    );
    return false;
  }
  const finalAnalyticsHost = analyticsHost.replace(/\/$/, "");

  const siteId = options.siteId;
  if (!siteId || siteId.trim() === "") {
    logError(
      "`siteId` is required in Rybbit config and must be a non-empty string."
    );
    return false;
  }

  const remoteConfig = await fetchRemoteConfig(finalAnalyticsHost, siteId);
  const finalRemoteConfig = remoteConfig || remoteDefaults;

  const validatedSkipPatterns = Array.isArray(options.skipPatterns)
    ? options.skipPatterns
    : localDefaults.skipPatterns;
  const validatedMaskPatterns = Array.isArray(options.maskPatterns)
    ? options.maskPatterns
    : localDefaults.maskPatterns;

  internalConfig = {
    // Required
    analyticsHost: finalAnalyticsHost,
    siteId: siteId,

    // Local settings (user can override)
    debounceDuration: Math.max(0, options.debounceDuration ?? localDefaults.debounceDuration),
    skipPatterns: validatedSkipPatterns,
    maskPatterns: validatedMaskPatterns,
    debug: options.debug ?? localDefaults.debug,

    // Session replay local settings
    replayPrivacyConfig: options.replayPrivacyConfig,

    // Remote-controlled settings (from API, not user config)
    autoTrackPageview: finalRemoteConfig.autoTrackPageview,
    autoTrackSpa: finalRemoteConfig.autoTrackSpa,
    trackQuerystring: finalRemoteConfig.trackQuerystring,
    trackOutbound: finalRemoteConfig.trackOutbound,
    enableWebVitals: finalRemoteConfig.enableWebVitals,
    trackErrors: finalRemoteConfig.trackErrors,
    enableSessionReplay: finalRemoteConfig.enableSessionReplay,
  };

  return true;
}
