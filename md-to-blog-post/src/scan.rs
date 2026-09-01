//! A code-aware pass over a note's body, before any Markdown parsing.
//!
//! It does the two things `selfnotes` conventions ask for and Markdown knows nothing about: it lifts inline `#tags`
//! out of the prose (they belong in the post's metadata, not in a paragraph), and it rewrites `[[wikilinks]]` into
//! ordinary Markdown links to the matching post.
//!
//! Fenced code blocks and inline code spans are copied through untouched, so a `#define` in a snippet is not a tag
//! and `[[i]]` in an array index is not a link, exactly as `selfnotes` reads them.

use crate::slug::slugify;

/// A note's body after the pass, and the tags found in it.
#[derive(Debug, PartialEq, Eq)]
pub struct Scanned {
    /// The body, with wikilinks rewritten and (unless kept) inline tags removed.
    pub markdown: String,
    /// The inline tags, de-duplicated in first-seen order, without their leading `#`.
    pub tags: Vec<String>,
}

/// Scan a note's body.
///
/// `hash_min_len` is the length at or above which an all-hexadecimal `#token` is read as a git hash and skipped
/// rather than collected as a tag; `0` disables that heuristic. `keep_tags` leaves the tags in the prose, and still
/// collects them.
pub fn scan(body: &str, hash_min_len: usize, keep_tags: bool) -> Scanned {
    let mut markdown = String::with_capacity(body.len());
    let mut tags: Vec<String> = Vec::new();
    let mut fence: Option<(char, usize)> = None;
    let mut code_span: Option<usize> = None;

    for line in body.split_inclusive('\n') {
        if let Some((character, width)) = fence {
            markdown.push_str(line);
            if closes_fence(line, character, width) {
                fence = None;
            }
            continue;
        }

        if code_span.is_none()
            && let Some(opened) = opens_fence(line)
        {
            fence = Some(opened);
            markdown.push_str(line);
            continue;
        }

        let (scanned, removed) = scan_line(line, hash_min_len, keep_tags, &mut code_span, &mut tags);

        if removed {
            // A line left holding nothing but the tags it carried is dropped rather than left blank, which would
            // split the paragraph it sat in.
            if scanned.trim().is_empty() {
                continue;
            }

            let trimmed = scanned.trim_end_matches([' ', '\t']);
            markdown.push_str(trimmed);
            markdown.push_str(&scanned[trimmed.len()..]);
        } else {
            markdown.push_str(&scanned);
        }
    }

    dedup(&mut tags);

    Scanned { markdown, tags }
}

/// One line of prose, with tags lifted and wikilinks rewritten, plus whether any tag was removed from it.
fn scan_line(
    line: &str,
    hash_min_len: usize,
    keep_tags: bool,
    code_span: &mut Option<usize>,
    tags: &mut Vec<String>,
) -> (String, bool) {
    let chars: Vec<char> = line.chars().collect();
    let mut out = String::with_capacity(line.len());
    let mut removed = false;
    let mut index = 0;

    while index < chars.len() {
        let character = chars[index];

        if let Some(width) = *code_span {
            if character == '`' {
                let run = run_len(&chars, index, '`');
                out.extend(chars[index..index + run].iter());
                if run == width {
                    *code_span = None;
                }
                index += run;
                continue;
            }

            out.push(character);
            index += 1;
            continue;
        }

        if character == '`' {
            let run = run_len(&chars, index, '`');
            out.extend(chars[index..index + run].iter());
            *code_span = Some(run);
            index += run;
            continue;
        }

        if character == '['
            && chars.get(index + 1) == Some(&'[')
            && let Some((markup, next)) = wikilink(&chars, index)
        {
            out.push_str(&markup);
            index = next;
            continue;
        }

        if character == '#'
            && (index == 0 || chars[index - 1].is_whitespace())
            && let Some((tag, next)) = read_tag(&chars, index, hash_min_len)
        {
            tags.push(tag);

            if keep_tags {
                out.extend(chars[index..next].iter());
            } else {
                removed = true;
                // Swallow the space that introduced the tag, so removing it does not leave a double space behind.
                if out.ends_with(' ') && chars.get(next).is_none_or(|after| after.is_whitespace()) {
                    out.pop();
                }
            }

            index = next;
            continue;
        }

        out.push(character);
        index += 1;
    }

    (out, removed)
}

/// The `#tag` starting at `start`, and where it ends, or `None` when what follows the `#` is not a tag.
///
/// A tag starts with a letter or `_` (so `#123` is an issue reference, not a tag) and runs over letters, digits,
/// `_`, `-` and `/`. An all-hexadecimal token of at least `hash_min_len` characters is a git hash, not a tag.
fn read_tag(chars: &[char], start: usize, hash_min_len: usize) -> Option<(String, usize)> {
    let first = *chars.get(start + 1)?;
    if !first.is_alphabetic() && first != '_' {
        return None;
    }

    let mut end = start + 1;
    while end < chars.len() && is_tag_char(chars[end]) {
        end += 1;
    }

    // Trailing separators read as punctuation rather than as part of the tag, so `#work/` tags `work`.
    let raw: String = chars[start + 1..end].iter().collect();
    let tag = raw.trim_end_matches(['/', '-']).to_owned();
    if tag.is_empty() {
        return None;
    }

    if hash_min_len > 0
        && tag.chars().count() >= hash_min_len
        && tag.chars().all(|character| character.is_ascii_hexdigit())
    {
        return None;
    }

    let end = start + 1 + tag.chars().count();

    Some((tag, end))
}

fn is_tag_char(character: char) -> bool {
    character.is_alphanumeric() || matches!(character, '_' | '-' | '/')
}

/// The `[[wikilink]]` starting at `start` as a Markdown link, and where it ends.
///
/// `[[target|shown text]]` keeps its display text; a `folder/name` target keeps only its name, since the blog is
/// flat. The link points at `/blog/<slug>`, which is where the converted note lives.
fn wikilink(chars: &[char], start: usize) -> Option<(String, usize)> {
    let mut end = start + 2;
    while end + 1 < chars.len() && !(chars[end] == ']' && chars[end + 1] == ']') {
        end += 1;
    }
    if end + 1 >= chars.len() || chars[end] != ']' || chars[end + 1] != ']' {
        return None;
    }

    let inner: String = chars[start + 2..end].iter().collect();
    if inner.contains('[') {
        return None;
    }

    let (target, label) = match inner.split_once('|') {
        Some((target, label)) => (target.trim(), label.trim()),
        None => (inner.trim(), inner.trim()),
    };

    let slug = slugify(target);
    if slug.is_empty() || label.is_empty() {
        return None;
    }

    Some((format!("[{label}](/blog/{slug})"), end + 2))
}

/// How many `character`s run from `start`.
fn run_len(chars: &[char], start: usize, character: char) -> usize {
    chars[start..].iter().take_while(|found| **found == character).count()
}

/// Whether `line` opens a fenced code block, and with what fence.
fn opens_fence(line: &str) -> Option<(char, usize)> {
    let trimmed = line.trim_start_matches(' ');
    if line.len() - trimmed.len() > 3 {
        return None;
    }

    let character = trimmed.chars().next()?;
    if character != '`' && character != '~' {
        return None;
    }

    let width = trimmed.chars().take_while(|found| *found == character).count();

    (width >= 3).then_some((character, width))
}

/// Whether `line` closes a fence of `width` `character`s: the same fence character, at least as long, nothing else.
fn closes_fence(line: &str, character: char, width: usize) -> bool {
    let trimmed = line.trim_start_matches(' ').trim_end();

    trimmed.chars().count() >= width && trimmed.chars().all(|found| found == character)
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
    use super::*;

    fn scanned(body: &str) -> Scanned {
        scan(body, 6, false)
    }

    #[test]
    fn lifts_inline_tags_out_of_the_prose() {
        let out = scanned("Fixed the login bug today. #work #sprint-42\n");

        assert_eq!(out.markdown, "Fixed the login bug today.\n");
        assert_eq!(out.tags, vec!["work".to_owned(), "sprint-42".to_owned()]);
    }

    #[test]
    fn keeps_tags_when_asked() {
        let out = scan("Shipped. #work\n", 6, true);

        assert_eq!(out.markdown, "Shipped. #work\n");
        assert_eq!(out.tags, vec!["work".to_owned()]);
    }

    #[test]
    fn a_line_of_nothing_but_tags_goes_away() {
        let out = scanned("A paragraph.\n#work #idea\nStill the same paragraph.\n");

        assert_eq!(out.markdown, "A paragraph.\nStill the same paragraph.\n");
    }

    #[test]
    fn headings_hashes_and_hashes_in_code_are_not_tags() {
        let out = scanned("# Title\n\n```sh\n# not a tag\n```\n\nA `#notatag` span, and page#anchor.\n");

        assert!(out.tags.is_empty());
        assert_eq!(
            out.markdown,
            "# Title\n\n```sh\n# not a tag\n```\n\nA `#notatag` span, and page#anchor.\n"
        );
    }

    #[test]
    fn issue_references_and_git_hashes_are_not_tags() {
        let out = scanned("See #123, fixed in #deadbeef. #facade stays a tag at length 7.\n");

        assert!(out.tags.is_empty());
    }

    #[test]
    fn nested_tags_and_trailing_punctuation() {
        let out = scanned("Tagged #work/project, and #idea.\n");

        assert_eq!(out.tags, vec!["work/project".to_owned(), "idea".to_owned()]);
        assert_eq!(out.markdown, "Tagged , and .\n");
    }

    #[test]
    fn rewrites_wikilinks() {
        let out = scanned("Related: [[login-bug]] and [[tickets/PROJ-1|the ticket]].\n");

        assert_eq!(
            out.markdown,
            "Related: [login-bug](/blog/login-bug) and [the ticket](/blog/proj-1).\n"
        );
    }

    #[test]
    fn leaves_wikilinks_in_code_alone() {
        let out = scanned("Use `items[[0]]` and\n\n```rust\nlet x = v[[0]];\n```\n");

        assert_eq!(out.markdown, "Use `items[[0]]` and\n\n```rust\nlet x = v[[0]];\n```\n");
    }

    #[test]
    fn de_duplicates_tags() {
        let out = scanned("#work here, #Work there.\n");

        assert_eq!(out.tags, vec!["work".to_owned()]);
    }
}
