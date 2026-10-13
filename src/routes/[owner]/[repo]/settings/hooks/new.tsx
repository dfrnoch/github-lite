import { Title } from '@solidjs/meta';
import HookForm from '../../../../../features/repo-settings/components/HookForm';
import { Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/hooks/new */
export default function NewHook() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`Add webhook · ${ctx.fullName()}`}</Title>
      <Subhead title={<><a class="link-muted" href={`${ctx.base()}/settings/hooks`}>Webhooks</a> / Add webhook</>} />
      <HookForm owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} hook={null} />
    </>
  );
}
