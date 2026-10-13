import { createSignal } from 'solid-js';

export type ColorMode = 'auto' | 'light' | 'dark';
const KEY = 'gh-lite:color-mode';

const initial = (typeof localStorage !== 'undefined' && (localStorage.getItem(KEY) as ColorMode)) || 'auto';
const [colorMode, setColorModeSignal] = createSignal<ColorMode>(initial);
export { colorMode };

/** Switch theme; Primer's token sheets key off <html data-color-mode>. */
export function setColorMode(mode: ColorMode) {
  localStorage.setItem(KEY, mode);
  document.documentElement.dataset.colorMode = mode;
  setColorModeSignal(mode);
}
