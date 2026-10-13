import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { toast, toastError } from '../../../components/ui';
import { xIcon } from '../../../icons/octicons';
import type { Ruleset, RulesetInput, RulesetRule } from '../api';
import { deleteRuleset, saveRuleset } from '../api';
import { CheckboxSetting, ConfirmDialog, SectionHeading, Subhead } from './ui';

/** Simple (parameter-less) rules the editor exposes as checkboxes. */
const SIMPLE_RULES: { type: string; label: string; description: string; tagOnly?: boolean }[] = [
  { type: 'creation', label: 'Restrict creations', description: 'Only allow users with bypass permission to create matching refs.' },
  { type: 'update', label: 'Restrict updates', description: 'Only allow users with bypass permission to update matching refs.' },
  { type: 'deletion', label: 'Restrict deletions', description: 'Only allow users with bypass permissions to delete matching refs.' },
  { type: 'required_linear_history', label: 'Require linear history', description: 'Prevent merge commits from being pushed to matching refs.' },
  { type: 'required_signatures', label: 'Require signed commits', description: 'Commits pushed to matching refs must have verified signatures.' },
  { type: 'non_fast_forward', label: 'Block force pushes', description: 'Prevent users with push access from force pushing to refs.' },
];

const PR_DEFAULTS = {
  required_approving_review_count: 0,
  dismiss_stale_reviews_on_push: false,
  require_code_owner_review: false,
  require_last_push_approval: false,
  required_review_thread_resolution: false,
};

interface FormState {
  name: string;
  target: 'branch' | 'tag';
  enforcement: Ruleset['enforcement'];
  include: string[];
  exclude: string[];
  simple: Record<string, boolean>;
  pullRequest: (typeof PR_DEFAULTS) | null;
  statusChecks: { strict: boolean; contexts: string[] } | null;
  /** Rules this editor doesn't know about — kept as-is on save. */
  other: RulesetRule[];
  bypass: Ruleset['bypass_actors'];
}

function toState(rs: Ruleset | null): FormState {
  const rules = rs?.rules ?? [{ type: 'deletion' }, { type: 'non_fast_forward' }];
  const known = new Set([...SIMPLE_RULES.map((r) => r.type), 'pull_request', 'required_status_checks']);
  const pr = rules.find((r) => r.type === 'pull_request');
  const sc = rules.find((r) => r.type === 'required_status_checks');
  return {
    name: rs?.name ?? '',
    target: rs?.target === 'tag' ? 'tag' : 'branch',
    enforcement: rs?.enforcement ?? 'active',
    include: rs?.conditions?.ref_name?.include ?? [],
    exclude: rs?.conditions?.ref_name?.exclude ?? [],
    simple: Object.fromEntries(SIMPLE_RULES.map((r) => [r.type, rules.some((x) => x.type === r.type)])),
    pullRequest: pr ? { ...PR_DEFAULTS, ...pr.parameters } : null,
    statusChecks: sc
      ? {
          strict: !!sc.parameters?.strict_required_status_checks_policy,
          contexts: (sc.parameters?.required_status_checks ?? []).map((c: { context: string }) => c.context),
        }
      : null,
    other: rules.filter((r) => !known.has(r.type)),
    bypass: rs?.bypass_actors ?? [],
  };
}

function toInput(s: FormState): RulesetInput {
  const rules: RulesetRule[] = SIMPLE_RULES.filter((r) => s.simple[r.type]).map((r) => ({ type: r.type }));
  if (s.pullRequest) rules.push({ type: 'pull_request', parameters: s.pullRequest });
  if (s.statusChecks)
    rules.push({
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: s.statusChecks.strict,
        required_status_checks: s.statusChecks.contexts.map((context) => ({ context })),
      },
    });
  rules.push(...s.other);
  return {
    name: s.name.trim(),
    target: s.target,
    enforcement: s.enforcement,
    conditions: { ref_name: { include: s.include, exclude: s.exclude } },
    rules,
    bypass_actors: s.bypass,
  };
}

/** Human label for a ref pattern (`~DEFAULT_BRANCH`, `refs/heads/x`). */
export const refPatternLabel = (p: string) =>
  p === '~DEFAULT_BRANCH' ? 'Default branch' : p === '~ALL' ? 'All branches' : p.replace(/^refs\/(heads|tags)\//, '');

/** Basic ruleset editor: name, enforcement, targets, common rules. */
export default function RulesetForm(props: { owner: string; repo: string; base: string; ruleset: Ruleset | null }) {
  const navigate = useNavigate();
  const [form, setForm] = createSignal<FormState>(() => toState(props.ruleset));
  const [busy, setBusy] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [pattern, setPattern] = createSignal('');
  const [patternKind, setPatternKind] = createSignal<'include' | 'exclude'>('include');
  const [check, setCheck] = createSignal('');
  const update = (fn: (s: FormState) => Partial<FormState>) => setForm((s) => ({ ...s, ...fn(s) }));
  const readOnly = () => props.ruleset?.source_type === 'Organization';
  const prefix = () => (form().target === 'tag' ? 'refs/tags/' : 'refs/heads/');

  const addPattern = (value: string, kind = patternKind()) => {
    const v = value.trim();
    if (!v) return;
    const full = v.startsWith('~') || v.startsWith('refs/') ? v : prefix() + v;
    update((s) => ({ [kind]: s[kind].includes(full) ? s[kind] : [...s[kind], full] }));
    setPattern('');
  };

  const PatternList = (p: { kind: 'include' | 'exclude' }) => (
    <For each={form()[p.kind]}>
      {(pt) => (
        <div class="Box-row flex items-center gap-2 py-2!">
          <span class={['Label', p.kind === 'include' ? 'Label--success' : 'Label--danger']}>
            {p.kind === 'include' ? 'Include' : 'Exclude'}
          </span>
          <span class="flex-1 text-sm font-mono">{refPatternLabel(pt)}</span>
          <button
            type="button"
            class="btn-octicon"
            aria-label="Remove"
            onClick={() => update((s) => ({ [p.kind]: s[p.kind].filter((x) => x !== pt) }))}
          >
            <Octicon icon={xIcon} />
          </button>
        </div>
      )}
    </For>
  );

  return (
    <>
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form().name.trim()) return toastError('Ruleset name is required');
        setBusy(true);
        try {
          await saveRuleset(props.owner, props.repo, props.ruleset?.id ?? null, toInput(form()));
          toast(props.ruleset ? 'Ruleset updated' : 'Ruleset created', 'success');
          navigate(`${props.base}/settings/rules`);
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Subhead
        title={
          <>
            <a class="link-muted" href={`${props.base}/settings/rules`}>
              Rulesets
            </a>{' '}
            / {props.ruleset ? props.ruleset.name : 'New branch ruleset'}
          </>
        }
      />
      <Show when={readOnly()}>
        <p class="flash flash-warn mb-4 text-sm">This ruleset is managed by the organization and is read-only here.</p>
      </Show>
      <fieldset disabled={readOnly()}>
        <div class="form-group mt-0!">
          <label for="rs-name">Ruleset Name *</label>
          <input id="rs-name" class="form-control max-w-[440px]" required value={form().name} onInput={(e) => update(() => ({ name: e.currentTarget.value }))} />
        </div>
        <div class="flex gap-4 flex-wrap">
          <div class="form-group mt-0!">
            <label for="rs-enforcement">Enforcement status</label>
            <select
              id="rs-enforcement"
              class="form-select w-auto!"
              value={form().enforcement}
              onChange={(e) => update(() => ({ enforcement: e.currentTarget.value as FormState['enforcement'] }))}
            >
              <option value="active">Active</option>
              <option value="evaluate">Evaluate</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <Show when={!props.ruleset}>
            <div class="form-group mt-0!">
              <label for="rs-target">Target</label>
              <select
                id="rs-target"
                class="form-select w-auto!"
                value={form().target}
                onChange={(e) => update(() => ({ target: e.currentTarget.value as 'branch' | 'tag', include: [], exclude: [] }))}
              >
                <option value="branch">Branches</option>
                <option value="tag">Tags</option>
              </select>
            </div>
          </Show>
        </div>

        <SectionHeading class="mt-4">Targets</SectionHeading>
        <p class="text-sm text-fg-muted mb-2">
          Which {form().target === 'tag' ? 'tags' : 'branches'} do you want to make a ruleset for? Patterns use fnmatch syntax.
        </p>
        <div class="Box">
          <div class="Box-header flex flex-wrap items-center gap-2">
            <select class="form-select form-control-sm w-auto!" value={patternKind()} onChange={(e) => setPatternKind(e.currentTarget.value as 'include' | 'exclude')}>
              <option value="include">Include</option>
              <option value="exclude">Exclude</option>
            </select>
            <input
              class="form-control form-control-sm max-w-[240px]"
              placeholder={form().target === 'tag' ? 'v*' : 'release/*'}
              value={pattern()}
              onInput={(e) => setPattern(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPattern(pattern());
                }
              }}
            />
            <button type="button" class="btn btn-sm" onClick={() => addPattern(pattern())}>
              Add pattern
            </button>
            <Show when={form().target === 'branch'}>
              <button type="button" class="btn btn-sm" onClick={() => addPattern('~DEFAULT_BRANCH', 'include')}>
                Include default branch
              </button>
            </Show>
            <button type="button" class="btn btn-sm" onClick={() => addPattern('~ALL', 'include')}>
              Include all
            </button>
          </div>
          <PatternList kind="include" />
          <PatternList kind="exclude" />
          <Show when={!form().include.length && !form().exclude.length}>
            <div class="Box-row text-sm text-fg-muted">
              This ruleset does not target any resources and will not be applied.
            </div>
          </Show>
        </div>

        <SectionHeading class="mt-6">Rules</SectionHeading>
        <For each={SIMPLE_RULES}>
          {(r) => (
            <CheckboxSetting
              label={r.label}
              description={r.description}
              checked={!!form().simple[r.type]}
              onChange={(v) => update((s) => ({ simple: { ...s.simple, [r.type]: v } }))}
            />
          )}
        </For>
        <CheckboxSetting
          label="Require a pull request before merging"
          description="Require all commits be made to a non-target branch and submitted via a pull request before they can be merged."
          checked={!!form().pullRequest}
          onChange={(v) => update(() => ({ pullRequest: v ? { ...PR_DEFAULTS } : null }))}
        >
          <Show when={form().pullRequest}>
            {(pr) => (
              <div class="mt-2 pl-3">
                <label class="text-sm font-semibold block" for="rs-approvals">
                  Required approvals
                </label>
                <select
                  id="rs-approvals"
                  class="form-select form-control-sm w-auto! mt-1"
                  value={String(pr().required_approving_review_count)}
                  onChange={(e) => update((s) => ({ pullRequest: { ...s.pullRequest!, required_approving_review_count: Number(e.currentTarget.value) } }))}
                >
                  <For each={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>{(n) => <option value={n}>{n}</option>}</For>
                </select>
                <For
                  each={
                    [
                      ['dismiss_stale_reviews_on_push', 'Dismiss stale pull request approvals when new commits are pushed'],
                      ['require_code_owner_review', 'Require review from Code Owners'],
                      ['require_last_push_approval', 'Require approval of the most recent reviewable push'],
                      ['required_review_thread_resolution', 'Require conversation resolution before merging'],
                    ] as const
                  }
                >
                  {([key, label]) => (
                    <CheckboxSetting
                      label={label}
                      checked={!!pr()[key]}
                      onChange={(v) => update((s) => ({ pullRequest: { ...s.pullRequest!, [key]: v } }))}
                    />
                  )}
                </For>
              </div>
            )}
          </Show>
        </CheckboxSetting>
        <CheckboxSetting
          label="Require status checks to pass"
          description="Choose which status checks must pass before the ref is updated."
          checked={!!form().statusChecks}
          onChange={(v) => update(() => ({ statusChecks: v ? { strict: false, contexts: [] } : null }))}
        >
          <Show when={form().statusChecks}>
            {(sc) => (
              <div class="mt-2 pl-3 max-w-[440px]">
                <CheckboxSetting
                  label="Require branches to be up to date before merging"
                  checked={sc().strict}
                  onChange={(v) => update((s) => ({ statusChecks: { ...s.statusChecks!, strict: v } }))}
                />
                <div class="flex gap-2">
                  <input
                    class="form-control form-control-sm"
                    placeholder="Status check name"
                    value={check()}
                    onInput={(e) => setCheck(e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => {
                      const c = check().trim();
                      if (c) update((s) => ({ statusChecks: { ...s.statusChecks!, contexts: [...s.statusChecks!.contexts, c] } }));
                      setCheck('');
                    }}
                  >
                    Add check
                  </button>
                </div>
                <For each={sc().contexts}>
                  {(c) => (
                    <div class="flex items-center gap-2 mt-1 text-sm">
                      <span class="flex-1 font-mono">{c}</span>
                      <button
                        type="button"
                        class="btn-octicon"
                        aria-label={`Remove ${c}`}
                        onClick={() => update((s) => ({ statusChecks: { ...s.statusChecks!, contexts: s.statusChecks!.contexts.filter((x) => x !== c) } }))}
                      >
                        <Octicon icon={xIcon} />
                      </button>
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>
        </CheckboxSetting>
        <Show when={form().other.length}>
          <p class="note mt-2">
            Other rules on this ruleset ({form().other.map((r) => r.type).join(', ')}) are kept unchanged.
          </p>
        </Show>
        <Show when={form().bypass?.length}>
          <p class="note">{form().bypass!.length} bypass actor(s) are kept unchanged.</p>
        </Show>

        <div class="mt-6 pt-4 border-t border-line-muted flex gap-2">
          <button type="submit" class="btn btn-primary" disabled={busy()}>
            {busy() ? 'Saving…' : props.ruleset ? 'Save changes' : 'Create'}
          </button>
          <Show when={props.ruleset}>
            <button type="button" class="btn btn-danger" onClick={() => setDeleting(true)}>
              Delete ruleset
            </button>
          </Show>
        </div>
      </fieldset>
    </form>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title="Delete ruleset?"
        button="Delete"
        onConfirm={() =>
          deleteRuleset(props.owner, props.repo, props.ruleset!.id).then(() => navigate(`${props.base}/settings/rules`))
        }
      >
        <p>This ruleset will be permanently deleted.</p>
      </ConfirmDialog>
    </>
  );
}
