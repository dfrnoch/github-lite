import { useNavigate } from '@solidjs/router';
import { createEffect, createMemo, Loading } from 'solid-js';
import { PageSpinner } from '../components/ui';
import { getViewer } from '../features/user/api';

/** /stars → /:viewer?tab=stars (github.com does the same redirect). */
export default function StarsRedirect() {
  const navigate = useNavigate();
  const viewer = createMemo(() => getViewer());
  createEffect(
    () => viewer().login,
    (login) => navigate(`/${login}?tab=stars`, { replace: true }),
  );
  return (
    <Loading>
      <PageSpinner />
    </Loading>
  );
}
