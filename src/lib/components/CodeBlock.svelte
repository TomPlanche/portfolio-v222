<!--
  A multi-line code block, the ``` ``` ``` of Markdown.

      <CodeBlock
        lang="rust"
        filename="src/booking.rs"
        lines
        mark="2, 5-7"
        code={`
          fn main() {
            println!("hi");
          }
        `}
      />

  Only `code` is required. The indentation a template literal picks up from the
  surrounding markup is stripped, so the snippet can sit wherever it reads best.

  Colours arrive after hydration (see `$lib/highlight`): the server renders the
  same block, same font, same metrics, in a single foreground colour. Nothing
  moves when the tokens land.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';

  import {
    type CodeLine,
    dedent,
    highlight,
    languageLabel,
    parseLineSelection,
    tokenStyle
  } from '$lib/highlight';

  type Props = {
    /** The snippet. Leading indentation is stripped, see `dedent`. */
    code: string;
    /** `rust`, `typescript`, `json`, `http`, or an alias. Omit for plain text. */
    lang?: string;
    /** Shown in the header, e.g. `src/main.rs`. Omitting it hides the header. */
    filename?: string;
    /** Show the line-number gutter. */
    lines?: boolean;
    /** Lines to call out, e.g. `"3"`, `"3,7"`, `"7-9"`. Others are dimmed. */
    mark?: string;
    /** Number the first line as something other than 1. */
    startLine?: number;
    /** Offer a copy-to-clipboard button. */
    copy?: boolean;
    class?: string;
  };

  let {
    code,
    lang,
    filename,
    lines = false,
    mark,
    startLine = 1,
    copy = true,
    class: className = ''
  }: Props = $props();

  const source = $derived(dedent(code));
  const label = $derived(languageLabel(lang));
  const marked = $derived(parseLineSelection(mark));
  const hasMarks = $derived(marked.size > 0);

  let tokens = $state<CodeLine[] | null>(null);

  // Highlighting is async and browser-only, so it lives in an effect rather
  // than a `$derived`. Re-running for a new snippet cancels the previous one.
  $effect(() => {
    const snippet = source;
    const language = lang;

    let stale = false;

    highlight(snippet, language).then((result) => {
      if (!stale) tokens = result;
    });

    return () => {
      stale = true;
    };
  });

  const rows = $derived(
    source.split('\n').map((text, index) => {
      const number = index + startLine;

      return { number, text, marked: marked.has(number), tokens: tokens?.[index] ?? null };
    })
  );

  let copied = $state(false);
  let resetCopied: ReturnType<typeof setTimeout> | undefined;

  const copyToClipboard = async () => {
    try {
      // The original source, not the DOM: line numbers and markers stay out of
      // the clipboard, and the text is exactly what the post author wrote.
      await navigator.clipboard.writeText(source);

      copied = true;
      clearTimeout(resetCopied);
      resetCopied = setTimeout(() => (copied = false), 1600);
    } catch {
      // Clipboard denied (insecure context, or the user said no). Nothing to
      // recover from, and an error message would be noise.
    }
  };

  onDestroy(() => clearTimeout(resetCopied));
</script>

{#snippet copyButton()}
  <button
    aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
    class="code__copy"
    onclick={copyToClipboard}
    type="button"
  >
    {copied ? 'copied' : 'copy'}
  </button>
{/snippet}

<figure class={['code', className]}>
  {#if filename}
    <figcaption class="code__head">
      <span class="code__filename">{filename}</span>

      {#if label}
        <span class="code__lang">{label}</span>
      {/if}

      {#if copy}
        {@render copyButton()}
      {/if}
    </figcaption>
  {:else if copy}
    {@render copyButton()}
  {/if}

  <div class="code__body">
    {#if lines}
      <div aria-hidden="true" class="code__gutter">
        {#each rows as row (row.number)}
          <span class="code__number" class:code__number--marked={row.marked}>{row.number}</span>
        {/each}
      </div>
    {/if}

    <!-- A block that scrolls sideways has to be reachable by keyboard, which is
           what the tabindex is for. Svelte's rule does not know that a labelled
           scroll region is the accepted exception, hence the ignore. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      aria-label={filename ?? (label ? `${label} code` : 'code')}
      class="code__scroll"
      role="region"
      tabindex="0"
    >
      <!-- `<svelte:element this="pre">` rather than a literal `<pre>` tag, and
           not for fun: inside a real `<pre>` Svelte keeps the source whitespace
           verbatim, so the moment any formatter reflows this file it injects
           newlines and tabs between the token spans and every token lands on its
           own line. Going through `svelte:element` puts the same `<pre>` in the
           DOM but lets Svelte drop whitespace-only nodes the way it does
           everywhere else, so the rendering no longer depends on how this file
           happens to be indented. -->
      <svelte:element this="pre" class="code__pre">
        <code class="code__lines">
          {#each rows as row (row.number)}
            <span
              class="code__line"
              class:code__line--marked={row.marked}
              class:code__line--dimmed={hasMarks && !row.marked}
            >
              {#if row.tokens}
                {#each row.tokens as token, index (index)}
                  <span style={tokenStyle(token)}>{token.content}</span>
                {/each}
              {:else}
                {row.text}
              {/if}
            </span>
          {/each}
        </code>
      </svelte:element>
    </div>
  </div>
</figure>

<style lang="scss">
  .code {
    // Shiki's "css variables" theme resolves every token through one of these,
    // so the syntax palette is plain CSS and lives next to the block that uses
    // it. Tuned for the site's near-black background.
    --code-foreground: #d5dae4;
    --code-token-comment: #626d7d;
    --code-token-keyword: #e8703a;
    --code-token-string: #9ec37d;
    --code-token-string-expression: #9ec37d;
    --code-token-function: #7fb3ff;
    --code-token-constant: #d9b17e;
    --code-token-parameter: #cfd6e2;
    --code-token-punctuation: #8b95a5;
    --code-token-link: var(--zed-blue-text, #7fb3ff);
    --code-token-inserted: #7fc08a;
    --code-token-deleted: #e0685f;
    --code-token-changed: #d9b17e;

    --code-leading: 1.7;
    --code-pad: 1rem;

    position: relative;
    margin: 0 0 1.5rem;
    border: 1px dotted currentColor;
    background: color-mix(in oklab, currentColor 4%, transparent);
    font-family: 'monocraft', ui-monospace, monospace;
    text-align: left;
  }

  .code__head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem var(--code-pad);
    border-bottom: 1px dotted color-mix(in oklab, currentColor 45%, transparent);
    font-family: 'Supply Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-align: left;
  }

  .code__filename {
    margin-inline-end: auto;
    overflow-wrap: anywhere;
    opacity: 0.85;
  }

  .code__lang {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.45;
  }

  .code__copy {
    flex: none;
    display: block;
    padding: 0.2rem 0.5rem;
    border: 1px dotted currentColor;
    border-radius: 3px;
    background: color-mix(in oklab, currentColor 8%, transparent);
    color: inherit;
    font-family: 'Supply Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    opacity: 0.55;
    transition: opacity 0.15s ease;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }
  }

  // Without a header there is no bar to sit in, so the button floats over the
  // top-right corner and only shows itself when the block is being used.
  .code > .code__copy {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 1;
    background: var(--zed-dark, #121316);
    opacity: 0;
  }

  .code:hover > .code__copy,
  .code:focus-within > .code__copy {
    opacity: 0.55;
  }

  .code:hover > .code__copy:hover,
  .code > .code__copy:focus-visible {
    opacity: 1;
  }

  .code__body {
    display: flex;
    align-items: stretch;
    min-width: 0;
    font-size: 0.85em;
    line-height: var(--code-leading);
  }

  // The gutter sits outside the scrolling area, so the numbers stay put while
  // a long line scrolls past them, and a text selection never picks them up.
  .code__gutter {
    flex: none;
    padding: var(--code-pad) 0.75rem var(--code-pad) var(--code-pad);
    border-right: 1px dotted color-mix(in oklab, currentColor 35%, transparent);
    color: color-mix(in oklab, currentColor 40%, transparent);
    font-variant-numeric: tabular-nums;
    text-align: right;
    user-select: none;
  }

  .code__number {
    display: block;
  }

  .code__number--marked {
    color: var(--code-foreground);
  }

  .code__scroll {
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--code-pad) 0;
    overflow-x: auto;
    color: var(--code-foreground);

    &:focus-visible {
      outline: 1px dotted currentColor;
      outline-offset: -2px;
    }
  }

  // `max-content` widens the element to its longest line, so a marked line's
  // background reaches the end of the scrollable width instead of stopping at
  // the visible edge.
  .code .code__pre {
    display: block;
    width: max-content;
    min-width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: visible;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    tab-size: 2;
  }

  .code .code__lines {
    display: block;
    padding: 0;
    border: 0;
    background: none;
    white-space: pre;
  }

  .code__line {
    display: block;
    // Blank lines have no content to give them height.
    min-height: calc(1em * var(--code-leading));
    padding: 0 var(--code-pad);
    border-left: 2px solid transparent;
  }

  .code__line--marked {
    border-left-color: var(--code-token-keyword);
    background: color-mix(in oklab, currentColor 9%, transparent);
  }

  .code__line--dimmed {
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .code__copy {
      transition: none;
    }
  }
</style>
