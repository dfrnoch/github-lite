/**
 * A Refined GitHub feature (https://github.com/refined-github/refined-github)
 * reimplemented natively in this app. Every implemented feature is behind a
 * toggle on /settings/refined, enabled by default like the extension.
 */
export interface FeatureDef {
  /** Refined GitHub's feature id (kebab-case), e.g. "tab-to-indent". */
  id: string;
  /** Refined GitHub README section, used to group the settings page. */
  section: string;
  description: string;
  /** `todo` — not implemented yet (hidden from settings); `done` — implemented, gated by `feature(id)`. */
  status: 'todo' | 'done';
  /** Caveats of the implementation, shown under the toggle. */
  note?: string;
  /** Defaults to true (Refined GitHub enables everything by default). */
  defaultEnabled?: boolean;
  /** Extra settings shown under the toggle. Read with `featureOption(id, key)`. */
  options?: FeatureOption[];
  /** Keyboard shortcuts it adds, for the settings page (the `?` dialog lists live ones). */
  hotkeys?: string[];
}

export type FeatureOption =
  | { key: string; label: string; type: 'boolean'; default: boolean; help?: string }
  | { key: string; label: string; type: 'string'; default: string; help?: string; placeholder?: string }
  | { key: string; label: string; type: 'number'; default: number; help?: string; min?: number; max?: number }
  | { key: string; label: string; type: 'select'; default: string; help?: string; choices: { value: string; label: string }[] };
