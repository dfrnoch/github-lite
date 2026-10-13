/**
 * Small fuzzy matcher for the file finder: the query must appear as a
 * subsequence of the path; consecutive runs, word starts and matches in the
 * file name score higher.
 */
export interface FuzzyMatch {
  path: string;
  score: number;
  /** Indices of matched characters in `path`. */
  positions: number[];
}

export function fuzzyMatch(path: string, query: string): FuzzyMatch | null {
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return { path, score: 0, positions: [] };
  const p = path.toLowerCase();
  const nameStart = path.lastIndexOf('/') + 1;
  // Prefer matching inside the file name: try a greedy match from the end first.
  const positions: number[] = [];
  let qi = q.length - 1;
  for (let i = p.length - 1; i >= 0 && qi >= 0; i--) {
    if (p[i] === q[qi]) {
      positions.push(i);
      qi--;
    }
  }
  if (qi >= 0) return null;
  positions.reverse();
  let score = 0;
  for (let k = 0; k < positions.length; k++) {
    const pos = positions[k]!;
    const prev = path[pos - 1];
    if (k > 0 && positions[k - 1] === pos - 1) score += 5;
    if (pos === 0 || prev === '/' || prev === '-' || prev === '_' || prev === '.') score += 4;
    else if (prev && /[a-z]/.test(prev) && /[A-Z]/.test(path[pos]!)) score += 3;
    if (pos >= nameStart) score += 2;
  }
  score -= path.length * 0.05;
  return { path, score, positions };
}

export function fuzzyFilter(paths: string[], query: string, limit = 100): FuzzyMatch[] {
  if (!query.trim()) return paths.slice(0, limit).map((path) => ({ path, score: 0, positions: [] }));
  const out: FuzzyMatch[] = [];
  for (const path of paths) {
    const m = fuzzyMatch(path, query);
    if (m) out.push(m);
  }
  out.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  return out.slice(0, limit);
}
