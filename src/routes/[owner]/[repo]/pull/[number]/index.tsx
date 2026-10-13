import { createMemo, createSignal, Loading, onSettled, Show } from 'solid-js';
import { getProjectItems, type ProjectItem } from '../../../../../features/issues/api';
import Comment from '../../../../../features/issues/components/Comment';
import CommentForm from '../../../../../features/issues/components/CommentForm';
import IssueSidebar from '../../../../../features/issues/components/IssueSidebar';
import Timeline from '../../../../../features/issues/components/Timeline';
import { canTriage, type PullDetail, type PullRepoMeta } from '../../../../../features/issues/types';
import { getPullPage } from '../../../../../features/pulls/api';
import MergeBox from '../../../../../features/pulls/components/MergeBox';
import ReviewersSection from '../../../../../features/pulls/components/ReviewersSection';
import { usePull } from '../../../../../features/pulls/context';
import { getViewer } from '../../../../../features/user/api';
import type { Viewer } from '../../../../../lib/types';

/** /:owner/:repo/pull/:number — the Conversation tab. */
export default function PullConversation() {
  const pr = usePull();
  const data = createMemo(() => getPullPage(pr.owner(), pr.repo(), pr.number()));
  const projects = createMemo(() => getProjectItems(pr.owner(), pr.repo(), pr.number()));
  const viewer = createMemo(() => getViewer());
  return (
    <Show when={data().pull}>
      {(pull) => <Conversation pull={pull()} meta={data().repo} projects={projects()} viewer={viewer()} />}
    </Show>
  );
}

function Conversation(props: { pull: PullDetail; meta: PullRepoMeta; projects: ProjectItem[] | null; viewer: Viewer }) {
  const pr = usePull();
  const [draft, setDraft] = createSignal('');
  const quote = (text: string) => {
    setDraft((d) => (d ? `${d}\n${text}` : text));
    document.getElementById('new-comment')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  onSettled(() => {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  });
  const author = () => props.pull.author?.login ?? 'ghost';
  const fullName = () => `${pr.owner()}/${pr.repo()}`;
  const editable = () => canTriage(props.meta.viewerPermission);

  return (
    <div class="flex flex-col md:flex-row gap-6 lg:gap-8">
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
            head={props.pull.head}
            tail={props.pull.tail}
            canReact={props.pull.viewerCanReact}
            onQuote={quote}
            threads={props.pull.reviewThreads.nodes}
          />
          <Loading>
            <MergeBox owner={pr.owner()} repo={pr.repo()} pull={props.pull} meta={props.meta} viewerAvatar={props.viewer.avatar_url} />
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
          />
        </Loading>
      </div>
      <aside class="w-full md:w-[256px] lg:w-[296px] shrink-0">
        <IssueSidebar
          owner={pr.owner()}
          repo={pr.repo()}
          number={props.pull.number}
          isPull
          item={props.pull}
          permission={props.meta.viewerPermission}
          projects={props.projects}
          linked={props.pull.closingIssuesReferences.nodes}
          before={<ReviewersSection owner={pr.owner()} repo={pr.repo()} pull={props.pull} editable={editable()} />}
        />
      </aside>
    </div>
  );
}
