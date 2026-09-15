// Markdown for agents.
//
// The same pages the browser gets, as Markdown, for anything that asks for
// `text/markdown` instead of HTML. `src/hooks.server.ts` does the asking;
// this module decides what "yes" looks like.
//
// A blog post is served from the note it was transcribed from, which is real
// Markdown already (see `$lib/posts`). Every other page is converted from the
// HTML it just rendered, so a page never has to be written twice and can
// never drift from its Markdown.
//
// Shape of the document follows Cloudflare's Markdown for Agents, so that a
// client written against a Cloudflare zone reads this site unchanged:
// https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/

import { getPost, getPostSource } from '$lib/posts';
import { collapsedTextOf, collectElements, findElement, parseHtml, type HtmlNode } from './html';
import { renderMarkdown } from './render';

export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

const POST_PATH = /^\/blog\/([^/]+)\/?$/;

/**
 * Does this `Accept` header ask for Markdown rather than HTML?
 *
 * A wildcard never counts as asking: the catch-all type is what `curl` sends
 * with no arguments, and what a browser puts at the end of its list, so HTML stays
 * the default for both. A tie goes to Markdown, since naming `text/markdown`
 * at all is a deliberate act.
 */
export const prefersMarkdown = (accept: string | null): boolean => {
  if (accept === null) {
    return false;
  }

  let markdown = 0;
  let html = 0;

  for (const entry of accept.split(',')) {
    const [rawType, ...parameters] = entry.split(';');
    const type = rawType.trim().toLowerCase();

    if (type === '') {
      continue;
    }

    const weight = parameters
      .map((parameter) => /^\s*q\s*=\s*([0-9]*\.?[0-9]+)\s*$/i.exec(parameter))
      .find((match) => match !== null);

    const quality = weight ? Number.parseFloat(weight[1]) : 1;

    if (!Number.isFinite(quality)) {
      continue;
    }

    if (type === 'text/markdown' || type === 'text/x-markdown') {
      markdown = Math.max(markdown, quality);
    } else if (type === 'text/html' || type === 'text/*' || type === '*/*') {
      html = Math.max(html, quality);
    }
  }

  return markdown > 0 && markdown >= html;
};

/**
 * Roughly how many tokens the Markdown is worth, for `x-markdown-tokens`.
 *
 * An estimate rather than a tokenizer: words break about every four
 * characters in the byte-pair vocabularies the common models use, and
 * punctuation stands alone. Close enough for the budgeting a client does with
 * the header, and it costs no dependency.
 */
export const estimateTokens = (text: string): number => {
  let tokens = 0;

  for (const [chunk] of text.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)) {
    tokens += chunk.length <= 4 ? 1 : Math.ceil(chunk.length / 4);
  }

  return tokens;
};

const quoted = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The page's own metadata, read back off the tags `+layout.svelte` rendered
 * from `$lib/seo`, so the two can never disagree.
 */
const frontmatter = (document: HtmlNode[], url: URL): string => {
  const metas = collectElements(document, (element) => element.tag === 'meta');

  const content = (key: 'name' | 'property', value: string): string | undefined =>
    metas.find((meta) => meta.attributes[key]?.toLowerCase() === value)?.attributes.content;

  const titleTag = findElement(document, (element) => element.tag === 'title');
  const canonical = findElement(
    document,
    (element) => element.tag === 'link' && element.attributes.rel === 'canonical'
  );

  const fields: [string, string | undefined][] = [
    ['title', titleTag ? collapsedTextOf(titleTag) : content('property', 'og:title')],
    ['description', content('name', 'description') ?? content('property', 'og:description')],
    ['image', content('property', 'og:image')],
    // Not one of Cloudflare's fields, but a note's own links and images are
    // written root-relative, and this is what resolves them.
    ['url', canonical?.attributes.href ?? new URL(url.pathname, url.origin).href]
  ];

  const lines = fields
    .filter((field): field is [string, string] => field[1] !== undefined && field[1] !== '')
    .map(([name, value]) => `${name}: ${quoted(value)}`);

  return lines.length === 0 ? '' : `---\n${lines.join('\n')}\n---\n\n`;
};

/**
 * A post as its author wrote it, with the header the page shows above it.
 * `undefined` when the slug is not a post, or when the post was written as a
 * component with no note behind it: the rendered page is then the only source
 * there is, and the HTML conversion handles it.
 */
const postBody = (pathname: string): string | undefined => {
  const slug = POST_PATH.exec(pathname)?.[1];

  if (slug === undefined) {
    return undefined;
  }

  const post = getPost(slug);
  const source = getPostSource(slug);

  if (!post || source === undefined) {
    return undefined;
  }

  const tags = post.metadata.tags ?? [];

  return [
    `# ${post.metadata.title}`,
    post.metadata.date,
    tags.map((tag) => `\`${tag}\``).join(' '),
    source
  ]
    .filter((block) => block !== '')
    .join('\n\n');
};

/** A rendered page as a Markdown document. */
export const toMarkdown = (url: URL, html: string): string => {
  const document = parseHtml(html);
  const main = findElement(document, (element) => element.tag === 'main');

  const body = postBody(url.pathname) ?? renderMarkdown(main ? main.children : document, url);

  return `${frontmatter(document, url)}${body}\n`;
};
