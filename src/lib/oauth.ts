/**
 * OAuth server functions. GitHub's token endpoint has no CORS and needs the
 * client secret, so the code→token exchange is the one thing that runs on a
 * server. Configure an OAuth App (callback URL: <origin>/login/callback) and
 * set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET in the server's environment
 * (or .env in development). Without them, OAuth is simply not offered and
 * sign-in falls back to a personal access token.
 */

export async function getOAuthClientId(): Promise<string | null> {
  'use server';
  return process.env.GITHUB_CLIENT_ID || null;
}

export async function exchangeOAuthCode(code: string): Promise<{ token: string; scope: string }> {
  'use server';
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('OAuth is not configured on this server.');
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = (await res.json()) as { access_token?: string; scope?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description ?? 'GitHub did not return a token.');
  return { token: data.access_token, scope: data.scope ?? '' };
}
