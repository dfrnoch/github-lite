import { createSignal, Show } from 'solid-js';
import { unverifiedIcon, verifiedIcon, xIcon } from '../../icons/octicons';
import { formatDate } from '../../lib/format';
import { type CommitSignature, SIGNATURE_REASON } from '../../lib/signature';
import Octicon from '../Octicon';
import Avatar from './Avatar';
import Popover from './Popover';

const KEY_LABEL: Record<CommitSignature['kind'], string> = {
  GPG: 'GPG key ID',
  SSH: 'SSH Key Fingerprint',
  SMIME: 'S/MIME',
  UNKNOWN: 'Key',
};

const VIGILANT_DOCS =
  'https://docs.github.com/authentication/managing-commit-signature-verification/displaying-verification-statuses-for-all-of-your-commits';

/**
 * github.com's commit signature badge: "Verified" (green) for a valid
 * signature, "Unverified" (amber) for one that failed. Renders nothing for
 * unsigned commits. Clicking opens the signature details popover.
 */
export default function VerifiedBadge(props: { signature: CommitSignature | null | undefined; class?: string }) {
  const [open, setOpen] = createSignal(false);
  let button: HTMLButtonElement | undefined;
  return (
    <Show when={props.signature}>
      {(sig) => (
        <>
          <button
            ref={button}
            type="button"
            class={['Label cursor-pointer bg-transparent', sig().isValid ? 'Label--success' : 'Label--attention', props.class]}
            aria-haspopup="dialog"
            aria-expanded={open() ? 'true' : 'false'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(!open());
            }}
          >
            {sig().isValid ? 'Verified' : 'Unverified'}
          </button>
          <Popover
            anchor={button}
            open={open()}
            onClose={() => setOpen(false)}
            align="end"
            class="w-[360px] max-w-[calc(100vw-16px)] text-sm"
            aria-label="Signature verification"
            focus
          >
            <SignatureDetails signature={sig()} onClose={() => setOpen(false)} />
          </Popover>
        </>
      )}
    </Show>
  );
}

function SignatureDetails(props: { signature: CommitSignature; onClose: () => void }) {
  const sig = () => props.signature;
  const headline = () => {
    if (!sig().isValid) return 'This commit is signed, but the signature could not be verified.';
    if (sig().wasSignedByGitHub) return 'This commit was created on GitHub.com and signed with GitHub’s verified signature.';
    return 'This commit was signed with the committer’s verified signature.';
  };
  return (
    <div>
      <div class="flex items-start gap-2 pl-4 pr-2 py-3">
        <Octicon
          icon={sig().isValid ? verifiedIcon : unverifiedIcon}
          class={['shrink-0 mt-0.5', sig().isValid ? 'text-fg-success' : 'text-fg-attention']}
        />
        <div class="flex-1 min-w-0">
          <p>{headline()}</p>
          <Show when={!sig().isValid}>
            <p class="mt-1 text-xs text-fg-muted">{SIGNATURE_REASON[sig().state] ?? `Verification failed (${sig().state.toLowerCase()}).`}</p>
          </Show>
        </div>
        <button type="button" class="btn-octicon w-7 h-7 -mt-1 shrink-0" aria-label="Close" onClick={() => props.onClose()}>
          <Octicon icon={xIcon} />
        </button>
      </div>
      <Show when={!sig().wasSignedByGitHub && sig().signer}>
        {(signer) => (
          <div class="flex items-center gap-2 px-4 py-2 border-t border-line-muted">
            <a href={`/${signer().login}`} class="flex">
              <Avatar src={signer().avatarUrl} login={signer().login} size={32} />
            </a>
            <a href={`/${signer().login}`} class="font-semibold link-plain">
              {signer().login}
            </a>
          </div>
        )}
      </Show>
      <div class="px-4 py-2 border-t border-line-muted text-xs">
        <Show when={sig().keyId} fallback={<span class="text-fg-muted">{KEY_LABEL[sig().kind]} signature</span>}>
          {KEY_LABEL[sig().kind]}: <code class="font-mono text-fg-muted break-all">{sig().keyId}</code>
        </Show>
        <Show when={sig().isValid && sig().verifiedAt}>
          {(at) => <div class="mt-1 text-fg-muted">Verified on {formatDate(at())}</div>}
        </Show>
      </div>
      <div class="px-4 py-2 border-t border-line-muted text-xs">
        <a href={VIGILANT_DOCS} target="_blank" rel="noreferrer">
          Learn about vigilant mode
        </a>
        .
      </div>
    </div>
  );
}
