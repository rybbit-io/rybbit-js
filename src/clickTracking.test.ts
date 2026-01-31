import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setupModule = async () => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: { trackButtonClicks: true },
  }));
  const track = vi.fn();
  vi.doMock("./core", () => ({ track }));
  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return { ...actual, log: vi.fn() };
  });
  const mod = await import("./clickTracking");
  return { ...mod, track };
};

describe("click tracking", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks button clicks with data attributes and text", async () => {
    const { setupClickTracking, cleanupClickTracking, track } = await setupModule();
    const button = document.createElement("button");
    button.textContent = "Sign up";
    button.setAttribute("data-rybbit-prop-plan", "pro");
    document.body.appendChild(button);

    setupClickTracking();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(track).toHaveBeenCalledWith("button_click", {
      properties: { plan: "pro", text: "Sign up" },
    });

    cleanupClickTracking();
  });

  it("skips elements marked with data-rybbit-event", async () => {
    const { setupClickTracking, track } = await setupModule();
    const button = document.createElement("button");
    button.setAttribute("data-rybbit-event", "custom");
    document.body.appendChild(button);

    setupClickTracking();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(track).not.toHaveBeenCalled();
  });

  it("tracks role=button elements", async () => {
    const { setupClickTracking, track } = await setupModule();
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    div.textContent = "CTA";
    document.body.appendChild(div);

    setupClickTracking();
    div.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(track).toHaveBeenCalled();
  });
});
