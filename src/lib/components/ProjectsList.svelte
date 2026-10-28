<script lang="ts">
  import { onMount } from 'svelte';

  import Globe from '$lib/components/Globe.svelte';
  import ImageReveal from '$lib/components/ImageReveal.svelte';
  import Tag from '$lib/components/Tag.svelte';
  import { geolocation } from '$lib/geolocation.svelte';
  import type { Project } from '$lib/projects';
  import { tagColor } from '$lib/tagColors';

  let { projects }: { projects: Project[] } = $props();

  const MORE_LINKS: { href: string; title: string }[] = [
    { href: 'https://github.com/TomPlanche?tab=repositories', title: 'github' },
    { href: 'https://git.tomplanche.com/', title: 'forge' }
  ];

  // The globe project points at wherever the visitor is, so the permission
  // prompt belongs here rather than on the page that composes the sections.
  onMount(() => {
    geolocation.request();
  });

  $effect(() => {
    if (geolocation.coords) {
      console.log('Location found:', geolocation.coords.latitude, geolocation.coords.longitude);
    }
  });
</script>

<ul class="projects-list">
  {#each projects as project (project.name)}
    <li class="project-item">
      <a href={project.url} target="_blank" rel="noopener noreferrer">
        <div class="project-header">
          <span class="project-name">{project.name}</span>
          <span class="project-tags">
            <Tag color={tagColor(project.language)}>{project.language}</Tag>
            <Tag muted>{project.role}</Tag>
          </span>
        </div>
        <p class="project-description">{project.description}</p>
        {#if project.medium}
          <div class="project-media">
            {#if project.medium === 'globe'}
              <ImageReveal>
                <Globe
                  userLocation={geolocation.coords
                    ? [geolocation.coords.latitude, geolocation.coords.longitude]
                    : null}
                />
              </ImageReveal>
            {:else}
              <ImageReveal
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
              >
                <img
                  src={project.medium}
                  alt="{project.name} preview"
                  style="{project.maxWidth
                    ? `max-width: ${project.maxWidth}%;`
                    : '100%'}{project.maxHeight ? `max-height: ${project.maxHeight}%;` : '100%'}"
                />
              </ImageReveal>
            {/if}
          </div>
        {/if}
      </a>
    </li>
  {/each}

  <li class="project-item more">
    <div class="more-card">
      <span class="more-plus" aria-hidden="true">+</span>
      <span class="project-name">more projects</span>
      <p class="project-description">See everything else I build on GitHub or on my own forge.</p>
      <div class="more-links">
        {#each MORE_LINKS as { href, title } (href)}
          <a {href} target="_blank" rel="noopener noreferrer">
            {title}
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </a>
        {/each}
      </div>
    </div>
  </li>
</ul>

<style lang="scss">
  .projects-list {
    list-style: none;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 4rem 2rem 0;
  }

  .project-item > a,
  .more-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    border: 1px dotted currentColor;
    color: inherit;
    text-decoration: none;
    opacity: 0.8;
    transition:
      opacity 0.15s ease,
      border-style 0.15s ease;
    height: 100%;

    &:hover {
      opacity: 1;
      border-style: solid;
    }
  }

  .projects-list:has(a:hover) .project-item > a:not(:hover),
  .projects-list:has(.project-item > a:hover) .more-card {
    opacity: 0.5;
  }

  .more-card {
    border-style: dashed;
    align-items: center;
    justify-content: center;
    text-align: center;

    .project-description {
      text-align: center;
    }
  }

  .more-plus {
    font-family: 'monocraft', monospace;
    font-size: 2.5rem;
    line-height: 1;
  }

  .more-links {
    display: flex;
    gap: 1.5rem;
    margin-top: 0.5rem;

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-family: 'monocraft', monospace;
      font-size: 0.9rem;
      color: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 0.25em;

      &:hover {
        text-decoration-style: solid;
      }
    }
  }

  .project-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .project-name {
    font-family: 'monocraft', monospace;
    font-size: 1.1rem;
  }

  .project-tags {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .project-description {
    font-family: 'Supply Mono', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    text-wrap: pretty;
    text-align: left;
    opacity: 0.7;
    margin: 0;
  }

  .project-media {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px dotted currentColor;
    opacity: 0.6;

    img {
      width: 100%;
      height: auto;
      object-fit: contain;
      display: block;
    }
  }

  @media (max-width: 767px) {
    .projects-list {
      padding: 2rem 0;
    }
  }

  @media (min-width: 768px) {
    .projects-list {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1200px) {
    .projects-list {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
