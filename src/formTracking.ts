import { currentConfig } from "./config";
import { track } from "./core";
import { log } from "./utils";
import { TrackProperties } from "./types";

let submitListener: ((event: Event) => void) | null = null;
let changeListener: ((event: Event) => void) | null = null;

export function setupFormTracking(): void {
  if (!currentConfig.trackFormInteractions) {
    return;
  }

  log("Setting up form tracking");

  submitListener = (event: Event) => {
    handleSubmit(event);
  };

  changeListener = (event: Event) => {
    handleChange(event);
  };

  document.addEventListener("submit", submitListener, true);
  document.addEventListener("change", changeListener, true);
}

export function cleanupFormTracking(): void {
  if (submitListener) {
    document.removeEventListener("submit", submitListener, true);
    submitListener = null;
  }
  if (changeListener) {
    document.removeEventListener("change", changeListener, true);
    changeListener = null;
  }
}

function handleSubmit(event: Event): void {
  const form = event.target as HTMLFormElement;
  if (form.tagName !== "FORM") return;

  const properties: TrackProperties = {
    formId: form.id || "",
    formName: form.name || "",
    formAction: form.getAttribute("action") || "",
    method: (form.method || "get").toUpperCase(),
    fieldCount: form.elements.length,
    ...extractDataAttributes(form),
  };

  track("form_submit", { properties });
}

function handleChange(event: Event): void {
  const target = event.target as HTMLElement;
  const tagName = target.tagName.toUpperCase();

  if (!["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;

  // Skip hidden inputs and password fields for privacy
  if (tagName === "INPUT") {
    const inputType = (target as HTMLInputElement).type?.toLowerCase();
    if (inputType === "hidden" || inputType === "password") return;
  }

  const properties: TrackProperties = {
    element: tagName.toLowerCase(),
    inputName: (target as HTMLInputElement).name || target.id || "",
    ...extractDataAttributes(target),
  };

  if (tagName === "INPUT") {
    properties.inputType = (target as HTMLInputElement).type?.toLowerCase();
  }

  const formId = (target as HTMLInputElement).form?.id;
  if (formId) {
    properties.formId = formId;
  }

  track("input_change", { properties });
}

function extractDataAttributes(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith("data-rybbit-prop-")) {
      const key = attr.name.replace("data-rybbit-prop-", "");
      attrs[key] = attr.value;
    }
  }
  return attrs;
}
