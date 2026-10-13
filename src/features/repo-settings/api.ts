import { action, query } from '@solidjs/router';
import { gh, ghAll, GitHubError, gql } from '../../lib/github';
import type { Repository, SimpleUser } from '../../lib/types';
import { sealSecret } from './sealedBox';

/* ------------------------------------------------------------------ types */

/** GET /repos for an admin also returns the merge-message settings. */
export interface RepoSettings extends Repository {
  allow_update_branch?: boolean;
  squash_merge_commit_title?: 'PR_TITLE' | 'COMMIT_OR_PR_TITLE';
  squash_merge_commit_message?: 'PR_BODY' | 'COMMIT_MESSAGES' | 'BLANK';
  merge_commit_title?: 'PR_TITLE' | 'MERGE_MESSAGE';
  merge_commit_message?: 'PR_BODY' | 'PR_TITLE' | 'BLANK';
  security_and_analysis?: Record<string, { status: 'enabled' | 'disabled' }>;
}

export interface OrgMembership {
  role: 'admin' | 'member' | 'billing_manager';
  state: string;
  organization: { login: string; avatar_url: string };
}

export interface Collaborator extends SimpleUser {
  role_name: string;
  permissions?: Record<string, boolean>;
}

export interface Invitation {
  id: number;
  invitee: SimpleUser | null;
  inviter: SimpleUser;
  permissions: string;
  created_at: string;
  expired?: boolean;
}

export interface TeamAccess {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  permission: string;
  html_url: string;
  members_count?: number;
}

export interface Webhook {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: { url?: string; content_type?: 'json' | 'form'; insecure_ssl?: '0' | '1'; secret?: string };
  created_at: string;
  updated_at: string;
  last_response: { code: number | null; status: string | null; message: string | null };
}

export interface HookDelivery {
  id: number;
  guid: string;
  delivered_at: string;
  redelivery: boolean;
  duration: number;
  status: string;
  status_code: number;
  event: string;
  action: string | null;
}

export interface HookDeliveryDetail extends HookDelivery {
  request: { headers: Record<string, string>; payload: unknown };
  response: { headers: Record<string, string>; payload: string | null };
}

export interface DeployKey {
  id: number;
  key: string;
  title: string;
  read_only: boolean;
  verified: boolean;
  created_at: string;
  last_used?: string | null;
  added_by?: string | null;
}

export interface ActionsSecret {
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ActionsVariable extends ActionsSecret {
  value: string;
}

export interface PagesInfo {
  url: string;
  html_url?: string;
  status: string | null;
  cname: string | null;
  custom_404: boolean;
  public: boolean;
  https_enforced?: boolean;
  build_type?: 'legacy' | 'workflow' | null;
  source?: { branch: string; path: '/' | '/docs' };
  https_certificate?: { state: string; description: string; domains: string[] };
}

export interface BranchProtectionRule {
  id: string;
  databaseId: number;
  pattern: string;
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number | null;
  dismissesStaleReviews: boolean;
  requiresCodeOwnerReviews: boolean;
  requireLastPushApproval: boolean;
  requiresStatusChecks: boolean;
  requiresStrictStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresConversationResolution: boolean;
  requiresCommitSignatures: boolean;
  requiresLinearHistory: boolean;
  requiresDeployments: boolean;
  isAdminEnforced: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  lockBranch: boolean;
  matchingRefs: { totalCount: number };
}

export type BranchProtectionInput = Omit<BranchProtectionRule, 'id' | 'databaseId' | 'matchingRefs' | 'requiresDeployments'>;

export interface RulesetSummary {
  id: number;
  name: string;
  target: 'branch' | 'tag' | 'push';
  source_type: 'Repository' | 'Organization';
  source: string;
  enforcement: 'active' | 'disabled' | 'evaluate';
  updated_at?: string;
}

export interface RulesetRule {
  type: string;
  parameters?: Record<string, any>;
}

export interface Ruleset extends RulesetSummary {
  bypass_actors?: { actor_id: number | null; actor_type: string; bypass_mode: string }[];
  conditions?: { ref_name?: { include: string[]; exclude: string[] } } | null;
  rules?: RulesetRule[];
  current_user_can_bypass?: string;
}

/* ------------------------------------------------------------- new repo */

/** Orgs the viewer belongs to, with their role (decides who can create repos). */
export const getOrgMemberships = query(
  () => ghAll<OrgMembership>('/user/memberships/orgs', { query: { state: 'active' } }),
  'org-memberships',
);

/** null = name is free; a Repository when taken. */
export const checkRepoName = query(async (owner: string, name: string) => {
  try {
    return await gh<Repository>(`/repos/${owner}/${name}`);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}, 'check-repo-name');

export interface TemplateRepo {
  nameWithOwner: string;
  description: string | null;
  isPrivate: boolean;
}

/** Template repositories visible to the viewer (own, org, collaborator). */
export const getTemplateRepos = query(async () => {
  const data = await gql<any>(
    `query{viewer{repositories(first:100,orderBy:{field:UPDATED_AT,direction:DESC},ownerAffiliations:[OWNER,ORGANIZATION_MEMBER,COLLABORATOR]){
      nodes{nameWithOwner description isPrivate isTemplate}
    }}}`,
  );
  return (data.viewer.repositories.nodes as (TemplateRepo & { isTemplate: boolean })[]).filter((r) => r.isTemplate);
}, 'template-repos');

export const getGitignoreTemplates = query(() => gh<string[]>('/gitignore/templates'), 'gitignore-templates');

export const getLicenses = query(
  () => gh<{ key: string; name: string; spdx_id: string }[]>('/licenses', { query: { per_page: 100 } }),
  'licenses',
);

export interface NewRepoInput {
  owner: string;
  /** Whether `owner` is the viewer (POST /user/repos) or an org. */
  isViewer: boolean;
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'internal';
  template?: string;
  includeAllBranches?: boolean;
  autoInit: boolean;
  gitignore: string;
  license: string;
  /** new-repo-disable-projects-and-wikis: create without Projects and Wiki. */
  disableProjectsAndWiki?: boolean;
}

/** Turn off Projects and the Wiki of a freshly created repo / fork. */
export const disableProjectsAndWiki = (fullName: string) =>
  gh(`/repos/${fullName}`, { method: 'PATCH', body: { has_projects: false, has_wiki: false } });

/** Create (or generate from a template) a repository. Plain async: the caller navigates away. */
export async function createRepository(input: NewRepoInput) {
  if (input.template) {
    const repo = await gh<Repository>(`/repos/${input.template}/generate`, {
      method: 'POST',
      body: {
        owner: input.owner,
        name: input.name,
        description: input.description || undefined,
        include_all_branches: !!input.includeAllBranches,
        private: input.visibility !== 'public',
      },
    });
    // Generated repos don't take feature flags: switch them off afterwards (best effort).
    if (input.disableProjectsAndWiki) await disableProjectsAndWiki(repo.full_name).catch(() => {});
    return repo;
  }
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description || undefined,
    private: input.visibility !== 'public',
    auto_init: input.autoInit,
    gitignore_template: input.gitignore || undefined,
    license_template: input.license || undefined,
  };
  if (input.disableProjectsAndWiki) Object.assign(body, { has_projects: false, has_wiki: false });
  if (!input.isViewer) body.visibility = input.visibility;
  return gh<Repository>(input.isViewer ? '/user/repos' : `/orgs/${input.owner}/repos`, { method: 'POST', body });
}

/** POST /repos/{o}/{r}/forks — returns immediately; the fork is created asynchronously. */
export async function createFork(
  owner: string,
  repo: string,
  opts: { organization?: string; name: string; defaultBranchOnly: boolean },
) {
  return gh<Repository>(`/repos/${owner}/${repo}/forks`, {
    method: 'POST',
    body: { organization: opts.organization, name: opts.name, default_branch_only: opts.defaultBranchOnly },
  });
}

/* --------------------------------------------------------------- general */

export const getRepoSettings = query(
  (owner: string, repo: string) => gh<RepoSettings>(`/repos/${owner}/${repo}`),
  'repo-settings',
);

/** PATCH /repos/{o}/{r} for in-place settings (features, merge options, …). */
export const updateRepoSettings = action(async (owner: string, repo: string, patch: Partial<RepoSettings>) => {
  await gh(`/repos/${owner}/${repo}`, { method: 'PATCH', body: patch });
}, 'update-repo-settings');

/** Settings that change the repo URL or remove it: plain async, the caller navigates. */
export const renameRepository = (owner: string, repo: string, name: string) =>
  gh<Repository>(`/repos/${owner}/${repo}`, { method: 'PATCH', body: { name } });
export const transferRepository = (owner: string, repo: string, newOwner: string, newName?: string) =>
  gh<Repository>(`/repos/${owner}/${repo}/transfer`, {
    method: 'POST',
    body: { new_owner: newOwner, new_name: newName || undefined },
  });
export const deleteRepository = (owner: string, repo: string) => gh(`/repos/${owner}/${repo}`, { method: 'DELETE' });

/** Branch names (default-branch picker, Pages source). */
export const getBranchNames = query(
  async (owner: string, repo: string) =>
    (await ghAll<{ name: string }>(`/repos/${owner}/${repo}/branches`, { max: 500 })).map((b) => b.name),
  'branch-names',
);

/* --------------------------------------------------------- collaborators */

export const getCollaborators = query(
  (owner: string, repo: string) =>
    ghAll<Collaborator>(`/repos/${owner}/${repo}/collaborators`, { query: { affiliation: 'all' } }),
  'collaborators',
);

export const getInvitations = query(
  (owner: string, repo: string) => ghAll<Invitation>(`/repos/${owner}/${repo}/invitations`),
  'repo-invitations',
);

/** Teams with access (org repos only; null when the API refuses). */
export const getRepoTeams = query(async (owner: string, repo: string) => {
  try {
    return await ghAll<TeamAccess>(`/repos/${owner}/${repo}/teams`);
  } catch {
    return null;
  }
}, 'repo-teams');

export const getOrgTeams = query(async (org: string) => {
  try {
    return await ghAll<TeamAccess>(`/orgs/${org}/teams`);
  } catch {
    return [];
  }
}, 'org-teams');

export const searchUsers = query(async (q: string) => {
  if (q.trim().length < 2) return [];
  const res = await gh<{ items: SimpleUser[] }>('/search/users', { query: { q, per_page: 8 } });
  return res.items;
}, 'search-users');

/** Invite a user / change an existing collaborator's role (same endpoint). */
export const setCollaborator = action(async (owner: string, repo: string, user: string, permission: string) => {
  await gh(`/repos/${owner}/${repo}/collaborators/${user}`, { method: 'PUT', body: { permission } });
}, 'set-collaborator');

export const removeCollaborator = action(async (owner: string, repo: string, user: string) => {
  await gh(`/repos/${owner}/${repo}/collaborators/${user}`, { method: 'DELETE' });
}, 'remove-collaborator');

export const updateInvitation = action(async (owner: string, repo: string, id: number, permissions: string) => {
  await gh(`/repos/${owner}/${repo}/invitations/${id}`, { method: 'PATCH', body: { permissions } });
}, 'update-invitation');

export const cancelInvitation = action(async (owner: string, repo: string, id: number) => {
  await gh(`/repos/${owner}/${repo}/invitations/${id}`, { method: 'DELETE' });
}, 'cancel-invitation');

export const setTeamAccess = action(async (org: string, team: string, owner: string, repo: string, permission: string) => {
  await gh(`/orgs/${org}/teams/${team}/repos/${owner}/${repo}`, { method: 'PUT', body: { permission } });
}, 'set-team-access');

export const removeTeamAccess = action(async (org: string, team: string, owner: string, repo: string) => {
  await gh(`/orgs/${org}/teams/${team}/repos/${owner}/${repo}`, { method: 'DELETE' });
}, 'remove-team-access');

/* ----------------------------------------------------- branch protection */

const RULE_FIELDS = `id databaseId pattern requiresApprovingReviews requiredApprovingReviewCount dismissesStaleReviews
  requiresCodeOwnerReviews requireLastPushApproval requiresStatusChecks requiresStrictStatusChecks requiredStatusCheckContexts
  requiresConversationResolution requiresCommitSignatures requiresLinearHistory requiresDeployments isAdminEnforced
  allowsForcePushes allowsDeletions lockBranch matchingRefs(first:0){totalCount}`;

export const getBranchProtectionRules = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      id branchProtectionRules(first:100){nodes{${RULE_FIELDS}}}
    }}`,
    { owner, name: repo },
  );
  return {
    repositoryId: data.repository.id as string,
    rules: data.repository.branchProtectionRules.nodes as BranchProtectionRule[],
  };
}, 'branch-protection-rules');

/** Create (no `id`) or update a rule. Plain async so the form can navigate back. */
export async function saveBranchProtectionRule(repositoryId: string, id: string | null, input: BranchProtectionInput) {
  const fields = { ...input, requiredApprovingReviewCount: input.requiresApprovingReviews ? input.requiredApprovingReviewCount : null };
  if (id) {
    await gql(
      `mutation($input:UpdateBranchProtectionRuleInput!){updateBranchProtectionRule(input:$input){branchProtectionRule{id}}}`,
      { input: { branchProtectionRuleId: id, ...fields } },
    );
  } else {
    await gql(
      `mutation($input:CreateBranchProtectionRuleInput!){createBranchProtectionRule(input:$input){branchProtectionRule{id}}}`,
      { input: { repositoryId, ...fields } },
    );
  }
}

export const deleteBranchProtectionRule = action(async (id: string) => {
  await gql(`mutation($id:ID!){deleteBranchProtectionRule(input:{branchProtectionRuleId:$id}){clientMutationId}}`, { id });
}, 'delete-branch-protection-rule');

/* -------------------------------------------------------------- rulesets */

export const getRulesets = query(
  (owner: string, repo: string) =>
    ghAll<RulesetSummary>(`/repos/${owner}/${repo}/rulesets`, { query: { includes_parents: true } }),
  'rulesets',
);

export const getRuleset = query(
  (owner: string, repo: string, id: number) => gh<Ruleset>(`/repos/${owner}/${repo}/rulesets/${id}`),
  'ruleset',
);

export type RulesetInput = Pick<Ruleset, 'name' | 'target' | 'enforcement' | 'conditions' | 'rules' | 'bypass_actors'>;

export const saveRuleset = (owner: string, repo: string, id: number | null, input: RulesetInput) =>
  gh<Ruleset>(`/repos/${owner}/${repo}/rulesets${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: input });

/** Plain async: the editor page navigates away after deleting. */
export const deleteRuleset = (owner: string, repo: string, id: number) =>
  gh(`/repos/${owner}/${repo}/rulesets/${id}`, { method: 'DELETE' });

/* ------------------------------------------------------------- webhooks */

export const getHooks = query((owner: string, repo: string) => ghAll<Webhook>(`/repos/${owner}/${repo}/hooks`), 'hooks');

export const getHook = query(
  (owner: string, repo: string, id: number) => gh<Webhook>(`/repos/${owner}/${repo}/hooks/${id}`),
  'hook',
);

export const getHookDeliveries = query(
  (owner: string, repo: string, id: number) =>
    gh<HookDelivery[]>(`/repos/${owner}/${repo}/hooks/${id}/deliveries`, { query: { per_page: 50 } }),
  'hook-deliveries',
);

export const getHookDelivery = query(
  (owner: string, repo: string, id: number, delivery: number) =>
    gh<HookDeliveryDetail>(`/repos/${owner}/${repo}/hooks/${id}/deliveries/${delivery}`),
  'hook-delivery',
);

export interface HookInput {
  active: boolean;
  events: string[];
  config: { url: string; content_type: 'json' | 'form'; insecure_ssl: '0' | '1'; secret?: string };
}

export const saveHook = (owner: string, repo: string, id: number | null, input: HookInput) =>
  id
    ? gh<Webhook>(`/repos/${owner}/${repo}/hooks/${id}`, { method: 'PATCH', body: input })
    : gh<Webhook>(`/repos/${owner}/${repo}/hooks`, { method: 'POST', body: { name: 'web', ...input } });

export const deleteHook = (owner: string, repo: string, id: number) =>
  gh(`/repos/${owner}/${repo}/hooks/${id}`, { method: 'DELETE' });

export const pingHook = action(async (owner: string, repo: string, id: number) => {
  await gh(`/repos/${owner}/${repo}/hooks/${id}/pings`, { method: 'POST' });
}, 'ping-hook');

export const redeliverHook = action(async (owner: string, repo: string, id: number, delivery: number) => {
  await gh(`/repos/${owner}/${repo}/hooks/${id}/deliveries/${delivery}/attempts`, { method: 'POST' });
}, 'redeliver-hook');

/* ----------------------------------------------------------- deploy keys */

export const getDeployKeys = query(
  (owner: string, repo: string) => ghAll<DeployKey>(`/repos/${owner}/${repo}/keys`),
  'deploy-keys',
);

export const addDeployKey = (owner: string, repo: string, input: { title: string; key: string; read_only: boolean }) =>
  gh<DeployKey>(`/repos/${owner}/${repo}/keys`, { method: 'POST', body: input });

export const deleteDeployKey = action(async (owner: string, repo: string, id: number) => {
  await gh(`/repos/${owner}/${repo}/keys/${id}`, { method: 'DELETE' });
}, 'delete-deploy-key');

/* ------------------------------------------------- actions secrets/vars */

export const getActionsSecrets = query(
  (owner: string, repo: string) =>
    ghAll<ActionsSecret>(`/repos/${owner}/${repo}/actions/secrets`, { pick: (d) => d.secrets }),
  'actions-secrets',
);

/** Organization secrets shared with this repo (read-only list). */
export const getOrgSecrets = query(async (owner: string, repo: string) => {
  try {
    return await ghAll<ActionsSecret>(`/repos/${owner}/${repo}/actions/organization-secrets`, { pick: (d) => d.secrets });
  } catch {
    return [];
  }
}, 'actions-org-secrets');

export async function putActionsSecret(owner: string, repo: string, name: string, value: string) {
  const key = await gh<{ key_id: string; key: string }>(`/repos/${owner}/${repo}/actions/secrets/public-key`);
  const encrypted_value = await sealSecret(value, key.key);
  await gh(`/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: { encrypted_value, key_id: key.key_id },
  });
}

export const deleteActionsSecret = action(async (owner: string, repo: string, name: string) => {
  await gh(`/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' });
}, 'delete-actions-secret');

export const getActionsVariables = query(
  (owner: string, repo: string) =>
    ghAll<ActionsVariable>(`/repos/${owner}/${repo}/actions/variables`, { pick: (d) => d.variables, max: 500 }),
  'actions-variables',
);

export const getOrgVariables = query(async (owner: string, repo: string) => {
  try {
    return await ghAll<ActionsVariable>(`/repos/${owner}/${repo}/actions/organization-variables`, { pick: (d) => d.variables });
  } catch {
    return [];
  }
}, 'actions-org-variables');

export const getActionsVariable = query(
  (owner: string, repo: string, name: string) =>
    gh<ActionsVariable>(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`),
  'actions-variable',
);

/** Create (no `original`) or update a variable — renaming is allowed on update. */
export const saveActionsVariable = (owner: string, repo: string, original: string | null, name: string, value: string) =>
  original
    ? gh(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(original)}`, { method: 'PATCH', body: { name, value } })
    : gh(`/repos/${owner}/${repo}/actions/variables`, { method: 'POST', body: { name, value } });

export const deleteActionsVariable = action(async (owner: string, repo: string, name: string) => {
  await gh(`/repos/${owner}/${repo}/actions/variables/${encodeURIComponent(name)}`, { method: 'DELETE' });
}, 'delete-actions-variable');

/* -------------------------------------------------- actions permissions */

export interface ActionsPermissions {
  enabled: boolean;
  allowed_actions?: 'all' | 'local_only' | 'selected';
}
export interface WorkflowPermissions {
  default_workflow_permissions: 'read' | 'write';
  can_approve_pull_request_reviews: boolean;
}

export const getActionsPermissions = query(async (owner: string, repo: string) => {
  const [perms, workflow] = await Promise.all([
    gh<ActionsPermissions>(`/repos/${owner}/${repo}/actions/permissions`),
    gh<WorkflowPermissions>(`/repos/${owner}/${repo}/actions/permissions/workflow`).catch(() => null),
  ]);
  return { perms, workflow };
}, 'actions-permissions');

export const setActionsPermissions = action(async (owner: string, repo: string, body: ActionsPermissions) => {
  await gh(`/repos/${owner}/${repo}/actions/permissions`, {
    method: 'PUT',
    body: body.enabled ? body : { enabled: false },
  });
}, 'set-actions-permissions');

export const setWorkflowPermissions = action(async (owner: string, repo: string, body: WorkflowPermissions) => {
  await gh(`/repos/${owner}/${repo}/actions/permissions/workflow`, { method: 'PUT', body });
}, 'set-workflow-permissions');

/* ------------------------------------------------------------------ pages */

/** Pages config, or null when Pages is not enabled. */
export const getPages = query(async (owner: string, repo: string) => {
  try {
    return await gh<PagesInfo>(`/repos/${owner}/${repo}/pages`);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}, 'pages');

export const enablePages = action(
  async (owner: string, repo: string, body: { build_type: 'legacy' | 'workflow'; source?: { branch: string; path: string } }) => {
    await gh(`/repos/${owner}/${repo}/pages`, { method: 'POST', body });
  },
  'enable-pages',
);

export const updatePages = action(
  async (
    owner: string,
    repo: string,
    body: {
      build_type?: 'legacy' | 'workflow';
      source?: { branch: string; path: string };
      cname?: string | null;
      https_enforced?: boolean;
    },
  ) => {
    await gh(`/repos/${owner}/${repo}/pages`, { method: 'PUT', body });
  },
  'update-pages',
);

export const disablePages = action(async (owner: string, repo: string) => {
  await gh(`/repos/${owner}/${repo}/pages`, { method: 'DELETE' });
}, 'disable-pages');
