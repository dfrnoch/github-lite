import { createSignal } from 'solid-js';
import { formatDate, formatDateTime, timeAgo } from '../../lib/format';

// One shared clock: every <RelativeTime> re-renders once a minute.
const [now, setNow] = createSignal(Date.now());
if (typeof window !== 'undefined') setInterval(() => setNow(Date.now()), 60_000);

/**
 * "3 hours ago" with the full timestamp on hover. Like GitHub, dates older
 * than a month switch to an absolute "on Jan 8, 2025" (pass `prefix={false}`
 * to drop the "on").
 */
export default function RelativeTime(props: {
  datetime: string | null | undefined;
  prefix?: boolean;
  /** Always "3 years ago" style (file tables), never an absolute date. */
  relative?: boolean;
  class?: string;
}) {
  const text = () => {
    if (!props.datetime) return '';
    const age = now() - new Date(props.datetime).getTime();
    if (!props.relative && age > 30 * 24 * 3600 * 1000) return `${props.prefix === false ? '' : 'on '}${formatDate(props.datetime)}`;
    return timeAgo(props.datetime, now());
  };
  return (
    <time class={props.class} datetime={props.datetime ?? undefined} title={props.datetime ? formatDateTime(props.datetime) : undefined}>
      {text()}
    </time>
  );
}
