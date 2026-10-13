import GlobalList from '../features/issues/components/GlobalList';

/** /pulls — the viewer's pull requests across repositories. */
export default function GlobalPullsPage() {
  return <GlobalList kind="pr" />;
}
