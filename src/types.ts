export interface RybbitConfig {
  // Required
  analyticsHost: string;
  siteId: string;

  // Local settings (not controlled by remote config)
  debounceDuration?: number;
  skipPatterns?: string[];
  maskPatterns?: string[];
  debug?: boolean;

  // Session replay (local settings only - feature enabled via remote)
  replayPrivacyConfig?: {
    maskAllInputs?: boolean;
    maskTextSelectors?: string[];
    blockClass?: string;
    blockSelector?: string;
    ignoreClass?: string;
    ignoreSelector?: string;
    maskTextClass?: string;
    collectFonts?: boolean;
    slimDOMOptions?: Record<string, boolean> | boolean;
    batchSize?: number;
    batchInterval?: number;
  };
}

// Internal config that includes remote-controlled settings
export interface InternalRybbitConfig extends RybbitConfig {
  // Remote-controlled settings (fetched from API)
  autoTrackPageview: boolean;
  autoTrackSpa: boolean;
  trackQuerystring: boolean;
  trackOutbound: boolean;
  enableWebVitals: boolean;
  trackErrors: boolean;
  enableSessionReplay: boolean;
}

export type EventType = "pageview" | "custom_event" | "outbound" | "performance" | "error";

export type PropertyValue = string | number | boolean;

export interface TrackProperties {
  [key: string]: PropertyValue | PropertyValue[];
}

export interface OutboundLinkProperties extends TrackProperties {
  url: string;
  text: string;
  target: string;
}

export interface ErrorData {
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

export type PageChangeCallback = (pathname: string, previousPathname: string) => void;

export interface WebVitalsData {
  lcp?: number | null;
  cls?: number | null;
  inp?: number | null;
  fcp?: number | null;
  ttfb?: number | null;
}

export interface TrackPayload extends WebVitalsData {
  site_id: string;
  hostname: string;
  pathname: string;
  querystring: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  page_title: string;
  referrer: string;
  type: EventType;
  event_name?: string; // Only for custom_event and performance
  properties?: string; // JSON stringified for custom_event and outbound
  user_id?: string;
}

export interface RybbitAPI {
  init: (config: RybbitConfig) => Promise<void>;
  pageview: (path?: string) => void;
  event: (name: string, properties?: TrackProperties) => void;
  trackOutbound: (url: string, text?: string, target?: string) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  setTraits: (traits: Record<string, unknown>) => void;
  clearUserId: () => void;
  getUserId: () => string | null;
  cleanup: () => void;
  error: (error: Error | ErrorEvent, context?: TrackProperties) => void;
  onPageChange: (callback: PageChangeCallback) => () => void;
  startSessionReplay: () => void;
  stopSessionReplay: () => void;
  isSessionReplayActive: () => boolean;
}
