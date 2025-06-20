export interface RybbitConfig {
  analyticsHost: string;
  siteId: string;
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

export type PropertyValue = string | number | boolean;

export interface TrackProperties {
  [key: string]: PropertyValue | PropertyValue[];
}

export interface OutboundLinkProperties extends TrackProperties {
  url: string;
  text: string;
  target: string;
}

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
  init: (config: RybbitConfig) => void;
  pageview: (path?: string) => void;
  event: (name: string, properties?: TrackProperties) => void;
  outbound: (url: string, text?: string, target?: string) => void;
  identify: (userId: string) => void;
  clearUserId: () => void;
  getUserId: () => string | null;
  cleanup: () => void;
}
