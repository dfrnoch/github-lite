import { useParams } from '@solidjs/router';
import JobLogs from '../../../../../../../features/actions/components/JobLogs';

/** /:owner/:repo/actions/runs/:id/job/:jobId — job steps and logs. */
export default function JobPage() {
  const params = useParams<{ jobId: string }>();
  return <JobLogs jobId={params.jobId} />;
}
