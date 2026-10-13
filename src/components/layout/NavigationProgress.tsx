import { useIsRouting } from '@solidjs/router';

/**
 * GitHub's thin blue progress bar at the top of the window while a navigation
 * loads (the old page stays visible until the new one is ready).
 */
export default function NavigationProgress() {
  const isRouting = useIsRouting();
  return <div class={['NavigationProgress', { 'is-active': isRouting() }]} role="progressbar" aria-hidden={isRouting() ? 'false' : 'true'} />;
}
