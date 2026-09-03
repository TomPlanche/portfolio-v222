// Reduces a post's markdown body to the plain text `site.standard.document`
// records carry in `textContent`: no markdown syntax, no formatting. Walks
// `marked`'s token tree rather than regexing the markdown, mirroring how
// `md-to-blog-post` walks `pulldown-cmark`'s event stream for the same job
// (see its `render.rs`).
//
// This blog's converter enables GFM tables, strikethrough and task lists
// but not footnotes or math (no `ENABLE_MATH`), so there is nothing here
// to specifically drop -- everything `marked` tokenizes is text worth
// keeping, fenced and inline code included.

import { marked, type MarkedToken, type Token } from 'marked';

/** Block-level tokens get a trailing newline, so paragraphs and list items don't run into each other. */
const BLOCK_BOUNDARIES = new Set(['paragraph', 'heading', 'blockquote', 'list_item', 'code']);

const walkAll = (tokens: Token[], out: string[]): void => {
  for (const token of tokens) {
    walk(token as MarkedToken, out);
  }
};

const walk = (token: MarkedToken, out: string[]): void => {
  switch (token.type) {
    case 'text':
      // Only leaf text carries `.text` worth keeping directly; when `.tokens`
      // is set the inline parser already broke it down further.
      if (token.tokens) {
        walkAll(token.tokens, out);
      } else {
        out.push(token.text);
      }
      break;
    case 'escape':
    case 'codespan':
    case 'code':
      out.push(token.text);
      break;
    case 'heading':
    case 'paragraph':
    case 'blockquote':
    case 'strong':
    case 'em':
    case 'del':
    case 'link':
    case 'image':
    case 'list_item':
      walkAll(token.tokens, out);
      break;
    case 'list':
      walkAll(token.items, out);
      break;
    case 'table':
      for (const cell of token.header) {
        walkAll(cell.tokens, out);
      }
      for (const row of token.rows) {
        for (const cell of row) {
          walkAll(cell.tokens, out);
        }
      }
      break;
    // `br`, `hr`, `space`, `def` and raw `html` carry no readable prose.
    default:
      break;
  }

  if (BLOCK_BOUNDARIES.has(token.type)) {
    out.push('\n');
  }
};

/** The post body as plain text, block boundaries collapsed to blank lines. */
export const toTextContent = (markdown: string): string => {
  const out: string[] = [];

  walkAll(marked.lexer(markdown), out);

  return out
    .join(' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};
