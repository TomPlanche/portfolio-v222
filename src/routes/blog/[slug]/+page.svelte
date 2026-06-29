<script lang="ts">
	import { formatDate } from '$lib/posts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const Post = $derived(data.component);
</script>

<svelte:head>
	<title>{data.metadata.title} - Tom Planche</title>
	{#if data.metadata.description}
		<meta name="description" content={data.metadata.description} />
	{/if}
</svelte:head>

<article>
	<a class="back" href="/blog">&larr; writing</a>

	<header>
		<h1>{data.metadata.title}</h1>
		<time datetime={data.metadata.date}>{formatDate(data.metadata.date)}</time>
	</header>

	<div class="prose">
		<Post />
	</div>
</article>

<style lang="scss">
	article {
		width: 100%;
    max-width: 70vw;
		margin: 0 auto;
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
	}

	.prose {
		font-family: 'Supply Mono', monospace;
		font-size: 1.15rem;
		line-height: 1.6;
		text-wrap: pretty;

		:global(p) {
			margin: 0 0 1.5rem;
      text-align: justify;
      //text-align: left;
		}

		:global(h2) {
			font-family: 'monocraft', monospace;
			font-size: 1.6rem;
			margin: 2.5rem 0 1rem;
		}

		:global(h3) {
			font-family: 'monocraft', monospace;
			font-size: 1.3rem;
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
      text-align: left;
		}

		:global(li) {
			margin-bottom: 0.5rem;
      text-align: left;
		}

    :global(code) {
      font-family: 'monocraft', monospace;
      font-size: 0.9em;
      padding: 0.1em 0.35em;
      border: 1px dotted currentColor;
      border-radius: 3px;
      overflow-wrap: anywhere;
    }

		:global(pre) {
			font-family: 'monocraft', monospace;
			font-size: 0.95rem;
			padding: 1rem;
			border: 1px dotted currentColor;
			overflow-x: auto;
			margin: 0 0 1.5rem;
      text-align: left;
    }

    /* code inside a pre block is a full snippet, not an inline token */
    :global(pre code) {
      padding: 0;
      border: none;
      white-space: pre;
		}

		:global(blockquote) {
			margin: 0 0 1.5rem;
			padding-left: 1rem;
			border-left: 3px dotted currentColor;
			opacity: 0.8;
      text-align: justify;
		}
	}
</style>
