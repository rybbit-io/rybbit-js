export interface RybbitConfig {
  analyticsHost: string;
  siteId: string | number;
  debounce?: number;
  autoTrackPageviews?: boolean;
  autoTrackSpaRoutes?: boolean;
  trackQuerystring?: boolean;
  trackOutboundLinks?: boolean;
  skipPatterns?: string[];
  maskPatterns?: string[];
  debug?: boolean;
}

export type EventType = "pageview" | "custom_event" | "outbound";

export interface TrackProperties {
  [key: string]: any;
}

export interface OutboundLinkProperties extends TrackProperties {
  url: string;
  text: string;
  target: string;
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
  event_name?: string; // Only for custom_event
  properties?: string; // JSON stringified for custom_event and outbound
}

export interface RybbitAPI {
  init: (config: RybbitConfig) => void;
  pageview: (path?: string) => void;
  event: (name: string, properties?: TrackProperties) => void;
  trackOutboundLink: (
    url: string,
    text?: string,
    target?: string
  ) => void;
}
