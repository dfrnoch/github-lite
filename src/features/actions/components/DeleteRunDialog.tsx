import { useAction } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { Dialog, toast, toastError } from '../../../components/ui';
import { deleteRun } from '../api';

/** "Delete workflow run?" confirmation. Controlled through `run` (null = closed). */
export default function DeleteRunDialog(props: {
  owner: string;
  repo: string;
  run: { id: number; display_title: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const remove = useAction(deleteRun);
  const [busy, setBusy] = createSignal(false);
  const confirm = async () => {
    const run = props.run;
    if (!run) return;
    setBusy(true);
    try {
      await remove(props.owner, props.repo, run.id);
      toast('Workflow run deleted.', 'success');
      props.onClose();
      props.onDeleted?.();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!props.run}
      onClose={props.onClose}
      title="Delete workflow run?"
      width="440px"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="button" class="btn btn-danger" disabled={busy()} onClick={() => void confirm()}>
            {busy() ? 'Deleting…' : 'Yes, permanently delete this workflow run'}
          </button>
        </>
      }
    >
      <p>
        Are you sure you want to permanently delete <strong>{props.run?.display_title}</strong>? This will also delete its logs and
        artifacts. This cannot be undone.
      </p>
    </Dialog>
  );
}
