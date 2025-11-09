import { currentConfig } from "./config";
import { track } from "./core";
import { log, logError } from "./utils";
import { TrackProperties, ErrorData } from "./types";

let errorListener: ((event: ErrorEvent) => void) | null = null;
let rejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

export function setupErrorTracking(): void {
  if (!currentConfig.captureErrors) {
    return;
  }

  log("Setting up error tracking");

  errorListener = (event: ErrorEvent) => {
    handleError(event);
  };

  rejectionListener = (event: PromiseRejectionEvent) => {
    handleRejection(event);
  };

  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", rejectionListener);
}

export function cleanupErrorTracking(): void {
  if (errorListener) {
    window.removeEventListener("error", errorListener);
    errorListener = null;
  }
  if (rejectionListener) {
    window.removeEventListener("unhandledrejection", rejectionListener);
    rejectionListener = null;
  }
  log("Error tracking cleaned up");
}

function handleError(event: ErrorEvent): void {
  // Filter out third-party script errors (same-origin only)
  const currentOrigin = window.location.origin;
  const filename = event.filename || "";

  if (filename) {
    try {
      const fileUrl = new URL(filename);
      if (fileUrl.origin !== currentOrigin) {
        log("Skipping third-party error:", filename);
        return; // Skip third-party script errors
      }
    } catch (e) {
      // If filename is not a valid URL, continue to stack check
    }
  }

  // Fallback check using stack trace
  const errorStack = event.error?.stack || "";
  if (!filename && errorStack && !errorStack.includes(currentOrigin)) {
    log("Skipping third-party error based on stack trace");
    return;
  }

  const errorData: ErrorData = {
    message: (event.message || "Unknown error").substring(0, 500),
    stack: errorStack.substring(0, 2000),
    filename: filename || undefined,
    lineno: event.lineno || undefined,
    colno: event.colno || undefined,
    timestamp: Date.now(),
  };

  trackErrorData(event.error?.name || "Error", errorData);
}

function handleRejection(event: PromiseRejectionEvent): void {
  let message = "Unhandled promise rejection";
  let stack = "";

  // Extract error information from the rejection reason
  if (event.reason instanceof Error) {
    message = event.reason.message || message;
    stack = event.reason.stack || "";
  } else if (typeof event.reason === "string") {
    message = event.reason;
  } else if (event.reason && typeof event.reason === "object") {
    message = JSON.stringify(event.reason);
  }

  const errorData: ErrorData = {
    message: message.substring(0, 500),
    stack: stack.substring(0, 2000),
    timestamp: Date.now(),
  };

  trackErrorData("UnhandledRejection", errorData);
}

function trackErrorData(errorName: string, errorData: ErrorData, context?: TrackProperties): void {
  const properties: TrackProperties = {
    error_name: errorName,
    message: errorData.message,
    ...context,
  };

  if (errorData.stack) {
    properties.stack = errorData.stack;
  }
  if (errorData.filename) {
    properties.filename = errorData.filename;
  }
  if (errorData.lineno) {
    properties.line_number = errorData.lineno;
  }
  if (errorData.colno) {
    properties.column_number = errorData.colno;
  }

  track("error", {
    eventName: errorName,
    properties,
  });
}

export function captureError(error: Error | ErrorEvent, context?: TrackProperties): void {
  if (!currentConfig.captureErrors) {
    logError("Error tracking is not enabled. Set captureErrors: true in config.");
    return;
  }

  if (error instanceof ErrorEvent) {
    const errorData = {
      message: (error.message || "Unknown error").substring(0, 500),
      stack: (error.error?.stack || "").substring(0, 2000),
      filename: error.filename || undefined,
      lineno: error.lineno || undefined,
      colno: error.colno || undefined,
      timestamp: Date.now(),
    };
    trackErrorData(error.error?.name || "Error", errorData, context);
  } else {
    const errorData = {
      message: (error.message || "Unknown error").substring(0, 500),
      stack: (error.stack || "").substring(0, 2000),
      timestamp: Date.now(),
    };
    trackErrorData(error.name || "Error", errorData, context);
  }
}
