/** The Explore / Topics tab bar under the header (github.com/explore, /topics). */
export default function ExploreNav(props: { active: 'explore' | 'topics' }) {
  return (
    <nav class="UnderlineNav justify-center px-4" aria-label="Explore">
      <ul class="UnderlineNav-body">
        <li>
          <a class="UnderlineNav-item" href="/explore" aria-current={props.active === 'explore' ? 'page' : undefined}>
            Explore
          </a>
        </li>
        <li>
          <a class="UnderlineNav-item" href="/topics" aria-current={props.active === 'topics' ? 'page' : undefined}>
            Topics
          </a>
        </li>
      </ul>
    </nav>
  );
}
