import { Title } from '@solidjs/meta';
import { createMemo, Show } from 'solid-js';
import { Blankslate, Markdown } from '../../../../components/ui';
import { getSecurityPolicy } from '../../../../features/security/api';
import { useRepo } from '../../../../features/repo/context';
import { lawIcon } from '../../../../icons/octicons';

/** /:owner/:repo/security/policy — rendered SECURITY.md. */
export default function SecurityPolicy() {
  const ctx = useRepo();
  const policy = createMemo(() => getSecurityPolicy(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`Security Policy · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal">Security</h2>
      </div>
      <Show
        when={policy()}
        fallback={
          <Blankslate
            icon={lawIcon}
            title="No security policy detected"
            action={
              <Show when={ctx.repo().permissions?.push}>
                <a class="btn btn-primary" href={`${ctx.base()}/new/${ctx.repo().default_branch}?filename=SECURITY.md`}>
                  Start setup
                </a>
              </Show>
            }
          >
            This project has not set up a SECURITY.md file yet.
          </Blankslate>
        }
      >
        {(p) => (
          <div class="Box">
            <div class="Box-header py-2!">
              <a class="font-semibold text-sm link-plain" href={p().path}>
                {p().name}
              </a>
            </div>
            <div class="Box-body p-8!">
              <Markdown html={p().html} />
            </div>
          </div>
        )}
      </Show>
    </>
  );
}
