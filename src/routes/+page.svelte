<script lang="ts">
	import projectsData from '$lib/projects.json';
	import Globe from '$lib/components/Globe.svelte';

	type Project = {
		name: string;
		role: 'author' | 'contributor';
		url: string;
		description: string;
		language: string;
		medium?: string;
	};

	const projects: Project[] = projectsData;

	// Calculate years since 6 march 2002
	const age = Math.floor((Date.now() - new Date(2002, 2, 6).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
</script>

<section id="intro">
	<h1>Tom Planche</h1>
</section>

<section id="about">
	<h2>About</h2>

	<div class="about-content">
		<pre>
      .
\_____)\_____
/--v____ __`&lt;
        )/
        '</pre>

		<p>
			I'm a {age} years old French software engineer and CS student at <a href="https://www.cnam.fr/" target="_blank"
			                                                                    rel="noopener noreferrer">CNAM</a>, based in
			Paris. Rust enthusiast, I enjoy building CLI tools and web apps from Git workflow automation to interactive frontends.
			Currently working at <a href="https://affluences.com" target="_blank" rel="noopener noreferrer">Affluences</a>,
			previously at <a href="https://www.crealo.app/" target="_blank" rel="noopener noreferrer">Créalo</a>.
		</p>
	</div>
</section>

<section id="projects">
	<h2>Projects</h2>

	<ul class="projects-list">
		{#each projects as project (project.name)}
			<li class="project-item">
				<a href={project.url} target="_blank" rel="noopener noreferrer">
					<div class="project-header">
						<span class="project-name">{project.name}</span>
						<span class="project-tags">
							<span class="tag">{project.language}</span>
							<span class="tag tag--role">{project.role}</span>
						</span>
					</div>
					<p class="project-description">{project.description}</p>
					{#if project.medium}
						<div class="project-media">
							{#if project.medium === 'globe'}
								<Globe />
							{:else}
								<img src={project.medium} alt="{project.name} preview" />
							{/if}
						</div>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</section>

<style lang="scss">
  section {
    height: 100%;
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;

    &#about {
      display: flex;
      flex-direction: column;

      .about-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        column-gap: 4rem;

        width: 100%;

        @media (min-width: 768px) {
          flex-direction: row;
          align-items: center;
        }
      }

      pre {
        font-size: 2.25rem;
        font-family: "monocraft", monospace;

        text-align: left;

        @media (max-width: 786px) {
          align-self: center;
        }
      }

      p {
        font-family: "Supply Mono", monospace;
        font-size: 1.5rem;

        line-height: 1.5;
        text-align: left;
        text-wrap: pretty;

        padding-right: 4rem;

        a {
          color: inherit;
          text-decoration: none;
          border-bottom: 1px dotted currentColor;
          opacity: 0.8;
          transition: opacity 0.15s ease, border-bottom-color 0.15s ease;

          &:hover {
            opacity: 1;
            border-bottom-style: solid;
            cursor: help;
          }
        }
      }
    }

    &#projects {
      .projects-list {
        list-style: none;
        width: 100%;
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;

        @media (min-width: 768px) {
          grid-template-columns: repeat(2, 1fr);
        }

        @media (min-width: 1200px) {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .project-item {
        a {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.25rem;
          border: 1px dotted currentColor;
          color: inherit;
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.15s ease, border-style 0.15s ease;
          height: 100%;

          &:hover {
            opacity: 1;
            border-style: solid;
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
        font-family: "monocraft", monospace;
        font-size: 1.1rem;
      }

      .project-tags {
        display: flex;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .tag {
        font-family: "Supply Mono", monospace;
        font-size: 0.7rem;
        padding: 0.15rem 0.4rem;
        border: 1px dotted currentColor;
        text-transform: uppercase;
        letter-spacing: 0.1em;

        &--role {
          opacity: 0.6;
        }
      }

      .project-description {
        font-family: "Supply Mono", monospace;
        font-size: 0.9rem;
        line-height: 1.5;
        text-wrap: pretty;
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
          display: block;
        }

      }
    }

    &:not(#intro) {
      padding-top: 3rem;
    }

    h1 {
      font-family: "PP Mondwest", monospace;
      font-size: 6rem;
    }

    h2 {
      font-family: "PP Mondwest", monospace;
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      opacity: 0.8;
      text-align: left;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1.5rem;

      &::after {
        content: '';
        flex: 1;
        border-top: 3px dotted currentColor;
        opacity: 0.5;
      }
    }

    > div, > ul {
      padding: 4rem 2rem;
    }
  }
</style>
