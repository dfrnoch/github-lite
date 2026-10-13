/**
 * Code search proxy. `GET /search/code` is the one REST endpoint GitHub
 * serves without CORS headers, so browsers can't call it directly; this
 * server function forwards the request (with the user's token, never stored)
 * to api.github.com and hands back status, body and Link header. On a static
 * host without the server bundle the call fails and the page says so.
 */
export async function proxyCodeSearch(
  token: string,
  q: string,
  page: number,
  perPage: number,
): Promise<{ status: number; data: any; link: string | null }> {
  'use server';
  if (typeof token !== 'string' || typeof q !== 'string') throw new Error('Invalid request');
  const url = new URL('https://api.github.com/search/code');
  url.searchParams.set('q', q.slice(0, 256));
  url.searchParams.set('page', String(Math.max(1, Math.min(100, Math.floor(Number(page)) || 1))));
  url.searchParams.set('per_page', String(Math.max(1, Math.min(100, Math.floor(Number(perPage)) || 10))));
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.text-match+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'github-lite',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  return { status: res.status, data, link: res.headers.get('link') };
}
