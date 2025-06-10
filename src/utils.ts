import { currentConfig } from "./config";

export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  } as T;
}

export function isOutboundLink(url: string): boolean {
  try {
    const currentHost = window.location.hostname;
    const linkHost = new URL(url, window.location.href).hostname;
    return !!linkHost && linkHost !== currentHost;
  } catch (e) {
    return false;
  }
}

export function patternToRegex(pattern: string): RegExp | null {
  try {
    const DOUBLE_WILDCARD_TOKEN = "__DOUBLE_ASTERISK_TOKEN__";
    const SINGLE_WILDCARD_TOKEN = "__SINGLE_ASTERISK_TOKEN__";

    let tokenized = pattern
      .replace(/\*\*/g, DOUBLE_WILDCARD_TOKEN)
      .replace(/\*/g, SINGLE_WILDCARD_TOKEN);

    let escaped = tokenized.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    escaped = escaped.replace(/\//g, "\\/");

    let regexPattern = escaped
      .replace(new RegExp(DOUBLE_WILDCARD_TOKEN, "g"), ".*")
      .replace(new RegExp(SINGLE_WILDCARD_TOKEN, "g"), "[^/]+");

    return new RegExp("^" + regexPattern + "$");
  } catch (e) {
    logError(`Invalid pattern: ${pattern}`, e);
    return null;
  }
}

export function findMatchingPattern(path: string, patterns: string[] = []): string | null {
  if (!patterns || patterns.length === 0) {
    return null;
  }
  for (const pattern of patterns) {
    const regex = patternToRegex(pattern);
    if (regex && regex.test(path)) {
      return pattern;
    }
  }
  return null;
}

export function log(...args: any[]): void {
  if (currentConfig.debug) {
    console.log("[Rybbit]", ...args);
  }
}

export function logError(...args: any[]): void {
  console.error("[Rybbit Error]", ...args);
}

export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // localStorage not available, ignore
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // localStorage not available, ignore
  }
}

export function getCurrentPathname(): string {
  const url = new URL(window.location.href);
  let pathname = url.pathname;

  if (url.hash && url.hash.startsWith("#/")) {
    pathname = url.hash.substring(1);
  }

  return pathname;
}
