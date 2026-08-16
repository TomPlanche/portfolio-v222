import type { Seo } from '$lib/seo';

declare global {
  namespace App {
    interface PageData {
      /** Head metadata for the current route. Rendered by `+layout.svelte`. */
      seo?: Seo;
    }
  }
}

export {};
