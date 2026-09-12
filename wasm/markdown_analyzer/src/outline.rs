//! 文章大纲构建：slug 去重、扁平列表与层级树。

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::slug::slugify;

#[derive(Deserialize)]
pub struct HeadingInput {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub level: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutlineEntry {
    pub id: i64,
    pub parent_id: Option<i64>,
    pub href: String,
    pub content: String,
    pub level: i64,
    pub active: bool,
    pub expanded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<OutlineEntry>>,
}

#[derive(Serialize)]
pub struct OutlineResult {
    pub tree: Vec<OutlineEntry>,
    pub list: Vec<OutlineEntry>,
}

/// 与 JS 版 `generateSlug` 一致的重名处理：维护「已用集合」，基名被占用后
/// 依次尝试 `-1`、`-2`……直到找到未占用的 slug，保证全局唯一（GitHub 式行为）。
/// 只按基名计数会让 `a, a, a-1` 序列产出重复的 `#a-1`。
fn unique_slug(base: &str, used: &mut HashSet<String>) -> String {
    if used.insert(base.to_string()) {
        return base.to_string();
    }
    let mut n: i64 = 1;
    loop {
        let candidate = format!("{base}-{n}");
        if used.insert(candidate.clone()) {
            return candidate;
        }
        n += 1;
    }
}

/// 输入按文档顺序排列的标题（文本已去除首尾空白），输出扁平列表与嵌套树。
pub fn build_outline(headings: &[HeadingInput], max_level: i64) -> OutlineResult {
    let mut flat: Vec<OutlineEntry> = Vec::new();
    let mut used_slugs: HashSet<String> = HashSet::new();
    // 栈中保存 (条目 id, 标题层级)
    let mut stack: Vec<(i64, i64)> = Vec::new();

    for (idx, heading) in headings.iter().enumerate() {
        let text = heading.text.trim();
        // 纯符号标题（如 "!!!"）slug 为空串会产出非法 id 与 `#` 空锚点，
        // 回退到固定前缀 `section`，去重器保证 section/section-1/… 全局唯一
        let base = match slugify(text) {
            base if base.is_empty() => "section".to_string(),
            base => base,
        };
        let slug = unique_slug(&base, &mut used_slugs);
        let level = heading.level;
        let id = idx as i64;

        while let Some((_, top_level)) = stack.last() {
            if *top_level >= level {
                stack.pop();
            } else {
                break;
            }
        }

        let parent_id = stack.last().map(|(pid, _)| *pid);
        let entry = OutlineEntry {
            id,
            parent_id,
            href: format!("#{slug}"),
            content: text.to_string(),
            level,
            active: false,
            expanded: level <= max_level,
            children: None,
        };

        stack.push((id, level));
        flat.push(entry);
    }

    let tree = assemble_tree(&flat);
    OutlineResult { tree, list: flat }
}

/// 依据 parent_id 链接重建嵌套树，保持文档顺序。
fn assemble_tree(flat: &[OutlineEntry]) -> Vec<OutlineEntry> {
    let mut children_map: HashMap<i64, Vec<usize>> = HashMap::new();
    let mut roots: Vec<usize> = Vec::new();
    for (idx, entry) in flat.iter().enumerate() {
        match entry.parent_id {
            Some(pid) => children_map.entry(pid).or_default().push(idx),
            None => roots.push(idx),
        }
    }

    fn build(
        indices: &[usize],
        flat: &[OutlineEntry],
        children_map: &HashMap<i64, Vec<usize>>,
    ) -> Vec<OutlineEntry> {
        indices
            .iter()
            .map(|&idx| {
                let mut entry = flat[idx].clone();
                if let Some(children) = children_map.get(&entry.id) {
                    let built = build(children, flat, children_map);
                    if !built.is_empty() {
                        entry.children = Some(built);
                    }
                }
                entry
            })
            .collect()
    }

    build(&roots, flat, &children_map)
}

#[cfg(test)]
mod tests {
    use super::{build_outline, HeadingInput};

    fn headings(items: &[(&str, i64)]) -> Vec<HeadingInput> {
        items
            .iter()
            .map(|(text, level)| HeadingInput {
                text: text.to_string(),
                level: *level,
            })
            .collect()
    }

    #[test]
    fn builds_tree_and_flat_list() {
        let result = build_outline(
            &headings(&[("Top", 1), ("Sub A", 2), ("Deep", 3), ("Sub B", 2), ("Second", 1)]),
            6,
        );
        assert_eq!(result.list.len(), 5);
        assert_eq!(result.tree.len(), 2);

        let top = &result.tree[0];
        assert_eq!(top.href, "#top");
        let children = top.children.as_ref().unwrap();
        assert_eq!(children.len(), 2);
        assert_eq!(children[0].parent_id, Some(0));
        assert!(children[0].children.as_ref().unwrap()[0].href == "#deep");
        assert!(result.tree[1].children.is_none());
    }

    #[test]
    fn dedupes_slugs_like_js() {
        let result = build_outline(&headings(&[("同一名", 2), ("同一名", 2), ("同一名", 2)]), 6);
        let hrefs: Vec<&str> = result.list.iter().map(|e| e.href.as_str()).collect();
        assert_eq!(hrefs, vec!["#%E5%90%8C%E4%B8%80%E5%90%8D", "#%E5%90%8C%E4%B8%80%E5%90%8D-1", "#%E5%90%8C%E4%B8%80%E5%90%8D-2"]);
    }

    #[test]
    fn keeps_slugs_unique_on_base_collision() {
        // 「a, a, a-1」序列：只按基名计数会让第三个标题撞上已占用的 #a-1；
        // 已用集合 + 递增后缀保证全局唯一。
        let result = build_outline(&headings(&[("a", 1), ("a", 1), ("a-1", 1)]), 6);
        let hrefs: Vec<&str> = result.list.iter().map(|e| e.href.as_str()).collect();
        assert_eq!(hrefs, vec!["#a", "#a-1", "#a-1-1"]);
    }

    #[test]
    fn falls_back_to_section_prefix_for_empty_slugs() {
        // 纯符号标题的空 slug 回退为 section 前缀，不再产出非法空 id 与 # 空锚点
        let result = build_outline(&headings(&[("!!!", 2), ("!!!", 2)]), 6);
        let hrefs: Vec<&str> = result.list.iter().map(|e| e.href.as_str()).collect();
        assert_eq!(hrefs, vec!["#section", "#section-1"]);
    }

    #[test]
    fn respects_max_expand_level() {
        let result = build_outline(&headings(&[("A", 1), ("B", 4), ("C", 6)]), 4);
        assert!(result.list[0].expanded);
        assert!(result.list[1].expanded);
        assert!(!result.list[2].expanded);
    }

    #[test]
    fn empty_input_yields_empty_result() {
        let result = build_outline(&[], 6);
        assert!(result.tree.is_empty());
        assert!(result.list.is_empty());
    }
}
