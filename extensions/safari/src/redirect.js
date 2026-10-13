// Fallback for Safari versions whose declarativeNetRequest ignores the
// redirect rule in rules.json: runs before github.com renders and sends the
// page to GitHub Lite. Keep the exclusions in sync with rules.json.
(() => {
  const TARGET = 'https://gh.frnoch.dev';
  const { pathname, search, hash } = location;

  // Pages GitHub Lite can't replace: auth, account/billing, downloads, raw files…
  const KEEP = [
    /^\/(login|logout|session|sessions|signup|join|password_reset|auth|sso|oauth|account|organizations\/new|marketplace|sponsors|features|pricing|enterprise|codespaces|copilot|github-copilot|apps|user-attachments|site|security|readme|customer-stories|team|about|contact|\.well-known)(\/|$)/,
    /^\/settings\/(tokens|personal-access-tokens|security|apps|developers|connections|billing|installations|copilot)(\/|$)/,
    /^\/[^/]+\/[^/]+\/(raw|archive|releases\/download|zipball|tarball|upload|wiki|attestations|pull\/\d+\/conflicts|security\/code-scanning)(\/|$)/,
    /\.(diff|patch)$/,
  ];
  if (KEEP.some((re) => re.test(pathname))) return;

  // Links opened from GitHub Lite itself ("open on github.com") stay here.
  if (document.referrer.startsWith(TARGET)) return;

  location.replace(TARGET + pathname + search + hash);
})();
