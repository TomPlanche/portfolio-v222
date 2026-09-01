<!--
  Inline code, the `` `like this` `` of Markdown.

  Bare `<code>` in a post still works and is styled the same way by the `.prose`
  wrapper; this component exists so the style lives in one place and so inline
  and block code share a vocabulary. Use `CodeBlock` for anything multi-line.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** The code itself. Anything short: an identifier, a flag, a header. */
		children?: Snippet;
		/** Alternative to `children`, handy when the text comes from a variable. */
		code?: string;
		class?: string;
	};

	let { children, code, class: className = '' }: Props = $props();
</script>

<code
	class={['inline-code', className]}
>
	{#if children}
		{@render children()}
	{:else}
		{code ?? ''}
	{/if}
</code>

<style lang="scss">
  .inline-code {
    font-family: 'monocraft', ui-monospace, monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border: 1px dotted currentColor;
    border-radius: 3px;
    background: color-mix(in oklab, currentColor 6%, transparent);
    overflow-wrap: anywhere;
  }
</style>
