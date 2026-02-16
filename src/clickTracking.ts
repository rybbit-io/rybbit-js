import { currentConfig } from "./config";
import { track } from "./core";
import { log } from "./utils";
import { TrackProperties } from "./types";

let clickListener: ((event: MouseEvent) => void) | null = null;

export function setupClickTracking(): void {
  if (!currentConfig.trackButtonClicks) {
    return;
  }

  log("Setting up button click tracking");

  clickListener = (event: MouseEvent) => {
    handleClick(event);
  };

  document.addEventListener("click", clickListener, true);
}

export function cleanupClickTracking(): void {
  if (clickListener) {
    document.removeEventListener("click", clickListener, true);
    clickListener = null;
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!target) return;

  const buttonElement = findButton(target);
  if (!buttonElement) return;

  // Skip if button has custom event tracking
  if (buttonElement.hasAttribute("data-rybbit-event")) return;

  const properties: TrackProperties = {
    ...extractDataAttributes(buttonElement),
  };

  const text = getButtonText(buttonElement);
  if (text) {
    properties.text = text;
  }

  track("button_click", { properties });
}

function getButtonText(element: HTMLElement): string | undefined {
  const text = element.textContent?.trim().substring(0, 100);
  if (text) return text;

  const ariaLabel = element.getAttribute("aria-label")?.trim().substring(0, 100);
  if (ariaLabel) return ariaLabel;

  if (element.tagName === "INPUT") {
    const value = (element as HTMLInputElement).value?.trim().substring(0, 100);
    if (value) return value;
  }

  const title = element.getAttribute("title")?.trim().substring(0, 100);
  if (title) return title;

  return undefined;
}

function findButton(element: HTMLElement): HTMLElement | null {
  if (element.tagName === "BUTTON") return element;
  if (element.getAttribute("role") === "button") return element;
  if (element.tagName === "INPUT") {
    const type = (element as HTMLInputElement).type?.toLowerCase();
    if (type === "submit" || type === "button") return element;
  }

  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 3) {
    if (parent.tagName === "BUTTON") return parent;
    if (parent.getAttribute("role") === "button") return parent;
    parent = parent.parentElement;
    depth++;
  }

  return null;
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
