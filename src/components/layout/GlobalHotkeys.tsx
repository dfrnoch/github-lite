import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { openUnreadNotifications } from '../../features/notifications/openTabs';
import { getViewer } from '../../features/user/api';
import { useHotkey } from '../../lib/hotkeys';
import { headerContext } from './headerContext';

/**
 * github.com's global keyboard shortcuts (`g d`, `g n`, `g i`, …) plus the
 * Refined GitHub ones that work on every page (`g m`, `g u`). Repository
 * shortcuts are registered only while a repository page is open, so the `?`
 * dialog lists the right set.
 */
export default function GlobalHotkeys() {
  const location = useLocation();
  const repo = createMemo(() => {
    const ctx = headerContext(location.pathname);
    return ctx.kind === 'repo' ? `${ctx.owner}/${ctx.repo}` : null;
  });
  return (
    <>
      <SiteHotkeys />
      <Show when={repo()} fallback={<SiteConversationHotkeys />}>
        {(r) => <RepoHotkeys repo={r()} />}
      </Show>
    </>
  );
}

function SiteHotkeys() {
  const navigate = useNavigate();
  const group = 'Site-wide';
  useHotkey({ keys: 'g d', description: 'Go to your dashboard', group, handler: () => navigate('/') });
  useHotkey({ keys: 'g n', description: 'Go to your notifications', group, handler: () => navigate('/notifications') });
  useHotkey({
    keys: 'g m',
    description: 'Go to your profile',
    group,
    feature: 'profile-hotkey',
    handler: () => {
      void getViewer().then((v) => navigate(`/${v.login}`));
    },
  });
  useHotkey({
    keys: 'g u',
    description: 'Open all unread notifications (new tabs)',
    group,
    feature: 'unread-anywhere',
    handler: () => void openUnreadNotifications(),
  });
  return null;
}

/** Outside repositories, `g i` / `g p` go to the viewer's own issues and pull requests. */
function SiteConversationHotkeys() {
  const navigate = useNavigate();
  const group = 'Site-wide';
  useHotkey({ keys: 'g i', description: 'Go to your issues', group, handler: () => navigate('/issues') });
  useHotkey({ keys: 'g p', description: 'Go to your pull requests', group, handler: () => navigate('/pulls') });
  return null;
}

/** github.com's repository shortcuts — they navigate by URL, like the repo tabs. */
function RepoHotkeys(props: { repo: string }) {
  const navigate = useNavigate();
  const group = 'Repositories';
  const go = (suffix: string) => () => navigate(`/${props.repo}${suffix}`);
  useHotkey({ keys: 'g c', description: 'Go to Code', group, handler: go('') });
  useHotkey({ keys: 'g i', description: 'Go to Issues', group, handler: go('/issues') });
  useHotkey({ keys: 'g p', description: 'Go to Pull requests', group, handler: go('/pulls') });
  useHotkey({ keys: 'g a', description: 'Go to Actions', group, handler: go('/actions') });
  return null;
}
