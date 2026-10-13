/**
 * Dev only: browser extensions (password managers, …) run content scripts in
 * the page, and their errors reach `window`'s error / unhandledrejection
 * events like the app's own — where the dev overlay reports them as if the
 * app had crashed. Stop those before the overlay sees them (they still reach
 * the console). Capture listeners on the target run before bubble ones.
 */
const EXTENSION = /(?:safari-web-extension|chrome-extension|moz-extension|webkit-masked-url):\/\//;

function fromExtension(error: unknown, filename?: string) {
  if (EXTENSION.test(filename ?? '')) return true;
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  if (EXTENSION.test(stack)) return true;
  // A stack with frames, none of them from this origin: an injected script
  // (Safari may report those frames by bare file name, e.g. "content.js:39").
  return /:\d+:\d+/.test(stack) && !stack.includes(location.origin);
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (e) => {
      if (fromExtension(e.error, e.filename)) e.stopImmediatePropagation();
    },
    true,
  );
  window.addEventListener(
    'unhandledrejection',
    (e) => {
      if (fromExtension(e.reason)) e.stopImmediatePropagation();
    },
    true,
  );
}
