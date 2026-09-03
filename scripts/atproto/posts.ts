// Discovers the blog's posts without booting Vite: reads each `.svelte`
// file in `src/lib/posts/`, pulls out its `<script module>` block -- the
// same block `$lib/posts` reads via `import.meta.glob` -- and runs it
// through Node's own TypeScript support to get the exported `metadata`.
//
// This keeps the publish script from re-implementing the title/date/
// description/tags fallback rules `md-to-blog-post` and hand-written
// posts each apply on their own: `metadata` is always the final, resolved
// value, exactly what the live site renders.

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const POSTS_DIR = join(process.cwd(), 'src/lib/posts');
const SOURCES_DIR = join(POSTS_DIR, 'sources');

export type PostMetadata = {
  title: string;
  date: string;
  description?: string;
  tags?: string[];
  draft?: boolean;
};

export type DiscoveredPost = {
  slug: string;
  metadata: PostMetadata;
  /** The source note's markdown body, when the post has one (see posts/README.md: not every post starts from a note). */
  sourceMarkdown: string | null;
};

const MODULE_SCRIPT = /<script\s+module(?:\s+lang=["']ts["'])?\s*>/;

/**
 * Drops a leading `+++`-delimited TOML frontmatter block, the same fence
 * `md-to-blog-post`'s `frontmatter::split` reads. Only the body matters
 * here; metadata comes from the post's own `PostMetadata` instead (see
 * the module doc comment above).
 */
const stripFrontmatter = (markdown: string): string => {
  const lines = markdown.split('\n');
  if (lines[0]?.trim() !== '+++') {
    return markdown;
  }

  const close = lines.indexOf('+++', 1);
  if (close === -1) {
    return markdown;
  }

  return lines.slice(close + 1).join('\n');
};

const extractModuleScript = (svelte: string, file: string): string => {
  const open = MODULE_SCRIPT.exec(svelte);
  if (!open) {
    throw new Error(`${file}: no <script module> block found`);
  }

  const start = open.index + open[0].length;
  const end = svelte.indexOf('</script>', start);
  if (end === -1) {
    throw new Error(`${file}: unterminated <script module> block`);
  }

  return svelte.slice(start, end);
};

/** Runs a post's module script in a throwaway file so its `export const metadata` can be read back. */
const readMetadata = async (slug: string, script: string): Promise<PostMetadata> => {
  const dir = await mkdtemp(join(tmpdir(), 'atproto-post-'));
  const file = join(dir, `${slug}.ts`);

  try {
    // `import type { PostMetadata } from '$lib/posts'` is erasable syntax
    // and needs no resolution; Node strips it before running the module.
    await writeFile(file, script, 'utf8');
    const mod = (await import(pathToFileURL(file).href)) as { metadata: PostMetadata };

    return mod.metadata;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/** Every post in `src/lib/posts/`, published or draft, with its source note's body when it has one. */
export const discoverPosts = async (): Promise<DiscoveredPost[]> => {
  const entries = await readdir(POSTS_DIR, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.svelte'));

  return Promise.all(
    files.map(async (entry): Promise<DiscoveredPost> => {
      const slug = entry.name.replace(/\.svelte$/, '');
      const svelte = await readFile(join(POSTS_DIR, entry.name), 'utf8');
      const metadata = await readMetadata(slug, extractModuleScript(svelte, entry.name));

      const source = await readFile(join(SOURCES_DIR, `${slug}.md`), 'utf8').catch(() => null);
      const sourceMarkdown = source === null ? null : stripFrontmatter(source);

      return { slug, metadata, sourceMarkdown };
    })
  );
};
