import { RybbitConfig } from "./types";
import { log, logError } from "./utils";

const defaultConfig: Required<Omit<RybbitConfig, "analyticsHost" | "siteId" | "beforeErrorCapture" | "replayPrivacyConfig">> =
  {
    debounce: 500,
    autoTrackPageviews: true,
    autoTrackSpaRoutes: true,
    trackQuerystring: true,
    trackOutboundLinks: true,
    trackHashRoutes: true,
    trackDataAttributes: true,
    trackWebVitals: false,
    webVitalsTimeout: 20000,
    skipPatterns: [],
    maskPatterns: [],
    debug: false,
    // Error tracking defaults
    captureErrors: false,
    errorSampleRate: 1.0,
    // Session replay defaults
    enableSessionReplay: false,
    replayBufferSize: 250,
    replayBatchInterval: 5000,
    // Remote config defaults
    enableRemoteConfig: false,
    remoteConfigTimeout: 3000,
    // Enhanced hash routing
    enhancedHashRouting: false,
  };

let internalConfig: RybbitConfig | null = null;

export const currentConfig: Readonly<RybbitConfig> = new Proxy(
  {} as RybbitConfig,
  {
    get: (_, prop: keyof RybbitConfig) => {
      if (!internalConfig) {
        if (prop !== "debug") {
          logError(
            "Rybbit SDK accessed before initialization. Call rybbit.init() first."
          );
        }
        return defaultConfig[prop as keyof typeof defaultConfig] ?? undefined;
      }
      return internalConfig[prop];
    },
    set: () => {
      logError("Rybbit config is read-only after initialization.");
      return false;
    },
  }
);

async function fetchRemoteConfig(
  analyticsHost: string,
  siteId: string,
  timeout: number
): Promise<Partial<RybbitConfig> | null> {
  try {
    log("Fetching remote configuration...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${analyticsHost}/config/${siteId}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const remoteConfig = await response.json();
      log("Remote configuration fetched successfully");
      return remoteConfig;
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
  const userConfigInput = options;

  const analyticsHost = userConfigInput.analyticsHost;
  if (analyticsHost.trim() === "") {
    logError(
      "`analyticsHost` is required in Rybbit config and must be a non-empty string."
    );
    return false;
  }
  const finalAnalyticsHost = analyticsHost.replace(/\/$/, "");

  const siteId = userConfigInput.siteId;
  if (siteId.trim() === "") {
    logError(
      "`siteId` is required in Rybbit config and must be a non-empty string."
    );
    return false;
  }

  // Fetch remote config if enabled
  let remoteConfig: Partial<RybbitConfig> | null = null;
  if (userConfigInput.enableRemoteConfig ?? defaultConfig.enableRemoteConfig) {
    const timeout = userConfigInput.remoteConfigTimeout ?? defaultConfig.remoteConfigTimeout;
    remoteConfig = await fetchRemoteConfig(finalAnalyticsHost, siteId, timeout);
  }

  // Merge configs: User > Remote > Defaults
  const mergedConfig = {
    ...defaultConfig,
    ...(remoteConfig || {}),
    ...userConfigInput,
  };

  const validatedSkipPatterns = Array.isArray(mergedConfig.skipPatterns)
    ? mergedConfig.skipPatterns
    : defaultConfig.skipPatterns;
  const validatedMaskPatterns = Array.isArray(mergedConfig.maskPatterns)
    ? mergedConfig.maskPatterns
    : defaultConfig.maskPatterns;

  internalConfig = {
    analyticsHost: finalAnalyticsHost,
    siteId: siteId,
    debounce: Math.max(0, mergedConfig.debounce),
    autoTrackPageviews: mergedConfig.autoTrackPageviews,
    autoTrackSpaRoutes: mergedConfig.autoTrackSpaRoutes,
    trackQuerystring: mergedConfig.trackQuerystring,
    trackOutboundLinks: mergedConfig.trackOutboundLinks,
    trackHashRoutes: mergedConfig.trackHashRoutes,
    trackDataAttributes: mergedConfig.trackDataAttributes,
    trackWebVitals: mergedConfig.trackWebVitals,
    webVitalsTimeout: Math.max(1000, mergedConfig.webVitalsTimeout),
    skipPatterns: validatedSkipPatterns,
    maskPatterns: validatedMaskPatterns,
    debug: mergedConfig.debug,
    // Error tracking
    captureErrors: mergedConfig.captureErrors,
    errorSampleRate: Math.max(0, Math.min(1, mergedConfig.errorSampleRate)),
    beforeErrorCapture: mergedConfig.beforeErrorCapture,
    // Session replay
    enableSessionReplay: mergedConfig.enableSessionReplay,
    replayBufferSize: Math.max(1, mergedConfig.replayBufferSize),
    replayBatchInterval: Math.max(1000, mergedConfig.replayBatchInterval),
    replayPrivacyConfig: mergedConfig.replayPrivacyConfig,
    // Remote config
    enableRemoteConfig: mergedConfig.enableRemoteConfig,
    remoteConfigTimeout: Math.max(1000, mergedConfig.remoteConfigTimeout),
    // Enhanced hash routing
    enhancedHashRouting: mergedConfig.enhancedHashRouting,
  };

  return true;
}
