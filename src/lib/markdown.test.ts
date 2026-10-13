import { describe, expect, test } from 'vitest';
import { resolveRepoUrls, rewriteHtmlLinks, toAppUrl } from './markdown';

describe('toAppUrl', () => {
  test('maps github.com pages onto the app', () => {
    expect(toAppUrl('https://github.com/solidjs/solid/issues/12')).toBe('/solidjs/solid/issues/12');
    expect(toAppUrl('https://github.com/solidjs/solid/blob/main/README.md#usage')).toBe('/solidjs/solid/blob/main/README.md#usage');
    expect(toAppUrl('https://github.com')).toBe('/');
  });

  test('keeps downloads and other hosts external', () => {
    expect(toAppUrl('https://github.com/user-attachments/assets/abc')).toBe('https://github.com/user-attachments/assets/abc');
    expect(toAppUrl('https://github.com/o/r/releases/download/v1/x.zip')).toBe('https://github.com/o/r/releases/download/v1/x.zip');
    expect(toAppUrl('https://github.com/o/r/pull/1.diff')).toBe('https://github.com/o/r/pull/1.diff');
    expect(toAppUrl('https://example.com/x')).toBe('https://example.com/x');
  });

  test('rewrites only hrefs in HTML', () => {
    const html = '<a href="https://github.com/a/b">x</a><img src="https://github.com/a/b/raw/main/x.png">';
    expect(rewriteHtmlLinks(html)).toBe('<a href="/a/b">x</a><img src="https://github.com/a/b/raw/main/x.png">');
  });
});

describe('resolveRepoUrls', () => {
  const ctx = { owner: 'o', repo: 'r', gitRef: 'main', path: 'docs/README.md' };
  test('images point at raw files, links at in-app blobs', () => {
    expect(resolveRepoUrls('<a href="img/x.png"><img src="img/x.png"></a>', ctx)).toBe(
      '<a href="/o/r/blob/main/docs/img/x.png"><img src="https://raw.githubusercontent.com/o/r/main/docs/img/x.png"></a>',
    );
    expect(resolveRepoUrls('<img src="/assets/a.svg">', ctx)).toBe(
      '<img src="https://raw.githubusercontent.com/o/r/main/assets/a.svg">',
    );
    expect(resolveRepoUrls('<a href="../CONTRIBUTING.md#setup">', ctx)).toBe('<a href="/o/r/blob/main/CONTRIBUTING.md#setup">');
  });
  test('leaves absolute URLs and anchors alone', () => {
    const html = '<a href="https://x.dev">x</a><a href="#usage">u</a><img src="https://camo.githubusercontent.com/a">';
    expect(resolveRepoUrls(html, ctx)).toBe(html);
  });
  test('private repos defer images to the API loader', () => {
    expect(resolveRepoUrls('<img src="a.png">', { ...ctx, private: true })).toBe('<img data-repo-src="docs/a.png">');
  });
});
