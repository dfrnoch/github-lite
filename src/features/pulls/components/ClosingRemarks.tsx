import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { tagIcon } from '../../../icons/octicons';

const EXPLANATION = 'https://github.com/refined-github/refined-github/wiki/Extended-feature-descriptions#closing-remarks';

/**
 * Refined GitHub closing-remarks: under a merged PR's timeline, the first
 * tag that includes it — or, if none yet, a nudge to draft a release.
 */
export default function ClosingRemarks(props: { owner: string; repo: string; info: { tag: string | null; hasTags: boolean; sha: string }; canPush: boolean }) {
  const info = () => props.info;
  const base = () => `/${props.owner}/${props.repo}`;
  return (
    <>
      <Show
        when={info().tag}
        fallback={
          <Show when={info().hasTags}>
            <Item>
              <span class="flex-1">
                This PR hasn’t been released yet,{' '}
                <a href={EXPLANATION} target="_blank" rel="noreferrer">
                  judging
                </a>{' '}
                by its{' '}
                <a href={`${base()}/commit/${info().sha}`}>
                  merge commit
                </a>
                .
              </span>
              <Show when={props.canPush}>
                <a class="btn btn-sm" href={`${base()}/releases/new`}>
                  Draft a new release
                </a>
              </Show>
            </Item>
          </Show>
        }
      >
        {(tag) => (
          <Item success>
            <span>
              This pull request first{' '}
              <a href={EXPLANATION} target="_blank" rel="noreferrer">
                appeared
              </a>{' '}
              in{' '}
              <a class="link-plain font-semibold" href={`${base()}/releases/tag/${encodeURIComponent(tag())}`}>
                {tag()}
              </a>
            </span>
          </Item>
        )}
      </Show>
    </>
  );
}

function Item(props: { success?: boolean; children: JSX.Element }) {
  return (
    <div class="TimelineItem ml-[72px]! py-3!" id="rgh-closing-remarks">
      <div class={['TimelineItem-badge', { 'bg-success-emphasis! text-fg-on-emphasis!': props.success }]}>
        <Octicon icon={tagIcon} />
      </div>
      <div class="TimelineItem-body min-w-0 text-sm flex flex-wrap items-center gap-2 text-fg!">{props.children}</div>
    </div>
  );
}
