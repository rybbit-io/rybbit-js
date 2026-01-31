import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const makeConfig = (overrides: Partial<Record<string, any>> = {}) => ({
  analyticsHost: "https://analytics.example.com",
  siteId: "site-123",
  trackQuerystring: true,
  skipPatterns: [],
  maskPatterns: [],
  debug: false,
  ...overrides,
});

const setupModule = async (configOverrides: Partial<Record<string, any>> = {}) => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: makeConfig(configOverrides),
  }));

  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return {
      ...actual,
      log: vi.fn(),
      logError: vi.fn(),
    };
  });

  return await import("./core");
};

describe("core tracking", () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });
    localStorage.clear();
    document.title = "Test Page";
    Object.defineProperty(document, "referrer", { value: "https://referrer.example.com", configurable: true });
    window.history.pushState({}, "", "/path?x=1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips tracking when opted out via localStorage", async () => {
    localStorage.setItem("disable-rybbit", "1");
    const { track } = await setupModule();

    track("pageview");

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("errors when config is missing", async () => {
    const { track } = await setupModule({ analyticsHost: "", siteId: "" });

    track("pageview");

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("requires event name for custom events", async () => {
    const { track } = await setupModule();

    track("custom_event");

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("respects skip patterns for non-performance events", async () => {
    const { track } = await setupModule({ skipPatterns: ["/path"] });

    track("pageview");

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("masks path and clears querystring", async () => {
    window.history.pushState({}, "", "/masked?secret=123");
    const { track } = await setupModule({ maskPatterns: ["/masked"] });

    track("pageview");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.pathname).toBe("/masked");
    expect(body.querystring).toBe("");
  });

  it("handles valid path override for pageview", async () => {
    const { track } = await setupModule();

    track("pageview", { pathOverride: "/override/path?y=2" });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.pathname).toBe("/override/path");
    expect(body.querystring).toBe("?y=2");
  });

  it("falls back to window location for invalid path override", async () => {
    const { track } = await setupModule();

    track("pageview", { pathOverride: "::::" });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.pathname).toBe("/path");
    expect(body.querystring).toBe("?x=1");
  });

  it("uses sendBeacon when available", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    const { track } = await setupModule();

    track("pageview");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon fails", async () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    const { track } = await setupModule();

    track("pageview");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("includes event properties for custom events", async () => {
    const { track } = await setupModule();

    track("custom_event", { eventName: "signup", properties: { plan: "pro" } });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.event_name).toBe("signup");
    expect(body.properties).toBe(JSON.stringify({ plan: "pro" }));
  });
});

describe("identity helpers", () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("identify stores user and sends identify event", async () => {
    const { identify, getUserId } = await setupModule();

    identify(" user-1 ", { plan: "pro" });

    expect(getUserId()).toBe("user-1");
    expect(localStorage.getItem("rybbit-user-id")).toBe("user-1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe("https://analytics.example.com/identify");
  });

  it("setTraits requires identify first", async () => {
    const { setTraits } = await setupModule();

    setTraits({ plan: "pro" });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("setTraits sends identify with is_new_identify false", async () => {
    const { identify, setTraits } = await setupModule();

    identify("user-2");
    (globalThis.fetch as any).mockClear();
    setTraits({ plan: "pro" });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.is_new_identify).toBe(false);
    expect(body.traits).toEqual({ plan: "pro" });
  });

  it("clearUserId removes localStorage", async () => {
    const { identify, clearUserId, getUserId } = await setupModule();

    identify("user-3");
    clearUserId();

    expect(getUserId()).toBeNull();
    expect(localStorage.getItem("rybbit-user-id")).toBeNull();
  });
});
