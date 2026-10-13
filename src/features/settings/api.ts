import { action, query } from '@solidjs/router';
import { getToken } from '../../lib/auth';
import { buildUrl, gh, ghAll, GitHubError } from '../../lib/github';
import type { SimpleUser } from '../../lib/types';

/**
 * Personal account settings (/settings/*). Most /user/* endpoints need a
 * token scope (user, user:email, read:public_key, …); without it GitHub
 * answers 404 (classic tokens) or 403 (fine-grained). Those reads resolve to
 * `null` here so pages can explain which scope is missing instead of erroring.
 */
async function scoped<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 404 || err.status === 403)) return null;
    throw err;
  }
}

// ---------- Types ----------

export interface Email {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: 'public' | 'private' | null;
}

export interface SocialAccount {
  provider: string;
  url: string;
}

export interface SshKey {
  id: number;
  key: string;
  title: string;
  created_at: string;
  verified?: boolean;
  read_only?: boolean;
  last_used?: string | null;
  /** "SHA256:…" computed locally from the key blob (the API doesn't return it). */
  fingerprint: string;
}

export interface GpgKey {
  id: number;
  name: string | null;
  key_id: string;
  public_key: string;
  emails: { email: string; verified: boolean }[];
  subkeys: { key_id: string }[];
  created_at: string;
  expires_at: string | null;
  revoked?: boolean;
  can_sign: boolean;
  can_encrypt_comms: boolean;
  can_encrypt_storage: boolean;
  can_certify: boolean;
}

export interface OrgMembership {
  state: 'active' | 'pending';
  role: 'admin' | 'member' | 'billing_manager' | string;
  organization: { login: string; avatar_url: string; description?: string | null };
  user: { login: string };
  /** Whether the viewer's membership is publicized (active memberships only). */
  publicized: boolean;
}

export interface TokenInfo {
  /** null when the response has no X-OAuth-Scopes header (fine-grained / GitHub App tokens). */
  scopes: string[] | null;
  expiration: string | null;
  sso: string | null;
  kind: 'classic' | 'fine-grained' | 'oauth' | 'app' | 'unknown';
}

// ---------- Helpers ----------

/** OpenSSH-style SHA256 fingerprint ("SHA256:base64-without-padding") of a public key line. */
export async function sshFingerprint(key: string): Promise<string> {
  const blob = key.trim().split(/\s+/)[1];
  if (!blob || typeof crypto === 'undefined' || !crypto.subtle) return '';
  try {
    const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    let bin = '';
    for (const b of digest) bin += String.fromCharCode(b);
    return `SHA256:${btoa(bin).replace(/=+$/, '')}`;
  } catch {
    return '';
  }
}

const withFingerprints = (keys: Omit<SshKey, 'fingerprint'>[]) =>
  Promise.all(keys.map(async (k) => ({ ...k, fingerprint: await sshFingerprint(k.key) })));

/** The scope a classic token needs for each settings read (for "missing scope" notices). */
export const REQUIRED_SCOPES = {
  emails: 'user:email',
  keys: 'read:public_key',
  signingKeys: 'read:ssh_signing_key',
  gpgKeys: 'read:gpg_key',
  blocks: 'user',
  profile: 'user',
  orgs: 'read:org',
} as const;

// ---------- Reads ----------

export const getEmails = query(() => scoped(ghAll<Email>('/user/emails')), 'settings-emails');

export const getSocialAccounts = query(
  () => scoped(ghAll<SocialAccount>('/user/social_accounts')),
  'settings-social-accounts',
);

export const getSshKeys = query(
  async () => {
    const keys = await scoped(ghAll<Omit<SshKey, 'fingerprint'>>('/user/keys'));
    return keys && withFingerprints(keys);
  },
  'settings-ssh-keys',
);

export const getSigningKeys = query(
  async () => {
    const keys = await scoped(ghAll<Omit<SshKey, 'fingerprint'>>('/user/ssh_signing_keys'));
    return keys && withFingerprints(keys);
  },
  'settings-ssh-signing-keys',
);

export const getGpgKeys = query(() => scoped(ghAll<GpgKey>('/user/gpg_keys')), 'settings-gpg-keys');

export const getBlockedUsers = query(() => scoped(ghAll<SimpleUser>('/user/blocks')), 'settings-blocks');

/** Org memberships (active + pending) with each active one's public/private visibility. */
export const getOrgMemberships = query(async () => {
  const memberships = await scoped(ghAll<Omit<OrgMembership, 'publicized'>>('/user/memberships/orgs'));
  if (!memberships) return null;
  return Promise.all(
    memberships.map(async (m) => {
      if (m.state !== 'active') return { ...m, publicized: false };
      // 204 → public member, 404 → private (concealed) membership.
      const publicized = await gh(`/orgs/${m.organization.login}/public_members/${m.user.login}`).then(
        () => true,
        () => false,
      );
      return { ...m, publicized };
    }),
  );
}, 'settings-org-memberships');

/**
 * Details of the token in use, from the response headers of GET /user.
 * `gh()` only returns the body, so this is a direct fetch.
 */
export const getTokenInfo = query(async (): Promise<TokenInfo> => {
  const token = getToken() ?? '';
  const res = await fetch(buildUrl('/user'), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new GitHubError(res.status, `${res.status} ${res.statusText}`);
  const header = res.headers.get('x-oauth-scopes');
  const scopes = header == null ? null : header.split(',').map((s) => s.trim()).filter(Boolean);
  const kind: TokenInfo['kind'] = token.startsWith('ghp_')
    ? 'classic'
    : token.startsWith('github_pat_')
      ? 'fine-grained'
      : token.startsWith('gho_')
        ? 'oauth'
        : token.startsWith('ghu_') || token.startsWith('ghs_')
          ? 'app'
          : 'unknown';
  return {
    scopes,
    expiration: res.headers.get('github-authentication-token-expiration'),
    sso: res.headers.get('x-github-sso'),
    kind,
  };
}, 'settings-token-info');

/** Whether a classic scope list grants `scope` (parents imply children: user ⊃ user:email, admin:x ⊃ write:x ⊃ read:x). */
export function hasScope(scopes: string[], scope: string): boolean {
  if (scopes.includes(scope)) return true;
  const [prefix, name] = scope.includes(':') ? scope.split(':') : [undefined, scope];
  if (!name) return false;
  if (prefix === 'read') return scopes.includes(`write:${name}`) || scopes.includes(`admin:${name}`);
  if (prefix === 'write') return scopes.includes(`admin:${name}`);
  // user:email, user:follow, repo:status, … are covered by their parent.
  return prefix != null && !['admin', 'read', 'write'].includes(prefix) && scopes.includes(prefix);
}

// ---------- Writes ----------

export interface ProfileUpdate {
  name: string;
  email: string;
  blog: string;
  twitter_username: string;
  company: string;
  location: string;
  hireable: boolean;
  bio: string;
}

/** PATCH /user — "Update the authenticated user". */
export const updateProfile = action(async (profile: ProfileUpdate) => {
  await gh('/user', { method: 'PATCH', body: profile });
}, 'settings-update-profile');

export const addSocialAccount = action(async (url: string) => {
  await gh('/user/social_accounts', { method: 'POST', body: { account_urls: [url] } });
}, 'settings-add-social-account');

export const removeSocialAccount = action(async (url: string) => {
  await gh('/user/social_accounts', { method: 'DELETE', body: { account_urls: [url] } });
}, 'settings-remove-social-account');

export const addEmail = action(async (email: string) => {
  await gh('/user/emails', { method: 'POST', body: { emails: [email] } });
}, 'settings-add-email');

export const deleteEmail = action(async (email: string) => {
  await gh('/user/emails', { method: 'DELETE', body: { emails: [email] } });
}, 'settings-delete-email');

export const setEmailVisibility = action(async (visibility: 'public' | 'private') => {
  await gh('/user/email/visibility', { method: 'PATCH', body: { visibility } });
}, 'settings-email-visibility');

export type KeyKind = 'ssh' | 'signing' | 'gpg';

const keyPath: Record<KeyKind, string> = {
  ssh: '/user/keys',
  signing: '/user/ssh_signing_keys',
  gpg: '/user/gpg_keys',
};

export const addKey = action(async (kind: KeyKind, title: string, key: string) => {
  const body = kind === 'gpg' ? { name: title || undefined, armored_public_key: key } : { title, key };
  await gh(keyPath[kind], { method: 'POST', body });
}, 'settings-add-key');

export const deleteKey = action(async (kind: KeyKind, id: number) => {
  await gh(`${keyPath[kind]}/${id}`, { method: 'DELETE' });
}, 'settings-delete-key');

export const setOrgMembershipPublic = action(async (org: string, login: string, publicize: boolean) => {
  await gh(`/orgs/${org}/public_members/${login}`, { method: publicize ? 'PUT' : 'DELETE' });
}, 'settings-org-publicize');

export const leaveOrg = action(async (org: string, login: string) => {
  await gh(`/orgs/${org}/members/${login}`, { method: 'DELETE' });
}, 'settings-leave-org');

export const acceptOrgInvitation = action(async (org: string) => {
  await gh(`/user/memberships/orgs/${org}`, { method: 'PATCH', body: { state: 'active' } });
}, 'settings-accept-org');

export const blockUser = action(async (login: string) => {
  await gh(`/user/blocks/${encodeURIComponent(login)}`, { method: 'PUT' });
}, 'settings-block-user');

export const unblockUser = action(async (login: string) => {
  await gh(`/user/blocks/${encodeURIComponent(login)}`, { method: 'DELETE' });
}, 'settings-unblock-user');
