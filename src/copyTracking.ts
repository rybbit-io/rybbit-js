import { currentConfig } from "./config";
import { track } from "./core";
import { log } from "./utils";
import { TrackProperties } from "./types";

let copyListener: (() => void) | null = null;

export function setupCopyTracking(): void {
  if (!currentConfig.trackCopy) {
    return;
  }

  log("Setting up copy tracking");

  copyListener = () => {
    handleCopy();
  };

  document.addEventListener("copy", copyListener);
}

export function cleanupCopyTracking(): void {
  if (copyListener) {
    document.removeEventListener("copy", copyListener);
    copyListener = null;
  }
}

function handleCopy(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString();
  const textLength = text.length;

  if (textLength === 0) return;

  const anchorNode = selection.anchorNode;
  const sourceElement =
    anchorNode instanceof HTMLElement
      ? anchorNode
      : anchorNode?.parentElement;

  if (!sourceElement) return;

  const properties: TrackProperties = {
    text: text.substring(0, 500),
    ...(textLength > 500 && { textLength }),
    sourceElement: sourceElement.tagName.toLowerCase(),
  };

  track("copy", { properties });
}
