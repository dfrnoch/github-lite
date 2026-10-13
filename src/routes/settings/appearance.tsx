import { Title } from '@solidjs/meta';
import { For, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import Subhead from '../../features/settings/components/Subhead';
import { checkIcon, deviceDesktopIcon, moonIcon, type OcticonData, sunIcon } from '../../icons/octicons';
import { type ColorMode, colorMode, setColorMode } from '../../lib/theme';

// Fixed palettes for the preview thumbnails (they show a theme, not the current one).
const PALETTE = {
  light: { bg: '#ffffff', muted: '#f6f8fa', line: '#d1d9e0', fg: '#59636e', accent: '#0969da' },
  dark: { bg: '#0d1117', muted: '#151b23', line: '#3d444d', fg: '#9198a1', accent: '#4493f8' },
};

const MODES: { mode: ColorMode; label: string; icon: OcticonData; description: string }[] = [
  { mode: 'auto', label: 'Sync with system', icon: deviceDesktopIcon, description: 'Follows your operating system setting.' },
  { mode: 'light', label: 'Light default', icon: sunIcon, description: 'Always use the light theme.' },
  { mode: 'dark', label: 'Dark default', icon: moonIcon, description: 'Always use the dark theme.' },
];

/** A tiny mock of a GitHub page in the given palette. */
function Mock(props: { theme: 'light' | 'dark' }) {
  const c = () => PALETTE[props.theme];
  return (
    <div class="h-full w-full p-3 flex flex-col gap-2" style={{ background: c().bg }}>
      <div class="h-3 rounded-sm" style={{ background: c().muted, border: `1px solid ${c().line}` }} />
      <div class="flex gap-2 flex-1">
        <div class="w-1/3 flex flex-col gap-1.5">
          <div class="h-2 rounded-full" style={{ background: c().accent, width: '70%' }} />
          <div class="h-2 rounded-full" style={{ background: c().line }} />
          <div class="h-2 rounded-full" style={{ background: c().line, width: '80%' }} />
        </div>
        <div class="flex-1 rounded-sm flex flex-col gap-1.5 p-1.5" style={{ border: `1px solid ${c().line}` }}>
          <div class="h-2 rounded-full" style={{ background: c().fg, width: '60%' }} />
          <div class="h-2 rounded-full" style={{ background: c().line }} />
          <div class="h-2 rounded-full" style={{ background: c().line, width: '85%' }} />
        </div>
      </div>
    </div>
  );
}

function Preview(props: { mode: ColorMode }) {
  return (
    <Show when={props.mode === 'auto'} fallback={<Mock theme={props.mode as 'light' | 'dark'} />}>
      <div class="relative h-full w-full">
        <Mock theme="light" />
        <div class="absolute inset-0" style={{ 'clip-path': 'polygon(100% 0, 100% 100%, 0 100%)' }}>
          <Mock theme="dark" />
        </div>
      </div>
    </Show>
  );
}

export default function AppearanceSettings() {
  return (
    <>
      <Title>Appearance</Title>
      <Subhead title="Theme preferences" />
      <p class="mb-4">
        Choose how GitHub Lite looks to you. Select a single theme, or sync with your system and automatically switch
        between day and night themes. This preference is stored in this browser only.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Theme mode">
        <For each={MODES}>
          {(m) => (
            <label
              class={[
                'Box overflow-hidden cursor-pointer block',
                { 'border-line-accent! outline outline-2 outline-[var(--borderColor-accent-emphasis)] -outline-offset-1': colorMode() === m.mode },
              ]}
            >
              <div class="h-[120px] border-b border-line">
                <Preview mode={m.mode} />
              </div>
              <div class="flex items-start gap-2 p-3">
                <input
                  type="radio"
                  name="color-mode"
                  class="mt-1"
                  value={m.mode}
                  checked={colorMode() === m.mode}
                  onChange={() => setColorMode(m.mode)}
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 font-semibold">
                    <Octicon icon={m.icon} class="text-fg-muted" />
                    {m.label}
                    <Show when={colorMode() === m.mode}>
                      <Octicon icon={checkIcon} class="text-fg-accent ml-auto" />
                    </Show>
                  </div>
                  <p class="text-xs text-fg-muted mt-0.5">{m.description}</p>
                </div>
              </div>
            </label>
          )}
        </For>
      </div>
      <p class="text-sm text-fg-muted mt-4">
        Additional theme variants (dimmed, high contrast, colorblind) and your github.com appearance settings are managed
        on{' '}
        <a href="https://github.com/settings/appearance" target="_blank" rel="noreferrer">
          github.com
        </a>
        .
      </p>
    </>
  );
}
