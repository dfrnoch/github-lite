import { Title } from '@solidjs/meta';
import IssueList from '../../../features/issues/components/IssueList';
import ListHeader from '../../../features/issues/components/ListHeader';
import { feature } from '../../../features/refined';
import { useRepo } from '../../../features/repo/context';

/** /:owner/:repo/pulls */
export default function PullsPage() {
  const ctx = useRepo();
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Pull requests · ${ctx.fullName()}`}</Title>
      <IssueList
        kind="pr"
        owner={ctx.owner()}
        repo={ctx.name()}
        defaultQuery={feature('last-update-sort') ? 'is:pr is:open sort:updated-desc' : 'is:pr is:open'}
        header={<ListHeader owner={ctx.owner()} repo={ctx.name()} title="Pull requests" newHref={`${ctx.base()}/compare`} newLabel="New pull request" />}
      />
    </div>
  );
}
