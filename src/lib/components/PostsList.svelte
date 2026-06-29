<script lang="ts">
	import { formatDate, type Post } from '$lib/posts';

	let { posts }: { posts: Post[] } = $props();
</script>

{#if posts.length === 0}
	<p class="empty">Nothing here yet. Come back soon.</p>
{:else}
	<ul class="posts-list">
		{#each posts as post (post.slug)}
			<li class="post-item">
				<a href="/blog/{post.slug}">
					<div class="post-header">
						<span class="post-name">{post.title}</span>
						<time class="post-date" datetime={post.date}>{formatDate(post.date)}</time>
					</div>
					{#if post.description}
						<p class="post-description">{post.description}</p>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
  .empty {
    font-family: "Supply Mono", monospace;
    font-size: 1.25rem;
    opacity: 0.7;
    padding: 4rem 2rem 0;
  }

  .posts-list {
    list-style: none;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 4rem 2rem 0;
  }

  .post-item a {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem;
    border: 1px dotted currentColor;
    color: inherit;
    text-decoration: none;
    opacity: 0.7;
    transition: opacity 0.15s ease, border-style 0.15s ease;

    &:hover {
      opacity: 1;
      border-style: solid;
    }
  }

  .posts-list:has(a:hover) .post-item a:not(:hover) {
    opacity: 0.5;
  }

  .post-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .post-name {
    font-family: "monocraft", monospace;
    font-size: 1.1rem;
  }

  .post-date {
    font-family: "Supply Mono", monospace;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .post-description {
    font-family: "Supply Mono", monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    text-wrap: pretty;
    opacity: 0.7;
    margin: 0;
  }

  @media (max-width: 767px) {
    .posts-list,
    .empty {
      padding: 2rem 0;
    }
  }
</style>
