import { createSignal } from 'solid-js';
import { Dialog, toast, toastError } from '../../../components/ui';

/** Confirmation for "Re-run all jobs" / "Re-run failed jobs" / "Re-run this job", with the debug logging option. */
export default function RerunDialog(props: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: (debug: boolean) => Promise<unknown>;
}) {
  const [debug, setDebug] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await props.onConfirm(debug());
      toast('Re-run requested.', 'success');
      props.onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      width="440px"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" disabled={busy()} onClick={() => void confirm()}>
            {busy() ? 'Requesting…' : props.title}
          </button>
        </>
      }
    >
      <p class="mb-4">{props.description}</p>
      <label class="flex items-start gap-2">
        <input type="checkbox" class="mt-1" checked={debug()} onChange={(e) => setDebug(e.currentTarget.checked)} />
        <span>
          <span class="font-semibold block">Enable debug logging</span>
          <span class="text-xs text-fg-muted">Re-runs will include additional runner and step debug logs.</span>
        </span>
      </label>
    </Dialog>
  );
}
