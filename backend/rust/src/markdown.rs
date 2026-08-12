//! Markdown 渲染 + XSS 过滤。
//! 对齐 backend/src/services/markdown.ts：
//! - marked gfm:true（表格/删除线/任务列表/脚注）→ pulldown-cmark ENABLE_GFM + 各分项
//!   注：pulldown-cmark 0.13 的 ENABLE_GFM 仅含 blockquote 标签等杂项，需显式开启
//!   ENABLE_TABLES/FOOTNOTES/STRIKETHROUGH/TASKLISTS；marked 的裸 URL 自动链接无对应项（偏差记录）
//! - 代码块：`<pre data-language="x"><code class="hljs language-x">…</code></pre>`
//!   （syntect 高亮暂缓，先做转义，标签形态与旧后端一致）
//! - sanitize-html 白名单 → ammonia（a/img/pre/code/span 属性白名单，img 允许 data: scheme；
//!   script/style 内容移除对齐 sanitize-html 默认 nonTextTags）

use ammonia::Builder as SanitizerBuilder;
use ammonia::UrlRelative;
use pulldown_cmark::{CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};

const MARKDOWN_OPTIONS: Options = Options::ENABLE_GFM
    .union(Options::ENABLE_TABLES)
    .union(Options::ENABLE_FOOTNOTES)
    .union(Options::ENABLE_STRIKETHROUGH)
    .union(Options::ENABLE_TASKLISTS);

/// 渲染 markdown 为安全 HTML（对齐 renderMarkdownToSafeHtml）
pub fn render_markdown_to_safe_html(markdown: &str) -> String {
    let html = render_markdown(markdown);
    sanitize_html(&html)
}

/// 渲染状态：代码块（lang, code）与图片（src, title, alt）为跨事件收集
enum Pending {
    CodeBlock {
        lang: String,
        code: String,
    },
    Image {
        src: String,
        title: String,
        alt: String,
    },
}

fn heading_number(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

/// 纯渲染（不过滤），供 sanitize 前使用
fn render_markdown(markdown: &str) -> String {
    let parser = Parser::new_ext(markdown, MARKDOWN_OPTIONS);
    let mut out = String::with_capacity(markdown.len() + 64);
    let mut pending: Option<Pending> = None;
    let mut in_table_head = false;

    for event in parser {
        // 跨事件收集：代码块内容 / 图片 alt 文本
        if let Some(pending_state) = pending.as_mut() {
            match (pending_state, &event) {
                (Pending::CodeBlock { code, .. }, Event::Text(text)) => code.push_str(text),
                (Pending::Image { alt, .. }, Event::Text(text)) => alt.push_str(text),
                (_, Event::SoftBreak) | (_, Event::HardBreak) => {}
                _ => {}
            }

            match event {
                Event::End(TagEnd::CodeBlock) => {
                    if let Some(Pending::CodeBlock { lang, code }) = pending.take() {
                        // marked 输出不含代码块末尾换行
                        let code = code.trim_end_matches('\n');
                        let escaped = escape_html(code);
                        if lang.is_empty() {
                            out.push_str("<pre><code>");
                            out.push_str(&escaped);
                            out.push_str("</code></pre>");
                        } else {
                            out.push_str("<pre data-language=\"");
                            out.push_str(&escape_html(&lang));
                            out.push_str("\"><code class=\"hljs language-");
                            out.push_str(&escape_html(&lang));
                            out.push_str("\">");
                            out.push_str(&escaped);
                            out.push_str("</code></pre>");
                        }
                    }
                }
                Event::End(TagEnd::Image) => {
                    if let Some(Pending::Image { src, title, alt }) = pending.take() {
                        out.push_str("<img src=\"");
                        out.push_str(&escape_html(&src));
                        out.push_str("\" alt=\"");
                        out.push_str(&escape_html(&alt));
                        if !title.is_empty() {
                            out.push_str("\" title=\"");
                            out.push_str(&escape_html(&title));
                        }
                        out.push_str("\">");
                    }
                }
                _ => {}
            }
            continue;
        }

        match event {
            Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) => {
                pending = Some(Pending::CodeBlock {
                    lang: lang.trim().to_string(),
                    code: String::new(),
                });
            }
            Event::Start(Tag::CodeBlock(CodeBlockKind::Indented)) => {
                pending = Some(Pending::CodeBlock {
                    lang: String::new(),
                    code: String::new(),
                });
            }
            Event::Start(Tag::Image {
                dest_url, title, ..
            }) => {
                pending = Some(Pending::Image {
                    src: dest_url.to_string(),
                    title: title.to_string(),
                    alt: String::new(),
                });
            }
            Event::Start(Tag::Link {
                dest_url, title, ..
            }) => {
                out.push_str("<a href=\"");
                out.push_str(&escape_html(&dest_url));
                if !title.is_empty() {
                    out.push_str("\" title=\"");
                    out.push_str(&escape_html(&title));
                }
                out.push_str("\">");
            }
            Event::Start(Tag::List(start)) => {
                if start.is_some() {
                    out.push_str("<ol>");
                } else {
                    out.push_str("<ul>");
                }
            }
            Event::Start(Tag::Heading { level, .. }) => {
                out.push_str("<h");
                out.push((b'0' + heading_number(level)) as char);
                out.push('>');
            }
            Event::Start(Tag::Paragraph) => out.push_str("<p>"),
            Event::Start(Tag::BlockQuote(_)) => out.push_str("<blockquote>"),
            Event::Start(Tag::Item) => out.push_str("<li>"),
            Event::Start(Tag::Emphasis) => out.push_str("<em>"),
            Event::Start(Tag::Strong) => out.push_str("<strong>"),
            Event::Start(Tag::Strikethrough) => out.push_str("<del>"),
            Event::Start(Tag::Table(_)) => out.push_str("<table>"),
            Event::Start(Tag::TableHead) => {
                in_table_head = true;
                out.push_str("<thead>");
            }
            Event::Start(Tag::TableRow) => out.push_str("<tr>"),
            Event::Start(Tag::TableCell) => {
                // marked 对表头单元格输出 <th>（对齐旧后端 content_html）
                if in_table_head {
                    out.push_str("<th>");
                } else {
                    out.push_str("<td>");
                }
            }
            Event::Start(Tag::FootnoteDefinition(_)) => out.push_str("<section>"),
            Event::Start(Tag::DefinitionList) => out.push_str("<dl>"),
            Event::Start(Tag::DefinitionListTitle) => out.push_str("<dt>"),
            Event::Start(Tag::DefinitionListDefinition) => out.push_str("<dd>"),
            Event::Start(
                Tag::HtmlBlock | Tag::MetadataBlock(_) | Tag::Superscript | Tag::Subscript,
            ) => {}
            Event::End(TagEnd::Heading(level)) => {
                out.push_str("</h");
                out.push((b'0' + heading_number(level)) as char);
                out.push('>');
            }
            Event::End(TagEnd::Paragraph) => out.push_str("</p>"),
            Event::End(TagEnd::BlockQuote(_)) => out.push_str("</blockquote>"),
            Event::End(TagEnd::List(_)) => out.push_str("</ul>"),
            Event::End(TagEnd::Item) => out.push_str("</li>"),
            Event::End(TagEnd::Emphasis) => out.push_str("</em>"),
            Event::End(TagEnd::Strong) => out.push_str("</strong>"),
            Event::End(TagEnd::Strikethrough) => out.push_str("</del>"),
            Event::End(TagEnd::Link) => out.push_str("</a>"),
            Event::End(TagEnd::Table) => out.push_str("</table>"),
            Event::End(TagEnd::TableHead) => {
                in_table_head = false;
                out.push_str("</thead>");
            }
            Event::End(TagEnd::TableRow) => out.push_str("</tr>"),
            Event::End(TagEnd::TableCell) => {
                if in_table_head {
                    out.push_str("</th>");
                } else {
                    out.push_str("</td>");
                }
            }
            Event::End(TagEnd::FootnoteDefinition) => out.push_str("</section>"),
            Event::End(TagEnd::DefinitionList) => out.push_str("</dl>"),
            Event::End(TagEnd::DefinitionListTitle) => out.push_str("</dt>"),
            Event::End(TagEnd::DefinitionListDefinition) => out.push_str("</dd>"),
            Event::End(TagEnd::Image | TagEnd::CodeBlock) => {}
            Event::End(
                TagEnd::HtmlBlock
                | TagEnd::MetadataBlock(_)
                | TagEnd::Superscript
                | TagEnd::Subscript,
            ) => {}
            Event::Text(text) => out.push_str(&escape_html(&text)),
            Event::Code(code) => {
                out.push_str("<code>");
                out.push_str(&escape_html(&code));
                out.push_str("</code>");
            }
            Event::SoftBreak => out.push('\n'),
            Event::HardBreak => out.push_str("<br />"),
            Event::Html(html) | Event::InlineHtml(html) => out.push_str(&html),
            Event::Rule => out.push_str("<hr />"),
            Event::TaskListMarker(checked) => {
                if checked {
                    out.push_str("<input checked=\"\" disabled=\"\" type=\"checkbox\">");
                } else {
                    out.push_str("<input disabled=\"\" type=\"checkbox\">");
                }
            }
            // 未启用 ENABLE_FOOTNOTES/ENABLE_MATH 时不会出现；忽略以保持结构
            Event::FootnoteReference(_) | Event::InlineMath(_) | Event::DisplayMath(_) => {}
        }
    }

    out
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// ammonia 白名单（对齐 sanitize-html 配置）：
/// - 标签：defaults.allowedTags（含 h1-h6/img 等）≈ 博客 markdown 输出全量
/// - 属性：a: href/name/target/rel；img: src/alt/title/width/height/loading/decoding；
///   pre: data-language；code/span: class；全局 class/id/title
/// - 链接 scheme：http/https + 额外 data（对齐 allowedSchemesByTag.img 的 data 允许）
fn sanitize_html(html: &str) -> String {
    use std::collections::HashMap;
    use std::collections::HashSet;

    let allowed_tags: HashSet<&str> = [
        "address",
        "article",
        "aside",
        "footer",
        "header",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hgroup",
        "main",
        "nav",
        "section",
        "blockquote",
        "dd",
        "div",
        "dl",
        "dt",
        "figcaption",
        "figure",
        "hr",
        "li",
        "ol",
        "p",
        "pre",
        "ul",
        "a",
        "abbr",
        "b",
        "bdi",
        "bdo",
        "br",
        "cite",
        "code",
        "data",
        "dfn",
        "em",
        "i",
        "kbd",
        "mark",
        "q",
        "rb",
        "rp",
        "rt",
        "rtc",
        "ruby",
        "s",
        "samp",
        "small",
        "span",
        "strong",
        "sub",
        "sup",
        "time",
        "u",
        "var",
        "wbr",
        "caption",
        "col",
        "colgroup",
        "table",
        "tbody",
        "td",
        "tfoot",
        "th",
        "thead",
        "tr",
        "img",
        "del",
        "ins",
        "summary",
        "details",
    ]
    .into_iter()
    .collect();

    let mut tag_attributes: HashMap<&str, HashSet<&str>> = HashMap::new();
    tag_attributes.insert("a", ["href", "name", "target", "rel"].into_iter().collect());
    tag_attributes.insert(
        "img",
        [
            "src", "alt", "title", "width", "height", "loading", "decoding",
        ]
        .into_iter()
        .collect(),
    );
    tag_attributes.insert("pre", ["data-language"].into_iter().collect());
    tag_attributes.insert("code", ["class"].into_iter().collect());
    tag_attributes.insert("span", ["class"].into_iter().collect());

    let mut builder = SanitizerBuilder::default();
    builder
        .tags(allowed_tags)
        .tag_attributes(tag_attributes)
        .url_relative(UrlRelative::PassThrough)
        .add_generic_attributes(&["class", "id", "title"])
        .add_url_schemes(&["data"])
        // rel 作为 a 的允许属性透传（对齐 sanitize-html a: [href,name,target,rel]），不自动加 noopener
        .link_rel(None);

    builder.clean(html).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_paragraph_and_code_block_shape() {
        let html = render_markdown_to_safe_html("hello\n\n```rust\nfn main() {}\n```");
        assert!(html.contains("<p>hello</p>"), "got: {html}");
        assert!(
            html.contains("<pre data-language=\"rust\"><code class=\"hljs language-rust\">fn main() {}</code></pre>"),
            "got: {html}"
        );
    }

    #[test]
    fn plain_code_block_without_language() {
        let html = render_markdown_to_safe_html("```\nplain\n```");
        assert!(
            html.contains("<pre><code>plain</code></pre>"),
            "got: {html}"
        );
    }

    #[test]
    fn escapes_code_content() {
        let html = render_markdown_to_safe_html("```html\n<div>&amp;</div>\n```");
        assert!(
            html.contains("&lt;div&gt;&amp;amp;&lt;/div&gt;"),
            "got: {html}"
        );
    }

    #[test]
    fn strips_script_with_content() {
        // 对齐 sanitize-html 默认 nonTextTags：script 标签连同内容一并移除
        let html = render_markdown_to_safe_html("<script>alert(1)</script>ok");
        assert!(!html.contains("<script"), "got: {html}");
        assert!(!html.contains("alert(1)"), "got: {html}");
        assert!(html.contains("ok"), "got: {html}");
    }

    #[test]
    fn strips_javascript_href() {
        let html = render_markdown_to_safe_html("[x](javascript:alert(1))");
        assert!(!html.contains("javascript:"), "got: {html}");
    }

    #[test]
    fn allows_data_image_src() {
        let html = render_markdown_to_safe_html("![a](data:image/png;base64,AAAA)");
        assert!(html.contains("data:image/png"), "got: {html}");
    }

    #[test]
    fn gfm_table_and_tasklist() {
        let html = render_markdown_to_safe_html("- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |");
        assert!(html.contains("<table>"), "got: {html}");
        // 表头单元格为 <th>（对齐 marked）
        assert!(html.contains("<th>a</th>"), "got: {html}");
        // tasklist checkbox：marked 输出 <input>，sanitize-html 白名单不含 input → 剥离（对齐旧行为）
        assert!(!html.contains("checkbox"), "got: {html}");
        assert!(html.contains("done"), "got: {html}");
    }

    #[test]
    fn link_with_title() {
        let html = render_markdown_to_safe_html("[x](https://example.com \"t\")");
        assert!(
            html.contains("<a href=\"https://example.com\" title=\"t\">x</a>"),
            "got: {html}"
        );
    }

    #[test]
    fn image_with_alt() {
        let html = render_markdown_to_safe_html("![alt text](/img.png)");
        assert!(
            html.contains("<img src=\"/img.png\" alt=\"alt text\">"),
            "got: {html}"
        );
    }
}
