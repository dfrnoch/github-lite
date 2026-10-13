import { createMemo, createSignal, Loading, onSettled, Show } from 'solid-js';
import { getProjectItems, type ProjectItem } from '../../../../../features/issues/api';
import Comment from '../../../../../features/issues/components/Comment';
import CommentForm from '../../../../../features/issues/components/CommentForm';
import IssueSidebar from '../../../../../features/issues/components/IssueSidebar';
import Timeline from '../../../../../features/issues/components/Timeline';
import { canPush, canTriage, type PullDetail, type PullRepoMeta, type TimelineConnection } from '../../../../../features/issues/types';
import { feature } from '../../../../../features/refined';
import { noSelfReference } from '../../../../../features/refined/editor';
import { deploymentKey, getFirstTag, getPullDeployments, getPullPage } from '../../../../../features/pulls/api';
import ClosingRemarks from '../../../../../features/pulls/components/ClosingRemarks';
import MergeBox from '../../../../../features/pulls/components/MergeBox';
import ReviewersSection from '../../../../../features/pulls/components/ReviewersSection';
import { usePull } from '../../../../../features/pulls/context';
import { getViewer } from '../../../../../features/user/api';
import type { Viewer } from '../../../../../lib/types';
import { stickySidebar } from '../../../../../features/repo/refined/sticky';

/** /:owner/:repo/pull/:number — the Conversation tab. */
export default function PullConversation() {
  const pr = usePull();
  const data = createMemo(() => getPullPage(pr.owner(), pr.repo(), pr.number()));
  const projects = createMemo(() => getProjectItems(pr.owner(), pr.repo(), pr.number()));
  const viewer = createMemo(() => getViewer());
  // hide-inactive-deployments: inactive / failed deployments, except the latest one.
  const hiddenDeployments = createMemo(() =>
    feature('hide-inactive-deployments')
      ? getPullDeployments(pr.owner(), pr.repo(), pr.number())
          .then((list) => new Set(list.slice(0, -1).filter((d) => ['INACTIVE', 'FAILURE', 'ERROR'].includes(d.state)).map((d) => deploymentKey(d.createdAt, d.environment))))
          .catch(() => null)
      : null,
  );
  // closing-remarks (starts with the page data, not after it).
  const firstTag = createMemo(() => (feature('closing-remarks') ? getFirstTag(pr.owner(), pr.repo(), pr.number()).catch(() => null) : null));
  return (
    <Show when={data().pull}>
      {(pull) => (
        <Conversation
          pull={pull()}
          meta={data().repo}
          projects={projects()}
          viewer={viewer()}
          hiddenDeployments={hiddenDeployments()}
          firstTag={firstTag()}
        />
      )}
    </Show>
  );
}

function Conversation(props: {
  pull: PullDetail;
  meta: PullRepoMeta;
  projects: ProjectItem[] | null;
  viewer: Viewer;
  hiddenDeployments: Set<string> | null;
  firstTag: { tag: string | null; hasTags: boolean; sha: string } | null;
}) {
  const pr = usePull();
  const [draft, setDraft] = createSignal('');
  const quote = (text: string) => {
    setDraft((d) => (d ? `${d}\n${text}` : text));
    document.getElementById('new-comment')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  onSettled(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  });
  /** Put text in the comment box (replacing the draft) and scroll to it. */
  const insertComment = (text: string) => {
    setDraft(text);
    document.getElementById('new-comment')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  // Timeline pages without the hidden deployments (the hidden count stays right).
  const timeline = createMemo(() => {
    const hidden = props.hiddenDeployments;
    const { head, tail } = props.pull;
    if (!hidden?.size) return { head, tail };
    const keep = (c: TimelineConnection) => c.nodes.filter((n) => n.__typename !== 'DeployedEvent' || !hidden.has(deploymentKey(n.createdAt, n.deployment?.environment)));
    const headNodes = keep(head);
    const tailNodes = keep(tail);
    const removed = head.nodes.length - headNodes.length + (head.pageInfo.hasNextPage ? tail.nodes.length - tailNodes.length : 0);
    return {
      head: { ...head, nodes: headNodes, totalCount: head.totalCount != null ? head.totalCount - removed : head.totalCount },
      tail: { ...tail, nodes: tailNodes },
    };
  });
  const author = () => props.pull.author?.login ?? 'ghost';
  const fullName = () => `${pr.owner()}/${pr.repo()}`;
  const editable = () => canTriage(props.meta.viewerPermission);

  return (
    <div class="flex flex-col md:flex-row gap-6 lg:gap-8" ref={noSelfReference}>
      <div class="flex-1 min-w-0">
        <div class="relative">
          <div class="absolute top-0 bottom-0 left-[72px] w-0.5" style={{ 'background-color': 'var(--borderColor-muted)' }} />
          <Comment
            comment={props.pull}
            verb="commented"
            anchor={`issue-${props.pull.number}`}
            commentRef={{ kind: 'body', owner: pr.owner(), repo: pr.repo(), number: props.pull.number }}
            repo={fullName()}
            canReact={props.pull.viewerCanReact}
            highlight={props.pull.viewerDidAuthor}
            onQuote={quote}
          />
          <Timeline
            owner={pr.owner()}
            repo={pr.repo()}
            number={props.pull.number}
            isPull
            issueAuthor={author()}
            head={timeline().head}
            tail={timeline().tail}
            canReact={props.pull.viewerCanReact}
            onQuote={quote}
            threads={props.pull.reviewThreads.nodes}
          />
          <Show when={feature('closing-remarks') && props.firstTag}>
            {(info) => <ClosingRemarks owner={pr.owner()} repo={pr.repo()} info={info()} canPush={canPush(props.meta.viewerPermission)} />}
          </Show>
          <Loading>
            <MergeBox
              owner={pr.owner()}
              repo={pr.repo()}
              pull={props.pull}
              meta={props.meta}
              viewerAvatar={props.viewer.avatar_url}
              viewerLogin={props.viewer.login}
              onInsertComment={insertComment}
            />
          </Loading>
        </div>
        <div class="TimelineItem-break ml-0! mb-4" />
        <Loading>
          <CommentForm
            owner={pr.owner()}
            repo={pr.repo()}
            number={props.pull.number}
            isPull
            state={props.pull.merged ? 'MERGED' : props.pull.state}
            canChangeState={props.pull.viewerCanUpdate ?? false}
            locked={props.pull.locked}
            canComment={!props.pull.locked || editable()}
            viewerAvatar={props.viewer.avatar_url}
            value={draft()}
            onInput={setDraft}
            netiquette={{
              closedAt: props.pull.closedAt,
              isDraft: props.pull.isDraft,
              own: props.pull.viewerDidAuthor,
              moderator: editable(),
              comments: props.pull.comments.totalCount,
              participants: props.pull.participants.totalCount,
            }}
          />
        </Loading>
      </div>
      <aside class="w-full md:w-[256px] lg:w-[296px] shrink-0" ref={stickySidebar()}>
        <IssueSidebar
          owner={pr.owner()}
          repo={pr.repo()}
          number={props.pull.number}
          isPull
          item={props.pull}
          permission={props.meta.viewerPermission}
          projects={props.projects}
          linked={props.pull.closingIssuesReferences.nodes}
          before={<ReviewersSection owner={pr.owner()} repo={pr.repo()} pull={props.pull} editable={editable()} viewerLogin={props.viewer.login} />}
        />
      </aside>
    </div>
  );
}
