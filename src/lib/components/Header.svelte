<script lang="ts">
  import { page } from '$app/state';

  const isActive = (path: string): boolean =>
    path === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(path);
</script>

<header>
  <a class="brand" href="/" aria-label="Tom Planche - home">
    <h1>Tom Planche</h1>
    <img
      alt="Plane made by Nora"
      class="plane"
      src="/avion-bleu-zed-nora.png"
      title="I like planes"
    />
  </a>

  <nav>
    <a href="/" aria-current={isActive('/') ? 'page' : undefined}>home</a>
    <span class="sep">/</span>
    <a href="/blog" aria-current={isActive('/blog') ? 'page' : undefined}>blog</a>
    <span class="sep">/</span>
    <a href="/now" aria-current={isActive('/now') ? 'page' : undefined}>now</a>
    <span class="sep">/</span>
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

  header {
    @include frosted.frosted(0);

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
    padding: 2rem 4vmin;

    .brand {
      display: flex;
      align-items: center;
      gap: 2rem;
      color: inherit;
      text-decoration: none;

      h1 {
        font-family: 'PP Mondwest', monospace;
        font-size: clamp(2rem, 10vw, 5rem);
        line-height: 1;
      }

      .plane {
        height: 6rem;
        width: auto;
      }
    }

    nav {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: 'Supply Mono', monospace;
      font-size: 1.25rem;
      letter-spacing: 0.08em;

      a {
        color: inherit;
        text-decoration: none;
        opacity: 0.6;
        transition: opacity 0.15s ease;

        &:hover {
          opacity: 1;
        }

        &[aria-current='page'] {
          opacity: 1;
          border-bottom: 1px dotted currentColor;
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

      .sep {
        opacity: 0.4;
      }
    }

    &:has(nav a:hover) nav a:not(:hover) {
      opacity: 0.4;
    }

    @media (max-width: 767px) {
      .brand .plane {
        height: 4rem;
      }
    }
  }
</style>
