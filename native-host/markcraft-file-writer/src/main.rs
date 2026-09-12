//! MarkCraft Native Messaging 本机写入宿主。
//!
//! 协议：Chrome Native Messaging 标准 framing（4 字节小端长度 + JSON）。
//! 请求：{"path": "/abs/path.md", "content": "..."}
//! 响应：{"ok": true} 或 {"ok": false, "error": "..."}
//!
//! 安全约束：仅接受绝对路径，且目标文件必须已存在——只覆盖、绝不新建；
//! 显式拒绝符号链接目标；缺省仅放行 Markdown/文本后缀（可用宿主同目录
//! allowed_paths.json 扩展白名单）；临时文件以 O_EXCL 独占创建，不跟随符号链接。

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const MAX_MESSAGE_BYTES: u32 = 64 * 1024 * 1024;

/// 读取一条 Native Messaging 帧；stdin 关闭（EOF）或帧非法时返回 None。
fn read_message(reader: &mut impl Read) -> Option<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf).ok()?;
    let len = u32::from_le_bytes(len_buf);
    if len > MAX_MESSAGE_BYTES {
        return None;
    }
    let mut buf = vec![0u8; len as usize];
    reader.read_exact(&mut buf).ok()?;
    Some(buf)
}

fn write_message(writer: &mut impl Write, value: &serde_json::Value) {
    let bytes = value.to_string().into_bytes();
    let len = (bytes.len() as u32).to_le_bytes();
    let _ = writer.write_all(&len);
    let _ = writer.write_all(&bytes);
    let _ = writer.flush();
}

fn error_response(message: &str) -> serde_json::Value {
    serde_json::json!({ "ok": false, "error": message })
}

/// 处理单条写入请求；任何失败都以 {"ok": false, "error"} 响应而非 panic，
/// 保证与 Chrome 的通信通道始终干净。
pub fn handle_request(bytes: &[u8]) -> serde_json::Value {
    let req: serde_json::Value = match serde_json::from_slice(bytes) {
        Ok(value) => value,
        Err(e) => return error_response(&format!("invalid json: {e}")),
    };
    let Some(path) = req.get("path").and_then(|v| v.as_str()) else {
        return error_response("missing path");
    };
    let Some(content) = req.get("content").and_then(|v| v.as_str()) else {
        return error_response("missing content");
    };

    let target = Path::new(path);
    if !target.is_absolute() {
        return error_response("path must be absolute");
    }
    // 只覆盖既有文件：目标不存在说明路径有误，拒绝写入防止误建文件
    if !target.is_file() {
        return error_response("target file does not exist");
    }
    // 显式拒绝符号链接目标：保存语义是「覆盖原文件本体」，
    // rename 替换软链会把链接本体换成普通文件，链接目标静默停止同步（数据分叉）
    if let Ok(meta) = target.symlink_metadata() {
        if meta.file_type().is_symlink() {
            return error_response("target is a symlink; refusing to replace");
        }
    }
    // 写入门控（纵深防御）：缺省仅放行 Markdown/文本后缀，杜绝扩展上下文
    // 被攻破后覆写 ~/.zshrc 等任意既有文件；需要更宽时可配置 allowed_paths.json
    let allowed = AllowedPaths::load();
    if !allowed.allows(target) {
        return error_response("target not allowed by write policy (allowed_paths.json)");
    }
    // 原子替换：先写同目录临时文件再 rename，避免中途失败损坏原文件
    match atomic_write(target, content) {
        Ok(()) => serde_json::json!({ "ok": true }),
        Err(e) => error_response(&e),
    }
}

/// 写入策略：前缀或后缀命中即放行。缺省后缀白名单与扩展侧的 Markdown
/// 过滤清单一致，正常保存流不受影响。
struct AllowedPaths {
    prefixes: Vec<String>,
    suffixes: Vec<String>,
}

impl AllowedPaths {
    fn default_suffixes() -> Vec<String> {
        [".md", ".mkd", ".markdown", ".txt", ".mdx", ".mdc"]
            .iter()
            .map(|s| s.to_string())
            .collect()
    }

    /// 从宿主可执行文件同目录的 allowed_paths.json 读取可选配置：
    /// {"prefixes": ["/abs/dir/"], "suffixes": [".md"]}。
    /// 缺失或解析失败时使用缺省策略（失败安全）。
    fn load() -> Self {
        let mut config = AllowedPaths { prefixes: Vec::new(), suffixes: Self::default_suffixes() };
        let Ok(exe) = std::env::current_exe() else {
            return config;
        };
        let Some(dir) = exe.parent() else {
            return config;
        };
        let Ok(raw) = std::fs::read_to_string(dir.join("allowed_paths.json")) else {
            return config;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
            return config;
        };
        if let Some(entries) = value.get("prefixes").and_then(|v| v.as_array()) {
            config.prefixes = entries
                .iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect();
        }
        if let Some(entries) = value.get("suffixes").and_then(|v| v.as_array()) {
            let suffixes: Vec<String> = entries
                .iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect();
            if !suffixes.is_empty() {
                config.suffixes = suffixes;
            }
        }
        config
    }

    fn allows(&self, target: &Path) -> bool {
        let path = target.to_string_lossy();
        if self
            .prefixes
            .iter()
            .any(|prefix| !prefix.is_empty() && path.starts_with(prefix.as_str()))
        {
            return true;
        }
        let lower = path.to_lowercase();
        self.suffixes
            .iter()
            .any(|suffix| !suffix.is_empty() && lower.ends_with(&suffix.to_lowercase()))
    }
}

/// 同目录写入临时文件后原子 rename 覆盖目标；失败时清理临时文件。
///
/// 临时文件用 `create_new(true)`（O_EXCL）独占创建：不覆盖任何既有路径，
/// 也不会跟随攻击者预置的同名符号链接穿透写到目录外；文件名含 pid 与
/// 纳秒时间戳，碰撞时换名重试。
fn atomic_write(target: &Path, content: &str) -> Result<(), String> {
    let file_name = target
        .file_name()
        .ok_or_else(|| "target has no file name".to_string())?
        .to_string_lossy();
    let parent = target
        .parent()
        .ok_or_else(|| "target has no parent".to_string())?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    let mut created: Option<(PathBuf, std::fs::File)> = None;
    for attempt in 0..8u32 {
        let candidate = parent.join(format!(
            ".{file_name}.markcraft-{}-{nanos:x}-{attempt}.tmp",
            std::process::id()
        ));
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => {
                created = Some((candidate, file));
                break;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("create temp file failed: {e}")),
        }
    }
    let Some((tmp, mut file)) = created else {
        return Err("could not create a unique temp file".to_string());
    };

    let write_result = file
        .write_all(content.as_bytes())
        .and_then(|()| file.sync_all());
    drop(file);
    // 复制原文件权限后再换入：否则覆盖 0600 等受限文件会被 umask 默认
    // 权限（通常 0644）放宽，造成隐私回退；复制失败不阻塞保存
    if write_result.is_ok() {
        if let Ok(meta) = std::fs::metadata(target) {
            let _ = std::fs::set_permissions(&tmp, meta.permissions());
        }
    }
    let rename_result = match write_result {
        Err(e) => Err(e),
        Ok(()) => std::fs::rename(&tmp, target),
    };
    if let Err(e) = rename_result {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("write failed: {e}"));
    }
    Ok(())
}

fn main() {
    let mut stdin = std::io::stdin().lock();
    let mut stdout = std::io::stdout().lock();
    while let Some(message) = read_message(&mut stdin) {
        let response = handle_request(&message);
        write_message(&mut stdout, &response);
    }
}

#[cfg(test)]
mod tests {
    use super::{error_response, handle_request, AllowedPaths};
    use std::path::{Path, PathBuf};

    fn temp_markdown_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("markcraft-file-writer-tests");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn overwrites_existing_file_in_place() {
        let path = temp_markdown_path("overwrite.md");
        std::fs::write(&path, "# 旧内容\n").unwrap();

        let request = serde_json::json!({
            "path": path.to_str().unwrap(),
            "content": "# 新内容\n\n正文"
        });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(true));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "# 新内容\n\n正文");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn refuses_missing_target_without_creating() {
        let path = temp_markdown_path("definitely-missing.md");
        std::fs::remove_file(&path).ok();

        let request = serde_json::json!({ "path": path.to_str().unwrap(), "content": "x" });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(false));
        assert!(!path.exists(), "不得新建文件");
    }

    #[test]
    fn refuses_relative_paths() {
        let request = serde_json::json!({ "path": "relative/a.md", "content": "x" });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(false));
    }

    #[cfg(unix)]
    #[test]
    fn refuses_symlink_target_without_touching_it() {
        use std::os::unix::fs::symlink;

        let dir = std::env::temp_dir().join("markcraft-file-writer-tests");
        std::fs::create_dir_all(&dir).unwrap();
        let real = dir.join("symlink-target-real.md");
        let link = dir.join("symlink-target-link.md");
        std::fs::write(&real, "real bytes").unwrap();
        let _ = std::fs::remove_file(&link);
        symlink(&real, &link).unwrap();

        let request = serde_json::json!({ "path": link.to_str().unwrap(), "content": "x" });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(false));
        // 软链本体与链接目标都必须原样保留
        assert!(link.symlink_metadata().unwrap().file_type().is_symlink());
        assert_eq!(std::fs::read_to_string(&real).unwrap(), "real bytes");

        let _ = std::fs::remove_file(&link);
        let _ = std::fs::remove_file(&real);
    }

    #[test]
    fn write_policy_rejects_non_markdown_targets() {
        let path = temp_markdown_path("no-extension-target");
        std::fs::write(&path, "old").unwrap();

        let request = serde_json::json!({ "path": path.to_str().unwrap(), "content": "x" });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(false));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "old", "目标内容不得被改动");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn default_policy_allows_markdown_suffixes_only() {
        let policy = AllowedPaths { prefixes: Vec::new(), suffixes: AllowedPaths::default_suffixes() };
        assert!(policy.allows(Path::new("/Users/x/notes/a.md")));
        assert!(policy.allows(Path::new("/Users/x/notes/a.TXT")));
        assert!(policy.allows(Path::new("/Users/x/notes/a.markdown")));
        assert!(!policy.allows(Path::new("/Users/x/.zshrc")));
        assert!(!policy.allows(Path::new("/Users/x/script.sh")));
    }

    #[test]
    fn prefix_whitelist_extends_write_scope() {
        let policy = AllowedPaths {
            prefixes: vec!["/Users/x/notes/".to_string()],
            suffixes: AllowedPaths::default_suffixes(),
        };
        assert!(policy.allows(Path::new("/Users/x/notes/config.json")));
        assert!(!policy.allows(Path::new("/Users/x/other/config.json")));
    }

    #[cfg(unix)]
    #[test]
    fn preserves_target_permissions_on_overwrite() {
        use std::os::unix::fs::PermissionsExt;

        let path = temp_markdown_path("permissions.md");
        std::fs::write(&path, "old").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();

        let request = serde_json::json!({ "path": path.to_str().unwrap(), "content": "secret" });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(true));
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "覆盖保存不得放宽原文件权限");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn atomic_write_leaves_no_temp_files() {
        let path = temp_markdown_path("atomic.md");
        std::fs::write(&path, "old").unwrap();
        let request = serde_json::json!({
            "path": path.to_str().unwrap(),
            "content": "atomic content"
        });
        let response = handle_request(request.to_string().as_bytes());
        assert_eq!(response["ok"], serde_json::json!(true));
        let dir = path.parent().unwrap();
        // 只看本测试目标对应的临时文件（.atomic.md.markcraft-*）：
        // 并行测试共享目录时，其他测试的瞬时临时文件不应导致误报
        let leftovers: Vec<_> = std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".atomic.md.markcraft-"))
            .collect();
        assert!(leftovers.is_empty(), "不应残留临时文件");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "atomic content");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn rejects_malformed_json_and_missing_fields() {
        assert_eq!(handle_request(b"not json")["ok"], serde_json::json!(false));
        let no_path = serde_json::json!({ "content": "x" });
        assert_eq!(handle_request(no_path.to_string().as_bytes())["ok"], serde_json::json!(false));
        let no_content = serde_json::json!({ "path": "/tmp/a.md" });
        assert_eq!(handle_request(no_content.to_string().as_bytes())["ok"], serde_json::json!(false));
    }

    #[test]
    fn error_response_shape() {
        let value = error_response("boom");
        assert_eq!(value["ok"], serde_json::json!(false));
        assert_eq!(value["error"], serde_json::json!("boom"));
    }
}
