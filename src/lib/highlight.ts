// Syntax highlighting for blog code blocks, on top of Shiki.
//
// Three deliberate choices, because Shiki is a big library and a blog post is
// mostly prose:
//
//   1. Shiki is imported dynamically, so it never lands in the main bundle. A
//      page with no code block never downloads it.
//   2. Grammars are loaded one at a time. A post with a single Rust block pulls
//      in the Rust grammar and nothing else, instead of the ~10 MB full bundle.
//   3. The engine is the pure-JavaScript one, not the Oniguruma WebAssembly
//      build, which saves another ~500 kB. `forgiving` makes it skip the rare
//      regex a grammar writes in a syntax the JS engine cannot express, rather
//      than throwing.
//
// Highlighting therefore happens in the browser, after hydration. The server
// renders the plain code, so the block is readable without JavaScript and never
// shifts layout: only the colours arrive late. See `CodeBlock.svelte`.

import type { HighlighterCore, ThemedToken } from 'shiki/core';

/** A single coloured run of text, on one line. */
export type CodeToken = ThemedToken;

/** One entry per line, each holding the tokens that make up that line. */
export type CodeLine = CodeToken[];

// The theme is Shiki's "CSS variables" theme rather than a bundled colour
// scheme: tokens come out coloured with `var(--code-token-*)`, which lets the
// palette live in the stylesheet next to the rest of the site's colours.
const THEME_NAME = 'css-variables';
const VARIABLE_PREFIX = '--code-';

// The languages the blog actually writes in. Each loader is a dynamic import,
// so Vite emits one chunk per grammar and only the ones a page uses are
// fetched. Adding a language is one line here, plus its alias below; the full
// list of names is at https://shiki.style/languages.
//
// Two notes on the choices:
//   - `json` is Shiki's JSON-with-comments grammar, so a `//` in a snippet is
//     coloured as a comment rather than as a syntax error.
//   - `http` is ours (see `$lib/httpGrammar`). Shiki's own embeds shellscript,
//     xml, graphql and json to colour request bodies, which is ~61 kB gzipped
//     to highlight what is usually a single request line.
const grammars = {
  http: async () => (await import('$lib/httpGrammar')).default,
  json: async () => (await import('@shikijs/langs/json')).default,
  rust: async () => (await import('@shikijs/langs/rust')).default,
  typescript: async () => (await import('@shikijs/langs/typescript')).default
} as const;

/** A language `CodeBlock` knows how to colour. */
export type Language = keyof typeof grammars;

// The short names one actually types, mapped to the grammar above.
const aliases: Record<string, Language> = {
  rs: 'rust',
  ts: 'typescript'
};

/**
 * Map whatever a post wrote (`rs`, `Rust`, `text`, a typo) onto a known
 * grammar, or `null` when there is nothing to highlight with. A `null` result
 * is not an error: the block simply renders as plain text.
 */
export const resolveLanguage = (lang: string | undefined): Language | null => {
  if (!lang) return null;

  const key = lang.trim().toLowerCase();

  if (key in grammars) return key as Language;

  return aliases[key] ?? null;
};

/** The label shown in a block's header, e.g. `rs` renders as "rust". */
export const languageLabel = (lang: string | undefined): string =>
  resolveLanguage(lang) ?? lang?.trim().toLowerCase() ?? '';

// One highlighter for the whole page, created on first use. Kept as the
// in-flight promise rather than the resolved value so that several blocks
// mounting at once share a single import.
let highlighter: Promise<HighlighterCore> | null = null;

const getHighlighter = (): Promise<HighlighterCore> => {
  highlighter ??= (async () => {
    const [core, engine] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript')
    ]);

    return core.createHighlighterCore({
      themes: [
        core.createCssVariablesTheme({
          name: THEME_NAME,
          variablePrefix: VARIABLE_PREFIX,
          fontStyle: true
        })
      ],
      langs: [],
      engine: engine.createJavaScriptRegexEngine({ forgiving: true })
    });
  })();

  return highlighter;
};

// Same idea one level down: two Rust blocks on a page must not fetch and
// register the Rust grammar twice.
const grammarLoads = new Map<Language, Promise<void>>();

const loadGrammar = (instance: HighlighterCore, lang: Language): Promise<void> => {
  let load = grammarLoads.get(lang);

  if (!load) {
    load = grammars[lang]().then(async (grammar) => {
      await instance.loadLanguage(grammar);
    });

    grammarLoads.set(lang, load);
  }

  return load;
};

/**
 * Tokenise `code`, one array of tokens per line. Resolves to `null` when the
 * language is unknown or highlighting fails, which callers should render as
 * plain text rather than as an error.
 */
export const highlight = async (
  code: string,
  lang: string | undefined
): Promise<CodeLine[] | null> => {
  const resolved = resolveLanguage(lang);

  if (!resolved) return null;

  try {
    const instance = await getHighlighter();
    await loadGrammar(instance, resolved);

    return instance.codeToTokens(code, { lang: resolved, theme: THEME_NAME }).tokens;
  } catch (error) {
    // A grammar the JS engine chokes on should cost the reader nothing worse
    // than an uncoloured block.
    console.warn(`[highlight] could not highlight a ${resolved} block`, error);

    return null;
  }
};

/**
 * Strip the indentation a template literal picks up from the surrounding
 * markup, and drop the blank first and last lines that come with writing:
 *
 *     code={`
 *       fn main() {}
 *     `}
 */
export const dedent = (code: string): string => {
  const lines = code.replace(/\t/g, '  ').split('\n');

  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const indent = lines
    .filter((line) => line.trim() !== '')
    .reduce((min, line) => Math.min(min, line.length - line.trimStart().length), Infinity);

  if (!Number.isFinite(indent) || indent === 0) return lines.join('\n');

  return lines.map((line) => line.slice(indent)).join('\n');
};

/**
 * Parse a line selection such as `"3, 7-9"` into the set of 1-based line
 * numbers it covers. Anything unparseable is ignored.
 */
export const parseLineSelection = (selection: string | undefined): Set<number> => {
  const selected = new Set<number>();

  if (!selection) return selected;

  for (const part of selection.split(',')) {
    const range = part.trim();

    if (range === '') continue;

    const [rawStart, rawEnd] = range.split('-');
    const start = Number.parseInt(rawStart, 10);
    const end = rawEnd === undefined ? start : Number.parseInt(rawEnd, 10);

    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;

    for (let line = Math.min(start, end); line <= Math.max(start, end); line++) {
      if (line > 0) selected.add(line);
    }
  }

  return selected;
};

// Bit flags from vscode-textmate, which Shiki passes straight through.
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;
const STRIKETHROUGH = 8;

/** Turn one Shiki token into the inline style that renders it. */
export const tokenStyle = (token: CodeToken): string => {
  const style = [`color:${token.color ?? `var(${VARIABLE_PREFIX}foreground)`}`];
  const fontStyle = token.fontStyle ?? 0;

  if (fontStyle & ITALIC) style.push('font-style:italic');
  if (fontStyle & BOLD) style.push('font-weight:bold');
  if (fontStyle & (UNDERLINE | STRIKETHROUGH)) {
    const lines = [
      fontStyle & UNDERLINE ? 'underline' : '',
      fontStyle & STRIKETHROUGH ? 'line-through' : ''
    ]
      .filter(Boolean)
      .join(' ');

    style.push(`text-decoration:${lines}`);
  }

  return style.join(';');
};
