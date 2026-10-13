import type { DispatchInput } from './types';

/**
 * A tiny YAML subset parser — enough for workflow files: block mappings,
 * block sequences, plain / quoted scalars, flow sequences (`[a, b]`), empty
 * flow maps (`{}`) and block scalars (`|`, `>`). Anchors, multi-document
 * streams and multi-line plain scalars are not supported (not needed to read
 * `on.workflow_dispatch.inputs`).
 */

type YamlValue = string | boolean | number | null | YamlValue[] | { [key: string]: YamlValue };

interface Line {
  indent: number;
  text: string;
  /** Untouched source (block scalars keep their content verbatim). */
  raw: string;
}

function stripComment(line: string) {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      // Only a quote at the start of a scalar opens a quoted string.
      const prev = line.slice(0, i).trimEnd();
      if (!prev || prev.endsWith(':') || prev.endsWith('-') || prev.endsWith('[') || prev.endsWith(',')) quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]!))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitFlow(inner: string) {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const c of inner) {
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim());
}

function scalar(text: string): YamlValue {
  const t = text.trim();
  if (t === '' || t === '~' || t === 'null') return null;
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'");
  if (t.startsWith('[') && t.endsWith(']')) return splitFlow(t.slice(1, -1)).map(scalar);
  if (t.startsWith('{') && t.endsWith('}')) {
    const obj: Record<string, YamlValue> = {};
    for (const part of splitFlow(t.slice(1, -1))) {
      const idx = part.indexOf(':');
      if (idx > 0) obj[unquote(part.slice(0, idx))] = scalar(part.slice(idx + 1));
    }
    return obj;
  }
  if (t === 'true' || t === 'True' || t === 'TRUE') return true;
  if (t === 'false' || t === 'False' || t === 'FALSE') return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

const unquote = (key: string) => {
  const k = key.trim();
  return (k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'")) ? k.slice(1, -1) : k;
};

/** Index of the `:` separating a mapping key from its value, or -1. */
function keySeparator(text: string) {
  if (text.startsWith('"') || text.startsWith("'")) {
    const end = text.indexOf(text[0]!, 1);
    if (end < 0) return -1;
    const rest = text.slice(end + 1);
    return /^\s*:(\s|$)/.test(rest) ? end + 1 + rest.indexOf(':') : -1;
  }
  const m = /:(\s|$)/.exec(text);
  if (!m || text.startsWith('[') || text.startsWith('{')) return -1;
  return m.index;
}

export function parseYaml(source: string): YamlValue {
  const lines: Line[] = [];
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const text = stripComment(raw).trimEnd();
    if (!text.trim() || text.trim() === '---') {
      lines.push({ indent: -1, text: '', raw });
      continue;
    }
    lines.push({ indent: text.length - text.trimStart().length, text: text.trim(), raw });
  }
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && lines[i]!.indent < 0) i++;
  };

  function blockScalar(parentIndent: number, style: string): string {
    const out: string[] = [];
    let indent = -1;
    while (i < lines.length) {
      const l = lines[i]!;
      const rawIndent = l.raw.length - l.raw.trimStart().length;
      if (l.raw.trim() && rawIndent <= parentIndent) break;
      if (l.raw.trim() && indent < 0) indent = rawIndent;
      out.push(indent >= 0 ? l.raw.slice(indent) : '');
      i++;
    }
    while (out.length && !out[out.length - 1]!.trim()) out.pop();
    return style.startsWith('>') ? out.join(' ') : out.join('\n');
  }

  function valueAfterKey(rest: string, indent: number): YamlValue {
    if (rest.startsWith('|') || rest.startsWith('>')) return blockScalar(indent, rest);
    if (rest) return scalar(rest);
    skipBlank();
    const next = lines[i];
    if (!next) return null;
    // A sequence may sit at the same indentation as its key.
    if (next.indent > indent || (next.indent === indent && next.text.startsWith('- '))) return block(next.indent);
    return null;
  }

  function block(indent: number): YamlValue {
    skipBlank();
    const first = lines[i];
    if (!first) return null;
    if (first.text === '-' || first.text.startsWith('- ')) {
      const arr: YamlValue[] = [];
      while (i < lines.length) {
        skipBlank();
        const l = lines[i];
        if (!l || l.indent !== indent || !(l.text === '-' || l.text.startsWith('- '))) break;
        const content = l.text.slice(1).trimStart();
        if (!content) {
          i++;
          arr.push(valueAfterKey('', indent));
        } else if (keySeparator(content) > 0) {
          // "- key: value" opens a mapping indented past the dash.
          const childIndent = indent + (l.text.length - content.length);
          lines[i] = { indent: childIndent, text: content, raw: l.raw };
          arr.push(mapping(childIndent));
        } else {
          i++;
          arr.push(scalar(content));
        }
      }
      return arr;
    }
    if (keySeparator(first.text) > 0) return mapping(indent);
    i++;
    return scalar(first.text);
  }

  function mapping(indent: number): YamlValue {
    const obj: Record<string, YamlValue> = {};
    while (i < lines.length) {
      skipBlank();
      const l = lines[i];
      if (!l || l.indent !== indent) break;
      const sep = keySeparator(l.text);
      if (sep <= 0) break;
      const key = unquote(l.text.slice(0, sep));
      const rest = l.text.slice(sep + 1).trim();
      i++;
      obj[key] = valueAfterKey(rest, indent);
    }
    return obj;
  }

  skipBlank();
  return block(lines[i]?.indent ?? 0);
}

export interface DispatchInfo {
  /** The workflow declares `on: workflow_dispatch`. */
  dispatchable: boolean;
  inputs: DispatchInput[];
}

/** Read `on.workflow_dispatch` (and its inputs) from a workflow file. */
export function workflowDispatch(source: string): DispatchInfo {
  let doc: YamlValue;
  try {
    doc = parseYaml(source);
  } catch {
    return { dispatchable: /^\s*workflow_dispatch\s*:?/m.test(source), inputs: [] };
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { dispatchable: false, inputs: [] };
  const on = doc.on ?? doc.true ?? null;
  if (typeof on === 'string') return { dispatchable: on === 'workflow_dispatch', inputs: [] };
  if (Array.isArray(on)) return { dispatchable: on.includes('workflow_dispatch'), inputs: [] };
  if (!on || typeof on !== 'object' || !('workflow_dispatch' in on)) return { dispatchable: false, inputs: [] };
  const wd = on.workflow_dispatch;
  const rawInputs = wd && typeof wd === 'object' && !Array.isArray(wd) ? wd.inputs : null;
  const inputs: DispatchInput[] = [];
  if (rawInputs && typeof rawInputs === 'object' && !Array.isArray(rawInputs)) {
    for (const [name, spec] of Object.entries(rawInputs)) {
      const s = spec && typeof spec === 'object' && !Array.isArray(spec) ? spec : {};
      const type = String(s.type ?? 'string') as DispatchInput['type'];
      inputs.push({
        name,
        description: s.description != null ? String(s.description) : undefined,
        required: s.required === true || s.required === 'true',
        default: s.default != null ? String(s.default) : undefined,
        type: ['string', 'boolean', 'choice', 'environment', 'number'].includes(type) ? type : 'string',
        options: Array.isArray(s.options) ? s.options.map(String) : undefined,
      });
    }
  }
  return { dispatchable: true, inputs };
}
