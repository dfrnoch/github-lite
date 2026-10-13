import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, PageSpinner, RelativeTime } from '../../../components/ui';
import { versionsIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { escapeLines, highlightLines } from '../../../lib/highlight';
import type { Repository } from '../../../lib/types';
import { getRawFile } from '../../repo/api';
import Breadcrumbs from '../../repo/components/Breadcrumbs';
import { useFileTreeOpen } from '../../repo/components/CodeLayout';
import LatestCommit from '../../repo/components/LatestCommit';
import RefPicker from '../../repo/components/RefPicker';
import { getBlame, type BlameRange } from '../api';

/** GraphQL `age` runs 1 (newest) … 10 (oldest); newer changes get a darker swatch. */
const ageColor = (age: number) => `var(--display-orange-scale-${Math.min(9, Math.max(0, 10 - age))})`;

/** /blame/:ref/:path — who last changed each line, grouped in commit hunks. */
export default function BlameView(props: { repo: Repository; gitRef: string; path: string }) {
  // Memos so a revalidated repo object (same values) doesn't refetch the file.
  const owner = createMemo(() => props.repo.owner.login);
  const name = createMemo(() => props.repo.name);
  const base = () => `/${props.repo.full_name}`;
  const inTree = useFileTreeOpen();
  const ranges = createMemo(() => getBlame(owner(), name(), props.gitRef, props.path));
  const raw = createMemo(() => getRawFile(owner(), name(), props.gitRef, props.path));
  // Equality-gated: a revalidated but identical file doesn't re-highlight.
  const code = createMemo(() => raw().replace(/\n$/, ''));
  const lines = createMemo(async () => {
    const text = code();
    return (await highlightLines(text, props.path)) ?? escapeLines(text);
  });
  const lineCount = () => raw().split('\n').length - (raw().endsWith('\n') ? 1 : 0);

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <div class={{ 'lg:hidden': inTree() }}>
          <RefPicker
            owner={owner()}
            repo={name()}
            current={props.gitRef}
            defaultBranch={props.repo.default_branch}
            hrefFor={(ref) => `${base()}/blame/${encodePath(ref)}/${encodePath(props.path)}`}
          />
        </div>
        <div class="min-w-0 ml-2">
          <Breadcrumbs owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} isFile />
        </div>
      </div>
      <div class="Box mb-4">
        <Loading fallback={<div class="Box-header h-[49px] border-0!" />}>
          <LatestCommit owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
        </Loading>
      </div>
      <div class="Box">
        <div class="Box-header flex flex-wrap items-center gap-3 py-2!">
          <div class="SegmentedControl">
            <a class="SegmentedControl-item" href={`${base()}/blob/${encodePath(props.gitRef)}/${encodePath(props.path)}`}>
              Code
            </a>
            <span class="SegmentedControl-item selected">Blame</span>
          </div>
          <Loading>
            <span class="text-xs text-fg-muted font-mono">{lineCount()} lines</span>
          </Loading>
          <div class="flex-1" />
          <span class="flex items-center gap-1 text-xs text-fg-muted">
            Older
            <For each={[10, 9, 8, 7, 6, 5, 4, 3, 2, 1]}>
              {(age) => <span class="inline-block w-2 h-2.5" style={{ background: ageColor(age) }} />}
            </For>
            Newer
          </span>
        </div>
        <Loading fallback={<PageSpinner />}>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse">
              <tbody>
                <For each={ranges()}>
                  {(range) => <BlameHunk range={range} lines={lines()} base={base()} path={props.path} />}
                </For>
              </tbody>
            </table>
          </div>
        </Loading>
      </div>
    </>
  );
}

function BlameHunk(props: { range: BlameRange; lines: string[]; base: string; path: string }) {
  const numbers = createMemo(() => {
    const out: number[] = [];
    for (let n = props.range.startingLine; n <= props.range.endingLine; n++) out.push(n);
    return out;
  });
  const c = () => props.range.commit;
  const author = () => c().authors.nodes[0];
  const parent = () => c().parents.nodes[0]?.oid;
  return (
    <For each={numbers()}>
      {(n, i) => (
        <tr class={{ 'border-t border-line-muted': i() === 0 }}>
          <Show when={i() === 0}>
            <td rowspan={numbers().length} class="relative align-top w-[350px] min-w-[350px] max-w-[350px] p-0 border-r border-line-muted">
              <span class="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: ageColor(props.range.age) }} />
              <div class="flex items-center gap-2 pl-3 pr-1 h-[30px] text-xs">
                <span class="w-[86px] shrink-0 text-fg-muted whitespace-nowrap">
                  <RelativeTime datetime={c().committedDate} relative />
                </span>
                <Show when={author()}>
                  {(a) => (
                    <a href={a().user ? `/${a().user!.login}` : undefined} title={a().user?.login ?? a().name ?? ''} class="shrink-0 inline-flex">
                      <Avatar src={a().avatarUrl} size={16} />
                    </a>
                  )}
                </Show>
                <a
                  class="link-plain truncate flex-1 min-w-0 hover:text-fg-accent"
                  href={`${props.base}/commit/${c().oid}`}
                  title={`${c().messageHeadline}\n${c().abbreviatedOid}`}
                >
                  {c().messageHeadline}
                </a>
                <Show when={parent()}>
                  <a
                    class="btn-octicon w-6 h-6 shrink-0"
                    href={`${props.base}/blame/${parent()}/${encodePath(props.path)}`}
                    title="View blame prior to this change"
                    aria-label="View blame prior to this change"
                  >
                    <Octicon icon={versionsIcon} />
                  </a>
                </Show>
              </div>
            </td>
          </Show>
          <td id={`L${n}`} class={['blob-num', { 'pt-[5px]': i() === 0 }]} data-line-number={n} />
          {/* oxlint-disable-next-line solid/no-innerhtml -- escaped / highlighted source */}
          <td class={['blob-code shiki', { 'pt-[5px]': i() === 0 }]} innerHTML={props.lines[n - 1] || ' '} />
        </tr>
      )}
    </For>
  );
}
