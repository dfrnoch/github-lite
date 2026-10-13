import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../../../components/Octicon';
import { RelativeTime } from '../../../../../../components/ui';
import { deleteActionsVariable, getActionsVariables, getOrgVariables } from '../../../../../../features/repo-settings/api';
import SecretsTabs from '../../../../../../features/repo-settings/components/SecretsTabs';
import { ConfirmDialog, SectionHeading, Subhead } from '../../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../../features/repo/context';
import { pencilIcon, trashIcon } from '../../../../../../icons/octicons';

/** /:owner/:repo/settings/variables/actions */
export default function ActionsVariables() {
  const ctx = useRepo();
  const variables = createMemo(() => getActionsVariables(ctx.owner(), ctx.name()));
  const orgVariables = createMemo(() => (ctx.repo().owner.type === 'Organization' ? getOrgVariables(ctx.owner(), ctx.name()) : []));
  const remove = useAction(deleteActionsVariable);
  const [deleting, setDeleting] = createSignal<string | null>(null);
  return (
    <>
      <Title>{`Actions variables · ${ctx.fullName()}`}</Title>
      <Subhead
        title="Actions secrets and variables"
        description="Variables are shown as plain text and are used for non-sensitive configuration data. Anyone with collaborator access to this repository can use these variables for actions."
      />
      <SecretsTabs base={ctx.base()} active="variables" />
      <div class="flex items-center mb-2">
        <h3 class="text-base font-semibold flex-1">Repository variables</h3>
        <a class="btn btn-sm btn-primary" href={`${ctx.base()}/settings/variables/actions/new`}>
          New repository variable
        </a>
      </div>
      <div class="Box">
        <For each={variables()} fallback={<div class="Box-row text-center py-8! font-semibold">This repository has no variables.</div>}>
          {(v) => (
            <div class="Box-row flex items-center gap-3">
              <code class="font-mono text-sm font-semibold w-1/3 truncate">{v.name}</code>
              <code class="font-mono text-xs text-fg-muted flex-1 truncate">{v.value}</code>
              <span class="text-xs text-fg-muted">
                <RelativeTime datetime={v.updated_at} />
              </span>
              <a class="btn-octicon" href={`${ctx.base()}/settings/variables/actions/${encodeURIComponent(v.name)}`} aria-label={`Edit ${v.name}`}>
                <Octicon icon={pencilIcon} />
              </a>
              <button type="button" class="btn-octicon btn-octicon-danger" aria-label={`Remove ${v.name}`} onClick={() => setDeleting(v.name)}>
                <Octicon icon={trashIcon} />
              </button>
            </div>
          )}
        </For>
      </div>
      <Show when={orgVariables().length}>
        <SectionHeading class="mt-8 text-base! font-semibold!">Organization variables</SectionHeading>
        <div class="Box">
          <For each={orgVariables()}>
            {(v) => (
              <div class="Box-row flex items-center gap-3">
                <code class="font-mono text-sm w-1/3 truncate">{v.name}</code>
                <code class="font-mono text-xs text-fg-muted flex-1 truncate">{v.value}</code>
              </div>
            )}
          </For>
        </div>
      </Show>
      <ConfirmDialog
        open={deleting() != null}
        onClose={() => setDeleting(null)}
        title="Remove variable"
        button="Yes, remove this variable"
        onConfirm={() => remove(ctx.owner(), ctx.name(), deleting()!)}
      >
        <p>
          Are you sure you want to delete <strong>{deleting()}</strong>?
        </p>
      </ConfirmDialog>
    </>
  );
}
