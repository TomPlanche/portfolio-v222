//! The `+++`-delimited TOML frontmatter a `selfnotes` note carries, read with the same rules `selfnotes` reads it
//! with: the fence must open on the very first line and close on a line that is exactly `+++`, and unknown keys are
//! ignored.
//!
//! `selfnotes` writes `tags`, `status`, `title` and `aliases`; a note headed for the blog may add `date`,
//! `description`, `slug` and `draft`. Everything is optional, and everything can be overridden from the CLI.

use anyhow::{Context, Result};
use toml::{Table, Value};

/// What a note's frontmatter says about the post it becomes.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Meta {
    /// `title`, trimmed. `None` when unset or blank.
    pub title: Option<String>,
    /// `date`, as written. A bare TOML date (`date = 2026-07-13`) reads the same as a quoted one.
    pub date: Option<String>,
    /// `description`, trimmed. `None` when unset or blank.
    pub description: Option<String>,
    /// `slug`, trimmed. `None` when unset or blank.
    pub slug: Option<String>,
    /// `status`, trimmed and lowercased. `None` when unset or blank.
    pub status: Option<String>,
    /// `tags`, trimmed, without their leading `#`, blanks dropped.
    pub tags: Vec<String>,
    /// `draft`, which settles the question on its own when set.
    pub draft: Option<bool>,
}

/// Split a leading `+++`-delimited TOML frontmatter block from the body.
///
/// The frontmatter must open on the very first line (`+++`) and close on a later line that is exactly `+++`. Anything
/// else (no fence, or an unterminated one) is treated as having no frontmatter, and the whole input is the body.
pub fn split(content: &str) -> (Option<&str>, &str) {
    let mut lines = content.split_inclusive('\n');

    let Some(first) = lines.next() else {
        return (None, content);
    };
    if first.trim_end() != "+++" {
        return (None, content);
    }

    let fm_start = first.len();
    let mut offset = fm_start;

    for line in lines {
        if line.trim_end() == "+++" {
            return (Some(&content[fm_start..offset]), &content[offset + line.len()..]);
        }

        offset += line.len();
    }

    // Opening fence with no close: not valid frontmatter, so keep everything as the body.
    (None, content)
}

/// Read a frontmatter block. A block that is not valid TOML is an error rather than a guess, as in `selfnotes`.
pub fn parse(frontmatter: &str) -> Result<Meta> {
    let table: Table = frontmatter
        .parse()
        .context("the note's `+++` frontmatter is not valid TOML")?;

    Ok(Meta {
        title: string(&table, "title"),
        date: string(&table, "date"),
        description: string(&table, "description"),
        slug: string(&table, "slug"),
        status: string(&table, "status").map(|status| status.to_lowercase()),
        tags: tags(&table),
        draft: table.get("draft").and_then(Value::as_bool),
    })
}

/// A string-ish value, trimmed. A TOML date or datetime reads as the text it was written with, so
/// `date = 2026-07-13` and `date = "2026-07-13"` are the same thing here.
fn string(table: &Table, key: &str) -> Option<String> {
    let value = match table.get(key)? {
        Value::String(text) => text.trim().to_owned(),
        Value::Datetime(stamp) => stamp.to_string(),
        _ => return None,
    };

    (!value.is_empty()).then_some(value)
}

/// The `tags` array, trimmed, without a leading `#`, blanks dropped. A non-array `tags` contributes nothing.
fn tags(table: &Table) -> Vec<String> {
    let Some(Value::Array(values)) = table.get("tags") else {
        return Vec::new();
    };

    values
        .iter()
        .filter_map(Value::as_str)
        .map(|tag| tag.trim().trim_start_matches('#').to_owned())
        .filter(|tag| !tag.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_a_fenced_block() {
        let (fm, body) = split("+++\ntags = [\"work\"]\n+++\n\n# Title\n");

        assert_eq!(fm, Some("tags = [\"work\"]\n"));
        assert_eq!(body, "\n# Title\n");
    }

    #[test]
    fn a_missing_or_unterminated_fence_is_all_body() {
        assert_eq!(split("# Title\n"), (None, "# Title\n"));
        assert_eq!(split("+++\ntags = []\n\nbody\n").0, None);
    }

    #[test]
    fn reads_the_keys_a_post_needs() {
        let meta = parse(
            "title = \"Login bug\"\ndate = 2026-07-13\ndescription = \"  A hunt.  \"\nstatus = \"Done\"\ntags = [\"work\", \"#bug/auth\", \" \"]\naliases = [\"x\"]\n",
        )
        .unwrap();

        assert_eq!(
            meta,
            Meta {
                title: Some("Login bug".to_owned()),
                date: Some("2026-07-13".to_owned()),
                description: Some("A hunt.".to_owned()),
                slug: None,
                status: Some("done".to_owned()),
                tags: vec!["work".to_owned(), "bug/auth".to_owned()],
                draft: None,
            }
        );
    }

    #[test]
    fn broken_toml_is_refused() {
        assert!(parse("tags = [\n").is_err());
    }
}
