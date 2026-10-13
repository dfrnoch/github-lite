import { Title } from '@solidjs/meta';
import { createMemo, Loading } from 'solid-js';
import { PageSpinner } from '../components/ui';
import { defineFileRoute } from '@solidjs/router/fs';
import { getTopRepos, getViewer } from '../features/user/api';
import DashboardSidebar from '../features/user/components/DashboardSidebar';
import Feed from '../features/user/components/Feed';

export const route = defineFileRoute('/', {
  // The repo list doesn't depend on the viewer's login: start both at once.
  preload: () => {
    void getViewer();
    void getTopRepos(100);
  },
});

/** `/` — the signed-in dashboard: top repositories + recent activity on the left, the event feed in the middle. */
export default function Dashboard() {
  const viewer = createMemo(() => getViewer());
  return (
    <div class="flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
      <Title>GitHub</Title>
      <aside class="w-full md:w-[320px] lg:w-[350px] shrink-0 bg-canvas md:border-r border-line-muted px-4 md:px-6 lg:px-8 py-6">
        <Loading fallback={<PageSpinner />}>
          <DashboardSidebar login={viewer().login} />
        </Loading>
      </aside>
      <main class="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-6">
        <div class="max-w-[900px] mx-auto">
          <h1 class="text-xl font-semibold mb-4">Home</h1>
          <Loading fallback={<PageSpinner />}>
            <Feed login={viewer().login} />
          </Loading>
        </div>
      </main>
    </div>
  );
}
