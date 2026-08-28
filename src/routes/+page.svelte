<script lang="ts">
  import ActivityList from '$lib/components/ActivityList.svelte';
  import PostsList from '$lib/components/PostsList.svelte';
  import ProjectsList from '$lib/components/ProjectsList.svelte';
  import { posts } from '$lib/posts';
  import { projects } from '$lib/projects';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const GITHUB_PROFILE = 'https://github.com/TomPlanche';

  // Calculate years since 6 March 2002
  const age = Math.floor(
    (Date.now() - new Date(2002, 2, 6).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
</script>

<section id="about">
  <h2>About.</h2>

  <div class="about-content">
    <pre>
      .
\_____)\_____
/--v____ __`&lt;
        )/
        '</pre>

    <p>
      I'm a {age} years old French software engineer and CS student at
      <a href="https://www.cnam.fr/" target="_blank" rel="noopener noreferrer">CNAM</a>, based in
      Paris.
      <a
        href="https://github.com/TomPlanche?tab=repositories&q&type&language=rust&sort"
        target="_blank"
        rel="noopener noreferrer">Rust enthusiast</a
      >, I enjoy building CLI tools and web apps from Git workflow automation to interactive
      frontends. Currently working at
      <a href="https://affluences.com" target="_blank" rel="noopener noreferrer">Affluences</a>,
      previously at
      <a href="https://www.crealo.app/" target="_blank" rel="noopener noreferrer">Créalo</a>.
    </p>
  </div>
</section>

<section id="projects">
  <h2>Projects.</h2>

  <ProjectsList {projects} />
</section>

<section id="activity">
  <h2>Activity.</h2>

  <ActivityList
    events={data.activity.events}
    compactLimit={data.activity.compactLimit}
    profileUrl={GITHUB_PROFILE}
  />
</section>

<section id="writing">
  <h2>Writing.</h2>

  <PostsList {posts} />
</section>

<style lang="scss">
  section {
    height: 100%;
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;

    &#about {
      display: flex;
      flex-direction: column;

      .about-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        column-gap: 4rem;

        width: 100%;
      }

      pre {
        font-size: 2.25rem;
        font-family: 'monocraft', monospace;

        text-align: left;
      }

      p {
        font-family: 'Supply Mono', monospace;
        font-size: 1.5rem;

        line-height: 1.5;
        text-align: left;
        text-wrap: pretty;

        padding-right: 4rem;

        a {
          color: inherit;
          text-decoration: none;
          border-bottom: 1px dotted currentColor;
          opacity: 0.8;
          transition:
            opacity 0.15s ease,
            border-bottom-color 0.15s ease;

          &:hover {
            opacity: 1;
            border-bottom-style: solid;
            cursor: help;
          }
        }
      }
    }

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

    > div {
      padding: 4rem 2rem 0 2rem;
    }

    @media (max-width: 767px) {
      > div {
        padding: 2rem 0;
      }

      &#about {
        pre {
          align-self: center;
        }

        p {
          text-align: center;
          text-wrap: balance;
          padding: 0;
        }
      }
    }

    @media (min-width: 768px) {
      &#about .about-content {
        flex-direction: row;
        align-items: center;
      }
    }
  }
</style>
