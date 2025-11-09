export interface RybbitConfig {
  // Required
  analyticsHost: string;
  siteId: string;

  // Local settings (not controlled by remote config)
  debounce?: number;
  skipPatterns?: string[];
  maskPatterns?: string[];
  debug?: boolean;

  // Session replay (local settings only - feature enabled via remote)
  replayBufferSize?: number;
  replayBatchInterval?: number;
  replayPrivacyConfig?: {
    maskAllInputs?: boolean;
    maskTextSelectors?: string[];
  };

  // Remote configuration
  enableRemoteConfig?: boolean;
  remoteConfigTimeout?: number;
}

// Internal config that includes remote-controlled settings
export interface InternalRybbitConfig extends RybbitConfig {
  // Remote-controlled settings (fetched from API)
  autoTrackPageviews: boolean;
  autoTrackSpaRoutes: boolean;
  trackQuerystring: boolean;
  trackOutboundLinks: boolean;
  trackWebVitals: boolean;
  captureErrors: boolean;
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
  outbound: (url: string, text?: string, target?: string) => void;
  identify: (userId: string) => void;
  clearUserId: () => void;
  getUserId: () => string | null;
  cleanup: () => void;
  captureError: (error: Error | ErrorEvent, context?: TrackProperties) => void;
  onPageChange: (callback: PageChangeCallback) => () => void;
  startSessionReplay: () => void;
  stopSessionReplay: () => void;
  isSessionReplayActive: () => boolean;
}
