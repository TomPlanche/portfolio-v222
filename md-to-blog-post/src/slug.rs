//! Turning a name into a URL slug, which on this blog is also the post's file name.

/// A lowercase, hyphen-separated slug: letters and digits survive, everything else becomes a single `-`.
///
/// A `folder/name` qualifier, as a `[[wikilink]]` may carry, keeps only its last segment: the blog is flat.
pub fn slugify(name: &str) -> String {
    let last = name.rsplit('/').next().unwrap_or(name);

    let mut slug = String::with_capacity(last.len());
    for character in last.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
        } else if character.is_alphanumeric() {
            slug.push(character);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }

    slug.trim_matches('-').to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugifies() {
        assert_eq!(slugify("Login bug investigation"), "login-bug-investigation");
        assert_eq!(slugify("tickets/PROJ-1"), "proj-1");
        assert_eq!(slugify("  --Hello, world!  "), "hello-world");
        assert_eq!(slugify("13"), "13");
    }
}
