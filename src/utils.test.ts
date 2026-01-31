import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  debounce,
  findMatchingPattern,
  getPathname,
  isOutboundLink,
  patternToRegex,
} from "./utils";

describe("patternToRegex", () => {
  it("matches single wildcard segments", () => {
    const regex = patternToRegex("/api/*/users");
    expect(regex?.test("/api/v1/users")).toBe(true);
    expect(regex?.test("/api/v2/users")).toBe(true);
    expect(regex?.test("/api/v1/v2/users")).toBe(false);
  });

  it("matches double wildcard segments", () => {
    const regex = patternToRegex("/api/**/users");
    expect(regex?.test("/api/v1/users")).toBe(true);
    expect(regex?.test("/api/v1/v2/users")).toBe(true);
    expect(regex?.test("/api/users")).toBe(true);
  });

  it("escapes special regex characters", () => {
    const regex = patternToRegex("/api/users.json");
    expect(regex?.test("/api/users.json")).toBe(true);
    expect(regex?.test("/api/usersXjson")).toBe(false);
  });

  it("supports regex prefix patterns", () => {
    const regex = patternToRegex("re:^/users/\\d+$");
    expect(regex?.test("/users/123")).toBe(true);
    expect(regex?.test("/users/abc")).toBe(false);
  });

  it("returns null for empty regex prefix", () => {
    const regex = patternToRegex("re:");
    expect(regex).toBeNull();
  });

  it("returns null for invalid regex", () => {
    const regex = patternToRegex("re:(");
    expect(regex).toBeNull();
  });
});

describe("findMatchingPattern", () => {
  it("returns the first matching pattern", () => {
    const match = findMatchingPattern("/api/v1/users", [
      "/health",
      "/api/*/users",
      "/api/**/users",
    ]);
    expect(match).toBe("/api/*/users");
  });

  it("returns null when no patterns match", () => {
    const match = findMatchingPattern("/api/v1/users", ["/health", "/status"]);
    expect(match).toBeNull();
  });

  it("returns null when patterns list is empty", () => {
    const match = findMatchingPattern("/api/v1/users", []);
    expect(match).toBeNull();
  });
});

describe("isOutboundLink", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/path");
  });

  it("returns false for same-host links", () => {
    expect(isOutboundLink("https://example.com/other")).toBe(false);
  });

  it("returns true for different host links", () => {
    expect(isOutboundLink("https://another.example.com")).toBe(true);
  });

  it("returns false for relative links", () => {
    expect(isOutboundLink("/local/path")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(isOutboundLink("::::")).toBe(false);
  });
});

describe("getPathname", () => {
  it("returns pathname with hash appended", () => {
    window.history.pushState({}, "", "/path/to/page?x=1#section");
    expect(getPathname()).toBe("/path/to/page#section");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the function once with the latest arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced("first");
    debounced("second");
    debounced("third");

    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });
});
