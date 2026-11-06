import type { CSSProperties } from "react";

const DARK_TEXT = "#111827";
const LIGHT_SURFACE = "#fdfbf7"; // storefront --surface, the lightest background brand text sits on

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/**
 * Picks dark or white text for readability on the given hex background — whichever contrasts more.
 * (A fixed luminance cut-off of 0.45 gave white text on orange / bright green at ~2.5:1.)
 */
export function readableOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  const l = luminance(rgb);
  return contrast(l, 1) >= contrast(l, luminance(parseHex(DARK_TEXT)!)) ? "#ffffff" : DARK_TEXT;
}

/**
 * The brand colour for use as *text* (links, active tabs) on light backgrounds. Light brand colours
 * (yellow, sky blue) are darkened in steps until they reach 4.5:1 against the storefront surface.
 */
export function brandInk(hex: string): string {
  let rgb = parseHex(hex);
  if (!rgb) return hex;
  const surface = luminance(parseHex(LIGHT_SURFACE)!);
  for (let i = 0; i < 20 && contrast(luminance(rgb), surface) < 4.5; i++) {
    rgb = rgb.map((c) => c * 0.88) as [number, number, number];
  }
  return toHex(rgb);
}

export function brandStyle(color: string): CSSProperties {
  return { "--brand": color, "--brand-fg": readableOn(color), "--brand-ink": brandInk(color) } as CSSProperties;
}
