import { Title } from '@solidjs/meta';
import { useAction, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dialog, Dropdown, IssueLabel, PageSpinner, toastError } from '../../../components/ui';
import { createLabel, deleteLabel, getRepoLabels, updateLabel, type RepoLabel } from '../../../features/issues/api';
import IssuesSubnav from '../../../features/issues/components/IssuesSubnav';
import LabelForm from '../../../features/issues/components/LabelForm';
import { useRepo } from '../../../features/repo/context';
import { checkIcon, gitPullRequestIcon, issueOpenedIcon, searchIcon, tagIcon, triangleDownIcon } from '../../../icons/octicons';
import { pluralize } from '../../../lib/format';

const SORTS = [
  { value: 'name-asc', label: 'Alphabetically' },
  { value: 'name-desc', label: 'Reverse alphabetically' },
  { value: 'count-desc', label: 'Most issues' },
  { value: 'count-asc', label: 'Fewest issues' },
] as const;

/** /:owner/:repo/labels */
export default function LabelsPage() {
  const ctx = useRepo();
  const [params, setParams] = useSearchParams<{ q?: string; sort?: string }>();
  const labels = createMemo(() => getRepoLabels(ctx.owner(), ctx.name()));
  const canEdit = () => !!ctx.repo().permissions?.push || !!ctx.repo().permissions?.triage;
  const [creating, setCreating] = createSignal(false);
  const [search, setSearch] = createSignal(() => params.q ?? '');
  const add = useAction(createLabel);
  const sort = () => params.sort ?? 'name-asc';

  const visible = createMemo(() => {
    const q = (params.q ?? '').toLowerCase().trim();
    const list = labels().filter((l) => !q || l.name.toLowerCase().includes(q) || (l.description ?? '').toLowerCase().includes(q));
    const count = (l: RepoLabel) => l.openIssues + l.openPulls;
    switch (sort()) {
      case 'name-desc':
        return [...list].sort((a, b) => b.name.localeCompare(a.name));
      case 'count-desc':
        return [...list].sort((a, b) => count(b) - count(a));
      case 'count-asc':
        return [...list].sort((a, b) => count(a) - count(b));
      default:
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    }
  });

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Labels · ${ctx.fullName()}`}</Title>
      <IssuesSubnav base={ctx.base()} active="labels">
        <form
          class="flex flex-1 min-w-[200px]"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: search() || undefined });
          }}
        >
          <div class="relative flex-1">
            <Octicon icon={searchIcon} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              class="form-control w-full pl-8!"
              placeholder="Search all labels"
              aria-label="Search all labels"
              value={search()}
              onInput={(e) => {
                setSearch(e.currentTarget.value);
                setParams({ q: e.currentTarget.value || undefined }, { replace: true });
              }}
            />
          </div>
        </form>
        <Show when={canEdit()}>
          <button type="button" class="btn btn-primary" onClick={() => setCreating(true)}>
            New label
          </button>
        </Show>
      </IssuesSubnav>

      <Show when={creating()}>
        <div class="Box bg-canvas-muted p-4 mb-4">
          <LabelForm
            idPrefix="new-label"
            submitLabel="Create label"
            onCancel={() => setCreating(false)}
            onSubmit={(v) => add(ctx.owner(), ctx.name(), v).then(() => setCreating(false))}
          />
        </div>
      </Show>

      <div class="Box">
        <div class="Box-header flex items-center py-2!">
          <h2 class="flex-1 font-semibold text-sm">
            <Loading fallback="Labels">{pluralize(visible().length, 'label')}</Loading>
          </h2>
          <Dropdown
            class="btn-invisible btn-sm text-fg-muted!"
            align="right"
            button={
              <>
                Sort <Octicon icon={triangleDownIcon} />
              </>
            }
          >
            {(close) => (
              <For each={SORTS}>
                {(s) => (
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      close();
                      setParams({ sort: s.value === 'name-asc' ? undefined : s.value });
                    }}
                  >
                    <span class="w-4">
                      <Show when={sort() === s.value}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    {s.label}
                  </button>
                )}
              </For>
            )}
          </Dropdown>
        </div>
        <Loading fallback={<PageSpinner />}>
          <For
            each={visible()}
            fallback={
              <Blankslate icon={tagIcon} title={params.q ? 'No matching labels' : 'No labels'}>
                {params.q ? 'No labels match your search.' : 'There are no labels in this repository yet.'}
              </Blankslate>
            }
          >
            {(label) => <LabelRow label={label} canEdit={canEdit()} />}
          </For>
        </Loading>
      </div>
    </div>
  );
}

function LabelRow(props: { label: RepoLabel; canEdit: boolean }) {
  const ctx = useRepo();
  const [editing, setEditing] = createSignal(false);
  const [confirm, setConfirm] = createSignal(false);
  const save = useAction(updateLabel);
  const remove = useAction(deleteLabel);
  const query = (kind: string) => `${ctx.base()}/${kind}?q=${encodeURIComponent(`state:open label:"${props.label.name}"`)}`;

  return (
    <div class="Box-row">
      <Show
        when={!editing()}
        fallback={
          <LabelForm
            idPrefix={`label-${props.label.id}`}
            initial={{ name: props.label.name, color: props.label.color, description: props.label.description ?? '' }}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={(v) =>
              save(ctx.owner(), ctx.name(), props.label.name, { new_name: v.name, color: v.color, description: v.description }).then(() =>
                setEditing(false),
              )
            }
          />
        }
      >
        <div class="flex flex-wrap items-center gap-4">
          <div class="w-full md:w-1/4 min-w-0">
            <IssueLabel name={props.label.name} color={props.label.color} title={props.label.description} href={query('issues')} />
          </div>
          <div class="flex-1 min-w-0 text-xs text-fg-muted">{props.label.description}</div>
          <div class="w-40 text-xs text-fg-muted flex items-center gap-3">
            <Show when={props.label.openIssues}>
              <a class="link-muted inline-flex items-center gap-1" href={query('issues')} title={`${props.label.openIssues} open issues`}>
                <Octicon icon={issueOpenedIcon} /> {props.label.openIssues}
              </a>
            </Show>
            <Show when={props.label.openPulls}>
              <a class="link-muted inline-flex items-center gap-1" href={query('pulls')} title={`${props.label.openPulls} open pull requests`}>
                <Octicon icon={gitPullRequestIcon} /> {props.label.openPulls}
              </a>
            </Show>
          </div>
          <Show when={props.canEdit}>
            <div class="flex gap-3 text-xs">
              <button type="button" class="btn-link text-xs" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" class="btn-link text-xs text-fg-danger!" onClick={() => setConfirm(true)}>
                Delete
              </button>
            </div>
          </Show>
        </div>
      </Show>
      <Dialog open={confirm()} onClose={() => setConfirm(false)} title="Delete label" width="440px">
        <p class="text-sm">
          Are you sure? Deleting a label will remove it from all issues and pull requests. <IssueLabel name={props.label.name} color={props.label.color} />
        </p>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={async () => {
              setConfirm(false);
              try {
                await remove(ctx.owner(), ctx.name(), props.label.name);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            Delete label
          </button>
        </div>
      </Dialog>
    </div>
  );
}
