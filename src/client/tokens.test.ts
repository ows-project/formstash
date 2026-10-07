import { describe, expect, it } from "vitest";
import css from "./styles.css?raw";

// Text tokens must stay readable (WCAG AA, 4.5:1) on the surfaces they sit on.

function block(source: string, marker: string): string {
  const start = source.indexOf(marker);
  const open = source.indexOf("{", source.indexOf(":root", start));
  return source.slice(open, source.indexOf("}", open));
}

function tokens(text: string): Record<string, string> {
  return Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, value]) => [name, value]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const themes = {
  light: tokens(block(css, ":root {")),
  dark: tokens(block(css, "@media (prefers-color-scheme: dark)")),
};

describe.each(Object.entries(themes))("%s theme text contrast", (_, theme) => {
  it.each(["ink", "ink-2", "muted", "subtle"])("--%s is readable on surface and canvas", (name) => {
    expect(contrast(theme[name], theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme[name], theme.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});
