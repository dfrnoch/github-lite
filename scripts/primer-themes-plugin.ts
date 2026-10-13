import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { PALETTES } from '../src/lib/theme-palettes.ts';
import { buildPaletteCss } from './custom-themes.ts';

/**
 * Serves every Primer theme except the bundled light/dark defaults, plus the
 * community palettes (src/lib/theme-palettes.ts, built by custom-themes.ts), as
 * plain stylesheets at /themes/<name>.css (e.g. /themes/dark-dimmed.css,
 * /themes/catppuccin-mocha.css): generated on request in dev, emitted into the
 * client build otherwise. Fixed URLs let
 * the inline theme script in src/Document.tsx load the selected theme before
 * first paint, and src/lib/theme.ts load others on demand.
 */
export function primerThemes(): Plugin {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve('@primer/primitives/package.json')), 'dist/css/functional/themes');
  const BUNDLED = new Set(['light.css', 'dark.css']);
  const palettes = new Map(PALETTES.map((p) => [`${p.id.replace(/_/g, '-')}.css`, p]));
  const files = () => [...readdirSync(dir).filter((f) => f.endsWith('.css') && !BUNDLED.has(f)), ...palettes.keys()];
  // The token sheets are mostly documentation comments; strip them.
  const minify = (css: string) =>
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s*([{};:,])\s*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  const read = (file: string) => {
    const palette = palettes.get(file);
    return palette ? buildPaletteCss(palette, dir) : minify(readFileSync(join(dir, file), 'utf8'));
  };

  return {
    name: 'primer-themes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/themes\/([a-z-]+\.css)(\?.*)?$/);
        if (!m || !files().includes(m[1]!)) return next();
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        res.end(read(m[1]!));
      });
    },
    generateBundle() {
      if (this.environment?.name !== 'client') return;
      for (const file of files()) this.emitFile({ type: 'asset', fileName: `themes/${file}`, source: read(file) });
    },
  };
}
