<script lang="ts">
  import ActivityCalendar from '$lib/components/ActivityCalendar.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<section id="activity" class="section">
  <h2>Activity.</h2>

  <p class="section__intro">
    Everything I do in public, one square per day: code, posts, ATProto apps and the music I listen
    to. A day takes the colour of its busiest source, and the music counts only on the days with
    nothing else. Pick one or more sources to see only them, right click a source to hide it, or
    pick a day to see what happened.
  </p>

  {#if data.activity.calendar}
    <ActivityCalendar calendar={data.activity.calendar} today={data.activity.today} />
  {:else}
    <p class="empty">The activity calendar is offline. It should be back within the hour.</p>
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
      margin-top: 1rem;

      font-family: 'Supply Mono', monospace;
      font-size: 1.15rem;
      line-height: 1.6;
      text-align: left;
      text-wrap: pretty;

      padding: 0 2rem;
    }
  }

  .empty {
    font-family: 'Supply Mono', monospace;
    font-size: 1.25rem;
    opacity: 0.7;
    padding: 4rem 2rem 0;
    text-align: left;
  }

  @media (max-width: 767px) {
    .section__intro {
      padding: 0;
    }

    .empty {
      padding: 2rem 0;
    }
  }
</style>
