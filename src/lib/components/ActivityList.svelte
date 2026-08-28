<script lang="ts">
  import { onMount } from 'svelte';
  import Tag from '$lib/components/Tag.svelte';
  import {
    ACTIVITY_COLORS,
    ACTIVITY_LABELS,
    formatAbsolute,
    formatRelative,
    type ActivityEvent
  } from '$lib/githubActivity';

  type Props = {
    events: ActivityEvent[];
    /** Events past this one are hidden below the two-column breakpoint. */
    compactLimit: number;
    profileUrl: string;
  };

  let { events, compactLimit, profileUrl }: Props = $props();

  // Rendered on the server, then kept honest in the browser: a tab left open
  // should not still claim a pull request landed "2 hours ago" tomorrow.
  let now = $state(Date.now());

  onMount(() => {
    const tick = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(tick);
  });
</script>

{#if events.length === 0}
  <p class="empty">The activity feed is offline. It should be back within the hour.</p>
{:else}
  <ul class="activity-list">
    {#each events as event, index (event.id)}
      <li class="activity-item" class:activity-item--extra={index >= compactLimit}>
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          <div class="activity-header">
            <Tag color={ACTIVITY_COLORS[event.kind]}>{ACTIVITY_LABELS[event.kind]}</Tag>
            <time class="activity-date" datetime={event.at} title={formatAbsolute(event.at)}>
              {formatRelative(event.at, now)}
            </time>
          </div>

          <p class="activity-title">{event.title}</p>

          {#if event.repository !== event.title || event.detail}
            <div class="activity-meta">
              {#if event.repository !== event.title}
                <span class="activity-repo">{event.repository}</span>
              {/if}
              {#if event.detail}
                <span class="activity-detail">{event.detail}</span>
              {/if}
            </div>
          {/if}
        </a>
      </li>
    {/each}
  </ul>

  <p class="activity-more">
    <a href={profileUrl} target="_blank" rel="noopener noreferrer">everything on github</a>
  </p>
{/if}

<style lang="scss">
  .empty {
    font-family: 'Supply Mono', monospace;
    font-size: 1.25rem;
    opacity: 0.7;
    padding: 4rem 2rem 0;
    text-align: left;
  }

  .activity-list {
    list-style: none;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 4rem 2rem 0;
  }

  // The server sends every event; a narrow viewport simply stops showing the
  // tail. `display: none` also drops them from the accessibility tree.
  .activity-item--extra {
    display: none;
  }

  .activity-item a {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border: 1px dotted currentColor;
    color: inherit;
    text-decoration: none;
    opacity: 0.9;
    transition:
      opacity 0.15s ease,
      border-style 0.15s ease;
    // Side by side, cards share a row height; the border should follow it.
    height: 100%;

    &:hover {
      opacity: 1;
      border-style: solid;
    }
  }

  .activity-list:has(a:hover) .activity-item a:not(:hover) {
    opacity: 0.5;
  }

  .activity-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .activity-date {
    font-family: 'Supply Mono', monospace;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .activity-title {
    font-family: 'monocraft', monospace;
    font-size: 1.1rem;
    line-height: 1.4;
    text-align: left;
    text-wrap: pretty;
    margin: 0;
  }

  .activity-meta {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    font-family: 'Supply Mono', monospace;
    font-size: 0.85rem;
    opacity: 0.7;
    text-align: left;
    // Keeps the repository line on the same baseline across a row of cards,
    // whatever the length of the titles above it.
    margin-top: auto;
    padding-top: 0.25rem;
  }

  .activity-detail {
    opacity: 0.8;
    text-wrap: pretty;
  }

  .activity-more {
    font-family: 'Supply Mono', monospace;
    font-size: 1rem;
    letter-spacing: 0.08em;
    padding: 1.5rem 2rem 0;
    text-align: left;
    margin: 0;

    a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dotted currentColor;
      opacity: 0.6;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 1;
        border-bottom-style: solid;
      }
    }
  }

  @media (max-width: 767px) {
    .activity-list,
    .empty {
      padding: 2rem 0;
    }

    .activity-more {
      padding: 1rem 0 0;
    }
  }

  // A single column reads as a feed and holds long titles; past this width the
  // rows get wide enough that two events sit side by side without cramping.
  @media (min-width: 1200px) {
    .activity-list {
      grid-template-columns: repeat(2, 1fr);
    }

    .activity-item--extra {
      display: list-item;
    }
  }
</style>
