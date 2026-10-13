import { useAction } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { toastError } from '../../../components/ui';
import { followUser } from '../api';

/** Follow / Unfollow (optimistic). `following` is the server state. */
export default function FollowButton(props: { login: string; following: boolean; class?: string; block?: boolean }) {
  const [following, setFollowing] = createSignal(() => props.following);
  const [busy, setBusy] = createSignal(false);
  const follow = useAction(followUser);
  const toggle = async () => {
    const next = !following();
    setFollowing(next);
    setBusy(true);
    try {
      await follow(props.login, next);
    } catch (e) {
      setFollowing(!next);
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      class={['btn', props.class, { 'btn-block': props.block }]}
      disabled={busy()}
      onClick={() => void toggle()}
    >
      {following() ? 'Unfollow' : 'Follow'}
    </button>
  );
}
