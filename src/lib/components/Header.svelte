<script lang="ts">
	import { page } from '$app/state';

	const isActive = (path: string): boolean =>
		path === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(path);
</script>

<header>
	<a class="brand" href="/" aria-label="Tom Planche - home">
		<h1>Tom Planche</h1>
		<img alt="Plane made by Nora" class="plane" src="/avion-bleu-zed-nora.png" title="I like planes" />
	</a>

	<nav>
		<a href="/" aria-current={isActive('/') ? 'page' : undefined}>home</a>
		<span class="sep">/</span>
		<a href="/blog" aria-current={isActive('/blog') ? 'page' : undefined}>blog</a>
	</nav>
</header>

<style lang="scss">
  header {
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
        font-family: "PP Mondwest", monospace;
        font-size: clamp(3rem, 12vw, 6rem);
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
      font-family: "Supply Mono", monospace;
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

        &[aria-current="page"] {
          opacity: 1;
          border-bottom: 1px dotted currentColor;
        }
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
