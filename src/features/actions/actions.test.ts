import { describe, expect, test } from 'vitest';
import { ansiToHtml, newAnsiState, stripAnsi } from './ansi';
import { splitLogBySteps } from './logs';
import { buildRunQuery, parseRunQuery, runState } from './status';
import type { JobStep } from './types';
import { parseYaml, workflowDispatch } from './yaml';

describe('workflow YAML', () => {
  test('reads workflow_dispatch inputs of every type', () => {
    const info = workflowDispatch(`name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      level:
        description: 'Log level'   # trailing comment
        required: true
        default: warning
        type: choice
        options:
        - info
        - warning
      dry-run: { type: boolean, default: true }
      target:
        type: environment
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "a: b"
          echo done
`);
    expect(info.dispatchable).toBe(true);
    expect(info.inputs).toEqual([
      { name: 'level', description: 'Log level', required: true, default: 'warning', type: 'choice', options: ['info', 'warning'] },
      { name: 'dry-run', description: undefined, required: false, default: 'true', type: 'boolean', options: undefined },
      { name: 'target', description: undefined, required: false, default: undefined, type: 'environment', options: undefined },
    ]);
  });

  test('scalar and list forms of `on`', () => {
    expect(workflowDispatch('on: workflow_dispatch').dispatchable).toBe(true);
    expect(workflowDispatch('on: [push, workflow_dispatch]').dispatchable).toBe(true);
    expect(workflowDispatch('on:\n  push:\n').dispatchable).toBe(false);
    expect(workflowDispatch('on:\n  workflow_dispatch:\n').inputs).toEqual([]);
  });

  test('block scalars keep their text', () => {
    expect(parseYaml('a: |\n  one\n  two\nb: 1')).toEqual({ a: 'one\ntwo', b: 1 });
  });
});

describe('ANSI', () => {
  test('colors, bold and reset become classes; HTML is escaped', () => {
    expect(ansiToHtml('\u001b[36;1mnpm <ci>\u001b[0m done')).toBe('<span class="ansi-fg-6 ansi-bold">npm &lt;ci&gt;</span> done');
  });
  test('styles carry across lines', () => {
    const state = newAnsiState();
    ansiToHtml('\u001b[31mred', state);
    expect(ansiToHtml('still', state)).toBe('<span class="ansi-fg-1">still</span>');
  });
  test('256 colors use inline styles and URLs are linked', () => {
    expect(ansiToHtml('\u001b[38;5;196mx')).toBe('<span style="color:rgb(255,0,0)">x</span>');
    expect(ansiToHtml('see https://example.com/a.')).toBe(
      'see <a href="https://example.com/a" target="_blank" rel="noreferrer">https://example.com/a</a>.',
    );
    expect(stripAnsi('\u001b[1mbold\u001b[0m\u001b[K')).toBe('bold');
  });
});

describe('job logs', () => {
  const step = (number: number, name: string, start: string, end: string, conclusion = 'success'): JobStep => ({
    number,
    name,
    status: 'completed',
    conclusion: conclusion as JobStep['conclusion'],
    started_at: `2026-01-01T00:00:${start}Z`,
    completed_at: `2026-01-01T00:00:${end}Z`,
  });
  const steps = [
    step(1, 'Set up job', '01', '02'),
    step(2, 'Run actions/checkout@v4', '02', '03'),
    step(3, 'Setup Node', '03', '03'),
    step(4, 'Run npm test', '03', '03', 'failure'),
    step(5, 'Post Run actions/checkout@v4', '03', '04'),
    step(6, 'Post Setup Node', '04', '04', 'skipped'),
    step(7, 'Complete job', '04', '04'),
  ];
  const log = [
    '2026-01-01T00:00:01.1Z Current runner version: 2',
    '2026-01-01T00:00:02.5Z ##[group]Run actions/checkout@v4',
    '2026-01-01T00:00:02.6Z with:',
    'continued line',
    '2026-01-01T00:00:02.7Z ##[endgroup]',
    '2026-01-01T00:00:02.8Z Syncing repository',
    '2026-01-01T00:00:03.1Z ##[group]Run actions/setup-node@v4',
    '2026-01-01T00:00:03.2Z ##[endgroup]',
    '2026-01-01T00:00:03.3Z ##[group]Run npm test',
    '2026-01-01T00:00:03.4Z ##[endgroup]',
    '2026-01-01T00:00:03.5Z ##[error]Process completed with exit code 1.',
    '2026-01-01T00:00:03.6Z Post job cleanup.',
    '2026-01-01T00:00:04.1Z Cleaning up orphan processes',
    '',
  ].join('\n');

  test('splits lines into steps by markers and timestamps', () => {
    const out = splitLogBySteps(log, steps);
    const plain = (n: number) => out.get(n)?.lines.map((l) => l.plain);
    expect(plain(1)).toEqual(['Current runner version: 2']);
    expect(plain(2)).toEqual(['Run actions/checkout@v4', 'with:', 'continued line', 'Syncing repository']);
    expect(plain(3)).toEqual(['Run actions/setup-node@v4']);
    expect(plain(4)).toEqual(['Run npm test', 'Error: Process completed with exit code 1.']);
    expect(plain(5)).toEqual(['Post job cleanup.']);
    expect(out.get(6)).toBeUndefined();
    expect(plain(7)).toEqual(['Cleaning up orphan processes']);
  });

  test('groups fold their lines and numbering skips ##[endgroup]', () => {
    const lines = splitLogBySteps(log, steps).get(2)!.lines;
    expect(lines.map((l) => [l.n, l.kind, l.group])).toEqual([
      [1, 'group', null],
      [2, 'normal', 1],
      [3, 'normal', 1],
      [4, 'normal', null],
    ]);
  });
});

describe('runs query', () => {
  test('round-trips github.com filter syntax', () => {
    const q = parseRunQuery('event:push status:success branch:"my branch" actor:octocat extra');
    expect(q).toEqual({ event: 'push', status: 'success', branch: 'my branch', actor: 'octocat', text: 'extra' });
    expect(buildRunQuery(q)).toBe('event:push status:success branch:"my branch" actor:octocat');
  });
  test('state from status + conclusion', () => {
    expect(runState('completed', 'failure')).toBe('failure');
    expect(runState('in_progress', null)).toBe('in_progress');
    expect(runState('requested', null)).toBe('queued');
  });
});
