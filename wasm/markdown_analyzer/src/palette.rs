//! 快捷搜索面板：文件树扁平化、标题条目映射与查询过滤。

use serde::{Deserialize, Serialize};

/// 空查询时展示的推荐条目上限（与 JS 版 `slice(0, 12)` 对齐）。
const EMPTY_QUERY_LIMIT: usize = 12;
/// 关键词过滤后的结果上限（与 JS 版 `slice(0, 16)` 对齐）。
const FILTERED_LIMIT: usize = 16;

#[derive(Deserialize)]
pub struct PaletteFileNode {
    #[serde(default)]
    pub content: String,
    // 前端 TreeNodeItem 使用驼峰字段名
    #[serde(rename = "isFolder", default)]
    pub is_folder: bool,
    #[serde(default)]
    pub href: String,
    #[serde(default)]
    pub children: Option<Vec<PaletteFileNode>>,
}

#[derive(Deserialize)]
pub struct PaletteHeading {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub href: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub level: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaletteResult {
    pub id: PaletteId,
    pub title: String,
    pub href: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_heading: Option<bool>,
}

/// 文件条目的 id 是 href 字符串，标题条目的 id 沿用数字编号（与 JS 行为一致）。
#[derive(Serialize, Clone)]
#[serde(untagged)]
pub enum PaletteId {
    Text(String),
    Number(i64),
}

fn file_result(node: &PaletteFileNode, path: &str) -> PaletteResult {
    PaletteResult {
        id: PaletteId::Text(node.href.clone()),
        title: node.content.clone(),
        href: node.href.clone(),
        sub_path: Some(path.strip_suffix('/').unwrap_or(path).to_string()),
        is_heading: None,
    }
}

fn heading_result(heading: &PaletteHeading) -> PaletteResult {
    PaletteResult {
        id: PaletteId::Number(heading.id),
        title: heading.content.clone(),
        href: heading.href.clone(),
        sub_path: Some(format!("文章大纲 H{} 章节", heading.level)),
        is_heading: Some(true),
    }
}

fn flatten_files(nodes: &[PaletteFileNode], path: &str, out: &mut Vec<PaletteResult>) {
    for node in nodes {
        if node.is_folder {
            if let Some(children) = &node.children {
                let sub = format!("{path}{}/", node.content);
                flatten_files(children, &sub, out);
            }
            continue;
        }
        out.push(file_result(node, path));
    }
}

fn heading_items(headings: &[PaletteHeading]) -> Vec<PaletteResult> {
    headings.iter().map(heading_result).collect()
}

/// 汇总文件与标题条目并按查询过滤；空查询返回推荐前缀，有关键词时做包含匹配。
pub fn search_palette(
    files: &[PaletteFileNode],
    headings: &[PaletteHeading],
    query: &str,
) -> Vec<PaletteResult> {
    let key = query.trim().to_lowercase();
    if key.is_empty() {
        // 空查询惰性展开：凑满推荐条数即停，不再全量扁平化大树
        let mut combined: Vec<PaletteResult> = Vec::with_capacity(EMPTY_QUERY_LIMIT);
        let mut stack: Vec<(&PaletteFileNode, String)> =
            files.iter().rev().map(|n| (n, String::new())).collect();
        while let Some((node, path)) = stack.pop() {
            if combined.len() >= EMPTY_QUERY_LIMIT {
                break;
            }
            if node.is_folder {
                if let Some(children) = &node.children {
                    let sub = format!("{path}{}/", node.content);
                    stack.extend(children.iter().rev().map(|c| (c, sub.clone())));
                }
                continue;
            }
            combined.push(file_result(node, &path));
        }
        if combined.len() < EMPTY_QUERY_LIMIT {
            for heading in headings.iter().take(EMPTY_QUERY_LIMIT - combined.len()) {
                combined.push(heading_result(heading));
            }
        }
        return combined;
    }

    let mut combined = Vec::new();
    flatten_files(files, "", &mut combined);
    combined.extend(heading_items(headings));

    combined
        .into_iter()
        .filter(|item| {
            item.title.to_lowercase().contains(&key)
                || item
                    .sub_path
                    .as_ref()
                    .is_some_and(|sub| sub.to_lowercase().contains(&key))
        })
        .take(FILTERED_LIMIT)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{search_palette, PaletteFileNode, PaletteHeading};

    fn files() -> Vec<PaletteFileNode> {
        // 手工构造测试树（不引入 serde_json 依赖）。
        vec![
            PaletteFileNode {
                content: "docs".into(),
                is_folder: true,
                href: "file:///docs/".into(),
                children: Some(vec![
                    PaletteFileNode {
                        content: "guide.md".into(),
                        is_folder: false,
                        href: "file:///docs/guide.md".into(),
                        children: None,
                    },
                    PaletteFileNode {
                        content: "nested".into(),
                        is_folder: true,
                        href: "file:///docs/nested/".into(),
                        children: Some(vec![PaletteFileNode {
                            content: "deep.md".into(),
                            is_folder: false,
                            href: "file:///docs/nested/deep.md".into(),
                            children: None,
                        }]),
                    },
                ]),
            },
            PaletteFileNode {
                content: "README.md".into(),
                is_folder: false,
                href: "file:///README.md".into(),
                children: None,
            },
        ]
    }

    fn headings() -> Vec<PaletteHeading> {
        vec![PaletteHeading {
            id: 3,
            href: "#%E7%AE%80%E4%BB%8B".into(),
            content: "简介".into(),
            level: 2,
        }]
    }

    #[test]
    fn flattens_tree_with_sub_paths() {
        let result = search_palette(&files(), &headings(), "");
        // 空查询仅返回前 12 条：3 个文件 + 1 个标题
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].href, "file:///docs/guide.md");
        assert_eq!(result[0].sub_path.as_deref(), Some("docs"));
        assert_eq!(result[1].sub_path.as_deref(), Some("docs/nested"));
        assert_eq!(result[2].sub_path.as_deref(), Some(""));
        assert!(result[2].is_heading.is_none());
        assert_eq!(result[3].is_heading, Some(true));
        assert_eq!(result[3].sub_path.as_deref(), Some("文章大纲 H2 章节"));
    }

    #[test]
    fn filters_by_title_and_sub_path() {
        let result = search_palette(&files(), &headings(), "DEEP");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].href, "file:///docs/nested/deep.md");

        let by_path = search_palette(&files(), &headings(), "docs");
        assert_eq!(by_path.len(), 2);
        assert_eq!(by_path[1].href, "file:///docs/nested/deep.md");

        let heading_hit = search_palette(&files(), &headings(), "简介");
        assert_eq!(heading_hit.len(), 1);
        assert_eq!(heading_hit[0].is_heading, Some(true));

        assert!(search_palette(&files(), &headings(), "  不存在  ").is_empty());
    }

    #[test]
    fn folder_without_children_is_skipped() {
        let orphan = vec![PaletteFileNode {
            content: "empty".into(),
            is_folder: true,
            href: "file:///empty/".into(),
            children: None,
        }];
        let result = search_palette(&orphan, &[], "");
        assert!(result.is_empty());
    }

    #[test]
    fn deserializes_camel_case_tree_nodes() {
        // 前端 TreeNodeItem 为驼峰命名；字段名不一致会被 serde 静默置默认值，需回归守护。
        let node: PaletteFileNode = serde_json::from_str(
            r#"{"content":"docs","isFolder":true,"href":"file:///docs/","children":[{"content":"a.md","isFolder":false,"href":"file:///docs/a.md"}]}"#,
        )
        .unwrap();
        assert!(node.is_folder);
        assert_eq!(node.children.as_ref().unwrap()[0].href, "file:///docs/a.md");
    }

    #[test]
    fn deserializes_heading_entry_fields() {
        // 标题条目的 id/href/content/level 同样是关键字段，防字段漂移静默置默认值
        let heading: PaletteHeading = serde_json::from_str(
            r##"{"id":7,"href":"#%E6%A0%87%E9%A2%98","content":"标题","level":3}"##,
        )
        .unwrap();
        assert_eq!(heading.id, 7);
        assert_eq!(heading.level, 3);
        assert_eq!(heading.href, "#%E6%A0%87%E9%A2%98");
        assert_eq!(heading.content, "标题");
    }
}
