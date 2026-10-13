import { createSignal } from 'solid-js';
import { codeFeatures } from './registry/code';
import { conversationsFeatures } from './registry/conversations';
import { peopleFeatures } from './registry/people';
import { pullsFeatures } from './registry/pulls';
import { repoFeatures } from './registry/repo';
import type { FeatureDef, FeatureOption } from './types';

export type { FeatureDef, FeatureOption };

/** Every Refined GitHub feature, in README order within each area. */
export const FEATURES: FeatureDef[] = [
  ...repoFeatures,
  ...codeFeatures,
  ...conversationsFeatures,
  ...pullsFeatures,
  ...peopleFeatures,
];

const byId = new Map(FEATURES.map((f) => [f.id, f]));

const KEY = 'gh-lite:refined';
interface Stored {
  /** Explicit on/off overrides; missing ids use the feature's default. */
  enabled: Record<string, boolean>;
  options: Record<string, Record<string, unknown>>;
}
const load = (): Stored => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
    return { enabled: parsed.enabled ?? {}, options: parsed.options ?? {} };
  } catch {
    return { enabled: {}, options: {} };
  }
};

const [settings, setSettings] = createSignal<Stored>(load());

// Other tabs changing settings apply here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) setSettings(load());
  });
}

const save = (next: Stored) => {
  localStorage.setItem(KEY, JSON.stringify(next));
  setSettings(next);
};

/**
 * Whether a Refined GitHub feature is on. Reactive — read it in JSX, memos
 * or effects: `<Show when={feature('tab-to-indent')}>`.
 */
export function feature(id: string): boolean {
  const def = byId.get(id);
  if (import.meta.env.DEV && !def) console.warn(`[refined] unknown feature "${id}"`);
  const explicit = settings().enabled[id];
  return explicit ?? def?.defaultEnabled ?? true;
}

/** A feature option's value (falls back to the option's default). */
export function featureOption<T = unknown>(id: string, key: string): T {
  const stored = settings().options[id]?.[key];
  if (stored !== undefined) return stored as T;
  const opt = byId.get(id)?.options?.find((o) => o.key === key);
  return opt?.default as T;
}

export function setFeature(id: string, enabled: boolean) {
  const s = settings();
  save({ ...s, enabled: { ...s.enabled, [id]: enabled } });
}

export function setFeatureOption(id: string, key: string, value: unknown) {
  const s = settings();
  save({ ...s, options: { ...s.options, [id]: { ...s.options[id], [key]: value } } });
}

/** Turn every toggleable feature on or off (resets per-feature overrides). */
export function setAllFeatures(enabled: boolean) {
  const s = settings();
  save({ ...s, enabled: Object.fromEntries(FEATURES.filter((f) => f.status === 'done').map((f) => [f.id, enabled])) });
}

export function resetFeatures() {
  save({ enabled: {}, options: {} });
}
