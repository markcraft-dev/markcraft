use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
struct DirectoryItem {
    name: String,
    path: String,
    is_folder: bool,
    size: u64,
    size_unit: String,
    timestamp: i64,
    date: String,
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
    while *cursor < source.len() {
        let ch = source[*cursor..].chars().next()?;
        if !ch.is_ascii_digit() && ch != '-' {
            break;
        }
        *cursor += ch.len_utf8();
    }
    source.get(start..*cursor)?.parse().ok()
}

/// 解析目录页面的 addRow 调用，保持网络与 DOM 逻辑在 JavaScript 层。
#[wasm_bindgen]
pub fn parse_directory(source: &str) -> JsValue {
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
    serde_wasm_bindgen::to_value(&items).unwrap_or(JsValue::NULL)
}

#[cfg(test)]
mod tests {
    use super::{read_number, read_quoted};

    #[test]
    fn reads_utf8_and_escaped_values() {
        let mut cursor = 0;
        assert_eq!(
            read_quoted(r#"  "中文 \"文"  "#, &mut cursor),
            Some("中文 \"文".to_string())
        );
    }

    #[test]
    fn reads_numbers_after_separators() {
        let mut cursor = 0;
        assert_eq!(read_number(" , -42,", &mut cursor), Some(-42));
    }
}
