import { RybbitConfig } from "./types";
import { logError } from "./utils";

const defaultConfig: Required<Omit<RybbitConfig, "analyticsHost" | "siteId">> =
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

export function initializeConfig(options: RybbitConfig): boolean {
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
  if (!analyticsHost) {
    logError(
      "`analyticsHost` is required in Rybbit config and must be a string."
    );
    return false;
  }
  const finalAnalyticsHost = analyticsHost.replace(/\/$/, "");

  const siteId = userConfigInput.siteId;
  if (siteId === undefined || siteId === null || String(siteId).trim() === "") {
    logError(
      "`siteId` is required in Rybbit config and must be a non-empty string or number."
    );
    return false;
  }
  const finalSiteId = String(siteId);

  const validatedSkipPatterns = Array.isArray(userConfigInput.skipPatterns)
    ? userConfigInput.skipPatterns
    : defaultConfig.skipPatterns;
  const validatedMaskPatterns = Array.isArray(userConfigInput.maskPatterns)
    ? userConfigInput.maskPatterns
    : defaultConfig.maskPatterns;

  internalConfig = {
    analyticsHost: finalAnalyticsHost,
    siteId: finalSiteId,
    debounce: Math.max(0, userConfigInput.debounce ?? defaultConfig.debounce),
    autoTrackPageviews:
      userConfigInput.autoTrackPageviews ?? defaultConfig.autoTrackPageviews,
    autoTrackSpaRoutes:
      userConfigInput.autoTrackSpaRoutes ?? defaultConfig.autoTrackSpaRoutes,
    trackQuerystring:
      userConfigInput.trackQuerystring ?? defaultConfig.trackQuerystring,
    trackOutboundLinks:
      userConfigInput.trackOutboundLinks ?? defaultConfig.trackOutboundLinks,
    trackHashRoutes:
      userConfigInput.trackHashRoutes ?? defaultConfig.trackHashRoutes,
    trackDataAttributes:
      userConfigInput.trackDataAttributes ?? defaultConfig.trackDataAttributes,
    trackWebVitals:
      userConfigInput.trackWebVitals ?? defaultConfig.trackWebVitals,
    webVitalsTimeout: Math.max(
      1000,
      userConfigInput.webVitalsTimeout ?? defaultConfig.webVitalsTimeout
    ),
    skipPatterns: validatedSkipPatterns,
    maskPatterns: validatedMaskPatterns,
    debug: userConfigInput.debug ?? defaultConfig.debug,
  };

  return true;
}
