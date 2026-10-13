import { action, query } from '@solidjs/router';
import { GitHubError, gh, ghAll, ghPage, gql } from '../../../lib/github';
import { enrichUsers, type UserCard } from '../../profile/api';

/**
 * Organization management: people (members, invitations, outside
 * collaborators), teams and org settings. Reads are router `query`s; writes
 * are `action`s, which revalidate the page's queries when they settle.
 */

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

export interface OrgPeople {
  /** Members with names (enriched through GraphQL, 100 per call). */
  members: UserCard[];
  /** Logins of owners (only known to org members). */
  admins: string[];
  /** Logins whose membership is public. */
  publicLogins: string[];
  /** Logins without 2FA (owners only); null when unavailable. */
  twoFaDisabled: string[] | null;
}

/** enrichUsers in chunks of 100 (the GraphQL `nodes` limit), in parallel. */
async function enrichAll(users: any[]): Promise<UserCard[]> {
  const chunks: any[][] = [];
  for (let i = 0; i < users.length; i += 100) chunks.push(users.slice(i, i + 100));
  return (await Promise.all(chunks.map((c) => enrichUsers(c)))).flat();
}

const optional = <T>(p: Promise<T>) => p.catch(() => null);

/**
 * Every member plus the extra lists needed to label them. Members see
 * private members and roles; the 2FA list only answers for owners (null
 * otherwise). Everything starts at once — no wait on the viewer's role.
 */
export const getOrgPeople = query(async (org: string): Promise<OrgPeople> => {
  const [members, admins, publics, noTwoFa] = await Promise.all([
    ghAll<any>(`/orgs/${org}/members`, { max: 1000 }),
    optional(ghAll<any>(`/orgs/${org}/members`, { query: { role: 'admin' }, max: 1000 })),
    optional(ghAll<any>(`/orgs/${org}/public_members`, { max: 1000 })),
    optional(ghAll<any>(`/orgs/${org}/members`, { query: { filter: '2fa_disabled' }, max: 1000 })),
  ]);
  return {
    members: await enrichAll(members),
    admins: (admins ?? []).map((u) => u.login),
    publicLogins: (publics ?? []).map((u) => u.login),
    twoFaDisabled: noTwoFa ? noTwoFa.map((u) => u.login) : null,
  };
}, 'org-manage-people');

export interface OrgInvitation {
  id: number;
  login: string | null;
  email: string | null;
  role: string;
  created_at: string;
  failed_at?: string | null;
  failed_reason?: string | null;
  inviter: { login: string; avatar_url: string } | null;
  team_count: number;
}

const slimInvite = (i: any): OrgInvitation => ({
  id: i.id,
  login: i.login,
  email: i.email,
  role: i.role,
  created_at: i.created_at,
  failed_at: i.failed_at ?? null,
  failed_reason: i.failed_reason ?? null,
  inviter: i.inviter ? { login: i.inviter.login, avatar_url: i.inviter.avatar_url } : null,
  team_count: i.team_count ?? 0,
});

/** Pending (`which = 'pending'`) or failed invitations. Owners only. */
export const getOrgInvitations = query(async (org: string, which: 'pending' | 'failed'): Promise<OrgInvitation[]> => {
  const path = which === 'pending' ? `/orgs/${org}/invitations` : `/orgs/${org}/failed_invitations`;
  return (await ghAll<any>(path, { max: 500 })).map(slimInvite);
}, 'org-manage-invitations');

export const getOutsideCollaborators = query(async (org: string, twoFa: string): Promise<UserCard[]> => {
  const list = await ghAll<any>(`/orgs/${org}/outside_collaborators`, {
    query: { filter: twoFa === 'disabled' ? '2fa_disabled' : undefined },
    max: 1000,
  });
  return enrichAll(list);
}, 'org-manage-outside-collaborators');

/** Every team (id/name/slug) for pickers: invite dialog, parent team select. */
export const getTeamOptions = query(async (org: string) => {
  const teams = await ghAll<any>(`/orgs/${org}/teams`, { max: 500 });
  return teams
    .map((t) => ({ id: t.id as number, name: t.name as string, slug: t.slug as string, privacy: t.privacy as string, parent: (t.parent?.slug as string) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, 'org-manage-team-options');

export type InviteRole = 'direct_member' | 'admin' | 'billing_manager';

export const inviteMember = action(
  async (org: string, invitee: string, role: InviteRole, teamIds: number[]) => {
    const value = invitee.trim().replace(/^@/, '');
    const body: Record<string, unknown> = { role, team_ids: teamIds };
    if (value.includes('@')) body.email = value;
    else {
      const user = await gh<{ id: number }>(`/users/${encodeURIComponent(value)}`).catch((e) => {
        throw e instanceof GitHubError && e.status === 404 ? new Error(`No GitHub user named “${value}”`) : e;
      });
      body.invitee_id = user.id;
    }
    await gh(`/orgs/${org}/invitations`, { method: 'POST', body });
  },
  'org-invite-member',
);

export const cancelInvitation = action(async (org: string, id: number) => {
  await gh(`/orgs/${org}/invitations/${id}`, { method: 'DELETE' });
}, 'org-cancel-invitation');

/** role: 'admin' (Owner) | 'member'. */
export const setMemberRole = action(async (org: string, logins: string[], role: 'admin' | 'member') => {
  for (const login of logins) {
    await gh(`/orgs/${org}/memberships/${login}`, { method: 'PUT', body: { role } });
  }
}, 'org-set-member-role');

export const removeMembers = action(async (org: string, logins: string[]) => {
  for (const login of logins) {
    await gh(`/orgs/${org}/memberships/${login}`, { method: 'DELETE' });
  }
}, 'org-remove-members');

export const convertToOutsideCollaborator = action(async (org: string, login: string) => {
  await gh(`/orgs/${org}/outside_collaborators/${login}`, { method: 'PUT' });
}, 'org-convert-outside-collaborator');

export const removeOutsideCollaborator = action(async (org: string, login: string) => {
  await gh(`/orgs/${org}/outside_collaborators/${login}`, { method: 'DELETE' });
}, 'org-remove-outside-collaborator');

/** Publicize / conceal the viewer's own membership. */
export const setMembershipVisibility = action(async (org: string, login: string, isPublic: boolean) => {
  await gh(`/orgs/${org}/public_members/${login}`, { method: isPublic ? 'PUT' : 'DELETE' });
}, 'org-set-membership-visibility');

/* ------------------------------------------------------------------ */
/* Teams                                                                */
/* ------------------------------------------------------------------ */

export interface TeamSummary {
  databaseId: number;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'SECRET' | 'VISIBLE';
  avatarUrl: string | null;
  parentTeam: { slug: string; name: string } | null;
  members: number;
  memberAvatars: { login: string; avatarUrl: string }[];
  childTeams: number;
  viewerCanAdminister: boolean;
}

export const getOrgTeams = query(async (org: string, q: string): Promise<{ totalCount: number; teams: TeamSummary[] }> => {
  const data = await gql<any>(
    `query($org:String!,$q:String){organization(login:$org){teams(first:100, query:$q, orderBy:{field:NAME,direction:ASC}){
      totalCount nodes{databaseId name slug description privacy avatarUrl parentTeam{slug name}
      members(first:5){totalCount nodes{login avatarUrl}} childTeams{totalCount} viewerCanAdminister}}}}`,
    { org, q: q || null },
  );
  const t = data.organization?.teams;
  if (!t) throw new GitHubError(404, 'Not Found');
  return {
    totalCount: t.totalCount,
    teams: t.nodes.map((n: any) => ({
      databaseId: n.databaseId,
      name: n.name,
      slug: n.slug,
      description: n.description || null,
      privacy: n.privacy,
      avatarUrl: n.avatarUrl,
      parentTeam: n.parentTeam,
      members: n.members.totalCount,
      memberAvatars: n.members.nodes,
      childTeams: n.childTeams.totalCount,
      viewerCanAdminister: n.viewerCanAdminister,
    })),
  };
}, 'org-manage-teams');

export interface TeamDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'closed' | 'secret';
  notification_setting: 'notifications_enabled' | 'notifications_disabled';
  parent: { id: number; name: string; slug: string } | null;
  avatarUrl: string | null;
  viewerCanAdminister: boolean;
  members: number;
  repositories: number;
  childTeams: { name: string; slug: string; description: string | null; members: number }[];
}

export const getTeam = query(async (org: string, slug: string): Promise<TeamDetail> => {
  const [rest, data] = await Promise.all([
    gh<any>(`/orgs/${org}/teams/${slug}`),
    gql<any>(
      `query($org:String!,$slug:String!){organization(login:$org){team(slug:$slug){avatarUrl viewerCanAdminister
        childTeams(first:50){nodes{name slug description members{totalCount}}} members{totalCount} repositories{totalCount}}}}`,
      { org, slug },
    ).catch(() => null),
  ]);
  const g = data?.organization?.team;
  return {
    id: rest.id,
    name: rest.name,
    slug: rest.slug,
    description: rest.description || null,
    privacy: rest.privacy,
    notification_setting: rest.notification_setting,
    parent: rest.parent ? { id: rest.parent.id, name: rest.parent.name, slug: rest.parent.slug } : null,
    avatarUrl: g?.avatarUrl ?? null,
    viewerCanAdminister: !!g?.viewerCanAdminister,
    members: g?.members.totalCount ?? rest.members_count ?? 0,
    repositories: g?.repositories.totalCount ?? rest.repos_count ?? 0,
    childTeams: (g?.childTeams.nodes ?? []).map((c: any) => ({
      name: c.name,
      slug: c.slug,
      description: c.description || null,
      members: c.members.totalCount,
    })),
  };
}, 'org-manage-team');

export interface TeamMember {
  login: string;
  name: string | null;
  avatarUrl: string;
  role: 'MAINTAINER' | 'MEMBER';
}

export const getTeamMembers = query(async (org: string, slug: string): Promise<TeamMember[]> => {
  const out: TeamMember[] = [];
  let after: string | null = null;
  for (let i = 0; i < 10; i++) {
    const data: any = await gql(
      `query($org:String!,$slug:String!,$after:String){organization(login:$org){team(slug:$slug){
        members(first:100, after:$after, membership:ALL, orderBy:{field:LOGIN,direction:ASC}){
          pageInfo{hasNextPage endCursor} edges{role node{login name avatarUrl}}}}}}`,
      { org, slug, after },
    );
    const m = data.organization?.team?.members;
    if (!m) throw new GitHubError(404, 'Not Found');
    for (const e of m.edges) out.push({ login: e.node.login, name: e.node.name || null, avatarUrl: e.node.avatarUrl, role: e.role });
    if (!m.pageInfo.hasNextPage) break;
    after = m.pageInfo.endCursor;
  }
  return out;
}, 'org-manage-team-members');

export interface TeamRepo {
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  visibility?: string;
  description: string | null;
  role_name: string | null;
  permission: string;
  archived: boolean;
}

const permissionOf = (r: any) => {
  if (r.role_name) return ({ read: 'pull', write: 'push' } as Record<string, string>)[r.role_name] ?? r.role_name;
  const p = r.permissions ?? {};
  return p.admin ? 'admin' : p.maintain ? 'maintain' : p.push ? 'push' : p.triage ? 'triage' : 'pull';
};

export const getTeamRepos = query(async (org: string, slug: string, page: number) => {
  const res = await ghPage<any>(`/orgs/${org}/teams/${slug}/repos`, { page, perPage: 30 });
  return {
    pageInfo: res.pageInfo,
    items: res.items.map(
      (r): TeamRepo => ({
        name: r.name,
        full_name: r.full_name,
        owner: r.owner.login,
        private: r.private,
        visibility: r.visibility,
        description: r.description,
        role_name: r.role_name ?? null,
        permission: permissionOf(r),
        archived: r.archived,
      }),
    ),
  };
}, 'org-manage-team-repos');

export interface TeamInput {
  name: string;
  description: string;
  privacy: 'closed' | 'secret';
  parent_team_id: number | null;
  notification_setting: 'notifications_enabled' | 'notifications_disabled';
}

/** Creates a team; resolves to its slug. */
export const createTeam = action(async (org: string, input: TeamInput) => {
  const body: Record<string, unknown> = { ...input };
  if (input.parent_team_id == null) delete body.parent_team_id;
  const team = await gh<{ slug: string }>(`/orgs/${org}/teams`, { method: 'POST', body });
  return team.slug;
}, 'org-create-team');

/** Updates a team; resolves to its (possibly new) slug. */
export const updateTeam = action(async (org: string, slug: string, input: TeamInput) => {
  const team = await gh<{ slug: string }>(`/orgs/${org}/teams/${slug}`, { method: 'PATCH', body: input });
  return team.slug;
}, 'org-update-team');

export const deleteTeam = action(async (org: string, slug: string) => {
  await gh(`/orgs/${org}/teams/${slug}`, { method: 'DELETE' });
}, 'org-delete-team');

export const setTeamMembership = action(async (org: string, slug: string, login: string, role: 'member' | 'maintainer') => {
  await gh(`/orgs/${org}/teams/${slug}/memberships/${login.trim().replace(/^@/, '')}`, { method: 'PUT', body: { role } });
}, 'org-set-team-membership');

export const removeTeamMember = action(async (org: string, slug: string, login: string) => {
  await gh(`/orgs/${org}/teams/${slug}/memberships/${login}`, { method: 'DELETE' });
}, 'org-remove-team-member');

export const setTeamRepo = action(async (org: string, slug: string, fullName: string, permission: string) => {
  await gh(`/orgs/${org}/teams/${slug}/repos/${fullName}`, { method: 'PUT', body: { permission } });
}, 'org-set-team-repo');

export const removeTeamRepo = action(async (org: string, slug: string, fullName: string) => {
  await gh(`/orgs/${org}/teams/${slug}/repos/${fullName}`, { method: 'DELETE' });
}, 'org-remove-team-repo');

/* ------------------------------------------------------------------ */
/* Organization settings                                                */
/* ------------------------------------------------------------------ */

export interface OrgSettings {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  description: string | null;
  blog: string | null;
  twitter_username: string | null;
  location: string | null;
  company: string | null;
  billing_email?: string | null;
  plan?: { name: string; seats?: number; filled_seats?: number };
  default_repository_permission?: 'none' | 'read' | 'write' | 'admin';
  members_can_create_repositories?: boolean;
  members_can_create_public_repositories?: boolean;
  members_can_create_private_repositories?: boolean;
  members_can_create_internal_repositories?: boolean;
  members_can_fork_private_repositories?: boolean;
  members_can_create_pages?: boolean;
  members_can_create_public_pages?: boolean;
  members_can_create_private_pages?: boolean;
  web_commit_signoff_required?: boolean;
  members_can_create_teams?: boolean;
  two_factor_requirement_enabled?: boolean;
  has_organization_projects?: boolean;
  has_repository_projects?: boolean;
}

export const getOrgSettings = query(async (org: string) => gh<OrgSettings>(`/orgs/${org}`), 'org-manage-settings');

export const updateOrg = action(async (org: string, patch: Partial<OrgSettings>) => {
  await gh(`/orgs/${org}`, { method: 'PATCH', body: patch });
}, 'org-update-settings');

export const deleteOrg = action(async (org: string) => {
  await gh(`/orgs/${org}`, { method: 'DELETE' });
}, 'org-delete');
