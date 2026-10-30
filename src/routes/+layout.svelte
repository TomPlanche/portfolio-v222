<script lang="ts">
  import '$lib/styles/main.scss';

  import { page } from '$app/state';

  import PlanesSky from '$lib/components/PlanesSky.svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { pageReveal } from '$lib/pageReveal.svelte';
  import { resolveSeo, SITE_NAME } from '$lib/seo';

  let { children, data } = $props();

  const favicon = '/zoizo.png';
  // On the first load, the planes fly alone for this long before the content fades in.
  const INTRO_DELAY = 2500;

  // Single source of truth for the head: every route feeds this through the
  // `seo` key of its `load`. See `$lib/seo`.
  const seo = $derived(resolveSeo(page.url, page.data.seo));
  // The home page is a single screen: no footer, its links sit in the note instead.
  const isHome = $derived(page.route.id === '/');

  $effect(() => {
    if (pageReveal.done) {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => pageReveal.complete(), reduced ? 0 : INTRO_DELAY);
    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="canonical" href={seo.url} />

  <title>{seo.title}</title>
  <meta content={seo.description} name="description" />

  <meta content={SITE_NAME} property="og:site_name" />
  <meta content={seo.type} property="og:type" />
  <meta content={seo.url} property="og:url" />
  <meta content={seo.ogTitle} property="og:title" />
  <meta content={seo.description} property="og:description" />
  <meta content={seo.image.url} property="og:image" />
  <meta content={seo.image.type} property="og:image:type" />
  <meta content={String(seo.image.width)} property="og:image:width" />
  <meta content={String(seo.image.height)} property="og:image:height" />
  <meta content={seo.image.alt} property="og:image:alt" />

  {#if seo.publishedAt}
    <meta content={seo.publishedAt} property="article:published_time" />
  {/if}

  <!-- Lets ATmosphere readers (Leaflet, Frontpage, Sifa ID...) find this page's ATProto record. See $lib/atproto. -->
  {#if seo.atUri}
    <link rel="site.standard.document" href={seo.atUri} />
  {/if}

  <!-- X falls back to the Open Graph tags, but renders nothing without this. -->
  <meta content="summary" name="twitter:card" />

  <!-- Without JS the intro never ends, so show the content straight away. -->
  <noscript>
    <style>
      [data-intro] * {
        opacity: 1 !important;
      }
    </style>
  </noscript>
</svelte:head>

<div id="noise"></div>

{#if data.maintenance}
  <!-- Maintenance mode (see `$lib/server/maintenance`): the sky and one sentence, nothing else. -->
  <PlanesSky />

  <main class="maintenance">
    <p>
      This website is in maintenance{#if data.maintenance.reason}: {data.maintenance
          .reason}{:else}.{/if}
    </p>
  </main>
{:else}
  <!-- The sky sits behind every page. `/planes` mounts its own to read the stats. -->
  {#if page.route.id !== '/planes'}
    <PlanesSky opacity={pageReveal.done ? 0.35 : 1} />
  {/if}

  <!-- While `data-intro` is set, the frosted panes stay hidden (see `$lib/styles/frosted`). -->
  <div class="site" data-intro={pageReveal.done ? undefined : ''}>
    <Header />

    <main class:home={isHome}>
      {@render children()}
    </main>

    {#if !isHome}
      <Footer lastCommit={data.lastCommit} />
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '$lib/styles/frosted';

  :global(body) {
    display: flex;
    flex-direction: column;
    /* The visible height: on mobile Safari the text stops at the toolbar, the sky goes under it. */
    min-height: 100vh;
    min-height: 100dvh;
  }

  .site {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .site[data-intro] {
    pointer-events: none;
  }

  main {
    padding: 2rem 4vmin;
  }

  main.home {
    flex: 1;
    display: flex;
    flex-direction: column;
    /* Keeps the note clear of the home indicator now that the page runs edge to edge. */
    padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  }

  main.maintenance {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem calc(1rem + env(safe-area-inset-right)) 2rem
      calc(1rem + env(safe-area-inset-left));

    p {
      @include frosted.frosted;

      max-width: 46rem;
      padding: 1.5rem 2rem;

      font-family: 'Supply Mono', monospace;
      font-size: 1rem;
      line-height: 1.6;
      text-wrap: pretty;
    }
  }

  #noise {
    pointer-events: none;
    z-index: 99999;
    opacity: 0.02;
    background-image: url(/noise.gif);
    background-position: 0 0;
    background-size: 250px;
    background-attachment: fixed;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100lvh;
  }
</style>
