# md-to-blog-post

Turn a [selfnotes](https://github.com/tomplanche/selfnotes) Markdown note into a blog post of this site, which is a plain Svelte component in [`src/lib/posts/`](../src/lib/posts/README.md).

The note's `+++` TOML frontmatter and its `#tags` are read exactly as `selfnotes` reads them, and they prefill the post's `metadata`. The body becomes the semantic HTML the `.prose` wrapper styles, with fenced code blocks lifted into `CodeBlock` components.

## Usage

```
cargo run -- <note.md>              # writes src/lib/posts/<slug>.svelte
cargo run -- <note.md> --stdout     # print it instead
cargo run -- - --slug my-post       # read the Markdown from stdin
cargo run -- <note.md> --format     # run prettier on the post once written
cargo run -- <note.md> --force      # overwrite an existing post
```

The output directory is the `src/lib/posts` found by walking up from the current directory; `--out-dir` overrides it. `md-to-blog-post -h` lists every flag.

## What fills the metadata

| Field         | Where it comes from, in order                                                          |
| ------------- | -------------------------------------------------------------------------------------- |
| `title`       | `--title`, frontmatter `title`, the note's leading `# Heading`, its file name          |
| `date`        | `--date`, frontmatter `date`, a `YYYY/MM/DD` journal path, the file's modification day |
| `description` | `--description`, frontmatter `description`, the note's first paragraph, shortened      |
| `tags`        | frontmatter `tags` plus the inline `#tags` in the body, de-duplicated                  |
| `draft`       | `--draft` / `--published`, frontmatter `draft`, the note's `status`                    |
| slug          | `--slug`, frontmatter `slug`, the note's file name, its title                          |

A note carrying a `selfnotes` status is a draft until that status is a published one (`done` or `published`, or whatever `--published-status` says). A note with no status at all is not a draft.

A journal entry filed as `2026/07/13.md` gets `date: '2026-07-13'` from its path, and its slug from its title rather than from `13`.

## What happens to the body

- The leading `# Heading` becomes the title and leaves the body: the post page prints it above the prose. Later headings keep their level, except an `h1`, which is demoted to `h2` so the page keeps one top-level heading.
- Inline `#tags` move to the metadata and leave the prose. `--keep-tags` writes them out as they stand, and `--no-tags` drops them entirely. Tags in code, `#123` issue references and git hashes are left alone, as in `selfnotes`.
- A `[[wikilink]]` becomes a link to `/blog/<slug>`, and `[[target|shown text]]` keeps its text.
- Inline code becomes `<Code>`; `--bare-code` writes a plain `<code>` instead.
- `{` and `}` are escaped, since Svelte reads them as an expression. Inline HTML is escaped too, so a `Vec<T>` written in prose stays text rather than becoming a broken element. A whole HTML block is written through as it stands, and the run says so.

## Code blocks

A fence becomes a `const` in the instance script and a `CodeBlock` in the markup. The info string carries the props:

````markdown
```rust src/booking.rs lines mark=2 start=10 no-copy
pub async fn book(&self, session: &str) -> Result<Booking> {
    self.post(session, IsPresent::Yes).await
}
```
````

The first word is the language (`rust`, `typescript`, `json`, `http` and their aliases are coloured; anything else renders as plain text). After it: a bare word holding a `.` or a `/` is the file name, `lines` shows the gutter, `no-copy` drops the copy button, and `mark=`, `start=`, `filename=` and `name=` are pairs. `name=` chooses the `const`'s name, which is `snippet1`, `snippet2`... otherwise.

A value holding spaces goes in quotes, which is how a file name that is really a caption still works:

````markdown
```json filename="the device the bot pretends to be" name=authMetadata
{ "brand": "Nothing" }
```
````
