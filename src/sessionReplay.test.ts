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

  it("never uses keepalive, so replay cannot exhaust the shared keepalive budget", async () => {
    const { onReplayPageChange, stopSessionReplay } = await setupModule();

    emit({ type: 3, data: { small: true }, timestamp: 1 });
    onReplayPageChange();
    emit({ type: 2, data: { snapshot: "x".repeat(100 * 1024) }, timestamp: 1 });
    stopSessionReplay();

    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [, init] of calls) {
      expect(init.keepalive).toBe(false);
    }
  });
});
