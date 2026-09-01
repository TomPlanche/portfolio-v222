//! Markdown to Svelte markup.
//!
//! The blog has no Markdown layer: a post is a Svelte component whose body is semantic HTML, rendered inside the
//! `.prose` wrapper of `src/routes/blog/[slug]/+page.svelte`. So this is a small HTML writer over the
//! `pulldown-cmark` event stream, with three deliberate departures from a plain HTML renderer:
//!
//! - `{` and `}` are escaped, since in Svelte markup they open an expression.
//! - Inline HTML is escaped rather than passed through: a `<T>` written in prose is a broken Svelte element, not a
//!   tag. A whole HTML block, which is always deliberate, is passed through and reported.
//! - A fenced code block becomes a `CodeBlock` component, its snippet hoisted into a `const` in the instance script.
//! - Inline code becomes the `Code` component (`--bare-code` keeps a plain `<code>`).
//!
//! The post page renders the title itself, so a leading `# Heading` is taken as the post's title rather than
//! written into the body. Later headings keep their level, except an `h1`, which is demoted to `h2` to leave the
//! page with a single top-level heading.

use std::fmt::Write as _;

use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};

/// A fenced code block, lifted out of the prose into a `const` the markup refers to.
#[derive(Debug, PartialEq, Eq)]
pub struct Snippet {
    /// The `const` this snippet is bound to, e.g. `snippet1`.
    pub name: String,
    /// The code itself, as written in the note.
    pub code: String,
    /// The fence's language, lowercased. `CodeBlock` renders an unknown one as plain text.
    pub lang: Option<String>,
    /// A file name for the block's header bar.
    pub filename: Option<String>,
    /// Show the line-number gutter.
    pub lines: bool,
    /// Lines to call out, e.g. `"3"`, `"3,7"`, `"7-9"`.
    pub mark: Option<String>,
    /// Number the first line as something other than 1.
    pub start_line: Option<u32>,
    /// Offer the copy button.
    pub copy: bool,
}

/// Everything the converter needs out of a note's body.
#[derive(Debug, Default)]
#[allow(
    clippy::struct_excessive_bools,
    reason = "each flag is a `CodeBlock` prop, and they are independent"
)]
pub struct Rendered {
    /// The post's body, as Svelte markup.
    pub markup: String,
    /// The code blocks the markup refers to, in the order they appear.
    pub snippets: Vec<Snippet>,
    /// The leading `# Heading`, which the page renders as the post's title instead of the body doing so.
    pub title: Option<String>,
    /// The first paragraph as plain text, which stands in for a missing `description`.
    pub summary: Option<String>,
    /// Whether the markup uses the `Code` component, and so has to import it.
    pub uses_code: bool,
    /// How many raw HTML blocks were passed through, which are the post's to make compile.
    pub html_blocks: usize,
}

/// Convert a note's body to the markup of a post.
pub fn render(markdown: &str, bare_code: bool) -> Rendered {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);

    let mut renderer = Renderer::new(bare_code);
    for event in Parser::new_ext(markdown, options) {
        renderer.event(&event);
    }

    renderer.finish()
}

/// Where the text of an event goes: into the markup, or into something being collected instead.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Sink {
    Markup,
    /// The leading `# Heading`, kept as the post's title and left out of the body.
    Title,
    /// An image's `alt`, which is markup in Markdown but an attribute in HTML.
    Alt,
    /// A fenced code block's snippet.
    Code,
}

#[allow(
    clippy::struct_excessive_bools,
    reason = "the flags are independent bits of state, not a state machine"
)]
struct Renderer {
    out: String,
    indent: usize,
    bare_code: bool,
    sink: Sink,
    buffer: String,
    /// Set once the first heading has been considered, whether or not it became the title.
    heading_seen: bool,
    title: Option<String>,
    summary: Option<String>,
    /// Collecting the first paragraph's text, for the summary.
    summarising: bool,
    snippets: Vec<Snippet>,
    fence: Fence,
    html_blocks: usize,
    /// The `src` and `title` of the image whose `alt` is being collected.
    image: Option<(String, String)>,
    uses_code: bool,
}

impl Renderer {
    fn new(bare_code: bool) -> Self {
        Self {
            out: String::new(),
            indent: 0,
            bare_code,
            sink: Sink::Markup,
            buffer: String::new(),
            heading_seen: false,
            title: None,
            summary: None,
            summarising: false,
            snippets: Vec::new(),
            fence: Fence::default(),
            html_blocks: 0,
            image: None,
            uses_code: false,
        }
    }

    fn finish(mut self) -> Rendered {
        while self.out.ends_with('\n') {
            self.out.pop();
        }
        self.out.push('\n');

        Rendered {
            markup: self.out,
            snippets: self.snippets,
            title: self.title,
            summary: self.summary,
            uses_code: self.uses_code,
            html_blocks: self.html_blocks,
        }
    }

    fn event(&mut self, event: &Event<'_>) {
        match event {
            Event::Start(tag) => self.start(tag),
            Event::End(tag) => self.end(*tag),
            Event::Text(text) => self.text(text),
            Event::Code(code) => self.inline_code(code),
            // A block of HTML is deliberate, so it is written as it stands; `html_blocks` has the run report it.
            Event::Html(html) => self.raw(html),
            // Inline HTML rarely is: `Vec<T>` in prose reads as a tag here, and would compile as an element there.
            Event::InlineHtml(html) => self.text(html),
            Event::SoftBreak => self.raw(" "),
            Event::HardBreak => self.raw("<br />"),
            Event::Rule => self.line("<hr />"),
            Event::TaskListMarker(checked) => {
                self.raw(if *checked {
                    "<input type=\"checkbox\" checked disabled /> "
                } else {
                    "<input type=\"checkbox\" disabled /> "
                });
            },
            _ => {},
        }
    }

    fn start(&mut self, tag: &Tag<'_>) {
        match tag {
            Tag::Paragraph => {
                self.line("<p>");
                if self.summary.is_none() && !self.summarising {
                    self.summarising = true;
                    self.buffer.clear();
                }
            },
            Tag::Heading { level, .. } => self.start_heading(*level),
            Tag::BlockQuote(_) => self.open("<blockquote>"),
            Tag::CodeBlock(kind) => {
                self.fence = match kind {
                    CodeBlockKind::Fenced(info) => Fence::parse(info),
                    CodeBlockKind::Indented => Fence::default(),
                };
                self.sink = Sink::Code;
                self.buffer.clear();
            },
            Tag::List(Some(1)) => self.open("<ol>"),
            Tag::List(Some(start)) => self.open(&format!("<ol start={{{start}}}>")),
            Tag::List(None) => self.open("<ul>"),
            Tag::Item => self.line("<li>"),
            Tag::Emphasis => self.raw("<em>"),
            Tag::Strong => self.raw("<strong>"),
            Tag::Strikethrough => self.raw("<s>"),
            Tag::Link { dest_url, title, .. } => {
                let title = attribute("title", title);
                self.raw(&format!("<a href=\"{}\"{title}>", escape_attr(dest_url)));
            },
            Tag::Image { dest_url, title, .. } => {
                self.image = Some((dest_url.to_string(), title.to_string()));
                self.sink = Sink::Alt;
                self.buffer.clear();
            },
            Tag::HtmlBlock => {
                self.html_blocks += 1;
                self.line("");
            },
            Tag::Table(_) => self.open("<table>"),
            Tag::TableHead => self.open("<thead>"),
            Tag::TableRow => self.open("<tr>"),
            Tag::TableCell => self.line("<td>"),
            _ => {},
        }
    }

    fn end(&mut self, tag: TagEnd) {
        match tag {
            TagEnd::Paragraph => {
                self.raw("</p>");
                if self.summarising {
                    self.summarising = false;
                    let summary = self.buffer.split_whitespace().collect::<Vec<_>>().join(" ");
                    self.summary = (!summary.is_empty()).then_some(summary);
                    self.buffer.clear();
                }
            },
            TagEnd::Heading(level) => self.end_heading(level),
            TagEnd::BlockQuote(_) => self.close("</blockquote>"),
            TagEnd::CodeBlock => self.end_code_block(),
            TagEnd::List(ordered) => self.close(if ordered { "</ol>" } else { "</ul>" }),
            TagEnd::Item => self.raw("</li>"),
            TagEnd::Emphasis => self.raw("</em>"),
            TagEnd::Strong => self.raw("</strong>"),
            TagEnd::Strikethrough => self.raw("</s>"),
            TagEnd::Link => self.raw("</a>"),
            TagEnd::Image => self.end_image(),
            TagEnd::Table => self.close("</table>"),
            TagEnd::TableHead => self.close("</thead>"),
            TagEnd::TableRow => self.close("</tr>"),
            TagEnd::TableCell => self.raw("</td>"),
            _ => {},
        }
    }

    fn start_heading(&mut self, level: HeadingLevel) {
        // The page prints the post's title above the prose, so the note's own `# Title` is metadata, not body.
        if !self.heading_seen && level == HeadingLevel::H1 {
            self.sink = Sink::Title;
            self.buffer.clear();
            return;
        }

        self.heading_seen = true;
        self.line(&format!("<{}>", heading_tag(level)));
    }

    fn end_heading(&mut self, level: HeadingLevel) {
        if self.sink == Sink::Title {
            self.sink = Sink::Markup;
            self.heading_seen = true;

            let title = self.buffer.trim();
            self.title = (!title.is_empty()).then(|| title.to_owned());
            self.buffer.clear();
            return;
        }

        self.raw(&format!("</{}>", heading_tag(level)));
    }

    fn end_code_block(&mut self) {
        self.sink = Sink::Markup;

        let code = self.buffer.trim_end_matches('\n').to_owned();
        self.buffer.clear();

        let fence = std::mem::take(&mut self.fence);
        let name = fence
            .name
            .clone()
            .unwrap_or_else(|| format!("snippet{}", self.snippets.len() + 1));
        let name = self.unique_name(name);

        self.line(&code_block_markup(&name, &fence));

        self.snippets.push(Snippet {
            name,
            code,
            lang: fence.lang,
            filename: fence.filename,
            lines: fence.lines,
            mark: fence.mark,
            start_line: fence.start_line,
            copy: fence.copy,
        });
    }

    /// `name`, or `name2`, `name3`... when an earlier block already claimed it.
    fn unique_name(&self, name: String) -> String {
        if !self.snippets.iter().any(|snippet| snippet.name == name) {
            return name;
        }

        for suffix in 2.. {
            let candidate = format!("{name}{suffix}");
            if !self.snippets.iter().any(|snippet| snippet.name == candidate) {
                return candidate;
            }
        }

        name
    }

    fn end_image(&mut self) {
        self.sink = Sink::Markup;

        let alt = std::mem::take(&mut self.buffer);
        let (src, title) = self.image.take().unwrap_or_default();

        self.raw(&format!(
            "<img src=\"{}\" alt=\"{}\"{} />",
            escape_attr(&src),
            escape_attr(&alt),
            attribute("title", &title)
        ));
    }

    fn text(&mut self, text: &str) {
        match self.sink {
            Sink::Markup => {
                if self.summarising {
                    self.buffer.push_str(text);
                }
                let escaped = escape_text(text);
                self.out.push_str(&escaped);
            },
            Sink::Title | Sink::Alt | Sink::Code => self.buffer.push_str(text),
        }
    }

    fn inline_code(&mut self, code: &str) {
        if self.sink != Sink::Markup {
            self.buffer.push_str(code);
            return;
        }

        if self.summarising {
            self.buffer.push_str(code);
        }

        let escaped = escape_text(code);
        if self.bare_code {
            let _ = write!(self.out, "<code>{escaped}</code>");
        } else {
            self.uses_code = true;
            let _ = write!(self.out, "<Code>{escaped}</Code>");
        }
    }

    /// Markup written through as it stands: the note's own HTML, and the tags this renderer emits.
    fn raw(&mut self, markup: &str) {
        if self.sink == Sink::Markup {
            self.out.push_str(markup);
        }
    }

    /// A block element on a line of its own, at the current depth. Top-level blocks are spaced out, as they are in
    /// the posts written by hand.
    fn line(&mut self, markup: &str) {
        self.write_line(markup, self.indent == 0);
    }

    /// A container's opening tag, on its own line, with everything after it a level deeper.
    fn open(&mut self, markup: &str) {
        self.line(markup);
        self.indent += 1;
    }

    /// A container's closing tag, back at the container's own depth. It belongs to the block it closes, so it never
    /// takes a blank line of its own.
    fn close(&mut self, markup: &str) {
        self.indent = self.indent.saturating_sub(1);
        self.write_line(markup, false);
    }

    fn write_line(&mut self, markup: &str, spaced: bool) {
        if self.sink != Sink::Markup {
            return;
        }

        if !self.out.is_empty() {
            if !self.out.ends_with('\n') {
                self.out.push('\n');
            }
            if spaced && !self.out.ends_with("\n\n") {
                self.out.push('\n');
            }
        }

        for _ in 0..self.indent {
            self.out.push_str("  ");
        }
        self.out.push_str(markup);
    }
}

/// The `CodeBlock` element for a snippet bound to `name`.
fn code_block_markup(name: &str, fence: &Fence) -> String {
    let mut markup = format!("<CodeBlock code={{{name}}}");

    if let Some(lang) = &fence.lang {
        let _ = write!(markup, " lang=\"{}\"", escape_attr(lang));
    }
    if let Some(filename) = &fence.filename {
        let _ = write!(markup, " filename=\"{}\"", escape_attr(filename));
    }
    if fence.lines {
        markup.push_str(" lines");
    }
    if let Some(mark) = &fence.mark {
        let _ = write!(markup, " mark=\"{}\"", escape_attr(mark));
    }
    if let Some(start_line) = fence.start_line {
        let _ = write!(markup, " startLine={{{start_line}}}");
    }
    if !fence.copy {
        markup.push_str(" copy={false}");
    }

    markup.push_str(" />");
    markup
}

const fn heading_tag(level: HeadingLevel) -> &'static str {
    match level {
        // The page already owns the page's `h1`, so a second one in the body is demoted rather than duplicated.
        HeadingLevel::H1 | HeadingLevel::H2 => "h2",
        HeadingLevel::H3 => "h3",
        HeadingLevel::H4 => "h4",
        HeadingLevel::H5 => "h5",
        HeadingLevel::H6 => "h6",
    }
}

/// An optional HTML attribute, empty when the value is.
fn attribute(name: &str, value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    format!(" {name}=\"{}\"", escape_attr(value))
}

/// A fence's info string, read as `CodeBlock`'s props.
///
/// The first word is the language. After it: `lines` and `no-copy` as bare flags, `mark=`, `start=`, `name=` and
/// `filename=` as pairs, and a bare word holding a `.` or a `/` as the file name, so ```` ```rust src/main.rs ```` is
/// enough for a titled block.
#[derive(Debug, Default, PartialEq, Eq)]
struct Fence {
    lang: Option<String>,
    filename: Option<String>,
    lines: bool,
    mark: Option<String>,
    start_line: Option<u32>,
    copy: bool,
    name: Option<String>,
}

impl Fence {
    fn parse(info: &str) -> Self {
        let mut fence = Self {
            copy: true,
            ..Self::default()
        };

        for (index, token) in tokenise(info).into_iter().enumerate() {
            if index == 0 && !token.contains('=') {
                fence.lang = Some(token.to_lowercase());
                continue;
            }

            match token.split_once('=') {
                Some((key, value)) => {
                    let value = value.to_owned();
                    match key {
                        "file" | "filename" | "title" => fence.filename = Some(value),
                        "mark" | "highlight" => fence.mark = Some(value),
                        "start" | "startLine" | "start-line" => fence.start_line = value.parse().ok(),
                        "name" | "const" => fence.name = Some(value),
                        "copy" => fence.copy = value != "false",
                        "lines" => fence.lines = value != "false",
                        _ => {},
                    }
                },
                None => match token.as_str() {
                    "lines" | "linenumbers" | "line-numbers" => fence.lines = true,
                    "no-copy" | "nocopy" => fence.copy = false,
                    _ if token.contains('.') || token.contains('/') => fence.filename = Some(token),
                    _ => {},
                },
            }
        }

        fence
    }
}

/// Split an info string on whitespace, except inside quotes, so a value can hold spaces:
/// `json filename="the device the bot pretends to be"`. The quotes themselves are dropped.
fn tokenise(info: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut quote = None;

    for character in info.chars() {
        if let Some(open) = quote {
            if character == open {
                quote = None;
            } else {
                current.push(character);
            }
        } else if character == '"' || character == '\'' {
            quote = Some(character);
            quoted = true;
        } else if character.is_whitespace() {
            if quoted || !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
                quoted = false;
            }
        } else {
            current.push(character);
        }
    }

    if quoted || !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

/// Text, safe to drop into Svelte markup: HTML's own three, plus the braces that would open an expression.
pub fn escape_text(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());

    for character in text.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '{' => escaped.push_str("&#123;"),
            '}' => escaped.push_str("&#125;"),
            _ => escaped.push(character),
        }
    }

    escaped
}

/// The same, inside a double-quoted attribute.
pub fn escape_attr(text: &str) -> String {
    escape_text(text).replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn markup(markdown: &str) -> String {
        render(markdown, false).markup
    }

    #[test]
    fn takes_the_leading_heading_as_the_title() {
        let out = render("# Login bug\n\nA hunt.\n", false);

        assert_eq!(out.title.as_deref(), Some("Login bug"));
        assert_eq!(out.markup, "<p>A hunt.</p>\n");
        assert_eq!(out.summary.as_deref(), Some("A hunt."));
    }

    #[test]
    fn keeps_later_headings_and_demotes_a_second_h1() {
        let out = markup("# Title\n\n## Section\n\n# Another top level\n\n### Deeper\n");

        assert_eq!(
            out,
            "<h2>Section</h2>\n\n<h2>Another top level</h2>\n\n<h3>Deeper</h3>\n"
        );
    }

    #[test]
    fn passes_an_html_block_through() {
        let out = render("<figure>\n  <img src=\"a.png\" alt=\"\" />\n</figure>\n", false);

        assert!(out.markup.contains("<figure>"));
        assert_eq!(out.html_blocks, 1);
    }

    #[test]
    fn escapes_what_svelte_would_read_as_markup() {
        assert_eq!(
            markup("A `{ \"a\": 1 }` object & a <tag>.\n"),
            "<p>A <Code>&#123; \"a\": 1 &#125;</Code> object &amp; a &lt;tag&gt;.</p>\n"
        );
    }

    #[test]
    fn lifts_a_fence_into_a_code_block() {
        let out = render(
            "```rust src/main.rs lines mark=2 start=10 no-copy\nfn main() {}\n```\n",
            false,
        );

        assert_eq!(
            out.markup,
            "<CodeBlock code={snippet1} lang=\"rust\" filename=\"src/main.rs\" lines mark=\"2\" startLine={10} copy={false} />\n"
        );
        assert_eq!(out.snippets[0].code, "fn main() {}");
        assert_eq!(out.snippets[0].name, "snippet1");
    }

    #[test]
    fn a_quoted_fence_value_may_hold_spaces() {
        let out = render(
            "```json filename=\"the device the bot pretends to be\"\n{}\n```\n",
            false,
        );

        assert_eq!(
            out.markup,
            "<CodeBlock code={snippet1} lang=\"json\" filename=\"the device the bot pretends to be\" />\n"
        );
    }

    #[test]
    fn writes_lists_quotes_and_rules() {
        let out = markup("- one\n- two\n\n> quoted\n\n---\n\n1. first\n");

        assert_eq!(
            out,
            "<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>\n\n<blockquote>\n  <p>quoted</p>\n</blockquote>\n\n<hr />\n\n<ol>\n  <li>first</li>\n</ol>\n"
        );
    }

    #[test]
    fn bare_code_skips_the_component() {
        let out = render("A `flag`.\n", true);

        assert_eq!(out.markup, "<p>A <code>flag</code>.</p>\n");
        assert!(!out.uses_code);
    }
}
