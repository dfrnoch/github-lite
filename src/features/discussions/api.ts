import { action, query } from '@solidjs/router';
import { gql } from '../../lib/github';

// ── Shapes ──────────────────────────────────────────────────────────────────

export interface Actor {
  login: string;
  avatarUrl: string;
  url?: string;
}

export interface DiscussionCategory {
  id: string;
  name: string;
  slug: string;
  emojiHTML: string;
  description: string | null;
  isAnswerable: boolean;
}

export type ReactionContent = 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';

export interface ReactionGroup {
  content: ReactionContent;
  users: { totalCount: number };
  viewerHasReacted: boolean;
}

export interface DiscussionListItem {
  id: string;
  number: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: Actor | null;
  category: Pick<DiscussionCategory, 'name' | 'slug' | 'emojiHTML' | 'isAnswerable'>;
  isAnswered: boolean | null;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  viewerCanUpvote: boolean;
  closed: boolean;
  locked: boolean;
  comments: { totalCount: number };
  labels: { nodes: { name: string; color: string }[] } | null;
  participants: Actor[];
}

export interface DiscussionComment {
  id: string;
  databaseId: number;
  url: string;
  body: string;
  bodyHTML: string;
  createdAt: string;
  lastEditedAt: string | null;
  author: Actor | null;
  authorAssociation: string;
  isAnswer: boolean;
  isMinimized: boolean;
  minimizedReason: string | null;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  viewerCanUpvote: boolean;
  viewerCanReact: boolean;
  viewerCanMarkAsAnswer: boolean;
  viewerCanUnmarkAsAnswer: boolean;
  viewerCanDelete: boolean;
  viewerCanUpdate: boolean;
  reactionGroups: ReactionGroup[];
  replies?: { totalCount: number; nodes: DiscussionComment[] };
}

export interface Discussion {
  id: string;
  number: number;
  title: string;
  url: string;
  body: string;
  bodyHTML: string;
  createdAt: string;
  lastEditedAt: string | null;
  author: Actor | null;
  authorAssociation: string;
  category: DiscussionCategory;
  isAnswered: boolean | null;
  answer: { id: string; author: Actor | null } | null;
  answerChosenBy: Actor | null;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  viewerCanUpvote: boolean;
  viewerCanReact: boolean;
  viewerCanUpdate: boolean;
  viewerCanClose: boolean;
  viewerCanReopen: boolean;
  viewerCanDelete: boolean;
  viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null;
  viewerCanSubscribe: boolean;
  locked: boolean;
  activeLockReason: string | null;
  closed: boolean;
  stateReason: string | null;
  reactionGroups: ReactionGroup[];
  labels: { nodes: { name: string; color: string; description: string | null }[] } | null;
  poll: { question: string; totalVoteCount: number; viewerHasVoted: boolean; options: { nodes: { id: string; option: string; totalVoteCount: number }[] } } | null;
  repository: { id: string; viewerPermission: string | null };
}

export interface CommentsPage {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: DiscussionComment[];
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** Emoji of a category as text (`emojiHTML` is `<div>🙏</div>`). */
export const categoryEmoji = (html: string) => html.replace(/<[^>]+>/g, '').trim();

export const getDiscussionCategories = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      id hasDiscussionsEnabled
      discussionCategories(first:50){nodes{id name slug emojiHTML description isAnswerable}}
    }}`,
    { owner, name: repo },
  );
  return {
    repositoryId: data.repository.id as string,
    enabled: data.repository.hasDiscussionsEnabled as boolean,
    categories: data.repository.discussionCategories.nodes as DiscussionCategory[],
  };
}, 'discussion-categories');

const LIST_FIELDS = `id number title createdAt updatedAt
  author{login avatarUrl}
  category{name slug emojiHTML isAnswerable}
  isAnswered upvoteCount viewerHasUpvoted viewerCanUpvote closed locked
  comments(last:4){totalCount nodes{author{login avatarUrl}}}
  labels(first:5){nodes{name color}}`;

/** Parsed `discussions_q` (github.com's discussions search box). */
export interface DiscussionQuery {
  state: 'open' | 'closed' | 'all';
  answered: boolean | null;
  locked: boolean | null;
  sort: 'latest' | 'created' | 'top';
  category: string | null;
  labels: string[];
  text: string;
}

export function parseDiscussionQuery(q: string): DiscussionQuery {
  const out: DiscussionQuery = { state: 'all', answered: null, locked: null, sort: 'latest', category: null, labels: [], text: '' };
  const rest: string[] = [];
  for (const m of q.matchAll(/(\w+):("[^"]*"|\S+)|(\S+)/g)) {
    const key = m[1]?.toLowerCase();
    const value = m[2]?.replace(/^"|"$/g, '') ?? '';
    if (key === 'is') {
      if (value === 'open' || value === 'closed') out.state = value;
      else if (value === 'answered') out.answered = true;
      else if (value === 'unanswered') out.answered = false;
      else if (value === 'locked') out.locked = true;
      else if (value === 'unlocked') out.locked = false;
      else rest.push(m[0]);
    } else if (key === 'sort') {
      out.sort = value.startsWith('top') ? 'top' : value.startsWith('date_created') || value.startsWith('created') ? 'created' : 'latest';
    } else if (key === 'category') out.category = value;
    else if (key === 'label') out.labels.push(value);
    else rest.push(m[0]);
  }
  out.text = rest.join(' ');
  return out;
}

export function buildDiscussionQuery(q: DiscussionQuery) {
  const parts: string[] = [];
  const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);
  if (q.state !== 'all') parts.push(`is:${q.state}`);
  if (q.answered !== null) parts.push(q.answered ? 'is:answered' : 'is:unanswered');
  if (q.locked !== null) parts.push(q.locked ? 'is:locked' : 'is:unlocked');
  if (q.category) parts.push(`category:${quote(q.category)}`);
  for (const l of q.labels) parts.push(`label:${quote(l)}`);
  if (q.sort === 'top') parts.push('sort:top');
  else if (q.sort === 'created') parts.push('sort:date_created');
  if (q.text) parts.push(q.text);
  return parts.join(' ');
}

export interface DiscussionsPage {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };
  items: DiscussionListItem[];
}

const PAGE = 25;

const toItem = (n: any): DiscussionListItem => {
  const seen = new Set<string>();
  const participants: Actor[] = [];
  for (const a of [n.author, ...(n.comments?.nodes ?? []).map((c: any) => c.author)]) {
    if (a && !seen.has(a.login)) {
      seen.add(a.login);
      participants.push(a);
    }
  }
  return { ...n, participants };
};

/**
 * A page of discussions. Simple filters use the repository connection
 * (cursor pagination); free text, labels and "top" sorting go through search.
 */
export const getDiscussions = query(
  async (owner: string, repo: string, q: string, categorySlug: string, cursor: { after?: string; before?: string }): Promise<DiscussionsPage> => {
    const parsed = parseDiscussionQuery(q);
    const slug = categorySlug || null;
    const page = cursor.before ? { last: PAGE, before: cursor.before } : { first: PAGE, after: cursor.after ?? null };
    const needsSearch = !!parsed.text || parsed.labels.length > 0 || parsed.sort === 'top' || parsed.locked !== null || (!!parsed.category && !slug);
    if (needsSearch) {
      const terms = [`repo:${owner}/${repo}`];
      if (parsed.state !== 'all') terms.push(`is:${parsed.state}`);
      if (parsed.answered !== null) terms.push(parsed.answered ? 'is:answered' : 'is:unanswered');
      if (parsed.locked !== null) terms.push(parsed.locked ? 'is:locked' : 'is:unlocked');
      const category = parsed.category ?? null;
      if (category) terms.push(`category:"${category}"`);
      for (const l of parsed.labels) terms.push(`label:"${l}"`);
      terms.push(parsed.sort === 'top' ? 'sort:reactions-+1-desc' : parsed.sort === 'created' ? 'sort:created-desc' : 'sort:updated-desc');
      if (parsed.text) terms.push(parsed.text);
      const data = await gql<any>(
        `query($q:String!,$first:Int,$last:Int,$after:String,$before:String){search(type:DISCUSSION,query:$q,first:$first,last:$last,after:$after,before:$before){
          discussionCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor}
          nodes{... on Discussion{${LIST_FIELDS}}}
        }}`,
        { q: terms.join(' '), ...page },
      );
      return {
        totalCount: data.search.discussionCount,
        pageInfo: data.search.pageInfo,
        items: data.search.nodes.filter((n: any) => n?.number).map(toItem),
      };
    }
    let categoryId: string | null = null;
    if (slug) {
      const c = await gql<any>(
        `query($owner:String!,$name:String!,$slug:String!){repository(owner:$owner,name:$name){discussionCategory(slug:$slug){id}}}`,
        { owner, name: repo, slug },
      );
      categoryId = c.repository.discussionCategory?.id ?? null;
    }
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$first:Int,$last:Int,$after:String,$before:String,$categoryId:ID,$answered:Boolean,$states:[DiscussionState!],$orderBy:DiscussionOrder){
        repository(owner:$owner,name:$name){
          discussions(first:$first,last:$last,after:$after,before:$before,categoryId:$categoryId,answered:$answered,states:$states,orderBy:$orderBy){
            totalCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor}
            nodes{${LIST_FIELDS}}
          }
        }}`,
      {
        owner,
        name: repo,
        ...page,
        categoryId,
        answered: parsed.answered,
        states: parsed.state === 'all' ? null : [parsed.state.toUpperCase()],
        orderBy: { field: parsed.sort === 'created' ? 'CREATED_AT' : 'UPDATED_AT', direction: 'DESC' },
      },
    );
    const d = data.repository.discussions;
    return { totalCount: d.totalCount, pageInfo: d.pageInfo, items: d.nodes.map(toItem) };
  },
  'discussions',
);

const REACTIONS = `reactionGroups{content users{totalCount} viewerHasReacted}`;
const COMMENT_FIELDS = `id databaseId url body bodyHTML createdAt lastEditedAt
  author{login avatarUrl url} authorAssociation isAnswer isMinimized minimizedReason
  upvoteCount viewerHasUpvoted viewerCanUpvote viewerCanReact viewerCanMarkAsAnswer viewerCanUnmarkAsAnswer
  viewerCanDelete viewerCanUpdate ${REACTIONS}`;
const COMMENTS = (args: string) => `comments(first:30${args}){
  totalCount pageInfo{hasNextPage endCursor}
  nodes{${COMMENT_FIELDS} replies(first:50){totalCount nodes{${COMMENT_FIELDS}}}}
}`;

export const getDiscussion = query(async (owner: string, repo: string, number: number) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
      discussion(number:$number){
        id number title url body bodyHTML createdAt lastEditedAt
        author{login avatarUrl url} authorAssociation
        category{id name slug emojiHTML description isAnswerable}
        isAnswered answer{id author{login avatarUrl}} answerChosenBy{login avatarUrl}
        upvoteCount viewerHasUpvoted viewerCanUpvote viewerCanReact viewerCanUpdate viewerCanClose viewerCanReopen viewerCanDelete
        viewerSubscription viewerCanSubscribe
        locked activeLockReason closed stateReason
        ${REACTIONS}
        labels(first:20){nodes{name color description}}
        poll{question totalVoteCount viewerHasVoted options(first:20){nodes{id option totalVoteCount}}}
        repository{id viewerPermission}
        ${COMMENTS('')}
      }
    }}`,
    { owner, name: repo, number },
  );
  const d = data.repository.discussion;
  if (!d) return null;
  const { comments, ...discussion } = d;
  return { discussion: discussion as Discussion, comments: comments as CommentsPage };
}, 'discussion');

/** Further pages of top-level comments ("Load more"). */
export const getDiscussionComments = query(async (owner: string, repo: string, number: number, after: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){
      discussion(number:$number){${COMMENTS(',after:$after')}}
    }}`,
    { owner, name: repo, number, after },
  );
  return data.repository.discussion.comments as CommentsPage;
}, 'discussion-comments');

// ── Mutations ───────────────────────────────────────────────────────────────

export const addDiscussionComment = action(async (discussionId: string, body: string, replyToId?: string) => {
  await gql(
    `mutation($input:AddDiscussionCommentInput!){addDiscussionComment(input:$input){comment{id}}}`,
    { input: { discussionId, body, replyToId } },
  );
}, 'discussion-add-comment');

export const updateDiscussionComment = action(async (commentId: string, body: string) => {
  await gql(`mutation($input:UpdateDiscussionCommentInput!){updateDiscussionComment(input:$input){comment{id}}}`, {
    input: { commentId, body },
  });
}, 'discussion-update-comment');

export const deleteDiscussionComment = action(async (id: string) => {
  await gql(`mutation($input:DeleteDiscussionCommentInput!){deleteDiscussionComment(input:$input){comment{id}}}`, {
    input: { id },
  });
}, 'discussion-delete-comment');

export const setUpvote = action(async (subjectId: string, upvote: boolean) => {
  await gql(
    upvote
      ? `mutation($id:ID!){addUpvote(input:{subjectId:$id}){subject{id}}}`
      : `mutation($id:ID!){removeUpvote(input:{subjectId:$id}){subject{id}}}`,
    { id: subjectId },
  );
}, 'discussion-upvote');

export const setAnswer = action(async (commentId: string, answer: boolean) => {
  await gql(
    answer
      ? `mutation($id:ID!){markDiscussionCommentAsAnswer(input:{id:$id}){discussion{id}}}`
      : `mutation($id:ID!){unmarkDiscussionCommentAsAnswer(input:{id:$id}){discussion{id}}}`,
    { id: commentId },
  );
}, 'discussion-answer');

export const toggleReaction = action(async (subjectId: string, content: ReactionContent, add: boolean) => {
  await gql(
    add
      ? `mutation($id:ID!,$c:ReactionContent!){addReaction(input:{subjectId:$id,content:$c}){reaction{content}}}`
      : `mutation($id:ID!,$c:ReactionContent!){removeReaction(input:{subjectId:$id,content:$c}){reaction{content}}}`,
    { id: subjectId, c: content },
  );
}, 'discussion-reaction');

export const setLocked = action(async (id: string, lock: boolean, reason?: string) => {
  await gql(
    lock
      ? `mutation($id:ID!,$reason:LockReason){lockLockable(input:{lockableId:$id,lockReason:$reason}){lockedRecord{locked}}}`
      : `mutation($id:ID!){unlockLockable(input:{lockableId:$id}){unlockedRecord{locked}}}`,
    lock ? { id, reason: reason || null } : { id },
  );
}, 'discussion-lock');

export const setClosed = action(async (discussionId: string, close: boolean, reason?: 'RESOLVED' | 'OUTDATED' | 'DUPLICATE') => {
  await gql(
    close
      ? `mutation($id:ID!,$reason:DiscussionCloseReason){closeDiscussion(input:{discussionId:$id,reason:$reason}){discussion{id}}}`
      : `mutation($id:ID!){reopenDiscussion(input:{discussionId:$id}){discussion{id}}}`,
    close ? { id: discussionId, reason: reason ?? 'RESOLVED' } : { id: discussionId },
  );
}, 'discussion-close');

export const setSubscription = action(async (subscribableId: string, subscribed: boolean) => {
  await gql(`mutation($id:ID!,$state:SubscriptionState!){updateSubscription(input:{subscribableId:$id,state:$state}){subscribable{id}}}`, {
    id: subscribableId,
    state: subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
  });
}, 'discussion-subscription');

export const voteOnPoll = action(async (pollOptionId: string) => {
  await gql(`mutation($id:ID!){addDiscussionPollVote(input:{pollOptionId:$id}){pollOption{id}}}`, { id: pollOptionId });
}, 'discussion-poll-vote');

/** Create a discussion; resolves to its number. */
export const createDiscussion = action(async (repositoryId: string, categoryId: string, title: string, body: string) => {
  const data = await gql<any>(
    `mutation($input:CreateDiscussionInput!){createDiscussion(input:$input){discussion{number}}}`,
    { input: { repositoryId, categoryId, title, body } },
  );
  return data.createDiscussion.discussion.number as number;
}, 'discussion-create');
