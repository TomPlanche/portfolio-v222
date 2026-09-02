# tomplanche.com

Personal portfolio site. Single-page, server-side rendered, built with a focus on small details over heavy dependencies.

## Stack

- **SvelteKit** with **Svelte 5** (runes-based reactivity: `$state`, `$props`, `$effect`)
- **TypeScript** throughout
- **SCSS** for styles
- **Vite** as the build tool
- **pnpm** as the package manager, **Node** as the runtime
- **Node adapter** (`@sveltejs/adapter-node`) for self-hosted deployment
- **Rust** for [`md-to-blog-post`](md-to-blog-post/README.md), the converter that turns a Markdown note into a blog post

## Notable pieces

### Pixel reveal transitions

Two canvas-based pixel dissolve animations drive the visual transitions:

- **PixelReveal** runs as a full-screen overlay on page load. A grid of rectangles sweeps top-to-bottom, each cell briefly flashing blue before clearing to expose the page.
- **ImageReveal** wraps individual project cards. The same dissolve mechanic is scoped to the element's bounding box and fires once the element enters the viewport via `IntersectionObserver`. It waits for the page-enter animation to complete first.

Both effects draw directly to a `<canvas>` element each frame using `requestAnimationFrame`, with per-cell timing noise added around a linear sweep to avoid a mechanical look. The approach is inspired by the scroll-revealed WebGL gallery technique described at [tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js](https://tympanus.net/codrops/2026/02/02/building-a-scroll-revealed-webgl-gallery-with-gsap-three-js-astro-and-barba-js/).

### Interactive globe

The projects section includes a draggable 3D globe built with a fork of [Cobe](https://github.com/tomPlanche/cobe), pulled straight from its Git branch in `package.json` while pending PRs are merged upstream. A Git checkout ships no build output, so pnpm has to run the package's own build step; that is what the `allowBuilds` entry for `cobe` in `pnpm-workspace.yaml` permits. A set of satellite markers is distributed across the surface with arcs connecting them. If the visitor grants geolocation permission, their coordinates are plotted as an additional marker and arcs are drawn from the four nearest satellites to their location.

### Geolocation state

A small Svelte 5 reactive store (`geolocation.svelte.ts`) wraps `navigator.geolocation.getCurrentPosition`. It exposes `coords`, `error`, and `loading` as reactive getters, making it easy to wire into any component without a framework or library.

### Noise overlay

A fixed, full-viewport `<div>` tiled with a looping noise GIF sits above everything at a low opacity. It adds a subtle film grain texture without any JS.

### Footer

The footer pulls the latest Git commit SHA and URL from the GitHub API at request time (via the SvelteKit layout server load). It links directly to the commit on GitHub.

### Blog posts

A post is a plain Svelte component in `src/lib/posts/`, but it is not written by hand: it is generated from a Markdown note by [`md-to-blog-post`](md-to-blog-post/README.md), a small Rust CLI kept in this repository.

The note is a [selfnotes](https://github.com/tomplanche/selfnotes) note, read the way `selfnotes` reads it. Its `+++` TOML frontmatter and its inline `#tags` prefill the post's `metadata` (title, date, description, tags, draft), each field falling back to the body, the file path, then the file name when the frontmatter says nothing. The body becomes the semantic HTML the `.prose` wrapper styles: fenced code blocks are lifted into `CodeBlock` components with their language, file name and highlight options taken from the info string, inline code becomes `<Code>`, `[[wikilinks]]` become `/blog/<slug>` links, and braces and inline HTML are escaped so Svelte does not read them as markup or as an expression.

The notes live next to the posts, in `src/lib/posts/sources/`. `scripts/transcribe-posts.sh` builds the converter and re-transcribes every note, or just the ones named on the command line:

```sh
scripts/transcribe-posts.sh                 # every note in sources/
scripts/transcribe-posts.sh monclub-bot     # just that one, by slug
```

A generated post is always overwritten rather than merged, so the note is the thing to edit. The converter's own [README](md-to-blog-post/README.md) documents every flag and every code-block option.
