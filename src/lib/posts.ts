// Blog registry.
//
// Each post is a plain Svelte component living in `./posts/<slug>.svelte`.
// A post exposes its metadata through a module-level export:
//
//   <script module lang="ts">
//     import type { PostMetadata } from '$lib/posts';
//     export const metadata: PostMetadata = {
//       title: 'Hello, world',
//       date: '2026-06-29',
//       description: 'A short intro.'
//     };
//   </script>
//
// The file name (without extension) becomes the URL slug: `/blog/<slug>`.

import type { Component } from 'svelte';

export type PostMetadata = {
  title: string;
  date: string; // ISO date, e.g. "2026-06-29"
  description?: string;
  tags?: string[]; // free-form topics, e.g. ["rust", "side-project"]
  draft?: boolean;
};

export type Post = PostMetadata & {
  slug: string;
};

type PostModule = {
  default: Component;
  metadata: PostMetadata;
};

// Eagerly importing is fine here: the blog is small, and it lets both the
// index and individual post pages resolve everything synchronously.
const modules = import.meta.glob<PostModule>('./posts/*.svelte', { eager: true });

// The notes the posts were transcribed from, keyed by slug the same way
// (see `scripts/transcribe-posts.sh`). A note is the post as it was written,
// before `md-to-blog-post` turned it into a component, which makes it the
// best thing to hand an agent asking for `text/markdown`. Not every post has
// one: `posts/README.md` allows hand-written components too.
const sources = import.meta.glob<string>('./posts/sources/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const slugFromPath = (path: string): string => path.split('/').pop()!.replace('.svelte', '');

const byNewest = (a: Post, b: Post): number =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

/** All published posts, newest first. Drafts are hidden in production. */
export const posts: Post[] = Object.entries(modules)
  .map(([path, mod]): Post => ({ slug: slugFromPath(path), ...mod.metadata }))
  .filter((post) => import.meta.env.DEV || !post.draft)
  .sort(byNewest);

/** Resolve a single post (component + metadata) by slug, or `undefined`. */
export const getPost = (slug: string): PostModule | undefined => {
  const entry = Object.entries(modules).find(([path]) => slugFromPath(path) === slug);
  return entry?.[1];
};

/**
 * Drops the `+++` TOML frontmatter block `md-to-blog-post` reads, leaving the
 * body. The metadata is already on the post itself, resolved and typed.
 */
const stripFrontmatter = (markdown: string): string => {
  const lines = markdown.split('\n');

  if (lines[0]?.trim() !== '+++') {
    return markdown;
  }

  const close = lines.indexOf('+++', 1);

  return close === -1 ? markdown : lines.slice(close + 1).join('\n');
};

/** The note a post was transcribed from, body only, or `undefined` if it has none. */
export const getPostSource = (slug: string): string | undefined => {
  const source = sources[`./posts/sources/${slug}.md`];

  return source === undefined ? undefined : stripFrontmatter(source).trim();
};

/** Human-friendly date, e.g. "29 June 2026". */
export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
