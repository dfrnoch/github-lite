import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, isPending, Loading } from 'solid-js';
import Octicon from '../components/Octicon';
import { PageSpinner } from '../components/ui';
import { searchIcon } from '../icons/octicons';
import { getNotifications, type NotificationsQuery } from '../features/notifications/api';
import Inbox from '../features/notifications/components/Inbox';
import InboxSidebar from '../features/notifications/components/InboxSidebar';
import { inboxHref, parseInboxQuery } from '../features/notifications/utils';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** /notifications?query=… — the notification inbox. */
export default function NotificationsPage() {
  const [sp] = useSearchParams();
  const raw = () => first(sp.query);
  const parsed = createMemo(() => parseInboxQuery(raw()));
  const apiQuery = createMemo(
    (): NotificationsQuery => ({
      repo: parsed().repo,
      // The inbox shows read and unread threads; only is:unread narrows on the API side.
      all: parsed().is !== 'unread',
      participating: parsed().reason === 'participating',
      page: Math.max(1, Number(first(sp.page)) || 1),
    }),
  );
  const data = createMemo(() => getNotifications(apiQuery()));

  return (
    <div class="flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
      <Title>{parsed().is === 'done' ? 'Done · Notifications' : 'Notifications'}</Title>
      <aside class="md:w-[280px] shrink-0 md:border-r border-line-muted px-4 py-4">
        <InboxSidebar query={parsed()} />
      </aside>
      <div class="flex-1 min-w-0 px-4 md:px-6 py-4">
        <QueryInput raw={raw()} />
        <Loading fallback={<PageSpinner />}>
          <Inbox page={data()} query={parsed()} raw={raw()} pending={isPending(() => data())} />
        </Loading>
      </div>
    </div>
  );
}

function QueryInput(props: { raw: string }) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      class="mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(inboxHref(new FormData(e.currentTarget).get('query') as string));
      }}
    >
      <label class="relative block">
        <span class="sr-only">Filter notifications</span>
        <Octicon icon={searchIcon} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          name="query"
          type="search"
          class="form-control w-full pl-8!"
          value={props.raw}
          placeholder="Filter notifications (is:unread, reason:mention, repo:owner/name)"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
    </form>
  );
}
