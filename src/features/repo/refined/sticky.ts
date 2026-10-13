import { createEffect, onSettled } from 'solid-js';
import { feature } from '../../refined';

const MIN_WIDTH = 768; // Narrower layouts are single-column.

/**
 * sticky-sidebar: `<aside ref={stickySidebar()}>` keeps a sidebar in view
 * while scrolling, as long as it fits the viewport. Stickiness isn't
 * re-evaluated while the pointer is over the sidebar (so it doesn't jump
 * away while you interact with it).
 */
export function stickySidebar(offset = 16) {
  let el: HTMLElement | undefined;
  let enabled = false;
  const update = () => {
    if (!el) return;
    // Measure the content, not the stretched flex item.
    el.style.alignSelf = enabled ? 'flex-start' : '';
    const on = enabled && window.innerWidth >= MIN_WIDTH && el.offsetHeight + offset <= window.innerHeight;
    el.classList.toggle('rgh-sticky-sidebar', on);
    el.style.setProperty('--rgh-sticky-offset', `${offset}px`);
  };

  createEffect(
    () => feature('sticky-sidebar'),
    (on) => {
      enabled = on;
      update();
    },
  );

  onSettled(() => {
    const node = el;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 100);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(node);
    const enter = () => observer.disconnect();
    const leave = () => observer.observe(node);
    window.addEventListener('resize', onResize);
    node.addEventListener('mouseenter', enter);
    node.addEventListener('mouseleave', leave);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', leave);
    };
  });

  return (node: HTMLElement) => {
    el = node;
  };
}
