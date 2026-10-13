import { describe, expect, test } from 'vitest';
import { FEATURES } from './index';

// Source of every module (raw text), to find feature ids used by code.
const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

const used = new Map<string, string[]>();
for (const [path, text] of Object.entries(sources)) {
  if (path.includes('/features/refined/registry') || path.endsWith('registry.test.ts')) continue;
  for (const m of text.matchAll(/\b(?:feature|featureOption|setFeature|setFeatureOption)\(\s*['"]([a-z0-9.-]+)['"]/g)) {
    used.set(m[1]!, [...(used.get(m[1]!) ?? []), path]);
  }
  for (const m of text.matchAll(/\bfeature:\s*['"]([a-z0-9.-]+)['"]/g)) {
    used.set(m[1]!, [...(used.get(m[1]!) ?? []), path]);
  }
}

describe('refined feature registry', () => {
  const ids = new Set(FEATURES.map((f) => f.id));

  test('the scan sees the source tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(300);
    // Only toggleable features are referenced; the rest are permanent behaviour.
    expect(used.size).toBeGreaterThan(20);
  });

  test('ids are unique', () => {
    expect(FEATURES.length).toBe(ids.size);
  });

  test('every feature is implemented (no todo entries)', () => {
    expect(FEATURES.filter((f) => f.status !== 'done').map((f) => f.id)).toEqual([]);
  });

  test('code only references features that exist in the registry', () => {
    const unknown = [...used].filter(([id]) => !ids.has(id)).map(([id, files]) => `${id} (${files[0]})`);
    expect(unknown).toEqual([]);
  });

  test('every registered feature is used by code', () => {
    const unused = FEATURES.filter((f) => !used.has(f.id)).map((f) => f.id);
    expect(unused).toEqual([]);
  });
});
