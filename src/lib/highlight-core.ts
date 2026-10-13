import type { HighlighterCore, ThemedToken } from 'shiki/core';

/**
 * Shiki highlighting proper — runs inside the highlight worker
 * (highlight.worker.ts), or on the main thread as a fallback where workers
 * are unavailable. The core, the JS regex engine and each grammar are separate
 * chunks fetched the first time a file of that language is highlighted.
 * Output is GitHub's light theme with the dark theme's colors carried in
 * --shiki-dark (switched by CSS in primer.css).
 */

const EXT_ALIASES: Record<string, string> = {
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  h: 'c',
  hh: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  yml: 'yaml',
  md: 'markdown',
  mdown: 'markdown',
  rs: 'rust',
  rb: 'ruby',
  py: 'python',
  pyi: 'python',
  kt: 'kotlin',
  kts: 'kotlin',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  fish: 'fish',
  ps1: 'powershell',
  cs: 'csharp',
  fs: 'fsharp',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hs: 'haskell',
  ml: 'ocaml',
  clj: 'clojure',
  tf: 'terraform',
  json5: 'json5',
  jsonc: 'jsonc',
  lock: 'json',
  htm: 'html',
  xhtml: 'html',
  svg: 'xml',
  plist: 'xml',
  csproj: 'xml',
  gradle: 'groovy',
  m: 'objective-c',
  mm: 'objective-cpp',
  pl: 'perl',
  pm: 'perl',
  sol: 'solidity',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'proto',
  dockerfile: 'docker',
  tex: 'latex',
  nix: 'nix',
  zig: 'zig',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'dotenv',
  diff: 'diff',
  patch: 'diff',
  sql: 'sql',
  prisma: 'prisma',
  glsl: 'glsl',
  wgsl: 'wgsl',
  hlsl: 'hlsl',
  lua: 'lua',
  dart: 'dart',
  swift: 'swift',
  go: 'go',
  java: 'java',
  scala: 'scala',
  php: 'php',
  r: 'r',
  jl: 'julia',
};

const FILENAMES: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  gnumakefile: 'make',
  cmakelists: 'cmake',
  'cmakelists.txt': 'cmake',
  '.gitignore': 'ini',
  '.editorconfig': 'ini',
  '.npmrc': 'ini',
  '.env': 'dotenv',
  justfile: 'just',
  gemfile: 'ruby',
  rakefile: 'ruby',
  'go.mod': 'go',
};

let highlighter: Promise<HighlighterCore> | undefined;
let bundled: Promise<typeof import('shiki/langs')> | undefined;

async function getHighlighter() {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ]);
    return createHighlighterCore({
      themes: [light.default, dark.default],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  })();
  return highlighter;
}

/** Shiki language id for a file name, or undefined for plain text. */
export async function languageFor(filename: string): Promise<string | undefined> {
  bundled ??= import('shiki/langs');
  const { bundledLanguages } = await bundled;
  const base = filename.split('/').pop()!.toLowerCase();
  if (FILENAMES[base]) return FILENAMES[base];
  const ext = base.includes('.') ? base.split('.').pop()! : base;
  const id = EXT_ALIASES[ext] ?? ext;
  return id in bundledLanguages ? id : undefined;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** github-light's color for the `comment` scope (and only that scope). */
const COMMENT_COLOR = '#6a737d';

function tokenHtml(token: ThemedToken) {
  const light = (token.htmlStyle?.color ?? token.color ?? '').toLowerCase();
  const style = token.htmlStyle
    ? Object.entries(token.htmlStyle)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')
    : token.color
      ? `color:${token.color}`
      : '';
  // `pl-c` marks comments like github.com's own highlighter (used by linkify-code).
  const cls = light === COMMENT_COLOR ? ' class="pl-c"' : '';
  return style ? `<span${cls} style="${style}">${escapeHtml(token.content)}</span>` : escapeHtml(token.content);
}

/**
 * Highlight `code` and return one HTML string per line, or null when the
 * language is unknown (callers render plain text).
 */
export async function highlightCode(code: string, filename: string, lang?: string): Promise<string[] | null> {
  const id = lang ?? (await languageFor(filename));
  if (!id) return null;
  const hl = await getHighlighter();
  if (!hl.getLoadedLanguages().includes(id)) {
    const { bundledLanguages } = await bundled!;
    const loader = bundledLanguages[id as keyof typeof bundledLanguages];
    if (!loader) return null;
    await hl.loadLanguage((await loader()).default);
  }
  const { tokens } = hl.codeToTokens(code, {
    lang: id,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light',
  });
  return tokens.map((line) => line.map(tokenHtml).join(''));
}

