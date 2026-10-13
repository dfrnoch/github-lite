import { describe, expect, test } from 'vitest';
import { classForScopes } from './syntax-classes';
import { DEFAULT_THEME, resolvedTheme, themeAttributes, themeLabel } from './theme';

describe('themeAttributes', () => {
  test('sync with system uses the day and night themes', () => {
    expect(themeAttributes(DEFAULT_THEME)).toEqual({ colorMode: 'auto', lightTheme: 'light', darkTheme: 'dark' });
    expect(themeAttributes({ ...DEFAULT_THEME, night: 'dark_dimmed' }).darkTheme).toBe('dark_dimmed');
  });

  test('a single theme pins the color mode to its family', () => {
    expect(themeAttributes({ ...DEFAULT_THEME, mode: 'single', single: 'dark_tritanopia' })).toEqual({
      colorMode: 'dark',
      lightTheme: 'dark_tritanopia',
      darkTheme: 'dark_tritanopia',
    });
    expect(themeAttributes({ ...DEFAULT_THEME, mode: 'single', single: 'light_colorblind' }).colorMode).toBe('light');
  });

  test('increased contrast swaps in the high-contrast variant per family', () => {
    const s = { ...DEFAULT_THEME, contrast: { light: false, dark: true } };
    expect(resolvedTheme('dark_dimmed', s)).toBe('dark_dimmed_high_contrast');
    expect(resolvedTheme('light', s)).toBe('light');
    expect(themeLabel('dark', true)).toBe('Dark high contrast');
  });
});

describe('syntax classes', () => {
  test('maps TextMate scopes to github.com prettylights classes', () => {
    expect(classForScopes(['comment.line'])).toBe('pl-c');
    expect(classForScopes(['keyword.control'])).toBe('pl-k');
    expect(classForScopes(['string.quoted.double'])).toBe('pl-s');
    expect(classForScopes(['entity.name.tag'])).toBe('pl-ent');
    expect(classForScopes(['entity.name.function'])).toBe('pl-en');
    expect(classForScopes(['constant.numeric'])).toBe('pl-c1');
    expect(classForScopes(['markup.inserted'])).toBe('pl-mi1');
  });
});
