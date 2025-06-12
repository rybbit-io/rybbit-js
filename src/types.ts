export interface RybbitConfig {
  analyticsHost: string;
  siteId: string | number;
  debounce?: number;
  autoTrackPageviews?: boolean;
  autoTrackSpaRoutes?: boolean;
  trackQuerystring?: boolean;
  trackOutboundLinks?: boolean;
  trackHashRoutes?: boolean;
  trackDataAttributes?: boolean;
  trackWebVitals?: boolean;
  webVitalsTimeout?: number;
  skipPatterns?: string[];
  maskPatterns?: string[];
  debug?: boolean;
}

export type EventType = "pageview" | "custom_event" | "outbound" | "performance";

export interface TrackProperties {
  [key: string]: any;
}

export interface OutboundLinkProperties extends TrackProperties {
  url: string;
  text: string;
  target: string;
}

export interface WebVitalsData {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  ttfb: number | null;
}

export interface TrackPayload {
  site_id: string | number;
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
  lcp?: number | null;
  cls?: number | null;
  inp?: number | null;
  fcp?: number | null;
  ttfb?: number | null;
}

export interface RybbitAPI {
  init: (config: RybbitConfig) => void;
  pageview: (path?: string) => void;
  event: (name: string, properties?: TrackProperties) => void;
  outbound: (url: string, text?: string, target?: string) => void;
  identify: (userId: string) => void;
  clearUserId: () => void;
  getUserId: () => string | null;
  cleanup: () => void;
}
