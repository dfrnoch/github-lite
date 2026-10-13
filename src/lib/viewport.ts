const MARGIN = 8;

/**
 * Keep an absolutely positioned menu (`.SelectMenu` under its trigger) inside
 * the viewport: shift it horizontally when it would overflow either edge, and
 * open it upwards when there is more room above the trigger than below.
 * Use as a ref callback on the menu element: `<div ref={fitInViewport} …>`.
 */
export function fitInViewport(el: HTMLElement) {
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;

    let dx = 0;
    if (r.right > vw - MARGIN) dx = vw - MARGIN - r.right;
    if (r.left + dx < MARGIN) dx = MARGIN - r.left;
    if (dx) el.style.translate = `${Math.round(dx)}px 0`;

    const trigger = el.offsetParent?.getBoundingClientRect();
    const below = vh - r.top - MARGIN;
    const above = (trigger?.top ?? r.top) - MARGIN;
    if (r.height > below && above > below) {
      el.style.top = 'auto';
      el.style.bottom = '100%';
      el.style.marginTop = '0';
      el.style.marginBottom = '4px';
      el.style.maxHeight = `${Math.min(480, above - 4)}px`;
    } else if (r.height > below) {
      el.style.maxHeight = `${Math.max(160, below)}px`;
    }
  });
}
