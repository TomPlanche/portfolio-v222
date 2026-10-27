<script lang="ts">
  import { page } from '$app/state';

  const isActive = (path: string): boolean =>
    path === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(path);
</script>

<header>
  <nav aria-label="Main">
    <a href="/" aria-current={isActive('/') ? 'page' : undefined}>home</a>
    <a href="/projects" aria-current={isActive('/projects') ? 'page' : undefined}>projects</a>
    <a href="/blog" aria-current={isActive('/blog') ? 'page' : undefined}>blog</a>
    <a href="/now" aria-current={isActive('/now') ? 'page' : undefined}>now</a>
    <a href="/sifa-page" aria-current={undefined} rel="noopener noreferrer" target="_blank"
      >sifa
      <svg class="external" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <path d="M2 8 8 2M3.5 2H8v4.5" />
      </svg>
    </a>
  </nav>
</header>

<style lang="scss">
  @use '$lib/styles/frosted';

  // A small pill of links centred at the top, the only chrome over the sky.
  header {
    display: flex;
    justify-content: center;
    padding: 2rem 4vmin 0;

    nav {
      @include frosted.frosted(999px);

      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem 1.75rem;
      padding: 0.6rem 1.5rem;

      font-family: 'Supply Mono', monospace;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      text-transform: lowercase;

      // Tighter on a phone, so the five links stay on one line.
      @media (max-width: 767px) {
        gap: 0.5rem 1rem;
        padding: 0.6rem 1.1rem;
        font-size: 0.8rem;
        letter-spacing: 0.04em;
      }

      a {
        color: inherit;
        text-decoration: none;
        opacity: 0.5;
        transition: opacity 0.15s ease;

        &:hover,
        &:focus-visible,
        &[aria-current='page'] {
          opacity: 1;
        }
      }

      // Flex rather than inline flow: the word and its arrow then hold together
      // whatever whitespace the formatter leaves between them in the markup.
      a:has(.external) {
        display: inline-flex;
        align-items: baseline;
        gap: 0.3em;
      }

      // Marks the one link that leaves the site. Sized in `em` and stroked with
      // `currentColor`, so it tracks the nav's size and its hover opacity.
      .external {
        width: 0.55em;
        height: 0.55em;

        // A replaced flex item sits on the baseline by its bottom edge; this
        // lifts it to centre on the cap height.
        margin-bottom: 0.08em;

        fill: none;
        stroke: currentColor;
        stroke-width: 1.4;

        transition: transform 0.15s ease;
      }

      a:hover .external {
        transform: translate(0.1em, -0.1em);
      }
    }

    &:has(nav a:hover) nav a:not(:hover) {
      opacity: 0.4;
    }
  }
</style>
