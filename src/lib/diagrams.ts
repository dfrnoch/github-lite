import type { Mermaid } from 'mermaid';

/**
 * GitHub renders some code blocks (```mermaid, geojson, topojson, stl) as
 * "render-needs-enrichment" sections that its own JavaScript swaps for an
 * iframe from viewscreen.githubusercontent.com. Without that the API's HTML
 * shows a loading spinner forever. This enriches them in-app instead:
 * Mermaid diagrams are rendered locally (the library is a lazy chunk loaded
 * only when a page contains a diagram), colored from the active theme's
 * tokens; other types fall back to showing their source.
 */

let mermaidP: Promise<Mermaid> | undefined;
let counter = 0;

const token = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function configure(mermaid: Mermaid) {
  const dark = document.documentElement.dataset.colorMode === 'dark' ||
    (document.documentElement.dataset.colorMode === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const fg = token('--fgColor-default', dark ? '#f0f6fc' : '#1f2328');
  const muted = token('--fgColor-muted', dark ? '#9198a1' : '#59636e');
  const bg = token('--bgColor-default', dark ? '#0d1117' : '#ffffff');
  const surface = token('--bgColor-muted', dark ? '#151b23' : '#f6f8fa');
  const inset = token('--bgColor-inset', dark ? '#010409' : '#f6f8fa');
  const border = token('--borderColor-default', dark ? '#3d444d' : '#d1d9e0');
  const accent = token('--fgColor-accent', dark ? '#4493f8' : '#0969da');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    darkMode: dark,
    fontFamily: getComputedStyle(document.body).fontFamily,
    // Diagrams often pin a theme via %%{init}%%; keep the app's theme instead
    // so they stay readable in every color theme.
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'theme', 'themeVariables', 'darkMode', 'fontFamily'],
    themeVariables: {
      darkMode: dark,
      background: bg,
      textColor: fg,
      primaryColor: surface,
      primaryTextColor: fg,
      primaryBorderColor: border,
      secondaryColor: inset,
      secondaryTextColor: fg,
      secondaryBorderColor: border,
      tertiaryColor: bg,
      tertiaryTextColor: fg,
      tertiaryBorderColor: border,
      mainBkg: surface,
      nodeBorder: border,
      lineColor: muted,
      clusterBkg: inset,
      clusterBorder: border,
      edgeLabelBackground: bg,
      titleColor: fg,
      noteBkgColor: inset,
      noteTextColor: fg,
      noteBorderColor: border,
      actorBkg: surface,
      actorBorder: border,
      actorTextColor: fg,
      signalColor: fg,
      signalTextColor: fg,
      labelBoxBkgColor: surface,
      labelBoxBorderColor: border,
      labelTextColor: fg,
      activationBkgColor: inset,
      activationBorderColor: accent,
      sequenceNumberColor: bg,
      git0: accent,
    },
  });
  return mermaid;
}

/** Find GitHub's enrichment sections under `root` and render them. */
export async function enrichDiagrams(root: HTMLElement) {
  const sections = [...root.querySelectorAll<HTMLElement>('section.js-render-needs-enrichment')];
  if (!sections.length) return;
  for (const section of sections) {
    section.querySelector('.js-render-enrichment-loader')?.remove();
    const code =
      section.querySelector('.js-render-enrichment-target')?.getAttribute('data-plain') ??
      section.querySelector('pre')?.textContent ??
      '';
    if (section.dataset.type !== 'mermaid' || !code.trim()) {
      section.classList.add('is-unsupported');
      continue;
    }
    try {
      mermaidP ??= import('mermaid').then((m) => m.default);
      const mermaid = configure(await mermaidP);
      const { svg } = await mermaid.render(`gh-mermaid-${++counter}`, code);
      let out = section.querySelector<HTMLElement>('.render-diagram');
      if (!out) {
        out = document.createElement('div');
        out.className = 'render-diagram';
        section.append(out);
      }
      out.innerHTML = svg;
      section.classList.remove('is-error');
      section.classList.add('is-rendered');
    } catch (err) {
      section.classList.add('is-error');
      section.setAttribute('data-error', err instanceof Error ? err.message.split('\n')[0]! : 'Unable to render diagram');
    }
  }
}
