export default function Spinner(props: { size?: number; class?: string }) {
  const size = () => props.size ?? 32;
  return (
    <svg
      class={['anim-rotate', props.class]}
      width={size()}
      height={size()}
      viewBox="0 0 16 16"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" />
      <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

/** Centered spinner used as the default <Loading> fallback for page sections. */
export function PageSpinner() {
  return (
    <div class="flex justify-center py-16 text-fg-muted">
      <Spinner />
    </div>
  );
}
