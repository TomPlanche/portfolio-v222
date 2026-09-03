// Document head metadata.
//
// A route declares its own values by returning `seo` from its `load`:
//
//   export const load: PageLoad = () => ({
//     seo: { title: 'blog', description: 'Small posts by Tom Planche.' }
//   });
//
// `+layout.svelte` reads the result from `page.data` and renders every tag
// exactly once. Routes must therefore never declare a `<title>` or a `<meta>`
// of their own: SvelteKit appends head content instead of replacing it, so a
// second `og:title` would sit next to the first one and scrapers keep
// whichever they read first.

export type OgImage = {
  /** Root-relative or absolute. Resolved against the current origin. */
  url: string;
  type: string;
  width: number;
  height: number;
  alt: string;
};

export type Seo = {
  /** Page title, without the site suffix. Omitted on the home page. */
  title?: string;
  description?: string;
  image?: OgImage;
  /** `article` for blog posts, `website` everywhere else. */
  type?: 'website' | 'article';
  /** ISO date, only meaningful for `article`. */
  publishedAt?: string;
  /** `at://` URI of this page's `site.standard.document` record, once it has been published. See `$lib/atproto`. */
  atUri?: string;
};

export const SITE_NAME = 'Tom Planche';

const DEFAULT_DESCRIPTION = 'Tom Planche\'s website.';

const DEFAULT_IMAGE: OgImage = {
  url: '/zoizo.png',
  type: 'image/png',
  width: 424,
  height: 440,
  alt: 'Nora\'s drawing of us as birds in a heart shape'
};

export type ResolvedSeo = {
  /** Full `<title>`, site name included. */
  title: string;
  /** Bare title, without the site suffix: Open Graph adds `og:site_name`. */
  ogTitle: string;
  description: string;
  image: OgImage;
  type: 'website' | 'article';
  /** Canonical URL: origin plus pathname, query string and hash dropped. */
  url: string;
  publishedAt?: string;
  atUri?: string;
};

/**
 * Merge a route's `seo` with the site defaults and turn every URL absolute.
 *
 * Scrapers reject root-relative `og:image` values, so the image is resolved
 * against the current origin. Behind a reverse proxy that origin comes from
 * the `ORIGIN` environment variable that `adapter-node` reads.
 */
export const resolveSeo = (url: URL, seo?: Seo): ResolvedSeo => {
  const image = seo?.image ?? DEFAULT_IMAGE;

  return {
    title: seo?.title ? `${seo.title} - ${SITE_NAME}` : SITE_NAME,
    ogTitle: seo?.title ?? SITE_NAME,
    description: seo?.description ?? DEFAULT_DESCRIPTION,
    image: { ...image, url: new URL(image.url, url.origin).href },
    type: seo?.type ?? 'website',
    url: new URL(url.pathname, url.origin).href,
    publishedAt: seo?.publishedAt,
    atUri: seo?.atUri
  };
};
