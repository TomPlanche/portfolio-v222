// A very small HTML reader.
//
// It exists to turn this site's own server-rendered pages into Markdown for
// agents (see `./render`), so it only has to cope with the markup Svelte
// emits: well formed, every non-void element closed, attributes quoted. It is
// not a spec compliant parser and nothing else should be pointed at it.

export type Attributes = Record<string, string>;

export type HtmlNode =
  | { kind: 'text'; text: string }
  | { kind: 'element'; tag: string; attributes: Attributes; children: HtmlNode[] };

export type HtmlElement = Extract<HtmlNode, { kind: 'element' }>;

/** Elements that never have a closing tag, so they never open a scope. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

/** Elements whose body is not markup. Skipped whole rather than parsed. */
const RAW_TEXT_TAGS = new Set(['script', 'style']);

// Sticky rather than anchored on a slice: the parser walks a whole document
// tag by tag, and slicing at each one would copy the page over and over.
const TAG = /<(\/?)([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/y;

const ATTRIBUTE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

// Svelte escapes `&`, `<`, `>` and `"` and leaves everything else as literal
// UTF-8, so this only has to cover those plus the few entities the pages type
// by hand (`&larr;`, `&rarr;`). Anything unknown is left alone.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: '\u0027',
  gt: '>',
  hellip: '…',
  larr: '←',
  lt: '<',
  nbsp: '\u00a0',
  ndash: '\u2013',
  quot: '"',
  rarr: '→'
};

const fromCodePoint = (code: number, fallback: string): string => {
  // A malformed reference (`&#1114112;`) would throw, and a broken page is a
  // worse outcome than a reference left as written.
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
    return fallback;
  }

  return String.fromCodePoint(code);
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (reference, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return fromCodePoint(Number.parseInt(body.slice(2), 16), reference);
    }

    if (body.startsWith('#')) {
      return fromCodePoint(Number.parseInt(body.slice(1), 10), reference);
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? reference;
  });

const parseAttributes = (raw: string): Attributes => {
  const attributes: Attributes = {};

  ATTRIBUTE.lastIndex = 0;

  for (const [, name, quoted, singleQuoted, bare] of raw.matchAll(ATTRIBUTE)) {
    // A valueless attribute (`hidden`, `lines`) reads as the empty string,
    // which is what the DOM does too.
    attributes[name.toLowerCase()] = decodeEntities(quoted ?? singleQuoted ?? bare ?? '');
  }

  return attributes;
};

/** Parse a document (or a fragment) into a tree of nodes. */
export const parseHtml = (html: string): HtmlNode[] => {
  const lowercased = html.toLowerCase();

  const root: HtmlNode[] = [];
  const stack: { tag: string; children: HtmlNode[] }[] = [{ tag: '#document', children: root }];

  const push = (node: HtmlNode): void => {
    stack[stack.length - 1].children.push(node);
  };

  const pushText = (raw: string): void => {
    if (raw !== '') {
      push({ kind: 'text', text: decodeEntities(raw) });
    }
  };

  let index = 0;

  while (index < html.length) {
    const open = html.indexOf('<', index);

    if (open === -1) {
      pushText(html.slice(index));
      break;
    }

    pushText(html.slice(index, open));

    if (html.startsWith('<!--', open)) {
      const end = html.indexOf('-->', open + 4);
      index = end === -1 ? html.length : end + 3;
      continue;
    }

    // `<!doctype html>`, and nothing else in practice.
    if (html.startsWith('<!', open) || html.startsWith('<?', open)) {
      const end = html.indexOf('>', open);
      index = end === -1 ? html.length : end + 1;
      continue;
    }

    TAG.lastIndex = open;
    const tag = TAG.exec(html);

    if (!tag) {
      // A bare `<` that is not opening a tag. It is text.
      pushText('<');
      index = open + 1;
      continue;
    }

    const [matched, closing, rawName, rawAttributes, selfClosing] = tag;
    const name = rawName.toLowerCase();

    index = open + matched.length;

    if (closing === '/') {
      // Close the nearest ancestor of that name, dropping whatever is still
      // open inside it. Svelte closes its tags, so this is belt and braces.
      const depth = stack.findLastIndex((scope) => scope.tag === name);

      if (depth > 0) {
        stack.length = depth;
      }

      continue;
    }

    const element: HtmlElement = {
      kind: 'element',
      tag: name,
      attributes: parseAttributes(rawAttributes),
      children: []
    };

    push(element);

    if (RAW_TEXT_TAGS.has(name)) {
      const end = lowercased.indexOf(`</${name}>`, index);
      index = end === -1 ? html.length : end + name.length + 3;
      continue;
    }

    if (selfClosing !== '/' && !VOID_TAGS.has(name)) {
      stack.push({ tag: name, children: element.children });
    }
  }

  return root;
};

/** Depth-first search for the first element the predicate accepts. */
export const findElement = (
  nodes: HtmlNode[],
  matches: (element: HtmlElement) => boolean
): HtmlElement | undefined => {
  for (const node of nodes) {
    if (node.kind !== 'element') {
      continue;
    }

    if (matches(node)) {
      return node;
    }

    const found = findElement(node.children, matches);

    if (found) {
      return found;
    }
  }

  return undefined;
};

/** Every element the predicate accepts, in document order. */
export const collectElements = (
  nodes: HtmlNode[],
  matches: (element: HtmlElement) => boolean
): HtmlElement[] => {
  const found: HtmlElement[] = [];

  const walk = (current: HtmlNode[]): void => {
    for (const node of current) {
      if (node.kind !== 'element') {
        continue;
      }

      if (matches(node)) {
        found.push(node);
      }

      walk(node.children);
    }
  };

  walk(nodes);

  return found;
};

/** The element's `class` attribute, split into a set. */
export const classList = (element: HtmlElement): Set<string> =>
  new Set(element.attributes.class?.split(/\s+/).filter((name) => name !== '') ?? []);

export const hasClass = (element: HtmlElement, name: string): boolean =>
  classList(element).has(name);

/** All the text under a node, entities decoded, whitespace left as found. */
export const textOf = (node: HtmlNode): string => {
  if (node.kind === 'text') {
    return node.text;
  }

  return node.children.map(textOf).join('');
};

/** The text under a node with runs of whitespace collapsed to single spaces. */
export const collapsedTextOf = (node: HtmlNode): string => textOf(node).replace(/\s+/g, ' ').trim();
