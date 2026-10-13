/**
 * GitHub avatar. `square` for organizations/bots (GitHub draws those with rounded corners).
 * `hovercard` (with `login`) shows the user hovercard on hover — for avatars that aren't links.
 */
export default function Avatar(props: {
  src?: string | null;
  login?: string;
  size?: number;
  square?: boolean;
  class?: string;
  hovercard?: boolean;
}) {
  const size = () => props.size ?? 20;
  const src = () => {
    const url = props.src ?? (props.login ? `https://github.com/${props.login}.png` : '');
    if (!url) return '';
    // avatars.githubusercontent.com resizes server-side; request 2x for HiDPI.
    const sep = url.includes('?') ? '&' : '?';
    return url.includes('githubusercontent.com') ? `${url}${sep}s=${size() * 2}` : url;
  };
  return (
    <img
      class={['avatar', { 'avatar-user': !props.square }, props.class]}
      src={src()}
      width={size()}
      height={size()}
      alt={props.login ? `@${props.login}` : ''}
      loading="lazy"
      data-hovercard-user={props.hovercard && props.login ? props.login : undefined}
    />
  );
}
