//! DOM 快照 → Markdown 序列化：将 JavaScript 传来的通用 DOM JSON 树
//! 转换回标准 GFM。所有转换规则集中在此模块，JS 端只负责采集快照。
//!
//! 全链路无递归：`full_text`/`find_descendant` 与主序列化状态机均为
//! 显式栈迭代实现，配合 `parse_snapshot` 的 512 层入口限深，恶意或病态
//! 的深嵌套页面不会再触发 wasm 栈溢出（此前 debug 版约 5k 层即溢出）。

use std::collections::HashMap;

use serde::Deserialize;

/// DOM 快照最大深度：与 JS 端 `serializeNode` 的剪枝上限一致；
/// 超出后入口直接报错，调用方捕获后回退 JS 实现。
pub const MAX_SNAPSHOT_DEPTH: usize = 512;

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

/// 迭代式析构：默认的递归 drop 在深链（约 5k 层）上会先于序列化溢栈，
/// 先把子孙节点搬平再逐个丢弃，深嵌套销毁同样不消耗调用栈。
impl Drop for DomNode {
    fn drop(&mut self) {
        let mut stack = std::mem::take(&mut self.children);
        while let Some(mut child) = stack.pop() {
            stack.append(&mut child.children);
        }
    }
}

impl DomNode {
    fn has_class(&self, class: &str) -> bool {
        self.classes.iter().any(|c| c == class)
    }

    fn attr(&self, name: &str) -> Option<&str> {
        self.attrs.get(name).map(|value| value.as_str())
    }

    /// 等价于 `element.textContent`：按文档顺序拼接全部后代文本。
    /// 迭代实现：深嵌套不消耗调用栈。
    fn full_text(&self) -> String {
        let mut out = String::new();
        let mut stack: Vec<&DomNode> = vec![self];
        while let Some(node) = stack.pop() {
            if let Some(text) = &node.text {
                out.push_str(text);
                continue;
            }
            for child in node.children.iter().rev() {
                stack.push(child);
            }
        }
        out
    }

    /// 等价于 `element.querySelector(pred)`：先序深度优先的首个匹配后代
    /// （文本节点不参与匹配）。迭代实现：深嵌套不消耗调用栈。
    fn find_descendant<'a>(&'a self, pred: &dyn Fn(&DomNode) -> bool) -> Option<&'a DomNode> {
        let mut stack: Vec<&DomNode> = Vec::new();
        for child in self.children.iter().rev() {
            if child.text.is_none() {
                stack.push(child);
            }
        }
        while let Some(node) = stack.pop() {
            if pred(node) {
                return Some(node);
            }
            for child in node.children.iter().rev() {
                if child.text.is_none() {
                    stack.push(child);
                }
            }
        }
        None
    }
}

/// 入口：根元素的子节点逐一转换后整体 trim 并补一个换行（与 JS 版一致）。
pub fn dom_to_markdown(root: &DomNode) -> String {
    format!("{}\n", serialize_children(root, false).trim())
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

/// 文本节点最小转义：`*`/`_`/`#`/`[` 恒转义，`]` 在链接文本内转义，
/// 防止正文里的这些字符被解析为强调、标题或链接结构（JS 端 `escapeText` 同款）。
fn escape_text(text: &str, inside_link: bool) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '*' | '_' | '#' | '[' => {
                out.push('\\');
                out.push(ch);
            }
            ']' if inside_link => {
                out.push('\\');
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    out
}

/// 链接/图片地址里的括号会被当作地址终点之外的结构字符，转义为百分号编码。
fn escape_link_url(url: &str) -> String {
    url.replace('(', "%28").replace(')', "%29")
}

/// 序列化状态机的节点角色：决定子节点输出汇总后如何包装。
enum Kind {
    /// 入口帧：原样拼接子节点输出（外层由 dom_to_markdown trim）。
    Root,
    /// 未知标签：原样拼接子节点输出。
    PassThrough,
    Paragraph,
    Heading(usize),
    Blockquote,
    /// 成对包裹的行内格式：strong/em/del/sub/sup/mark。
    Wrap(&'static str, &'static str),
    Link { href: String },
    Alert { alert_type: &'static str },
    /// ul/ol：按序拼接 li 条目，条目之间补换行。
    List { ordered: bool, start: usize, next_idx: usize, emitted: bool },
    ListItem { marker: String },
    /// table 帧本身不直接产出字符串，等 rows 收齐后统一构表。
    Table,
    TableSection,
    TableRow,
    TableCell,
}

struct Frame<'a> {
    node: &'a DomNode,
    inside_table: bool,
    inside_link: bool,
    kind: Kind,
    child_idx: usize,
    /// GitHub Alert：首个 `markdown-alert-title` 子元素不计入正文。
    title_skipped: bool,
    /// 子节点（或条目）输出累积。
    out: String,
    /// TableRow：已完成的单元格文本。
    cells: Vec<String>,
    /// Table：已完成的行（每行为单元格文本）。
    rows: Vec<Vec<String>>,
}

impl<'a> Frame<'a> {
    fn new(node: &'a DomNode, inside_table: bool, inside_link: bool, kind: Kind) -> Self {
        Frame {
            node,
            inside_table,
            inside_link,
            kind,
            child_idx: 0,
            title_skipped: false,
            out: String::new(),
            cells: Vec::new(),
            rows: Vec::new(),
        }
    }
}

enum Child<'a> {
    Frame(Frame<'a>),
    Text(String),
    Skip,
}

/// 类名判定的叶子输出（先于 alert 判定，与原递归版顺序一致）。
fn leaf_class_markdown(node: &DomNode, parent: &DomNode) -> Option<String> {
    // KaTeX 公式：读取 annotation 中的 TeX 源码
    if node.has_class("katex") || node.has_class("katex-display") {
        let annotation = node.find_descendant(&|n| {
            n.tag == "annotation" && n.attr("encoding") == Some("application/x-tex")
        });
        if let Some(annotation) = annotation {
            let tex = annotation.full_text().trim().to_string();
            let is_display = node.has_class("katex-display") || parent.has_class("katex-display");
            return Some(if is_display {
                format!("\n$$\n{tex}\n$$\n")
            } else {
                format!("${tex}$")
            });
        }
    }

    // Mermaid 图：优先取 data-mermaid-source 属性
    if node.has_class("mermaid") || node.attr("data-mermaid").is_some() {
        return Some(mermaid_to_markdown(node));
    }

    None
}

/// 标签判定的叶子输出；`pre`/行内 `code` 的内容保持原样（不做正文转义）。
fn leaf_tag_markdown(node: &DomNode, parent: &DomNode) -> Option<String> {
    let tag = node.tag.as_str();

    // 代码块
    if tag == "pre" {
        // markdown-it 的 fence 渲染会把 mermaid 容器包进 <pre><code>，
        // 此时优先还原 Mermaid 源码而不是取渲染后的 SVG 文本
        let mermaid_inside = node.find_descendant(&|n| {
            n.has_class("mermaid") || n.attr("data-mermaid").is_some()
        });
        if let Some(mermaid_div) = mermaid_inside {
            return Some(mermaid_to_markdown(mermaid_div));
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
        return Some(format!("\n{fence}{lang}\n{trimmed}\n{fence}\n"));
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
        return Some(format!("{fence}{pad}{content}{pad}{fence}"));
    }

    if tag == "img" {
        let src = escape_link_url(node.attr("src").unwrap_or(""));
        let alt = escape_text(node.attr("alt").unwrap_or(""), true);
        return Some(format!("![{alt}]({src})"));
    }

    if tag == "hr" {
        return Some("\n---\n".to_string());
    }

    if tag == "br" {
        return Some("\n".to_string());
    }

    None
}

/// 普通子节点 → 下一动作（叶子直接产出文本，容器建帧）。
fn normal_child<'a>(
    child: &'a DomNode,
    parent: &'a DomNode,
    inside_table: bool,
    inside_link: bool,
) -> Child<'a> {
    if let Some(text) = &child.text {
        return Child::Text(escape_text(text, inside_link));
    }

    if let Some(output) = leaf_class_markdown(child, parent) {
        return Child::Text(output);
    }

    if child.has_class("markdown-alert") {
        let alert_type = if child.has_class("markdown-alert-tip") {
            "TIP"
        } else if child.has_class("markdown-alert-important") {
            "IMPORTANT"
        } else if child.has_class("markdown-alert-warning") {
            "WARNING"
        } else if child.has_class("markdown-alert-caution") {
            "CAUTION"
        } else {
            "NOTE"
        };
        return Child::Frame(Frame::new(
            child,
            inside_table,
            inside_link,
            Kind::Alert { alert_type },
        ));
    }

    if let Some(output) = leaf_tag_markdown(child, parent) {
        return Child::Text(output);
    }

    let tag = child.tag.as_str();

    // 标题：HTML 不存在 h7+，超范围级别收口到 h6（与 JS 回退一致），
    // 避免产出 `#######` 这类 GFM 不认的非法 ATX 标题
    if tag.len() == 2
        && tag.starts_with('h')
        && tag.as_bytes()[1].is_ascii_digit()
        && tag != "h0"
    {
        let level = (tag.as_bytes()[1] - b'0').min(6) as usize;
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Heading(level)));
    }

    if tag == "p" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Paragraph));
    }

    if tag == "blockquote" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Blockquote));
    }

    if tag == "strong" || tag == "b" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("**", "**")));
    }
    if tag == "em" || tag == "i" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("*", "*")));
    }
    if tag == "del" || tag == "s" || tag == "strike" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("~~", "~~")));
    }
    if tag == "sub" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("~", "~")));
    }
    if tag == "sup" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("^", "^")));
    }
    if tag == "mark" {
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Wrap("==", "==")));
    }

    // 链接与图片：地址括号转义，链接文本内的 `]` 转义
    if tag == "a" {
        let href = escape_link_url(child.attr("href").unwrap_or(""));
        return Child::Frame(Frame::new(
            child,
            inside_table,
            true,
            Kind::Link { href },
        ));
    }

    // 无序 / 有序 / 任务列表：任务项同样按子节点序列化（保留行内格式与嵌套结构），
    // 嵌套内容按标记宽度缩进，保证往返后层级语义不变
    if tag == "ul" || tag == "ol" {
        let ordered = tag == "ol";
        let start = if ordered {
            child
                .attr("start")
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(1)
        } else {
            1
        };
        return Child::Frame(Frame::new(
            child,
            inside_table,
            inside_link,
            Kind::List { ordered, start, next_idx: 0, emitted: false },
        ));
    }

    // 表格：嵌套表格降级为纯文本（GFM 单元格内无法承载块级表格，
    // 递归序列化会把内层行/分隔行混入外层，破坏列结构），外层正常构表
    if tag == "table" {
        if inside_table {
            return Child::Text(child.full_text());
        }
        return Child::Frame(Frame::new(child, inside_table, inside_link, Kind::Table));
    }

    Child::Frame(Frame::new(child, inside_table, inside_link, Kind::PassThrough))
}

/// 依据当前帧角色决定下一个子节点的去处（过滤、建帧或直接产出）。
fn decide_child<'a>(top: &mut Frame<'a>, child: &'a DomNode) -> Child<'a> {
    match &mut top.kind {
        // 列表只吃 li：非 li 子节点忽略；条目间以换行分隔
        Kind::List { ordered, start, next_idx, emitted } => {
            if child.tag != "li" {
                return Child::Skip;
            }
            let idx = *next_idx;
            *next_idx += 1;
            let task = child.find_descendant(&|n| {
                n.tag == "input" && n.attr("type") == Some("checkbox")
            });
            let marker = match task {
                Some(input) => format!(
                    "- [{}] ",
                    if input.attr("checked") == Some("true") { "x" } else { " " }
                ),
                None if *ordered => format!("{}. ", *start + idx),
                None => "- ".to_string(),
            };
            if *emitted {
                top.out.push('\n');
            }
            *emitted = true;
            Child::Frame(Frame::new(child, top.inside_table, top.inside_link, Kind::ListItem { marker }))
        }
        // 表格行收集仅限直接结构（thead/tbody/tfoot > tr 或无分节的 table > tr）：
        // 全后代收集会把嵌套表格的行误并入外层，产出结构损坏的 Markdown
        Kind::Table => match child.tag.as_str() {
            "thead" | "tbody" | "tfoot" => {
                Child::Frame(Frame::new(child, top.inside_table, top.inside_link, Kind::TableSection))
            }
            "tr" => Child::Frame(Frame::new(child, top.inside_table, top.inside_link, Kind::TableRow)),
            _ => Child::Skip,
        },
        Kind::TableSection => {
            if child.tag == "tr" {
                Child::Frame(Frame::new(child, top.inside_table, top.inside_link, Kind::TableRow))
            } else {
                Child::Skip
            }
        }
        // 单元格内强制 inside_table：嵌套表格降级、列内换行折叠都依赖它
        Kind::TableRow => {
            if child.text.is_none() && (child.tag == "th" || child.tag == "td") {
                Child::Frame(Frame::new(child, true, top.inside_link, Kind::TableCell))
            } else {
                Child::Skip
            }
        }
        // GitHub Alert：跳过首个标题子元素
        Kind::Alert { .. } => {
            if !top.title_skipped && child.has_class("markdown-alert-title") {
                top.title_skipped = true;
                return Child::Skip;
            }
            normal_child(child, top.node, top.inside_table, top.inside_link)
        }
        _ => normal_child(child, top.node, top.inside_table, top.inside_link),
    }
}

/// 帧完成：把累积的子节点输出包装为本节点输出。
fn complete_frame(frame: Frame) -> String {
    match frame.kind {
        Kind::Root | Kind::PassThrough | Kind::TableSection => frame.out,
        Kind::Paragraph => format!("\n{}\n", frame.out.trim()),
        Kind::Heading(level) => {
            let prefix = "#".repeat(level);
            format!("\n{prefix} {}\n", frame.out.trim())
        }
        Kind::Blockquote => {
            let lines = frame
                .out
                .trim()
                .split('\n')
                .map(|line| format!("> {line}"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("\n{lines}\n")
        }
        Kind::Wrap(open, close) => format!("{open}{}{close}", frame.out),
        Kind::Link { href } => format!("[{}]({})", frame.out, href),
        Kind::Alert { alert_type } => {
            let lines = frame
                .out
                .trim()
                .split('\n')
                .map(|line| format!("> {line}"))
                .collect::<Vec<_>>()
                .join("\n");
            format!("\n> [!{alert_type}]\n{lines}\n")
        }
        // 首行紧跟标记无需缩进，续行（嵌套列表等）按标记宽度缩进保持层级
        Kind::ListItem { marker } => {
            let inner = frame.out.trim();
            let pad = " ".repeat(marker.len());
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
        }
        Kind::List { .. } => format!("\n{}\n", frame.out),
        Kind::Table => format!("\n{}\n", build_table(&frame.rows)),
        // 行/单元格在合并阶段直达 Table 帧，不会走到这里
        Kind::TableRow | Kind::TableCell => frame.out,
    }
}

/// 由收集好的行构表：列数补齐、表头 + 分隔行 + 表体（与原实现一致）。
fn build_table(rows: &[Vec<String>]) -> String {
    if rows.is_empty() {
        return String::new();
    }
    let max_cols = rows.iter().map(Vec::len).max().unwrap_or(0);
    if max_cols == 0 {
        return String::new();
    }

    let mut table_data = rows.to_vec();
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

/// 单元格文本：折叠块级换行为空格（GFM 行内不允许换行）并转义管道符；
/// 嵌套表格已降级为纯文本。
fn render_cell(out: &str) -> String {
    out.trim()
        .split('\n')
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .replace('|', "\\|")
}

/// 主序列化状态机：显式栈先序展开、后序完成，深嵌套不消耗调用栈。
fn serialize_children(root: &DomNode, inside_table: bool) -> String {
    let mut final_out = String::new();
    let mut stack: Vec<Frame> = vec![Frame::new(root, inside_table, false, Kind::Root)];

    while !stack.is_empty() {
        enum Step<'a> {
            Push(Child<'a>),
            Complete,
        }
        let step = {
            let top = stack.last_mut().unwrap();
            if top.child_idx >= top.node.children.len() {
                Step::Complete
            } else {
                let child = &top.node.children[top.child_idx];
                top.child_idx += 1;
                Step::Push(decide_child(top, child))
            }
        };

        match step {
            Step::Push(child_action) => match child_action {
                Child::Frame(frame) => stack.push(frame),
                Child::Text(text) => {
                    if let Some(top) = stack.last_mut() {
                        top.out.push_str(&text);
                    }
                }
                Child::Skip => {}
            },
            Step::Complete => {
                let frame = stack.pop().unwrap();
                match frame.kind {
                    // 单元格文本挂到所属行
                    Kind::TableCell => {
                        let cell = render_cell(&frame.out);
                        if let Some(row) = stack.last_mut() {
                            row.cells.push(cell);
                        }
                    }
                    // 行直接挂到最近的表格帧（经过 thead/tbody/tfoot 时跳过一层）
                    Kind::TableRow => {
                        for ancestor in stack.iter_mut().rev() {
                            if matches!(ancestor.kind, Kind::Table) {
                                ancestor.rows.push(frame.cells);
                                break;
                            }
                        }
                    }
                    Kind::TableSection => {}
                    _ => {
                        let output = complete_frame(frame);
                        match stack.last_mut() {
                            Some(parent) => parent.out.push_str(&output),
                            None => final_out = output,
                        }
                    }
                }
            }
        }
    }
    final_out
}

#[cfg(target_arch = "wasm32")]
/// 迭代式快照解析：从 JsValue 手工展开 DomNode 树（无递归），
/// 深度超过 [`MAX_SNAPSHOT_DEPTH`] 直接报错走回退。
pub fn parse_snapshot(value: &wasm_bindgen::JsValue) -> Result<DomNode, String> {
    use js_sys::{Array, Object, Reflect};
    use wasm_bindgen::JsValue;

    fn prop(holder: &JsValue, key: &str) -> Result<JsValue, String> {
        Reflect::get(holder, &JsValue::from_str(key))
            .map_err(|_| format!("cannot read property {key}"))
    }

    fn missing(value: &JsValue) -> bool {
        value.is_undefined() || value.is_null()
    }

    fn as_string(value: &JsValue, field: &str) -> Result<String, String> {
        value
            .as_string()
            .ok_or_else(|| format!("field {field} must be a string"))
    }

    struct Build {
        node: DomNode,
        pending: Vec<JsValue>,
        depth: usize,
    }

    fn read_element(value: &JsValue, depth: usize) -> Result<Build, String> {
        if !value.is_object() {
            return Err("snapshot node must be an object".to_string());
        }
        let text_prop = prop(value, "text")?;
        if !missing(&text_prop) {
            // 文本节点：只有 text 字段，无子节点
            let text = as_string(&text_prop, "text")?;
            return Ok(Build {
                node: DomNode {
                    tag: String::new(),
                    classes: Vec::new(),
                    attrs: HashMap::new(),
                    text: Some(text),
                    children: Vec::new(),
                },
                pending: Vec::new(),
                depth,
            });
        }

        let tag_prop = prop(value, "tag")?;
        let tag = if missing(&tag_prop) {
            String::new()
        } else {
            as_string(&tag_prop, "tag")?
        };

        let mut classes = Vec::new();
        let classes_prop = prop(value, "classes")?;
        if !missing(&classes_prop) {
            if !classes_prop.is_array() {
                return Err("field classes must be an array".to_string());
            }
            let arr = Array::from(&classes_prop);
            for i in 0..arr.length() {
                classes.push(as_string(&arr.get(i), "classes[]")?);
            }
        }

        let mut attrs = HashMap::new();
        let attrs_prop = prop(value, "attrs")?;
        if !missing(&attrs_prop) {
            let obj = Object::try_from(&attrs_prop)
                .ok_or_else(|| "field attrs must be an object".to_string())?;
            let keys = Object::keys(obj);
            for i in 0..keys.length() {
                let key = keys.get(i);
                let key_str = as_string(&key, "attrs key")?;
                let val = prop(obj.as_ref(), &key_str)?;
                attrs.insert(key_str, as_string(&val, "attrs value")?);
            }
        }

        let mut pending = Vec::new();
        let children_prop = prop(value, "children")?;
        if !missing(&children_prop) {
            let arr = Array::try_from(children_prop)
                .map_err(|_| "field children must be an array".to_string())?;
            // 倒序入栈，弹出顺序即文档顺序
            for i in (0..arr.length()).rev() {
                pending.push(arr.get(i));
            }
        }

        Ok(Build {
            node: DomNode {
                tag,
                classes,
                attrs,
                text: None,
                children: Vec::new(),
            },
            pending,
            depth,
        })
    }

    let mut stack: Vec<Build> = vec![read_element(value, 0)?];
    loop {
        let next_child = {
            let top = stack.last_mut().ok_or("snapshot stack empty")?;
            top.pending.pop()
        };
        match next_child {
            Some(child_value) => {
                let depth = stack.last().unwrap().depth + 1;
                if depth > MAX_SNAPSHOT_DEPTH {
                    return Err("snapshot too deep".to_string());
                }
                stack.push(read_element(&child_value, depth)?);
            }
            None => {
                let done = stack.pop().ok_or("snapshot stack empty")?;
                match stack.last_mut() {
                    Some(parent) => parent.node.children.push(done.node),
                    None => return Ok(done.node),
                }
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
/// 非 wasm 目标（单测环境）走 serde 路径，解析后同样校验深度上限。
pub fn parse_snapshot(value: &wasm_bindgen::JsValue) -> Result<DomNode, String> {
    let root: DomNode = serde_wasm_bindgen::from_value(value.clone()).map_err(|e| e.to_string())?;
    check_snapshot_depth(&root)?;
    Ok(root)
}

/// 迭代式深度校验：超限报错走回退（wasm 端在解析时同步检查）。
fn check_snapshot_depth(root: &DomNode) -> Result<(), String> {
    let mut stack: Vec<(&DomNode, usize)> = vec![(root, 0)];
    while let Some((node, depth)) = stack.pop() {
        if depth > MAX_SNAPSHOT_DEPTH {
            return Err("snapshot too deep".to_string());
        }
        for child in &node.children {
            stack.push((child, depth + 1));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{dom_to_markdown, DomNode};
    use std::collections::HashMap;

    fn element(tag: &str, children: Vec<DomNode>) -> DomNode {
        DomNode {
            tag: tag.to_string(),
            classes: Vec::new(),
            attrs: HashMap::new(),
            text: None,
            children,
        }
    }

    fn text(value: &str) -> DomNode {
        DomNode {
            tag: String::new(),
            classes: Vec::new(),
            attrs: HashMap::new(),
            text: Some(value.to_string()),
            children: Vec::new(),
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
    fn caps_heading_level_at_six() {
        // HTML 不存在 h7+；收口到 h6 与 JS 回退一致
        let root = element("article", vec![element("h7", vec![text("x")])]);
        assert_eq!(dom_to_markdown(&root), "###### x\n");
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

    #[test]
    fn escapes_emphasis_and_structure_markers_in_text() {
        // `]` 只在链接文本内转义；正文中闭合方括号无需转义
        let root = element("article", vec![element("p", vec![text("a *b* _c_ #d [e]")])]);
        assert_eq!(dom_to_markdown(&root), "a \\*b\\* \\_c\\_ \\#d \\[e]\n");
    }

    #[test]
    fn escapes_closing_bracket_in_link_text() {
        let link = element("a", vec![text("a]b")]).with_attr("href", "https://x.y");
        let root = element("article", vec![element("p", vec![link])]);
        assert_eq!(dom_to_markdown(&root), "[a\\]b](https://x.y)\n");
    }

    #[test]
    fn escapes_closing_bracket_in_image_alt() {
        let img = element("img", vec![])
            .with_attr("src", "a.png")
            .with_attr("alt", "a]b");
        let root = element("article", vec![img]);
        assert_eq!(dom_to_markdown(&root), "![a\\]b](a.png)\n");
    }

    #[test]
    fn encodes_parens_in_link_and_image_urls() {
        let root = element(
            "article",
            vec![
                element("a", vec![text("t")]).with_attr("href", "f(1)"),
                element("img", vec![]).with_attr("src", "a(1).png"),
            ],
        );
        assert_eq!(dom_to_markdown(&root), "[t](f%281%29)![](a%281%29.png)\n");
    }

    #[test]
    fn keeps_plain_text_unescaped() {
        let root = element("article", vec![element("p", vec![text("普通 text 1.2 (x) a|b")])]);
        assert_eq!(dom_to_markdown(&root), "普通 text 1.2 (x) a|b\n");
    }

    #[test]
    fn handles_deeply_nested_dom_without_overflow() {
        // 递归版在 debug 构建约 5k 层即栈溢出；迭代版 1 万层应稳定通过
        let mut node = text("deep");
        for _ in 0..10_000 {
            node = element("em", vec![node]);
        }
        let root = element("article", vec![node]);
        let expected = format!("{}deep{}\n", "*".repeat(10_000), "*".repeat(10_000));
        assert_eq!(dom_to_markdown(&root), expected);
    }
}
