import type { Variant } from "./Melorafy";

export function variantFromStyle(style?: string): Variant {
  switch (style) {
    case "classic":
    case "full":
      return "classic";
    case "classic-compact":
    case "compact":
      return "classic-compact";
    case "paper-compact":
      return "paper-compact";
    case "terminal":
      return "terminal";
    case "terminal-compact":
      return "terminal-compact";
    default:
      return "paper";
  }
}
