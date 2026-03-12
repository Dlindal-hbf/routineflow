// central color configuration for semantic keys

export type ColorKey =
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "gray";

export interface ColorOption {
  key: ColorKey;
  name: string; // human readable
  borderClass: string; // used for accents (cards, borders)
  bgClass: string; // used for swatch background, etc.
}

export const COLOR_OPTIONS: ColorOption[] = [
  { key: "blue", name: "Blue", borderClass: "border-t-blue-500", bgClass: "bg-blue-500" } /* legacy, can be remapped by consumers */,
  { key: "green", name: "Green", borderClass: "border-t-green-500", bgClass: "bg-green-500" },
  { key: "orange", name: "Gold Accent", borderClass: "border-accent-gold", bgClass: "bg-accent-gold" },
  { key: "purple", name: "Purple", borderClass: "border-t-purple-500", bgClass: "bg-purple-500" },
  { key: "red", name: "Brand Red", borderClass: "border-primary", bgClass: "bg-primary" },
  { key: "gray", name: "Gray", borderClass: "border-t-gray-500", bgClass: "bg-gray-500" },
];

// lookup map for convenience
const OPTION_MAP: Record<ColorKey, ColorOption> = COLOR_OPTIONS.reduce(
  (acc, o) => {
    acc[o.key] = o;
    return acc;
  }, {} as Record<ColorKey, ColorOption>
);

export function getAccentClass(colorKey?: string | null): string {
  if (!colorKey) return "";
  if (OPTION_MAP[colorKey as ColorKey]) {
    return OPTION_MAP[colorKey as ColorKey].borderClass;
  }
  // treat colorKey as raw class fallback
  return colorKey;
}

/**
 * Return a suitable background (fill) utility for a color key or class.
 * Used by list headers so they can turn red/gold/etc.
 */
export function getBgClass(colorKey?: string | null): string {
  // primary red is the safe default for any missing value
  if (!colorKey) return "bg-primary";

  // handle semantic keys first
  if (OPTION_MAP[colorKey as ColorKey]) {
    return OPTION_MAP[colorKey as ColorKey].bgClass;
  }

  // normalize legacy variants that mention "brand-primary" which we no longer
  // generate in Tailwind. convert them to the new utility.
  if (colorKey.includes("brand-primary")) {
    return "bg-primary";
  }

  // if the value already looks like a background class, use it directly
  if (colorKey.startsWith("bg-")) return colorKey;

  // handle border-based legacy classes: border-t-{color} or border-{color}
  if (colorKey.startsWith("border-t-")) return colorKey.replace("border-t-", "bg-");
  if (colorKey.startsWith("border-")) return colorKey.replace("border-", "bg-");

  // fallback to primary so we at least have a visible color
  return "bg-primary";
}

// helper to convert legacy stored values (like "border-t-blue-500") to key
export function interpretColor(value?: string | null): ColorKey | undefined {
  if (!value) return undefined;
  const entry = COLOR_OPTIONS.find((o) => o.borderClass === value || o.bgClass === value);
  if (entry) return entry.key;
  // also try to match by substring
  for (const o of COLOR_OPTIONS) {
    if (value.includes(o.key)) return o.key as ColorKey;
  }
  return undefined;
}