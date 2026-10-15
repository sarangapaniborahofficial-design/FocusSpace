import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * WCAG 2.1 Color Contrast Automated Suite
 *
 * Verifies that all 4 themes (solaris, bauhaus, nocturne, onyx) comply with
 * WCAG 2.1 AA (4.5:1) and AAA (7:1) requirements, eliminating black-on-black
 * or low-contrast text across the entire design system.
 */

interface ThemeColors {
  canvas: string;
  surface: string;
  fg: string;
  fgSoft: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  inv: string;
  onInv: string;
}

function parseHexOrRgb(colorStr: string): [number, number, number] {
  const clean = colorStr.trim();
  if (clean.startsWith('#')) {
    let hex = clean.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const rgbMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  throw new Error(`Unable to parse color: ${colorStr}`);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(colorA: string, colorB: string): number {
  const lumA = relativeLuminance(parseHexOrRgb(colorA));
  const lumB = relativeLuminance(parseHexOrRgb(colorB));
  const max = Math.max(lumA, lumB);
  const min = Math.min(lumA, lumB);
  return (max + 0.05) / (min + 0.05);
}

function extractThemeVariables(css: string): Record<string, ThemeColors> {
  const extractVal = (block: string, varName: string): string => {
    const m = block.match(new RegExp(`${varName}:\\s*([^;]+);`));
    return m ? m[1].trim() : '';
  };

  const getBlock = (selector: string): string => {
    const start = css.indexOf(selector);
    if (start === -1) return '';
    const open = css.indexOf('{', start);
    const close = css.indexOf('}', open);
    return css.slice(open + 1, close);
  };

  const solarisBlock = getBlock(':root, :root[data-theme="solaris"]');
  const bauhausBlock = getBlock(':root[data-theme="bauhaus"]');
  const nocturneBlock = getBlock(':root[data-theme="nocturne"]');
  const onyxBlock = getBlock(':root[data-theme="onyx"]');

  const buildTheme = (block: string): ThemeColors => ({
    canvas: extractVal(block, '--c-canvas'),
    surface: extractVal(block, '--c-surface'),
    fg: extractVal(block, '--c-fg'),
    fgSoft: extractVal(block, '--c-fg-soft'),
    fgMuted: extractVal(block, '--c-fg-muted'),
    accent: extractVal(block, '--c-accent'),
    accentFg: extractVal(block, '--c-accent-fg'),
    inv: extractVal(block, '--c-inv'),
    onInv: extractVal(block, '--c-on-inv'),
  });

  return {
    solaris: buildTheme(solarisBlock),
    bauhaus: buildTheme(bauhausBlock),
    nocturne: buildTheme(nocturneBlock),
    onyx: buildTheme(onyxBlock),
  };
}

describe('WCAG 2.1 Color Contrast Suite', () => {
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const themes = extractThemeVariables(cssContent);

  it('successfully extracts theme CSS variables from index.css', () => {
    expect(themes.solaris.fg).toBeTruthy();
    expect(themes.bauhaus.inv).toBeTruthy();
    expect(themes.nocturne.accent).toBeTruthy();
    expect(themes.onyx.onInv).toBeTruthy();
  });

  for (const [themeName, colors] of Object.entries(themes)) {
    describe(`Theme: ${themeName}`, () => {
      it('enforces WCAG AAA (>= 7:1) or AA (>= 4.5:1) for primary text on surface', () => {
        const ratio = contrastRatio(colors.fg, colors.surface);
        expect(ratio).toBeGreaterThanOrEqual(7.0);
      });

      it('enforces WCAG AA (>= 4.5:1) for primary text on canvas', () => {
        const ratio = contrastRatio(colors.fg, colors.canvas);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it('enforces WCAG AA (>= 4.5:1) for soft secondary text on surface', () => {
        const ratio = contrastRatio(colors.fgSoft, colors.surface);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it('enforces readable UI contrast (>= 3:1) for muted text on surface', () => {
        const ratio = contrastRatio(colors.fgMuted, colors.surface);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });

      it('enforces WCAG AA (>= 4.5:1) for accent button text on accent background', () => {
        const ratio = contrastRatio(colors.accentFg, colors.accent);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it('enforces high contrast (>= 6:1) for inverted elements (tabs, badges, buttons)', () => {
        const ratio = contrastRatio(colors.onInv, colors.inv);
        expect(ratio).toBeGreaterThanOrEqual(6.0);
      });
    });
  }

  describe('Bug Regression Guards', () => {
    it('Swiss Brutal (bauhaus) tabs must NEVER be black-on-black and must exceed 10:1', () => {
      const { inv, onInv } = themes.bauhaus;
      expect(inv.toLowerCase()).not.toBe(onInv.toLowerCase());
      const ratio = contrastRatio(onInv, inv);
      // Acid citron #c8ff29 on dark black #0d0f0d delivers ~16.3:1
      expect(ratio).toBeGreaterThanOrEqual(10.0);
    });

    it('Swiss Onyx (onyx) inverted active items must use pitch-black text on neon accent', () => {
      const { inv, onInv } = themes.onyx;
      expect(onInv.toLowerCase()).toBe('#000000');
      const ratio = contrastRatio(onInv, inv);
      // Pitch black on neon lime delivers ~13.9:1
      expect(ratio).toBeGreaterThanOrEqual(10.0);
    });

    it('index.css must contain universal .bg-inv and .text-on-inv high-contrast enforcement rules', () => {
      expect(cssContent).toContain('.bg-inv');
      expect(cssContent).toContain('.text-on-inv');
      expect(cssContent).toContain(':root[data-theme="bauhaus"] .bg-inv');
      expect(cssContent).toContain(':root[data-theme="onyx"] .bg-inv');
    });
  });
});
