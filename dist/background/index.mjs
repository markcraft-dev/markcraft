function u(t) {
  if (!t.startsWith("file://"))
    return null;
  let e = t.slice(7).split("#")[0].split("?")[0];
  if (e.startsWith("localhost/") && (e = e.slice(10)), !e.startsWith("/"))
    return null;
  try {
    e = decodeURIComponent(e);
  } catch {
  }
  return e;
}
const g = 64 * 1024 * 1024, p = 4e3;
chrome.runtime.onMessage.addListener((t, e, a) => {
  var h;
  if (t.type === "bg-fetch" || t.action === "bg-fetch") {
    const c = t.url || ((h = t.data) == null ? void 0 : h.url);
    return fetch(c).then(async (n) => {
      try {
        const r = await n.text(), i = n.ok || n.status === 0 || n.status === 200;
        a({ ok: i, res: r, status: n.status });
      } catch (r) {
        a({ ok: !1, msg: r.message });
      }
    }).catch((n) => {
      a({ ok: !1, msg: n.message });
    }), !0;
  }
  if (t.type === "native-save") {
    let c = !1, n;
    const r = (o) => {
      c || (c = !0, n !== void 0 && clearTimeout(n), a(o));
    }, i = typeof t.path == "string" ? t.path : "", s = typeof t.content == "string" ? t.content : null, m = typeof t.sourceUrl == "string" ? t.sourceUrl : "";
    if (e.id !== chrome.runtime.id || s === null || s.length > g || !m.startsWith("file://") || !i.startsWith("/") || i !== u(m))
      return r({ ok: !1, error: "native-save request rejected" }), !0;
    try {
      const o = chrome.runtime.connectNative("com.markcraft.filewriter");
      o.onMessage.addListener((l) => {
        r(l), o.disconnect();
      }), o.onDisconnect.addListener(() => {
        var f;
        const l = (f = chrome.runtime.lastError) == null ? void 0 : f.message;
        r({ ok: !1, error: l || "native host disconnected" });
      });
      const d = Math.min(
        6e4,
        p + Math.floor(s.length / 1e6) * 2e3
      );
      n = setTimeout(() => {
        try {
          o.disconnect();
        } catch {
        }
        r({ ok: !1, error: "native host timeout" });
      }, d), o.postMessage({ path: i, content: s });
    } catch (o) {
      r({ ok: !1, error: (o == null ? void 0 : o.message) || String(o) });
    }
    return !0;
  }
  if (t.type === "bg-task" || t.action === "bg-task" || t.action === "open-options-page" || t.type === "open-options-page")
    return chrome.runtime.openOptionsPage(), a({ ok: !0 }), !0;
});
chrome.commands.onCommand.addListener((t) => {
  chrome.tabs.query({ active: !0, currentWindow: !0 }, (e) => {
    var a;
    (a = e[0]) != null && a.id && chrome.tabs.sendMessage(e[0].id, { type: "command", command: t });
  });
});
