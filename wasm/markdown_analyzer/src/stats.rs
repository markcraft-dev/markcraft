//! 文档统计：字数与预计阅读时长（与 JS 版统计口径一致）。

use serde::Serialize;

#[derive(Serialize)]
pub struct DocStats {
    pub words: i64,
    pub minutes: i64,
}

/// 统计去除全部空白后的字符数（按 UTF-16 码元计数，对齐 JS `.length`），
/// 阅读时长按每分钟 400 字向上取整，最小 1 分钟。
pub fn doc_stats(raw: &str) -> DocStats {
    let words: i64 = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '\u{feff}')
        .map(|c| c.len_utf16() as i64)
        .sum();
    let minutes = ((words as f64 / 400.0).ceil() as i64).max(1);
    DocStats { words, minutes }
}

#[cfg(test)]
mod tests {
    use super::doc_stats;

    #[test]
    fn counts_utf16_units_ignoring_whitespace() {
        assert_eq!(doc_stats("hello world").words, 10);
        assert_eq!(doc_stats("你好，世界！").words, 6);
        // 代理对（Emoji）在 JS `.length` 中计 2
        assert_eq!(doc_stats("a😀b").words, 4);
        assert_eq!(doc_stats(" \t\r\n\u{feff}").words, 0);
    }

    #[test]
    fn reading_time_is_at_least_one_minute() {
        assert_eq!(doc_stats("").minutes, 1);
        assert_eq!(doc_stats("短文").minutes, 1);
        let long = "字".repeat(801);
        assert_eq!(doc_stats(&long).minutes, 3);
    }
}
