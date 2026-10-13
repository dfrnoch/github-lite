import { query } from '@solidjs/router';
import { GitHubError, gql } from '../../lib/github';

/** What every /orgs/:org/* page needs for the tab bar + permissions. */
export interface OrgMeta {
  id: string;
  databaseId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  description: string | null;
  viewerIsAMember: boolean;
  viewerCanAdminister: boolean;
  repositories: number;
  members: number;
  teams: number;
  projects: number;
  packages: number;
}

export const getOrgMeta = query(async (org: string): Promise<OrgMeta> => {
  const data = await gql<any>(
    `query($org:String!){organization(login:$org){
      id databaseId login name avatarUrl description viewerIsAMember viewerCanAdminister
      repositories{totalCount} membersWithRole{totalCount} teams{totalCount} projectsV2{totalCount} packages{totalCount}
    }}`,
    { org },
  );
  const o = data.organization;
  if (!o) throw new GitHubError(404, 'Not Found');
  return {
    id: o.id,
    databaseId: o.databaseId,
    login: o.login,
    name: o.name || null,
    avatarUrl: o.avatarUrl,
    description: o.description || null,
    viewerIsAMember: o.viewerIsAMember,
    viewerCanAdminister: o.viewerCanAdminister,
    repositories: o.repositories.totalCount,
    members: o.membersWithRole.totalCount,
    teams: o.teams.totalCount,
    projects: o.projectsV2.totalCount,
    packages: o.packages.totalCount,
  };
}, 'org-meta');
