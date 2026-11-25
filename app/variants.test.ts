import { describe, expect, it } from "vitest";
import { variantFromStyle } from "./variants";

describe("embed style selection", () => {
  it.each([
    ["paper", "paper"],
    ["paper-compact", "paper-compact"],
    ["classic", "classic"],
    ["classic-compact", "classic-compact"],
    ["terminal", "terminal"],
    ["terminal-compact", "terminal-compact"],
    ["full", "classic"],
    ["compact", "classic-compact"],
    ["unknown", "paper"],
    [undefined, "paper"],
  ] as const)("maps style %s to %s", (style, expected) => {
    expect(variantFromStyle(style)).toBe(expected);
  });
});
