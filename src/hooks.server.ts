// Content negotiation for agents.
//
// A request that asks for `text/markdown` gets the page as Markdown. Anything
// that does not, a browser included, gets exactly the HTML it got before.
// What the Markdown looks like is `$lib/server/markdown`'s business.
//
// This sits in `handle` rather than in a `+server.ts` per route on purpose: a
// route cannot hold both a page and an endpoint without the endpoint taking
// over every request whose `Accept` header is not HTML, `curl`'s bare `*/*`
// among them. Negotiating after the page has rendered keeps HTML the default
// and leaves the routes themselves untouched.

import type { Handle } from '@sveltejs/kit';

import {
  estimateTokens,
  MARKDOWN_CONTENT_TYPE,
  prefersMarkdown,
  toMarkdown
} from '$lib/server/markdown';
import { getMaintenance } from '$lib/server/maintenance';

/** Headers that describe the HTML body and stop being true once it is Markdown. */
const REPLACED_HEADERS = ['content-encoding', 'content-length', 'etag', 'last-modified'];

const isHtml = (response: Response): boolean =>
  response.headers.get('content-type')?.startsWith('text/html') ?? false;

/** Tell caches that this URL has two representations, and which header picks one. */
const varyOnAccept = (headers: Headers): void => {
  const vary = headers.get('vary');

  if (vary === null) {
    headers.set('vary', 'Accept');
  } else if (!/(^|,)\s*accept\s*(,|$)/i.test(vary)) {
    headers.append('vary', 'Accept');
  }
};

/**
 * In maintenance mode the layout renders its own page (see `$lib/server/maintenance`).
 * A 503 tells crawlers that this page is temporary and not the real content.
 */
const asUnavailable = (response: Response): Response =>
  new Response(response.body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: response.headers
  });

export const handle: Handle = async ({ event, resolve }) => {
  let response = await resolve(event);

  if (!isHtml(response)) {
    return response;
  }

  if (getMaintenance() && response.ok) {
    response = asUnavailable(response);
  }

  varyOnAccept(response.headers);

  const readOnly = event.request.method === 'GET' || event.request.method === 'HEAD';

  if (!readOnly || !prefersMarkdown(event.request.headers.get('accept'))) {
    return response;
  }

  const markdown = toMarkdown(event.url, await response.text());
  const headers = new Headers(response.headers);

  for (const header of REPLACED_HEADERS) {
    headers.delete(header);
  }

  headers.set('content-type', MARKDOWN_CONTENT_TYPE);
  headers.set('x-markdown-tokens', String(estimateTokens(markdown)));

  return new Response(markdown, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
