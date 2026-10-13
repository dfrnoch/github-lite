import { createEffect, createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, Spinner } from '../../../components/ui';
import { alertIcon, checkCircleFillIcon, checkIcon, triangleDownIcon } from '../../../icons/octicons';
import { checkRepoName } from '../api';

export interface OwnerOption {
  login: string;
  avatar_url: string;
  isViewer: boolean;
  /** Can the viewer create repositories here (org admins; members when the org allows). */
  role?: string;
}

/** GitHub's repo name rule: anything outside [A-Za-z0-9._-] becomes "-". */
export const normalizeRepoName = (name: string) => name.trim().replace(/[^A-Za-z0-9._-]+/g, '-');

/**
 * "Owner * / Repository name *" row of /new and /fork: owner dropdown with
 * avatars, name input with a debounced availability check.
 */
export default function OwnerName(props: {
  owners: OwnerOption[];
  owner: string;
  onOwner: (login: string) => void;
  name: string;
  onName: (name: string) => void;
  /**
   * Reports "owner/normalized-name" once that name is confirmed free (null
   * when taken). Compare it with the current owner + normalized name.
   */
  onAvailable?: (name: string | null) => void;
}) {
  const [debounced, setDebounced] = createSignal('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const normalized = () => normalizeRepoName(debounced());
  const taken = createMemo(() => (normalized() && props.owner ? checkRepoName(props.owner, normalized()) : undefined));
  const current = () => props.owners.find((o) => o.login === props.owner);

  // A prefilled name (fork, ?name=) is checked right away.
  onSettled(() => {
    if (props.name) setDebounced(props.name);
  });
  const schedule = (v: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => setDebounced(v), 350);
  };
  createEffect(
    () => (normalized() && taken() === null ? `${props.owner}/${normalized()}` : null),
    (key) => {
      props.onAvailable?.(key);
    },
  );

  return (
    <div>
      <div class="flex flex-wrap items-end gap-2">
        <div>
          <span class="form-label">Owner *</span>
          <Dropdown
            class="btn"
            menuClass="w-64 max-h-80 overflow-auto"
            header="Choose an owner"
            button={
              <>
                <Show when={current()} fallback={<span>Choose an owner</span>}>
                  {(o) => (
                    <>
                      <Avatar src={o().avatar_url} size={20} square={!o().isViewer} />
                      <span>{o().login}</span>
                    </>
                  )}
                </Show>
                <Octicon icon={triangleDownIcon} />
              </>
            }
          >
            {(close) => (
              <For each={props.owners}>
                {(o) => (
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      props.onOwner(o.login);
                      schedule(props.name);
                      close();
                    }}
                  >
                    <span class="w-4">
                      <Show when={o.login === props.owner}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    <Avatar src={o.avatar_url} size={20} square={!o.isViewer} />
                    {o.login}
                  </button>
                )}
              </For>
            )}
          </Dropdown>
        </div>
        <span class="text-2xl text-fg-muted pb-0.5">/</span>
        <div class="flex-1 min-w-[200px] max-w-[300px]">
          <label class="form-label" for="repo-name">
            Repository name *
          </label>
          <input
            id="repo-name"
            class="form-control"
            autocomplete="off"
            spellcheck="false"
            required
            value={props.name}
            onInput={(e) => {
              props.onName(e.currentTarget.value);
              schedule(e.currentTarget.value);
            }}
          />
        </div>
      </div>
      <Show when={normalized() && normalized() === normalizeRepoName(props.name)}>
        <div class="mt-2 text-sm min-h-[20px]">
          <Loading fallback={<span class="text-fg-muted flex items-center gap-1"><Spinner size={14} /> Checking availability…</span>}>
            <AvailabilityNote taken={!!taken()} name={normalized()} raw={props.name.trim()} />
          </Loading>
        </div>
      </Show>
    </div>
  );
}

function AvailabilityNote(props: { taken: boolean; name: string; raw: string }) {
  return (
    <Show
      when={!props.taken}
      fallback={
        <span class="text-fg-danger flex items-center gap-1">
          <Octicon icon={alertIcon} /> The repository <strong>{props.name}</strong> already exists on this account.
        </span>
      }
    >
      <span class="text-fg-success flex items-center gap-1">
        <Octicon icon={checkCircleFillIcon} /> <strong>{props.name}</strong> is available.
        <Show when={props.name !== props.raw}>
          <span class="text-fg-muted">Your new repository will be created as {props.name}.</span>
        </Show>
      </span>
    </Show>
  );
}
