//! 文件夹全文检索：WASM 常驻内存倒排索引。
//!
//! 设计要点（对应 R7 方案 A）：
//! - 分词：CJK（与 stats.rs 同口径）按字切分，拉丁/数字按连续词切分；
//!   查询的拉丁词额外做前缀匹配（`config` → `configuration`），CJK 精确命中。
//! - 权重：标题命中 × [`TITLE_WEIGHT`]，正文命中 × [`BODY_WEIGHT`]。
//! - 摘要：命中词首次出现处前后各取 [`SNIPPET_RADIUS`] 字（字符边界安全），
//!   返回摘要内命中区间，调用方（JS）转义后包 `<mark>` 高亮。
//! - 索引常驻 WASM 线性内存（`thread_local`），JS 侧按工作区签名决定重建时机。

use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;

/// 标题命中的权重（标题加权 > 正文）。
const TITLE_WEIGHT: u32 = 5;
/// 正文命中的权重。
const BODY_WEIGHT: u32 = 1;
/// 默认返回条数上限（与 palette 的 FILTERED_LIMIT 同量级，内容 tab 略放宽）。
const DEFAULT_LIMIT: usize = 20;
/// 搜索条数硬上限：防止调用方误传超大 limit 导致序列化风暴。
const MAX_LIMIT: usize = 50;
/// 摘要半径：命中词前后各取多少字符。
const SNIPPET_RADIUS: usize = 60;

/// CJK 范围与 stats.rs 的 is_cjk 保持一致。
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

fn is_latin_token(token: &str) -> bool {
    !token.is_empty() && token.chars().all(|c| c.is_ascii_alphanumeric())
}

/// 分词：返回小写词元序列。CJK 按字，拉丁/数字按连续串，其余字符为分隔符。
fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut latin = String::new();
    for c in text.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() {
            latin.push(c);
            continue;
        }
        if !latin.is_empty() {
            tokens.push(std::mem::take(&mut latin));
        }
        if is_cjk(c) {
            tokens.push(c.to_string());
        }
        // 其余字符（空白/标点/emoji）均为分隔符
    }
    if !latin.is_empty() {
        tokens.push(latin);
    }
    tokens
}

/// 带位置的分词：返回 (词元, 起始字符下标, 结束字符下标)，供摘要定位。
fn tokenize_with_spans(text: &str) -> Vec<(String, usize, usize)> {
    let mut spans = Vec::new();
    let mut latin = String::new();
    let mut latin_start = 0usize;
    let mut char_idx = 0usize;
    for c in text.chars().flat_map(|c| c.to_lowercase()) {
        if c.is_ascii_alphanumeric() {
            if latin.is_empty() {
                latin_start = char_idx;
            }
            latin.push(c);
        } else {
            if !latin.is_empty() {
                spans.push((std::mem::take(&mut latin), latin_start, char_idx));
            }
            if is_cjk(c) {
                spans.push((c.to_string(), char_idx, char_idx + 1));
            }
        }
        char_idx += 1;
    }
    if !latin.is_empty() {
        spans.push((latin, latin_start, char_idx));
    }
    spans
}

#[derive(Deserialize)]
pub struct FulltextDoc {
    #[serde(default)]
    pub href: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
}

struct IndexedDoc {
    href: String,
    title: String,
    body: String,
}

struct Posting {
    doc: usize,
    title: u32,
    body: u32,
}

#[derive(Default)]
struct FulltextIndex {
    docs: Vec<IndexedDoc>,
    /// 词元 → 倒排链（按 doc 序插入，天然有序）。
    postings: HashMap<String, Vec<Posting>>,
}

impl FulltextIndex {
    fn build(docs: Vec<FulltextDoc>) -> Self {
        let mut index = FulltextIndex::default();
        for doc in docs {
            if doc.href.is_empty() {
                continue;
            }
            let doc_idx = index.docs.len();
            // 先分词计数再入表：避免借用冲突
            let title_tokens = tokenize(&doc.title);
            let body_tokens = tokenize(&doc.body);
            // 复用 tokens 做计数（String key 简单直接，建索引为一次性成本）
            let mut title_map: HashMap<String, u32> = HashMap::new();
            for t in title_tokens {
                *title_map.entry(t).or_insert(0) += 1;
            }
            let mut body_map: HashMap<String, u32> = HashMap::new();
            for t in body_tokens {
                *body_map.entry(t).or_insert(0) += 1;
            }
            for (token, count) in title_map {
                index
                    .postings
                    .entry(token)
                    .or_default()
                    .push(Posting { doc: doc_idx, title: count, body: 0 });
            }
            for (token, count) in body_map {
                match index.postings.entry(token) {
                    std::collections::hash_map::Entry::Occupied(mut e) => {
                        if let Some(p) = e.get_mut().iter_mut().find(|p| p.doc == doc_idx) {
                            p.body = count;
                        } else {
                            e.into_mut().push(Posting { doc: doc_idx, title: 0, body: count });
                        }
                    }
                    std::collections::hash_map::Entry::Vacant(e) => {
                        e.insert(vec![Posting { doc: doc_idx, title: 0, body: count }]);
                    }
                }
            }
            index.docs.push(IndexedDoc { href: doc.href, title: doc.title, body: doc.body });
        }
        index
    }

    fn doc_count(&self) -> u32 {
        self.docs.len() as u32
    }

    /// 查询词在某文档的命中位置（字符区间），用于摘要。
    /// 拉丁查询词匹配以它为前缀的词元，CJK 精确匹配。
    fn match_spans(&self, doc_idx: usize, query_tokens: &[String]) -> Vec<(usize, usize)> {
        let doc = &self.docs[doc_idx];
        let mut spans = Vec::new();
        for (token, start, end) in tokenize_with_spans(&doc.body) {
            for q in query_tokens {
                if token == *q || (is_latin_token(q) && token.starts_with(q.as_str())) {
                    spans.push((start, end));
                    break;
                }
            }
        }
        spans.sort_unstable();
        spans
    }

    fn search(&self, query: &str, limit: usize) -> Vec<FulltextHit> {
        let query_tokens = tokenize(query);
        if query_tokens.is_empty() {
            return Vec::new();
        }
        // 去重查询词：重复词不应重复加分
        let mut unique: Vec<&String> = Vec::with_capacity(query_tokens.len());
        for q in &query_tokens {
            if !unique.contains(&q) {
                unique.push(q);
            }
        }
        let mut scores: HashMap<usize, u32> = HashMap::new();
        for q in unique {
            // 精确命中
            if let Some(list) = self.postings.get(q.as_str()) {
                for p in list {
                    *scores.entry(p.doc).or_insert(0) +=
                        p.title * TITLE_WEIGHT + p.body * BODY_WEIGHT;
                }
            }
            // 拉丁前缀扩展（精确命中过的词元不再重复加分）
            if is_latin_token(q) {
                for (token, list) in self.postings.iter() {
                    if token.len() > q.len() && token.starts_with(q.as_str()) {
                        for p in list {
                            *scores.entry(p.doc).or_insert(0) +=
                                p.title * TITLE_WEIGHT + p.body * BODY_WEIGHT;
                        }
                    }
                }
            }
        }
        let mut ranked: Vec<(usize, u32)> = scores.into_iter().filter(|(_, s)| *s > 0).collect();
        // 分数降序，同分按 href 升序保证确定性
        ranked.sort_by(|a, b| {
            b.1.cmp(&a.1)
                .then_with(|| self.docs[a.0].href.cmp(&self.docs[b.0].href))
        });
        ranked
            .into_iter()
            .take(limit.min(MAX_LIMIT).max(1))
            .map(|(doc_idx, score)| {
                let (snippet, highlights) = make_snippet(self, doc_idx, &query_tokens);
                FulltextHit {
                    href: self.docs[doc_idx].href.clone(),
                    title: self.docs[doc_idx].title.clone(),
                    snippet,
                    highlights,
                    score,
                }
            })
            .collect()
    }
}

/// 摘要：首个命中区间前后各取 SNIPPET_RADIUS 字；highlights 为相对摘要的字符区间。
fn make_snippet(
    index: &FulltextIndex,
    doc_idx: usize,
    query_tokens: &[String],
) -> (String, Vec<(usize, usize)>) {
    let body_chars: Vec<char> = index.docs[doc_idx].body.chars().collect();
    if body_chars.is_empty() {
        return (String::new(), Vec::new());
    }
    let spans = index.match_spans(doc_idx, query_tokens);
    if spans.is_empty() {
        // 标题命中但正文无命中：取正文开头
        let end = SNIPPET_RADIUS.min(body_chars.len());
        return (body_chars[..end].iter().collect(), Vec::new());
    }
    let first_start = spans[0].0;
    let win_start = first_start.saturating_sub(SNIPPET_RADIUS);
    let win_end = (first_start + SNIPPET_RADIUS).min(body_chars.len());
    let snippet: String = body_chars[win_start..win_end].iter().collect();
    let mut highlights = Vec::new();
    for (s, e) in spans {
        if e <= win_start || s >= win_end {
            continue;
        }
        highlights.push((s.max(win_start) - win_start, e.min(win_end) - win_start));
    }
    (snippet, highlights)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FulltextHit {
    pub href: String,
    pub title: String,
    pub snippet: String,
    /// 摘要内的命中区间（字符下标 [start, end)），供 JS 转义后包 <mark>。
    pub highlights: Vec<(usize, usize)>,
    pub score: u32,
}

thread_local! {
    static FULLTEXT_INDEX: RefCell<FulltextIndex> = RefCell::new(FulltextIndex::default());
}

/// 建（重建）全文索引：替换常驻索引，返回收录文档数。
pub fn fulltext_index_build(docs: Vec<FulltextDoc>) -> u32 {
    let index = FulltextIndex::build(docs);
    let count = index.doc_count();
    FULLTEXT_INDEX.with(|cell| {
        *cell.borrow_mut() = index;
    });
    count
}

/// 全文检索：返回 ranked hits（含摘要与高亮区间）。
pub fn fulltext_search(query: &str, limit: usize) -> Vec<FulltextHit> {
    FULLTEXT_INDEX.with(|cell| cell.borrow().search(query, limit))
}

/// 当前常驻索引的文档数（供 JS 侧状态展示与测试）。
pub fn fulltext_doc_count() -> u32 {
    FULLTEXT_INDEX.with(|cell| cell.borrow().doc_count())
}

pub fn default_limit() -> usize {
    DEFAULT_LIMIT
}

#[cfg(test)]
mod tests {
    use super::{
        fulltext_doc_count, fulltext_index_build, fulltext_search, tokenize, FulltextDoc,
        DEFAULT_LIMIT,
    };

    fn docs() -> Vec<FulltextDoc> {
        vec![
            FulltextDoc {
                href: "file:///guide.md".into(),
                title: "使用指南".into(),
                body: "全文检索支持中文分词。配置文件 config.yaml 控制行为。".into(),
            },
            FulltextDoc {
                href: "file:///config.md".into(),
                title: "configuration".into(),
                body: "configuration details for the advanced configuration system.".into(),
            },
            FulltextDoc {
                href: "file:///empty.md".into(),
                title: "空文档".into(),
                body: "".into(),
            },
        ]
    }

    fn build() -> u32 {
        fulltext_index_build(docs())
    }

    #[test]
    fn tokenizes_mixed_cjk_latin() {
        assert_eq!(tokenize("全文检索 config"), vec!["全", "文", "检", "索", "config"]);
        assert_eq!(tokenize("Hello, World!"), vec!["hello", "world"]);
        assert_eq!(tokenize("a😀b"), vec!["a", "b"]);
        assert!(tokenize("  ，！ ").is_empty());
    }

    #[test]
    fn build_returns_doc_count_and_replaces() {
        assert_eq!(build(), 3);
        assert_eq!(fulltext_doc_count(), 3);
        // 空 href 被跳过；重建替换旧索引
        assert_eq!(
            fulltext_index_build(vec![FulltextDoc {
                href: "".into(),
                title: "x".into(),
                body: "y".into(),
            }]),
            0
        );
        assert_eq!(fulltext_doc_count(), 0);
    }

    #[test]
    fn title_weight_beats_body() {
        build();
        // “配置”只出现在 guide.md 正文；“configuration” 是 config.md 标题
        let hits = fulltext_search("configuration", 10);
        assert!(!hits.is_empty());
        assert_eq!(hits[0].href, "file:///config.md");
        // 标题命中分更高：config.md(标题 2 次) 应高于纯正文命中
        let zh = fulltext_search("配置", 10);
        assert_eq!(zh.len(), 1);
        assert_eq!(zh[0].href, "file:///guide.md");
    }

    #[test]
    fn latin_prefix_matches() {
        build();
        let hits = fulltext_search("config", 10);
        // 前缀同时命中 guide.md 正文 config.yaml 与 config.md 标题/正文
        let hrefs: Vec<&str> = hits.iter().map(|h| h.href.as_str()).collect();
        assert!(hrefs.contains(&"file:///config.md"));
        assert!(hrefs.contains(&"file:///guide.md"));
        // 标题加权使 config.md 排第一
        assert_eq!(hits[0].href, "file:///config.md");
    }

    #[test]
    fn snippet_window_and_highlights_are_char_safe() {
        build();
        let hits = fulltext_search("分词", 10);
        assert_eq!(hits.len(), 1);
        let hit = &hits[0];
        // 摘要包含命中词，且高亮区间落在摘要内、字符边界合法
        assert!(hit.snippet.contains('分'));
        assert!(!hit.highlights.is_empty());
        let chars: Vec<char> = hit.snippet.chars().collect();
        for (s, e) in &hit.highlights {
            assert!(s <= e && *e <= chars.len());
            let marked: String = chars[*s..*e].iter().collect();
            assert!(marked == "分" || marked == "词");
        }
    }

    #[test]
    fn empty_query_and_limit() {
        build();
        assert!(fulltext_search("", 10).is_empty());
        assert!(fulltext_search("   ", 10).is_empty());
        // limit 生效且至少为 1
        let hits = fulltext_search("a", 0);
        assert!(hits.len() <= 1);
        let many = fulltext_search("e", 1);
        assert!(many.len() <= 1);
        assert_eq!(DEFAULT_LIMIT, 20);
    }

    #[test]
    fn duplicate_query_terms_do_not_double_score() {
        build();
        let once = fulltext_search("配置", 10);
        let twice = fulltext_search("配置 配置", 10);
        assert_eq!(once.len(), twice.len());
        assert_eq!(once[0].score, twice[0].score);
    }

    #[test]
    fn deterministic_tiebreak_by_href() {
        fulltext_index_build(vec![
            FulltextDoc { href: "file:///b.md".into(), title: "t".into(), body: "相同".into() },
            FulltextDoc { href: "file:///a.md".into(), title: "t".into(), body: "相同".into() },
        ]);
        let hits = fulltext_search("相同", 10);
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].href, "file:///a.md");
        assert_eq!(hits[1].href, "file:///b.md");
    }
}
