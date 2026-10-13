import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import Octicon from '../../components/Octicon';
import { FEATURES, type FeatureDef, type FeatureOption, feature, featureOption, resetFeatures, setAllFeatures, setFeature, setFeatureOption } from '../../features/refined';
import { searchIcon } from '../../icons/octicons';
import { formatKeys } from '../../lib/hotkeys';

/** /settings/refined — toggles for the Refined GitHub features built into this app. */
export default function RefinedSettings() {
  const [filter, setFilter] = createSignal('');
  const [show, setShow] = createSignal<'all' | 'on' | 'off'>('all');

  const matches = (f: FeatureDef) => {
    const q = filter().trim().toLowerCase();
    if (q && !`${f.id} ${f.description} ${f.section}`.toLowerCase().includes(q)) return false;
    if (f.status === 'done' && show() !== 'all' && feature(f.id) !== (show() === 'on')) return false;
    return true;
  };
  const toggleable = createMemo(() => FEATURES.filter((f) => f.status === 'done' && matches(f)));
  const sections = createMemo(() => {
    const map = new Map<string, FeatureDef[]>();
    for (const f of toggleable()) {
      if (!map.has(f.section)) map.set(f.section, []);
      map.get(f.section)!.push(f);
    }
    return [...map.entries()];
  });
  const builtIn = createMemo(() => FEATURES.filter((f) => f.status === 'native' && matches(f)));
  const notApplicable = createMemo(() => FEATURES.filter((f) => f.status === 'na' && matches(f)));
  const todo = createMemo(() => FEATURES.filter((f) => f.status === 'todo' && matches(f)));
  const enabledCount = createMemo(() => FEATURES.filter((f) => f.status === 'done' && feature(f.id)).length);
  const doneCount = () => FEATURES.filter((f) => f.status === 'done').length;

  return (
    <div>
      <Title>Refined GitHub · Settings</Title>
      <div class="pb-2 mb-4 border-b border-line-muted flex flex-wrap items-end gap-2">
        <h2 class="text-2xl flex-1">Refined GitHub</h2>
        <span class="text-sm text-fg-muted">
          {enabledCount()} of {doneCount()} enabled
        </span>
      </div>
      <p class="text-sm text-fg-muted mb-4">
        Features from the{' '}
        <a href="https://github.com/refined-github/refined-github" target="_blank" rel="noreferrer">
          Refined GitHub
        </a>{' '}
        browser extension, built natively into this app. All of them are on by default; settings are stored in this browser.
      </p>

      <div class="flex flex-wrap items-center gap-2 mb-6">
        <label class="AppHeader-search flex-1 min-w-[200px] bg-canvas!">
          <Octicon icon={searchIcon} />
          <input placeholder="Filter features" value={filter()} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="Filter features" />
        </label>
        <div class="SegmentedControl">
          <For each={['all', 'on', 'off'] as const}>
            {(v) => (
              <button type="button" class={['SegmentedControl-item', { selected: show() === v }]} onClick={() => setShow(v)}>
                {v === 'all' ? 'All' : v === 'on' ? 'Enabled' : 'Disabled'}
              </button>
            )}
          </For>
        </div>
        <button type="button" class="btn btn-sm" onClick={() => setAllFeatures(true)}>
          Enable all
        </button>
        <button type="button" class="btn btn-sm" onClick={() => setAllFeatures(false)}>
          Disable all
        </button>
        <button type="button" class="btn btn-sm btn-invisible" onClick={() => resetFeatures()}>
          Reset to defaults
        </button>
      </div>

      <For each={sections()} fallback={<p class="text-fg-muted text-sm mb-6">No features match.</p>}>
        {([section, features]) => (
          <section class="mb-8">
            <h3 class="text-base font-semibold mb-2">{section}</h3>
            <ul class="Box">
              <For each={features}>{(f) => <FeatureRow feature={f} />}</For>
            </ul>
          </section>
        )}
      </For>

      <Show when={builtIn().length}>
        <details class="mb-4">
          <summary class="cursor-pointer font-semibold text-sm py-2">Already built in ({builtIn().length})</summary>
          <FeatureList features={builtIn()} />
        </details>
      </Show>
      <Show when={notApplicable().length}>
        <details class="mb-4">
          <summary class="cursor-pointer font-semibold text-sm py-2">Not applicable to this app ({notApplicable().length})</summary>
          <FeatureList features={notApplicable()} />
        </details>
      </Show>
      <Show when={todo().length}>
        <details class="mb-4">
          <summary class="cursor-pointer font-semibold text-sm py-2">Not implemented yet ({todo().length})</summary>
          <FeatureList features={todo()} />
        </details>
      </Show>
    </div>
  );
}

function FeatureRow(props: { feature: FeatureDef }) {
  const f = () => props.feature;
  const inputId = () => `rgh-${f().id}`;
  return (
    <li class="Box-row flex gap-3 py-3!">
      <input
        id={inputId()}
        type="checkbox"
        class="mt-1 shrink-0"
        checked={feature(f().id)}
        onChange={(e) => setFeature(f().id, e.currentTarget.checked)}
      />
      <div class="min-w-0 flex-1">
        <label for={inputId()} class="font-mono text-xs font-semibold cursor-pointer">
          {f().id}
        </label>
        <p class="text-sm">{f().description}</p>
        <Show when={f().note}>
          <p class="note">{f().note}</p>
        </Show>
        <Show when={f().hotkeys?.length}>
          <p class="mt-1 flex flex-wrap gap-1">
            <For each={f().hotkeys}>
              {(keys) => (
                <For each={formatKeys(keys)}>
                  {(k) => <kbd class="px-1.5 text-xs font-mono border border-line rounded-md bg-canvas-muted">{k}</kbd>}
                </For>
              )}
            </For>
          </p>
        </Show>
        <Show when={f().options?.length && feature(f().id)}>
          <div class="mt-2 flex flex-col gap-2">
            <For each={f().options}>{(o) => <OptionField id={f().id} option={o} />}</For>
          </div>
        </Show>
      </div>
    </li>
  );
}

function OptionField(props: { id: string; option: FeatureOption }) {
  const o = () => props.option;
  const fieldId = () => `rgh-${props.id}-${o().key}`;
  const value = () => featureOption<unknown>(props.id, o().key);
  return (
    <div class="text-sm">
      <Switch>
        <Match when={o().type === 'boolean'}>
          <label class="flex items-center gap-2">
            <input type="checkbox" checked={!!value()} onChange={(e) => setFeatureOption(props.id, o().key, e.currentTarget.checked)} />
            {o().label}
          </label>
        </Match>
        <Match when={o().type === 'select' && (o() as Extract<FeatureOption, { type: 'select' }>)}>
          {(sel) => (
            <label class="flex items-center gap-2">
              {sel().label}
              <select class="form-select w-auto!" value={String(value())} onChange={(e) => setFeatureOption(props.id, sel().key, e.currentTarget.value)}>
                <For each={sel().choices}>{(c) => <option value={c.value}>{c.label}</option>}</For>
              </select>
            </label>
          )}
        </Match>
        <Match when={true}>
          <label class="form-label font-normal! mb-1!" for={fieldId()}>
            {o().label}
          </label>
          <input
            id={fieldId()}
            class="form-control form-control-sm max-w-md"
            type={o().type === 'number' ? 'number' : 'text'}
            value={String(value() ?? '')}
            placeholder={o().type === 'string' ? (o() as Extract<FeatureOption, { type: 'string' }>).placeholder : undefined}
            onChange={(e) => setFeatureOption(props.id, o().key, o().type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
          />
        </Match>
      </Switch>
      <Show when={o().help}>
        <p class="note">{o().help}</p>
      </Show>
    </div>
  );
}

function FeatureList(props: { features: FeatureDef[] }) {
  return (
    <ul class="Box text-sm">
      <For each={props.features}>
        {(f) => (
          <li class="Box-row py-2!">
            <span class="font-mono text-xs font-semibold">{f.id}</span> — {f.description}
            <Show when={f.note}>
              <p class="note">{f.note}</p>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}
