import presetWind4 from '@unocss/preset-wind4';
import { defineConfig } from 'unocss';

// Colors resolve to Primer's functional design tokens (@primer/primitives),
// so every utility follows the active light/dark theme automatically.
const v = (name: string) => `var(--${name})`;
const status = ['accent', 'success', 'danger', 'attention', 'done', 'severe', 'open', 'closed', 'neutral', 'sponsors'] as const;

export default defineConfig({
  // The element reset comes from @unocss/reset (imported before primer.css in
  // App.tsx) so Primer's base styles win; wind4's own reset would override them.
  presets: [presetWind4({ preflights: { reset: false } })],
  theme: {
    colors: {
      // text-fg, text-fg-muted, text-fg-accent, …
      fg: {
        DEFAULT: v('fgColor-default'),
        muted: v('fgColor-muted'),
        disabled: v('fgColor-disabled'),
        link: v('fgColor-link'),
        'on-emphasis': v('fgColor-onEmphasis'),
        ...Object.fromEntries(status.map((s) => [s, v(`fgColor-${s}`)])),
      },
      // bg-canvas, bg-canvas-muted, bg-canvas-inset, bg-canvas-emphasis
      canvas: {
        DEFAULT: v('bgColor-default'),
        muted: v('bgColor-muted'),
        inset: v('bgColor-inset'),
        emphasis: v('bgColor-emphasis'),
      },
      // bg-accent-muted, bg-success-emphasis, …
      ...Object.fromEntries(
        status.map((s) => [s, { muted: v(`bgColor-${s}-muted`), emphasis: v(`bgColor-${s}-emphasis`) }]),
      ),
      // border-line, border-line-muted, border-line-accent, …
      line: {
        DEFAULT: v('borderColor-default'),
        muted: v('borderColor-muted'),
        emphasis: v('borderColor-emphasis'),
        translucent: v('borderColor-translucent'),
        ...Object.fromEntries(status.map((s) => [s, v(`borderColor-${s}-emphasis`)])),
        ...Object.fromEntries(status.map((s) => [`${s}-muted`, v(`borderColor-${s}-muted`)])),
      },
    },
    font: {
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
  },
});
