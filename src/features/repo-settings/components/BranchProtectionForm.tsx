import { useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { toast, toastError } from '../../../components/ui';
import { xIcon } from '../../../icons/octicons';
import type { BranchProtectionInput, BranchProtectionRule } from '../api';
import { saveBranchProtectionRule } from '../api';
import { CheckboxSetting, SectionHeading, Subhead } from './ui';

const EMPTY: BranchProtectionInput = {
  pattern: '',
  requiresApprovingReviews: false,
  requiredApprovingReviewCount: 1,
  dismissesStaleReviews: false,
  requiresCodeOwnerReviews: false,
  requireLastPushApproval: false,
  requiresStatusChecks: false,
  requiresStrictStatusChecks: false,
  requiredStatusCheckContexts: [],
  requiresConversationResolution: false,
  requiresCommitSignatures: false,
  requiresLinearHistory: false,
  isAdminEnforced: false,
  allowsForcePushes: false,
  allowsDeletions: false,
  lockBranch: false,
};

function toInput(rule: BranchProtectionRule | null): BranchProtectionInput {
  if (!rule) return { ...EMPTY };
  const out = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof BranchProtectionInput)[]) (out as any)[key] = rule[key] ?? EMPTY[key];
  out.requiredApprovingReviewCount ||= 1;
  return out;
}

/** Create / edit a classic branch protection rule (GraphQL mutations). */
export default function BranchProtectionForm(props: { repositoryId: string; rule: BranchProtectionRule | null; base: string }) {
  const navigate = useNavigate();
  const [form, setForm] = createSignal<BranchProtectionInput>(() => toInput(props.rule));
  const [check, setCheck] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const set = <K extends keyof BranchProtectionInput>(key: K, value: BranchProtectionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const Toggle = (p: { key: keyof BranchProtectionInput; label: string; description: string; nested?: boolean; children?: any }) => (
    <CheckboxSetting
      label={p.label}
      description={p.description}
      checked={!!form()[p.key]}
      onChange={(v) => set(p.key, v as any)}
    >
      <Show when={p.nested && form()[p.key]}>
        <div class="mt-2 pl-1 border-l-2 border-line-muted ml-[-2px]">{p.children}</div>
      </Show>
    </CheckboxSetting>
  );

  const addCheck = () => {
    const c = check().trim();
    if (!c || form().requiredStatusCheckContexts.includes(c)) return;
    set('requiredStatusCheckContexts', [...form().requiredStatusCheckContexts, c]);
    setCheck('');
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form().pattern.trim()) return toastError('Branch name pattern is required');
        setBusy(true);
        try {
          await saveBranchProtectionRule(props.repositoryId, props.rule?.id ?? null, { ...form(), pattern: form().pattern.trim() });
          toast(props.rule ? 'Branch protection rule updated' : 'Branch protection rule created', 'success');
          navigate(`${props.base}/settings/branches`);
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Subhead title={props.rule ? 'Edit branch protection rule' : 'Branch protection rule'} description="Protect your most important branches." />
      <div class="form-group mt-0!">
        <label for="bp-pattern">Branch name pattern *</label>
        <input
          id="bp-pattern"
          class="form-control max-w-[440px] font-mono"
          required
          value={form().pattern}
          onInput={(e) => set('pattern', e.currentTarget.value)}
          placeholder="main, release/*"
        />
      </div>

      <SectionHeading class="mt-6">Protect matching branches</SectionHeading>
      <Toggle
        key="requiresApprovingReviews"
        nested
        label="Require a pull request before merging"
        description="When enabled, all commits must be made to a non-protected branch and submitted via a pull request before they can be merged into a branch that matches this rule."
      >
        <div class="pl-3">
          <label class="text-sm font-semibold block mt-1" for="bp-count">
            Required number of approvals before merging
          </label>
          <select
            id="bp-count"
            class="form-select form-control-sm w-auto! mt-1"
            value={String(form().requiredApprovingReviewCount ?? 1)}
            onChange={(e) => set('requiredApprovingReviewCount', Number(e.currentTarget.value))}
          >
            <For each={[0, 1, 2, 3, 4, 5, 6]}>{(n) => <option value={n}>{n}</option>}</For>
          </select>
          <CheckboxSetting
            label="Dismiss stale pull request approvals when new commits are pushed"
            description="New reviewable commits pushed to a matching branch will dismiss pull request review approvals."
            checked={form().dismissesStaleReviews}
            onChange={(v) => set('dismissesStaleReviews', v)}
          />
          <CheckboxSetting
            label="Require review from Code Owners"
            description="Require an approved review in pull requests including files with a designated code owner."
            checked={form().requiresCodeOwnerReviews}
            onChange={(v) => set('requiresCodeOwnerReviews', v)}
          />
          <CheckboxSetting
            label="Require approval of the most recent reviewable push"
            description="Whether the most recent reviewable push must be approved by someone other than the person who pushed it."
            checked={form().requireLastPushApproval}
            onChange={(v) => set('requireLastPushApproval', v)}
          />
        </div>
      </Toggle>
      <Toggle
        key="requiresStatusChecks"
        nested
        label="Require status checks to pass before merging"
        description="Choose which status checks must pass before branches can be merged into a branch that matches this rule."
      >
        <div class="pl-3">
          <CheckboxSetting
            label="Require branches to be up to date before merging"
            description="This ensures pull requests targeting a matching branch have been tested with the latest code."
            checked={form().requiresStrictStatusChecks}
            onChange={(v) => set('requiresStrictStatusChecks', v)}
          />
          <div class="flex gap-2 max-w-[440px] mt-1">
            <input
              class="form-control form-control-sm"
              placeholder="Status check name, e.g. ci/build"
              value={check()}
              onInput={(e) => setCheck(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCheck();
                }
              }}
            />
            <button type="button" class="btn btn-sm" onClick={addCheck}>
              Add
            </button>
          </div>
          <div class="Box mt-2 max-w-[440px]">
            <For
              each={form().requiredStatusCheckContexts}
              fallback={<div class="Box-row text-xs text-fg-muted">No required checks</div>}
            >
              {(c) => (
                <div class="Box-row flex items-center py-2!">
                  <span class="flex-1 text-sm font-mono">{c}</span>
                  <button
                    type="button"
                    class="btn-octicon"
                    aria-label={`Remove ${c}`}
                    onClick={() => set('requiredStatusCheckContexts', form().requiredStatusCheckContexts.filter((x) => x !== c))}
                  >
                    <Octicon icon={xIcon} />
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Toggle>
      <Toggle
        key="requiresConversationResolution"
        label="Require conversation resolution before merging"
        description="When enabled, all conversations on code must be resolved before a pull request can be merged into a branch that matches this rule."
      />
      <Toggle
        key="requiresCommitSignatures"
        label="Require signed commits"
        description="Commits pushed to matching branches must have verified signatures."
      />
      <Toggle
        key="requiresLinearHistory"
        label="Require linear history"
        description="Prevent merge commits from being pushed to matching branches."
      />
      <Toggle
        key="lockBranch"
        label="Lock branch"
        description="Branch is read-only. Users cannot push to the branch."
      />
      <Toggle
        key="isAdminEnforced"
        label="Do not allow bypassing the above settings"
        description="The above settings will apply to administrators and custom roles with the “bypass branch protections” permission."
      />

      <SectionHeading class="mt-6">Rules applied to everyone including administrators</SectionHeading>
      <Toggle
        key="allowsForcePushes"
        label="Allow force pushes"
        description="Permit force pushes for all users with push access."
      />
      <Toggle
        key="allowsDeletions"
        label="Allow deletions"
        description="Allow users with push access to delete matching branches."
      />

      <div class="mt-6 pt-4 border-t border-line-muted">
        <button type="submit" class="btn btn-primary" disabled={busy()}>
          {busy() ? 'Saving…' : props.rule ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}
