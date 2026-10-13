import { Title } from '@solidjs/meta';
import Octicon from '../../components/Octicon';
import Subhead from '../../features/settings/components/Subhead';
import { bellIcon, eyeIcon, infoIcon, linkExternalIcon, mailIcon } from '../../icons/octicons';

/** /settings/notifications — delivery preferences aren't exposed by the public API, so this explains and links out. */
export default function NotificationSettings() {
  return (
    <>
      <Title>Notification settings</Title>
      <Subhead title="Notifications" />
      <div class="flash mb-6">
        <Octicon icon={infoIcon} />
        <div>
          <p>
            Notification delivery settings — default notification email, email and web delivery, watching defaults,
            Actions and Dependabot alerts — are not available through GitHub's public API, so they can only be changed on
            github.com.
          </p>
          <a
            class="btn btn-sm mt-3 inline-flex items-center gap-1"
            href="https://github.com/settings/notifications"
            target="_blank"
            rel="noreferrer"
          >
            Manage notification settings on GitHub
            <Octicon icon={linkExternalIcon} size={12} />
          </a>
        </div>
      </div>

      <Subhead title="What you can manage here" small />
      <ul class="Box">
        <li class="Box-row flex items-start gap-3">
          <Octicon icon={eyeIcon} class="text-fg-muted mt-0.5" />
          <div>
            <strong>Repository watching</strong>
            <p class="text-sm text-fg-muted">
              Use the <strong>Watch</strong> button on any repository to choose between participating, all activity,
              custom events or ignoring it.
            </p>
          </div>
        </li>
        <li class="Box-row flex items-start gap-3">
          <Octicon icon={bellIcon} class="text-fg-muted mt-0.5" />
          <div>
            <strong>Thread subscriptions</strong>
            <p class="text-sm text-fg-muted">
              Subscribe to or unsubscribe from individual issues and pull requests, and mark threads as read or done,
              from your <a href="/notifications">notifications inbox</a>.
            </p>
          </div>
        </li>
        <li class="Box-row flex items-start gap-3">
          <Octicon icon={mailIcon} class="text-fg-muted mt-0.5" />
          <div>
            <strong>Email addresses</strong>
            <p class="text-sm text-fg-muted">
              Add, remove and verify the addresses notifications can be routed to in your{' '}
              <a href="/settings/emails">email settings</a>.
            </p>
          </div>
        </li>
      </ul>
    </>
  );
}
