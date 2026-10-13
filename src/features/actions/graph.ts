import type { Job } from './types';
import { parseYaml } from './yaml';

/**
 * The workflow run graph like github.com draws it: one node per workflow job
 * (matrix runs and reusable-workflow calls grouped into one card), laid out in
 * columns by `needs:` depth, with an edge per dependency.
 *
 * The REST API's jobs carry no dependency information, so the graph comes
 * from the workflow file at the run's commit; runtime jobs are matched to its
 * jobs by name. Without the file (dynamic workflows, parse errors) jobs are
 * grouped by name and laid out without edges.
 */

export interface GraphNode {
  /** Workflow job id (or the runtime name for unmatched jobs). */
  id: string;
  /** Card title: the job's name with matrix expressions removed. */
  name: string;
  jobs: Job[];
  /** Several runtime jobs (strategy.matrix or a reusable workflow) in one card. */
  group: boolean;
  needs: string[];
  level: number;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: { from: string; to: string }[];
  /** Nodes by column (dependency depth). */
  columns: GraphNode[][];
  /** Whether dependencies are known (the workflow file was read). */
  hasDependencies: boolean;
}

interface WorkflowJob {
  id: string;
  template: string;
  needs: string[];
  matrix: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Jobs of a parsed workflow file, in file order. */
export function workflowJobs(source: string): WorkflowJob[] {
  const doc = parseYaml(source) as Record<string, unknown> | null;
  const jobs = doc && typeof doc === 'object' ? (doc.jobs as Record<string, Record<string, unknown>> | undefined) : undefined;
  if (!jobs || typeof jobs !== 'object') return [];
  return Object.entries(jobs).map(([id, def]) => {
    const needs = def?.needs;
    return {
      id,
      template: typeof def?.name === 'string' && def.name.trim() ? def.name.trim() : id,
      needs: Array.isArray(needs) ? needs.map(String) : typeof needs === 'string' ? [needs] : [],
      matrix: !!(def?.strategy && typeof def.strategy === 'object' && 'matrix' in (def.strategy as object)),
    };
  });
}

/** A matcher for runtime job names produced by a workflow job's `name:` template. */
function nameMatcher(template: string) {
  // `${{ expr }}` parts are filled in at runtime: match anything there.
  const pattern = template
    .split(/\$\{\{[\s\S]*?\}\}/)
    .map(escapeRe)
    .join('.*?');
  const exact = new RegExp(`^${pattern}$`);
  // Matrix runs append " (values)"; reusable workflows " / <called job>".
  const derived = new RegExp(`^${pattern}( \\(.*\\)| / .*)$`);
  return { exact, derived };
}

/** Card title: the job's name, or its id when the name is built from expressions (like github.com). */
const displayName = (template: string, id: string) => {
  const stripped = template.replace(/\s*\(\s*\$\{\{[\s\S]*?\}\}[^)]*\)\s*$/, '').trim();
  return stripped && !stripped.includes('${{') ? stripped : id;
};

/** Group runtime jobs into graph nodes using the workflow file (if any). */
export function buildGraph(jobs: Job[], workflowSource: string | null): WorkflowGraph {
  let defs: WorkflowJob[] = [];
  try {
    defs = workflowSource ? workflowJobs(workflowSource) : [];
  } catch {
    defs = [];
  }

  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const matchers = defs.map((d) => ({ def: d, ...nameMatcher(d.template) }));
  const assigned = new Map<number, string>();

  // Exact names first (so "build" doesn't swallow "build (ubuntu)" of another job), then derived names.
  for (const pass of ['exact', 'derived'] as const) {
    for (const job of jobs) {
      if (assigned.has(job.id)) continue;
      const hit = matchers.find((m) => m[pass].test(job.name));
      if (hit) assigned.set(job.id, hit.def.id);
    }
  }

  for (const d of defs) {
    const matched = jobs.filter((j) => assigned.get(j.id) === d.id);
    if (!matched.length) continue;
    const node: GraphNode = {
      id: d.id,
      name: displayName(d.template, d.id),
      jobs: matched,
      group: d.matrix || matched.length > 1,
      needs: d.needs,
      level: 0,
    };
    nodes.push(node);
    byId.set(d.id, node);
  }

  // Jobs the workflow file doesn't explain: group matrix-style names, no edges.
  const loose = new Map<string, GraphNode>();
  for (const job of jobs) {
    if (assigned.has(job.id)) continue;
    const m = /^(.+?) \((.+)\)$/.exec(job.name);
    const key = m ? m[1]! : job.name;
    let node = loose.get(key);
    if (!node || !m) {
      node = { id: `job:${job.name}`, name: key, jobs: [], group: !!m, needs: [], level: 0 };
      if (m) loose.set(key, node);
      nodes.push(node);
      byId.set(node.id, node);
    }
    node.jobs.push(job);
  }
  for (const n of nodes) if (n.jobs.length === 1 && n.group && !defs.find((d) => d.id === n.id)?.matrix) n.group = false;

  // Columns: longest path from a root (cycles are impossible in valid workflows; guard anyway).
  const levelOf = (n: GraphNode, seen = new Set<string>()): number => {
    if (seen.has(n.id)) return 0;
    seen.add(n.id);
    const deps = n.needs.map((id) => byId.get(id)).filter((x): x is GraphNode => !!x);
    return deps.length ? 1 + Math.max(...deps.map((d) => levelOf(d, seen))) : 0;
  };
  for (const n of nodes) n.level = levelOf(n);

  const edges = nodes.flatMap((n) => n.needs.filter((id) => byId.has(id)).map((from) => ({ from, to: n.id })));
  const hasDependencies = defs.length > 0;

  // Without dependency information, wrap nodes into columns of four.
  if (!edges.length && !hasDependencies) nodes.forEach((n, i) => (n.level = Math.floor(i / 4)));

  const columns: GraphNode[][] = [];
  for (const n of nodes) (columns[n.level] ??= []).push(n);
  return { nodes, edges, columns: columns.filter(Boolean), hasDependencies };
}
