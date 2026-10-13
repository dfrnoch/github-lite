import { createSignal, For } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { CopyButton, Dropdown } from '../../../components/ui';
import { codeIcon, fileZipIcon, terminalIcon, triangleDownIcon } from '../../../icons/octicons';
import type { Repository } from '../../../lib/types';

/** The green "<> Code ▾" button: clone URLs and ZIP download. */
export default function CodeButton(props: { repo: Repository; gitRef: string }) {
  const [kind, setKind] = createSignal<'https' | 'ssh' | 'cli'>('https');
  const value = () =>
    kind() === 'https' ? props.repo.clone_url : kind() === 'ssh' ? props.repo.ssh_url : `gh repo clone ${props.repo.full_name}`;
  return (
    <Dropdown
      class="btn btn-primary btn-sm"
      align="right"
      menuClass="w-[400px] max-w-[calc(100vw-32px)] p-4!"
      button={
        <>
          <Octicon icon={codeIcon} /> Code <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {() => (
        <div>
          <div class="flex items-center gap-2 font-semibold mb-2">
            <Octicon icon={terminalIcon} /> Clone
          </div>
          <div class="flex gap-4 border-b border-line-muted mb-3 text-sm">
            <For each={[['https', 'HTTPS'], ['ssh', 'SSH'], ['cli', 'GitHub CLI']] as const}>
              {([k, label]) => (
                <button
                  type="button"
                  class={['pb-2 -mb-px border-b-2', kind() === k ? 'border-[var(--underlineNav-borderColor-active)] font-semibold' : 'border-transparent text-fg-muted']}
                  onClick={() => setKind(k)}
                >
                  {label}
                </button>
              )}
            </For>
          </div>
          <div class="input-group">
            <input class="form-control form-control-sm font-mono" readonly value={value()} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={value()} class="btn btn-sm" />
          </div>
          <hr class="SelectMenu-divider mx-[-16px]" />
          <a
            class="SelectMenu-item m-0! w-full!"
            href={`https://github.com/${props.repo.full_name}/archive/${props.gitRef}.zip`}
            rel="nofollow"
          >
            <Octicon icon={fileZipIcon} /> Download ZIP
          </a>
        </div>
      )}
    </Dropdown>
  );
}
