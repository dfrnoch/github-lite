import { useNavigate } from '@solidjs/router';

/** /settings → /settings/profile (github.com does the same). */
export default function SettingsIndex() {
  useNavigate()('/settings/profile', { replace: true });
  return null;
}
