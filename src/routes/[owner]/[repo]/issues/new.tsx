import { Title } from '@solidjs/meta';
import { useAction, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, IssueLabel, MarkdownEditor, toastError } from '../../../../components/ui';
import { createIssue, getAssignableUsers, getIssueTemplates, getMilestones, getRepoLabels, type IssueTemplate } from '../../../../features/issues/api';
import { PICKER_TRIGGER_CLASS, pickerTrigger, SidebarSection } from '../../../../features/issues/components/IssueSidebar';
import SelectPanel from '../../../../features/issues/components/SelectPanel';
import { useRepo } from '../../../../features/repo/context';
import { getViewer } from '../../../../features/user/api';
import { issueOpenedIcon, linkExternalIcon } from '../../../../icons/octicons';

type Params = { title?: string; body?: string; labels?: string; assignees?: string; milestone?: string; template?: string };

/** /:owner/:repo/issues/new — template chooser, then the new issue form. */
export default function NewIssuePage() {
  const ctx = useRepo();
  const [params] = useSearchParams<Params>();
  const templates = createMemo(() => getIssueTemplates(ctx.owner(), ctx.name()));
  // Show the chooser when the repo has templates and none was picked (or prefilled).
  const choosing = () => !params.template && params.title == null && params.body == null && templates().templates.length > 0;
  const template = () => templates().templates.find((t) => t.filename === params.template || t.name === params.template) ?? null;

  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`New Issue · ${ctx.fullName()}`}</Title>
      <h1 class="text-2xl font-semibold mb-4">Create new issue</h1>
      <Show when={!choosing()} fallback={<TemplateChooser templates={templates().templates} links={templates().contactLinks} />}>
        <NewIssueForm template={template()} />
      </Show>
    </div>
  );
}

function TemplateChooser(props: { templates: IssueTemplate[]; links: { name: string; about: string; url: string }[] }) {
  const ctx = useRepo();
  const href = (t: string) => `${ctx.base()}/issues/new?template=${encodeURIComponent(t)}`;
  return (
    <div class="Box">
      <For each={props.templates}>
        {(t) => (
          <div class="Box-row flex items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-semibold">{t.name}</div>
              <div class="text-sm text-fg-muted">{t.about}</div>
            </div>
            <a class="btn btn-sm btn-primary" href={href(t.filename)}>
              Get started
            </a>
          </div>
        )}
      </For>
      <For each={props.links}>
        {(l) => (
          <div class="Box-row flex items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-semibold">{l.name}</div>
              <div class="text-sm text-fg-muted">{l.about}</div>
            </div>
            <a class="btn btn-sm" href={l.url} target="_blank" rel="noreferrer">
              Open <Octicon icon={linkExternalIcon} />
            </a>
          </div>
        )}
      </For>
      <div class="Box-row flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <div class="font-semibold">Blank issue</div>
          <div class="text-sm text-fg-muted">Create a new issue from scratch</div>
        </div>
        <a class="btn btn-sm" href={`${ctx.base()}/issues/new?title=`}>
          Get started
        </a>
      </div>
    </div>
  );
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function NewIssueForm(props: { template: IssueTemplate | null }) {
  const ctx = useRepo();
  const [params] = useSearchParams<Params>();
  const navigate = useNavigate();
  const create = useAction(createIssue);
  const viewer = createMemo(() => getViewer());
  const canTriage = () => {
    const p = ctx.repo().permissions;
    return !!(p?.admin || p?.maintain || p?.push || p?.triage);
  };

  const [title, setTitle] = createSignal(() => params.title ?? props.template?.title ?? '');
  const [body, setBody] = createSignal(() => params.body ?? props.template?.body ?? '');
  const [labels, setLabels] = createSignal<string[]>(() => [...list(params.labels), ...(props.template?.labels?.nodes.map((l) => l.name) ?? [])]);
  const [assignees, setAssignees] = createSignal<string[]>(() => [
    ...list(params.assignees),
    ...(props.template?.assignees?.nodes.map((a) => a.login) ?? []),
  ]);
  const [milestone, setMilestone] = createSignal<string | null>(() => params.milestone ?? null);
  const [busy, setBusy] = createSignal(false);

  const labelData = createMemo(() => (canTriage() ? getRepoLabels(ctx.owner(), ctx.name()) : []));
  const milestones = createMemo(() => (canTriage() ? getMilestones(ctx.owner(), ctx.name(), 'open') : []));
  /** ?milestone= may be a number or a title. */
  const milestoneObj = () => milestones().find((m) => String(m.number) === milestone() || m.title === milestone()) ?? null;

  const submit = async (e?: SubmitEvent) => {
    e?.preventDefault();
    if (!title().trim()) return;
    setBusy(true);
    try {
      const issue = await create(ctx.owner(), ctx.name(), {
        title: title().trim(),
        body: body(),
        ...(canTriage()
          ? { labels: labels(), assignees: assignees(), milestone: milestoneObj()?.number ?? null }
          : {}),
      });
      navigate(`${ctx.base()}/issues/${issue.number}`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="flex flex-col md:flex-row gap-6" onSubmit={submit}>
      <div class="flex-1 min-w-0 flex gap-4">
        <Loading fallback={<span class="w-10 shrink-0" />}>
          <Avatar src={viewer().avatar_url} size={40} class="shrink-0 hidden md:block self-start" />
        </Loading>
        <div class="flex-1 min-w-0">
          <Show when={props.template}>
            {(t) => (
              <p class="text-sm mb-3 flex items-center gap-1">
                <Octicon icon={issueOpenedIcon} class="text-fg-muted" />
                <strong>{t().name}</strong>
                <span class="text-fg-muted">{t().about}</span>
                <a class="ml-2" href={`${ctx.base()}/issues/new`}>
                  Choose a different template
                </a>
              </p>
            )}
          </Show>
          <label class="form-label" for="issue-title">
            Add a title <span class="text-fg-danger">*</span>
          </label>
          <input
            id="issue-title"
            class="form-control w-full mb-4"
            placeholder="Title"
            required
            value={title()}
            autofocus
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
          <label class="form-label" for="issue-body">
            Add a description
          </label>
          <MarkdownEditor id="issue-body" value={body()} onInput={setBody} repo={ctx.fullName()} minHeight={240} placeholder="Type your description here…" onSubmit={() => void submit()} />
          <div class="flex justify-end gap-2 mt-4">
            <a class="btn" href={`${ctx.base()}/issues`}>
              Cancel
            </a>
            <button type="submit" class="btn btn-primary" disabled={busy() || !title().trim()}>
              {busy() ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
      <Show when={canTriage()}>
        <aside class="w-full md:w-[256px] shrink-0 text-sm">
          <SidebarSection
            title="Assignees"
            canEdit
            picker={
              <SelectPanel
                class="block"
                triggerClass={PICKER_TRIGGER_CLASS}
                trigger={pickerTrigger('Assignees')}
                title="Assign up to 10 people to this issue"
                align="right"
                multiple
                max={10}
                load={() => getAssignableUsers(ctx.owner(), ctx.name())}
                key={(u) => u.login}
                text={(u) => `${u.login} ${u.name ?? ''}`}
                render={(u) => (
                  <span class="flex items-center gap-2">
                    <Avatar src={u.avatarUrl} size={20} />
                    <span class="font-semibold">{u.login}</span>
                    <span class="text-fg-muted truncate font-normal">{u.name}</span>
                  </span>
                )}
                selected={assignees()}
                onApply={setAssignees}
              />
            }
          >
            <Show
              when={assignees().length}
              fallback={
                <span class="text-fg-muted">
                  No one —{' '}
                  <Loading fallback="assign yourself">
                    <button type="button" class="btn-link text-xs" onClick={() => setAssignees([viewer().login])}>
                      assign yourself
                    </button>
                  </Loading>
                </span>
              }
            >
              <ul class="flex flex-col gap-2">
                <For each={assignees()}>
                  {(login) => (
                    <li class="flex items-center gap-2 font-semibold">
                      <Avatar login={login} size={20} />
                      {login}
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </SidebarSection>
          <SidebarSection
            title="Labels"
            canEdit
            picker={
              <SelectPanel
                class="block"
                triggerClass={PICKER_TRIGGER_CLASS}
                trigger={pickerTrigger('Labels')}
                title="Apply labels to this issue"
                align="right"
                multiple
                load={() => labelData()}
                key={(l) => l.name}
                text={(l) => `${l.name} ${l.description ?? ''}`}
                render={(l) => (
                  <span class="flex items-start gap-2">
                    <span class="mt-1 w-3.5 h-3.5 rounded-full shrink-0" style={{ 'background-color': `#${l.color}` }} />
                    <span class="min-w-0">
                      <span class="block font-semibold">{l.name}</span>
                      <Show when={l.description}>
                        <span class="block text-xs text-fg-muted font-normal">{l.description}</span>
                      </Show>
                    </span>
                  </span>
                )}
                selected={labels()}
                onApply={setLabels}
              />
            }
          >
            <Show when={labels().length} fallback={<span class="text-fg-muted">None yet</span>}>
              <Loading>
                <div class="flex flex-wrap gap-1">
                  <For each={labels()}>
                    {(name) => <IssueLabel name={name} color={labelData().find((l) => l.name === name)?.color ?? 'ededed'} />}
                  </For>
                </div>
              </Loading>
            </Show>
          </SidebarSection>
          <SidebarSection
            title="Milestone"
            canEdit
            last
            picker={
              <SelectPanel
                class="block"
                triggerClass={PICKER_TRIGGER_CLASS}
                trigger={pickerTrigger('Milestone')}
                title="Set milestone"
                align="right"
                clearLabel="Clear this milestone"
                load={() => milestones()}
                key={(m) => String(m.number)}
                text={(m) => m.title}
                render={(m) => <span class="font-semibold">{m.title}</span>}
                selected={milestone() ? [String(milestoneObj()?.number ?? milestone())] : []}
                onApply={(keys) => setMilestone(keys[0] ?? null)}
              />
            }
          >
            <Loading>
              <Show when={milestoneObj()} fallback={<span class="text-fg-muted">No milestone</span>}>
                {(m) => <span class="font-semibold">{m().title}</span>}
              </Show>
            </Loading>
          </SidebarSection>
        </aside>
      </Show>
    </form>
  );
}
