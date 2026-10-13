import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../../../components/Octicon';
import { RelativeTime } from '../../../../../../components/ui';
import { deleteActionsSecret, getActionsSecrets, getOrgSecrets } from '../../../../../../features/repo-settings/api';
import SecretsTabs from '../../../../../../features/repo-settings/components/SecretsTabs';
import { ConfirmDialog, SectionHeading, Subhead } from '../../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../../features/repo/context';
import { lockIcon, pencilIcon, trashIcon } from '../../../../../../icons/octicons';

/** /:owner/:repo/settings/secrets/actions */
export default function ActionsSecrets() {
  const ctx = useRepo();
  const secrets = createMemo(() => getActionsSecrets(ctx.owner(), ctx.name()));
  const orgSecrets = createMemo(() => (ctx.repo().owner.type === 'Organization' ? getOrgSecrets(ctx.owner(), ctx.name()) : []));
  const remove = useAction(deleteActionsSecret);
  const [deleting, setDeleting] = createSignal<string | null>(null);
  return (
    <>
      <Title>{`Actions secrets · ${ctx.fullName()}`}</Title>
      <Subhead
        title="Actions secrets and variables"
        description="Secrets and variables allow you to manage reusable configuration data. Secrets are encrypted and are used for sensitive data. Anyone with collaborator access to this repository can use these secrets and variables for actions. They are not passed to workflows that are triggered by a pull request from a fork."
      />
      <SecretsTabs base={ctx.base()} active="secrets" />
      <div class="flex items-center mb-2">
        <h3 class="text-base font-semibold flex-1">Repository secrets</h3>
        <a class="btn btn-sm btn-primary" href={`${ctx.base()}/settings/secrets/actions/new`}>
          New repository secret
        </a>
      </div>
      <div class="Box">
        <For
          each={secrets()}
          fallback={
            <div class="Box-row text-center py-8!">
              <Octicon icon={lockIcon} size={24} class="text-fg-muted" />
              <p class="font-semibold mt-2">This repository has no secrets.</p>
            </div>
          }
        >
          {(s) => (
            <div class="Box-row flex items-center gap-3">
              <Octicon icon={lockIcon} class="text-fg-muted" />
              <code class="font-mono text-sm flex-1 font-semibold">{s.name}</code>
              <span class="text-xs text-fg-muted">
                Updated <RelativeTime datetime={s.updated_at} />
              </span>
              <a class="btn-octicon" href={`${ctx.base()}/settings/secrets/actions/${encodeURIComponent(s.name)}`} aria-label={`Update ${s.name}`}>
                <Octicon icon={pencilIcon} />
              </a>
              <button type="button" class="btn-octicon btn-octicon-danger" aria-label={`Remove ${s.name}`} onClick={() => setDeleting(s.name)}>
                <Octicon icon={trashIcon} />
              </button>
            </div>
          )}
        </For>
      </div>
      <Show when={orgSecrets().length}>
        <SectionHeading class="mt-8 text-base! font-semibold!">Organization secrets</SectionHeading>
        <div class="Box">
          <For each={orgSecrets()}>
            {(s) => (
              <div class="Box-row flex items-center gap-3">
                <Octicon icon={lockIcon} class="text-fg-muted" />
                <code class="font-mono text-sm flex-1">{s.name}</code>
                <span class="text-xs text-fg-muted">
                  Updated <RelativeTime datetime={s.updated_at} />
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
      <ConfirmDialog
        open={deleting() != null}
        onClose={() => setDeleting(null)}
        title="Remove secret"
        button="Yes, remove this secret"
        onConfirm={() => remove(ctx.owner(), ctx.name(), deleting()!)}
      >
        <p>
          Are you sure you want to delete <strong>{deleting()}</strong>?
        </p>
      </ConfirmDialog>
    </>
  );
}
