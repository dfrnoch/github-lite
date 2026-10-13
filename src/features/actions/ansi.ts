/**
 * ANSI SGR → HTML for job logs. Text is HTML-escaped; colors from the 16-color
 * palette become `ansi-fg-N` / `ansi-bg-N` classes (styled per theme in
 * actions.css), 256-color and truecolor become inline styles. Other escape
 * sequences (cursor movement, erase line…) are dropped.
 */

interface Style {
  fg: string | null; // class suffix ("1", "9") or css color
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

const RESET: Style = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false };

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/g;

/** Escape and turn URLs into links. */
function textToHtml(s: string, linkify: boolean) {
  if (!linkify || !s.includes('http')) return escapeHtml(s);
  let out = '';
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    out += escapeHtml(s.slice(last, m.index));
    const url = escapeHtml(m[0]);
    out += `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(s.slice(last));
}

function color256(n: number): string {
  if (n < 16) return `var(--ansi-${n})`;
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const i = n - 16;
  const steps = [0, 95, 135, 175, 215, 255];
  return `rgb(${steps[Math.floor(i / 36)]},${steps[Math.floor(i / 6) % 6]},${steps[i % 6]})`;
}

function applyCodes(style: Style, codes: number[]): Style {
  const s = { ...style };
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]!;
    if (c === 0) Object.assign(s, RESET);
    else if (c === 1) s.bold = true;
    else if (c === 2) s.dim = true;
    else if (c === 3) s.italic = true;
    else if (c === 4) s.underline = true;
    else if (c === 22) s.bold = s.dim = false;
    else if (c === 23) s.italic = false;
    else if (c === 24) s.underline = false;
    else if (c >= 30 && c <= 37) s.fg = String(c - 30);
    else if (c >= 90 && c <= 97) s.fg = String(c - 90 + 8);
    else if (c === 39) s.fg = null;
    else if (c >= 40 && c <= 47) s.bg = String(c - 40);
    else if (c >= 100 && c <= 107) s.bg = String(c - 100 + 8);
    else if (c === 49) s.bg = null;
    else if (c === 38 || c === 48) {
      let value: string | null = null;
      if (codes[i + 1] === 5 && codes[i + 2] != null) {
        value = color256(codes[i + 2]!);
        i += 2;
      } else if (codes[i + 1] === 2 && codes[i + 4] != null) {
        value = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
        i += 4;
      }
      if (value) {
        if (c === 38) s.fg = value;
        else s.bg = value;
      }
    }
  }
  return s;
}

function open(style: Style) {
  const classes: string[] = [];
  const css: string[] = [];
  if (style.fg) {
    if (/^\d+$/.test(style.fg)) classes.push(`ansi-fg-${style.fg}`);
    else css.push(`color:${style.fg}`);
  }
  if (style.bg) {
    if (/^\d+$/.test(style.bg)) classes.push(`ansi-bg-${style.bg}`);
    else css.push(`background-color:${style.bg}`);
  }
  if (style.bold) classes.push('ansi-bold');
  if (style.dim) classes.push('ansi-dim');
  if (style.italic) classes.push('ansi-italic');
  if (style.underline) classes.push('ansi-underline');
  if (!classes.length && !css.length) return '';
  return `<span${classes.length ? ` class="${classes.join(' ')}"` : ''}${css.length ? ` style="${css.join(';')}"` : ''}>`;
}

// CSI sequences (ESC [ params letter) and lone ESC (other two-char sequences).
// oxlint-disable-next-line no-control-regex -- matching terminal escape codes is the point
const ESC_RE = /\u001b\[([0-9;?]*)([A-Za-z])|\u001b[^[]/g;

/** Convert one log line with ANSI escapes into safe HTML. Styles carry across lines via `state`. */
export function ansiToHtml(line: string, state: { style: Style } = { style: { ...RESET } }, linkify = true) {
  if (!line.includes('\u001b')) {
    const o = open(state.style);
    return o ? `${o}${textToHtml(line, linkify)}</span>` : textToHtml(line, linkify);
  }
  let out = '';
  let last = 0;
  let current = state.style;
  let opened = open(current);
  out += opened;
  for (const m of line.matchAll(ESC_RE)) {
    out += textToHtml(line.slice(last, m.index), linkify);
    last = m.index! + m[0].length;
    if (m[2] !== 'm') continue;
    const codes = (m[1] || '0').split(';').map((n) => Number(n) || 0);
    current = applyCodes(current, codes);
    if (opened) out += '</span>';
    opened = open(current);
    out += opened;
  }
  out += textToHtml(line.slice(last), linkify);
  if (opened) out += '</span>';
  state.style = current;
  return out;
}

/** Drop all escape sequences (for search and plain-text copies). */
export const stripAnsi = (s: string) => s.replace(ESC_RE, '');

export const newAnsiState = () => ({ style: { ...RESET } });
