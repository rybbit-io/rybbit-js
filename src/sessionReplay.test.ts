import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let emit: (event: any) => void;

const setupModule = async () => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: {
      analyticsHost: "https://analytics.example.com",
      siteId: "site-123",
      enableSessionReplay: true,
      debug: false,
    },
  }));

  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return {
      ...actual,
      log: vi.fn(),
      logError: vi.fn(),
    };
  });

  vi.doMock("rrweb", () => ({
    record: (options: { emit: (event: any) => void }) => {
      emit = options.emit;
      return vi.fn();
    },
  }));

  const mod = await import("./sessionReplay");
  await mod.initSessionReplay("user-1");
  return mod;
};

describe("session replay", () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses keepalive for batches under the browser keepalive limit", async () => {
    const { stopSessionReplay } = await setupModule();

    emit({ type: 3, data: { small: true }, timestamp: 1 });
    stopSessionReplay();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(init.keepalive).toBe(true);
  });

  it("does not use keepalive for batches over the 64 KiB keepalive limit", async () => {
    const { stopSessionReplay } = await setupModule();

    emit({ type: 2, data: { snapshot: "x".repeat(100 * 1024) }, timestamp: 1 });
    stopSessionReplay();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(init.keepalive).toBe(false);
  });
});
