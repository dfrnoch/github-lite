import { revalidate, useParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Dropdown, MarkdownEditor, PageSpinner, toast, toastError } from '../../../../../components/ui';
import { fetchRaw } from '../../../../../features/code/api';
import { restoreFile } from '../../../../../features/code/refinedApi';
import { DraftCommentForm, ThreadView } from '../../../../../features/code/components/ReviewThreads';
import {
  addReviewComment,
  addSingleComment,
  deleteReviewComment,
  getPullFiles,
  getPullReviewState,
  getPullViewed,
  replyToThread,
  setFileViewed,
  setThreadResolved,
  submitReview,
  type ReviewEvent,
  type ReviewThread,
} from '../../../../../features/code/pullApi';
import DiffView, { lineKey, type LineRef, type Side } from '../../../../../features/diff/DiffView';
import { getPull } from '../../../../../features/pulls/api';
import { useRepo } from '../../../../../features/repo/context';
import { feature } from '../../../../../features/refined';
import { getViewer } from '../../../../../features/user/api';
import { triangleDownIcon } from '../../../../../icons/octicons';
import { encodePath } from '../../../../../lib/github';
import type { DiffFile } from '../../../../../lib/types';

/** /:owner/:repo/pull/:number/files — diff with review comments, viewed state and review submission. */
export default function PullFilesTab() {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const number = () => Number(params.number);
  const files = createMemo(() => getPullFiles(ctx.owner(), ctx.name(), number()));
  const review = createMemo(() => getPullReviewState(ctx.owner(), ctx.name(), number()));
  const pull = createMemo(() => getPull(ctx.owner(), ctx.name(), number()));
  const viewer = createMemo(() => getViewer().catch(() => null));
  const serverViewed = createMemo(() => getPullViewed(ctx.owner(), ctx.name(), number()).catch(() => ({}) as Record<string, boolean>));
  // Toggled locally right away; the GraphQL mutation follows.
  const [viewed, setViewed] = createSignal<Record<string, boolean>>(() => serverViewed());

  /** Live (non-outdated) threads keyed by the line they sit under. */
  const threadsByKey = createMemo(() => {
    const map = new Map<string, ReviewThread[]>();
    for (const t of review().threads) {
      if (t.line == null || t.isOutdated) continue;
      const key = lineKey(t.path, t.diffSide, t.line);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  });
  const outdated = createMemo(() => review().threads.filter((t) => t.line == null || t.isOutdated).length);
  const pendingCount = createMemo(
    () => review().threads.flatMap((t) => t.comments).filter((c) => c.state === 'PENDING').length,
  );
  const [drafts, setDrafts] = createSignal<Record<string, LineRef>>({});
  const extraKeys = createMemo(() => new Set([...threadsByKey().keys(), ...Object.keys(drafts())]));
  const closeDraft = (key: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const submitDraft = async (key: string, d: LineRef, kind: 'single' | 'review', body: string) => {
    const c = { path: d.path, line: d.line, side: d.side, startLine: d.startLine, startSide: d.startSide, body };
    if (kind === 'single') await addSingleComment(ctx.owner(), ctx.name(), number(), pull()!.head.sha, c);
    else await addReviewComment(ctx.owner(), ctx.name(), number(), review(), c);
    closeDraft(key);
  };

  const renderExtras = (path: string, side: Side, line: number) => {
    const key = lineKey(path, side, line);
    return (
      <>
        <For each={threadsByKey().get(key) ?? []}>
          {(thread) => (
            <ThreadView
              thread={thread}
              repo={ctx.fullName()}
              viewer={viewer()?.login}
              onReply={(id, body) => replyToThread(ctx.owner(), ctx.name(), number(), id, body)}
              onResolve={(resolved) => setThreadResolved(ctx.owner(), ctx.name(), number(), thread.id, resolved)}
              onDelete={(id) => deleteReviewComment(ctx.owner(), ctx.name(), number(), id)}
            />
          )}
        </For>
        <Show when={drafts()[key]}>
          {(draft) => (
            <DraftCommentForm
              draft={draft()}
              repo={ctx.fullName()}
              hasPendingReview={!!review().pendingReview}
              onCancel={() => closeDraft(key)}
              onSubmit={(kind, body) => submitDraft(key, draft(), kind, body)}
            />
          )}
        </Show>
      </>
    );
  };

  /** restore-file: commit the base version of a file back onto the PR branch. */
  const discard = async (f: DiffFile) => {
    const pr = pull();
    if (!pr?.head.repo) return;
    const name = f.filename.split('/').pop();
    if (!confirm(`Discard all the changes to ${f.filename} in this pull request? A new commit restoring the base version will be pushed to ${pr.head.ref}.`)) return;
    toast(`Restoring ${name}…`);
    try {
      await restoreFile(
        {
          owner: ctx.owner(),
          repo: ctx.name(),
          number: number(),
          headRepo: pr.head.repo.full_name,
          headBranch: pr.head.ref,
          headSha: pr.head.sha,
          baseRef: pr.base.ref,
          headLabel: pr.head.label,
        },
        f,
        `Discard changes to ${f.filename}`,
      );
      toast(`Changes to ${name} discarded`, 'success');
      revalidate([getPullFiles.keyFor(ctx.owner(), ctx.name(), number()), getPull.keyFor(ctx.owner(), ctx.name(), number())]);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <Loading fallback={<PageSpinner />}>
      <Show when={outdated()}>
        <p class="text-xs text-fg-muted mb-2">
          {outdated()} outdated {outdated() === 1 ? 'conversation is' : 'conversations are'} not shown here — see the{' '}
          <a href={`${ctx.base()}/pull/${number()}`}>Conversation</a> tab.
        </p>
      </Show>
      <DiffView
        files={files()}
        viewed={viewed()}
        onViewedChange={(path, value) => {
          setViewed((v) => ({ ...v, [path]: value }));
          void setFileViewed(review().pullId, path, value).catch((e) => {
            setViewed((v) => ({ ...v, [path]: !value }));
            toastError(e);
          });
        }}
        fileHref={(f) =>
          f.status === 'removed' || !pull()
            ? undefined
            : `/${pull()!.head.repo?.full_name ?? ctx.fullName()}/blob/${
                // actionable-pr-view-file: open PRs link the branch (editable) instead of the commit.
                feature('actionable-pr-view-file') && pull()!.state === 'open' && pull()!.head.repo
                  ? encodePath(pull()!.head.ref)
                  : pull()!.head.sha
              }/${encodePath(f.filename)}`
        }
        fileMenu={(f, close) => (
          <Show
            when={
              feature('restore-file') &&
              pull()?.state === 'open' &&
              pull()?.head.repo &&
              (!!ctx.repo().permissions?.push || viewer()?.login === pull()?.user.login)
            }
          >
            <button
              type="button"
              class="SelectMenu-item text-fg-danger!"
              onClick={() => {
                close();
                void discard(f);
              }}
            >
              Discard changes
            </button>
          </Show>
        )}
        loadContent={(f) =>
          pull()?.head.repo
            ? fetchRaw(pull()!.head.repo!.owner.login, pull()!.head.repo!.name, pull()!.head.sha, f.filename)
            : fetchRaw(ctx.owner(), ctx.name(), `refs/pull/${number()}/head`, f.filename)
        }
        extraKeys={extraKeys()}
        renderExtras={renderExtras}
        onAddComment={(ref) => setDrafts((d) => ({ ...d, [lineKey(ref.path, ref.side, ref.line)]: ref }))}
        toolbar={
          <ReviewMenu
            pendingCount={pendingCount()}
            isAuthor={!!viewer() && viewer()!.login === pull()?.user.login}
            onSubmit={(event, body) => submitReview(ctx.owner(), ctx.name(), number(), review(), event, body)}
          />
        }
      />
    </Loading>
  );
}

/** "Review changes ▾" — summary comment + Comment / Approve / Request changes. */
function ReviewMenu(props: {
  pendingCount: number;
  isAuthor: boolean;
  onSubmit: (event: ReviewEvent, body: string) => Promise<void>;
}) {
  const ctx = useRepo();
  const [body, setBody] = createSignal('');
  const [event, setEvent] = createSignal<ReviewEvent>('COMMENT');
  const [busy, setBusy] = createSignal(false);
  const submit = async (ev: ReviewEvent, close: () => void) => {
    setBusy(true);
    try {
      await props.onSubmit(ev, body().trim());
      setBody('');
      close();
      toast('Review submitted', 'success');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const options: { value: ReviewEvent; title: string; desc: string }[] = [
    { value: 'COMMENT', title: 'Comment', desc: 'Submit general feedback without explicit approval.' },
    { value: 'APPROVE', title: 'Approve', desc: 'Give your approval to merge these changes.' },
    { value: 'REQUEST_CHANGES', title: 'Request changes', desc: 'Submit feedback that must be addressed before merging.' },
  ];
  return (
    <Dropdown
      class="btn btn-sm btn-primary"
      align="right"
      menuClass="w-[min(560px,calc(100vw-32px))] p-3"
      button={
        <>
          {props.pendingCount ? 'Finish your review' : 'Review changes'}
          <Show when={props.pendingCount}>
            <span class="Counter bg-canvas! text-fg!">{props.pendingCount}</span>
          </Show>
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <div class="text-left" role="dialog" aria-label="Submit review">
          <h3 class="font-semibold mb-2">Finish your review</h3>
          <MarkdownEditor value={body()} onInput={setBody} repo={ctx.fullName()} minHeight={100} placeholder="Leave a comment" />
          <Show when={feature('one-click-review-submission')}>
            {/* one-click-review-submission: one button per review type instead of radios + submit. */}
            <div class="flex flex-wrap justify-end gap-2 mt-3">
              <button type="button" class="btn btn-sm" onClick={close}>
                Cancel
              </button>
              <For each={options}>
                {(o) => (
                  <button
                    type="button"
                    class={['btn btn-sm', { 'btn-primary': o.value === 'APPROVE', 'btn-danger': o.value === 'REQUEST_CHANGES' }]}
                    title={props.isAuthor && o.value !== 'COMMENT' ? 'Pull request authors can’t approve or request changes on their own pull request' : o.desc}
                    disabled={busy() || (props.isAuthor && o.value !== 'COMMENT') || (o.value !== 'APPROVE' && !body().trim() && !props.pendingCount)}
                    onClick={() => void submit(o.value, close)}
                  >
                    {o.title}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={!feature('one-click-review-submission')}>
          <div class="flex flex-col gap-2 mt-3">
            <For each={options}>
              {(o) => (
                <label
                  class={['flex items-start gap-2 text-sm', { 'opacity-50': props.isAuthor && o.value !== 'COMMENT' }]}
                  title={props.isAuthor && o.value !== 'COMMENT' ? 'Pull request authors can’t approve or request changes on their own pull request' : undefined}
                >
                  <input
                    type="radio"
                    name="review-event"
                    class="mt-1"
                    checked={event() === o.value}
                    disabled={props.isAuthor && o.value !== 'COMMENT'}
                    onChange={() => setEvent(o.value)}
                  />
                  <span>
                    <span class="font-semibold block">{o.title}</span>
                    <span class="text-xs text-fg-muted">{o.desc}</span>
                  </span>
                </label>
              )}
            </For>
          </div>
          <div class="flex justify-end gap-2 mt-3">
            <button type="button" class="btn btn-sm" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              disabled={busy() || (event() !== 'APPROVE' && !body().trim() && !props.pendingCount)}
              onClick={() => void submit(event(), close)}
            >
              {busy() ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
          </Show>
        </div>
      )}
    </Dropdown>
  );
}
