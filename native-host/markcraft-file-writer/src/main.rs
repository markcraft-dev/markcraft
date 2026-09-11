//! MarkCraft Native Messaging 本机写入宿主。
//!
//! 协议：Chrome Native Messaging 标准 framing（4 字节小端长度 + JSON）。
//! 请求：{"path": "/abs/path.md", "content": "..."}
//! 响应：{"ok": true} 或 {"ok": false, "error": "..."}
//!
//! 安全约束：仅接受绝对路径，且目标文件必须已存在——只覆盖、绝不新建；
//! 显式拒绝符号链接目标；临时文件以 O_EXCL 独占创建，不跟随符号链接。

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const MAX_MESSAGE_BYTES: u32 = 512 * 1024 * 1024;

/// 读取一条 Native Messaging 帧；stdin 关闭（EOF）或帧非法时返回 None。
fn read_message(reader: &mut impl Read) -> Option<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf).ok()?;
    let len = u32::from_le_bytes(len_buf) as usize;
    if len as u32 > MAX_MESSAGE_BYTES {
        return None;
    }
    let mut buf = vec![0u8; len];
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
    // 原子替换：先写同目录临时文件再 rename，避免中途失败损坏原文件
    match atomic_write(target, content) {
        Ok(()) => serde_json::json!({ "ok": true }),
        Err(e) => error_response(&e),
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
    use super::{error_response, handle_request};
    use std::path::PathBuf;

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
        let leftovers: Vec<_> = std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".markcraft-"))
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
