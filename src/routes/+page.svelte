<script lang="ts">
  import { SOCIALS } from '$lib/socials';

  // Calculate years since 6 March 2002
  const age = Math.floor(
    (Date.now() - new Date(2002, 2, 6).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  );
</script>

<!-- A single screen: the sky, and a short note anchored to the bottom left. -->
<section id="about">
  <img alt="Plane made by Nora" src="/avion-bleu-zed-nora.png" title="I like planes" />

  <div class="note">
    <h1>Hi, I'm Tom.</h1>

    <p>
      {age} years old French software engineer and CS student at
      <a href="https://www.cnam.fr/" target="_blank" rel="noopener noreferrer">CNAM</a>, in Paris.
    </p>
    <p>
      Currently @
      <a href="https://affluences.com" target="_blank" rel="noopener noreferrer">Affluences</a>,
      before that
      <a href="https://www.crealo.app/" target="_blank" rel="noopener noreferrer">Créalo</a>.
    </p>
    <p>
      <a
        href="https://github.com/TomPlanche?tab=repositories&q&type&language=rust&sort"
        target="_blank"
        rel="noopener noreferrer">Rust enthusiast</a
      >,
      <a href="https://atproto.com/" target="_blank" rel="noopener noreferrer">AT Protocol</a>
      enjoyer, self-hosting things, including
      <a href="https://git.tomplanche.com/" target="_blank" rel="noopener noreferrer"
        >my own Git forge</a
      > on a Lenovo Thincenter.
    </p>

    <p class="socials">
      {#each SOCIALS as { href, title }, i (href)}
        {#if i > 0}<span class="sep">/</span>{/if}
        <a {href} target="_blank" rel="noopener noreferrer">{title}</a>
      {/each}
    </p>
  </div>
</section>

<style lang="scss">
  @use '$lib/styles/frosted';

  #about {
    @include frosted.frosted;

    // Pushed to the bottom of the screen by the layout's home `main`.
    margin-top: auto;
    align-self: flex-start;
    max-width: 46rem;

    display: flex;
    flex-direction: column;
    gap: 2rem;

    padding: 1.5rem 2rem;

    font-family: 'Supply Mono', monospace;
    font-size: 1rem;

    // The site centres every element (`* { text-align: center }` in the reset).
    &,
    :global(*) {
      text-align: left;
    }
  }

  img {
    align-self: flex-start;
    height: 4rem;
    width: auto;
  }

  .note {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    line-height: 1.6;
    text-wrap: pretty;
  }

  h1 {
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
  }

  a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, currentColor 35%, transparent);
    text-decoration-thickness: 1px;
    text-underline-offset: 5px;
    transition: text-decoration-color 0.15s ease;

    &:hover,
    &:focus-visible {
      text-decoration-color: currentColor;
    }
  }

  .socials {
    margin-top: 0.75rem;

    // Flex drops the markup's whitespace, so each `/` gets the same gap on both sides.
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6em;

    a {
      opacity: 0.6;
      transition: opacity 0.15s ease;

      &:hover,
      &:focus-visible {
        opacity: 1;
      }
    }

    .sep {
      opacity: 0.4;
    }
  }

  @media (max-width: 767px) {
    #about {
      padding: 1.25rem;
      font-size: 0.9rem;
    }
  }
</style>
