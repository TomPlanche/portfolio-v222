<script lang="ts">
  import { createTableOfContents, type TocNode } from '$lib/tableOfContents.svelte';

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

  const select = (event: MouseEvent, id: string) => {
    // Let modified clicks open the anchor in a new tab as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    toc.goTo(id);
  };
</script>

{#snippet entry(node: TocNode)}
  <li class="toc__item">
    <a
      aria-current={toc.activeId === node.id ? 'true' : undefined}
      class="toc__link"
      class:toc__link--active={toc.activeId === node.id}
      href="#{node.id}"
      onclick={(event) => select(event, node.id)}
    >
      <span>{node.text}</span>
    </a>

    {#if node.children.length > 0}
      <ul class="toc__list toc__list--nested">
        {#each node.children as child (child.id)}
          {@render entry(child)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

{#if toc.tree.length > 0}
  <nav aria-label={title || 'Table of contents'} class="toc {className}">
    {#if title}
      <p class="toc__title">{title}</p>
    {/if}

    <ul class="toc__list">
      {#each toc.tree as node (node.id)}
        {@render entry(node)}
      {/each}
    </ul>
  </nav>
{/if}

<style lang="scss">
  .toc {
    font-family: 'Supply Mono', monospace;

    // The rail, the hover edge and the marker of the current section. Set them
    // from the outside to re-theme the whole component.
    --toc-rail: color-mix(in oklab, currentColor 20%, transparent);
    --toc-rail-hover: color-mix(in oklab, currentColor 50%, transparent);
    --toc-marker: var(--text-color, currentColor);
  }

  .toc__title {
    margin: 0 0 0.75rem;
    padding-left: 1rem;
    font-size: 0.7rem;
    font-weight: 500;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.55;
  }

  .toc__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
    // The rail every item's own left border slides over.
    border-left: 2px solid var(--toc-rail);
  }

  .toc__list--nested {
    margin-top: 0.5rem;

    .toc__link {
      padding-left: 1.75rem;
    }
  }

  .toc__item {
    // Pull the item onto the rail so its border covers it exactly.
    margin-left: -2px;
    text-align: left;
  }

  .toc__link {
    display: block;
    padding: 0.125rem 0 0.125rem 1rem;
    border-left: 2px solid transparent;
    color: inherit;
    font-size: 0.8rem;
    line-height: 1.4;
    text-align: left;
    text-decoration: none;
    text-wrap: pretty;
    opacity: 0.55;
    transition:
      opacity 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      border-left-color: var(--toc-rail-hover);
      opacity: 1;
    }
  }

  .toc__link--active {
    border-left-color: var(--toc-marker);
    opacity: 1;
  }

  // Dim the rest of the list while a link is hovered, like the site header.
  .toc:has(.toc__link:hover) .toc__link:not(:hover) {
    opacity: 0.35;
  }

  @media (prefers-reduced-motion: reduce) {
    .toc__link {
      transition: none;
    }
  }
</style>
