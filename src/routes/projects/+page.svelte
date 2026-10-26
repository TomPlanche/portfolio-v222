<script lang="ts">
  // import ActivityList from '$lib/components/ActivityList.svelte';
  import ProjectsList from '$lib/components/ProjectsList.svelte';
  import { projects } from '$lib/projects';
  // import type { PageData } from './$types';

  // The Activity section below is turned off; uncomment these with it.
  // let { data }: { data: PageData } = $props();
  // const GITHUB_PROFILE = 'https://github.com/TomPlanche';
</script>

<section id="projects">
  <h2>Projects.</h2>

  <ProjectsList {projects} />
</section>

<!--<section id="activity">-->
<!--  <h2>Activity.</h2>-->

<!--  <ActivityList-->
<!--    events={data.activity.events}-->
<!--    compactLimit={data.activity.compactLimit}-->
<!--    profileUrl={GITHUB_PROFILE}-->
<!--  />-->
<!--</section>-->

<style lang="scss">
  @use '$lib/styles/sections';

  section {
    @include sections.section-shell;

    height: 100%;
    justify-content: center;

    h2 {
      @include sections.section-heading;
    }
  }
</style>
