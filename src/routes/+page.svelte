<script lang="ts">
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
        font-family: "PP Cirka", monospace;
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
  }
</style>
