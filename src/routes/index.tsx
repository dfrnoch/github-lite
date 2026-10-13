import { Title } from '@solidjs/meta';
import { untrack } from 'solid-js';
import { defineFileRoute } from '@solidjs/router/fs';
import { getPinnedRepos, getTopRepos, getViewer } from '../features/user/api';
import { getFeedPage, getFeedTrending, getRecentActivity } from '../features/user/feed';
import { pinned, pinnedFetchKey } from '../features/user/pins';
import DashboardSidebar from '../features/user/components/DashboardSidebar';
import Feed from '../features/user/components/Feed';

export const route = defineFileRoute('/', {
  // Start everything at once (the feed queries resolve the viewer themselves).
  preload: () => {
    void getViewer();
    void getFeedPage(1);
    void getRecentActivity();
    void getFeedTrending();
    void getTopRepos(100);
    if (untrack(pinned).length) void getPinnedRepos(untrack(pinnedFetchKey));
  },
});

/** `/` — the signed-in dashboard: pinned + top repositories and recent activity on the left, the event feed in the middle. */
export default function Dashboard() {
  return (
    <div class="flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
      <Title>GitHub</Title>
      <aside class="w-full md:w-[300px] lg:w-[340px] shrink-0 bg-canvas md:border-r border-line-muted px-4 md:px-6 lg:px-8 py-6">
        <DashboardSidebar />
      </aside>
      <main class="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-6">
        <div class="max-w-[760px] mx-auto">
          <Feed />
        </div>
      </main>
    </div>
  );
}
