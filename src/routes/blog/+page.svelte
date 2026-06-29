<script lang="ts">
  import PostsList from '$lib/components/PostsList.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>blog - Tom Planche</title>
  <meta name="description" content="Small posts by Tom Planche." />
</svelte:head>

<section id="blog">
  <h2>Writing.</h2>

  <PostsList posts={data.posts} />
</section>

<style lang="scss">
  section {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding-top: 3rem;

    h2 {
      font-family: 'FK Raster Grotesk Compact Blended', monospace;
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 400;
      letter-spacing: 0.1em;
      text-transform: lowercase;
      opacity: 0.9;
      text-align: left;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1.5rem;

      &::after {
        content: '';
        flex: 1;
        border-top: 3px dotted currentColor;
        opacity: 0.5;
      }
    }
  }
</style>
