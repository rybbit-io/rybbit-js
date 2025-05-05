import { RybbitConfig } from "./types";
import { logError } from "./utils";

const defaultConfig: Required<Omit<RybbitConfig, "analyticsHost" | "siteId">> = {
  debounce: 500,
  autoTrackPageviews: true,
  autoTrackSpaRoutes: true,
  trackQuerystring: true,
  trackOutboundLinks: true,
  skipPatterns: [],
  maskPatterns: [],
  debug: false,
};

let internalConfig: RybbitConfig | null = null;

export const currentConfig: Readonly<RybbitConfig> = new Proxy({} as RybbitConfig, {
  get: (_, prop: keyof RybbitConfig) => {
    if (!internalConfig) {
      if (prop !== "debug") {
        logError("Rybbit SDK accessed before initialization. Call rybbit.init() first.");
      }
      return defaultConfig[prop as keyof typeof defaultConfig] ?? undefined;
    }
    return internalConfig[prop];
  },
  set: () => {
    logError("Rybbit config is read-only after initialization.");
    return false;
  }
});


export function initializeConfig(options: RybbitConfig | string, siteIdParam?: string | number): boolean {
  if (internalConfig) {
    logError("Rybbit SDK already initialized.");
    return false;
  }

  let userConfigInput: Partial<RybbitConfig>;

  if (typeof options === "string") {
    if (!siteIdParam) {
      logError("`siteId` is required when providing `analyticsHost` as the first argument to init.");
      return false;
    }
    userConfigInput = { analyticsHost: options, siteId: siteIdParam };
  } else if (typeof options === "object" && options !== null) {
    userConfigInput = options;
  } else {
    logError("Invalid configuration provided to rybbit.init(). Provide an object or (analyticsHost, siteId).");
    return false;
  }

  const analyticsHost = userConfigInput.analyticsHost;
  if (!analyticsHost) {
    logError("`analyticsHost` is required in Rybbit config and must be a string.");
    return false;
  }
  const finalAnalyticsHost = analyticsHost.replace(/\/$/, "");

  const siteId = userConfigInput.siteId;
  if (siteId === undefined || siteId === null || String(siteId).trim() === "") {
    logError("`siteId` is required in Rybbit config and must be a non-empty string or number.");
    return false;
  }
  const finalSiteId = String(siteId);

  const validatedSkipPatterns = (Array.isArray(userConfigInput.skipPatterns)
    ? userConfigInput.skipPatterns : defaultConfig.skipPatterns);
  const validatedMaskPatterns = (Array.isArray(userConfigInput.maskPatterns)
    ? userConfigInput.maskPatterns : defaultConfig.maskPatterns);

  internalConfig = {
    analyticsHost: finalAnalyticsHost,
    siteId: finalSiteId,

    debounce: Math.max(0, userConfigInput.debounce ?? defaultConfig.debounce),
    autoTrackPageviews: userConfigInput.autoTrackPageviews ?? defaultConfig.autoTrackPageviews,
    autoTrackSpaRoutes: userConfigInput.autoTrackSpaRoutes ?? defaultConfig.autoTrackSpaRoutes,
    trackQuerystring: userConfigInput.trackQuerystring ?? defaultConfig.trackQuerystring,
    trackOutboundLinks: userConfigInput.trackOutboundLinks ?? defaultConfig.trackOutboundLinks,
    debug: userConfigInput.debug ?? defaultConfig.debug,
    skipPatterns: validatedSkipPatterns,
    maskPatterns: validatedMaskPatterns,
  };

  return true;
}
