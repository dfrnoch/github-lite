import { Title } from '@solidjs/meta';
import { ErrorView } from '../components/ui';
import { GitHubError } from '../lib/github';

export default function NotFound() {
  return (
    <>
      <Title>Page not found · GitHub</Title>
      <ErrorView error={new GitHubError(404, 'Not Found')} />
    </>
  );
}
