//! DOM 快照 → Markdown 序列化：将 JavaScript 传来的通用 DOM JSON 树
//! 转换回标准 GFM。所有转换规则集中在此模块，JS 端只负责采集快照。

use std::collections::HashMap;

use serde::Deserialize;

/// 通用 DOM 快照节点：文本节点只有 `text`，元素节点带 `tag`/`classes`/`attrs`/`children`。
#[derive(Deserialize, Clone, Default)]
pub struct DomNode {
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub classes: Vec<String>,
    #[serde(default)]
    pub attrs: HashMap<String, String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub children: Vec<DomNode>,
}

impl DomNode {
    fn has_class(&self, class: &str) -> bool {
        self.classes.iter().any(|c| c == class)
    }

    fn attr(&self, name: &str) -> Option<&str> {
        self.attrs.get(name).map(|value| value.as_str())
    }

    /// 等价于 `element.textContent`：按文档顺序拼接全部后代文本。
    fn full_text(&self) -> String {
        let mut out = String::new();
        self.collect_text(&mut out);
        out
    }

    fn collect_text(&self, out: &mut String) {
        if let Some(text) = &self.text {
            out.push_str(text);
            return;
        }
        for child in &self.children {
            child.collect_text(out);
        }
    }

    /// 等价于 `element.querySelector(pred)`：先序深度优先的首个匹配后代。
    fn find_descendant<'a>(&'a self, pred: &dyn Fn(&DomNode) -> bool) -> Option<&'a DomNode> {
        for child in &self.children {
            if child.text.is_none() {
                if pred(child) {
                    return Some(child);
                }
                if let Some(found) = child.find_descendant(pred) {
                    return Some(found);
                }
            }
        }
        None
    }
}

/// 入口：根元素的子节点逐一转换后整体 trim 并补一个换行（与 JS 版一致）。
pub fn dom_to_markdown(root: &DomNode) -> String {
    format!("{}\n", children_to_markdown(root, 0, false).trim())
}

/// 内容中最长连续反引号串的长度（用于选择不会提前闭合的围栏）。
fn longest_backtick_run(content: &str) -> usize {
    let mut max = 0usize;
    let mut current = 0usize;
    for ch in content.chars() {
        if ch == '`' {
            current += 1;
            max = max.max(current);
        } else {
            current = 0;
        }
    }
    max
}

/// 围栏长度取 `min_len` 与「最长反引号串 + 1」的较大者，避免内容把围栏提前闭合。
fn fence(run: usize, min_len: usize) -> String {
    "`".repeat(run.max(min_len))
}

/// Mermaid 还原：源码来自 data-mermaid-source 属性，缺失时回退文本。
fn mermaid_to_markdown(node: &DomNode) -> String {
    let code = node
        .attr("data-mermaid-source")
        .map(str::to_string)
        .unwrap_or_else(|| node.full_text());
    let code = code.trim().to_string();
    let fence = fence(longest_backtick_run(&code) + 1, 3);
    format!("\n{fence}mermaid\n{code}\n{fence}\n")
}

fn children_to_markdown(node: &DomNode, depth: usize, inside_table: bool) -> String {
    let mut out = String::new();
    for child in &node.children {
        out.push_str(&node_to_markdown(child, node, depth, inside_table));
    }
    out
}

/// 排除首个 `markdown-alert-title` 子元素后的内容（对应 JS 版的 `titleEl.remove()`）。
fn alert_inner_to_markdown(node: &DomNode, depth: usize, inside_table: bool) -> String {
    let mut title_skipped = false;
    let mut out = String::new();
    for child in &node.children {
        if !title_skipped && child.has_class("markdown-alert-title") {
            title_skipped = true;
            continue;
        }
        out.push_str(&node_to_markdown(child, node, depth, inside_table));
    }
    out
}

fn node_to_markdown(node: &DomNode, parent: &DomNode, depth: usize, inside_table: bool) -> String {
    if let Some(text) = &node.text {
        return text.clone();
    }

    let tag = node.tag.as_str();

    // KaTeX 公式：读取 annotation 中的 TeX 源码
    if node.has_class("katex") || node.has_class("katex-display") {
        let annotation = node.find_descendant(&|n| {
            n.tag == "annotation" && n.attr("encoding") == Some("application/x-tex")
        });
        if let Some(annotation) = annotation {
            let tex = annotation.full_text().trim().to_string();
            let is_display =
                node.has_class("katex-display") || parent.has_class("katex-display");
            return if is_display {
                format!("\n$$\n{tex}\n$$\n")
            } else {
                format!("${tex}$")
            };
        }
    }

    // Mermaid 图：优先取 data-mermaid-source 属性
    if node.has_class("mermaid") || node.attr("data-mermaid").is_some() {
        return mermaid_to_markdown(node);
    }

    // GitHub Alerts：`> [!NOTE]` 等引用块
    if node.has_class("markdown-alert") {
        let alert_type = if node.has_class("markdown-alert-tip") {
            "TIP"
        } else if node.has_class("markdown-alert-important") {
            "IMPORTANT"
        } else if node.has_class("markdown-alert-warning") {
            "WARNING"
        } else if node.has_class("markdown-alert-caution") {
            "CAUTION"
        } else {
            "NOTE"
        };
        let inner = alert_inner_to_markdown(node, depth, inside_table).trim().to_string();
        let lines = inner
            .split('\n')
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        return format!("\n> [!{alert_type}]\n{lines}\n");
    }

    // 代码块
    if tag == "pre" {
        // markdown-it 的 fence 渲染会把 mermaid 容器包进 <pre><code>，
        // 此时优先还原 Mermaid 源码而不是取渲染后的 SVG 文本
        let mermaid_inside = node.find_descendant(&|n| {
            n.has_class("mermaid") || n.attr("data-mermaid").is_some()
        });
        if let Some(mermaid_div) = mermaid_inside {
            return mermaid_to_markdown(mermaid_div);
        }
        let code_el = node
            .find_descendant(&|n| n.tag == "code")
            .unwrap_or(node);
        let lang = code_el
            .classes
            .iter()
            .find_map(|c| c.strip_prefix("language-"))
            .unwrap_or("");
        let raw_code = code_el.full_text();
        let trimmed = raw_code.trim_end_matches('\n');
        // 内容含 ``` 时三反引号围栏会被提前闭合，按内容选择更长的围栏
        let fence = fence(longest_backtick_run(trimmed) + 1, 3);
        return format!("\n{fence}{lang}\n{trimmed}\n{fence}\n");
    }

    // 行内代码（父元素不是 pre）
    if tag == "code" && parent.tag != "pre" {
        let content = node.full_text();
        let fence = fence(longest_backtick_run(&content) + 1, 1);
        // 内容以反引号开头/结尾（或为空）时按 CommonMark 用空格与围栏分隔
        let pad = if content.is_empty() || content.starts_with('`') || content.ends_with('`') {
            " "
        } else {
            ""
        };
        return format!("{fence}{pad}{content}{pad}{fence}");
    }

    // 标题
    if tag.len() == 2
        && tag.starts_with('h')
        && tag.as_bytes()[1].is_ascii_digit()
        && tag != "h0"
    {
        let level = tag.as_bytes()[1] - b'0';
        let prefix = "#".repeat(level as usize);
        return format!("\n{prefix} {}\n", children_to_markdown(node, depth, inside_table).trim());
    }

    // 段落
    if tag == "p" {
        return format!("\n{}\n", children_to_markdown(node, depth, inside_table).trim());
    }

    // 引用块
    if tag == "blockquote" {
        let inner = children_to_markdown(node, depth, inside_table).trim().to_string();
        let lines = inner
            .split('\n')
            .map(|line| format!("> {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        return format!("\n{lines}\n");
    }

    // 加粗 / 斜体 / 删除线
    if tag == "strong" || tag == "b" {
        return format!("**{}**", children_to_markdown(node, depth, inside_table));
    }
    if tag == "em" || tag == "i" {
        return format!("*{}*", children_to_markdown(node, depth, inside_table));
    }
    if tag == "del" || tag == "s" || tag == "strike" {
        return format!("~~{}~~", children_to_markdown(node, depth, inside_table));
    }
    // 下标 / 上标 / 高亮（markdown-it-sub/sup/mark 语法）
    if tag == "sub" {
        return format!("~{}~", children_to_markdown(node, depth, inside_table));
    }
    if tag == "sup" {
        return format!("^{}^", children_to_markdown(node, depth, inside_table));
    }
    if tag == "mark" {
        return format!("=={}==", children_to_markdown(node, depth, inside_table));
    }

    // 链接与图片
    if tag == "a" {
        let href = node.attr("href").unwrap_or("");
        return format!("[{}]({})", children_to_markdown(node, depth, inside_table), href);
    }
    if tag == "img" {
        let src = node.attr("src").unwrap_or("");
        let alt = node.attr("alt").unwrap_or("");
        return format!("![{alt}]({src})");
    }

    // 无序 / 有序 / 任务列表：任务项同样按子节点序列化（保留行内格式与嵌套结构），
    // 嵌套内容按标记宽度缩进，保证往返后层级语义不变
    if tag == "ul" || tag == "ol" {
        let start = if tag == "ol" {
            node.attr("start")
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(1)
        } else {
            1
        };
        let items: Vec<String> = node
            .children
            .iter()
            .filter(|c| c.tag == "li")
            .enumerate()
            .map(|(idx, li)| {
                let task = li.find_descendant(&|n| {
                    n.tag == "input" && n.attr("type") == Some("checkbox")
                });
                let marker = match task {
                    Some(input) => format!(
                        "- [{}] ",
                        if input.attr("checked") == Some("true") { "x" } else { " " }
                    ),
                    None if tag == "ol" => format!("{}. ", start + idx),
                    None => "- ".to_string(),
                };
                let inner = children_to_markdown(li, depth + 1, inside_table).trim().to_string();
                let pad = " ".repeat(marker.len());
                // 首行紧跟标记无需缩进，续行（嵌套列表等）按标记宽度缩进保持层级
                let indented = inner
                    .split('\n')
                    .enumerate()
                    .map(|(i, line)| {
                        if i == 0 || line.is_empty() {
                            line.to_string()
                        } else {
                            format!("{pad}{line}")
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n");
                format!("{marker}{indented}")
            })
            .collect();
        return format!("\n{}\n", items.join("\n"));
    }

    // 表格
    if tag == "table" {
        if inside_table {
            // 嵌套表格降级为纯文本：GFM 单元格内无法承载块级表格，
            // 递归序列化会把内层行/分隔行混入外层，破坏列结构
            return node.full_text();
        }
        return format!("\n{}\n", serialize_table(node));
    }

    // 分隔线与换行
    if tag == "hr" {
        return "\n---\n".to_string();
    }
    if tag == "br" {
        return "\n".to_string();
    }

    children_to_markdown(node, depth, inside_table)
}

fn serialize_table(table: &DomNode) -> String {
    let mut rows: Vec<&DomNode> = Vec::new();
    collect_direct_rows(table, &mut rows);
    if rows.is_empty() {
        return String::new();
    }

    let mut table_data: Vec<Vec<String>> = rows
        .iter()
        .map(|row| {
            // 单趟按文档序收集本行直接子级的 th/td：
            // 先 th 后 td 的两趟收集会重排混排行，深入下钻会并入嵌套表格的单元格
            let mut cells: Vec<&DomNode> = Vec::new();
            for cell in &row.children {
                if cell.text.is_none() && (cell.tag == "th" || cell.tag == "td") {
                    cells.push(cell);
                }
            }
            cells
                .iter()
                .map(|cell| {
                    // 单元格保留行内格式（code/strong/em 等），GFM 表格行内不允许换行，
                    // 将块级转换产生的换行折叠为空格；嵌套表格已降级为纯文本
                    children_to_markdown(cell, 0, true)
                        .trim()
                        .split('\n')
                        .map(str::trim)
                        .filter(|l| !l.is_empty())
                        .collect::<Vec<_>>()
                        .join(" ")
                        .replace('|', "\\|")
                })
                .collect()
        })
        .collect();

    let max_cols = table_data.iter().map(Vec::len).max().unwrap_or(0);
    if max_cols == 0 {
        return String::new();
    }

    for row in &mut table_data {
        while row.len() < max_cols {
            row.push(String::new());
        }
    }

    let header = &table_data[0];
    let header_line = format!("| {} |", header.join(" | "));
    let separator_line = format!("| {} |", vec!["---"; max_cols].join(" | "));
    let body_lines: Vec<String> = table_data[1..]
        .iter()
        .map(|row| format!("| {} |", row.join(" | ")))
        .collect();

    let mut lines = vec![header_line, separator_line];
    lines.extend(body_lines);
    lines.join("\n")
}

/// 行收集仅限当前表格的直接结构（`thead/tbody/tfoot > tr` 或无分节的 `table > tr`）。
/// 之前的全后代收集会把嵌套表格的行误并入外层，产出结构损坏的 Markdown。
fn collect_direct_rows<'a>(table: &'a DomNode, out: &mut Vec<&'a DomNode>) {
    for child in &table.children {
        if child.text.is_some() {
            continue;
        }
        match child.tag.as_str() {
            "thead" | "tbody" | "tfoot" => {
                for row in &child.children {
                    if row.text.is_none() && row.tag == "tr" {
                        out.push(row);
                    }
                }
            }
            "tr" => out.push(child),
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{dom_to_markdown, DomNode};
    use std::collections::HashMap;

    fn element(tag: &str, children: Vec<DomNode>) -> DomNode {
        DomNode {
            tag: tag.to_string(),
            children,
            ..Default::default()
        }
    }

    fn text(value: &str) -> DomNode {
        DomNode {
            text: Some(value.to_string()),
            ..Default::default()
        }
    }

    impl DomNode {
        fn with_classes(mut self, classes: &[&str]) -> DomNode {
            self.classes = classes.iter().map(|c| c.to_string()).collect();
            self
        }

        fn with_attr(mut self, key: &str, value: &str) -> DomNode {
            self.attrs.insert(key.to_string(), value.to_string());
            self
        }
    }

    #[test]
    fn serializes_headings_and_paragraphs() {
        let root = element(
            "article",
            vec![
                element("h1", vec![text("标题")]),
                element(
                    "p",
                    vec![
                        text("第一段 "),
                        element("strong", vec![text("加粗")]),
                        text(" 结束"),
                    ],
                ),
            ],
        );
        assert_eq!(
            dom_to_markdown(&root),
            "# 标题\n\n第一段 **加粗** 结束\n"
        );
    }

    #[test]
    fn serializes_code_blocks_with_language() {
        let pre = element(
            "pre",
            vec![element(
                "code",
                vec![text("fn main() {}\n\n\n")],
            )
            .with_classes(&["language-rust", "hljs"])],
        );
        let root = element("article", vec![pre]);
        assert_eq!(dom_to_markdown(&root), "```rust\nfn main() {}\n```\n");
    }

    #[test]
    fn serializes_inline_code_outside_pre() {
        let root = element(
            "article",
            vec![element("p", vec![element("code", vec![text("x=1")])])],
        );
        assert_eq!(dom_to_markdown(&root), "`x=1`\n");
    }

    #[test]
    fn serializes_task_lists() {
        let li_unchecked = element(
            "li",
            vec![
                element("input", vec![]).with_attr("type", "checkbox"),
                text(" 待办 A"),
            ],
        );
        let li_checked = element(
            "li",
            vec![
                element("input", vec![])
                    .with_attr("type", "checkbox")
                    .with_attr("checked", "true"),
                text(" 待办 B"),
            ],
        );
        let root = element(
            "article",
            vec![element("ul", vec![li_unchecked, li_checked])],
        );
        assert_eq!(dom_to_markdown(&root), "- [ ] 待办 A\n- [x] 待办 B\n");
    }

    #[test]
    fn serializes_ordered_list() {
        let root = element(
            "article",
            vec![element(
                "ol",
                vec![
                    element("li", vec![text("一")]),
                    element("li", vec![text("二")]),
                ],
            )],
        );
        assert_eq!(dom_to_markdown(&root), "1. 一\n2. 二\n");
    }

    #[test]
    fn respects_ordered_list_start_attribute() {
        let list = element(
            "ol",
            vec![
                element("li", vec![text("x")]),
                element("li", vec![text("y")]),
            ],
        )
        .with_attr("start", "5");
        let root = element("article", vec![list]);
        assert_eq!(dom_to_markdown(&root), "5. x\n6. y\n");
    }

    #[test]
    fn indents_nested_list_items() {
        // 嵌套列表必须按标记宽度缩进，否则层级语义退化为同级列表
        let inner = element("ul", vec![element("li", vec![text("b")])]);
        let outer = element("ul", vec![element("li", vec![text("a"), inner])]);
        let root = element("article", vec![outer]);
        assert_eq!(dom_to_markdown(&root), "- a\n  - b\n");
    }

    #[test]
    fn preserves_inline_formatting_in_task_items() {
        let li = element(
            "li",
            vec![
                element("input", vec![]).with_attr("type", "checkbox"),
                text("待办 "),
                element("code", vec![text("x=1")]),
            ],
        );
        let root = element("article", vec![element("ul", vec![li])]);
        assert_eq!(dom_to_markdown(&root), "- [ ] 待办 `x=1`\n");
    }

    #[test]
    fn degrades_nested_table_to_plain_text() {
        let inner_table = element(
            "table",
            vec![element("tr", vec![element("td", vec![text("inner")])])],
        );
        let outer = element(
            "table",
            vec![element(
                "tr",
                vec![
                    element("td", vec![text("outer")]),
                    element("td", vec![inner_table]),
                ],
            )],
        );
        let root = element("article", vec![outer]);
        // 内层表格降级为纯文本，内层行/分隔行不再混入外层
        assert_eq!(dom_to_markdown(&root), "| outer | inner |\n| --- | --- |\n");
    }

    #[test]
    fn picks_longer_fence_for_backtick_content() {
        let pre = element(
            "pre",
            vec![element(
                "code",
                vec![text("code\n```\nmore")],
            )
            .with_classes(&["language-md"])],
        );
        let root = element("article", vec![pre]);
        // 内容含三反引号行时围栏加长为四反引号，避免提前闭合
        assert_eq!(dom_to_markdown(&root), "````md\ncode\n```\nmore\n````\n");
    }

    #[test]
    fn keeps_inline_code_content_with_backticks() {
        let root = element(
            "article",
            vec![element("p", vec![element("code", vec![text("a``b")])])],
        );
        // 内容含双反引号时行内围栏加长为三反引号
        assert_eq!(dom_to_markdown(&root), "```a``b```\n");
    }

    #[test]
    fn escapes_table_pipes_and_pads_columns() {
        let row = |cells: &[&str]| {
            element(
                "tr",
                cells
                    .iter()
                    .map(|c| element("td", vec![text(c)]))
                    .collect(),
            )
        };
        let root = element(
            "article",
            vec![element(
                "table",
                vec![row(&["a | b", "c"]), row(&["only"])],
            )],
        );
        assert_eq!(
            dom_to_markdown(&root),
            "| a \\| b | c |\n| --- | --- |\n| only |  |\n"
        );
    }

    #[test]
    fn serializes_blockquote_and_links_and_images() {
        let root = element(
            "article",
            vec![
                element("blockquote", vec![element("p", vec![text("引用")])]),
                element(
                    "p",
                    vec![element("a", vec![text("链接")]).with_attr("href", "https://x.y")],
                ),
                element("img", vec![])
                    .with_attr("src", "a.png")
                    .with_attr("alt", "图"),
            ],
        );
        assert_eq!(
            dom_to_markdown(&root),
            "> 引用\n\n[链接](https://x.y)\n![图](a.png)\n"
        );
    }

    #[test]
    fn serializes_github_alert() {
        let alert = element(
            "div",
            vec![
                element("p", vec![text("注意标题")]).with_classes(&["markdown-alert-title"]),
                element("p", vec![text("第一行")]),
                element("p", vec![text("第二行")]),
            ],
        )
        .with_classes(&["markdown-alert", "markdown-alert-warning"]);
        let root = element("article", vec![alert]);
        // 多段落引用会保留空行前缀，与 JS 版 `.split('\n').map('> ' + l)` 一致。
        assert_eq!(
            dom_to_markdown(&root),
            "> [!WARNING]\n> 第一行\n> \n> 第二行\n"
        );
    }

    #[test]
    fn serializes_katex_inline_and_display() {
        let make_katex = |classes: &[&str]| {
            element(
                "span",
                vec![
                    element("span", vec![text("x²")]),
                    element("annotation", vec![text("x^2")])
                        .with_attr("encoding", "application/x-tex"),
                ],
            )
            .with_classes(classes)
        };
        let inline = make_katex(&["katex"]);
        let display = element("span", vec![make_katex(&["katex"])])
            .with_classes(&["katex-display"]);
        let root = element("article", vec![inline, display]);
        assert_eq!(dom_to_markdown(&root), "$x^2$\n$$\nx^2\n$$\n");
    }

    #[test]
    fn serializes_mermaid_block() {
        let mermaid = element("div", vec![text("graph TD; A-->B;")]).with_classes(&["mermaid"]);
        let root = element("article", vec![mermaid]);
        assert_eq!(
            dom_to_markdown(&root),
            "```mermaid\ngraph TD; A-->B;\n```\n"
        );
    }

    #[test]
    fn handles_hr_and_nested_unknown_tags() {
        let root = element(
            "article",
            vec![
                element("hr", vec![]),
                element("section", vec![element("p", vec![text("嵌套")])]),
            ],
        );
        assert_eq!(dom_to_markdown(&root), "---\n\n嵌套\n");
    }

    #[test]
    fn recovers_mermaid_source_wrapped_in_pre_code() {
        // markdown-it 会把 mermaid 容器包进 <pre><code class="language-mermaid">
        let mermaid_div = element("div", vec![element("svg", vec![text("svg 内容")])])
            .with_classes(&["mermaid"])
            .with_attr("data-mermaid-source", "graph TD; A-->B;");
        let root = element(
            "article",
            vec![element(
                "pre",
                vec![element("code", vec![mermaid_div]).with_classes(&["language-mermaid"])],
            )],
        );
        assert_eq!(dom_to_markdown(&root), "```mermaid\ngraph TD; A-->B;\n```\n");
    }

    #[test]
    fn serializes_sub_sup_and_mark() {
        let root = element(
            "article",
            vec![element(
                "p",
                vec![
                    text("H"),
                    element("sub", vec![text("2")]),
                    text("O 与 X"),
                    element("sup", vec![text("2")]),
                    text(" 与 "),
                    element("mark", vec![text("高亮")]),
                ],
            )],
        );
        assert_eq!(dom_to_markdown(&root), "H~2~O 与 X^2^ 与 ==高亮==\n");
    }

    #[test]
    fn preserves_inline_formatting_in_table_cells() {
        let row = |cells: Vec<DomNode>| element("tr", cells);
        let root = element(
            "article",
            vec![element(
                "table",
                vec![
                    row(vec![
                        element("th", vec![element("code", vec![text("name")])]),
                        element("th", vec![text("desc")]),
                    ]),
                    row(vec![
                        element("td", vec![element("code", vec![text("create_task")])]),
                        element("td", vec![
                            text("创建 "),
                            element("strong", vec![text("任务")]),
                        ]),
                    ]),
                ],
            )],
        );
        assert_eq!(
            dom_to_markdown(&root),
            "| `name` | desc |\n| --- | --- |\n| `create_task` | 创建 **任务** |\n"
        );
    }

    #[test]
    fn full_text_joins_descendant_text_nodes() {
        let node = element(
            "p",
            vec![text("a"), element("b", vec![text("b"), text("c")])],
        );
        assert_eq!(node.full_text(), "abc");
        assert_eq!(DomNode::default().full_text(), "");
    }

    #[test]
    fn attrs_map_initializes() {
        // 确认 HashMap 序列化缺省路径不会 panic（attrs 缺失时为空表）。
        let node = DomNode::default();
        assert!(node.attr("href").is_none());
        let _ = node.clone();
        let _ = HashMap::<String, String>::new();
    }
}
