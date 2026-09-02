// One palette for every `Tag`: a project's language, a blog post's topics.
// Colours are the ecosystem's own (the Rust orange, the TypeScript blue), so a
// tag reads as its subject before it reads as decoration, the way
// `ACTIVITY_COLORS` does for the GitHub feed.
//
// Keys are lowercase; `tagColor` lowercases what it is given, so 'Rust' from
// `projects.json` and 'rust' from a post's frontmatter land on the same colour.

const TAG_COLORS: Record<string, string> = {
  rust: '#CE422B',
  typescript: '#3178C6',
  javascript: '#F0DB4F',
  svelte: '#FF3E00',
  python: '#3776AB',
};

/** The colour for a tag, or `undefined` for anything unlisted: those keep the surrounding text colour. */
export const tagColor = (tag: string): string | undefined => TAG_COLORS[tag.toLowerCase()];
