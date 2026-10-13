import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Spinner } from '../../../components/ui';
import { alertIcon, copilotIcon, fileIcon } from '../../../icons/octicons';
import { diffAnchor } from '../../diff/parse';
import type { PullDetail } from '../../issues/types';
import { getPullConflictFiles } from '../api';
import { MergeSection, StatusCircle } from './MergeSection';

const APPROX = 'Files changed on both branches since they diverged';

/** "This branch has conflicts that must be resolved" + Resolve conflicts + the (likely) conflicting files. */
export default function MergeConflicts(props: {
  owner: string;
  repo: string;
  pull: PullDetail;
  onCommandLine: () => void;
  onInsertComment?: (text: string) => void;
}) {
  const conflictsUrl = () => `https://github.com/${props.owner}/${props.repo}/pull/${props.pull.number}/conflicts`;
  return (
    <MergeSection
      icon={<StatusCircle tone="neutral" icon={alertIcon} />}
      title="This branch has conflicts that must be resolved"
      desc={
        <>
          Use the{' '}
          <a href={conflictsUrl()} target="_blank" rel="noreferrer">
            web editor
          </a>{' '}
          or the{' '}
          <button type="button" class="btn-link" onClick={() => props.onCommandLine()}>
            command line
          </button>{' '}
          to resolve conflicts before continuing.
        </>
      }
      action={
        <Show when={props.pull.viewerCanUpdate}>
          <a class="btn btn-sm" href={conflictsUrl()} target="_blank" rel="noreferrer" title="Resolve conflicts in GitHub’s web editor">
            Resolve conflicts
          </a>
          {/* Copilot next to the plain "Resolve conflicts" button. */}
          <Show when={props.onInsertComment}>
            <button
              type="button"
              class="btn btn-sm"
              title="Ask Copilot to resolve conflicts"
              aria-label="Ask Copilot to resolve conflicts"
              onClick={() => props.onInsertComment!('@copilot resolve the merge conflicts in this pull request')}
            >
              <Octicon icon={copilotIcon} />
            </button>
          </Show>
        </Show>
      }
    >
      <Loading
        fallback={
          <div class="MergeBox-files text-fg-muted text-xs flex items-center gap-2">
            <Spinner size={16} /> Finding conflicting files…
          </div>
        }
      >
        <ConflictFiles {...props} />
      </Loading>
    </MergeSection>
  );
}

function ConflictFiles(props: { owner: string; repo: string; pull: PullDetail }) {
  const files = createMemo(
    () =>
      getPullConflictFiles(
        props.owner,
        props.repo,
        props.pull.number,
        props.pull.baseRefName,
        props.pull.headRefOid,
        `${props.pull.headRepositoryOwner?.login ?? props.owner}:${props.pull.headRefName}`,
      ).catch(() => [] as string[]),
    { name: 'conflictFiles' },
  );
  return (
    <Show when={files().length}>
      <div class="MergeBox-files" title={APPROX}>
        <div class="text-xs text-fg-muted mb-1">
          {files().length === 1 ? 'Conflicting file' : `Conflicting files (${files().length})`}{' '}
          <span class="cursor-help underline decoration-dotted">(likely)</span>
        </div>
        <ul class="MergeBox-fileList">
          <For each={files()}>
            {(f) => (
              <li>
                <Octicon icon={fileIcon} class="text-fg-muted shrink-0" />
                <a class="font-mono text-fg truncate" href={`/${props.owner}/${props.repo}/pull/${props.pull.number}/files#${diffAnchor(f)}`} title={f}>
                  {f}
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}
