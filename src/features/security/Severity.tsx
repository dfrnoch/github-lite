/** Severity pill (critical / high / moderate / low) in GitHub's colors. */
export default function Severity(props: { severity: string | null | undefined }) {
  const s = () => (props.severity ?? 'unknown').toLowerCase();
  return (
    <span
      class={[
        'Label',
        {
          'Label--danger': s() === 'critical',
          'Label--severe': s() === 'high',
          'Label--attention': s() === 'medium' || s() === 'moderate',
        },
      ]}
    >
      {s() === 'medium' ? 'Moderate' : s().charAt(0).toUpperCase() + s().slice(1)}
    </span>
  );
}
