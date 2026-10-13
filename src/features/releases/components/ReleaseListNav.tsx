import { For, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { chevronLeftIcon, chevronRightIcon } from '../../../icons/octicons';

export interface ReleaseListItem {
  key: string;
  label: string;
  href: string;
}

/** A Previous / Next control: a link, a handler, or nothing (disabled). */
export type ListStep = { href: string } | { onClick: () => void } | null;

/**
 * github.com's sticky "Release list" column: release names as a NavList
 * (the current one marked), with "‹ Previous  Next ›" below.
 */
export default function ReleaseListNav(props: {
  items: ReleaseListItem[];
  current: string | null;
  /** Intercept item clicks (in-page anchors scroll instead of navigating). */
  onItemClick?: (item: ReleaseListItem, e: MouseEvent) => void;
  prev: ListStep;
  next: ListStep;
}) {
  return (
    <div class="hidden md:block sticky top-0 self-start shrink-0 w-1/6 min-w-[195px] pr-6">
      <h2 class="pt-6 pb-2 text-xl font-semibold">Release list</h2>
      <nav aria-label="Release list navigation">
        <ul class="NavList">
          <For each={props.items}>
            {(item) => (
              <li>
                <a
                  class="NavList-item"
                  href={item.href}
                  title={item.label}
                  // An explicit "false" keeps the router from marking in-page anchors as the current page.
                  aria-current={props.current === item.key ? 'location' : 'false'}
                  onClick={(e) => props.onItemClick?.(item, e)}
                >
                  <span class="truncate">{item.label}</span>
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>
      <Show when={props.prev || props.next}>
        <div class="flex justify-between items-center mt-4 px-2 text-sm" role="navigation" aria-label="Release list pagination">
          <Step step={props.prev} label="Previous" rel="prev" />
          <Step step={props.next} label="Next" rel="next" />
        </div>
      </Show>
    </div>
  );
}

function Step(props: { step: ListStep; label: string; rel: 'prev' | 'next' }) {
  const content = () => (
    <>
      <Show when={props.rel === 'prev'}>
        <Octicon icon={chevronLeftIcon} />
      </Show>
      {props.label}
      <Show when={props.rel === 'next'}>
        <Octicon icon={chevronRightIcon} />
      </Show>
    </>
  );
  const cls = 'inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-canvas-muted';
  return (
    <Switch
      fallback={
        <span class="inline-flex items-center gap-1 px-2 py-1 text-fg-muted opacity-60 cursor-default" aria-disabled="true">
          {content()}
        </span>
      }
    >
      <Match when={props.step && 'href' in props.step ? props.step.href : null}>
        {(href) => (
          <a class={cls} href={href()} rel={props.rel}>
            {content()}
          </a>
        )}
      </Match>
      <Match when={props.step && 'onClick' in props.step ? props.step.onClick : null}>
        {(onClick) => (
          <button type="button" class={[cls, 'text-fg-accent']} onClick={() => onClick()()}>
            {content()}
          </button>
        )}
      </Match>
    </Switch>
  );
}
