<script lang="ts">
  import { formatDate } from '$lib/posts';
  import BackToTop from '$lib/components/BackToTop.svelte';
  import Tag from '$lib/components/Tag.svelte';
  import TableOfContents from '$lib/components/TableOfContents.svelte';
  import { tagColor } from '$lib/tagColors';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const Post = $derived(data.component);

  let prose = $state<HTMLElement | null>(null);
</script>

<div class="layout">
  <article>
    <a class="back" href="/blog">&larr; writing</a>

    <header>
      <h1>{data.metadata.title}</h1>
      <time datetime={data.metadata.date}>{formatDate(data.metadata.date)}</time>
      {#if data.metadata.tags?.length}
        <div class="tags">
          {#each data.metadata.tags as tag (tag)}
            <Tag color={tagColor(tag)}>{tag}</Tag>
          {/each}
        </div>
      {/if}
    </header>

    <div bind:this={prose} class="prose">
      <Post />
    </div>
  </article>

  <aside class="rail">
    <TableOfContents container={prose} />
    <BackToTop />
  </aside>
</div>

<style lang="scss">
  // Near full-width, cancelling the layout's 4vmin side padding, leaving only a slim gutter.
  .layout {
    width: 100%;
    max-width: 99%;
    margin: 0 auto;
  }

  article {
    width: 100%;

    font-size: 35%;
  }

  // The site centres every element (`* { text-align: center }` in the reset).
  // Inheritance cannot undo that, since the rule lands on each descendant
  // directly, so the article ranges itself left by naming them.
  article,
  article :global(*) {
    text-align: left;
  }

  // Below this there is no room for a sidebar without starving the prose.
  .rail {
    display: none;
  }

  // Wide enough for both. The block stops being centred and hugs the left:
  // the side gutters it was spending are exactly the room the list needs.
  @media (min-width: 768px) {
    .layout {
      max-width: 100%;
      margin: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 14rem;
      align-items: start;
      gap: 2.5rem;
    }

    // The table of contents scrolls its own list when it outgrows the
    // viewport; the button sits under it.
    .rail {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: 1.5rem;
      position: sticky;
      top: 4rem;
    }
  }

  // Past here the article has width to spare, so the pair is centred again.
  @media (min-width: 1280px) {
    .layout {
      max-width: min(88vw, 100rem);
      margin: 0 auto;
      gap: 4rem;
    }
  }

  .back {
    font-family: 'Supply Mono', monospace;
    font-size: 0.9rem;
    letter-spacing: 0.08em;
    color: inherit;
    text-decoration: none;
    opacity: 0.6;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 1;
    }
  }

  header {
    margin: 2rem 0 3rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px dotted currentColor;

    h1 {
      font-family: 'PP Mondwest', monospace;
      font-size: clamp(2.5rem, 8vw, 3.5rem);
      margin: 0 0 0.75rem;
    }

    time {
      font-family: 'Supply Mono', monospace;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.7;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
      font-weight: bold;
    }
  }

  .prose {
    font-family: 'Supply Mono', monospace;
    font-size: 1.15em;
    line-height: 1.6;
    text-wrap: pretty;

    :global(p) {
      margin: 0 0 1.5rem;
    }

    :global(h2) {
      font-family: 'monocraft', monospace;
      font-size: 1.6em;
      margin: 2.5rem 0 1rem;
    }

    :global(h3) {
      font-family: 'monocraft', monospace;
      font-size: 1.3em;
      margin: 2rem 0 0.75rem;
    }

    :global(a) {
      color: inherit;
      border-bottom: 1px dotted currentColor;
      text-decoration: none;
      opacity: 0.85;
      transition: opacity 0.15s ease;

      &:hover {
        opacity: 1;
      }
    }

    :global(ul),
    :global(ol) {
      margin: 0 0 1.5rem;
      padding-left: 1.5rem;
    }

    :global(li) {
      margin-bottom: 0.5rem;
    }

    /* Bare <code> and <pre> written straight into a post. The Code and
       CodeBlock components bring their own styling, so they opt out here
       instead of having to out-specify these rules. */
    :global(code:not(.inline-code, .code__lines)) {
      font-family: 'monocraft', monospace;
      font-size: 0.9em;
      padding: 0.1em 0.35em;
      border: 1px dotted currentColor;
      border-radius: 3px;
      overflow-wrap: anywhere;
    }

    :global(pre:not(.code__pre)) {
      font-family: 'monocraft', monospace;
      font-size: 0.95em;
      padding: 1rem;
      border: 1px dotted currentColor;
      overflow-x: auto;
      margin: 0 0 1.5rem;
    }

    /* code inside a pre block is a full snippet, not an inline token */
    :global(pre:not(.code__pre) code) {
      padding: 0;
      border: none;
      white-space: pre;
    }

    :global(blockquote) {
      margin: 0 0 1.5rem;
      padding-left: 1rem;
      border-left: 3px dotted currentColor;
      opacity: 0.8;
    }
  }
</style>
