import { useLocation, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { defineFileRoute } from '@solidjs/router/fs';
import { createEffect, createMemo, Match, Switch } from 'solid-js';
import OrgOverview from '../../features/orgs/OrgOverview';
import { contributionRange, getContributions, getDayContributions, getOwnerProfile, getProfileReadme, type OrgProfile, type UserProfile as UserProfileData } from '../../features/profile/api';
import UserProfile from '../../features/profile/UserProfile';

export const route = defineFileRoute('/:owner/', {
  // Start the profile (and the default tab's data) before the page renders.
  preload: ({ params, location }) => {
    void getOwnerProfile(params.owner);
    const sp = new URLSearchParams(location.search);
    if (!sp.get('tab') || sp.get('tab') === 'overview') {
      const { year, day } = contributionRange(sp.get('from'), sp.get('to'));
      void getProfileReadme(params.owner, false).catch(() => {});
      void getContributions(params.owner, year).catch(() => {});
      if (day) void getDayContributions(params.owner, day).catch(() => {});
    }
  },
});

/** /:owner — a user's or an organization's profile (detected from the login). */
export default function OwnerPage() {
  const params = useParams<{ owner: string }>();
  const profile = createMemo(() => getOwnerProfile(params.owner));
  const [sp] = useSearchParams<{ tab?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // github.com sends /:org?tab=repositories (and other tabs) to /orgs/:org/<tab>.
  createEffect(
    () =>
      profile().type === 'Organization' && sp.tab && sp.tab !== 'overview'
        ? { tab: sp.tab, owner: params.owner, search: location.search }
        : null,
    (target) => {
      if (!target) return;
      const rest = new URLSearchParams(target.search);
      rest.delete('tab');
      const qs = rest.toString();
      const tab = target.tab === 'members' ? 'people' : target.tab;
      navigate(`/orgs/${target.owner}/${tab}${qs ? `?${qs}` : ''}`, { replace: true });
    },
  );
  return (
    <Switch>
      <Match when={profile().type === 'Organization' && (profile() as OrgProfile)}>{(org) => <OrgOverview org={org()} />}</Match>
      <Match when={profile().type === 'User' && (profile() as UserProfileData)}>{(user) => <UserProfile user={user()} />}</Match>
    </Switch>
  );
}
