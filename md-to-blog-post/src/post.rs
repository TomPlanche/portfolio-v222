//! Turning a note into the `.svelte` file the blog expects: metadata prefilled from the note's `+++` header and its
//! tags, then the body as markup.
//!
//! What each metadata field falls back to, in order:
//!
//! | Field         | Sources                                                                            |
//! | ------------- | ---------------------------------------------------------------------------------- |
//! | `title`       | `--title`, frontmatter `title`, the note's leading `# Heading`, its file name       |
//! | `date`        | `--date`, frontmatter `date`, a `YYYY/MM/DD` journal path, the file's mtime         |
//! | `description` | `--description`, frontmatter `description`, the note's first paragraph             |
//! | `tags`        | frontmatter `tags` plus the inline `#tags` in the body                              |
//! | `draft`       | `--draft`/`--published`, frontmatter `draft`, the note's `status`                   |
//! | slug          | `--slug`, frontmatter `slug`, the note's file name, its title                       |

use std::fmt::Write as _;
use std::path::Path;

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Local, NaiveDate};

use crate::cli::Cli;
use crate::render::{Rendered, Snippet, render};
use crate::slug::slugify;
use crate::{frontmatter, scan};

/// How long a first paragraph may be before it is cut down to a description.
const DESCRIPTION_LEN: usize = 200;

/// A converted note.
#[derive(Debug)]
pub struct Post {
    /// The URL slug, and so the file name: `<slug>.svelte`.
    pub slug: String,
    /// The whole `.svelte` file.
    pub contents: String,
    /// Whether the post is a draft, for the run's report.
    pub draft: bool,
    /// The tags it was prefilled with, for the run's report.
    pub tags: Vec<String>,
    /// How many raw HTML blocks the note's body passed through.
    pub html_blocks: usize,
}

/// Convert `content`, the Markdown of the note at `source`, into a post.
pub fn build(cli: &Cli, source: Option<&Path>, content: &str) -> Result<Post> {
    let (frontmatter, body) = frontmatter::split(content);
    let meta = frontmatter.map(frontmatter::parse).transpose()?.unwrap_or_default();

    let scanned = scan::scan(body, cli.hash_tag_min_len, cli.keep_tags);
    let rendered = render(&scanned.markdown, cli.bare_code);

    let title = cli
        .title
        .clone()
        .or_else(|| meta.title.clone())
        .or_else(|| rendered.title.clone())
        .or_else(|| source.and_then(file_stem).map(|stem| stem.replace(['-', '_'], " ")))
        .context("the note has no title: give it a frontmatter `title`, a `# Heading`, or pass `--title`")?;

    let date = date(cli, &meta, source)?;

    let description = cli
        .description
        .clone()
        .or_else(|| meta.description.clone())
        .or_else(|| rendered.summary.as_deref().map(shorten));

    let mut tags = meta.tags.clone();
    tags.extend(scanned.tags);
    dedup(&mut tags);
    if cli.no_tags {
        tags.clear();
    }

    let slug = slug(cli, &meta, source, &title)?;

    let draft = draft(cli, &meta);
    let metadata = Metadata {
        title,
        date,
        description,
        tags,
        draft,
    };
    let contents = assemble(&metadata, &rendered);

    Ok(Post {
        slug,
        contents,
        draft,
        tags: metadata.tags,
        html_blocks: rendered.html_blocks,
    })
}

/// What goes in the post's `metadata` export.
struct Metadata {
    title: String,
    date: String,
    description: Option<String>,
    tags: Vec<String>,
    draft: bool,
}

/// The `.svelte` file: the metadata module, the imports and snippets the markup needs, then the markup.
fn assemble(metadata: &Metadata, rendered: &Rendered) -> String {
    let mut out = String::new();

    out.push_str("<script module lang=\"ts\">\n  import type { PostMetadata } from '$lib/posts';\n\n");
    out.push_str("  export const metadata: PostMetadata = {\n");

    let mut fields = vec![
        format!("    title: {}", ts_string(&metadata.title)),
        format!("    date: '{}'", metadata.date),
    ];
    if let Some(description) = &metadata.description {
        fields.push(format!("    description: {}", ts_string(description)));
    }
    if !metadata.tags.is_empty() {
        let tags = metadata
            .tags
            .iter()
            .map(|tag| ts_string(tag))
            .collect::<Vec<_>>()
            .join(", ");
        fields.push(format!("    tags: [{tags}]"));
    }
    if metadata.draft {
        fields.push("    draft: true".to_owned());
    }

    out.push_str(&fields.join(",\n"));
    out.push_str("\n  };\n</script>\n");

    if rendered.uses_code || !rendered.snippets.is_empty() {
        out.push_str("\n<script lang=\"ts\">\n");

        if rendered.uses_code {
            out.push_str("  import Code from '$lib/components/Code.svelte';\n");
        }
        if !rendered.snippets.is_empty() {
            out.push_str("  import CodeBlock from '$lib/components/CodeBlock.svelte';\n");
        }

        for snippet in &rendered.snippets {
            out.push('\n');
            out.push_str(&declaration(snippet));
        }

        out.push_str("</script>\n");
    }

    out.push('\n');
    out.push_str(&rendered.markup);

    out
}

/// A snippet as a `const` holding a template literal, indented so it reads as part of the script. `CodeBlock` strips
/// that indentation back off.
fn declaration(snippet: &Snippet) -> String {
    let mut out = format!("  const {} = `\n", snippet.name);

    for line in snippet.code.lines() {
        if line.trim().is_empty() {
            out.push('\n');
        } else {
            let _ = writeln!(out, "    {}", escape_template(line));
        }
    }

    out.push_str("  `;\n");
    out
}

/// A single-quoted TypeScript string.
fn ts_string(text: &str) -> String {
    let escaped = text.replace('\\', "\\\\").replace('\'', "\\'").replace('\n', " ");

    format!("'{escaped}'")
}

/// A line of code, safe inside a template literal.
fn escape_template(line: &str) -> String {
    line.replace('\\', "\\\\").replace('`', "\\`").replace("${", "\\${")
}

/// The post's date, as ISO `YYYY-MM-DD`.
fn date(cli: &Cli, meta: &frontmatter::Meta, source: Option<&Path>) -> Result<String> {
    if let Some(date) = cli.date.as_deref().or(meta.date.as_deref()) {
        return normalise_date(date);
    }

    if let Some(date) = source.and_then(journal_date) {
        return Ok(date);
    }

    if let Some(date) = source.and_then(modified_date) {
        return Ok(date);
    }

    Ok(Local::now().date_naive().to_string())
}

/// A date as the blog wants it. A datetime keeps only its day, and anything that is not a date at all is refused
/// rather than written into a post that would sort strangely.
fn normalise_date(date: &str) -> Result<String> {
    let day = date.split(['T', ' ']).next().unwrap_or(date).trim();

    if NaiveDate::parse_from_str(day, "%Y-%m-%d").is_err() {
        bail!("`{date}` is not an ISO date such as `2026-07-13`");
    }

    Ok(day.to_owned())
}

/// The date a journal entry's own path spells out, as `<root>/YYYY/MM/DD.md`.
fn journal_date(source: &Path) -> Option<String> {
    let day = file_stem(source)?;
    let month = source.parent()?.file_name()?.to_str()?;
    let year = source.parent()?.parent()?.file_name()?.to_str()?;

    let date = format!("{year}-{month}-{day}");

    NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .ok()
        .map(|date| date.to_string())
}

/// The day the note was last written to.
fn modified_date(source: &Path) -> Option<String> {
    let modified = std::fs::metadata(source).ok()?.modified().ok()?;

    Some(DateTime::<Local>::from(modified).date_naive().to_string())
}

/// The post's slug: what the file is called, and where it lives under `/blog`.
fn slug(cli: &Cli, meta: &frontmatter::Meta, source: Option<&Path>, title: &str) -> Result<String> {
    let from_file = source.and_then(file_stem).map(|stem| slugify(&stem));
    // A journal entry is named after its day, which says nothing about the post; its title does better.
    let from_file = from_file.filter(|slug| !slug.chars().all(|character| character.is_ascii_digit()));

    let slug = cli
        .slug
        .clone()
        .or_else(|| meta.slug.clone())
        .map(|slug| slugify(&slug))
        .filter(|slug| !slug.is_empty())
        .or(from_file)
        .unwrap_or_else(|| slugify(title));

    if slug.is_empty() {
        bail!("could not work out a slug for this note: pass `--slug`");
    }

    Ok(slug)
}

/// Whether the post is a draft.
///
/// `--draft` and `--published` settle it, then a frontmatter `draft`, then the note's `selfnotes` status: a note that
/// has one is a draft until it reaches a published status. A note with no status at all is not a draft.
fn draft(cli: &Cli, meta: &frontmatter::Meta) -> bool {
    if cli.draft {
        return true;
    }
    if cli.published {
        return false;
    }
    if let Some(draft) = meta.draft {
        return draft;
    }

    meta.status
        .as_ref()
        .is_some_and(|status| !cli.published_statuses().contains(status))
}

/// A first paragraph cut down to a description, on a word boundary.
fn shorten(summary: &str) -> String {
    if summary.chars().count() <= DESCRIPTION_LEN {
        return summary.to_owned();
    }

    let head: String = summary.chars().take(DESCRIPTION_LEN).collect();
    let cut = head.rsplit_once(' ').map_or(head.as_str(), |(head, _)| head);

    format!("{}...", cut.trim_end_matches(['.', ',', ';', ':']))
}

fn file_stem(path: &Path) -> Option<String> {
    path.file_stem().and_then(|stem| stem.to_str()).map(ToOwned::to_owned)
}

/// Drop repeats, keeping first-seen order, case-insensitively.
fn dedup(tags: &mut Vec<String>) {
    let mut seen: Vec<String> = Vec::with_capacity(tags.len());

    tags.retain(|tag| {
        let key = tag.to_lowercase();
        if seen.contains(&key) {
            return false;
        }

        seen.push(key);
        true
    });
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use clap::Parser;

    use super::*;

    fn parsed(flags: &[&str]) -> Cli {
        let mut argv = vec!["md-to-blog-post", "note.md"];
        argv.extend_from_slice(flags);

        Cli::parse_from(argv)
    }

    fn converted(content: &str) -> Post {
        build(&parsed(&[]), Some(&PathBuf::from("notes/login-bug.md")), content).unwrap()
    }

    #[test]
    fn prefills_from_the_frontmatter() {
        let post = converted(
            "+++\ntitle = \"Login bug\"\ndate = 2026-07-13\ndescription = \"A hunt.\"\ntags = [\"work\"]\nstatus = \"doing\"\n+++\n\nThe body. #rust\n",
        );

        assert_eq!(post.slug, "login-bug");
        assert!(post.contents.contains("    title: 'Login bug',\n"));
        assert!(post.contents.contains("    date: '2026-07-13',\n"));
        assert!(post.contents.contains("    description: 'A hunt.',\n"));
        assert!(post.contents.contains("    tags: ['work', 'rust'],\n"));
        assert!(post.contents.contains("    draft: true\n"));
        assert!(post.contents.ends_with("<p>The body.</p>\n"));
    }

    #[test]
    fn falls_back_to_the_body_and_the_path() {
        let post = build(
            &parsed(&[]),
            Some(&PathBuf::from("journal/2026/07/13.md")),
            "# A day of it\n\nWhat happened.\n",
        )
        .unwrap();

        assert_eq!(post.slug, "a-day-of-it");
        assert!(post.contents.contains("    title: 'A day of it',\n"));
        assert!(post.contents.contains("    date: '2026-07-13',\n"));
        assert!(post.contents.contains("    description: 'What happened.'\n"));
        assert!(!post.contents.contains("draft"));
    }

    #[test]
    fn a_published_status_is_not_a_draft() {
        let post = converted("+++\nstatus = \"done\"\n+++\n\n# Shipped\n\nIt is out.\n");

        assert!(!post.contents.contains("draft"));
    }

    #[test]
    fn writes_the_imports_a_body_needs() {
        let post = converted("# Title\n\nA `flag` and:\n\n```rust\nfn main() {}\n```\n");

        assert!(
            post.contents
                .contains("import Code from '$lib/components/Code.svelte';")
        );
        assert!(
            post.contents
                .contains("import CodeBlock from '$lib/components/CodeBlock.svelte';")
        );
        assert!(post.contents.contains("  const snippet1 = `\n    fn main() {}\n  `;\n"));
    }

    #[test]
    fn a_plain_note_needs_no_instance_script() {
        let post = converted("# Title\n\nJust prose.\n");

        assert!(!post.contents.contains("<script lang=\"ts\">"));
    }

    #[test]
    fn refuses_a_date_that_is_not_one() {
        let options = parsed(&["--date", "13/07/2026"]);

        assert!(build(&options, None, "# Title\n\nBody.\n").is_err());
    }

    #[test]
    fn shortens_a_long_first_paragraph() {
        let long = "word ".repeat(60);
        let shortened = shorten(long.trim());

        assert!(shortened.chars().count() <= DESCRIPTION_LEN + 3);
        assert!(shortened.ends_with("..."));
    }
}
