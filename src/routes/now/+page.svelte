<script lang="ts">
  // Imports

  // Variables

  // Functions
</script>

<section id="now" class="section">
  <h2>What I'm up to.</h2>

  <p class="section__intro">
    A snapshot of what has my attention at the moment, in the spirit of
    <a href="https://nownownow.com/about" target="_blank" rel="noopener noreferrer">nownownow</a>.
  </p>

  <ul>
    <li>
      My (<a href="/">this</a>) website, which I host on a VPS running on SvelteKit and Rust for the
      backend.
    </li>
    <li>
      Self-hosting <a href="https://git.tomplanche.com/" target="_blank" rel="noopener noreferrer">
        my own Git forge
      </a> on an old Raspberry Pi 4.
    </li>
    <li>
      Learning, playing with <a
        href="https://atproto.com/"
        target="_blank"
        rel="noopener noreferrer">AT Protocol</a
      >.
    </li>
    <li>
      Building
      <a href="https://atkuzu.tomplanche.com/" target="_blank" rel="noopener noreferrer">atkuzu</a>,
      a daily Takuzu you play with your own handle using
      <a href="https://atproto.com/" target="_blank" rel="noopener noreferrer">AT Protocol</a>.
    </li>
  </ul>
</section>

<style lang="scss">
  @use '$lib/styles/sections';

  .section {
    @include sections.section-shell;

    h2 {
      @include sections.section-heading;
    }

    * {
      font-family: 'Supply Mono', monospace;
    }

    &__intro {
      font-size: 1.25rem;
      line-height: 1.6;
      text-align: left;
      text-wrap: pretty;

      padding: 0 2rem;
    }
  }

  ul {
    font-size: 1.25rem;
    line-height: 1.6;
    text-align: left;
    text-wrap: pretty;

    // The section stacks its children with `align-items: flex-start`, so
    // without this the list is only as wide as its longest line and the rules
    // below stop short of the heading's.
    width: 100%;

    list-style: none;
    padding: 2.5rem 2rem 0;
    margin: 0;

    li {
      // Not a flex container: the links sit inline in the sentence, and flex
      // would make every run of text around them its own item, spaced by `gap`.
      position: relative;

      // `_base.scss` centres every element, which beats the alignment the list
      // passes down. The rule has to land on the item itself.
      text-align: left;

      padding: 1rem 0 1rem 2rem;
      border-bottom: 1px dotted currentColor;

      opacity: 0.85;
      transition: opacity 0.15s ease;

      // The same separator the header and the footer put between their links,
      // hung in the margin so a wrapped line keeps its indent.
      &::before {
        content: '/';
        position: absolute;
        top: 1rem;
        left: 0;
        opacity: 0.4;
      }

      &:first-child {
        padding-top: 0;

        &::before {
          top: 0;
        }
      }

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }

    // Reading one line pushes the others back, the way the nav and the card lists do.
    &:has(a:hover) li:not(:has(a:hover)) {
      opacity: 0.45;
    }

    a {
      color: inherit;
      text-decoration: none;
      border-bottom: 1px dotted currentColor;
      opacity: 0.8;
      transition:
        opacity 0.15s ease,
        border-bottom-color 0.15s ease;

      &:hover {
        opacity: 1;
        border-bottom-style: solid;
        cursor: help;
      }
    }
  }

  @media (max-width: 767px) {
    ul {
      padding: 2rem 0;
    }
  }
</style>
