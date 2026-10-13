import type { ThemeRegistrationRaw } from 'shiki/core';

/**
 * Turns Shiki's GitHub theme into a theme-agnostic one that emits github.com's
 * own `pl-*` syntax classes (the "prettylights" classes styled in primer.css by
 * Primer's `--color-prettylights-syntax-*` tokens). One highlighting result then
 * renders correctly in every Primer theme — light, dark, dimmed, high contrast,
 * colorblind — and switching themes needs no re-highlighting.
 *
 * Each token color of the base theme is replaced by a unique sentinel color;
 * `classForColor()` maps the sentinel a token comes back with to its class.
 */

/** github.com's class for a TextMate scope (first match wins, order matters). */
const RULES: [RegExp, string][] = [
  // Specific scopes GitHub colors differently from their family.
  [/^(source\.regexp|string\.regexp\.character-class)/, 'pl-s'],
  [/^(constant\.other\.placeholder|punctuation\.section\.embedded)/, 'pl-k'],
  [/^(support\.type\.property-name\.json|markup\.quote)/, 'pl-ent'],
  [/^(string variable|markup\.inline\.raw)/, 'pl-c1'],
  [/^entity\.name$/, 'pl-v'],
  [/^message\.error/, 'pl-ii'],
  // Families.
  [/^comment|punctuation\.definition\.comment|string\.comment/, 'pl-c'],
  [/regexp/, 'pl-sr'],
  [/storage\.modifier\.(package|import)/, 'pl-smi'],
  [/^(entity\.name\.tag|support\.class\.component)/, 'pl-ent'],
  [/^markup\.heading|^heading/, 'pl-mh'],
  [/^markup\.bold/, 'pl-mb'],
  [/^markup\.italic/, 'pl-mi'],
  [/^(markup\.list|punctuation\.definition\.list)/, 'pl-ml'],
  [/^(markup\.inserted|meta\.diff\.header\.to-file|punctuation\.definition\.inserted)/, 'pl-mi1'],
  [/^(markup\.deleted|meta\.diff\.header\.from-file|punctuation\.definition\.deleted)/, 'pl-md'],
  [/^(markup\.changed|punctuation\.definition\.changed)/, 'pl-mc'],
  [/^(markup\.ignored|markup\.untracked)/, 'pl-mi2'],
  [/^meta\.diff\.range/, 'pl-mdr'],
  [/^invalid/, 'pl-ii'],
  [/^brackethighlighter\.unmatched/, 'pl-bu'],
  [/^brackethighlighter\./, 'pl-ba'],
  [/carriage-return/, 'pl-c2'],
  [/^(keyword|storage)/, 'pl-k'],
  [/^(string|punctuation\.definition\.string)/, 'pl-s'],
  [
    /^(constant|support|variable\.language|variable\.other\.(constant|enummember)|entity\.name\.constant|meta\.property-name|markup\.raw|meta\.module-reference|markup\.quote|meta\.diff|meta\.separator|meta\.output)/,
    'pl-c1',
  ],
  [/^entity/, 'pl-en'],
  [/^variable/, 'pl-v'],
];

export function classForScopes(scopes: string[]): string | undefined {
  for (const [re, cls] of RULES) if (scopes.some((s) => re.test(s))) return cls;
  return undefined;
}

const sentinel = (i: number) => `#${(i + 1).toString(16).padStart(6, '0')}`;
/** The default foreground: tokens that come back with it get no class. */
const PLAIN = '#fffffe';

const classBySentinel = new Map<string, string>();

/** The theme Shiki should highlight with (derived from `github-light-default`). */
export function primerSyntaxTheme(base: ThemeRegistrationRaw): ThemeRegistrationRaw {
  const plain = (base.colors?.['editor.foreground'] ?? '').toLowerCase();
  const tokenColors = (base.tokenColors ?? []).map((entry, i) => {
    const fg = entry.settings?.foreground?.toLowerCase();
    if (!fg) return entry;
    const scopes = ([] as string[]).concat(entry.scope ?? []);
    // GitHub deliberately keeps some scopes (parameters, plain variables…) in
    // the default text color; keep those plain.
    const cls = fg === plain ? undefined : classForScopes(scopes);
    if (!cls) return { ...entry, settings: { ...entry.settings, foreground: PLAIN } };
    const color = sentinel(i);
    classBySentinel.set(color, cls);
    // Font styles come from the pl-* rules, not the theme.
    return { ...entry, settings: { foreground: color } };
  });
  return {
    ...base,
    name: 'github-primer',
    colors: { ...base.colors, 'editor.foreground': PLAIN, 'editor.background': '#00000000' },
    tokenColors,
  };
}

export function classForColor(color: string | undefined): string | undefined {
  return color ? classBySentinel.get(color.toLowerCase()) : undefined;
}
