import { createSignal } from 'solid-js';
import { PALETTES } from './theme-palettes';

/**
 * GitHub's theme preferences: a single theme, or "sync with system" with
 * separate day and night themes; plus "increase contrast" per light/dark
 * family, which swaps in Primer's high-contrast variant of the chosen theme.
 *
 * Primer's token sheets key off <html data-color-mode data-light-theme
 * data-dark-theme>. The default light and dark sheets are bundled; every other
 * theme is a separate stylesheet at /themes/<name>.css (see the primerThemes
 * plugin in vite.config.ts), loaded on demand — and before first paint by the
 * inline script in src/Document.tsx, which mirrors `themeAttributes()`.
 */

/** GitHub's own themes (each has a high-contrast variant). */
const GITHUB_THEMES = [
  { id: 'light', name: 'Light default', family: 'light' },
  { id: 'light_colorblind', name: 'Light Protanopia & Deuteranopia', family: 'light' },
  { id: 'light_tritanopia', name: 'Light Tritanopia', family: 'light' },
  { id: 'dark', name: 'Dark default', family: 'dark' },
  { id: 'dark_dimmed', name: 'Dark dimmed', family: 'dark' },
  { id: 'dark_colorblind', name: 'Dark Protanopia & Deuteranopia', family: 'dark' },
  { id: 'dark_tritanopia', name: 'Dark Tritanopia', family: 'dark' },
] as const;

export interface ThemeInfo {
  id: string;
  name: string;
  family: 'light' | 'dark';
  group: 'github' | 'community';
}

/** Every selectable theme: GitHub's, then community palettes (src/lib/theme-palettes.ts). */
export const THEMES: ThemeInfo[] = [
  ...GITHUB_THEMES.map((t) => ({ ...t, group: 'github' as const })),
  ...PALETTES.map((p) => ({ id: p.id, name: p.name, family: p.family, group: 'community' as const })),
];

export type ThemeId = string;
const byId = new Map(THEMES.map((t) => [t.id, t]));

export interface ThemeSettings {
  mode: 'single' | 'sync';
  /** Theme used in single-theme mode. */
  single: ThemeId;
  /** Themes used in sync mode, for the system's light and dark appearance. */
  day: ThemeId;
  night: ThemeId;
  /** Use the high-contrast variant of light / dark themes. */
  contrast: { light: boolean; dark: boolean };
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'sync',
  single: 'light',
  day: 'light',
  night: 'dark',
  contrast: { light: false, dark: false },
};

const KEY = 'gh-lite:theme';
const LEGACY_KEY = 'gh-lite:color-mode';

export const isDarkTheme = (id: string) => (byId.get(id)?.family ?? (id.startsWith('dark') ? 'dark' : 'light')) === 'dark';
/** Only GitHub's themes have high-contrast variants. */
export const hasContrastVariant = (id: string) => byId.get(id)?.group === 'github';
const contrastOn = (id: ThemeId, s: ThemeSettings) => hasContrastVariant(id) && s.contrast[isDarkTheme(id) ? 'dark' : 'light'];

export const themeLabel = (id: ThemeId, contrast = false) => {
  const name = byId.get(id)?.name ?? id;
  return contrast && hasContrastVariant(id) ? name.replace(' default', '').concat(' high contrast') : name;
};

/** The theme name actually applied for a base theme (e.g. "dark_dimmed_high_contrast"). */
export function resolvedTheme(id: ThemeId, s: ThemeSettings) {
  return contrastOn(id, s) ? `${id}_high_contrast` : id;
}

/** The <html> attributes for a settings object. */
export function themeAttributes(s: ThemeSettings) {
  if (s.mode === 'single') {
    const theme = resolvedTheme(s.single, s);
    return { colorMode: isDarkTheme(s.single) ? 'dark' : 'light', lightTheme: theme, darkTheme: theme };
  }
  return { colorMode: 'auto', lightTheme: resolvedTheme(s.day, s), darkTheme: resolvedTheme(s.night, s) };
}

const BUNDLED = new Set(['light', 'dark']);

/** Load a Primer theme stylesheet (no-op for the bundled defaults or if already loaded). */
export function ensureThemeCss(theme: string) {
  if (typeof document === 'undefined' || BUNDLED.has(theme)) return;
  const id = `primer-theme-${theme}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `/themes/${theme.replace(/_/g, '-')}.css`;
  document.head.append(link);
}

function load(): ThemeSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemeSettings;
      for (const k of ['single', 'day', 'night'] as const) if (!byId.has(saved[k])) saved[k] = DEFAULT_THEME[k];
      return saved;
    }
    // Older versions stored just the color mode.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'light' || legacy === 'dark') return { ...DEFAULT_THEME, mode: 'single', single: legacy };
  } catch {
    /* fall through */
  }
  return DEFAULT_THEME;
}

const [themeSettings, setThemeSignal] = createSignal<ThemeSettings>(load());
export { themeSettings };

function apply(s: ThemeSettings) {
  const attrs = themeAttributes(s);
  ensureThemeCss(attrs.lightTheme);
  ensureThemeCss(attrs.darkTheme);
  const root = document.documentElement;
  root.dataset.colorMode = attrs.colorMode;
  root.dataset.lightTheme = attrs.lightTheme;
  root.dataset.darkTheme = attrs.darkTheme;
}

/** Update theme preferences (merged into the current ones), persist and apply them. */
export function setThemeSettings(patch: Partial<ThemeSettings>) {
  const next = { ...themeSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.removeItem(LEGACY_KEY);
  apply(next);
  setThemeSignal(next);
}

// Other tabs changing the theme apply here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const next = load();
    apply(next);
    setThemeSignal(next);
  });
}

/** Whether the OS currently prefers dark (decides which sync theme is active). */
const darkQuery =
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const [systemDark, setSystemDark] = createSignal(darkQuery?.matches ?? false);
darkQuery?.addEventListener('change', (e) => setSystemDark(e.matches));
export { systemDark };

/** Short description of the active preference, e.g. for the account menu. */
export function themeSummary(s: ThemeSettings = themeSettings()) {
  if (s.mode === 'single') return themeLabel(s.single, contrastOn(s.single, s));
  return 'Sync with system';
}
