import { Title } from '@solidjs/meta';
import { For, onSettled, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import Subhead from '../../features/settings/components/Subhead';
import { moonIcon, sunIcon } from '../../icons/octicons';
import {
  ensureThemeCss,
  isDarkTheme,
  resolvedTheme,
  setThemeSettings,
  systemDark,
  THEMES,
  type ThemeId,
  themeLabel,
  themeSettings,
} from '../../lib/theme';

/**
 * A miniature GitHub page rendered *in* the given theme: Primer's token sheets
 * apply to any element carrying the theme attributes, so the preview shows the
 * theme's real colors (canvas, borders, accents, syntax and diff colors).
 */
function ThemePreview(props: { theme: string }) {
  const dark = () => isDarkTheme(props.theme);
  return (
    <div
      data-color-mode={dark() ? 'dark' : 'light'}
      data-light-theme={dark() ? undefined : props.theme}
      data-dark-theme={dark() ? props.theme : undefined}
      class="h-[132px] bg-canvas text-fg flex flex-col text-[9px] leading-[14px] select-none"
      aria-hidden="true"
    >
      <div class="flex items-center gap-1 px-2 h-5 bg-canvas-inset border-b border-line">
        <span class="w-2 h-2 rounded-full bg-[var(--fgColor-default)]" />
        <span class="w-10 h-1.5 rounded-full bg-[var(--borderColor-default)]" />
        <span class="flex-1" />
        <span class="w-3 h-3 rounded-full bg-[var(--bgColor-neutral-muted)] border border-line" />
      </div>
      <div class="flex gap-2 p-2 flex-1 min-h-0">
        <div class="w-1/4 flex flex-col gap-1">
          <span class="h-1.5 rounded-full bg-[var(--fgColor-accent)] w-4/5" />
          <span class="h-1.5 rounded-full bg-[var(--borderColor-default)]" />
          <span class="h-1.5 rounded-full bg-[var(--borderColor-default)] w-3/5" />
          <span class="mt-1 px-1 rounded-full text-[7px] leading-[11px] w-fit bg-[var(--bgColor-success-emphasis)] text-[var(--fgColor-onEmphasis)]">
            Open
          </span>
        </div>
        <div class="flex-1 min-w-0 rounded border border-line overflow-hidden font-mono">
          <div class="px-1.5 bg-canvas-muted border-b border-line text-fg-muted truncate">app.ts</div>
          <div class="px-1.5 truncate">
            <span class="pl-k">const</span> <span class="pl-c1">theme</span> = <span class="pl-s">'{props.theme}'</span>;
          </div>
          <div class="px-1.5 truncate">
            <span class="pl-c">// switch any time</span>
          </div>
          <div class="px-1.5 truncate blob-code-deletion">- old line</div>
          <div class="px-1.5 truncate blob-code-addition">+ new line</div>
        </div>
      </div>
    </div>
  );
}

function ThemeGrid(props: { name: string; selected: ThemeId; onSelect: (id: ThemeId) => void; only?: 'light' | 'dark' }) {
  const themes = () => THEMES.filter((t) => !props.only || isDarkTheme(t.id) === (props.only === 'dark'));
  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" role="radiogroup" aria-label={props.name}>
      <For each={themes()}>
        {(t) => {
          const contrast = () => themeSettings().contrast[isDarkTheme(t.id) ? 'dark' : 'light'];
          const selected = () => props.selected === t.id;
          return (
            <label
              class={[
                'Box overflow-hidden cursor-pointer block transition-shadow',
                { 'outline outline-2 -outline-offset-1 outline-[var(--borderColor-accent-emphasis)]': selected() },
              ]}
            >
              <ThemePreview theme={resolvedTheme(t.id, themeSettings())} />
              <div class="flex items-center gap-2 px-3 py-2 border-t border-line text-sm">
                <input
                  type="radio"
                  name={props.name}
                  value={t.id}
                  checked={selected()}
                  onChange={() => props.onSelect(t.id)}
                />
                <span class={{ 'font-semibold': selected() }}>{themeLabel(t.id, contrast())}</span>
              </div>
            </label>
          );
        }}
      </For>
    </div>
  );
}

function SyncPanel(props: { kind: 'day' | 'night' }) {
  const day = () => props.kind === 'day';
  const active = () => systemDark() !== day();
  return (
    <section class="Box mb-6">
      <div class="Box-header flex items-center gap-2">
        <Octicon icon={day() ? sunIcon : moonIcon} />
        <h3 class="Box-title flex-1">{day() ? 'Day theme' : 'Night theme'}</h3>
        <Show when={active()}>
          <span class="Label Label--success">Active</span>
        </Show>
      </div>
      <div class="Box-body">
        <p class="text-sm text-fg-muted mb-4">
          This theme will be active when your system is set to “{day() ? 'light' : 'dark'} mode”.
        </p>
        <ThemeGrid
          name={`${props.kind}-theme`}
          selected={day() ? themeSettings().day : themeSettings().night}
          onSelect={(id) => setThemeSettings(day() ? { day: id } : { night: id })}
        />
      </div>
    </section>
  );
}

/** /settings/appearance — GitHub's theme preferences. */
export default function AppearanceSettings() {
  // Previews render every theme, so load all theme stylesheets on this page.
  onSettled(() => {
    for (const t of THEMES) {
      ensureThemeCss(t.id);
      ensureThemeCss(`${t.id}_high_contrast`);
    }
  });

  return (
    <>
      <Title>Appearance</Title>
      <Subhead title="Theme preferences" />
      <p class="mb-4">
        Choose how GitHub Lite looks to you. Select a single theme, or sync with your system and automatically switch
        between day and night themes. Changes apply immediately and are saved in this browser.
      </p>

      <div class="Box p-4 mb-6 flex flex-wrap items-center gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="font-semibold" for="theme-mode">
            Theme mode
          </label>
          <p class="note mt-0!">
            {themeSettings().mode === 'sync'
              ? 'Follows your operating system: the day theme in light mode, the night theme in dark mode.'
              : 'Always use the same theme.'}
          </p>
        </div>
        <select
          id="theme-mode"
          class="form-select w-auto!"
          value={themeSettings().mode}
          onChange={(e) => setThemeSettings({ mode: e.currentTarget.value as 'single' | 'sync' })}
        >
          <option value="single">Single theme</option>
          <option value="sync">Sync with system</option>
        </select>
      </div>

      <Show
        when={themeSettings().mode === 'sync'}
        fallback={
          <div class="mb-6">
            <ThemeGrid name="single-theme" selected={themeSettings().single} onSelect={(id) => setThemeSettings({ single: id })} />
          </div>
        }
      >
        <SyncPanel kind="day" />
        <SyncPanel kind="night" />
      </Show>

      <Subhead title="Contrast" small />
      <div class="flex flex-col gap-4">
        <For each={['light', 'dark'] as const}>
          {(family) => (
            <label class="flex items-start gap-2">
              <input
                type="checkbox"
                class="mt-1"
                checked={themeSettings().contrast[family]}
                onChange={(e) =>
                  setThemeSettings({ contrast: { ...themeSettings().contrast, [family]: e.currentTarget.checked } })
                }
              />
              <span>
                <span class="font-semibold">Increase contrast for {family} themes</span>
                <span class="note">
                  Uses the high contrast variant of the selected {family} theme
                  {family === 'dark' ? ' (including Dark dimmed)' : ''} — stronger borders and text, for readability.
                </span>
              </span>
            </label>
          )}
        </For>
      </div>
    </>
  );
}
