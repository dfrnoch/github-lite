import { Title } from '@solidjs/meta';
import { createMemo, Show } from 'solid-js';
import { Blankslate } from '../../components/ui';
import { getGpgKeys, getSigningKeys, getSshKeys, REQUIRED_SCOPES } from '../../features/settings/api';
import { AddKeyButton, GpgKeyList, KeyHelp, SshKeyList } from '../../features/settings/components/Keys';
import ScopeNotice from '../../features/settings/components/ScopeNotice';
import Subhead from '../../features/settings/components/Subhead';
import { keyIcon } from '../../icons/octicons';

const DOCS = 'https://docs.github.com/authentication';

export default function KeySettings() {
  // Start all three reads together.
  const ssh = createMemo(() => getSshKeys());
  const signing = createMemo(() => getSigningKeys());
  const gpg = createMemo(() => getGpgKeys());

  return (
    <>
      <Title>SSH and GPG keys</Title>

      <Subhead title="SSH keys" actions={<AddKeyButton kind="ssh" label="New SSH key" />} />
      <Show when={ssh()} fallback={<ScopeNotice scope={REQUIRED_SCOPES.keys} what="your SSH keys" />}>
        {(keys) => (
          <>
            <p class="mb-4 text-sm">
              This is a list of SSH keys associated with your account. Remove any keys that you do not recognize.
            </p>
            <Show
              when={keys().length}
              fallback={<Blankslate icon={keyIcon} title="There are no SSH keys associated with your account." class="Box" />}
            >
              <SshKeyList kind="ssh" keys={keys()} heading="Authentication keys" />
            </Show>
          </>
        )}
      </Show>
      <KeyHelp>
        Check out our guide to <a href={`${DOCS}/connecting-to-github-with-ssh`} target="_blank" rel="noreferrer">connecting to GitHub using SSH keys</a> or troubleshoot{' '}
        <a href={`${DOCS}/troubleshooting-ssh`} target="_blank" rel="noreferrer">common SSH problems</a>.
      </KeyHelp>

      <Subhead title="SSH signing keys" small actions={<AddKeyButton kind="signing" label="New SSH signing key" />} />
      <Show when={signing()} fallback={<ScopeNotice scope={REQUIRED_SCOPES.signingKeys} what="your SSH signing keys" />}>
        {(keys) => (
          <>
            <p class="mb-4 text-sm">
              This is a list of SSH keys used for signing commits and tags. Remove any keys that you do not recognize.
            </p>
            <Show
              when={keys().length}
              fallback={<Blankslate icon={keyIcon} title="There are no SSH signing keys associated with your account." class="Box" />}
            >
              <SshKeyList kind="signing" keys={keys()} heading="Signing keys" />
            </Show>
          </>
        )}
      </Show>

      <Subhead title="GPG keys" small actions={<AddKeyButton kind="gpg" label="New GPG key" />} />
      <Show when={gpg()} fallback={<ScopeNotice scope={REQUIRED_SCOPES.gpgKeys} what="your GPG keys" />}>
        {(keys) => (
          <>
            <p class="mb-4 text-sm">
              This is a list of GPG keys associated with your account. Remove any keys that you do not recognize.
            </p>
            <Show
              when={keys().length}
              fallback={<Blankslate icon={keyIcon} title="There are no GPG keys associated with your account." class="Box" />}
            >
              <GpgKeyList keys={keys()} />
            </Show>
          </>
        )}
      </Show>
      <KeyHelp>
        Learn how to <a href={`${DOCS}/managing-commit-signature-verification/generating-a-new-gpg-key`} target="_blank" rel="noreferrer">generate a GPG key and add it to your account</a>.
      </KeyHelp>
    </>
  );
}
