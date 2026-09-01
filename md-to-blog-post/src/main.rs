//! `md-to-blog-post`: turn a `selfnotes` Markdown note into a post of this blog.
//!
//! A post here is a plain Svelte component in `src/lib/posts/` (see that folder's README). This reads a note, takes
//! its `+++` frontmatter and its `#tags` as the post's metadata, converts the body to the markup the `.prose`
//! wrapper styles, and writes `<slug>.svelte`.

mod cli;
mod frontmatter;
mod post;
mod render;
mod scan;
mod slug;

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};
use clap::Parser;

use crate::cli::Cli;

/// Where posts live, relative to the project root.
const POSTS_DIR: &str = "src/lib/posts";

fn main() -> Result<()> {
    let cli = Cli::parse();

    let (source, content) = read(&cli.input)?;
    let post = post::build(&cli, source.as_deref(), &content)?;

    if cli.stdout {
        print!("{}", post.contents);
        return Ok(());
    }

    let directory = out_dir(cli.out_dir.as_deref())?;
    let path = directory.join(format!("{}.svelte", post.slug));

    if path.exists() && !cli.force {
        bail!("{} already exists; pass `--force` to overwrite it", path.display());
    }

    std::fs::create_dir_all(&directory).with_context(|| format!("creating {}", directory.display()))?;
    std::fs::write(&path, &post.contents).with_context(|| format!("writing {}", path.display()))?;

    if cli.format {
        format(&path);
    }

    report(&path, &post);

    Ok(())
}

/// The note's path (`None` when it came from stdin) and its Markdown.
fn read(input: &Path) -> Result<(Option<PathBuf>, String)> {
    if input == Path::new("-") {
        let mut content = String::new();
        std::io::stdin()
            .read_to_string(&mut content)
            .context("reading the note from stdin")?;

        return Ok((None, content));
    }

    let content = std::fs::read_to_string(input).with_context(|| format!("reading {}", input.display()))?;

    Ok((Some(input.to_path_buf()), content))
}

/// Where to write the post: what was asked for, or the `src/lib/posts` of the project the current directory sits in.
fn out_dir(asked: Option<&Path>) -> Result<PathBuf> {
    if let Some(directory) = asked {
        return Ok(directory.to_path_buf());
    }

    let current = std::env::current_dir().context("reading the current directory")?;

    current
        .ancestors()
        .map(|ancestor| ancestor.join(POSTS_DIR))
        .find(|candidate| candidate.is_dir())
        .with_context(|| {
            format!(
                "no `{POSTS_DIR}` directory above {}: pass `--out-dir`",
                current.display()
            )
        })
}

/// Hand the written post to Prettier, so it matches everything else in the repository.
///
/// A missing or failing Prettier is reported and no more: the post is already on disk, and formatting it is a
/// convenience.
fn format(path: &Path) {
    let formatted = Command::new("pnpm")
        .args(["exec", "prettier", "--write"])
        .arg(path)
        .current_dir(path.parent().unwrap_or_else(|| Path::new(".")))
        .status();

    match formatted {
        Ok(status) if status.success() => {},
        Ok(status) => eprintln!("warning: prettier exited with {status}"),
        Err(error) => eprintln!("warning: could not run prettier: {error}"),
    }
}

/// What the run did, and what is left to look at.
fn report(path: &Path, post: &post::Post) {
    println!("{}", path.display());
    println!("  /blog/{}{}", post.slug, if post.draft { "  (draft)" } else { "" });

    if !post.tags.is_empty() {
        println!("  tags: {}", post.tags.join(", "));
    }

    if post.html_blocks > 0 {
        eprintln!(
            "warning: {} raw HTML block(s) were written through as they stand; check they still compile as Svelte",
            post.html_blocks
        );
    }
}
