import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import { toast, toastError } from '../../../components/ui';
import type { HookInput, Webhook } from '../api';
import { saveHook } from '../api';

export const HOOK_EVENTS = [
  'branch_protection_rule',
  'check_run',
  'check_suite',
  'commit_comment',
  'create',
  'delete',
  'deployment',
  'deployment_status',
  'discussion',
  'discussion_comment',
  'fork',
  'gollum',
  'issue_comment',
  'issues',
  'label',
  'member',
  'merge_group',
  'meta',
  'milestone',
  'package',
  'page_build',
  'public',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'pull_request_review_thread',
  'push',
  'registry_package',
  'release',
  'repository',
  'repository_ruleset',
  'security_advisory',
  'star',
  'status',
  'watch',
  'workflow_dispatch',
  'workflow_job',
  'workflow_run',
];

const titleCase = (e: string) => e.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Webhook create/edit form (payload URL, content type, secret, SSL, events, active). */
export default function HookForm(props: { owner: string; repo: string; base: string; hook: Webhook | null }) {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal(() => props.hook?.config.url ?? '');
  const [contentType, setContentType] = createSignal<'json' | 'form'>(() => props.hook?.config.content_type ?? 'form');
  const [secret, setSecret] = createSignal('');
  const [insecure, setInsecure] = createSignal(() => props.hook?.config.insecure_ssl === '1');
  const [active, setActive] = createSignal(() => props.hook?.active ?? true);
  const initialMode = () => {
    const ev = props.hook?.events ?? ['push'];
    return ev.includes('*') ? 'all' : ev.length === 1 && ev[0] === 'push' ? 'push' : 'custom';
  };
  const [mode, setMode] = createSignal<'push' | 'all' | 'custom'>(initialMode);
  const [events, setEvents] = createSignal<string[]>(() => (props.hook?.events ?? ['push']).filter((e) => e !== '*'));
  const [busy, setBusy] = createSignal(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const input: HookInput = {
        active: active(),
        events: mode() === 'all' ? ['*'] : mode() === 'push' ? ['push'] : events(),
        config: { url: url().trim(), content_type: contentType(), insecure_ssl: insecure() ? '1' : '0' },
      };
      // Leaving the secret blank on edit keeps the existing one.
      if (secret() || !props.hook) input.config.secret = secret();
      await saveHook(props.owner, props.repo, props.hook?.id ?? null, input);
      toast(props.hook ? 'Okay, the hook was successfully updated.' : 'Okay, that hook was successfully created.', 'success');
      navigate(`${props.base}/settings/hooks`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <p class="text-sm text-fg-muted mb-4">
        We’ll send a <code class="font-mono">POST</code> request to the URL below with details of any subscribed events. You
        can also specify which data format you’d like to receive (JSON, <code class="font-mono">x-www-form-urlencoded</code>,{' '}
        <em>etc</em>).
      </p>
      <div class="form-group mt-0!">
        <label for="hook-url">Payload URL *</label>
        <input
          id="hook-url"
          class="form-control max-w-[440px]"
          type="url"
          required
          placeholder="https://example.com/postreceive"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
      </div>
      <div class="form-group">
        <label for="hook-ct">Content type</label>
        <select
          id="hook-ct"
          class="form-select w-auto!"
          value={contentType()}
          onChange={(e) => setContentType(e.currentTarget.value as 'json' | 'form')}
        >
          <option value="form">application/x-www-form-urlencoded</option>
          <option value="json">application/json</option>
        </select>
      </div>
      <div class="form-group">
        <label for="hook-secret">Secret</label>
        <input
          id="hook-secret"
          class="form-control max-w-[440px]"
          type="password"
          autocomplete="new-password"
          placeholder={props.hook?.config.secret ? '•••••••• (unchanged)' : ''}
          value={secret()}
          onInput={(e) => setSecret(e.currentTarget.value)}
        />
      </div>
      <div class="form-group">
        <span class="form-label">SSL verification</span>
        <div class="flex gap-4 text-sm">
          <label class="flex items-center gap-1">
            <input type="radio" name="hook-ssl" checked={!insecure()} onChange={() => setInsecure(false)} />
            Enable SSL verification
          </label>
          <label class="flex items-center gap-1">
            <input type="radio" name="hook-ssl" checked={insecure()} onChange={() => setInsecure(true)} />
            <span>
              Disable <span class="text-fg-muted">(not recommended)</span>
            </span>
          </label>
        </div>
      </div>
      <div class="form-group">
        <span class="form-label">Which events would you like to trigger this webhook?</span>
        <div class="text-sm flex flex-col gap-1">
          <label class="flex items-center gap-2">
            <input type="radio" name="hook-mode" checked={mode() === 'push'} onChange={() => setMode('push')} />
            <span>
              Just the <code class="font-mono">push</code> event.
            </span>
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" name="hook-mode" checked={mode() === 'all'} onChange={() => setMode('all')} />
            <span>
              Send me <strong>everything</strong>.
            </span>
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" name="hook-mode" checked={mode() === 'custom'} onChange={() => setMode('custom')} /> Let me select
            individual events.
          </label>
        </div>
        <Show when={mode() === 'custom'}>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 mt-3 p-3 border border-line rounded-md">
            <For each={HOOK_EVENTS}>
              {(ev) => (
                <label class="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={events().includes(ev)}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      setEvents((list) => (on ? [...list, ev] : list.filter((x) => x !== ev)));
                    }}
                  />
                  {titleCase(ev)}
                </label>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div class="form-group">
                <label class="flex! items-start gap-2 font-normal!">
          <input type="checkbox" class="mt-1" checked={active()} onChange={(e) => setActive(e.currentTarget.checked)} />
          <span>
            <strong>Active</strong>
            <span class="note">We will deliver event details when this hook is triggered.</span>
          </span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary" disabled={busy() || (mode() === 'custom' && !events().length)}>
        {busy() ? 'Saving…' : props.hook ? 'Update webhook' : 'Add webhook'}
      </button>
    </form>
  );
}
