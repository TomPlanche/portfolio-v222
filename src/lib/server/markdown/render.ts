// Turns the `<main>` of a server-rendered page into Markdown.
//
// Most of this is the plain HTML to Markdown mapping any converter does. The
// rest is keyed on this site's own class names, because the components carry
// meaning in them that the tags alone do not: `figure.code` is a code block
// whose lines are separate spans, `.tag` is a one-word label, `.code__gutter`
// is line numbering rather than content. Those rules break if a component is
// restructured, which is the trade for output that reads like the page.

import {
  collapsedTextOf,
  collectElements,
  findElement,
  hasClass,
  textOf,
  type HtmlElement,
  type HtmlNode
} from './html';

type Context = {
  /** The page's own URL. Every link and image is resolved against it. */
  base: URL;
};

const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'ins',
  'kbd',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr'
]);

/** Elements that carry no prose, or whose prose is interface rather than content. */
const IGNORED_TAGS = new Set([
  'audio',
  'button',
  'canvas',
  'form',
  'head',
  'iframe',
  'input',
  'label',
  'nav',
  'noscript',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
  'video'
]);

/**
 * Reading aids an agent has no use for: the table of contents and the back to
 * top button (both in `aside.rail`), the "back to writing" link above a post,
 * a code block's line numbers and copy button, and the interactive globe,
 * whose satellite and location markers are text hung on a canvas.
 */
const IGNORED_CLASSES = new Set(['back', 'code__copy', 'code__gutter', 'globe-wrapper', 'rail']);

const isIgnored = (element: HtmlElement): boolean => {
  if (IGNORED_TAGS.has(element.tag) || element.attributes['aria-hidden'] === 'true') {
    return true;
  }

  const classes = element.attributes.class?.split(/\s+/) ?? [];

  return classes.some((name) => IGNORED_CLASSES.has(name));
};

const isInline = (node: HtmlNode): boolean => {
  if (node.kind === 'text') {
    return true;
  }

  if (!INLINE_TAGS.has(node.tag)) {
    return false;
  }

  // The project, post and activity cards are anchors wrapping a heading, a
  // description and an image. A Markdown link's text is inline only, so those
  // are laid out as a block instead (see `renderCard`).
  return node.children.every(isInline);
};

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Squeeze the whitespace an indented template picks up out of a rendered block. */
const tidy = (text: string): string =>
  text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeText = (text: string): string => text.replace(/([\\`*[\]])/g, '\\$1');

const longestRun = (text: string, character: string): number => {
  let longest = 0;
  let current = 0;

  for (const char of text) {
    current = char === character ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
};

const codeSpan = (text: string): string => {
  if (text === '') {
    return '';
  }

  const ticks = '`'.repeat(longestRun(text, '`') + 1);
  // A snippet that starts or ends with a backtick needs a space inside the
  // fence, which Markdown readers strip back off.
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';

  return `${ticks}${padding}${text}${padding}${ticks}`;
};

const fence = (code: string, info: string): string => {
  const body = code.replace(/^\n+/, '').replace(/\s+$/, '');
  const ticks = '`'.repeat(Math.max(3, longestRun(body, '`') + 1));

  return `${ticks}${info}\n${body}\n${ticks}`;
};

const absolute = (href: string | undefined, base: URL): string => {
  if (href === undefined || href === '') {
    return '';
  }

  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
};

/** A link target, in angle brackets when it holds something a reader would choke on. */
const target = (href: string): string => (/[\s()]/.test(href) ? `<${href}>` : href);

const emphasise = (marker: string, inner: string): string => {
  const trimmed = inner.trim();

  if (trimmed === '') {
    return inner;
  }

  // The markers have to sit against the text, so any surrounding space moves out.
  const before = inner.startsWith(' ') ? ' ' : '';
  const after = inner.endsWith(' ') ? ' ' : '';

  return `${before}${marker}${trimmed}${marker}${after}`;
};

const renderInline = (nodes: HtmlNode[], context: Context): string => {
  let rendered = '';
  let previousWasElement = false;

  for (const node of nodes) {
    const part = renderInlineNode(node, context);
    const isElement = node.kind === 'element';

    if (part === '') {
      continue;
    }

    // Svelte drops the whitespace-only text between two elements, so a row of
    // labels (a card's tags, a repository and its branch) arrives here with
    // nothing between one and the next. Rendered as written they would fuse
    // into a single word, or worse, into one code span holding two pairs of
    // backticks. Elements that sat side by side get the separator back.
    if (previousWasElement && isElement && !/\s$/.test(rendered) && !/^\s/.test(part)) {
      rendered += ' ';
    }

    rendered += part;
    previousWasElement = isElement;
  }

  return rendered;
};

const renderImage = (element: HtmlElement, context: Context): string => {
  const source = absolute(element.attributes.src, context.base);

  if (source === '') {
    return '';
  }

  return `![${escapeText(collapse(element.attributes.alt ?? ''))}](${target(source)})`;
};

const renderLink = (element: HtmlElement, context: Context): string => {
  const text = renderInline(element.children, context).trim();
  const href = absolute(element.attributes.href, context.base);

  if (href === '') {
    return text;
  }

  return text === '' ? `<${href}>` : `[${text}](${target(href)})`;
};

const renderInlineNode = (node: HtmlNode, context: Context): string => {
  if (node.kind === 'text') {
    return escapeText(node.text.replace(/\s+/g, ' '));
  }

  if (isIgnored(node)) {
    return '';
  }

  switch (node.tag) {
    case 'br':
      return '\n';
    case 'wbr':
      return '';
    case 'img':
      return renderImage(node, context);
    case 'code':
    case 'kbd':
    case 'samp':
    case 'var':
      return codeSpan(collapsedTextOf(node));
    case 'b':
    case 'strong':
      return emphasise('**', renderInline(node.children, context));
    case 'cite':
    case 'dfn':
    case 'em':
    case 'i':
      return emphasise('_', renderInline(node.children, context));
    case 'del':
    case 's':
      return emphasise('~~', renderInline(node.children, context));
    case 'time':
      // The machine-readable date beats "2 days ago" for anything reading this.
      return escapeText(node.attributes.datetime ?? collapsedTextOf(node));
    case 'a':
      return renderLink(node, context);
    default:
      // A `Tag` component. One word, so code marks keep it a token of its own
      // instead of letting it run into the words either side.
      if (hasClass(node, 'tag')) {
        return codeSpan(collapse(collapsedTextOf(node)));
      }

      return renderInline(node.children, context);
  }
};

const renderBlocks = (nodes: HtmlNode[], context: Context): string[] => {
  const blocks: string[] = [];
  let pending: HtmlNode[] = [];

  const flush = (): void => {
    if (pending.length === 0) {
      return;
    }

    const paragraph = tidy(renderInline(pending, context));
    pending = [];

    if (paragraph !== '') {
      blocks.push(paragraph);
    }
  };

  for (const node of nodes) {
    if (node.kind === 'element' && isIgnored(node)) {
      continue;
    }

    if (isInline(node)) {
      pending.push(node);
      continue;
    }

    flush();
    blocks.push(...renderBlock(node as HtmlElement, context));
  }

  flush();

  return blocks;
};

const indentItem = (marker: string, blocks: string[]): string => {
  const body = blocks.join('\n');

  if (body === '') {
    return '';
  }

  const padding = ' '.repeat(marker.length + 1);

  return body
    .split('\n')
    .map((line, index) => {
      if (index === 0) {
        return `${marker} ${line}`;
      }

      return line === '' ? '' : `${padding}${line}`;
    })
    .join('\n');
};

const renderList = (element: HtmlElement, context: Context, ordered: boolean): string => {
  const start = ordered ? Number.parseInt(element.attributes.start ?? '1', 10) || 1 : 1;

  const items = element.children.filter(
    (child): child is HtmlElement =>
      child.kind === 'element' && child.tag === 'li' && !isIgnored(child)
  );

  return items
    .map((item, index) =>
      indentItem(ordered ? `${start + index}.` : '-', renderBlocks(item.children, context))
    )
    .filter((item) => item !== '')
    .join('\n');
};

/** The text of a card's header, minus the labels and dates shown beside the title. */
const titleTextOf = (node: HtmlNode): string => {
  if (node.kind === 'text') {
    return node.text;
  }

  if (node.tag === 'time' || hasClass(node, 'tag') || isIgnored(node)) {
    return '';
  }

  return node.children.map(titleTextOf).join('');
};

/** Those labels and dates, in the order the header shows them. */
const asidesOf = (node: HtmlNode): string[] => {
  if (node.kind === 'text' || isIgnored(node)) {
    return [];
  }

  if (hasClass(node, 'tag')) {
    const label = collapsedTextOf(node);

    return label === '' ? [] : [codeSpan(label)];
  }

  if (node.tag === 'time') {
    return [node.attributes.datetime ?? collapsedTextOf(node)];
  }

  return node.children.flatMap(asidesOf);
};

/**
 * An anchor wrapping blocks: the project, post and activity cards. The header
 * row becomes the link, its labels and date follow it on the same line, and
 * everything under it becomes the lines below.
 */
const renderCard = (element: HtmlElement, context: Context): string => {
  const href = absolute(element.attributes.href, context.base);

  const children = element.children.filter(
    (child): child is HtmlElement => child.kind === 'element' && !isIgnored(child)
  );

  // The labels and the date always sit in the header row, but the title does
  // not: an activity card's header holds only the kind and the date, and names
  // the event in the paragraph below.
  const asides = children[0] ? asidesOf(children[0]) : [];
  const titled = children.findIndex((child) => collapse(titleTextOf(child)) !== '');
  const title = titled === -1 ? '' : collapse(titleTextOf(children[titled]));

  const rest = children.filter((_, index) => index !== 0 && index !== titled);

  let link = '';

  if (title !== '') {
    link = href === '' ? escapeText(title) : `[${escapeText(title)}](${target(href)})`;
  } else if (href !== '') {
    link = `<${href}>`;
  }

  const head = [link, ...asides].filter((part) => part !== '').join(' ');

  return [head, ...renderBlocks(rest, context)].filter((line) => line !== '').join('\n');
};

/**
 * The info string for a `CodeBlock`'s fence.
 *
 * The visible language label only exists when the block also has a filename,
 * since that is the only case where `CodeBlock` renders a header. The scroll
 * region's accessible name carries the language either way, and is the only
 * place a filename-less block records it.
 */
const codeLanguage = (element: HtmlElement, named: boolean): string => {
  const identifier = (text: string): string => text.toLowerCase().replace(/[^a-z0-9+#-]/g, '');

  const label = findElement([element], (node) => hasClass(node, 'code__lang'));

  if (label) {
    return identifier(collapsedTextOf(label));
  }

  // With a filename the accessible name is that filename, not a language.
  if (named) {
    return '';
  }

  const scroll = findElement([element], (node) => hasClass(node, 'code__scroll'));
  const described = /^(.+) code$/.exec(scroll?.attributes['aria-label'] ?? '');

  return described ? identifier(described[1]) : '';
};

/**
 * A `CodeBlock`. Its lines are one span each with no newline between them
 * (see the comment in `CodeBlock.svelte` about `svelte:element`), so the
 * snippet has to be rejoined line by line rather than read off the `<pre>`.
 */
const renderCodeFigure = (element: HtmlElement): string[] => {
  const lines = collectElements([element], (node) => hasClass(node, 'code__line'));
  const code = lines.length > 0 ? lines.map(textOf).join('\n') : textOf(element);

  const filename = findElement([element], (node) => hasClass(node, 'code__filename'));
  const caption = filename ? codeSpan(collapsedTextOf(filename)) : '';

  return [caption, fence(code, codeLanguage(element, filename !== undefined))].filter(
    (block) => block !== ''
  );
};

const renderTable = (element: HtmlElement, context: Context): string => {
  const cellsOf = (row: HtmlElement): string[] =>
    row.children
      .filter(
        (child): child is HtmlElement =>
          child.kind === 'element' && (child.tag === 'th' || child.tag === 'td')
      )
      .map((cell) =>
        tidy(renderInline(cell.children, context)).replace(/\n/g, ' ').replace(/\|/g, '\\|')
      );

  const rows = collectElements([element], (node) => node.tag === 'tr').map(cellsOf);
  const [header, ...body] = rows;

  if (!header) {
    return '';
  }

  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]): string =>
    `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`;

  return [line(header), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join(
    '\n'
  );
};

const renderBlock = (element: HtmlElement, context: Context): string[] => {
  const heading = /^h([1-6])$/.exec(element.tag);

  if (heading) {
    const text = tidy(renderInline(element.children, context)).replace(/\n/g, ' ');

    return text === '' ? [] : [`${'#'.repeat(Number(heading[1]))} ${text}`];
  }

  switch (element.tag) {
    case 'hr':
      return ['***'];
    case 'pre':
      return [fence(textOf(element), '')];
    case 'figure':
      return hasClass(element, 'code')
        ? renderCodeFigure(element)
        : renderBlocks(element.children, context);
    case 'blockquote':
      return [
        renderBlocks(element.children, context)
          .join('\n\n')
          .split('\n')
          .map((line) => (line === '' ? '>' : `> ${line}`))
          .join('\n')
      ];
    case 'ul':
      return [renderList(element, context, false)].filter((block) => block !== '');
    case 'ol':
      return [renderList(element, context, true)].filter((block) => block !== '');
    case 'table':
      return [renderTable(element, context)].filter((block) => block !== '');
    case 'a':
      return [renderCard(element, context)].filter((block) => block !== '');
    default:
      // `p`, `div`, `section`, `article`, `header`, `li` reached on its own:
      // containers that add nothing of their own to the Markdown.
      return renderBlocks(element.children, context);
  }
};

/** The nodes as a Markdown document body, without a trailing newline. */
export const renderMarkdown = (nodes: HtmlNode[], base: URL): string =>
  renderBlocks(nodes, { base }).join('\n\n').trim();
