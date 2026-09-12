//! 目录列表解析、过滤与树节点映射：`addRow(...)` 记录解析保留在此，
//! 网络请求与 DOM 兜底逻辑留在 JavaScript 层。

use serde::Serialize;

pub const MD_EXTENSIONS: [&str; 6] = [".md", ".mkd", ".markdown", ".txt", ".mdx", ".mdc"];

#[derive(Serialize, Clone)]
pub struct DirectoryItem {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
    pub size: u64,
    pub size_unit: String,
    pub timestamp: i64,
    pub date: String,
}

#[derive(Serialize)]
pub struct DirectoryScan {
    pub has_markdown: bool,
    pub subfolders: Vec<String>,
}

fn read_quoted(source: &str, cursor: &mut usize) -> Option<String> {
    let start = source[*cursor..].find('"')? + *cursor + 1;
    let mut value = String::new();
    let mut escaped = false;
    for (offset, ch) in source[start..].char_indices() {
        let position = start + offset;
        if escaped {
            value.push(match ch {
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                other => other,
            });
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '"' {
            *cursor = position + 1;
            return Some(value);
        } else {
            value.push(ch);
        }
    }
    *cursor = source.len();
    None
}

fn read_number(source: &str, cursor: &mut usize) -> Option<i64> {
    while *cursor < source.len() {
        let ch = source[*cursor..].chars().next()?;
        if ch.is_ascii_digit() || ch == '-' {
            break;
        }
        *cursor += ch.len_utf8();
    }
    let start = *cursor;
    let mut collected = 0usize;
    while *cursor < source.len() {
        let ch = source[*cursor..].chars().next()?;
        // 负号只允许出现在首位：`12-34` 这类混合符号串至少保留合法前缀 12，
        // 不再整体 parse 失败归 0
        let accepted = ch.is_ascii_digit() || (ch == '-' && collected == 0);
        if !accepted {
            break;
        }
        collected += 1;
        *cursor += ch.len_utf8();
    }
    source.get(start..*cursor)?.parse().ok()
}

pub fn is_markdown_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    MD_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

fn ensure_trailing_slash(url: &str) -> String {
    if url.ends_with('/') {
        url.to_string()
    } else {
        format!("{url}/")
    }
}

/// 解析目录页面的 addRow 调用。
pub fn parse_directory(source: &str) -> Vec<DirectoryItem> {
    let mut cursor = 0;
    let mut items = Vec::new();
    while let Some(offset) = source[cursor..].find("addRow(") {
        cursor += offset + 7;
        let name = match read_quoted(source, &mut cursor) {
            Some(v) => v,
            None => break,
        };
        let path = match read_quoted(source, &mut cursor) {
            Some(v) => v,
            None => break,
        };
        let is_folder = read_number(source, &mut cursor).unwrap_or(0) != 0;
        let size = read_number(source, &mut cursor).unwrap_or(0).max(0) as u64;
        let size_unit = match read_quoted(source, &mut cursor) {
            Some(v) => v,
            None => break,
        };
        let timestamp = read_number(source, &mut cursor).unwrap_or(0);
        let date = match read_quoted(source, &mut cursor) {
            Some(v) => v,
            None => break,
        };
        items.push(DirectoryItem {
            name,
            path,
            is_folder,
            size,
            size_unit,
            timestamp,
            date,
        });
    }
    items
}

/// 过滤隐藏文件与非 Markdown 条目，保持原有顺序；字段映射沿用 JS 端的 `mapToTreeNodes`。
pub fn filter_directory(source: &str) -> Vec<DirectoryItem> {
    parse_directory(source)
        .into_iter()
        .filter(|item| !item.name.starts_with('.'))
        .filter(|item| item.is_folder || is_markdown_filename(&item.name))
        .collect()
}

/// 单页扫描：是否直接包含 Markdown 文件，以及需要继续递归的子目录 URL。
pub fn scan_directory(source: &str, base_url: &str) -> DirectoryScan {
    let base = ensure_trailing_slash(base_url);
    let mut subfolders = Vec::new();
    for item in parse_directory(source) {
        if !item.is_folder && is_markdown_filename(&item.name) {
            return DirectoryScan {
                has_markdown: true,
                subfolders: Vec::new(),
            };
        }
        if item.is_folder && !item.name.starts_with('.') {
            subfolders.push(format!("{}{}", base, item.path));
        }
    }
    DirectoryScan {
        has_markdown: false,
        subfolders,
    }
}

/// 从工作区根 URL 推导目标文件的全部祖先目录 URL（自根向下）。
/// 前缀判断使用补齐尾斜杠后的根 URL，避免 `/root` 误匹配 `/root2` 下的文件。
pub fn ancestor_folder_urls(root_url: &str, target_file_url: &str) -> Vec<String> {
    let mut ancestors = Vec::new();
    let root = ensure_trailing_slash(root_url);
    if !target_file_url.starts_with(&root) {
        return ancestors;
    }

    let relative = &target_file_url[root.len()..];
    let mut segments: Vec<&str> = relative.split('/').filter(|s| !s.is_empty()).collect();
    segments.pop(); // 末段是文件名

    let mut current = root;
    for seg in segments {
        current = format!("{current}{seg}/");
        ancestors.push(current.clone());
    }
    ancestors
}

#[cfg(test)]
mod tests {
    use super::{ancestor_folder_urls, filter_directory, is_markdown_filename, parse_directory, scan_directory};

    const SAMPLE: &str = r#"addRow("notes", "notes/", 1, 4096, "4 KB", 1725000000, "2024-08-30");
addRow("README.md", "README.md", 0, 1024, "1 KB", 1725000001, "2024-08-30");
addRow(".hidden.md", ".hidden.md", 0, 10, "10 B", 0, "1970-01-01");
addRow("logo.png", "logo.png", 0, 2048, "2 KB", 0, "1970-01-01");
addRow("guide.markdown", "guide.markdown", 0, 8, "8 B", 1725000002, "2024-08-30");"#;

    #[test]
    fn reads_utf8_and_escaped_values() {
        let mut cursor = 0;
        assert_eq!(
            super::read_quoted(r#"  "中文 \"文"  "#, &mut cursor),
            Some("中文 \"文".to_string())
        );
    }

    #[test]
    fn reads_numbers_after_separators() {
        let mut cursor = 0;
        assert_eq!(super::read_number(" , -42,", &mut cursor), Some(-42));
    }

    #[test]
    fn keeps_valid_prefix_of_mixed_sign_numbers() {
        // 混合符号串不再整体解析失败归 0，保留首个合法数字前缀
        let mut cursor = 0;
        assert_eq!(super::read_number("12-34", &mut cursor), Some(12));
    }

    #[test]
    fn detects_markdown_filenames() {
        assert!(is_markdown_filename("A.MD"));
        assert!(is_markdown_filename("笔记.TXT"));
        assert!(!is_markdown_filename("photo.png"));
    }

    #[test]
    fn parses_rows_in_order() {
        let items = parse_directory(SAMPLE);
        assert_eq!(items.len(), 5);
        assert!(items[0].is_folder);
        assert_eq!(items[1].size, 1024);
        assert_eq!(items[4].size_unit, "8 B");
    }

#[test]
fn filter_directory_drops_hidden_and_non_markdown() {
    let items = filter_directory(SAMPLE);
    let names: Vec<&str> = items.iter().map(|i| i.name.as_str()).collect();
    assert_eq!(names, vec!["notes", "README.md", "guide.markdown"]);
    assert_eq!(items[1].size, 1024);
}

    #[test]
    fn scan_directory_reports_markdown_and_subfolders() {
        let scan = scan_directory(SAMPLE, "file:///docs");
        assert!(scan.has_markdown);
        assert!(scan.subfolders.is_empty());

        let folders_only = r#"addRow("empty", "empty/", 1, 0, "0 B", 0, "-");
addRow(".git", ".git/", 1, 0, "0 B", 0, "-");
addRow("assets", "assets/", 1, 0, "0 B", 0, "-");"#;
        let scan = scan_directory(folders_only, "file:///docs");
        assert!(!scan.has_markdown);
        assert_eq!(
            scan.subfolders,
            vec!["file:///docs/empty/".to_string(), "file:///docs/assets/".to_string()]
        );
    }

    #[test]
    fn ancestor_urls_walk_from_root() {
        let urls = ancestor_folder_urls("file:///root/", "file:///root/a/b/readme.md");
        assert_eq!(
            urls,
            vec!["file:///root/a/".to_string(), "file:///root/a/b/".to_string()]
        );
        assert!(ancestor_folder_urls("file:///root/", "https://elsewhere/x.md").is_empty());
    }

    #[test]
    fn ancestor_urls_do_not_match_prefix_sibling() {
        // 根 URL 无尾斜杠时不得按裸字符串前缀误匹配同级目录（/root vs /root2）
        assert!(ancestor_folder_urls("file:///root", "file:///root2/a.md").is_empty());
        let urls = ancestor_folder_urls("file:///root", "file:///root/sub/a.md");
        assert_eq!(urls, vec!["file:///root/sub/".to_string()]);
    }
}
