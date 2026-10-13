import { Title } from '@solidjs/meta';
import { useAction, useLocation, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal, Loading, onSettled, Show } from 'solid-js';
import { itemState, RelativeTime, StateBadge } from '../../../../components/ui';
import { getIssuePage, getProjectItems, updateIssue } from '../../../../features/issues/api';
import Comment, { userHref } from '../../../../features/issues/components/Comment';
import CommentForm from '../../../../features/issues/components/CommentForm';
import IssueHeader from '../../../../features/issues/components/IssueHeader';
import IssueSidebar from '../../../../features/issues/components/IssueSidebar';
import Timeline from '../../../../features/issues/components/Timeline';
import type { ProjectItem } from '../../../../features/issues/api';
import { canTriage, type IssueDetail, type RepoMeta } from '../../../../features/issues/types';
import { useRepo } from '../../../../features/repo/context';
import { getViewer } from '../../../../features/user/api';
import { pluralize } from '../../../../lib/format';
import type { Viewer } from '../../../../lib/types';
import { stickySidebar } from '../../../../features/repo/refined/sticky';
import { noSelfReference } from '../../../../features/refined/editor';

/** /:owner/:repo/issues/:number */
export default function IssuePage() {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const data = createMemo(() => getIssuePage(ctx.owner(), ctx.name(), Number(params.number)));
  // Started alongside the page data (the sidebar reads it under its own Loading).
  const projects = createMemo(() => getProjectItems(ctx.owner(), ctx.name(), Number(params.number)));
  const viewer = createMemo(() => getViewer());
  // A pull request number: go to /pull/:n like github.com does.
  createEffect(
    () => (data().kind === 'pull' ? `${ctx.base()}/pull/${params.number}${location.hash}` : null),
    (to) => {
      if (to) navigate(to, { replace: true });
    },
  );
  const issue = () => {
    const d = data();
    return d.kind === 'issue' ? d.issue : null;
  };
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Show when={issue()}>{(i) => <IssueView issue={i()} repo={data().repo} projects={projects()} viewer={viewer()} />}</Show>
    </div>
  );
}

/** Body + timeline + comment box + sidebar for one issue. */
function IssueView(props: { issue: IssueDetail; repo: RepoMeta; projects: ProjectItem[] | null; viewer: Viewer }) {
  const ctx = useRepo();
  const update = useAction(updateIssue);
  const [draft, setDraft] = createSignal('');
  const quote = (text: string) => {
    setDraft((d) => (d ? `${d}\n${text}` : text));
    document.getElementById('new-comment')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Jump to #issuecomment-… once the timeline is on screen.
  onSettled(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  });

  const state = () => itemState({ isPull: false, state: props.issue.state, stateReason: props.issue.stateReason });
  const author = () => props.issue.author?.login ?? 'ghost';

  return (
    <>
      <Title>{`${props.issue.title} · Issue #${props.issue.number} · ${ctx.fullName()}`}</Title>
      <IssueHeader
        title={props.issue.title}
        number={props.issue.number}
        canEdit={props.issue.viewerCanUpdate ?? false}
        locked={props.issue.locked}
        onSave={(title) => update(ctx.owner(), ctx.name(), props.issue.number, { title })}
        actions={
          <a class="btn btn-sm btn-primary" href={`${ctx.base()}/issues/new`}>
            New issue
          </a>
        }
      >
        <StateBadge state={state()} />
        <span>
          <a class="link-muted font-semibold" href={userHref(author())}>
            {author()}
          </a>{' '}
          opened this issue <RelativeTime datetime={props.issue.createdAt} /> · {pluralize(props.issue.comments.totalCount, 'comment')}
        </span>
      </IssueHeader>

      <div class="flex flex-col md:flex-row gap-6 lg:gap-8" ref={noSelfReference}>
        <div class="flex-1 min-w-0">
          <div class="relative">
            <div class="absolute top-0 bottom-0 left-[72px] w-0.5" style={{ 'background-color': 'var(--borderColor-muted)' }} />
            <Comment
              comment={props.issue}
              verb="opened this issue"
              anchor={`issue-${props.issue.number}`}
              commentRef={{ kind: 'body', owner: ctx.owner(), repo: ctx.name(), number: props.issue.number }}
              repo={ctx.fullName()}
              canReact={props.issue.viewerCanReact}
              highlight={props.issue.viewerDidAuthor}
              onQuote={quote}
            />
            <Timeline
              owner={ctx.owner()}
              repo={ctx.name()}
              number={props.issue.number}
              isPull={false}
              issueAuthor={author()}
              head={props.issue.head}
              tail={props.issue.tail}
              canReact={props.issue.viewerCanReact}
              onQuote={quote}
            />
          </div>
          <div class="TimelineItem-break ml-0! mb-4" />
          <Loading>
            <CommentForm
              owner={ctx.owner()}
              repo={ctx.name()}
              number={props.issue.number}
              isPull={false}
              state={props.issue.state}
              canChangeState={props.issue.viewerCanUpdate ?? false}
              locked={props.issue.locked}
              canComment={!props.issue.locked || canTriage(props.repo.viewerPermission)}
              viewerAvatar={props.viewer.avatar_url}
              value={draft()}
              onInput={setDraft}
              netiquette={{
                closedAt: props.issue.closedAt,
                own: props.issue.viewerDidAuthor,
                moderator: canTriage(props.repo.viewerPermission),
                comments: props.issue.comments.totalCount,
                participants: props.issue.participants.totalCount,
              }}
            />
          </Loading>
        </div>
        <aside class="w-full md:w-[256px] lg:w-[296px] shrink-0" ref={stickySidebar()}>
          <IssueSidebar
            owner={ctx.owner()}
            repo={ctx.name()}
            number={props.issue.number}
            isPull={false}
            item={props.issue}
            permission={props.repo.viewerPermission}
            issueType={props.issue.issueType}
            isPinned={props.issue.isPinned}
            viewerCanDelete={props.issue.viewerCanDelete}
            projects={props.projects}
            linked={props.issue.closedByPullRequestsReferences.nodes}
            branches={props.issue.linkedBranches.nodes.map((b) => b.ref?.name).filter((n): n is string => !!n)}
          />
        </aside>
      </div>
    </>
  );
}
