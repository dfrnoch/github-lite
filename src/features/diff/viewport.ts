/**
 * Shared IntersectionObservers that mount diff chunks as they approach the
 * viewport and unmount them once they are far away again (two margins, so a
 * chunk at the edge doesn't flap). One pair of observers serves every chunk
 * on the page.
 */

/** Mount when within this distance of the viewport… */
const NEAR = '1200px 0px';
/** …and unmount once further away than this. */
const FAR = '3600px 0px';

interface Watcher {
  /** The element came within `NEAR` of the viewport. */
  near: () => void;
  /** The element left the `FAR` band; `height` is its current rendered height. */
  far: (height: number) => void;
}

const watchers = new WeakMap<Element, Watcher>();
let nearIO: IntersectionObserver | undefined;
let farIO: IntersectionObserver | undefined;

function observers() {
  nearIO ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) watchers.get(e.target)?.near();
    },
    { rootMargin: NEAR },
  );
  farIO ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (!e.isIntersecting) watchers.get(e.target)?.far(e.boundingClientRect.height);
    },
    { rootMargin: FAR },
  );
  return [nearIO, farIO] as const;
}

/** Watch `el`; returns the cleanup. */
export function watchViewport(el: Element, watcher: Watcher): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    watcher.near();
    return () => {};
  }
  const [near, far] = observers();
  watchers.set(el, watcher);
  near.observe(el);
  far.observe(el);
  return () => {
    watchers.delete(el);
    near.unobserve(el);
    far.unobserve(el);
  };
}
