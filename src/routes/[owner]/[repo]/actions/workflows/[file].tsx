import { Title } from '@solidjs/meta';
import { useAction, useLocation, useParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal, Loading, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Dropdown, toast, toastError } from '../../../../../components/ui';
import { getWorkflow, getWorkflowFile, setWorkflowEnabled } from '../../../../../features/actions/api';
import ActionsShell, { workflowFile } from '../../../../../features/actions/components/ActionsShell';
import RunsList from '../../../../../features/actions/components/RunsList';
import RunWorkflowButton from '../../../../../features/actions/components/RunWorkflowButton';
import type { Workflow } from '../../../../../features/actions/types';
import { workflowDispatch } from '../../../../../features/actions/yaml';
import { useRepo } from '../../../../../features/repo/context';
import { fileIcon, kebabHorizontalIcon, stopIcon } from '../../../../../icons/octicons';
import { encodePath } from '../../../../../lib/github';

/** /:owner/:repo/actions/workflows/:file — runs of one workflow. */
export default function WorkflowPage() {
  const ctx = useRepo();
  const params = useParams<{ file: string }>();
  const workflow = createMemo(() => getWorkflow(ctx.owner(), ctx.name(), params.file));

  return (
    <ActionsShell active={params.file}>
      <Title>{`${workflow().name} · Workflow runs · ${ctx.fullName()}`}</Title>
      <RunsList
        workflow={params.file}
        heading={
          <>
            <h2 class="text-xl break-words">{workflow().name}</h2>
            <Show when={!workflow().path.startsWith('dynamic/')}>
              <a
                class="link-muted text-sm mt-1 inline-block"
                href={`${ctx.base()}/blob/${encodePath(ctx.repo().default_branch)}/${encodePath(workflow().path)}`}
              >
                {workflowFile(workflow().path)}
              </a>
            </Show>
          </>
        }
        actions={<WorkflowMenu workflow={workflow()} />}
        banner={
          <Loading>
            <WorkflowBanner workflow={workflow()} file={params.file} />
          </Loading>
        }
      />
    </ActionsShell>
  );
}

function WorkflowMenu(props: { workflow: Workflow }) {
  const ctx = useRepo();
  const toggle = useAction(setWorkflowEnabled);
  const disabled = () => props.workflow.state.startsWith('disabled');
  const canWrite = () => !!ctx.repo().permissions?.push;
  return (
    <Dropdown class="btn btn-octicon border! border-line! rounded-md!" align="right" menuClass="w-[240px]" title="Show workflow options" button={<Octicon icon={kebabHorizontalIcon} />}>
      {(close) => (
        <>
          <Show when={!props.workflow.path.startsWith('dynamic/')}>
            <a
              class="SelectMenu-item"
              href={`${ctx.base()}/blob/${encodePath(ctx.repo().default_branch)}/${encodePath(props.workflow.path)}`}
              onClick={close}
            >
              <Octicon icon={fileIcon} />
              View workflow file
            </a>
          </Show>
          <Show when={canWrite()}>
            <button
              type="button"
              class={['SelectMenu-item', { danger: !disabled() }]}
              onClick={async () => {
                close();
                try {
                  await toggle(ctx.owner(), ctx.name(), props.workflow.id, disabled());
                  toast(disabled() ? 'Workflow enabled.' : 'Workflow disabled.', 'success');
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <Octicon icon={stopIcon} />
              {disabled() ? 'Enable workflow' : 'Disable workflow'}
            </button>
          </Show>
        </>
      )}
    </Dropdown>
  );
}

/** Disabled notice / workflow_dispatch "Run workflow" bar, shown above the runs. */
function WorkflowBanner(props: { workflow: Workflow; file: string }) {
  const ctx = useRepo();
  const toggle = useAction(setWorkflowEnabled);
  const [busy, setBusy] = createSignal(false);
  // Fetched from the URL alone ('' ref = default branch), in parallel with the workflow itself.
  const source = createMemo(() => getWorkflowFile(ctx.owner(), ctx.name(), `.github/workflows/${props.file}`, ''));
  const dispatchable = () => {
    const s = source();
    return !!s && workflowDispatch(s).dispatchable;
  };
  const disabled = () => props.workflow.state.startsWith('disabled');
  const canWrite = () => !!ctx.repo().permissions?.push;
  // github-actions-indicators: the sidebar's ▶ links here with #rgh-run-workflow to open "Run workflow".
  const location = useLocation();
  let runBox: HTMLSpanElement | undefined;
  createEffect(
    () => location.hash === '#rgh-run-workflow' && !disabled() && dispatchable() && canWrite(),
    (open) => {
      if (!open) return;
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
      queueMicrotask(() => runBox?.querySelector('button')?.click());
    },
  );
  return (
    <div>
      <Show when={disabled()}>
        <div class="flash flash-warn flex items-center gap-4 mb-4">
          <span class="flex-1">
            This workflow was disabled {props.workflow.state === 'disabled_inactivity' ? 'automatically due to inactivity' : props.workflow.state === 'disabled_fork' ? 'because this is a fork' : 'manually'}.
          </span>
          <Show when={canWrite()}>
            <button
              type="button"
              class="btn btn-sm"
              disabled={busy()}
              onClick={async () => {
                setBusy(true);
                try {
                  await toggle(ctx.owner(), ctx.name(), props.workflow.id, true);
                  toast('Workflow enabled.', 'success');
                } catch (e) {
                  toastError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enable workflow
            </button>
          </Show>
        </div>
      </Show>
      <Show when={!disabled() && dispatchable() && canWrite()}>
        <div class="flash flex items-center gap-4 mb-4">
          <span class="flex-1">
            This workflow has a <code class="text-xs bg-canvas-muted px-1 rounded">workflow_dispatch</code> event trigger.
          </span>
          <span class="contents" ref={(el) => (runBox = el)}>
            <RunWorkflowButton workflow={props.workflow} defaultBranch={ctx.repo().default_branch} />
          </span>
        </div>
      </Show>
    </div>
  );
}
