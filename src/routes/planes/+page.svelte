<script lang="ts">
  // Imports
  import PlanesSky from '$lib/components/PlanesSky.svelte';
  import type { SkyStats } from '$lib/planes/engine';

  // Variables
  let stats = $state<SkyStats>({ planes: 0, waypoints: 0 });

  // Functions
  const onStats = (next: SkyStats) => {
    stats = next;
  };
</script>

<PlanesSky {onStats} />

<section id="planes" class="section">
  <h2>Planes.</h2>

  {#if stats.planes > 0}
    <p class="section__intro">
      {stats.planes} planes aloft, {stats.waypoints} waypoints. Click to drop one.
    </p>
  {/if}
</section>

<style lang="scss">
  @use '$lib/styles/sections';

  .section {
    @include sections.section-shell;

    h2 {
      @include sections.section-heading;
    }

    &__intro {
      font-family: 'Supply Mono', monospace;
      font-size: 1rem;
      line-height: 1.6;
      text-align: left;

      padding: 0 2rem;
      opacity: 0.6;
    }
  }
</style>
