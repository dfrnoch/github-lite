import { useAction, useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { Blankslate, MarkdownEditor, toastError } from '../../../components/ui';
import { commentDiscussionIcon } from '../../../icons/octicons';
import { useRepo } from '../../repo/context';
import { categoryEmoji, createDiscussion, type DiscussionCategory, getDiscussionCategories } from '../api';

/** /discussions/new — pick a category, then title + body. */
export default function NewDiscussion() {
  const ctx = useRepo();
  const location = useLocation();
  const data = createMemo(() => getDiscussionCategories(ctx.owner(), ctx.name()));
  const slug = () => String(location.query.category ?? '');
  const category = createMemo(() => data().categories.find((c) => c.slug === slug()) ?? null);
  return (
    <div class="container-md px-4 md:px-6 py-8">
      <Show
        when={data().enabled}
        fallback={<Blankslate icon={commentDiscussionIcon} title="Discussions are not enabled for this repository" />}
      >
        <Show when={category()} fallback={<CategoryPicker categories={data().categories} />}>
          {(c) => <DiscussionForm repositoryId={data().repositoryId} category={c()} />}
        </Show>
      </Show>
    </div>
  );
}

function CategoryPicker(props: { categories: DiscussionCategory[] }) {
  const ctx = useRepo();
  return (
    <>
      <h1 class="text-2xl mb-1">Start a new discussion</h1>
      <p class="text-fg-muted mb-6">Select a discussion category</p>
      <div class="Box">
        <ul>
          <For each={props.categories}>
            {(c) => (
              <li class="Box-row flex items-center gap-3">
                <span class="w-10 h-10 flex items-center justify-center rounded-md bg-canvas-muted text-lg shrink-0">{categoryEmoji(c.emojiHTML)}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold">{c.name}</div>
                  <Show when={c.description}>
                    <div class="text-sm text-fg-muted">{c.description}</div>
                  </Show>
                </div>
                <a class="btn btn-sm" href={`${ctx.base()}/discussions/new?category=${encodeURIComponent(c.slug)}`}>
                  Get started
                </a>
              </li>
            )}
          </For>
        </ul>
      </div>
    </>
  );
}

function DiscussionForm(props: { repositoryId: string; category: DiscussionCategory }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const create = useAction(createDiscussion);
  const [title, setTitle] = createSignal('');
  const [body, setBody] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const submit = async (e?: SubmitEvent) => {
    e?.preventDefault();
    if (!title().trim()) return;
    setBusy(true);
    try {
      const number = await create(props.repositoryId, props.category.id, title().trim(), body());
      navigate(`${ctx.base()}/discussions/${number}`);
    } catch (err) {
      toastError(err);
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div class="flex items-center gap-3 mb-6">
        <span class="w-10 h-10 flex items-center justify-center rounded-md bg-canvas-muted text-lg">{categoryEmoji(props.category.emojiHTML)}</span>
        <div class="flex-1">
          <h1 class="text-xl font-semibold">Start a new discussion</h1>
          <p class="text-sm text-fg-muted">
            in <strong>{props.category.name}</strong> ·{' '}
            <a href={`${ctx.base()}/discussions/new`}>Change category</a>
          </p>
        </div>
      </div>
      <Show when={props.category.description}>
        <div class="flash mb-4">{props.category.description}</div>
      </Show>
      <div class="form-group mt-0!">
        <label class="block font-semibold mb-1" for="discussion-title">
          Title
        </label>
        <input
          id="discussion-title"
          class="form-control w-full"
          required
          autofocus
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </div>
      <div class="form-group">
        <label class="block font-semibold mb-1" for="discussion-body">
          Body
        </label>
        <MarkdownEditor
          id="discussion-body"
          value={body()}
          onInput={setBody}
          repo={ctx.fullName()}
          minHeight={220}
          placeholder={props.category.isAnswerable ? 'Ask a question, start a conversation, or make an announcement' : 'Start a conversation'}
          onSubmit={() => void submit()}
        />
      </div>
      <div class="flex justify-end mt-4">
        <button type="submit" class="btn btn-primary" disabled={busy() || !title().trim()}>
          {busy() ? 'Starting…' : 'Start discussion'}
        </button>
      </div>
    </form>
  );
}
