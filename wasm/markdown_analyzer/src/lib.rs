//! MarkCraft 核心算法 WASM 模块。
//!
//! JavaScript 层负责 DOM 读取、网络与浏览器 API；所有纯算法集中在
//! 本 crate：目录解析与过滤、标题 slug 与大纲、DOM 快照转 Markdown、
//! 快捷搜索、文档统计。

mod directory;
mod dommd;
mod outline;
mod palette;
mod slug;
mod stats;

use wasm_bindgen::prelude::*;

use crate::outline::{HeadingInput, OutlineResult};
use crate::palette::{PaletteFileNode, PaletteHeading, PaletteResult};

fn to_value<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(value).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// 解析目录页面的 addRow 调用，保持网络与 DOM 逻辑在 JavaScript 层。
#[wasm_bindgen]
pub fn parse_directory(source: &str) -> Result<JsValue, JsValue> {
    to_value(&directory::parse_directory(source))
}

/// 过滤隐藏文件与非 Markdown 条目，保持原有顺序。
#[wasm_bindgen]
pub fn filter_directory(source: &str) -> Result<JsValue, JsValue> {
    to_value(&directory::filter_directory(source))
}

/// 单页扫描：页面内是否含 Markdown 文件，以及待递归的子目录 URL。
#[wasm_bindgen]
pub fn scan_directory(source: &str, base_url: &str) -> Result<JsValue, JsValue> {
    to_value(&directory::scan_directory(source, base_url))
}

/// 推导目标文件自根向下的全部祖先目录 URL。
#[wasm_bindgen]
pub fn ancestor_folder_urls(root_url: &str, target_file_url: &str) -> Result<JsValue, JsValue> {
    to_value(&directory::ancestor_folder_urls(root_url, target_file_url))
}

/// 构建文章大纲：`headings` 为 `[{text, level}]`，返回 `{tree, list}`。
/// 注意：wasm-bindgen 将 i64 映射为 BigInt，导出参数需用 i32 以便 JS 直接传 number。
#[wasm_bindgen]
pub fn build_outline(headings: JsValue, max_level: i32) -> Result<JsValue, JsValue> {
    let parsed: Vec<HeadingInput> = serde_wasm_bindgen::from_value(headings)?;
    let result: OutlineResult = outline::build_outline(&parsed, max_level as i64);
    to_value(&result)
}

/// 快捷搜索：扁平化文件树、合并标题条目并按查询过滤。
#[wasm_bindgen]
pub fn search_palette(files: JsValue, headings: JsValue, query: &str) -> Result<JsValue, JsValue> {
    let parsed_files: Vec<PaletteFileNode> = serde_wasm_bindgen::from_value(files)?;
    let parsed_headings: Vec<PaletteHeading> = serde_wasm_bindgen::from_value(headings)?;
    let results: Vec<PaletteResult> = palette::search_palette(&parsed_files, &parsed_headings, query);
    to_value(&results)
}

/// 将 DOM 快照（通用 JSON 树）序列化回标准 GFM Markdown。
/// 快照解析为迭代实现并限深 [`dommd::MAX_SNAPSHOT_DEPTH`]，
/// 超深快照直接报错，调用方回退 JS 实现（快照端同样限深 512）。
#[wasm_bindgen]
pub fn dom_to_markdown(dom: JsValue) -> Result<String, JsValue> {
    let root = dommd::parse_snapshot(&dom).map_err(|e| JsValue::from_str(&e))?;
    Ok(dommd::dom_to_markdown(&root))
}

/// 文档统计：`{words, minutes}`。
#[wasm_bindgen]
pub fn doc_stats(raw: &str) -> Result<JsValue, JsValue> {
    to_value(&stats::doc_stats(raw))
}
