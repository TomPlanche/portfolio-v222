<script lang="ts">
	type CommitInfo = {
		sha: string;
		date: string;
		url: string;
	};

	let { lastCommit }: { lastCommit: CommitInfo | null } = $props();

	const links: {
		href: string;
		title: string;
	}[] = [
		{ href: 'https://github.com/tomplanche', title: 'github' },
		{ href: 'mailto:tomplanche@proton.me', title: 'mail' },
		{ href: 'https://linkedin.com/in/tom-planche', title: 'linkedin' },
		{ href: 'https://api.tomplanche.com/static/CV_PLANCHE-TOM_2026.pdf', title: 'resume' }
	];

</script>

<footer>
	<div class="links">
		{#each links as { href, title } (href)}
			<a href={href} target="_blank" rel="noopener noreferrer">{title}</a>

			{#if href !== links[links.length - 1].href}
				<span class="sep">/</span>
			{/if}
		{/each}
	</div>

	{#if lastCommit}
		<div class="commit">
			<a href={lastCommit.url} target="_blank" rel="noopener noreferrer">
				<svg class="commit-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
				     aria-hidden="true">
					<line x1="0" y1="8" x2="4" y2="8" stroke="currentColor" stroke-width="1.5" />
					<circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5" />
					<line x1="12" y1="8" x2="16" y2="8" stroke="currentColor" stroke-width="1.5" />
				</svg>
				<span class="sha">{lastCommit.sha}</span>
			</a>
		</div>
	{/if}
</footer>

<style lang="scss">
  footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 4vmin;
    margin-top: 4rem;
    border-top: 1px dotted currentColor;
    opacity: 0.6;
    font-family: "Supply Mono", monospace;
    font-size: 0.75rem;
    letter-spacing: 0.08em;

    .links {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      a {
        color: inherit;
        text-decoration: none;
        transition: opacity 0.15s ease;

        &:hover {
          opacity: 1;
        }
      }

      .sep {
        opacity: 0.4;
      }
    }

    .commit {
      a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: inherit;
        text-decoration: none;
        transition: opacity 0.15s ease;

        &:hover {
          opacity: 1;
        }
      }

      .commit-icon {
        width: 1em;
        height: 1em;
        flex-shrink: 0;
        opacity: 0.6;
      }

      .sha {
        font-family: "monocraft", monospace;
        opacity: 0.7;
      }

      .date {
        opacity: 0.5;
      }
    }
  }
</style>
