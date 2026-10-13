import type { ParentProps } from 'solid-js';
import RunLayout from '../../../../../features/actions/components/RunLayout';

/** Layout of /:owner/:repo/actions/runs/:id/* — run header + jobs sidebar. */
export default function RunPageLayout(props: ParentProps) {
  return <RunLayout>{props.children}</RunLayout>;
}
