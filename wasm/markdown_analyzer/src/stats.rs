//! 文档统计：词数与预计阅读时长（与 JS 版统计口径一致）。

use serde::Serialize;

#[derive(Serialize)]
pub struct DocStats {
    pub words: i64,
    pub minutes: i64,
}

/// CJK 表意/音节字符（含中日韩标点）：按字计数，不参与拉丁词聚合。
fn is_cjk(c: char) -> bool {
    matches!(
        c as u32,
        0x3000..=0x303F   // CJK 符号与标点
            | 0x3040..=0x30FF // 平假名 / 片假名
            | 0x3400..=0x4DBF // CJK 扩展 A
            | 0x4E00..=0x9FFF // CJK 统一表意文字
            | 0xAC00..=0xD7AF // 谚文音节
            | 0xF900..=0xFAFF // CJK 兼容表意
    )
}

/// 词数统计：CJK 字符按字计，其余连续非空白串按词计。
/// 纯中文与纯英文文档的阅读时长都不会系统性偏差（此前把英文按字符计，
/// 阅读时长会被高估约 5 倍）。时长按每分钟 400 词向上取整，最小 1 分钟。
pub fn doc_stats(raw: &str) -> DocStats {
    let mut words: i64 = 0;
    let mut in_word = false;
    for c in raw.chars() {
        if c.is_whitespace() || c == '\u{feff}' {
            in_word = false;
            continue;
        }
        if is_cjk(c) {
            words += c.len_utf16() as i64;
            in_word = false;
        } else {
            if !in_word {
                words += 1;
                in_word = true;
            }
        }
    }
    let minutes = ((words as f64 / 400.0).ceil() as i64).max(1);
    DocStats { words, minutes }
}

#[cfg(test)]
mod tests {
    use super::doc_stats;

    #[test]
    fn counts_cjk_chars_and_latin_words() {
        assert_eq!(doc_stats("hello world").words, 2);
        assert_eq!(doc_stats("你好，世界！").words, 6);
        // 连续非空白非 CJK 串（含 Emoji）聚合为一个词
        assert_eq!(doc_stats("a😀b").words, 1);
        // 中英混排：2 个汉字 + 1 个拉丁词
        assert_eq!(doc_stats("中文 words").words, 3);
        assert_eq!(doc_stats(" \t\r\n\u{feff}").words, 0);
    }

    #[test]
    fn reading_time_is_at_least_one_minute() {
        assert_eq!(doc_stats("").minutes, 1);
        assert_eq!(doc_stats("短文").minutes, 1);
        let long = "字".repeat(801);
        assert_eq!(doc_stats(&long).minutes, 3);
        let english = "word ".repeat(801);
        assert_eq!(doc_stats(&english).words, 801);
        assert_eq!(doc_stats(&english).minutes, 3);
    }
}
