import { Title } from '@solidjs/meta';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate } from '../../../../../components/ui';
import { getHooks, type Webhook } from '../../../../../features/repo-settings/api';
import { Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';
import { alertIcon, checkIcon, dotFillIcon, webhookIcon } from '../../../../../icons/octicons';

export function HookStatusIcon(props: { hook: Webhook }) {
  const code = () => props.hook.last_response?.code;
  return (
    <Show
      when={code() != null}
      fallback={<Octicon icon={dotFillIcon} class="text-fg-muted" aria-label="This hook has never been triggered" />}
    >
      <Show when={code()! >= 200 && code()! < 300} fallback={<Octicon icon={alertIcon} class="text-fg-danger" aria-label="Last delivery failed" />}>
        <Octicon icon={checkIcon} class="text-fg-success" aria-label="Last delivery was successful" />
      </Show>
    </Show>
  );
}

/** /:owner/:repo/settings/hooks */
export default function HooksSettings() {
  const ctx = useRepo();
  const hooks = createMemo(() => getHooks(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`Webhooks · ${ctx.fullName()}`}</Title>
      <Subhead
        title="Webhooks"
        actions={
          <a class="btn btn-sm" href={`${ctx.base()}/settings/hooks/new`}>
            Add webhook
          </a>
        }
        description="Webhooks allow external services to be notified when certain events happen. When the specified events happen, we’ll send a POST request to each of the URLs you provide."
      />
      <div class="Box">
        <For each={hooks()} fallback={<Blankslate icon={webhookIcon} title="No webhooks yet" />}>
          {(hook) => (
            <div class="Box-row flex items-center gap-3">
              <HookStatusIcon hook={hook} />
              <div class="flex-1 min-w-0">
                <a class="font-semibold break-all" href={`${ctx.base()}/settings/hooks/${hook.id}`}>
                  {hook.config.url ?? hook.name}
                </a>
                <span class="text-fg-muted text-xs ml-1">
                  ({hook.events.includes('*') ? 'all events' : hook.events.join(', ')})
                </span>
                <Show when={!hook.active}>
                  <span class="Label ml-2">Inactive</span>
                </Show>
              </div>
              <a class="btn btn-sm" href={`${ctx.base()}/settings/hooks/${hook.id}`}>
                Edit
              </a>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
