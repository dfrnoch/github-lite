import { createSignal, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { IssueLabel, toastError } from '../../../components/ui';
import { syncIcon } from '../../../icons/octicons';

export interface LabelValues {
  name: string;
  color: string;
  description: string;
}

/** GitHub's label palette-ish random color (6 hex digits, no #). */
export const randomColor = () =>
  Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');

const isHex = (c: string) => /^[0-9a-f]{6}$/i.test(c);

/** Black or white, whichever reads better on the given background. */
const contrastText = (hex: string) => {
  const n = parseInt(hex, 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1f2328' : '#ffffff';
};

/** Create / edit label form with a live preview and a random color button. */
export default function LabelForm(props: {
  initial?: LabelValues;
  submitLabel: string;
  onSubmit: (values: LabelValues) => Promise<unknown>;
  onCancel: () => void;
  idPrefix: string;
}) {
  const [name, setName] = createSignal(() => props.initial?.name ?? '');
  const [description, setDescription] = createSignal(() => props.initial?.description ?? '');
  const [color, setColor] = createSignal(() => props.initial?.color ?? randomColor());
  const [busy, setBusy] = createSignal(false);
  const hex = () => color().replace(/^#/, '');

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!name().trim() || !isHex(hex())) return;
    setBusy(true);
    try {
      await props.onSubmit({ name: name().trim(), description: description().trim(), color: hex().toLowerCase() });
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div class="mb-3">
        <IssueLabel name={name().trim() || 'Label preview'} color={isHex(hex()) ? hex() : 'ededed'} />
      </div>
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex-1 min-w-[180px]">
          <label class="form-label" for={`${props.idPrefix}-name`}>
            Label name
          </label>
          <input
            id={`${props.idPrefix}-name`}
            class="form-control w-full"
            placeholder="Label name"
            maxlength={50}
            required
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <div class="flex-[2] min-w-[200px]">
          <label class="form-label" for={`${props.idPrefix}-description`}>
            Description
          </label>
          <input
            id={`${props.idPrefix}-description`}
            class="form-control w-full"
            placeholder="Description (optional)"
            maxlength={100}
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="form-label" for={`${props.idPrefix}-color`}>
            Color
          </label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn px-2!"
              style={isHex(hex()) ? { 'background-color': `#${hex()}`, 'border-color': `#${hex()}`, color: contrastText(hex()) } : undefined}
              title="Get a new color"
              aria-label="Get a new color"
              onClick={() => setColor(randomColor())}
            >
              <Octicon icon={syncIcon} class="text-inherit!" />
            </button>
            <input
              id={`${props.idPrefix}-color`}
              class={['form-control w-[100px] font-mono', { 'border-line-danger!': !isHex(hex()) }]}
              value={`#${hex()}`}
              maxlength={7}
              onInput={(e) => setColor(e.currentTarget.value)}
            />
            <input
              type="color"
              class="w-8 h-8 p-0 border-0 bg-transparent cursor-pointer"
              aria-label="Pick a color"
              value={isHex(hex()) ? `#${hex()}` : '#ededed'}
              onInput={(e) => setColor(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn" onClick={() => props.onCancel()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !name().trim() || !isHex(hex())}>
            {props.submitLabel}
          </button>
        </div>
      </div>
      <Show when={!isHex(hex())}>
        <p class="text-xs text-fg-danger mt-1">Color must be a hex code like #d73a4a.</p>
      </Show>
    </form>
  );
}
