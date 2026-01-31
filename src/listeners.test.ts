import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setupModule = async (overrides: Partial<Record<string, any>> = {}) => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: {
      autoTrackPageview: true,
      autoTrackSpa: true,
      debounceDuration: 0,
      trackOutbound: true,
      ...overrides,
    },
  }));
  const track = vi.fn();
  vi.doMock("./core", () => ({ track }));
  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return {
      ...actual,
      log: vi.fn(),
      logError: vi.fn(),
      getPathname: vi.fn(() => (globalThis as any).__TEST_PATH__ || "/"),
      isOutboundLink: vi.fn((url: string) => url.includes("outbound")),
    };
  });
  const mod = await import("./listeners");
  return { ...mod, track };
};

describe("listeners", () => {
  beforeEach(() => {
    (globalThis as any).__TEST_PATH__ = "/start";
    document.body.innerHTML = "";
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => cb(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks pageview on setup and on SPA navigation", async () => {
    const { setupAutoTracking, cleanupAutoTracking, track } = await setupModule();

    setupAutoTracking();
    expect(track).toHaveBeenCalledWith("pageview");

    (globalThis as any).__TEST_PATH__ = "/next";
    history.pushState({}, "", "/next");

    expect(track).toHaveBeenCalledTimes(2);

    cleanupAutoTracking();
  });

  it("notifies page change callbacks", async () => {
    const { setupAutoTracking, addPageChangeCallback } = await setupModule();
    const cb = vi.fn();
    setupAutoTracking();
    addPageChangeCallback(cb);

    (globalThis as any).__TEST_PATH__ = "/next";
    window.dispatchEvent(new Event("hashchange"));

    expect(cb).toHaveBeenCalledWith("/next", "/start");
  });

  it("tracks data-attribute events and outbound links", async () => {
    const { setupDataAttributeTracking, track } = await setupModule();
    setupDataAttributeTracking();

    const button = document.createElement("button");
    button.setAttribute("data-rybbit-event", "signup");
    button.setAttribute("data-rybbit-prop-plan", "pro");
    button.textContent = "Sign up";
    document.body.appendChild(button);

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const link = document.createElement("a");
    link.href = "https://outbound.example.com";
    link.textContent = "Outbound";
    document.body.appendChild(link);

    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(track).toHaveBeenCalledWith("custom_event", {
      eventName: "signup",
      properties: { plan: "pro" },
    });
    expect(track).toHaveBeenCalledWith("outbound", {
      properties: expect.objectContaining({
        url: "https://outbound.example.com/",
      }),
    });
  });
});
