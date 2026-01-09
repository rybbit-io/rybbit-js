import { currentConfig } from "./config";
import { log, logError } from "./utils";

// Session replay types
interface SessionReplayEvent {
  type: number;
  data: any;
  timestamp: number;
}

interface SessionReplayBatch {
  userId: string;
  events: SessionReplayEvent[];
  metadata?: {
    pageUrl: string;
    viewportWidth?: number;
    viewportHeight?: number;
    language?: string;
  };
}

// rrweb types (from peer dependency)
type RrwebRecord = (options: {
  emit: (event: any) => void;
  checkoutEveryNms?: number;
  checkoutEveryNth?: number;
  blockClass?: string | RegExp;
  blockSelector?: string;
  ignoreClass?: string | RegExp;
  ignoreSelector?: string;
  maskTextClass?: string | RegExp;
  maskTextSelector?: string;
  maskAllInputs?: boolean;
  maskInputOptions?: Record<string, boolean>;
  slimDOMOptions?: Record<string, boolean> | boolean;
  sampling?: Record<string, any>;
  recordCanvas?: boolean;
  collectFonts?: boolean;
}) => () => void;

let rrwebRecord: RrwebRecord | null = null;
let isRecording = false;
let stopRecordingFn: (() => void) | null = null;
let eventBuffer: SessionReplayEvent[] = [];
let batchTimer: number | undefined;
let currentUserId: string | undefined;

export async function initSessionReplay(userId?: string): Promise<void> {
  if (!currentConfig.enableSessionReplay) {
    return;
  }

  currentUserId = userId;

  try {
    // Dynamically import rrweb from peer dependency
    const rrweb = await import("rrweb");
    rrwebRecord = rrweb.record as RrwebRecord;
    log("rrweb loaded successfully");
    startRecording();
  } catch (error) {
    logError("Failed to load rrweb. Make sure it's installed as a peer dependency:", error);
  }
}

function startRecording(): void {
  if (isRecording || !rrwebRecord || !currentConfig.enableSessionReplay) {
    return;
  }

  try {
    const privacyConfig = currentConfig.replayPrivacyConfig || {};

    // Default sampling configuration (matches analytics-script)
    const defaultSampling = {
      mousemove: false, // Don't record mouse moves
      mouseInteraction: {
        MouseUp: false,
        MouseDown: false,
        Click: true, // Only record clicks
        ContextMenu: false,
        DblClick: true,
        Focus: true,
        Blur: true,
        TouchStart: false,
        TouchEnd: false,
      },
      scroll: 500, // Sample scroll events every 500ms
      input: "last", // Only record the final input value
      media: 800, // Sample media interactions less frequently
    };

    // Default slimDOMOptions (matches analytics-script)
    const defaultSlimDOMOptions = {
      script: false,
      comment: true,
      headFavicon: true,
      headWhitespace: true,
      headMetaDescKeywords: true,
      headMetaSocial: true,
      headMetaRobots: true,
      headMetaHttpEquiv: true,
      headMetaAuthorship: true,
      headMetaVerification: true,
    };

    const recordingOptions: Parameters<RrwebRecord>[0] = {
      emit: (event: any) => {
        addEvent({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp || Date.now(),
        });
      },
      recordCanvas: false, // Always disabled to save disk space
      checkoutEveryNms: 60000, // Checkpoint every 60 seconds
      checkoutEveryNth: 500, // Checkpoint every 500 events
      // Use config values with fallbacks to defaults (matches analytics-script)
      blockClass: privacyConfig.blockClass ?? 'rr-block',
      blockSelector: privacyConfig.blockSelector ?? undefined,
      ignoreClass: privacyConfig.ignoreClass ?? 'rr-ignore',
      ignoreSelector: privacyConfig.ignoreSelector ?? undefined,
      maskTextClass: privacyConfig.maskTextClass ?? 'rr-mask',
      maskAllInputs: privacyConfig.maskAllInputs ?? true,
      maskInputOptions: { password: true, email: true },
      collectFonts: privacyConfig.collectFonts ?? true, // Matches analytics-script default
      sampling: defaultSampling,
      slimDOMOptions: privacyConfig.slimDOMOptions ?? defaultSlimDOMOptions,
    };

    // Add custom text masking selectors if configured
    if (privacyConfig.maskTextSelectors && privacyConfig.maskTextSelectors.length > 0) {
      recordingOptions.maskTextSelector = privacyConfig.maskTextSelectors.join(", ");
    }

    stopRecordingFn = rrwebRecord(recordingOptions);
    isRecording = true;
    setupBatchTimer();
    log("Session replay recording started");
  } catch (error) {
    logError("Failed to start session replay recording:", error);
  }
}

export function startSessionReplay(): void {
  if (!currentConfig.enableSessionReplay) {
    logError("Session replay is not enabled. Enable it via remote config.");
    return;
  }

  if (!rrwebRecord) {
    logError("rrweb is not loaded. Ensure it's installed as a peer dependency.");
    return;
  }

  if (isRecording) {
    log("Session replay is already recording");
    return;
  }

  startRecording();
}

export function stopSessionReplay(): void {
  if (!isRecording) {
    log("Session replay is not currently recording");
    return;
  }

  if (stopRecordingFn) {
    stopRecordingFn();
  }

  isRecording = false;
  clearBatchTimer();

  if (eventBuffer.length > 0) {
    flushEvents();
  }

  log("Session replay recording stopped");
}

export function isSessionReplayActive(): boolean {
  return isRecording;
}

function addEvent(event: SessionReplayEvent): void {
  eventBuffer.push(event);

  if (eventBuffer.length >= 250) {
    flushEvents();
  }
}

function setupBatchTimer(): void {
  clearBatchTimer();
  batchTimer = window.setInterval(() => {
    if (eventBuffer.length > 0) {
      flushEvents();
    }
  }, 5000);
}

function clearBatchTimer(): void {
  if (batchTimer !== undefined) {
    clearInterval(batchTimer);
    batchTimer = undefined;
  }
}

function flushEvents(): void {
  if (eventBuffer.length === 0) {
    return;
  }

  const events = [...eventBuffer];
  eventBuffer = [];

  const batch: SessionReplayBatch = {
    userId: currentUserId || "",
    events,
    metadata: {
      pageUrl: window.location.href,
      viewportWidth: screen.width,
      viewportHeight: screen.height,
      language: navigator.language,
    },
  };

  sendBatch(batch).catch((error) => {
    logError("Failed to send session replay batch:", error);
    // Re-queue the events for retry since this batch failed
    eventBuffer.unshift(...events);
  });
}

async function sendBatch(batch: SessionReplayBatch): Promise<void> {
  const endpoint = `${currentConfig.analyticsHost}/session-replay/record/${currentConfig.siteId}`;
  const data = JSON.stringify(batch);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: data,
    mode: "cors",
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error(`Failed to send replay batch: ${response.status}`);
  }

  log(`Session replay batch sent: ${batch.events.length} events`);
}

export function updateReplayUserId(userId: string | undefined): void {
  currentUserId = userId;
}

export function onReplayPageChange(): void {
  if (isRecording && eventBuffer.length > 0) {
    flushEvents();
  }
}

export function cleanupSessionReplay(): void {
  stopSessionReplay();
}
