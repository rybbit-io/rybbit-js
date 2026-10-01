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

  it("drops a batch the server rejects with a non-retryable status", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false, status: 413 });
    const { onReplayPageChange } = await setupModule();

    emit({ type: 2, data: {}, timestamp: 1 });
    onReplayPageChange();
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    onReplayPageChange();
    await new Promise((resolve) => setTimeout(resolve));
    onReplayPageChange();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a failed batch at most three times", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false, status: 503 });
    const { onReplayPageChange } = await setupModule();

    emit({ type: 2, data: {}, timestamp: 1 });
    for (let i = 0; i < 5; i++) {
      onReplayPageChange();
      await new Promise((resolve) => setTimeout(resolve));
    }

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it("retries a batch after a network error", async () => {
    (globalThis.fetch as any)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ ok: true });
    const { onReplayPageChange } = await setupModule();

    emit({ type: 2, data: {}, timestamp: 1 });
    onReplayPageChange();
    await new Promise((resolve) => setTimeout(resolve));
    onReplayPageChange();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const [, init] = (globalThis.fetch as any).mock.calls[1];
    expect(JSON.parse(init.body).events).toHaveLength(1);
  });
});
