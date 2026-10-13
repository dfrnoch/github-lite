
/** "Secrets / Variables" switch on the Actions secrets & variables pages. */
export default function SecretsTabs(props: { base: string; active: 'secrets' | 'variables' }) {
  return (
    <nav class="UnderlineNav mb-4">
      <div class="UnderlineNav-body">
        <a class={['UnderlineNav-item', { selected: props.active === 'secrets' }]} href={`${props.base}/settings/secrets/actions`}>
          Secrets
        </a>
        <a class={['UnderlineNav-item', { selected: props.active === 'variables' }]} href={`${props.base}/settings/variables/actions`}>
          Variables
        </a>
      </div>
    </nav>
  );
}
