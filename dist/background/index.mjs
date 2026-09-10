chrome.runtime.onMessage.addListener((e, c, o) => {
  var i;
  if (e.type === "bg-fetch" || e.action === "bg-fetch") {
    const r = e.url || ((i = e.data) == null ? void 0 : i.url);
    return fetch(r).then(async (a) => {
      try {
        const t = await a.text(), n = a.ok || a.status === 0 || a.status === 200;
        o({ ok: n, res: t, status: a.status });
      } catch (t) {
        o({ ok: !1, msg: t.message });
      }
    }).catch((a) => {
      o({ ok: !1, msg: a.message });
    }), !0;
  }
  if (e.type === "native-save") {
    let r = !1;
    const a = (t) => {
      r || (r = !0, o(t));
    };
    try {
      const t = chrome.runtime.connectNative("com.markcraft.filewriter");
      t.onMessage.addListener((n) => {
        a(n), t.disconnect();
      }), t.onDisconnect.addListener(() => {
        var s;
        const n = (s = chrome.runtime.lastError) == null ? void 0 : s.message;
        a({ ok: !1, error: n || "native host disconnected" });
      }), t.postMessage({ path: e.path, content: e.content });
    } catch (t) {
      a({ ok: !1, error: (t == null ? void 0 : t.message) || String(t) });
    }
    return !0;
  }
  if (e.type === "bg-task" || e.action === "bg-task" || e.action === "open-options-page" || e.type === "open-options-page")
    return chrome.runtime.openOptionsPage(), o({ ok: !0 }), !0;
});
chrome.commands.onCommand.addListener((e) => {
  chrome.tabs.query({ active: !0, currentWindow: !0 }, (c) => {
    var o;
    (o = c[0]) != null && o.id && chrome.tabs.sendMessage(c[0].id, { type: "command", command: e });
  });
});
