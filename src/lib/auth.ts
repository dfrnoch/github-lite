import { createSignal } from 'solid-js';

/**
 * The signed-in session is just a GitHub token kept in localStorage — either
 * a personal access token pasted on /login or one obtained via the OAuth flow
 * (src/lib/oauth.ts). It never leaves the browser except to api.github.com.
 */

const TOKEN_KEY = 'gh-lite:token';
const RETURN_KEY = 'gh-lite:return-to';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

// ownedWrite: a 401 seen while a page's data loads clears the token from
// inside that computation.
const [token, setTokenSignal] = createSignal<string | null>(stored, { ownedWrite: true });

export const getToken = () => token();
export const isSignedIn = () => !!token();

export function signIn(newToken: string) {
  localStorage.setItem(TOKEN_KEY, newToken.trim());
  setTokenSignal(newToken.trim());
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  setTokenSignal(null);
}

/** Called by the API client on a 401: the token was revoked or expired. */
export function handleUnauthorized() {
  if (!token()) return;
  localStorage.removeItem(TOKEN_KEY);
  setTokenSignal(null);
}

/** Remember where to go after signing in (the page that required auth). */
export function rememberReturnTo(path: string) {
  if (!path.startsWith('/login')) sessionStorage.setItem(RETURN_KEY, path);
}
export function takeReturnTo() {
  const path = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return path && path.startsWith('/') ? path : '/';
}

/**
 * Scopes requested for OAuth and pre-filled for classic personal access
 * tokens — broad on purpose, so everything the API allows can be done here.
 */
export const SCOPES = [
  'repo',
  'workflow',
  'delete_repo',
  'admin:org',
  'admin:repo_hook',
  'admin:org_hook',
  'admin:public_key',
  'admin:gpg_key',
  'admin:ssh_signing_key',
  'user',
  'notifications',
  'gist',
  'project',
  'write:discussion',
  'read:packages',
];

export const newTokenUrl = () =>
  `https://github.com/settings/tokens/new?description=${encodeURIComponent('GitHub Lite')}&scopes=${SCOPES.join(',')}`;
