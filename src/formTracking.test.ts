import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setupModule = async () => {
  vi.resetModules();
  vi.doMock("./config", () => ({
    currentConfig: { trackFormInteractions: true },
  }));
  const track = vi.fn();
  vi.doMock("./core", () => ({ track }));
  vi.doMock("./utils", async () => {
    const actual = await vi.importActual<typeof import("./utils")>("./utils");
    return { ...actual, log: vi.fn() };
  });
  const mod = await import("./formTracking");
  return { ...mod, track };
};

describe("form tracking", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks form submissions", async () => {
    const { setupFormTracking, cleanupFormTracking, track } = await setupModule();
    const form = document.createElement("form");
    form.id = "signup";
    form.name = "signup-form";
    form.action = "/submit";
    form.method = "post";
    form.setAttribute("data-rybbit-prop-source", "landing");
    const input = document.createElement("input");
    input.name = "email";
    form.appendChild(input);
    document.body.appendChild(form);

    setupFormTracking();
    form.dispatchEvent(new Event("submit", { bubbles: true }));

    expect(track).toHaveBeenCalledWith("form_submit", {
      properties: expect.objectContaining({
        formId: "signup",
        formName: "signup-form",
        formAction: "/submit",
        method: "POST",
        fieldCount: 1,
        source: "landing",
      }),
    });

    cleanupFormTracking();
  });

  it("tracks input changes and skips hidden/password inputs", async () => {
    const { setupFormTracking, track } = await setupModule();
    const form = document.createElement("form");
    form.id = "signup";
    const visible = document.createElement("input");
    visible.name = "email";
    visible.type = "email";
    visible.setAttribute("data-rybbit-prop-field", "email");
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    const password = document.createElement("input");
    password.type = "password";
    form.appendChild(visible);
    form.appendChild(hidden);
    form.appendChild(password);
    document.body.appendChild(form);

    setupFormTracking();
    visible.dispatchEvent(new Event("change", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
    password.dispatchEvent(new Event("change", { bubbles: true }));

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("input_change", {
      properties: {
        element: "input",
        inputName: "email",
        inputType: "email",
        formId: "signup",
        field: "email",
      },
    });
  });
});
