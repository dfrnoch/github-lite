import { createMemo, Loading } from 'solid-js';
import { gearIcon, homeIcon, packageIcon, peopleIcon, personIcon, repoIcon, tableIcon } from '../../../icons/octicons';
import { ProfileTabs } from '../../profile/components/ProfileTabs';
import { orgReposHref } from '../../profile/links';
import { getOrgMeta, type OrgMeta } from '../api';

export type OrgTab = 'overview' | 'repositories' | 'projects' | 'packages' | 'teams' | 'people' | 'settings';

function tabsFor(org: OrgMeta | undefined, login: string) {
  const items = [
    { tab: 'overview', label: 'Overview', icon: homeIcon, href: `/${login}` },
    { tab: 'repositories', label: 'Repositories', icon: repoIcon, href: orgReposHref(login), count: org?.repositories },
    { tab: 'projects', label: 'Projects', icon: tableIcon, href: `/orgs/${login}/projects`, count: org?.projects },
    { tab: 'packages', label: 'Packages', icon: packageIcon, href: `/orgs/${login}/packages` },
  ];
  if (org?.viewerIsAMember) items.push({ tab: 'teams', label: 'Teams', icon: peopleIcon, href: `/orgs/${login}/teams`, count: org.teams });
  items.push({ tab: 'people', label: 'People', icon: personIcon, href: `/orgs/${login}/people`, count: org?.members });
  if (org?.viewerCanAdminister) items.push({ tab: 'settings', label: 'Settings', icon: gearIcon, href: `/orgs/${login}/settings/profile` });
  return items;
}

/** The organization tab bar (Overview, Repositories, …, Settings) in the header band. */
export default function OrgTabs(props: { login: string; active: OrgTab }) {
  const meta = createMemo(() => getOrgMeta(props.login));
  return (
    <Loading fallback={<ProfileTabs label="Organization" active={props.active} items={tabsFor(undefined, props.login)} />}>
      <ProfileTabs label="Organization" active={props.active} items={tabsFor(meta(), props.login)} />
    </Loading>
  );
}
