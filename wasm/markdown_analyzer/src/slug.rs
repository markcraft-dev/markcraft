//! 标题 slug 生成：复刻 JavaScript 版 `generateSlug` 的字符过滤与 `encodeURIComponent` 行为。

/// JS 过滤正则保留 `\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}`、连字符与空格。
/// std 无完整 Unicode 类别表，采用以下等价近似：
/// - `is_alphabetic`（Alphabetic 属性）是 `\p{L} ∪ \p{Nl}` 的超集，且命中的附加字符基本属于 `\p{M}`，均属保留类别；
/// - `\p{Nd}` 用 `is_numeric` 近似（额外保留了极少出现的 `\p{No}` 字符）。
fn is_slug_char(c: char) -> bool {
    c == '-' || c == ' ' || c == '_' || c.is_ascii_alphanumeric() || c.is_alphabetic() || c.is_numeric()
}

/// 与 `encodeURIComponent` 保持一致：仅 `A-Z a-z 0-9 - _ . ! ~ * ' ( )` 不转义，
/// 其余字符按 UTF-8 字节输出为大写 `%XX`。
pub fn encode_uri_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '!' | '~' | '*' | '\'' | '(' | ')') {
            out.push(c);
        } else {
            let mut buf = [0u8; 4];
            for byte in c.encode_utf8(&mut buf).as_bytes() {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    out
}

/// 生成 slug 基名：小写 → 空格转连字符 → 过滤非法字符 → 修剪首尾连字符（GitHub 式）→ 百分号编码。
pub fn slugify(text: &str) -> String {
    let lowered = text.to_lowercase();
    let mut filtered = String::with_capacity(lowered.len());
    for c in lowered.chars() {
        if c == ' ' {
            filtered.push('-');
        } else if is_slug_char(c) {
            filtered.push(c);
        }
    }
    encode_uri_component(filtered.trim_matches('-'))
}

#[cfg(test)]
mod tests {
    use super::{encode_uri_component, slugify};

    #[test]
    fn encodes_like_encode_uri_component() {
        assert_eq!(encode_uri_component("a b&c/d?e#f"), "a%20b%26c%2Fd%3Fe%23f");
        assert_eq!(encode_uri_component("-_.!~*'()"), "-_.!~*'()");
        assert_eq!(encode_uri_component("中文"), "%E4%B8%AD%E6%96%87");
    }

    #[test]
    fn slugifies_cjk_and_ascii() {
        assert_eq!(slugify("中文 标题"), "%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98");
        assert_eq!(slugify("Hello, World!"), "hello-world");
        // 首尾空格转成的连字符按 GitHub 行为修剪；中间连续空格保留为连续连字符
        assert_eq!(slugify("  Trim  Me  "), "trim--me");
        assert_eq!(slugify("type_view v2"), "type_view-v2");
        assert_eq!(slugify("50% off?"), "50-off");
    }

    #[test]
    fn keeps_marks_and_digits() {
        // é 属 \p{L}，组合音符属 \p{M}：均应保留后再编码。
        assert_eq!(slugify("café"), "caf%C3%A9");
        assert_eq!(slugify("第 1 章"), "%E7%AC%AC-1-%E7%AB%A0");
    }

    #[test]
    fn empty_text_yields_empty_base() {
        assert_eq!(slugify("!!!"), "");
    }
}
