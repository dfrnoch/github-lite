/**
 * Hand-picked shapes of the REST payloads this app reads. Only the fields we
 * use are declared — the API returns more.
 */

export interface SimpleUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Organization' | 'Bot' | string;
  site_admin?: boolean;
}

export interface Viewer extends SimpleUser {
  name: string | null;
  email: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  plan?: { name: string };
}

export interface License {
  key: string;
  name: string;
  spdx_id: string | null;
}

export interface Repository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: SimpleUser;
  private: boolean;
  visibility?: 'public' | 'private' | 'internal';
  description: string | null;
  fork: boolean;
  homepage: string | null;
  language: string | null;
  forks_count: number;
  stargazers_count: number;
  watchers_count: number;
  subscribers_count?: number;
  network_count?: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  topics?: string[];
  archived: boolean;
  disabled: boolean;
  is_template?: boolean;
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
  allow_forking?: boolean;
  allow_merge_commit?: boolean;
  allow_squash_merge?: boolean;
  allow_rebase_merge?: boolean;
  allow_auto_merge?: boolean;
  delete_branch_on_merge?: boolean;
  web_commit_signoff_required?: boolean;
  license: License | null;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  permissions?: { admin: boolean; maintain?: boolean; push: boolean; triage?: boolean; pull: boolean };
  parent?: Repository;
  source?: Repository;
  template_repository?: Repository | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
}

export interface Label {
  id: number;
  node_id: string;
  name: string;
  color: string;
  description: string | null;
  default?: boolean;
}

export interface Milestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface Reactions {
  total_count: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

export interface Issue {
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: SimpleUser;
  labels: Label[];
  state: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened' | 'duplicate' | null;
  locked: boolean;
  assignees: SimpleUser[];
  milestone: Milestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: string;
  body?: string | null;
  body_html?: string;
  pull_request?: { url: string; merged_at: string | null };
  draft?: boolean;
  reactions?: Reactions;
  repository_url: string;
}

export interface GitUser {
  name: string;
  email: string;
  date: string;
}

export interface Commit {
  sha: string;
  node_id: string;
  commit: {
    author: GitUser;
    committer: GitUser;
    message: string;
    comment_count: number;
    verification?: { verified: boolean; reason: string; signature?: string | null; payload?: string | null; verified_at?: string | null };
  };
  author: SimpleUser | null;
  committer: SimpleUser | null;
  parents: { sha: string }[];
  html_url: string;
  stats?: { additions: number; deletions: number; total: number };
  files?: DiffFile[];
}

export interface DiffFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  blob_url: string;
}

export interface Branch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

export interface ContentItem {
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string | null;
  html_url: string;
  content?: string;
  encoding?: string;
  target?: string;
  submodule_git_url?: string;
}

export interface Organization {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
  name?: string | null;
  blog?: string | null;
  location?: string | null;
  email?: string | null;
  html_url?: string;
}

/** GET /repos/{owner}/{repo}/pulls/{number} (REST pull request). */
export interface PullRequestRef {
  label: string;
  ref: string;
  sha: string;
  user: SimpleUser;
  repo: Repository | null;
}

export interface PullRequest {
  id: number;
  node_id: string;
  number: number;
  title: string;
  body: string | null;
  body_html?: string;
  state: 'open' | 'closed';
  draft?: boolean;
  locked: boolean;
  merged: boolean;
  merged_at: string | null;
  merged_by: SimpleUser | null;
  mergeable: boolean | null;
  mergeable_state: string;
  merge_commit_sha: string | null;
  user: SimpleUser;
  labels: Label[];
  assignees: SimpleUser[];
  requested_reviewers: SimpleUser[];
  requested_teams: { id: number; slug: string; name: string }[];
  milestone: Milestone | null;
  head: PullRequestRef;
  base: PullRequestRef;
  author_association: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  maintainer_can_modify: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  diff_url: string;
  patch_url: string;
}
