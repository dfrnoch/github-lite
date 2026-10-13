import { useNavigate } from '@solidjs/router';
import { createMemo, createSignal, Errored, For, Loading } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, Spinner } from '../../../components/ui';
import { tagIcon, triangleDownIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { getTagCommits } from '../api';

/**
 * github.com's "Compare ▾" on a release: pick another tag to open
 * /compare/<picked>...<this tag>. The tag list loads when the menu opens.
 */
export default function CompareTagMenu(props: { owner: string; repo: string; tag: string }) {
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('');
  let input: HTMLInputElement | undefined;
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-[300px]"
      title="Compare this release with another tag"
      header="Choose a tag to compare"
      onOpen={() => input?.focus()}
      button={
        <>
          Compare <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <>
          <div class="SelectMenu-filter">
            <input
              ref={(el) => (input = el)}
              class="form-control input-sm w-full"
              type="search"
              placeholder="Find a tag"
              aria-label="Find a tag"
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
          </div>
          <Errored fallback={<p class="px-4 py-2 text-fg-muted text-sm">Couldn’t load tags.</p>}>
            <Loading
              fallback={
                <div class="flex justify-center py-3">
                  <Spinner />
                </div>
              }
            >
              <TagOptions
                owner={props.owner}
                repo={props.repo}
                tag={props.tag}
                filter={filter()}
                onPick={(t) => {
                  close();
                  navigate(`/${props.owner}/${props.repo}/compare/${encodePath(t)}...${encodePath(props.tag)}`);
                }}
              />
            </Loading>
          </Errored>
          <div class="SelectMenu-divider" />
          <a class="SelectMenu-item justify-center text-fg-accent!" href={`/${props.owner}/${props.repo}/tags`} onClick={close}>
            View all tags
          </a>
        </>
      )}
    </Dropdown>
  );
}

function TagOptions(props: { owner: string; repo: string; tag: string; filter: string; onPick: (tag: string) => void }) {
  // Shares the request (and cache) of the tag changes link.
  const tags = createMemo(() => getTagCommits(props.owner, props.repo, 100));
  const shown = createMemo(() => {
    const q = props.filter.trim().toLowerCase();
    return tags()
      .map((t) => t.name)
      .filter((n) => n !== props.tag && (!q || n.toLowerCase().includes(q)))
      .slice(0, 50);
  });
  return (
    <div class="max-h-[300px] overflow-auto">
      <For each={shown()} fallback={<p class="px-4 py-2 text-fg-muted text-sm">No tags found.</p>}>
        {(name) => (
          <button type="button" class="SelectMenu-item" role="menuitem" onClick={() => props.onPick(name)}>
            <Octicon icon={tagIcon} />
            <span class="truncate">{name}</span>
          </button>
        )}
      </For>
    </div>
  );
}
