import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Palette, PaletteColors } from '../src/lib/theme-palettes.ts';

/**
 * Builds a complete Primer token sheet for a community palette by recoloring
 * Primer's own light or dark theme (whichever matches the palette's family):
 *
 * - neutral colors (backgrounds, borders, text) map onto the palette's
 *   background→foreground ramp by their position between Primer's background
 *   and foreground (so insets, overlays and borders keep their relationships);
 * - chromatic colors keep Primer's perceptual lightness (which is tuned for
 *   contrast) but take the hue and chroma of the palette accent nearest in hue;
 * - a few anchor tokens and the syntax colors are set from the palette exactly.
 *
 * Colors are converted through OKLab/OKLCH so lightness is perceptual.
 */

type RGBA = [number, number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function parse(color: string): RGBA | null {
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const h = hex.length <= 4 ? [...hex].map((x) => x + x).join('') : hex;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255, a];
  }
  return null;
}

function format([r, g, b, a]: RGBA) {
  const h = (x: number) =>
    Math.round(Math.min(1, Math.max(0, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ''}`;
}

type Lab = [number, number, number];

function toOklab([r, g, b]: RGBA): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: Lab, alpha = 1): RGBA {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  ];
}

const inGamut = (c: RGBA) => c.slice(0, 3).every((x) => x >= -0.0005 && x <= 1.0005);

/** OKLCH → sRGB, reducing chroma until the color fits in sRGB. */
function fromOklch(L: number, C: number, h: number, alpha: number): RGBA {
  let c = C;
  for (let i = 0; i < 24; i++) {
    const rgb = fromOklab([L, c * Math.cos(h), c * Math.sin(h)], alpha);
    if (inGamut(rgb)) return rgb;
    c *= 0.9;
  }
  return fromOklab([L, 0, 0], alpha);
}

const lch = (color: string) => {
  const [L, A, B] = toOklab(parse(color)!);
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
};

const ACCENTS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const;

/** Reference hues of Primer's accent scales, to decide which palette accent a color belongs to. */
const PRIMER_HUES: Record<(typeof ACCENTS)[number], string> = {
  red: '#cf222e',
  orange: '#bc4c00',
  yellow: '#9a6700',
  green: '#1a7f37',
  cyan: '#1b7c83',
  blue: '#0969da',
  purple: '#8250df',
  pink: '#bf3989',
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

function recolorer(base: Record<string, string>, colors: PaletteColors) {
  const baseBg = toOklab(parse(base['--bgColor-default']!)!);
  const baseFg = toOklab(parse(base['--fgColor-default']!)!);
  const bg = toOklab(parse(colors.bg)!);
  const fg = toOklab(parse(colors.fg)!);
  const refs = ACCENTS.map((k) => ({ key: k, ...lch(PRIMER_HUES[k]) }));
  // Primer's grays are faintly blue-tinted; pale accent tints (diff and
  // highlight backgrounds) can be just as low in chroma but sit at other hues.
  const grayHue = lch(base['--fgColor-muted']!).h;
  const isNeutral = (C: number, h: number) => C < 0.012 || (C < 0.045 && hueDistance(h, grayHue) < 0.6);

  return (literal: string) => {
    const rgba = parse(literal);
    if (!rgba) return literal;
    const [L, A, B] = toOklab(rgba);
    const C = Math.hypot(A, B);
    const h = Math.atan2(B, A);
    if (isNeutral(C, h)) {
      // Neutral: position along Primer's bg→fg ramp, mapped onto the palette's.
      const t = Math.max(-0.35, Math.min(1.25, (L - baseBg[0]) / (baseFg[0] - baseBg[0])));
      const mixed: Lab = [bg[0] + (fg[0] - bg[0]) * t, bg[1] + (fg[1] - bg[1]) * t, bg[2] + (fg[2] - bg[2]) * t];
      mixed[0] = Math.max(0, Math.min(1, mixed[0]));
      return format(fromOklab(mixed, rgba[3]));
    }
    const ref = refs.reduce((best, r) => (hueDistance(r.h, h) < hueDistance(best.h, h) ? r : best));
    const accent = lch(colors[ref.key]);
    // Keep Primer's lightness (tuned for contrast); take the palette accent's
    // hue, and scale chroma by how saturated the accent is relative to Primer's
    // own, so pale tints stay pale and vivid accents stay vivid.
    const chroma = Math.min(0.37, C * (accent.C / ref.C));
    return format(fromOklch(L, chroma, accent.h, rgba[3]));
  };
}

/** Parse a Primer theme sheet into its token → value map (first declaration wins). */
function readTokens(file: string) {
  const css = readFileSync(file, 'utf8');
  const tokens: Record<string, string> = {};
  const body = css.slice(css.indexOf('{') + 1, css.indexOf('@media'));
  for (const m of body.matchAll(/(--[a-zA-Z0-9-]+):\s*([^;]+);/g)) tokens[m[1]!] ??= m[2]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return tokens;
}

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

export function buildPaletteCss(palette: Palette, primerThemesDir: string) {
  const base = readTokens(join(primerThemesDir, `${palette.family}.css`));
  const recolor = recolorer(base, palette.colors);
  const tokens: Record<string, string> = {};
  for (const [name, value] of Object.entries(base)) tokens[name] = value.replace(COLOR_LITERAL, recolor);

  const c = palette.colors;
  const s = palette.syntax;
  Object.assign(tokens, {
    '--bgColor-default': c.bg,
    '--bgColor-inset': c.inset,
    '--bgColor-muted': c.surface,
    '--fgColor-default': c.fg,
    '--fgColor-muted': c.muted,
    '--borderColor-default': c.border,
    '--prettylights-syntax-keyword': s.keyword,
    '--prettylights-syntax-string': s.string,
    '--prettylights-syntax-constant': s.constant,
    '--prettylights-syntax-entity': s.entity,
    '--prettylights-syntax-entityTag': s.tag,
    '--prettylights-syntax-variable': s.variable,
    '--prettylights-syntax-comment': s.comment,
    '--prettylights-syntax-stringRegexp': s.tag,
    '--prettylights-syntax-storageModifierImport': c.fg,
  });

  const declarations = Object.entries(tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  const id = palette.id;
  // Same selector shape as Primer's sheets: usable as a single theme or in
  // either sync slot; the night rule's doubled attribute outranks day rules.
  return (
    `[data-color-mode="light"][data-light-theme="${id}"],[data-color-mode="dark"][data-dark-theme="${id}"],` +
    `[data-color-mode="auto"][data-light-theme="${id}"]{color-scheme:${palette.family};${declarations}}` +
    `@media (prefers-color-scheme: dark){[data-color-mode][data-color-mode="auto"][data-dark-theme="${id}"]` +
    `{color-scheme:${palette.family};${declarations}}}`
  );
}
