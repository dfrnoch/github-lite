import type { ParentProps } from 'solid-js';
import InsightsLayout from '../../../features/insights/components/InsightsLayout';

/** Layout for /:owner/:repo/graphs/* (Insights menu). */
export default function GraphsLayout(props: ParentProps) {
  return <InsightsLayout>{props.children}</InsightsLayout>;
}
