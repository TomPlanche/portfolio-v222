<script lang="ts">
  import {
    buildRailPath,
    clipFor,
    createTableOfContents,
    RAIL,
    type RailSegment
  } from '$lib/tableOfContents.svelte';

  type Props = {
    /** Element holding the headings. Get it with `bind:this` on your content wrapper. */
    container?: HTMLElement | null;
    /** Which headings to list. */
    selector?: string;
    /** Label above the list. Left empty, the list stands on its own. */
    title?: string;
    /**
     * Gap kept between the top of the viewport and the heading counted as
     * current, both when scrolling and when jumping to one.
     */
    offset?: number;
    /** Extra classes for the `<nav>`, for positioning it from the outside. */
    class?: string;
  };

  let {
    container = null,
    selector = 'h2, h3',
    title = 'On this page',
    offset = 96,
    class: className = ''
  }: Props = $props();

  const toc = createTableOfContents({
    container: () => container,
    selector: () => selector,
    offset: () => offset
  });

  let content = $state<HTMLElement | null>(null);
  let segments = $state<RailSegment[]>([]);

  const path = $derived(buildRailPath(segments));
  const clip = $derived(clipFor(segments[toc.activeIndex] ?? null));

  // The rail is drawn from where the links actually landed, so a heading long
  // enough to wrap gets a longer run and the line stays beside its text.
  $effect(() => {
    const items = toc.headings;

    if (!content || items.length === 0) {
      segments = [];
      return;
    }

    const target = content;

    const measure = () => {
      segments = Array.from(target.children).map((child, index) => {
        const link = child as HTMLElement;

        return {
          top: link.offsetTop + RAIL.inset,
          bottom: link.offsetTop + link.offsetHeight - RAIL.inset,
          x: RAIL.x + (items[index]?.depth ?? 0) * RAIL.step
        };
      });
    };

    measure();

    // Re-measure when the sidebar changes width and the labels re-wrap.
    const observer = new ResizeObserver(measure);
    observer.observe(target);

    return () => observer.disconnect();
  });

  const height = $derived(
    segments.length > 0 ? segments[segments.length - 1].bottom + RAIL.inset : 0
  );
  const width = $derived(
    RAIL.x + Math.max(0, ...toc.headings.map((heading) => heading.depth)) * RAIL.step + RAIL.step
  );

  const select = (event: MouseEvent, id: string) => {
    // Let modified clicks open the anchor in a new tab as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    toc.goTo(id);
  };
</script>

{#if toc.headings.length > 0}
  <nav
    aria-label={title || 'Table of contents'}
    class="toc {className}"
    style:--toc-indent-step="{RAIL.step}px"
    style:--toc-text-indent="{RAIL.x + RAIL.textGap}px"
  >
    {#if title}
      <p class="toc__label">{title}</p>
    {/if}

    <div class="toc__scroll">
      <!-- Two copies of the same line: the second is clipped down to the band
           beside the current heading, which slides as the reader moves. -->
      <svg
        aria-hidden="true"
        class="toc__rail toc__rail--muted"
        {height}
        style:height="{height}px"
        style:width="{width}px"
        viewBox="0 0 {width} {height}"
        {width}
      >
        <path d={path} fill="none" stroke="currentColor" stroke-width="1" />
      </svg>

      <svg
        aria-hidden="true"
        class="toc__rail toc__rail--active"
        {height}
        style:clip-path={clip}
        style:height="{height}px"
        style:width="{width}px"
        viewBox="0 0 {width} {height}"
        {width}
      >
        <path d={path} fill="none" stroke="currentColor" stroke-width="1" />
      </svg>

      <div bind:this={content} class="toc__content">
        {#each toc.headings as heading (heading.id)}
          <a
            aria-current={toc.activeId === heading.id ? 'true' : undefined}
            class="toc__link"
            class:toc__link--active={toc.activeId === heading.id}
            data-depth={heading.depth}
            href="#{heading.id}"
            onclick={(event) => select(event, heading.id)}
            style:--toc-depth={heading.depth}
          >
            {heading.text}
          </a>
        {/each}
      </div>
    </div>
  </nav>
{/if}

<style lang="scss">
  .toc {
    font-family: 'Supply Mono', monospace;

    // Re-theme the whole component from the outside with these three.
    --toc-rail: color-mix(in oklab, currentColor 22%, transparent);
    --toc-text: color-mix(in oklab, currentColor 60%, transparent);
    --toc-accent: var(--text-color, currentColor);
  }

  .toc__label {
    margin: 0 0 0.75rem;
    margin-inline-start: var(--toc-text-indent);
    font-size: 0.7rem;
    font-weight: 500;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--toc-text);
  }

  // One grid cell holding the two rails and the links, so the lines sit behind
  // the text without being taken out of the flow that sizes the whole thing.
  .toc__scroll {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 0;
    max-height: calc(100vh - 12rem);
    overflow-y: auto;
    margin-inline-end: -0.5rem;
    padding-inline-end: 0.75rem;
  }

  // Width and height are set inline, in pixels, from the measured geometry:
  // the project reset declares `svg { width: 100%; height: 100% }`, and a CSS
  // declaration beats the element's own width/height attributes.
  .toc__rail {
    grid-area: 1 / 1;
    place-self: start;
    overflow: visible;
    pointer-events: none;
  }

  .toc__rail--muted {
    color: var(--toc-rail);
  }

  .toc__rail--active {
    color: var(--toc-accent);
    transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toc__content {
    grid-area: 1 / 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .toc__link {
    // `--toc-depth` comes from `data-depth`: every level down shifts the text
    // by exactly the same 8px the rail moves, so the two stay side by side.
    padding: 0.35rem 0 0.35rem
      calc(var(--toc-text-indent) + var(--toc-depth, 0) * var(--toc-indent-step));
    color: var(--toc-text);
    font-size: 0.8rem;
    line-height: 1.4;
    text-align: left;
    text-decoration: none;
    text-wrap: pretty;
    transition: color 0.15s ease;

    &:hover {
      color: var(--toc-accent);
    }
  }

  .toc__link--active {
    color: var(--toc-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .toc__rail--active,
    .toc__link {
      transition: none;
    }
  }
</style>
