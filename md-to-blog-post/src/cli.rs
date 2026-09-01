//! Command-line interface for `md-to-blog-post`.
//! `md-to-blog-post -h` for full usage information.

use std::path::PathBuf;

use clap::Parser;

/// Turn a `selfnotes` Markdown note into a Svelte blog post.
#[derive(Debug, Parser)]
#[command(
    name = "md-to-blog-post",
    version,
    about,
    author,
    help_template = "{name} {version}\n{author}\n{about}\n\n{usage-heading} {usage}\n\n{all-args}"
)]
#[allow(
    clippy::struct_excessive_bools,
    reason = "these are the command's flags, not a state machine"
)]
pub struct Cli {
    /// The note to convert. `-` reads Markdown from stdin.
    #[arg(value_name = "NOTE")]
    pub input: PathBuf,

    /// Where the post is written. Defaults to the `src/lib/posts` directory found by walking up from the current
    /// directory.
    #[arg(short, long, value_name = "DIR")]
    pub out_dir: Option<PathBuf>,

    /// URL slug, and so the file name. Defaults to the frontmatter `slug`, then the note's file name, then its title.
    #[arg(long, value_name = "SLUG")]
    pub slug: Option<String>,

    /// Print the post instead of writing a file.
    #[arg(long)]
    pub stdout: bool,

    /// Overwrite an existing post.
    #[arg(short, long)]
    pub force: bool,

    /// Title override. Defaults to the frontmatter `title`, then the note's first heading, then its file name.
    #[arg(long, value_name = "TITLE")]
    pub title: Option<String>,

    /// Date override, as ISO `YYYY-MM-DD`. Defaults to the frontmatter `date`, then a `YYYY/MM/DD` journal path, then
    /// the file's modification date.
    #[arg(short, long, value_name = "DATE")]
    pub date: Option<String>,

    /// Description override. Defaults to the frontmatter `description`, then the note's first paragraph.
    #[arg(long, value_name = "TEXT")]
    pub description: Option<String>,

    /// Mark the post as a draft, whatever the note's status says.
    #[arg(long, conflicts_with = "published")]
    pub draft: bool,

    /// Publish the post, whatever the note's status says.
    #[arg(long)]
    pub published: bool,

    /// A status that means the note is ready to publish; any other status makes the post a draft. Repeatable.
    /// [default: done, published]
    #[arg(long = "published-status", value_name = "STATUS")]
    pub published_statuses: Vec<String>,

    /// Keep inline `#tags` in the prose instead of lifting them into the metadata.
    #[arg(long)]
    pub keep_tags: bool,

    /// Leave tags out of the post metadata.
    #[arg(long)]
    pub no_tags: bool,

    /// Emit a plain `<code>` for inline code instead of the `Code` component.
    #[arg(long)]
    pub bare_code: bool,

    /// Length at or above which an all-hexadecimal inline `#token` is read as a git hash rather than a tag. `0` turns
    /// the heuristic off.
    #[arg(long, value_name = "N", default_value_t = 6)]
    pub hash_tag_min_len: usize,

    /// Run `pnpm exec prettier --write` on the post once it is written.
    #[arg(long)]
    pub format: bool,
}

impl Cli {
    /// The statuses that publish a note, as given or the built-in default.
    pub fn published_statuses(&self) -> Vec<String> {
        if self.published_statuses.is_empty() {
            vec!["done".to_owned(), "published".to_owned()]
        } else {
            self.published_statuses
                .iter()
                .map(|status| status.to_lowercase())
                .collect()
        }
    }
}
