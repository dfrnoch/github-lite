import { Title } from '@solidjs/meta';
import IssueList from '../../../../features/issues/components/IssueList';
import ListHeader from '../../../../features/issues/components/ListHeader';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/issues */
export default function IssuesPage() {
  const ctx = useRepo();
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Issues · ${ctx.fullName()}`}</Title>
      <IssueList
        kind="issue"
        owner={ctx.owner()}
        repo={ctx.name()}
        defaultQuery="is:issue state:open"
        header={<ListHeader owner={ctx.owner()} repo={ctx.name()} title="Issues" newHref={`${ctx.base()}/issues/new`} newLabel="New issue" />}
      />
    </div>
  );
}
