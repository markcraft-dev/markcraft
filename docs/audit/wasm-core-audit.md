# WASM 核心复核报告（markdown_analyzer + TS 绑定）

- 复核人：rust-reviewer
- 日期：2026-09-12
- 方式：只读精读全部范围内源码 + `/tmp` 一次性 scratch crate 对边界行为做实证探针（未改动工作区任何文件；构建产物全部写入 `/tmp/mc-audit-target`）。
- 范围内文件：`wasm/markdown_analyzer/src/{lib.rs,dommd.rs,directory.rs,palette.rs,outline.rs,slug.rs,stats.rs}`、`Cargo.toml`，TS 绑定 `src/content/wasm/{markdown_analyzer.d.ts,markdown_analyzer.js,markdown_analyzer_bg.wasm.d.ts,package.json}`，调用方包装 `src/content/core/{wasm_analyzer.ts,wasm_directory.ts}`；交叉验证对象：`src/content/core/{folder.ts,outline.ts,palette.ts,doc-stats.ts,dom-to-markdown.ts}`、`src/shared/types.ts`、`public/manifest.json`、`docs/wasm_core.md`。

## 分级口径（报告头部声明）

| 级别 | 含义 |
|---|---|
| P0 | 安全 / 崩溃 / 数据损坏（现实可触发） |
| P1 | 功能错误（现实输入下产生错误结果） |
| P2 | 健壮性 / 性能（边界输入或潜在触发） |
| P3 | 改进建议 / 文档一致性 |

**结论总览：未发现 P0。** 发现 P1×1、P2×4、P3×10。无 `unwrap/expect/panic` 路径、无越界切片（逐行核对字节游标推进均守界）；`cargo test` 37 通过、`cargo clippy --all-targets -- -D warnings` 干净；`.d.ts`/glue/`package.json` 契约与 Rust 导出一致；`docs/wasm_core.md` 的声明（i32 约束、camelCase rename、WAR 覆盖、回退 mandatory、单例加载）全部核实属实，仅一处"行为完全一致回退"的表述与实际有出入（见 P3-8）。

## 验证证据

```
CARGO_TARGET_DIR=/tmp/mc-audit-target cargo test --manifest-path wasm/markdown_analyzer/Cargo.toml
  → 37 passed; 0 failed
CARGO_TARGET_DIR=/tmp/mc-audit-target cargo clippy --all-targets -- -D warnings（同 manifest）
  → 0 warning
scratch 探针（/tmp/mc-audit-scratch，复用源文件原样编译运行）：
  1. ancestor_folder_urls("file:///root","file:///root2/a.md") → ["file:///root/2/"]（前缀混淆实证）
  2. 标题 a/a/a-1 → hrefs ["#a","#a-1","#a-1"]（重复 slug 实证）
  3. 嵌套表格 → 输出 "| outer \| inner \| \| --- \| | inner |\n| --- | --- |\n| inner |  |"（结构损坏实证）
  4. 同行 th/td 混排 → "| b | a | c |"（列序重排实证）
  5. h7 → "####### x"（非法 ATX 标题实证）
  6. 任务项内嵌 `code` → "- [ ] todo x=1"（行内格式丢失实证）
  7. read_number "12-34" → 0（混合符号解析失败归零实证）
  8. 代码块内容含 ``` → 围栏提前闭合（围栏破坏实证）
  9. 深嵌套 dom_to_markdown：debug 栈溢出于 depth≈5k，release 原生(8MB 栈)溢出于 60k–80k 之间（递归爆栈实证）
serde-wasm-bindgen 0.6.5 ser.rs:324–367 核实：i64/u64 在 ±2^53 内序列化为 number，超出为 BigInt。
```

## P1 — 功能错误

### P1-1 嵌套表格被外层表格吞并，输出 Markdown 结构损坏

> **处置（security-reviewer，2026-09-12）：** 已修复 — `dommd.rs` 行收集改 `collect_direct_rows`（仅 `table > thead/tbody/tfoot > tr` 或无分节 `table > tr`），单元格改单趟直接子级 `th`/`td` 收集（同时解决 P2-5 列序重排），嵌套表格在 `inside_table` 下降级为 `full_text()` 纯文本。新增测试 `degrades_nested_table_to_plain_text`。JS 回退侧同步已在 t3-F5 落地（`dom-to-markdown.ts`）。`cargo test` 45 通过。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:298-365`（`serialize_table` + `collect_tag_descendants`）
- 证据：`collect_tag_descendants(table,"tr")` 先序收集**全部后代** `<tr>`，`collect_tag_descendants(row,tag)` 对 `th`/`td` 同样深入嵌套表格。探针 3 实证：单元格内嵌一个单行表格时，输出把内层表格的行/分隔行文本混入外层单元格（`| outer \| inner \| \| --- \| | inner |` 等），列数膨胀且内容乱序——属于数据损坏类表现，但触发面窄（需要 markdown 源在表格单元格内写 HTML 嵌套表格）。
- 对照：JS 回退 `dom-to-markdown.ts:235-259` 用 `querySelectorAll` 有**同样的吞并问题**（`tr` 查询同样命中嵌套表），但单元格只取 `textContent`，损坏形态不同。
- 建议：行收集限定为 `table > thead/tbody/tfoot > tr`（或收集到 `th/td/table` 时停止下钻）；单元格收集遇到嵌套 `table` 停止下钻，嵌套表格改走递归序列化或降级为纯文本。

## P2 — 健壮性 / 性能

### P2-1 slug 去重计数器可产生重复 href（并写出重复 DOM id）

> **处置（security-reviewer，2026-09-12）：** 已修复 — Rust `outline.rs` 改 `unique_slug`（`HashSet` 已用集合 + 递增后缀直到未占用，GitHub 式），新增测试 `keeps_slugs_unique_on_base_collision`（a/a/a-1 → #a/#a-1/#a-1-1）；JS 镜像 `src/content/core/outline.ts` 的 `generateSlug` 同步改为已用集合语义，双侧行为一致。
- 位置：`wasm/markdown_analyzer/src/outline.rs:38-50`（`slug_with_counters`）；前端写回 `src/content/core/outline.ts:102-104`
- 证据：计数器只记**基名**。探针 2 实证：标题序列 `a, a, a-1` 得到 `["#a","#a-1","#a-1"]`——第二个 `a` 占用了 `a-1`，而第三个标题的真实基名 `a-1` 未入册，直接撞车。随后 `extractOutline` 把重复 slug 写成重复的 `id` 属性，锚点跳转定位到错误标题。这与 JS 回退 `outline.ts:12-21` **逐字节同病**（内部一致性保住了），但与 `docs/wasm_core.md:20` 声称的 GitHub 式行为不符（GitHub slugger 用"已用集合 + 递增直到未占用"）。
- 建议：Rust 与 JS 回退同步改为 `HashSet<String>` 已用集合：`slug = base; while used.contains(slug) { slug = format!("{base}-{}", n+=1) }`，保证全局唯一。

### P2-2 代码块内容含 ``` 时围栏提前闭合，后续正文被吞进代码块

> **处置（security-reviewer，2026-09-12）：** 已修复 — Rust `dommd.rs` 新增 `longest_backtick_run` + `fence()`：块级围栏取 `max(3, 最长反引号串+1)`，mermaid 同样加长，行内代码取 `max(1, +1)` 且内容以反引号开头/结尾（或为空）时按 CommonMark 补空格。新增测试 `picks_longer_fence_for_backtick_content`、`keeps_inline_code_content_with_backticks`。JS 回退（`makeFence`/`longestBacktickRun`）已在 t3-F5 同步。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:171-175`
- 证据：`format!("\n```{}\n…\n```\n")` 固定三反引号。探针 8 实证：`<pre><code>` 内容包含 ` ``` ` 行时输出围栏被其切断，渲染时其后所有内容并入代码块——对"讲解 Markdown 的文档"是现实输入。JS 回退 `dom-to-markdown.ts:133` 同病。
- 建议：序列化前扫描内容中最长连续反引号串，围栏长度取 `max(3, 最长串+1)`；JS 回退同步。

### P2-3 超深 DOM 嵌套触发递归爆栈（WASM trap）

> **处置（security-reviewer，2026-09-12）：** 部分修复（与 t5 口径一致）— 快照端 `serializeNode` 已加 512 层深度上限（`dom-to-markdown.ts:25,43-46`，t3-F5 落地）；Rust 侧显式栈迭代化与入口限深未做。不修理由：调用方全部 try/catch 回退，深 DOM 场景 WASM trap 被捕获后走 JS 回退，而回退自身已有 512 限深保护，链路整体优雅失败不崩溃；迭代化属结构性重构，留后续专项。
- 位置：`wasm/markdown_analyzer/src/dommd.rs`（`collect_text`/`find_descendant`/`node_to_markdown`/`children_to_markdown`/`Drop` 全部递归，行 33-62、79-296）；反序列化路径 `lib.rs:68-71`（serde_wasm_bindgen 解析 `DomNode` 亦按深度递归）
- 证据：探针 9 实证原生 debug depth≈5k 即栈溢出、release（8MB 栈）在 60k–80k 之间溢出；wasm32 默认栈更小（约 1MB 量级），阈值相应更低，溢出表现为 `RuntimeError: call stack exhausted`。恶意/病态页面可造出任意深 DOM。各调用方 try/catch 后回落 JS 实现，但 JS 回退（`serializeNode`、`nodeToMarkdown`）同为递归，深到一定程度照样抛错——扩展功能在该页面上失效（内容脚本异常，不崩浏览器，无数据破坏，故 P2）。
- 建议：`children_to_markdown`/`collect_text` 改显式栈迭代；`DomNode` 序列化入口加深度上限（如 512，超出直接报错走回退）；快照端 `serializeNode` 同步限深，给两条路径统一保护。

### P2-4 `ancestor_folder_urls` 前缀混淆：root 无尾斜杠时产出错误祖先 URL

> **处置（security-reviewer，2026-09-12）：** 已修复 — Rust `directory.rs` 前缀判定改用 `ensure_trailing_slash(root_url)` 归一化后的根（切片与 `current` 初值同源），新增测试 `ancestor_urls_do_not_match_prefix_sibling`（/root 不再误匹配 /root2/a.md）；JS 镜像 `src/content/core/folder.ts` 的 `getAncestorFolderURLs` 同步改为补尾斜杠后的根做前缀判断与切片，双侧行为一致。
- 位置：`wasm/markdown_analyzer/src/directory.rs:153-157`
- 证据：`starts_with(root_url)` 是纯字符串前缀判断。探针 1 实证：root=`file:///root`、目标=`file:///root2/a.md` → 返回 `["file:///root/2/"]`。JS 回退 `folder.ts:40-56` 逐字同病（内部一致）。当前调用方 `Side.vue` 传入的 root 均带尾斜杠（`getParentFolderURL`/`parentDirUrl` 恒以 `/` 结尾），故为**潜伏**缺陷；但该函数是导出 API，防御性不足。
- 建议：判定改为 `target.starts_with(&ensure_trailing_slash(root))` 或比较时规范化双方尾斜杠；JS 回退同步。

### P2-5（并入 P1-1 关联）同一行 th/td 混排时列序被重排

> **处置（security-reviewer，2026-09-12）：** 已修复 — 与 P1-1 同一改动：单元格收集改单趟遍历 `row.children`，`th`/`td` 按文档序推入，混排行列序不再重排。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:309-311`
- 证据：`for tag in ["th","td"]` 两趟收集——先全部 `th` 再全部 `td`。探针 4 实证：`<td>a</td><th>b</th><td>c</td>` 输出 `| b | a | c |`。常规渲染行内标签一致，故降为关联条目。
- 建议：单趟遍历收集，`child.tag=="th"||child.tag=="td"` 即推入，保持文档序。

## P3 — 改进建议

### P3-1 h7–h9 产出非法 ATX 标题

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；HTML 不存在 h7+，健壮性建议保留）。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:184-191`；证据：探针 5，`h7` → `####### x`（GFM 中 >6 个 `#` 不是标题）。HTML 实际不存在 h7+，仅健壮性。JS 回退用 `/^h[1-6]$/`（`dom-to-markdown.ts:142`）行为更严——存在轻微双实现分歧。建议 Rust 端 `level.min(6)` 收口并对齐回退。

### P3-2 任务列表项用 `full_text()`，丢失行内格式与嵌套列表结构

> **处置（security-reviewer，2026-09-12）：** 已修复 — 任务项改 `children_to_markdown(li, depth+1, inside_table)` 序列化（保留行内格式），嵌套内容按标记宽度缩进；ul/ol 合并处理并顺带使 `ol` 的 `start` 属性生效。新增测试 `preserves_inline_formatting_in_task_items`、`indents_nested_list_items`、`respects_ordered_list_start_attribute`。JS 回退已在 t3-F5 同步。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:249-260`；证据：探针 6，`` <li><input…>todo <code>x=1</code></li> `` → `- [ ] todo x=1`（反引号丢失；嵌套 `ul` 亦被拍平）。与 JS 回退 `dom-to-markdown.ts:192-197` 行为一致（保真缺口是共同的），建议改 `children_to_markdown(li)` 并在嵌套列表处换行缩进。

### P3-3 行内代码 / 链接 / 图片不做最小转义

> **处置（security-reviewer，2026-09-12）：** 部分修复 — 行内代码围栏已按内容反引号数加长（随 P2-2 的 `fence(longest_backtick_run+1, 1)` + CommonMark 补空格）；文本节点 `*`/`_`、链接 `]`/`)`、URL 括号转义仍未做（双侧一致缺口，与 t3-F5 口径一致，留双侧同步专项）。
- 位置：`wasm/markdown_analyzer/src/dommd.rs:179-181`（行内代码不加长围栏）、`232-240`（`href` 含 `)`、`alt` 含 `]` 时输出断链）。均为回环保真缺口且与 JS 回退一致；建议行内代码按内容反引号数选围栏、URL 括号做 `%28%29` 或尖括号包裹。

### P3-4 `read_number` 混合符号串整体解析失败归 0

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；仅边界输入下的解析保守回退，无数据损坏）。
- 位置：`wasm/markdown_analyzer/src/directory.rs:52-69`；证据：探针 7，`12-34` → 0。负号被当作数字字符参与收集后 `parse` 失败。建议第二段循环遇 `-` 即停（只允许首字符负号），畸形串至少不吞合法前缀。

### P3-5 `slugify` 尾部 `trim_matches(' ')` 为死代码

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；JS/Rust 双侧一致行为，有测试锁定）。
- 位置：`wasm/markdown_analyzer/src/slug.rs:39`。空格在过滤循环里已先转为 `-`，trim 永不生效（测试 `slugify("  Trim  Me  ") == "--trim--me--"` 锁定了该行为，JS 回退 `outline.ts:14` 的 `.trim()` 同为 no-op，双方一致）。若意图是修剪首尾连字符（GitHub 行为），当前实现未达成；建议要么删除死代码、要么改为 `trim_matches('-')` 并同步回退与测试。

### P3-6 palette 输入字段名拼错时静默取默认值

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；风险已在 docs/wasm_core.md 记载）。
- 位置：`wasm/markdown_analyzer/src/palette.rs:10-33`。所有字段 `#[serde(default)]`，且只有 `isFolder` 做了 rename 与回归测试（`palette.rs:209-217`）；`content`/`href` 若与前端类型漂移将静默产出空标题条目。`docs/wasm_core.md:47-50` 已如实记载该风险。建议对关键字段补齐回归用例，或对文件树结构体加 `deny_unknown_fields` 的镜像结构做调试断言。

### P3-7 palette 空查询仍全量扁平化 + 逐条 `to_lowercase` 分配

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；性能优化建议，无正确性影响）。
- 位置：`wasm/markdown_analyzer/src/palette.rs:93-112`。空查询只需前 12 条却先展开整棵树；过滤阶段对每个候选做 `title/sub_path` 小写分配，大树上每次击键都是 O(n) 分配。JS 回退同构。建议空查询走惰性展开（凑满 12 即止），过滤可先做 `contains` 的大小写不敏感比较或缓存小写副本。

### P3-8 JS 回退与 WASM 的表格序列化不同构，"行为完全一致的回退"声明过强

> **处置（security-reviewer，2026-09-12）：** 代码分歧已大幅收敛（回退单元格保行内格式、转义 `|`、折叠换行、嵌套表格降级、行收集限直接结构——t3-F5；本批 Rust 侧同步落地）；`docs/wasm_core.md` 的措辞收敛未做（P3 不修，留后续文档批处理）。
- 位置：`src/content/core/dom-to-markdown.ts:235-259` vs `wasm/markdown_analyzer/src/dommd.rs:298-352`。回退单元格仅取 `textContent`（丢失 `` `code` ``/`**粗体**`，`dom-to-markdown.ts:242`），也不折叠单元格内换行（换行会破坏 GFM 行）；Rust 版保留行内格式并折叠换行（`dommd.rs:314-325`）。`docs/wasm_core.md:5-7` 声称 "behavior-identical JS fallbacks"，此处理由不符。建议对齐回退实现或在文档收敛措辞（"语义等价，行内格式保真度有差异"）。同类小分歧：回退 `pre` 不处理 `pre` 内嵌 mermaid 容器（Rust `dommd.rs:156-161` 有）；回退正则 `parseDirectoryFallback`（`wasm_directory.ts:16`）要求 size_unit 匹配 `[\d.]+ [BkMG]B?` 且以 `);` 结尾、不支持转义引号/负数，比 Rust 词法（`directory.rs:25-120`）严格，畸形页面上两者条目数会不同。

### P3-9 i64/u64 超出安全整数范围时序列化为 BigInt

> **处置（security-reviewer，2026-09-12）：** 未修（P3，超出本次范围；当前现实取值远低于 2^53，契约成立）。
- 位置：`directory.rs:13/15`（`size:u64`/`timestamp:i64`）、`outline.rs:19-26`、`palette.rs:26`、`stats.rs:7`；已核实 serde-wasm-bindgen 0.6.5 在 ±2^53 内输出 number，超出输出 BigInt。当前所有现实取值（秒级时间戳、文件大小、字数）远低于阈值，TS 侧 `number` 契约成立；仅提示：若未来把时间戳换成纳秒/微秒，`ParsedDirectoryItem.timestamp:number`（`wasm_directory.ts:9`）等契约会静默变成 BigInt。建议在 `docs/wasm_core.md` 的 i32 约束条目旁补一句"i64 字段须保持 <2^53"。

### P3-10 每次调用前 `await wasm.default()` 的冗余异步跳

> **处置（security-reviewer，2026-09-12）：** 已修复（随 t3-F4）— `loadAnalyzer()` 一次性 `await module.default()` 并缓存，`wasm_directory.ts` 已去除冗余 `await wasm.default()`，调用方不再各自初始化。
- 位置：`src/content/core/wasm_directory.ts:28`（其余调用方亦各自 `await …default()`）。`__wbg_init` 二次调用会立即返回（`markdown_analyzer.js:610`），代价只是一次微任务跳转，但可在 `loadAnalyzer()` 里把"动态 import + default() 初始化"合成单一 Promise 缓存，调用方少一层 try/await 样板，也消除"加载成功但初始化失败"时每个调用点重复尝试初始化的开销。

## 各文件覆盖清单与肯定结论

| 文件 | 结论 |
|---|---|
| `src/lib.rs` | 导出面 8 个函数与 `.d.ts` 一一对应；错误经 `JsValue` 抛出、调用方全部 try/catch 回退；`build_outline(max_level:i32)` 遵守 i32 约束（`lib.rs:51`），文档声明属实。无问题。 |
| `src/dommd.rs` | P1-1、P2-2、P2-3、P2-5、P3-1/2/3。其余正确：KaTeX annotation 提取、mermaid `data-mermaid-source` 优先、alert 类型映射、`pre` 内 mermaid 还原、管道转义（GFM 允许代码跨度内 `\|`）、列数补齐，均有测试锁定。快照端 `attrs.checked` 属性值 `'true'/'false'`（`dom-to-markdown.ts:43-45`）与 Rust 判定 `== Some("true")`（`dommd.rs:254`）一致。 |
| `src/directory.rs` | P2-4、P3-4。词法器游标推进全程守界（`find`+`len_utf8`+`char_indices`），无越界 panic；`size` 负值钳 0（`directory.rs:99`）；UTF-8/转义引号解析正确（测试锁定）；`scan_directory` 命中 markdown 提前返回并丢弃 subfolders 为测试锁定的既定语义。 |
| `src/palette.rs` | P3-6/7。`isFolder` rename 与前端 `TreeNodeItem` 对齐，`PaletteResult` camelCase（`subPath`/`isHeading`）与 `PaletteItem` 消费端一致；12/16 上限与 JS 回退一致；`children` 缺省/undefined 安全。 |
| `src/outline.rs` | P2-1。栈式 parent 推导正确；`parentId` camelCase 与 `OutlineItem` 对齐；`children: None` skip 序列化与前端可选字段兼容；level 由调用方限定 h1–h6，树递归深度实际有界。 |
| `src/slug.rs` | P3-5。`encode_uri_component` 与 JS 完全一致（保留 `-_ .!~*'()`，大写十六进制）；Unicode 近似（`is_alphabetic`/`is_numeric` 超集）在模块头有明示，CJK/组合音符/emoji 场景有测试；emoji-only 标题得空基名、href 变 `#`/`#-1` 属 JS 同款行为，可接受。 |
| `src/stats.rs` | 无问题。UTF-16 码元计数（含代理对 = JS `.length` 口径）、`is_whitespace`+`\u{feff}` 过滤与 JS `\s`（含 BOM）对齐、400 字/分钟向上取整且下限 1，测试覆盖 emoji/CJK/空文档。 |
| `Cargo.toml` | 无问题。`serde_json` 正确置于 dev-dependencies（与文档一致），crate-type `cdylib`、依赖版本与 Cargo.lock 一致。 |
| `markdown_analyzer.d.ts` | 无问题。8 个导出签名/文档注释与 Rust 源一致，`InitOutput` 指纹与 glue 匹配。 |
| `markdown_analyzer.js` | 无问题。标准 wasm-bindgen 0.2.128 web-target glue（externref 返回、`dom_to_markdown` 的 deferred free、Safari 解码上限 workaround），无手改痕迹。 |
| `markdown_analyzer_bg.wasm.d.ts` / `package.json` | 无问题。类型与 glue 导出一致；`files`/`main`/`types` 指向齐全。 |
| `core/wasm_analyzer.ts` | 无 P 级问题。单例 Promise + 失败归 null 的短路设计正确；`chrome.runtime.getURL('content/wasm/markdown_analyzer.js')` 与 manifest `web_accessible_resources: ["content/wasm/*"]`（`public/manifest.json:78`）匹配。P3-10 为封装优化。 |
| `core/wasm_directory.ts` | P3-8（回退正则分歧）。WASM 路径契约（snake_case `ParsedDirectoryItem`）与 Rust `DirectoryItem` 字段一致。 |
| `docs/wasm_core.md` | 声明逐条核实属实，唯一过强表述见 P3-8。 |

## 统计

P0×0，P1×1，P2×4（P2-5 为 P1-1 关联条目），P3×10。最高优先修复：P1-1（表格收集越界下钻）与 P2-1/P2-2（slug 去重、围栏选择），三者都有可复现探针且需 Rust/JS 回退双侧同步修。

> **处置汇总（security-reviewer，2026-09-12）：** P1-1、P2-1、P2-2、P2-4、P2-5、P3-2 已修复（Rust 落地 + JS 镜像同步，`cargo test` 45 通过、含新增 8 个边界测试）；P2-3 部分修复（快照端 512 限深已落地，Rust 迭代化留后续）；P3-3 部分修复（行内代码围栏）；P3-10 已随 t3-F4 修复；P3-1/4/5/6/7/8/9 未修（P3 超出本次范围，理由见各条）。JS 镜像改动仅限授权文件 `src/content/core/outline.ts`、`src/content/core/folder.ts`（dom-to-markdown.ts 为 t3-F5 已有修复，未动）。
