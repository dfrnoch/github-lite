import { Title } from '@solidjs/meta';
import { useAction, useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Pagination, pageHref, toast, toastError } from '../../../../components/ui';
import { linkExternalIcon, peopleIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import type { UserCard } from '../../../profile/api';
import { FilterMenu } from '../../../profile/components/RepoFiltersBar';
import { getOrgMeta } from '../../api';
import { getOutsideCollaborators, removeOutsideCollaborator } from '../api';
import { ScopeNotice, Section } from './Notices';
import SearchInput from './SearchInput';

const PER_PAGE = 30;

/** /orgs/:org/outside-collaborators (owners only). */
export default function OutsideCollaboratorsPage(props: { org: string }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  const [sp, setSp] = useSearchParams<{ query?: string; two_factor?: string; page?: string }>();
  // Started with meta (not after it) so the two load in parallel.
  const list = createMemo(() => getOutsideCollaborators(props.org, sp.two_factor === 'disabled' ? 'disabled' : ''));
  return (
    <>
      <Title>{`Outside collaborators · ${props.org}`}</Title>
      <ScopeNotice when={meta().viewerCanAdminister} scope="admin:org" what="collaborator changes" />
      <Show
        when={meta().viewerCanAdminister}
        fallback={<Blankslate icon={peopleIcon} title="Only organization owners can see outside collaborators" />}
      >
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <SearchInput placeholder="Find a collaborator…" param="query" class="flex-1 min-w-[200px] md:max-w-[320px]" />
          <div class="flex-1" />
          <FilterMenu
            label="2FA"
            title="Filter by two-factor authentication"
            options={[
              { value: '', label: 'Everyone' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            value={sp.two_factor ?? ''}
            onSelect={(v) => setSp({ two_factor: v || undefined, page: undefined }, { scroll: false })}
          />
        </div>
        <Section>
          <CollaboratorList org={props.org} list={list()} />
        </Section>
      </Show>
    </>
  );
}

function CollaboratorList(props: { org: string; list: UserCard[] }) {
  const [sp] = useSearchParams<{ query?: string; two_factor?: string; page?: string }>();
  const location = useLocation();
  const list = () => props.list;
  const filtered = createMemo(() => {
    const q = (sp.query ?? '').trim().toLowerCase();
    return q
      ? list().filter((u) => u.login.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
      : list();
  });
  const page = () => Math.max(1, Number(sp.page) || 1);
  const lastPage = () => Math.max(1, Math.ceil(filtered().length / PER_PAGE));
  return (
    <>
      <div class="Box">
        <div class="Box-header py-3! text-sm font-semibold">
          {formatNumber(filtered().length)} outside {filtered().length === 1 ? 'collaborator' : 'collaborators'}
          <Show when={sp.two_factor === 'disabled'}>
            <span class="font-normal text-fg-muted"> without two-factor authentication</span>
          </Show>
        </div>
        <ul>
          <For
            each={filtered().slice((page() - 1) * PER_PAGE, page() * PER_PAGE)}
            fallback={
              <li class="Box-row">
                <Blankslate icon={peopleIcon} title="No outside collaborators">
                  Outside collaborators are people with access to one or more of this organization’s repositories who
                  aren’t members.
                </Blankslate>
              </li>
            }
          >
            {(u) => <CollaboratorRow org={props.org} user={u} />}
          </For>
        </ul>
      </div>
      <Pagination
        pageInfo={{ page: page(), lastPage: lastPage(), hasNext: page() < lastPage(), hasPrev: page() > 1 }}
        href={(p) => pageHref(location, p)}
      />
    </>
  );
}

function CollaboratorRow(props: { org: string; user: UserCard }) {
  const remove = useAction(removeOutsideCollaborator);
  const [busy, setBusy] = createOptimistic(false);
  const doRemove = async () => {
    if (!confirm(`Remove ${props.user.login} from all of ${props.org}’s repositories?`)) return;
    setBusy(true);
    try {
      await remove(props.org, props.user.login);
      toast(`Removed ${props.user.login}`, 'success');
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <li class="Box-row flex items-center gap-3">
      <a href={`/${props.user.login}`} class="shrink-0">
        <Avatar src={props.user.avatarUrl} login={props.user.login} size={44} />
      </a>
      <div class="flex-1 min-w-0">
        <a class="block text-base truncate" href={`/${props.user.login}`}>
          {props.user.name || props.user.login}
        </a>
        <Show when={props.user.name}>
          <span class="block text-sm text-fg-muted truncate">{props.user.login}</span>
        </Show>
      </div>
      <a
        class="link-muted text-sm hidden md:inline-flex items-center gap-1"
        href={`https://github.com/orgs/${props.org}/people/${props.user.login}/repositories`}
        target="_blank"
        rel="noreferrer"
        title="Repository access is managed per repository; GitHub lists it here"
      >
        Repositories <Octicon icon={linkExternalIcon} size={12} />
      </a>
      <button type="button" class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void doRemove()}>
        Remove
      </button>
    </li>
  );
}
