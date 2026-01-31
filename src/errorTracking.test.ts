import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Polyfill PromiseRejectionEvent for jsdom
if (typeof globalThis.PromiseRejectionEvent === "undefined") {
  (globalThis as any).PromiseRejectionEvent = class PromiseRejectionEvent extends Event {
    reason: any;
    promise: Promise<any>;
    constructor(type: string, init: { reason?: any; promise?: Promise<any> }) {
      super(type);
      this.reason = init?.reason;
      this.promise = init?.promise ?? Promise.resolve();
    }
  };
}

const setupModule = async (trackErrors = true) => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: { trackErrors },
  }));
  const track = vi.fn();
  vi.doMock("./core", () => ({ track }));
  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return { ...actual, log: vi.fn(), logError: vi.fn() };
  });
  const mod = await import("./errorTracking");
  return { ...mod, track };
};

describe("error tracking", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not set up listeners when disabled", async () => {
    const { setupErrorTracking, track } = await setupModule(false);
    setupErrorTracking();

    window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));

    expect(track).not.toHaveBeenCalled();
  });

  it("tracks same-origin errors", async () => {
    const { setupErrorTracking, cleanupErrorTracking, track } = await setupModule(true);
    setupErrorTracking();

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "boom",
        filename: window.location.origin + "/app.js",
        error: new Error("boom"),
      })
    );

    expect(track).toHaveBeenCalledWith("error", expect.objectContaining({ eventName: "Error" }));

    cleanupErrorTracking();
  });

  it("skips third-party script errors", async () => {
    const { setupErrorTracking, track } = await setupModule(true);
    setupErrorTracking();

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "boom",
        filename: "https://cdn.example.com/app.js",
        error: new Error("boom"),
      })
    );

    expect(track).not.toHaveBeenCalled();
  });

  it("tracks unhandled rejections", async () => {
    const { setupErrorTracking, track } = await setupModule(true);
    setupErrorTracking();

    const rejection = new PromiseRejectionEvent("unhandledrejection", {
      reason: new Error("nope"),
      promise: Promise.resolve(),
    });
    window.dispatchEvent(rejection);

    expect(track).toHaveBeenCalledWith("error", expect.objectContaining({ eventName: "UnhandledRejection" }));
  });

  it("captureError respects disabled state", async () => {
    const { captureError, track } = await setupModule(false);

    captureError(new Error("nope"));

    expect(track).not.toHaveBeenCalled();
  });

  it("captureError sends error properties", async () => {
    const { captureError, track } = await setupModule(true);

    captureError(new Error("nope"), { context: "test" });

    expect(track).toHaveBeenCalledWith("error", {
      eventName: "Error",
      properties: expect.objectContaining({
        error_name: "Error",
        message: "nope",
        context: "test",
      }),
    });
  });
});
