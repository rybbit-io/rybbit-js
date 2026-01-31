import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const loadConfigModule = async () => {
  vi.resetModules();
  return await import("./config");
};

describe("initializeConfig", () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with remote config values and trims host", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trackInitialPageView: false,
        trackSpaNavigation: false,
        trackUrlParams: false,
        trackOutbound: true,
        webVitals: true,
        trackErrors: true,
        sessionReplay: true,
        trackButtonClicks: true,
        trackCopy: true,
        trackFormInteractions: true,
      }),
    });

    const { initializeConfig, currentConfig } = await loadConfigModule();
    const result = await initializeConfig({
      analyticsHost: "https://analytics.example.com/",
      siteId: "site-123",
      debounceDuration: 250,
      skipPatterns: ["re:^/health$"],
      maskPatterns: ["/users/*"],
      debug: true,
    });

    expect(result).toBe(true);
    expect(currentConfig.analyticsHost).toBe("https://analytics.example.com");
    expect(currentConfig.siteId).toBe("site-123");
    expect(currentConfig.debounceDuration).toBe(250);
    expect(currentConfig.skipPatterns).toEqual(["re:^/health$"]);
    expect(currentConfig.maskPatterns).toEqual(["/users/*"]);
    expect(currentConfig.autoTrackPageview).toBe(false);
    expect(currentConfig.autoTrackSpa).toBe(false);
    expect(currentConfig.trackQuerystring).toBe(false);
    expect(currentConfig.trackOutbound).toBe(true);
    expect(currentConfig.enableWebVitals).toBe(true);
    expect(currentConfig.trackErrors).toBe(true);
    expect(currentConfig.enableSessionReplay).toBe(true);
    expect(currentConfig.trackButtonClicks).toBe(true);
    expect(currentConfig.trackCopy).toBe(true);
    expect(currentConfig.trackFormInteractions).toBe(true);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://analytics.example.com/site/tracking-config/site-123",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("uses defaults when remote config fails", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

    const { initializeConfig, currentConfig } = await loadConfigModule();
    const result = await initializeConfig({
      analyticsHost: "https://analytics.example.com",
      siteId: "site-123",
    });

    expect(result).toBe(true);
    expect(currentConfig.autoTrackPageview).toBe(true);
    expect(currentConfig.autoTrackSpa).toBe(true);
    expect(currentConfig.trackQuerystring).toBe(true);
    expect(currentConfig.trackOutbound).toBe(true);
    expect(currentConfig.enableWebVitals).toBe(false);
    expect(currentConfig.trackErrors).toBe(false);
    expect(currentConfig.enableSessionReplay).toBe(false);
  });

  it("uses defaults when remote config throws", async () => {
    (globalThis.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const { initializeConfig, currentConfig } = await loadConfigModule();
    const result = await initializeConfig({
      analyticsHost: "https://analytics.example.com",
      siteId: "site-123",
    });

    expect(result).toBe(true);
    expect(currentConfig.autoTrackPageview).toBe(true);
    expect(currentConfig.enableWebVitals).toBe(false);
  });

  it("uses defaults when remote config aborts", async () => {
    (globalThis.fetch as any).mockRejectedValueOnce({ name: "AbortError" });

    const { initializeConfig, currentConfig } = await loadConfigModule();
    const result = await initializeConfig({
      analyticsHost: "https://analytics.example.com",
      siteId: "site-123",
    });

    expect(result).toBe(true);
    expect(currentConfig.autoTrackPageview).toBe(true);
    expect(currentConfig.enableSessionReplay).toBe(false);
  });

  it("rejects invalid options", async () => {
    const { initializeConfig } = await loadConfigModule();
    // @ts-expect-error intentional invalid input
    const result = await initializeConfig(null);
    expect(result).toBe(false);
  });

  it("requires analyticsHost and siteId", async () => {
    const { initializeConfig } = await loadConfigModule();
    // @ts-expect-error missing analyticsHost
    expect(await initializeConfig({ siteId: "site-123" })).toBe(false);
    // @ts-expect-error missing siteId
    expect(await initializeConfig({ analyticsHost: "https://analytics.example.com" })).toBe(false);
  });

  it("prevents re-initialization", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { initializeConfig } = await loadConfigModule();
    expect(
      await initializeConfig({
        analyticsHost: "https://analytics.example.com",
        siteId: "site-123",
      })
    ).toBe(true);
    expect(
      await initializeConfig({
        analyticsHost: "https://analytics.example.com",
        siteId: "site-456",
      })
    ).toBe(false);
  });

  it("normalizes debounce duration and pattern inputs", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { initializeConfig, currentConfig } = await loadConfigModule();
    const result = await initializeConfig({
      analyticsHost: "https://analytics.example.com",
      siteId: "site-123",
      debounceDuration: -10,
      // @ts-expect-error non-array value
      skipPatterns: "not-an-array",
      // @ts-expect-error non-array value
      maskPatterns: "not-an-array",
    });

    expect(result).toBe(true);
    expect(currentConfig.debounceDuration).toBe(0);
    expect(currentConfig.skipPatterns).toEqual([]);
    expect(currentConfig.maskPatterns).toEqual([]);
  });
});
