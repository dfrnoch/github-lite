import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { arrowUpRightIcon, plusIcon, tagIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import type { Repository } from '../../../lib/types';
import { checkTagExists } from '../../releases/api';
import { tagHref } from '../../releases/versions';
import { getPublishState, MANY_UNRELEASED } from '../api';

const abbreviate = (s: string, max = 30) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** "3 unreleased commits" / "More than 20 unreleased commits". */
export const unreleasedLabel = (aheadBy: number) =>
  aheadBy === MANY_UNRELEASED ? 'More than 20 unreleased commits' : `${aheadBy} unreleased commit${aheadBy === 1 ? '' : 's'}`;

/**
 * Buttons next to the branch picker of the code views (DirectoryView /
 * FileView): unreleased commits on the repo root, a link to the tag's page on tags.
 */
export default function RefPickerExtras(props: { repo: Repository; gitRef: string; path: string }) {
  const isDefault = () => props.gitRef === props.repo.default_branch;
  return (
    <Errored fallback={null}>
      <Show when={isDefault() && !props.path}>
        <Loading>
          <UnreleasedCommitsButton repo={props.repo} />
        </Loading>
      </Show>
      <Show when={!isDefault() && !/^[0-9a-f]{40}$/i.test(props.gitRef)}>
        <Loading>
          <VisitTagButton repo={props.repo} gitRef={props.gitRef} />
        </Loading>
      </Show>
    </Errored>
  );
}

/** 🏷 +N linking to the compare view since the latest tag (+ "Draft a new release" for pushers). */
export function UnreleasedCommitsButton(props: { repo: Repository; withDraft?: boolean }) {
  const state = createMemo(() => getPublishState(props.repo.owner.login, props.repo.name));
  const base = () => `/${props.repo.full_name}`;
  return (
    <Show when={state().latestTag && state().aheadBy > 0 ? state() : null}>
      {(s) => (
        <div class="BtnGroup shrink-0">
          <a
            class="btn btn-sm px-2!"
            href={`${base()}/compare/${encodePath(s().latestTag!)}...${encodePath(s().defaultBranch)}`}
            title={`${unreleasedLabel(s().aheadBy)}\nsince ${abbreviate(s().latestTag!)}`}
            aria-label={`${unreleasedLabel(s().aheadBy)} since ${s().latestTag}`}
          >
            <Octicon icon={tagIcon} />
            <Show when={s().aheadBy !== MANY_UNRELEASED}>
              <sup class="-ml-1 text-[10px] font-semibold">+{s().aheadBy}</sup>
            </Show>
          </a>
          <Show when={props.withDraft !== false && props.repo.permissions?.push}>
            <a class="btn btn-sm px-2!" href={`${base()}/releases/new`} title="Draft a new release" aria-label="Draft a new release">
              <Octicon icon={plusIcon} />
            </a>
          </Show>
        </div>
      )}
    </Show>
  );
}

/** ↗ next to the ref picker when browsing a tag, to its release / tag page. */
function VisitTagButton(props: { repo: Repository; gitRef: string }) {
  const isTag = createMemo(() => checkTagExists(props.repo.owner.login, props.repo.name, props.gitRef));
  return (
    <Show when={isTag()}>
      <a class="btn btn-sm px-2!" href={tagHref(`/${props.repo.full_name}`, props.gitRef)} title="Visit tag" aria-label="Visit tag">
        <Octicon icon={arrowUpRightIcon} />
      </a>
    </Show>
  );
}
