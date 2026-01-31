import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setupModule = async () => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: { trackCopy: true },
  }));
  const track = vi.fn();
  vi.doMock("./core", () => ({ track }));
  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return { ...actual, log: vi.fn() };
  });
  const mod = await import("./copyTracking");
  return { ...mod, track };
};

describe("copy tracking", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks non-empty selections", async () => {
    const { setupCopyTracking, cleanupCopyTracking, track } = await setupModule();
    const paragraph = document.createElement("p");
    paragraph.textContent = "Hello world";
    document.body.appendChild(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    setupCopyTracking();
    document.dispatchEvent(new Event("copy", { bubbles: true }));

    expect(track).toHaveBeenCalledWith("copy", {
      properties: {
        text: "Hello world",
        sourceElement: "p",
      },
    });

    cleanupCopyTracking();
  });
});
