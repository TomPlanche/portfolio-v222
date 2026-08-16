<script lang="ts">
  import '$lib/styles/main.scss';

  import { page } from '$app/state';

  import PixelReveal from '$lib/components/PixelReveal.svelte';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { resolveSeo, SITE_NAME } from '$lib/seo';

  let { children, data } = $props();

  const favicon = '/zoizo.png';

  // Single source of truth for the head: every route feeds this through the
  // `seo` key of its `load`. See `$lib/seo`.
  const seo = $derived(resolveSeo(page.url, page.data.seo));
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

  <!-- X falls back to the Open Graph tags, but renders nothing without this. -->
  <meta content="summary" name="twitter:card" />
</svelte:head>

<PixelReveal />
<div id="noise"></div>

<Header />

<main>
  {@render children()}
</main>

<Footer lastCommit={data.lastCommit} />

<style>
  :global(body) {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    padding: 2rem 4vmin;
  }

  #noise {
    pointer-events: none;
    z-index: 99999;
    opacity: 0.06;
    background-image: url(/noise.gif);
    background-position: 0 0;
    background-size: 250px;
    background-attachment: fixed;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }
</style>
