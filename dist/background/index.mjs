chrome.runtime.onMessage.addListener((t, o, a) => {
  var i;
  if (t.type === "bg-fetch" || t.action === "bg-fetch") {
    const n = t.url || ((i = t.data) == null ? void 0 : i.url);
    return fetch(n).then(async (c) => {
      try {
        const e = await c.text(), m = c.ok || c.status === 0 || c.status === 200;
        a({ ok: m, res: e, status: c.status });
      } catch (e) {
        a({ ok: !1, msg: e.message });
      }
    }).catch((c) => {
      a({ ok: !1, msg: c.message });
    }), !0;
  }
  if (t.type === "bg-task" || t.action === "bg-task" || t.action === "open-options-page" || t.type === "open-options-page")
    return chrome.runtime.openOptionsPage(), a({ ok: !0 }), !0;
});
chrome.commands.onCommand.addListener((t) => {
  chrome.tabs.query({ active: !0, currentWindow: !0 }, (o) => {
    var a;
    (a = o[0]) != null && a.id && chrome.tabs.sendMessage(o[0].id, { type: "command", command: t });
  });
});
