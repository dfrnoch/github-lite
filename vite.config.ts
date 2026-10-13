import { fileRoutes } from 'filesystem-routing/vite';
import UnoCSS from 'unocss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import { primerThemes } from './scripts/primer-themes-plugin.ts';

export default defineConfig(({ mode }) => {
  // Expose GITHUB_* from .env to server functions in development (OAuth).
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'GITHUB_'));

  return {
    // Client start mode: the app renders in the browser onto a prerendered
    // shell. `serverFunctions` keeps a tiny server bundle around for the one
    // thing a browser cannot do on its own — the OAuth code→token exchange,
    // which needs the client secret (see src/lib/oauth.ts). Without the OAuth
    // env vars the app still works purely client-side with a token, and
    // dist/client can be deployed to any static host.
    plugins: [
      solid({
        start: { node: true },
        serverFunctions: true,
        extensions: ['.jsx', '.tsx'],
        diagnostics: true,
      }),
      fileRoutes({ types: true }),
      UnoCSS(), // config in uno.config.ts
      primerThemes(), // /themes/<name>.css for the non-default Primer themes
    ],
    server: {
      port: 3000,
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./vitest-setup.ts'],
      isolate: false,
    },
    build: {
      target: 'esnext',
      assetsInlineLimit: 0,
    },
    // The syntax-highlight worker (src/lib/highlight.worker.ts) lazy-loads
    // Shiki grammars, so it must be an ES module worker to keep code splitting.
    worker: {
      format: 'es',
    },
  };
});
