import { query, useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, Spinner, toast, toastError } from '../../../components/ui';
import { triangleDownIcon } from '../../../icons/octicons';
import { gh } from '../../../lib/github';
import { getRefNames } from '../../repo/api';
import { useRepo } from '../../repo/context';
import { dispatchWorkflow, getWorkflowFile } from '../api';
import type { DispatchInput, Workflow } from '../types';
import { workflowDispatch } from '../yaml';

/** Deployment environments (for `type: environment` inputs). */
const getEnvironments = query(async (owner: string, repo: string) => {
  try {
    const data = await gh<{ environments: { name: string }[] }>(`/repos/${owner}/${repo}/environments`, {
      query: { per_page: 100 },
    });
    return data.environments.map((e) => e.name);
  } catch {
    return [] as string[];
  }
}, 'actions-environments');

/**
 * github.com's "Run workflow ▾" popover for `workflow_dispatch`: pick the
 * branch, fill the inputs declared in the workflow file on that branch, run.
 */
export default function RunWorkflowButton(props: { workflow: Workflow; defaultBranch: string }) {
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-[340px] max-h-[600px]! p-0!"
      button={
        <>
          Run workflow <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => <RunWorkflowForm workflow={props.workflow} defaultBranch={props.defaultBranch} close={close} />}
    </Dropdown>
  );
}

function RunWorkflowForm(props: { workflow: Workflow; defaultBranch: string; close: () => void }) {
  const ctx = useRepo();
  const [ref, setRef] = createSignal(() => props.defaultBranch);
  const refs = createMemo(() => getRefNames(ctx.owner(), ctx.name()));
  const source = createMemo(() => getWorkflowFile(ctx.owner(), ctx.name(), props.workflow.path, ref()));
  const info = createMemo(() => (source() ? workflowDispatch(source()!) : null));
  const [values, setValues] = createSignal<Record<string, string | boolean>>({});
  const [busy, setBusy] = createSignal(false);
  const run = useAction(dispatchWorkflow);

  const valueOf = (input: DispatchInput): string | boolean => {
    const v = values()[input.name];
    if (v !== undefined) return v;
    if (input.type === 'boolean') return input.default === 'true';
    return input.default ?? (input.type === 'choice' ? (input.options?.[0] ?? '') : '');
  };
  const set = (name: string, v: string | boolean) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const inputs: Record<string, string | boolean> = {};
    for (const input of info()?.inputs ?? []) {
      const v = valueOf(input);
      // The API wants strings for everything but booleans.
      inputs[input.name] = typeof v === 'boolean' ? v : String(v);
    }
    setBusy(true);
    try {
      await run(ctx.owner(), ctx.name(), props.workflow.id, ref(), inputs);
      toast('Workflow run was successfully requested.', 'success');
      props.close();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="p-4 text-sm" onSubmit={submit}>
      <div class="form-group mt-0!">
        <label class="block font-semibold mb-1" for="dispatch-ref">
          Use workflow from
        </label>
        <Loading fallback={<select class="form-select w-full" disabled><option>{ref()}</option></select>}>
          <select id="dispatch-ref" class="form-select w-full" value={ref()} onChange={(e) => setRef(e.currentTarget.value)}>
            <optgroup label="Branches">
              <For each={refs().branches.includes(props.defaultBranch) ? refs().branches : [props.defaultBranch, ...refs().branches]}>
                {(b: string) => (
                  <option value={b} selected={b === ref()}>
                    {b}
                  </option>
                )}
              </For>
            </optgroup>
            <Show when={refs().tags.length}>
              <optgroup label="Tags">
                <For each={refs().tags}>
                  {(t: string) => (
                    <option value={t} selected={t === ref()}>
                      {t}
                    </option>
                  )}
                </For>
              </optgroup>
            </Show>
          </select>
        </Loading>
      </div>
      <Loading fallback={<div class="flex justify-center py-4 text-fg-muted"><Spinner size={20} /></div>}>
        <Switch>
          <Match when={!source()}>
            <p class="flash flash-warn mt-3">The workflow file does not exist on this branch.</p>
          </Match>
          <Match when={!info()?.dispatchable}>
            <p class="flash flash-warn mt-3">
              Workflow does not have <code>workflow_dispatch</code> trigger on this branch.
            </p>
          </Match>
          <Match when={info()}>
            {(i) => (
              <For each={i().inputs}>
                {(input) => <InputField input={input} value={valueOf(input)} onChange={(v) => set(input.name, v)} />}
              </For>
            )}
          </Match>
        </Switch>
        <button type="submit" class="btn btn-primary btn-sm mt-4" disabled={busy() || !info()?.dispatchable}>
          {busy() ? 'Requesting…' : 'Run workflow'}
        </button>
      </Loading>
    </form>
  );
}

function InputField(props: { input: DispatchInput; value: string | boolean; onChange: (v: string | boolean) => void }) {
  const ctx = useRepo();
  const id = () => `dispatch-input-${props.input.name}`;
  const label = () => props.input.description || props.input.name;
  return (
    <div class="form-group mt-3!">
      <Show
        when={props.input.type !== 'boolean'}
        fallback={
          <label class="flex items-start gap-2 font-normal">
            <input
              type="checkbox"
              class="mt-0.5"
              checked={props.value === true}
              onChange={(e) => props.onChange(e.currentTarget.checked)}
            />
            <span>{label()}</span>
          </label>
        }
      >
        <label class="block font-semibold mb-1" for={id()}>
          {label()}
          <Show when={props.input.required}>
            <span class="text-fg-danger"> *</span>
          </Show>
        </label>
        <Switch
          fallback={
            <input
              id={id()}
              class="form-control w-full"
              type={props.input.type === 'number' ? 'number' : 'text'}
              required={props.input.required}
              value={String(props.value)}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
          }
        >
          <Match when={props.input.type === 'choice'}>
            <select id={id()} class="form-select w-full" value={String(props.value)} onChange={(e) => props.onChange(e.currentTarget.value)}>
              <For each={props.input.options ?? []}>
                {(o) => (
                  <option value={o} selected={o === String(props.value)}>
                    {o}
                  </option>
                )}
              </For>
            </select>
          </Match>
          <Match when={props.input.type === 'environment'}>
            <Loading fallback={<select class="form-select w-full" disabled />}>
              <EnvironmentSelect
                id={id()}
                owner={ctx.owner()}
                repo={ctx.name()}
                value={String(props.value)}
                required={!!props.input.required}
                onChange={props.onChange}
              />
            </Loading>
          </Match>
        </Switch>
      </Show>
    </div>
  );
}

function EnvironmentSelect(props: {
  id: string;
  owner: string;
  repo: string;
  value: string;
  required: boolean;
  onChange: (v: string) => void;
}) {
  const envs = createMemo(() => getEnvironments(props.owner, props.repo));
  return (
    <select id={props.id} class="form-select w-full" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
      <Show when={!props.required}>
        <option value="">None</option>
      </Show>
      <For each={envs()}>
        {(e) => (
          <option value={e} selected={e === props.value}>
            {e}
          </option>
        )}
      </For>
    </select>
  );
}
