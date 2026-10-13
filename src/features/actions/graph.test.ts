import { describe, expect, test } from 'vitest';
import { buildGraph } from './graph';
import type { Job } from './types';

const job = (id: number, name: string): Job =>
  ({ id, name, status: 'completed', conclusion: 'success', started_at: '', completed_at: null }) as unknown as Job;

const WORKFLOW = `
name: CI
on: push
jobs:
  lint:
    runs-on: ubuntu-latest
  build:
    name: Build (\${{ matrix.os }})
    needs: lint
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
  deploy:
    name: Deploy
    needs: [build, lint]
  release:
    uses: ./.github/workflows/release.yml
    needs: deploy
`;

describe('buildGraph', () => {
  const jobs = [
    job(1, 'lint'),
    job(2, 'Build (ubuntu-latest)'),
    job(3, 'Build (macos-latest)'),
    job(4, 'Deploy'),
    job(5, 'release / publish'),
    job(6, 'release / notify'),
  ];
  const g = buildGraph(jobs, WORKFLOW);

  test('groups matrix and reusable-workflow jobs into one node each', () => {
    expect(g.nodes.map((n) => [n.id, n.jobs.length, n.group])).toEqual([
      ['lint', 1, false],
      ['build', 2, true],
      ['deploy', 1, false],
      ['release', 2, true],
    ]);
    expect(g.nodes.find((n) => n.id === 'build')!.name).toBe('Build');
  });

  test('lays nodes out in columns by needs depth, with edges', () => {
    expect(g.columns.map((c) => c.map((n) => n.id))).toEqual([['lint'], ['build'], ['deploy'], ['release']]);
    expect(g.edges).toEqual([
      { from: 'lint', to: 'build' },
      { from: 'build', to: 'deploy' },
      { from: 'lint', to: 'deploy' },
      { from: 'deploy', to: 'release' },
    ]);
  });

  test('falls back to name grouping without the workflow file', () => {
    const f = buildGraph(jobs, null);
    expect(f.hasDependencies).toBe(false);
    expect(f.edges).toEqual([]);
    expect(f.nodes.find((n) => n.name === 'Build')!.jobs).toHaveLength(2);
  });
});
