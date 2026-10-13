import { Title } from '@solidjs/meta';
import { useAction, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate, RelativeTime, Spinner, toast, toastError } from '../../../../../components/ui';
import {
  deleteHook,
  getHook,
  getHookDeliveries,
  getHookDelivery,
  pingHook,
  redeliverHook,
} from '../../../../../features/repo-settings/api';
import HookForm from '../../../../../features/repo-settings/components/HookForm';
import { ConfirmDialog, Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';
import { alertIcon, checkIcon, chevronDownIcon, chevronRightIcon, syncIcon, webhookIcon } from '../../../../../icons/octicons';

/** /:owner/:repo/settings/hooks/:id — edit + recent deliveries (?tab=deliveries). */
export default function EditHook() {
  const ctx = useRepo();
  const params = useParams<{ id: string }>();
  const [search] = useSearchParams<{ tab?: string }>();
  const navigate = useNavigate();
  const id = () => Number(params.id);
  const hook = createMemo(() => getHook(ctx.owner(), ctx.name(), id()));
  const ping = useAction(pingHook);
  const [deleting, setDeleting] = createSignal(false);
  const tab = () => (search.tab === 'deliveries' ? 'deliveries' : 'settings');
  const href = (t: string) => `${ctx.base()}/settings/hooks/${params.id}${t === 'deliveries' ? '?tab=deliveries' : ''}`;

  return (
    <>
      <Title>{`Webhook · ${ctx.fullName()}`}</Title>
      <Subhead
        title={
          <>
            <a class="link-muted" href={`${ctx.base()}/settings/hooks`}>
              Webhooks
            </a>{' '}
            / Manage webhook
          </>
        }
        actions={
          <>
            <button
              type="button"
              class="btn btn-sm"
              onClick={() => ping(ctx.owner(), ctx.name(), id()).then(() => toast('Ping sent', 'success')).catch(toastError)}
            >
              Test (ping)
            </button>
            <button type="button" class="btn btn-sm btn-danger" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </>
        }
      />
      <nav class="UnderlineNav mb-4">
        <div class="UnderlineNav-body">
          <a class={['UnderlineNav-item', { selected: tab() === 'settings' }]} href={href('settings')}>
            Settings
          </a>
          <a class={['UnderlineNav-item', { selected: tab() === 'deliveries' }]} href={href('deliveries')}>
            Recent Deliveries
          </a>
        </div>
      </nav>
      <Show when={tab() === 'settings'} fallback={<Deliveries hookId={id()} />}>
        <HookForm owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} hook={hook()} />
      </Show>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title="Delete webhook?"
        button="Yes, delete webhook"
        onConfirm={() =>
          deleteHook(ctx.owner(), ctx.name(), id()).then(() => {
            toast('Webhook deleted');
            navigate(`${ctx.base()}/settings/hooks`);
          })
        }
      >
        <p>This action cannot be undone. Future events will no longer be delivered to this webhook ({hook().config.url}).</p>
      </ConfirmDialog>
    </>
  );
}

function Deliveries(props: { hookId: number }) {
  const ctx = useRepo();
  const deliveries = createMemo(() => getHookDeliveries(ctx.owner(), ctx.name(), props.hookId));
  const [open, setOpen] = createSignal<number | null>(null);
  return (
    <div class="Box">
      <For each={deliveries()} fallback={<Blankslate icon={webhookIcon} title="No deliveries yet" />}>
        {(d) => (
          <div class="Box-row p-0!">
            <button
              type="button"
              class="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-canvas-muted"
              onClick={() => setOpen(open() === d.id ? null : d.id)}
            >
              <Octicon icon={open() === d.id ? chevronDownIcon : chevronRightIcon} class="text-fg-muted" />
              <Octicon
                icon={d.status_code >= 200 && d.status_code < 300 ? checkIcon : alertIcon}
                class={d.status_code >= 200 && d.status_code < 300 ? 'text-fg-success' : 'text-fg-danger'}
              />
              <Show when={d.redelivery}>
                <Octicon icon={syncIcon} class="text-fg-muted" aria-label="Redelivery" />
              </Show>
              <code class="font-mono flex-1 truncate">{d.guid}</code>
              <span class="Label">{d.action ? `${d.event}.${d.action}` : d.event}</span>
              <span class="text-fg-muted text-xs w-28 text-right">
                <RelativeTime datetime={d.delivered_at} />
              </span>
            </button>
            <Show when={open() === d.id}>
              <DeliveryDetail hookId={props.hookId} deliveryId={d.id} />
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

function DeliveryDetail(props: { hookId: number; deliveryId: number }) {
  const ctx = useRepo();
  const detail = createMemo(() => getHookDelivery(ctx.owner(), ctx.name(), props.hookId, props.deliveryId));
  const redeliver = useAction(redeliverHook);
  const [busy, setBusy] = createSignal(false);
  const headers = (h: Record<string, string> | null | undefined) =>
    Object.entries(h ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  return (
    <div class="px-4 pb-4 border-t border-line-muted bg-canvas-muted">
      <Loading fallback={<div class="py-4 flex justify-center"><Spinner size={20} /></div>}>
        <div class="flex items-center justify-between pt-3">
          <span class="text-xs text-fg-muted">
            Completed in {detail().duration.toFixed(2)} seconds · response {detail().status_code} {detail().status}
          </span>
          <button
            type="button"
            class="btn btn-sm"
            disabled={busy()}
            onClick={async () => {
              setBusy(true);
              try {
                await redeliver(ctx.owner(), ctx.name(), props.hookId, props.deliveryId);
                toast('Redelivery requested', 'success');
              } catch (e) {
                toastError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Octicon icon={syncIcon} /> Redeliver
          </button>
        </div>
        <h4 class="text-sm font-semibold mt-3 mb-1">Request headers</h4>
        <pre class="text-xs font-mono bg-canvas border border-line rounded-md p-2 overflow-auto">{headers(detail().request.headers)}</pre>
        <h4 class="text-sm font-semibold mt-3 mb-1">Payload</h4>
        <pre class="text-xs font-mono bg-canvas border border-line rounded-md p-2 overflow-auto max-h-[400px]">
          {JSON.stringify(detail().request.payload, null, 2)}
        </pre>
        <h4 class="text-sm font-semibold mt-3 mb-1">Response headers</h4>
        <pre class="text-xs font-mono bg-canvas border border-line rounded-md p-2 overflow-auto">{headers(detail().response.headers)}</pre>
        <h4 class="text-sm font-semibold mt-3 mb-1">Response body</h4>
        <pre class="text-xs font-mono bg-canvas border border-line rounded-md p-2 overflow-auto max-h-[300px]">{detail().response.payload ?? ''}</pre>
      </Loading>
    </div>
  );
}
