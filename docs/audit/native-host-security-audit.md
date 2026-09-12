# MarkCraft Native 宿主与文件写入链路安全审计报告

- 审计日期：2026-09-12
- 审计人：security-reviewer（全量复核团队）
- 审计方式：只读源码精读 + 调用链追踪（未改动除本报告外的任何文件）
- severity 口径：P0 = 安全 / 崩溃 / 数据损坏；P1 = 功能错误；P2 = 健壮性；P3 = 建议

## 1. 结论摘要

**未发现 P0 / P1 级问题。** 宿主与浏览器侧链路的核心安全设计（绝对路径、只覆盖已存在文件、原子写入、`allowed_origins` 锁定扩展 ID、UTF-8 强制校验、协议帧边界处理）均正确实现并有测试覆盖。发现 **3 条 P2**（均为纵深防御 / 本机多用户场景下的健壮性缺口，需要"本地攻击者已能写目标目录"或"扩展上下文已被攻破"作为前置条件，不构成可独立利用的漏洞）与 **8 条 P3** 建议。

> **处置汇总（security-reviewer，2026-09-12）：** F1、F3 已修复（O_EXCL 临时文件 + 显式拒绝符号链接）；F2/F4/F9 部分修复；F5/F6/F7/F8/F10/F11 不修。
>
> **第二轮处置汇总（security-reviewer，2026-09-13，剩余未修项清理）：** F2 完整修复（宿主 `AllowedPaths` 白名单，缺省 Markdown 后缀 + 可选 allowed_paths.json）；F4 完整修复（mode 复制）；F5/F6/F7/F8/F9 全部修复（64MB 上限、install.sh 转义与按需写入、专用安装目录 + ID 核对提示、SW 超时断开与双侧超时放大）。F10 维持不修（Windows 暂不支持口径不变，行为安全）；F11 维持不修（保存内容为 DOM 往返再生成而非原文字节，保留原 BOM/CRLF 无实义，属产品语义决策）。`cargo test` 11 通过（新增 4 个）、`cargo clippy -D warnings` 干净。

## 2. 审计范围与文件覆盖

| 文件 | 状态 | 与本链路的关系 |
| --- | --- | --- |
| `native-host/markcraft-file-writer/src/main.rs` | 已精读（含测试） | Native Messaging 宿主本体 |
| `native-host/markcraft-file-writer/Cargo.toml` | 已精读 | 依赖与构建配置（有 Cargo.lock 锁定） |
| `native-host/install.sh` | 已精读 | 宿主清单安装、扩展 ID 计算 |
| `native-host/README.md` | 已精读 | 安全设计声明、协议、安装/卸载说明 |
| `src/content/core/native-save.ts` | 已精读 | 内容脚本侧 file:// URL → 绝对路径、超时兜底 |
| `src/background/index.ts` | 已精读 | SW 中继 `native-save` → `connectNative` |
| `src/shared/storage.ts` | 已精读 | 仅设置读写归一化，**无保存/消息相关逻辑，无 findings** |
| `src/shared/types.ts` | 已精读 | 仅类型定义，**无消息协议类型，无 findings** |
| `src/shared/constants.ts` | 已精读 | 仅默认设置常量，**无保存/消息相关逻辑，无 findings** |
| `public/manifest.json`（含 `dist/manifest.json`，两者 diff 一致） | 已核对 | 权限、matches、无 `key` 字段（与 `allowed_origins` 匹配性相关，见 §4.4） |
| `src/content/App.vue`（链路证据，非必查清单） | 摘要核对 | `tryNativeSave` 唯一调用方，`path` 来源 |
| `native-host/` 下其他 .sh/.json/manifest | 已枚举 | 仅 `install.sh` 与 README，无其他安装脚本/清单模板 |

数据流：

```
用户 Ctrl+S（App.vue:476-492）→ saveInPlace（App.vue:261）
  → tryNativeSave(fileUrl=window.location.href 派生, content)（App.vue:269,287）
  → fileUrlToNativePath()（native-save.ts:8-19，非 file:// 返回 null）
  → chrome.runtime.sendMessage({type:'native-save', path, content})（native-save.ts:36）
  → SW onMessage 中继（background/index.ts:22-46）
  → chrome.runtime.connectNative('com.markcraft.filewriter') → port.postMessage（:32,41）
  → 宿主读 4 字节长度帧 + JSON（main.rs:15-25）
  → 校验绝对路径 + 目标已存在（main.rs:53-59）
  → 同目录临时文件 + rename 原子覆盖（main.rs:69-85）
```

## 3. 必查项结论

### 3.1 路径穿越 —— 未发现问题

检查过程与依据：

1. `path` 由 `fileUrlToNativePath` 生成：仅接受 `file://` 前缀（native-save.ts:9），剥离 hash/query（:10）、`localhost/`（:11）、`decodeURIComponent` 一次（:14，解码失败保留原样）。https 页面（`*://*/*.md` match 也会注入内容脚本）必然返回 null，无法触达宿主。
2. 宿主侧拒绝相对路径（main.rs:54 `!target.is_absolute()`）。路径中即使含 `..`，也作为绝对路径交给 OS 语义解析后仍指向用户可见的文件系统位置，不存在"从受控基目录逃逸"的构造——本设计根本没有基目录拼接，`..` 无增益。
3. 调用链上 `path` 只来源于 `window.location.href`（App.vue:158,269）及调色板切档时的 `item.href`（App.vue:405-419，非 file:// 时同样被 native-save.ts:9 拦截）。
4. 双重编码不构成绕过：`decodeURIComponent` 只解码一次，磁盘文件名与其 URL 编码一一对应。

结论：无可利用的路径穿越。

### 3.2 任意文件写 —— 未发现可独立利用的任意写，存在纵深防御缺口（见 F1/F2）

检查过程与依据：

1. 宿主要求目标**已存在**且为普通文件（main.rs:58 `target.is_file()`），杜绝新建文件与目录逃逸创建；有测试 `refuses_missing_target_without_creating`（main.rs:123-131）。
2. 写入权限等同运行用户，宿主不做越权提升；无 `sudo`、无子进程、无 unsafe（全文件 grep 验证）。
3. 缺口一：宿主对**可写文件的后缀/目录无任何白名单**——`/Users/x/.zshrc` 等任意已存在文件同样接受（main.rs:53-59 仅查绝对路径 + 存在性）。缺口二：SW 中继不校验 `sender`，也不校验 `path` 是否对应当前标签页 URL（background/index.ts:22-41）。两者组合意味着"扩展任一执行上下文被攻破 ⇒ 可覆写该用户可写的任意既有文件"。由于消息面（`chrome.runtime.onMessage`）天然仅接收本扩展消息、页面主世界无法直接调用，攻击需要先攻破扩展上下文这一前置条件，故评为 P2 纵深防御问题而非 P0。
4. 内容脚本对全部 `file:///*` 注入（manifest.json:58），恶意本地 .md 可诱导用户浏览到敏感本地文件后经正常 Ctrl+S 覆盖之（内容为渲染往返结果，非攻击者任意串），属浏览器固有交互模型内的用户引导风险，记录为 F2 的背景说明。

### 3.3 协议边界（Native Messaging 4 字节长度帧 / stdin 截断）—— 未发现问题

检查过程与依据：

1. 帧格式与 Chrome 规范一致：4 字节小端长度 + JSON（main.rs:15-25；README.md:43 与 install.sh 生成的清单 `type: "stdio"` 一致）。
2. 截断/EOF：`read_exact` 在长度头或 payload 不完整时返回 Err → `None` → 循环静默退出（main.rs:17,23,90），不会把半帧当作完整消息解析，也不会向已关闭的管道写响应。Chrome 结束宿主即回收进程，无资源泄漏路径。
3. 入站长度上限 `MAX_MESSAGE_BYTES = 512MB`（main.rs:12,19），低于 Chrome "扩展 → 宿主 4GB" 上限，类型转换 `u32::from_le_bytes(...) as usize` 后再 `len as u32` 在 32/64 位平台均无截断错误（len 本就 ≤ u32::MAX）；但按长度头整块预分配内存属 P3（F5）。超大消息被拒时循环直接退出、无响应，扩展侧 4 秒超时兜底（native-save.ts:34）后回退对话框，行为安全。
4. 出站响应为短 JSON（错误串含 `serde_json` 转义），远低于 Chrome "宿主 → 扩展 1MB" 上限。
5. stdout 污染检查：非测试代码无 `println!`/`eprintln!`/`dbg!`/`panic!`（全文件 grep 验证）；`write_message` 全部忽略写错误（main.rs:30-32），不会因管道破裂 panic。
6. 并发：宿主单线程顺序处理消息（main.rs:90-93）；多实例并发保存同一目标时，临时文件名含 pid（main.rs:77）互不冲突，`rename` 原子，last-wins 无损坏。

### 3.4 来源校验与宿主安装配置（allowed_origins vs manifest extension key）—— 匹配机制正确，存在运维性注意点（F8）

检查过程与依据：

1. `public/manifest.json` **没有 `key` 字段**（已核对 `dist/manifest.json` 与其 diff 一致）⇒ 未打包加载时扩展 ID = 扩展目录绝对路径的 SHA-256 前 32 hex、0-9a-f 映射 a-p；`install.sh:40-46` 用 `pwd -P` + `printf '%s'`（无换行）+ 同样的映射复现了该算法，并有 `^[a-p]{32}$` 格式校验（:46）⇒ **同目录场景下 `allowed_origins`（install.sh:79）与实际扩展 ID 精确匹配**。
2. 打包/商店发布（ID 由签名 key 派生）必须 `--id` 显式指定，脚本与 README.md:24 均已说明。
3. 其他扩展/网站无法调用宿主：`allowed_origins` 精确锁定单 ID；站点→扩展方向因 manifest 未声明 `externally_connectable`，外部页面无法投递 `runtime.sendMessage`；`runtime.onMessage` 仅接收本扩展上下文消息。SW 内不做二次 sender 校验（F2）。
4. 失配失败模式安全：ID 失配（如 dist 目录被移动/经符号链接路径加载）时 Chrome 拒绝连接 → SW 触发 `onDisconnect`（background/index.ts:37-40）→ 扩展回退目录授权/另存对话框，功能不降级（README.md:48）。

### 3.5 输入校验与编码 —— 未发现问题

1. `serde_json::from_slice` 强制 payload 为合法 UTF-8（非法 UTF-8 报 `invalid json`，main.rs:42-44），浏览器 `postMessage` 序列化产物必为合法 UTF-8，**磁盘上不可能出现非 UTF-8 字节**。lone surrogate 由 Chrome 消息序列化替换处理，无绕过。
2. 缺字段 / 类型不符均结构化拒绝（main.rs:46-51），无 panic 路径（`file_name()`/`parent()` 均 `ok_or_else`，main.rs:70-76）。
3. BOM：宿主不添加也不剥离 BOM（P3 数据保真，F11）；CRLF 原样保留于写入字节流。
4. 嵌套 JSON 炸弹由 serde_json 默认 128 层递归限制拦截，返回错误响应而非栈溢出。

### 3.6 错误处理与退出码 —— 未发现问题

所有失败路径返回 `{"ok":false,"error"}`（main.rs:39-66）；临时文件失败时清理（main.rs:80-83，测试 `atomic_write_leaves_no_temp_files` 覆盖）；EOF 退出码 0，Chrome 不依赖退出码做安全决策；`main` 无 unwrap/expect。

### 3.7 最小权限 —— 基本满足

1. 宿主依赖仅 `serde_json = "1"`（Cargo.toml:8-9，Cargo.lock 锁定），无网络、无子进程、无 unsafe；release `opt-level="z"` + `strip`（Cargo.toml:11-13）。
2. 扩展权限 `["storage","tabs","nativeMessaging"]`（manifest.json:74）：`nativeMessaging` 为本链路必要；`tabs` 同时使 SW 可读 `sender.tab.url`（F2 建议的校验恰好可行）；未申请 `nativeMessaging` 之外的危险权限。`web_accessible_resources` 对 `<all_urls>` 暴露 wasm 资源与本链路无关，未计入 findings。

## 4. Findings 清单

### F1 [P2] 临时文件名可预测且 `fs::write` 跟随已存在符号链接（本机共享目录符号链接攻击）

> **处置（security-reviewer，2026-09-12）：** 已修复 — `atomic_write` 改用 `OpenOptions::create_new(true)`（O_EXCL）独占创建临时文件，文件名含 pid + 纳秒时间戳 + 尝试序号，`AlreadyExists` 时换名重试（至多 8 次）；不再覆盖/跟随任何预置路径。新增测试 `refuses_symlink_target_without_touching_it` 锁定；`cargo test` 7 通过。
- 证据：`native-host/markcraft-file-writer/src/main.rs:77`（`.{file_name}.markcraft-{pid}.tmp`，仅 pid 可猜测）、`:79`（`std::fs::write` = `O_WRONLY|O_CREAT|O_TRUNC`，无 `O_EXCL`，跟随符号链接）。
- 场景：多用户机器上，对目标目录有写权限的本地攻击者预置同名符号链接指向目录外文件（如受害者 `~/.bashrc`），pid 可被批量预置枚举；宿主写入时穿透符号链接改写目录外文件，随后 `rename` 又把链接体搬到目标位置。前置条件是攻击者已能写目标目录，故非 P0。
- 建议：改用 `OpenOptions::new().write(true).create_new(true)`（`O_EXCL`，链接已存在即失败）+ 随机后缀重试，或直接用 `tempfile` crate 的 `NamedTempFile::new_in(parent)`；失败重试新名称而非覆盖。

### F2 [P2] SW 中继不绑定 sender 与 path 归属 + 宿主不限制可写范围（纵深防御缺口）

> **处置（security-reviewer，2026-09-12）：** 部分修复 — 建议方案 1（SW 端绑定）已随 t3-F14 落地（`sender.id`/`sourceUrl`→`path` 一致性/64M 字符上限校验）。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（完整）** — 方案 2 宿主侧白名单落地：`main.rs` 新增 `AllowedPaths` 写入门控，缺省仅放行 Markdown/文本后缀（`.md .mkd .markdown .txt .mdx .mdc`，与扩展过滤清单一致，正常保存流零影响）；可在宿主二进制同目录放 `allowed_paths.json`（`prefixes`/`suffixes`）扩展范围，配置缺失/非法时回落缺省策略（失败安全）。新增测试 `write_policy_rejects_non_markdown_targets`、`default_policy_allows_markdown_suffixes_only`、`prefix_whitelist_extends_write_scope`；README 补充配置说明。
- 证据：`src/background/index.ts:22-41`（直接转发 `request.path`/`request.content`，未读 `sender`）；`native-host/markcraft-file-writer/src/main.rs:53-59`（仅绝对路径 + 存在性，无后缀/目录白名单）。
- 影响：扩展任一上下文被攻破（未来代码引入的 XSS sink、被污染的消息处理等）即可覆写用户可写的任意既有文件；当前代码无这样的入口，故为 P2。
- 建议（择一或叠加）：
  1. SW 端校验 `sender.id === chrome.runtime.id` 且 `request.path === fileUrlToNativePath(sender.tab.url)`（`tabs` 权限已具备，manifest.json:74）。注意调色板抓取流（App.vue:405-419）中 tab.url 与 item.href 可能短暂不一致，需为该流保留豁免或改为传参携带来源 URL 并校验之；
  2. 宿主侧增加可选配置（清单同目录 `allowed_paths` 前缀/后缀白名单），缺省仅允许 `.md`/`.markdown` 等文本后缀。

### F3 [P2] `rename` 覆盖会替换符号链接本体，且存在 TOCTOU

> **处置（security-reviewer，2026-09-12）：** 已修复 — `handle_request` 在存在性检查后显式 `symlink_metadata()` 判定，符号链接目标直接拒绝（`"target is a symlink; refusing to replace"`），链接本体与目标均原样保留；unix 测试断言软链未被动、目标内容未变。与 F1 的 O_EXCL 写入共同收窄 TOCTOU 窗口（剩余窗口仅剩「检查通过后被并发替换」的本机竞态，当前单用户场景可接受）。
- 证据：`main.rs:58`（`is_file()` 跟随链接判定"存在"）与 `:79`（`std::fs::rename` 不跟随目标链接，直接替换目录项）。
- 影响：目标为指向他处的软链（如仓库内链到同步盘的 `notes.md`）时，保存会把软链替换成普通文件，链接目标不再同步更新，造成静默的数据分叉；检查（`is_file`）与写入（write/rename）之间亦无原子性保证。当前单用户本地场景风险低。
- 建议：保存前 `fs::symlink_metadata` 显式拒绝符号链接目标并返回明确错误（`"target is a symlink"`），或在文档中声明该语义；配合 F1 的 `O_EXCL` 写入同时收窄 TOCTOU 窗口。

### F4 [P3] 覆盖保存不保留原文件权限/属主/元数据，且无 fsync

> **处置（security-reviewer，2026-09-12）：** 部分修复（2026-09-12）— rename 前已加 `File::sync_all()`。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（mode 复制）** — rename 前读取原文件权限并 `set_permissions` 复制到临时文件（复制失败不阻塞保存），0600 等受限文件不再被 umask 默认权限放宽；新增 unix 测试 `preserves_target_permissions_on_overwrite`。属主/xattr 保留仍不覆盖（rename 语义限制，记录为已知边界）。
- 证据：`main.rs:69-85`——新临时文件按 umask 默认权限创建（通常 0644），`rename` 换入新 inode，原文件 mode/owner/xattr 丢失；`write` 后未 `sync_all` 即 `rename`。
- 影响：覆盖原本 0600 的文件后权限放宽（隐私回退）；崩溃时 rename 可能先于数据落盘（ext4 auto_da_alloc / APFS 启发式可缓解，不保证）。
- 建议：`fs::metadata(target)` 后在 rename 前对临时文件 `set_permissions` 复制原 mode；写后 `File::sync_all()`。

### F5 [P3] 512MB 入站上限与按长度头整块预分配

> **处置（security-reviewer，2026-09-12）：** 不修（2026-09-12）。**第二轮处置（security-reviewer，2026-09-13）：已修复** — 入站上限 512MB 降为 64MB（`MAX_MESSAGE_BYTES`，远超现实文档量级），顺带简化 `u32` 双重转换写法。
- 证据：`main.rs:12`（512MB 常量）、`:22`（`vec![0u8; len]` 先分配后读取）。
- 影响：对端（正常情况下仅 Chrome）发来大长度头即可触发最高 512MB 一次性分配；本威胁模型下风险极低。
- 建议：将上限降到实际文档量级（如 64MB）；或先 `Vec::with_capacity` 防御性上限再流式 `read_exact`。顺带简化 `:19` 的 `len as u32` 双重转换写法以免误读（现无截断 bug）。

### F6 [P3] install.sh：JSON 内插不转义 + 无条件写全部三个浏览器目录

> **处置（security-reviewer，2026-09-12）：** 不修（2026-09-12）。**第二轮处置（security-reviewer，2026-09-13）：已修复** — `install.sh`：① 清单 `path` 内插前对 `$BIN` 做 JSON 转义（反斜杠与双引号），特殊目录名不再产出非法清单；② 仅向已存在的浏览器清单目录写入，三个目录都不存在时回退主 Chrome 目录并显式提示。
- 证据：`native-host/install.sh:73-81`（`$BIN` 原样内插 heredoc，路径含 `"` 或 `\` 时产出非法 JSON）；`:70-83`（对 Chrome / Chrome for Testing / Chromium 三个目录一律 `mkdir -p` 并写清单）。
- 影响：极特殊目录名导致清单损坏、宿主不可用（安全上 failsafe）；多余目录残留。
- 建议：用 `jq -n`/python 生成 JSON；仅当浏览器目录已存在时写入，或写后提示实际生效路径。

### F7 [P3] 宿主二进制驻留仓库 `target/` 目录，可被同机写者替换

> **处置（security-reviewer，2026-09-12）：** 不修（2026-09-12）。**第二轮处置（security-reviewer，2026-09-13）：已修复** — `install.sh` 改为 `install -m 0755` 将宿主二进制安装到 `~/.local/bin/markcraft-file-writer`，清单 `path` 指向该拷贝件；仓库 `target/` 内产物被替换不再影响已安装宿主。README 同步安装/卸载说明。
- 证据：`install.sh:33-34`（构建产物路径即清单 `path`）、`:77`（清单指向 `$BIN`）。
- 影响：对仓库目录有写权限的本机进程可替换宿主二进制，之后每次保存以用户权限执行任意代码；与"攻击者已能写你的仓库"前提重叠，属纵深建议。
- 建议：安装时把二进制拷贝到专用目录（如 `~/.local/bin/markcraft-file-writer`），设 0755 并校验属主，清单指向拷贝件。

### F8 [P3] allowed_origins 依赖"安装目录 == 加载目录"，路径形式敏感

> **处置（security-reviewer，2026-09-12）：** 不修（2026-09-12）。**第二轮处置（security-reviewer，2026-09-13）：已修复** — `install.sh` 结束时回显「核对 chrome://extensions 中扩展 ID 与清单一致」及失配症状（保存始终走弹窗）与 `--id` 重装指引；`README.md` 排查小节同步补充。
- 证据：`install.sh:41`（`pwd -P` 物理路径）vs Chrome 以用户加载时选择的路径字符串计算未打包 ID——经符号链接路径加载扩展会得到不同 ID；`README.md:21-24` 未提示核对方法。
- 影响：失配 ⇒ 宿主静默不可用，扩展回退对话框（安全上 failsafe，仅可用性/排查成本）。
- 建议：脚本末尾回显"在 chrome://extensions 中核对 ID 与此处一致"；README 补充失配症状（保存始终走弹窗）与排查步骤。

### F9 [P3] SW 中继缺少入参类型校验与超时断开；超时后可能双写竞态

> **处置（security-reviewer，2026-09-12）：** 部分修复（2026-09-12）— 类型校验已随 t3-F14 落地。
> **第二轮处置（security-reviewer，2026-09-13）：已修复（完整）** — SW 侧新增超时断开：`connectNative` 后按内容长度放大超时（基础 4s + 每 1M 字符 +2s，上限 60s），超时主动 `port.disconnect()` 并响应错误，port 不再滞留；内容侧 `native-save.ts` 超时同口径放大，消除「扩展已回退弹窗、宿主迟到写入」的双写窗口。
- 证据：`background/index.ts:41`（`request.path`/`request.content` 未校验类型即 `postMessage`，类型异常由 try/catch 兜住，无安全问题）；`:32-40`（宿主挂起时 port 保持打开，直至 SW 回收）；`native-save.ts:5,34`（4 秒超时后扩展回退对话框，而宿主可能稍后仍完成写入）。
- 影响：超大文档下 4 秒可能不足 ⇒ 回退路径与迟到写入双写（内容一致，风险低）；port 资源滞留。
- 建议：`typeof request.path === 'string' && typeof request.content === 'string'` 前置校验；SW 侧加超时 `port.disconnect()`；文档化超大文档场景或按内容长度放大超时。

### F10 [P3] Windows 路径静默禁用（行为安全，注意未来支持时的边界）

> **处置（security-reviewer，2026-09-12）：** 不修（P3；维持「Windows 暂不支持」口径，现状行为安全）。
- 证据：`native-save.ts:12`——`file:///C:/...` 剥离前缀后为 `C:/...`，不以 `/` 开头，返回 null；UNC `file:////server/share` 则产出 `//server/share` 会被当 POSIX 绝对路径（当前 Windows 无宿主安装脚本，不可达）。
- 建议：维持 README.md:35 的"Windows 暂不支持"声明；未来支持时需显式解析盘符并拒绝 UNC，宿主侧同样处理。

### F11 [P3] 数据保真：BOM 与原 CRLF 不保留

> **处置（security-reviewer，2026-09-12）：** 不修（P3 数据保真提示，无安全影响）。
- 证据：宿主原样写入 `content` 字节（`main.rs:79`），内容来自 DOM→Markdown 往返（App.vue:268）；原文件若带 UTF-8 BOM / CRLF，保存后丢失。
- 影响：仅当前编辑文档的保真度，非损坏、无安全影响；UTF-8 合法性由 serde_json 强制（见 §3.5）。
- 建议：如需保真可在读取阶段记录 BOM/换行风格并在保存前还原。

### 相邻观察（超出本任务 inScope，仅提示，不计入 findings）

- `background/index.ts:4-20` 的 `bg-fetch` 对任意 `url` 发起 fetch 且把 `status===0`（opaque 响应，body 恒为空）计为 `ok`，亦未校验 `sender.url`——与本文件写入链路无关，建议由 bg-fetch/渲染方向的复核任务跟进。

## 5. 已验证安全项（核对通过，无需修复）

- 绝对路径强制 + 目标必须已存在（只覆盖、绝不新建），有测试锁定行为（main.rs:123-138）。
- 原子写入：同目录临时文件 + `rename`，失败清理临时文件，有测试（main.rs:141-159）。
- 4 字节小端长度帧符合 Chrome Native Messaging 规范；EOF/截断安全退出；响应长度低于 1MB 上限；stdout 无协议外输出。
- `allowed_origins` 精确锁定单扩展 ID，未打包 ID 算法与 Chrome 一致（同目录场景精确匹配）；外部页面无法触达宿主。
- serde_json 强制 UTF-8、递归深度限制；错误路径全部结构化响应，无 panic/unwrap（非测试代码）。
- 依赖最小化（仅 serde_json，Cargo.lock 锁定）、无网络/子进程/unsafe；扩展权限 `nativeMessaging` 为必要权限。
- 宿主未安装/失配/超时的所有失败模式均安全回退到目录授权/另存对话框，功能不降级。

## 6. 修复优先级建议

1. 优先处理 F1（`O_EXCL` 临时文件，改动小、收益明确）与 F3（显式拒绝符号链接目标）。
2. F2 建议 first iteration 先做 SW 端 path-sender 绑定（改动集中在 background/index.ts，注意调色板流豁免）。
3. P3 各项可随构建脚本/宿主下一次迭代顺手处理。
