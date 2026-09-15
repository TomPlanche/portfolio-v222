<script lang="ts">
  import PostsList from '$lib/components/PostsList.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<section id="blog">
  <h2>Writing.</h2>

  <PostsList posts={data.posts} showTags />
</section>

<style lang="scss">
  @use '$lib/styles/sections';

  section {
    @include sections.section-shell;

    h2 {
      @include sections.section-heading;
    }
  }

  // Pull the blog view out of the layout's 4vmin side padding on mobile, leaving only a slim gutter.
  @media (max-width: 767px) {
    section {
      margin-inline: -4vmin;
      padding-inline: 0.5rem;
    }
  }
</style>
