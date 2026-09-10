(function() {
  const t = document.createElement("link").relList;
  if (t && t.supports && t.supports("modulepreload"))
    return;
  for (const r of document.querySelectorAll('link[rel="modulepreload"]'))
    s(r);
  new MutationObserver((r) => {
    for (const i of r)
      if (i.type === "childList")
        for (const o of i.addedNodes)
          o.tagName === "LINK" && o.rel === "modulepreload" && s(o);
  }).observe(document, { childList: true, subtree: true });
  function n(r) {
    const i = {};
    return r.integrity && (i.integrity = r.integrity), r.referrerPolicy && (i.referrerPolicy = r.referrerPolicy), r.crossOrigin === "use-credentials" ? i.credentials = "include" : r.crossOrigin === "anonymous" ? i.credentials = "omit" : i.credentials = "same-origin", i;
  }
  function s(r) {
    if (r.ep)
      return;
    r.ep = true;
    const i = n(r);
    fetch(r.href, i);
  }
})();
/**
* @vue/shared v3.5.41
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function ls(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const n of e.split(","))
    t[n] = 1;
  return (n) => n in t;
}
const G = {}, xt = [], He = () => {
}, hr = () => false, Sn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), Cn = (e) => e.startsWith("onUpdate:"), ne = Object.assign, cs = (e, t) => {
  const n = e.indexOf(t);
  n > -1 && e.splice(n, 1);
}, Mi = Object.prototype.hasOwnProperty, B = (e, t) => Mi.call(e, t), M = Array.isArray, St = (e) => Yt(e) === "[object Map]", wn = (e) => Yt(e) === "[object Set]", Ms = (e) => Yt(e) === "[object Date]", N = (e) => typeof e == "function", Q = (e) => typeof e == "string", $e = (e) => typeof e == "symbol", U = (e) => e !== null && typeof e == "object", pr = (e) => (U(e) || N(e)) && N(e.then) && N(e.catch), gr = Object.prototype.toString, Yt = (e) => gr.call(e), Ii = (e) => Yt(e).slice(8, -1), mr = (e) => Yt(e) === "[object Object]", fs = (e) => Q(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, Dt = ls(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"), Tn = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return (n) => t[n] || (t[n] = e(n));
}, Li = /-\w/g, Ee = Tn((e) => e.replace(Li, (t) => t.slice(1).toUpperCase())), Fi = /\B([A-Z])/g, bt = Tn((e) => e.replace(Fi, "-$1").toLowerCase()), br = Tn((e) => e.charAt(0).toUpperCase() + e.slice(1)), Nn = Tn((e) => e ? `on${br(e)}` : ""), Ve = (e, t) => !Object.is(e, t), ln = (e, ...t) => {
  for (let n = 0; n < e.length; n++)
    e[n](...t);
}, _r = (e, t, n, s = false) => {
  Object.defineProperty(e, t, { configurable: true, enumerable: false, writable: s, value: n });
}, us = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
}, Ri = (e) => {
  const t = Q(e) ? Number(e) : NaN;
  return isNaN(t) ? e : t;
};
let Is;
const En = () => Is || (Is = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {});
function as(e) {
  if (M(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const s = e[n], r = Q(s) ? Hi(s) : as(s);
      if (r)
        for (const i in r)
          t[i] = r[i];
    }
    return t;
  } else if (Q(e) || U(e))
    return e;
}
const Di = /;(?![^(]*\))/g, Ni = /:([^]+)/, Vi = /\/\*[^]*?\*\//g;
function Hi(e) {
  const t = {};
  return e.replace(Vi, "").split(Di).forEach((n) => {
    if (n) {
      const s = n.split(Ni);
      s.length > 1 && (t[s[0].trim()] = s[1].trim());
    }
  }), t;
}
function tt(e) {
  let t = "";
  if (Q(e))
    t = e;
  else if (M(e))
    for (let n = 0; n < e.length; n++) {
      const s = tt(e[n]);
      s && (t += s + " ");
    }
  else if (U(e))
    for (const n in e)
      e[n] && (t += n + " ");
  return t.trim();
}
const $i = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly", ji = ls($i);
function vr(e) {
  return !!e || e === "";
}
function Bi(e, t) {
  if (e.length !== t.length)
    return false;
  let n = true;
  for (let s = 0; n && s < e.length; s++)
    n = Xt(e[s], t[s]);
  return n;
}
function Xt(e, t) {
  if (e === t)
    return true;
  let n = Ms(e), s = Ms(t);
  if (n || s)
    return n && s ? e.getTime() === t.getTime() : false;
  if (n = $e(e), s = $e(t), n || s)
    return e === t;
  if (n = M(e), s = M(t), n || s)
    return n && s ? Bi(e, t) : false;
  if (n = U(e), s = U(t), n || s) {
    if (!n || !s)
      return false;
    const r = Object.keys(e).length, i = Object.keys(t).length;
    if (r !== i)
      return false;
    for (const o in e) {
      const l = e.hasOwnProperty(o), c = t.hasOwnProperty(o);
      if (l && !c || !l && c || !Xt(e[o], t[o]))
        return false;
    }
  }
  return String(e) === String(t);
}
function yr(e, t) {
  return e.findIndex((n) => Xt(n, t));
}
const xr = (e) => !!(e && e.__v_isRef === true), Lt = (e) => Q(e) ? e : e == null ? "" : M(e) || U(e) && (e.toString === gr || !N(e.toString)) ? xr(e) ? Lt(e.value) : JSON.stringify(e, Sr, 2) : String(e), Sr = (e, t) => xr(t) ? Sr(e, t.value) : St(t) ? { [`Map(${t.size})`]: [...t.entries()].reduce((n, [s, r], i) => (n[Vn(s, i) + " =>"] = r, n), {}) } : wn(t) ? { [`Set(${t.size})`]: [...t.values()].map((n) => Vn(n)) } : $e(t) ? Vn(t) : U(t) && !M(t) && !mr(t) ? String(t) : t, Vn = (e, t = "") => {
  var n;
  return $e(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e;
};
/**
* @vue/reactivity v3.5.41
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
let ie;
class Ui {
  constructor(t = false) {
    this.detached = t, this._active = true, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = false, this._warnOnRun = true, this.__v_skip = true, !t && ie && (ie.active ? (this.parent = ie, this.index = (ie.scopes || (ie.scopes = [])).push(this) - 1) : (this._active = false, this._warnOnRun = false));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = true;
      let t, n;
      if (this.scopes) {
        const s = this.scopes.slice();
        for (t = 0, n = s.length; t < n; t++)
          s[t].pause();
      }
      for (t = 0, n = this.effects.length; t < n; t++)
        this.effects[t].pause();
    }
  }
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = false;
      let t, n;
      if (this.scopes) {
        const r = this.scopes.slice();
        for (t = 0, n = r.length; t < n; t++)
          r[t].resume();
      }
      const s = this.effects.slice();
      for (t = 0, n = s.length; t < n; t++)
        s[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const n = ie;
      try {
        return ie = this, t();
      } finally {
        ie = n;
      }
    }
  }
  on() {
    ++this._on === 1 && (this.prevScope = ie, ie = this);
  }
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (ie === this)
        ie = this.prevScope;
      else {
        let t = ie;
        for (; t; ) {
          if (t.prevScope === this) {
            t.prevScope = this.prevScope;
            break;
          }
          t = t.prevScope;
        }
      }
      this.prevScope = void 0;
    }
  }
  stop(t) {
    if (this._active) {
      this._active = false;
      let n, s;
      for (n = 0, s = this.effects.length; n < s; n++)
        this.effects[n].stop();
      for (this.effects.length = 0, n = 0, s = this.cleanups.length; n < s; n++)
        this.cleanups[n]();
      if (this.cleanups.length = 0, this.scopes) {
        const r = this.scopes.slice();
        for (n = 0, s = r.length; n < s; n++)
          r[n].stop(true);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const r = this.parent.scopes.pop();
        r && r !== this && (this.parent.scopes[this.index] = r, r.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function Ki() {
  return ie;
}
let J;
const Hn = /* @__PURE__ */ new WeakSet();
class Cr {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, ie && (ie.active ? ie.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Hn.has(this) && (Hn.delete(this), this.trigger()));
  }
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Tr(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, Ls(this), Er(this);
    const t = J, n = Ae;
    J = this, Ae = true;
    try {
      return this.fn();
    } finally {
      Ar(this), J = t, Ae = n, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        ps(t);
      this.deps = this.depsTail = void 0, Ls(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Hn.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  runIfDirty() {
    Yn(this) && this.run();
  }
  get dirty() {
    return Yn(this);
  }
}
let wr = 0, Nt, Vt;
function Tr(e, t = false) {
  if (e.flags |= 8, t) {
    e.next = Vt, Vt = e;
    return;
  }
  e.next = Nt, Nt = e;
}
function ds() {
  wr++;
}
function hs() {
  if (--wr > 0)
    return;
  if (Vt) {
    let t = Vt;
    for (Vt = void 0; t; ) {
      const n = t.next;
      t.next = void 0, t.flags &= -9, t = n;
    }
  }
  let e;
  for (; Nt; ) {
    let t = Nt;
    for (Nt = void 0; t; ) {
      const n = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (s) {
          e || (e = s);
        }
      t = n;
    }
  }
  if (e)
    throw e;
}
function Er(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function Ar(e) {
  let t, n = e.depsTail, s = n;
  for (; s; ) {
    const r = s.prevDep;
    s.version === -1 ? (s === n && (n = r), ps(s), ki(s)) : t = s, s.dep.activeLink = s.prevActiveLink, s.prevActiveLink = void 0, s = r;
  }
  e.deps = t, e.depsTail = n;
}
function Yn(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (Or(t.dep.computed) || t.dep.version !== t.version))
      return true;
  return !!e._dirty;
}
function Or(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === Ut) || (e.globalVersion = Ut, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !Yn(e))))
    return;
  e.flags |= 2;
  const t = e.dep, n = J, s = Ae;
  J = e, Ae = true;
  try {
    Er(e);
    const r = e.fn(e._value);
    (t.version === 0 || Ve(r, e._value)) && (e.flags |= 128, e._value = r, t.version++);
  } catch (r) {
    throw t.version++, r;
  } finally {
    J = n, Ae = s, Ar(e), e.flags &= -3;
  }
}
function ps(e, t = false) {
  const { dep: n, prevSub: s, nextSub: r } = e;
  if (s && (s.nextSub = r, e.prevSub = void 0), r && (r.prevSub = s, e.nextSub = void 0), n.subs === e && (n.subs = s, !s && n.computed)) {
    n.computed.flags &= -5;
    for (let i = n.computed.deps; i; i = i.nextDep)
      ps(i, true);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function ki(e) {
  const { prevDep: t, nextDep: n } = e;
  t && (t.nextDep = n, e.prevDep = void 0), n && (n.prevDep = t, e.nextDep = void 0);
}
let Ae = true;
const Pr = [];
function ze() {
  Pr.push(Ae), Ae = false;
}
function Je() {
  const e = Pr.pop();
  Ae = e === void 0 ? true : e;
}
function Ls(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const n = J;
    J = void 0;
    try {
      t();
    } finally {
      J = n;
    }
  }
}
let Ut = 0;
class Wi {
  constructor(t, n) {
    this.sub = t, this.dep = n, this.version = n.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class gs {
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = true;
  }
  track(t) {
    if (!J || !Ae || J === this.computed)
      return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== J)
      n = this.activeLink = new Wi(J, this), J.deps ? (n.prevDep = J.depsTail, J.depsTail.nextDep = n, J.depsTail = n) : J.deps = J.depsTail = n, Mr(n);
    else if (n.version === -1 && (n.version = this.version, n.nextDep)) {
      const s = n.nextDep;
      s.prevDep = n.prevDep, n.prevDep && (n.prevDep.nextDep = s), n.prevDep = J.depsTail, n.nextDep = void 0, J.depsTail.nextDep = n, J.depsTail = n, J.deps === n && (J.deps = s);
    }
    return n;
  }
  trigger(t) {
    this.version++, Ut++, this.notify(t);
  }
  notify(t) {
    ds();
    try {
      for (let n = this.subs; n; n = n.prevSub)
        n.sub.notify() && n.sub.dep.notify();
    } finally {
      hs();
    }
  }
}
function Mr(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let s = t.deps; s; s = s.nextDep)
        Mr(s);
    }
    const n = e.dep.subs;
    n !== e && (e.prevSub = n, n && (n.nextSub = e)), e.dep.subs = e;
  }
}
const Xn = /* @__PURE__ */ new WeakMap(), pt = Symbol(""), Zn = Symbol(""), Kt = Symbol("");
function le(e, t, n) {
  if (Ae && J) {
    let s = Xn.get(e);
    s || Xn.set(e, s = /* @__PURE__ */ new Map());
    let r = s.get(n);
    r || (s.set(n, r = new gs()), r.map = s, r.key = n), r.track();
  }
}
function qe(e, t, n, s, r, i) {
  const o = Xn.get(e);
  if (!o) {
    Ut++;
    return;
  }
  const l = (c) => {
    c && c.trigger();
  };
  if (ds(), t === "clear")
    o.forEach(l);
  else {
    const c = M(e), d = c && fs(n);
    if (c && n === "length") {
      const u = Number(s);
      o.forEach((h, v) => {
        (v === "length" || v === Kt || !$e(v) && v >= u) && l(h);
      });
    } else
      switch ((n !== void 0 || o.has(void 0)) && l(o.get(n)), d && l(o.get(Kt)), t) {
        case "add":
          c ? d && l(o.get("length")) : (l(o.get(pt)), St(e) && l(o.get(Zn)));
          break;
        case "delete":
          c || (l(o.get(pt)), St(e) && l(o.get(Zn)));
          break;
        case "set":
          St(e) && l(o.get(pt));
          break;
      }
  }
  hs();
}
function _t(e) {
  const t = j(e);
  return t === e ? t : (le(t, "iterate", Kt), Ce(e) ? t : t.map(Oe));
}
function An(e) {
  return le(e = j(e), "iterate", Kt), e;
}
function De(e, t) {
  return Ye(e) ? Tt(gt(e) ? Oe(t) : t) : Oe(t);
}
const qi = { __proto__: null, [Symbol.iterator]() {
  return $n(this, Symbol.iterator, (e) => De(this, e));
}, concat(...e) {
  return _t(this).concat(...e.map((t) => M(t) ? _t(t) : t));
}, entries() {
  return $n(this, "entries", (e) => (e[1] = De(this, e[1]), e));
}, every(e, t) {
  return Be(this, "every", e, t, void 0, arguments);
}, filter(e, t) {
  return Be(this, "filter", e, t, (n) => n.map((s) => De(this, s)), arguments);
}, find(e, t) {
  return Be(this, "find", e, t, (n) => De(this, n), arguments);
}, findIndex(e, t) {
  return Be(this, "findIndex", e, t, void 0, arguments);
}, findLast(e, t) {
  return Be(this, "findLast", e, t, (n) => De(this, n), arguments);
}, findLastIndex(e, t) {
  return Be(this, "findLastIndex", e, t, void 0, arguments);
}, forEach(e, t) {
  return Be(this, "forEach", e, t, void 0, arguments);
}, includes(...e) {
  return jn(this, "includes", e);
}, indexOf(...e) {
  return jn(this, "indexOf", e);
}, join(e) {
  return _t(this).join(e);
}, lastIndexOf(...e) {
  return jn(this, "lastIndexOf", e);
}, map(e, t) {
  return Be(this, "map", e, t, void 0, arguments);
}, pop() {
  return Pt(this, "pop");
}, push(...e) {
  return Pt(this, "push", e);
}, reduce(e, ...t) {
  return Fs(this, "reduce", e, t);
}, reduceRight(e, ...t) {
  return Fs(this, "reduceRight", e, t);
}, shift() {
  return Pt(this, "shift");
}, some(e, t) {
  return Be(this, "some", e, t, void 0, arguments);
}, splice(...e) {
  return Pt(this, "splice", e);
}, toReversed() {
  return _t(this).toReversed();
}, toSorted(e) {
  return _t(this).toSorted(e);
}, toSpliced(...e) {
  return _t(this).toSpliced(...e);
}, unshift(...e) {
  return Pt(this, "unshift", e);
}, values() {
  return $n(this, "values", (e) => De(this, e));
} };
function $n(e, t, n) {
  const s = An(e), r = s[t]();
  return s !== e && !Ce(e) && (r._next = r.next, r.next = () => {
    const i = r._next();
    return i.done || (i.value = n(i.value)), i;
  }), r;
}
const Gi = Array.prototype;
function Be(e, t, n, s, r, i) {
  const o = An(e), l = o !== e && !Ce(e), c = o[t];
  if (c !== Gi[t]) {
    const h = c.apply(e, i);
    return l ? Oe(h) : h;
  }
  let d = n;
  o !== e && (l ? d = function(h, v) {
    return n.call(this, De(e, h), v, e);
  } : n.length > 2 && (d = function(h, v) {
    return n.call(this, h, v, e);
  }));
  const u = c.call(o, d, s);
  return l && r ? r(u) : u;
}
function Fs(e, t, n, s) {
  const r = An(e), i = r !== e && !Ce(e);
  let o = n, l = false;
  r !== e && (i ? (l = s.length === 0, o = function(d, u, h) {
    return l && (l = false, d = De(e, d)), n.call(this, d, De(e, u), h, e);
  }) : n.length > 3 && (o = function(d, u, h) {
    return n.call(this, d, u, h, e);
  }));
  const c = r[t](o, ...s);
  return l ? De(e, c) : c;
}
function jn(e, t, n) {
  const s = j(e);
  le(s, "iterate", Kt);
  const r = s[t](...n);
  return (r === -1 || r === false) && vs(n[0]) ? (n[0] = j(n[0]), s[t](...n)) : r;
}
function Pt(e, t, n = []) {
  ze(), ds();
  const s = j(e)[t].apply(e, n);
  return hs(), Je(), s;
}
const zi = ls("__proto__,__v_isRef,__isVue"), Ir = new Set(Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter($e));
function Ji(e) {
  $e(e) || (e = String(e));
  const t = j(this);
  return le(t, "has", e), t.hasOwnProperty(e);
}
class Lr {
  constructor(t = false, n = false) {
    this._isReadonly = t, this._isShallow = n;
  }
  get(t, n, s) {
    if (n === "__v_skip")
      return t.__v_skip;
    const r = this._isReadonly, i = this._isShallow;
    if (n === "__v_isReactive")
      return !r;
    if (n === "__v_isReadonly")
      return r;
    if (n === "__v_isShallow")
      return i;
    if (n === "__v_raw")
      return s === (r ? i ? io : Nr : i ? Dr : Rr).get(t) || Object.getPrototypeOf(t) === Object.getPrototypeOf(s) ? t : void 0;
    const o = M(t);
    if (!r) {
      let c;
      if (o && (c = qi[n]))
        return c;
      if (n === "hasOwnProperty")
        return Ji;
    }
    const l = Reflect.get(t, n, ce(t) ? t : s);
    if (($e(n) ? Ir.has(n) : zi(n)) || (r || le(t, "get", n), i))
      return l;
    if (ce(l)) {
      const c = o && fs(n) ? l : l.value;
      return r && U(c) ? es(c) : c;
    }
    return U(l) ? r ? es(l) : bs(l) : l;
  }
}
class Fr extends Lr {
  constructor(t = false) {
    super(false, t);
  }
  set(t, n, s, r) {
    let i = t[n];
    const o = M(t) && fs(n);
    if (!this._isShallow) {
      const d = Ye(i);
      if (!Ce(s) && !Ye(s) && (i = j(i), s = j(s)), !o && ce(i) && !ce(s))
        return d || (i.value = s), true;
    }
    const l = o ? Number(n) < t.length : B(t, n), c = Reflect.set(t, n, s, ce(t) ? t : r);
    return t === j(r) && c && (l ? Ve(s, i) && qe(t, "set", n, s) : qe(t, "add", n, s)), c;
  }
  deleteProperty(t, n) {
    const s = B(t, n);
    t[n];
    const r = Reflect.deleteProperty(t, n);
    return r && s && qe(t, "delete", n, void 0), r;
  }
  has(t, n) {
    const s = Reflect.has(t, n);
    return (!$e(n) || !Ir.has(n)) && le(t, "has", n), s;
  }
  ownKeys(t) {
    return le(t, "iterate", M(t) ? "length" : pt), Reflect.ownKeys(t);
  }
}
class Yi extends Lr {
  constructor(t = false) {
    super(true, t);
  }
  set(t, n) {
    return true;
  }
  deleteProperty(t, n) {
    return true;
  }
}
const Xi = new Fr(), Zi = new Yi(), Qi = new Fr(true);
const Qn = (e) => e, nn = (e) => Reflect.getPrototypeOf(e);
function eo(e, t, n) {
  return function(...s) {
    const r = this.__v_raw, i = j(r), o = St(i), l = e === "entries" || e === Symbol.iterator && o, c = e === "keys" && o, d = r[e](...s), u = n ? Qn : t ? Tt : Oe;
    return !t && le(i, "iterate", c ? Zn : pt), ne(Object.create(d), { next() {
      const { value: h, done: v } = d.next();
      return v ? { value: h, done: v } : { value: l ? [u(h[0]), u(h[1])] : u(h), done: v };
    } });
  };
}
function sn(e) {
  return function(...t) {
    return e === "delete" ? false : e === "clear" ? void 0 : this;
  };
}
function to(e, t) {
  const n = { get(r) {
    const i = this.__v_raw, o = j(i), l = j(r);
    e || (Ve(r, l) && le(o, "get", r), le(o, "get", l));
    const { has: c } = nn(o), d = t ? Qn : e ? Tt : Oe;
    if (c.call(o, r))
      return d(i.get(r));
    if (c.call(o, l))
      return d(i.get(l));
    i !== o && i.get(r);
  }, get size() {
    const r = this.__v_raw;
    return !e && le(j(r), "iterate", pt), r.size;
  }, has(r) {
    const i = this.__v_raw, o = j(i), l = j(r);
    return e || (Ve(r, l) && le(o, "has", r), le(o, "has", l)), r === l ? i.has(r) : i.has(r) || i.has(l);
  }, forEach(r, i) {
    const o = this, l = o.__v_raw, c = j(l), d = t ? Qn : e ? Tt : Oe;
    return !e && le(c, "iterate", pt), l.forEach((u, h) => r.call(i, d(u), d(h), o));
  } };
  return ne(n, e ? { add: sn("add"), set: sn("set"), delete: sn("delete"), clear: sn("clear") } : { add(r) {
    const i = j(this), o = nn(i), l = j(r), c = !t && !Ce(r) && !Ye(r) ? l : r;
    return o.has.call(i, c) || Ve(r, c) && o.has.call(i, r) || Ve(l, c) && o.has.call(i, l) || (i.add(c), qe(i, "add", c, c)), this;
  }, set(r, i) {
    !t && !Ce(i) && !Ye(i) && (i = j(i));
    const o = j(this), { has: l, get: c } = nn(o);
    let d = l.call(o, r);
    d || (r = j(r), d = l.call(o, r));
    const u = c.call(o, r);
    return o.set(r, i), d ? Ve(i, u) && qe(o, "set", r, i) : qe(o, "add", r, i), this;
  }, delete(r) {
    const i = j(this), { has: o, get: l } = nn(i);
    let c = o.call(i, r);
    c || (r = j(r), c = o.call(i, r)), l && l.call(i, r);
    const d = i.delete(r);
    return c && qe(i, "delete", r, void 0), d;
  }, clear() {
    const r = j(this), i = r.size !== 0, o = r.clear();
    return i && qe(r, "clear", void 0, void 0), o;
  } }), ["keys", "values", "entries", Symbol.iterator].forEach((r) => {
    n[r] = eo(r, e, t);
  }), n;
}
function ms(e, t) {
  const n = to(e, t);
  return (s, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_raw" ? s : Reflect.get(B(n, r) && r in s ? n : s, r, i);
}
const no = { get: ms(false, false) }, so = { get: ms(false, true) }, ro = { get: ms(true, false) };
const Rr = /* @__PURE__ */ new WeakMap(), Dr = /* @__PURE__ */ new WeakMap(), Nr = /* @__PURE__ */ new WeakMap(), io = /* @__PURE__ */ new WeakMap();
function oo(e) {
  switch (e) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
function bs(e) {
  return Ye(e) ? e : _s(e, false, Xi, no, Rr);
}
function lo(e) {
  return _s(e, false, Qi, so, Dr);
}
function es(e) {
  return _s(e, true, Zi, ro, Nr);
}
function _s(e, t, n, s, r) {
  if (!U(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e))
    return e;
  const i = r.get(e);
  if (i)
    return i;
  const o = oo(Ii(e));
  if (o === 0)
    return e;
  const l = new Proxy(e, o === 2 ? s : n);
  return r.set(e, l), l;
}
function gt(e) {
  return Ye(e) ? gt(e.__v_raw) : !!(e && e.__v_isReactive);
}
function Ye(e) {
  return !!(e && e.__v_isReadonly);
}
function Ce(e) {
  return !!(e && e.__v_isShallow);
}
function vs(e) {
  return e ? !!e.__v_raw : false;
}
function j(e) {
  const t = e && e.__v_raw;
  return t ? j(t) : e;
}
function co(e) {
  return !B(e, "__v_skip") && Object.isExtensible(e) && _r(e, "__v_skip", true), e;
}
const Oe = (e) => U(e) ? bs(e) : e, Tt = (e) => U(e) ? es(e) : e;
function ce(e) {
  return e ? e.__v_isRef === true : false;
}
function vt(e) {
  return fo(e, false);
}
function fo(e, t) {
  return ce(e) ? e : new uo(e, t);
}
class uo {
  constructor(t, n) {
    this.dep = new gs(), this.__v_isRef = true, this.__v_isShallow = false, this._rawValue = n ? t : j(t), this._value = n ? t : Oe(t), this.__v_isShallow = n;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const n = this._rawValue, s = this.__v_isShallow || Ce(t) || Ye(t);
    t = s ? t : j(t), Ve(t, n) && (this._rawValue = t, this._value = s ? t : Oe(t), this.dep.trigger());
  }
}
function ao(e) {
  return ce(e) ? e.value : e;
}
const ho = { get: (e, t, n) => t === "__v_raw" ? e : ao(Reflect.get(e, t, n)), set: (e, t, n, s) => {
  const r = e[t];
  return ce(r) && !ce(n) ? (r.value = n, true) : Reflect.set(e, t, n, s);
} };
function Vr(e) {
  return gt(e) ? e : new Proxy(e, ho);
}
class po {
  constructor(t, n, s) {
    this.fn = t, this.setter = n, this._value = void 0, this.dep = new gs(this), this.__v_isRef = true, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = Ut - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n, this.isSSR = s;
  }
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && J !== this)
      return Tr(this, true), true;
  }
  get value() {
    const t = this.dep.track();
    return Or(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
function go(e, t, n = false) {
  let s, r;
  return N(e) ? s = e : (s = e.get, r = e.set), new po(s, r, n);
}
const rn = {}, an = /* @__PURE__ */ new WeakMap();
let ut;
function mo(e, t = false, n = ut) {
  if (n) {
    let s = an.get(n);
    s || an.set(n, s = []), s.push(e);
  }
}
function bo(e, t, n = G) {
  const { immediate: s, deep: r, once: i, scheduler: o, augmentJob: l, call: c } = n, d = (E) => r ? E : Ce(E) || r === false || r === 0 ? Ge(E, 1) : Ge(E);
  let u, h, v, C, R = false, P = false;
  if (ce(e) ? (h = () => e.value, R = Ce(e)) : gt(e) ? (h = () => d(e), R = true) : M(e) ? (P = true, R = e.some((E) => gt(E) || Ce(E)), h = () => e.map((E) => {
    if (ce(E))
      return E.value;
    if (gt(E))
      return d(E);
    if (N(E))
      return c ? c(E, 2) : E();
  })) : N(e) ? t ? h = c ? () => c(e, 2) : e : h = () => {
    if (v) {
      ze();
      try {
        v();
      } finally {
        Je();
      }
    }
    const E = ut;
    ut = u;
    try {
      return c ? c(e, 3, [C]) : e(C);
    } finally {
      ut = E;
    }
  } : h = He, t && r) {
    const E = h, $ = r === true ? 1 / 0 : r;
    h = () => Ge(E(), $);
  }
  const W = Ki(), O = () => {
    u.stop(), W && W.active && cs(W.effects, u);
  };
  if (i && t) {
    const E = t;
    t = (...$) => {
      const ee = E(...$);
      return O(), ee;
    };
  }
  let F = P ? new Array(e.length).fill(rn) : rn;
  const D = (E) => {
    if (!(!(u.flags & 1) || !u.dirty && !E))
      if (t) {
        const $ = u.run();
        if (E || r || R || (P ? $.some((ee, fe) => Ve(ee, F[fe])) : Ve($, F))) {
          v && v();
          const ee = ut;
          ut = u;
          try {
            const fe = [$, F === rn ? void 0 : P && F[0] === rn ? [] : F, C];
            F = $, c ? c(t, 3, fe) : t(...fe);
          } finally {
            ut = ee;
          }
        }
      } else
        u.run();
  };
  return l && l(D), u = new Cr(h), u.scheduler = o ? () => o(D, false) : D, C = (E) => mo(E, false, u), v = u.onStop = () => {
    const E = an.get(u);
    if (E) {
      if (c)
        c(E, 4);
      else
        for (const $ of E)
          $();
      an.delete(u);
    }
  }, t ? s ? D(true) : F = u.run() : o ? o(D.bind(null, true), true) : u.run(), O.pause = u.pause.bind(u), O.resume = u.resume.bind(u), O.stop = O, O;
}
function Ge(e, t = 1 / 0, n) {
  if (t <= 0 || !U(e) || e.__v_skip || (n = n || /* @__PURE__ */ new Map(), (n.get(e) || 0) >= t))
    return e;
  if (n.set(e, t), t--, ce(e))
    Ge(e.value, t, n);
  else if (M(e))
    for (let s = 0; s < e.length; s++)
      Ge(e[s], t, n);
  else if (wn(e) || St(e))
    e.forEach((s) => {
      Ge(s, t, n);
    });
  else if (mr(e)) {
    for (const s in e)
      Ge(e[s], t, n);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && Ge(e[s], t, n);
  }
  return e;
}
/**
* @vue/runtime-core v3.5.41
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function Zt(e, t, n, s) {
  try {
    return s ? e(...s) : e();
  } catch (r) {
    On(r, t, n);
  }
}
function we(e, t, n, s) {
  if (N(e)) {
    const r = Zt(e, t, n, s);
    return r && pr(r) && r.catch((i) => {
      On(i, t, n);
    }), r;
  }
  if (M(e)) {
    const r = [];
    for (let i = 0; i < e.length; i++)
      r.push(we(e[i], t, n, s));
    return r;
  }
}
function On(e, t, n, s = true) {
  const r = t ? t.vnode : null, { errorHandler: i, throwUnhandledErrorInProduction: o } = t && t.appContext.config || G;
  if (t) {
    let l = t.parent;
    const c = t.proxy, d = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; l; ) {
      const u = l.ec;
      if (u) {
        for (let h = 0; h < u.length; h++)
          if (u[h](e, c, d) === false)
            return;
      }
      l = l.parent;
    }
    if (i) {
      ze(), Zt(i, null, 10, [e, c, d]), Je();
      return;
    }
  }
  _o(e, n, r, s, o);
}
function _o(e, t, n, s = true, r = false) {
  if (r)
    throw e;
  console.error(e);
}
const ae = [];
let Re = -1;
const Ct = [];
let et = null, yt = 0;
const Hr = Promise.resolve();
let dn = null;
function cn(e) {
  const t = dn || Hr;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function vo(e) {
  let t = Re + 1, n = ae.length;
  for (; t < n; ) {
    const s = t + n >>> 1, r = ae[s], i = kt(r);
    i < e || i === e && r.flags & 2 ? t = s + 1 : n = s;
  }
  return t;
}
function ys(e) {
  if (!(e.flags & 1)) {
    const t = kt(e), n = ae[ae.length - 1];
    !n || !(e.flags & 2) && t >= kt(n) ? ae.push(e) : ae.splice(vo(t), 0, e), e.flags |= 1, $r();
  }
}
function $r() {
  dn || (dn = Hr.then(Br));
}
function yo(e) {
  if (!M(e))
    et && e.id === -1 ? et.splice(yt + 1, 0, e) : e.flags & 1 || (Ct.push(e), e.flags |= 1);
  else
    for (let t = 0; t < e.length; t++)
      Ct.push(e[t]);
  $r();
}
function Rs(e, t, n = Re + 1) {
  for (; n < ae.length; n++) {
    const s = ae[n];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid)
        continue;
      ae.splice(n, 1), n--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2);
    }
  }
}
function jr(e) {
  if (Ct.length) {
    const t = [...new Set(Ct)].sort((n, s) => kt(n) - kt(s));
    if (Ct.length = 0, et) {
      for (let n = 0; n < t.length; n++)
        et.push(t[n]);
      return;
    }
    for (et = t, yt = 0; yt < et.length; yt++) {
      const n = et[yt];
      n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), n.flags &= -2;
    }
    et = null, yt = 0;
  }
}
const kt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function Br(e) {
  try {
    for (Re = 0; Re < ae.length; Re++) {
      const t = ae[Re];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Zt(t, t.i, t.i ? 15 : 14), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Re < ae.length; Re++) {
      const t = ae[Re];
      t && (t.flags &= -2);
    }
    Re = -1, ae.length = 0, jr(), dn = null, (ae.length || Ct.length) && Br();
  }
}
let Se = null, Ur = null;
function hn(e) {
  const t = Se;
  return Se = e, Ur = e && e.type.__scopeId || null, t;
}
function Kr(e, t = Se, n) {
  if (!t || e._n)
    return e;
  const s = (...r) => {
    s._d && bn(-1);
    const i = hn(t), o = mt.length;
    let l;
    try {
      l = e(...r);
    } finally {
      for (let c = mt.length; c > o; c--)
        bi();
      hn(i), s._d && bn(1);
    }
    return l;
  };
  return s._n = true, s._c = true, s._d = true, s;
}
function yc(e, t) {
  if (Se === null)
    return e;
  const n = Rn(Se), s = e.dirs || (e.dirs = []);
  for (let r = 0; r < t.length; r++) {
    let [i, o, l, c = G] = t[r];
    i && (N(i) && (i = { mounted: i, updated: i }), i.deep && Ge(o), s.push({ dir: i, instance: n, value: o, oldValue: void 0, arg: l, modifiers: c }));
  }
  return e;
}
function it(e, t, n, s) {
  const r = e.dirs, i = t && t.dirs;
  for (let o = 0; o < r.length; o++) {
    const l = r[o];
    i && (l.oldValue = i[o].value);
    let c = l.dir[s];
    c && (ze(), we(c, n, 8, [e.el, l, e, t]), Je());
  }
}
function xo(e, t) {
  if (he) {
    let n = he.provides;
    const s = he.parent && he.parent.provides;
    s === n && (n = he.provides = Object.create(s)), n[e] = t;
  }
}
function fn(e, t, n = false) {
  const s = yi();
  if (s || wt) {
    let r = wt ? wt._context.provides : s ? s.parent == null || s.ce ? s.vnode.appContext && s.vnode.appContext.provides : s.parent.provides : void 0;
    if (r && e in r)
      return r[e];
    if (arguments.length > 1)
      return n && N(t) ? t.call(s && s.proxy) : t;
  }
}
const So = Symbol.for("v-scx"), Co = () => fn(So);
function Bn(e, t, n) {
  return kr(e, t, n);
}
function kr(e, t, n = G) {
  const { immediate: s, deep: r, flush: i, once: o } = n, l = ne({}, n), c = t && s || !t && i !== "post";
  let d;
  if (zt) {
    if (i === "sync") {
      const C = Co();
      d = C.__watcherHandles || (C.__watcherHandles = []);
    } else if (!c) {
      const C = () => {
      };
      return C.stop = He, C.resume = He, C.pause = He, C;
    }
  }
  const u = he;
  l.call = (C, R, P) => we(C, u, R, P);
  let h = false;
  i === "post" ? l.scheduler = (C) => {
    ge(C, u && u.suspense);
  } : i !== "sync" && (h = true, l.scheduler = (C, R) => {
    R ? C() : ys(C);
  }), l.augmentJob = (C) => {
    t && (C.flags |= 4), h && (C.flags |= 2, u && (C.id = u.uid, C.i = u));
  };
  const v = bo(e, t, l);
  return zt && (d ? d.push(v) : c && v()), v;
}
function wo(e, t, n) {
  const s = this.proxy, r = Q(e) ? e.includes(".") ? Wr(s, e) : () => s[e] : e.bind(s, s);
  let i;
  N(t) ? i = t : (i = t.handler, n = t);
  const o = Qt(this), l = kr(r, i.bind(s), n);
  return o(), l;
}
function Wr(e, t) {
  const n = t.split(".");
  return () => {
    let s = e;
    for (let r = 0; r < n.length && s; r++)
      s = s[n[r]];
    return s;
  };
}
const To = Symbol("_vte"), Pn = (e) => e.__isTeleport, xe = Symbol("_leaveCb"), Mt = Symbol("_enterCb");
function Eo() {
  const e = { isMounted: false, isLeaving: false, isUnmounting: false, leavingVNodes: /* @__PURE__ */ new Map() };
  return xs(() => {
    e.isMounted = true;
  }), Qr(() => {
    e.isUnmounting = true;
  }), e;
}
const ve = [Function, Array], qr = { mode: String, appear: Boolean, persisted: Boolean, onBeforeEnter: ve, onEnter: ve, onAfterEnter: ve, onEnterCancelled: ve, onBeforeLeave: ve, onLeave: ve, onAfterLeave: ve, onLeaveCancelled: ve, onBeforeAppear: ve, onAppear: ve, onAfterAppear: ve, onAppearCancelled: ve }, Gr = (e) => {
  const t = e.subTree;
  return t.component ? Gr(t.component) : t;
}, Ao = { name: "BaseTransition", props: qr, setup(e, { slots: t }) {
  const n = yi(), s = Eo();
  return () => {
    const r = t.default && Yr(t.default(), true), i = r && r.length ? zr(r) : n.subTree ? Ke() : void 0;
    if (!i)
      return;
    const o = j(e), { mode: l } = o;
    if (s.isLeaving)
      return Un(i);
    const c = pn(i);
    if (!c)
      return Un(i);
    let d = ts(c, o, s, n, (h) => d = h);
    c.type !== de && Wt(c, d);
    let u = n.subTree && pn(n.subTree);
    if (u && u.type !== de && !at(u, c) && Gr(n).type !== de) {
      let h = ts(u, o, s, n);
      if (Wt(u, h), l === "out-in" && c.type !== de)
        return s.isLeaving = true, h.afterLeave = () => {
          s.isLeaving = false, n.job.flags & 8 || n.update(), delete h.afterLeave, u = void 0;
        }, Un(i);
      l === "in-out" && c.type !== de ? h.delayLeave = (v, C, R) => {
        const P = Jr(s, u);
        P[String(u.key)] = u, v[xe] = () => {
          C(), v[xe] = void 0, delete d.delayedLeave, u = void 0;
        }, d.delayedLeave = () => {
          R(), delete d.delayedLeave, u = void 0;
        };
      } : u = void 0;
    } else
      u && (u = void 0);
    return i;
  };
} };
function zr(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const n of e)
      if (n.type !== de) {
        t = n;
        break;
      }
  }
  return t;
}
const Oo = Ao;
function Jr(e, t) {
  const { leavingVNodes: n } = e;
  let s = n.get(t.type);
  return s || (s = /* @__PURE__ */ Object.create(null), n.set(t.type, s)), s;
}
function ts(e, t, n, s, r) {
  const { appear: i, mode: o, persisted: l = false, onBeforeEnter: c, onEnter: d, onAfterEnter: u, onEnterCancelled: h, onBeforeLeave: v, onLeave: C, onAfterLeave: R, onLeaveCancelled: P, onBeforeAppear: W, onAppear: O, onAfterAppear: F, onAppearCancelled: D } = t, E = String(e.key), $ = Jr(n, e), ee = (V, K) => {
    V && we(V, s, 9, K);
  }, fe = (V, K) => {
    const X = K[1];
    ee(V, K), M(V) ? V.every((T) => T.length <= 1) && X() : V.length <= 1 && X();
  }, pe = { mode: o, persisted: l, beforeEnter(V) {
    let K = c;
    if (!n.isMounted)
      if (i)
        K = W || c;
      else
        return;
    V[xe] && V[xe](true);
    const X = $[E];
    X && at(e, X) && X.el[xe] && X.el[xe](), ee(K, [V]);
  }, enter(V) {
    if ($[E] === e)
      return;
    let K = d, X = u, T = h;
    if (!n.isMounted)
      if (i)
        K = O || d, X = F || u, T = D || h;
      else
        return;
    let Y = false;
    V[Mt] = (je) => {
      Y || (Y = true, je ? ee(T, [V]) : ee(X, [V]), pe.delayedLeave && pe.delayedLeave(), V[Mt] = void 0);
    };
    const oe = V[Mt].bind(null, false);
    K ? fe(K, [V, oe]) : oe();
  }, leave(V, K) {
    const X = String(e.key);
    if (V[Mt] && V[Mt](true), n.isUnmounting)
      return K();
    ee(v, [V]);
    let T = false;
    V[xe] = (oe) => {
      T || (T = true, K(), oe ? ee(P, [V]) : ee(R, [V]), V[xe] = void 0, $[X] === e && delete $[X]);
    };
    const Y = V[xe].bind(null, false);
    $[X] = e, C ? fe(C, [V, Y]) : Y();
  }, clone(V) {
    const K = ts(V, t, n, s, r);
    return r && r(K), K;
  } };
  return pe;
}
function Un(e) {
  if (Mn(e))
    return e = nt(e), e.children = null, e;
}
function pn(e) {
  if (!Mn(e))
    return Pn(e.type) && e.children ? zr(e.children) : e;
  if (e.component)
    return e.component.subTree;
  const { shapeFlag: t, children: n } = e;
  if (n) {
    if (t & 16)
      return n[0];
    if (t & 32 && N(n.default))
      return n.default();
  }
}
function Wt(e, t) {
  if (e.shapeFlag & 6 && e.component) {
    e.transition = t;
    const n = e.component.subTree;
    Wt(Pn(n.type) && pn(n) || n, t);
  } else
    e.shapeFlag & 128 ? (e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback)) : e.transition = t;
}
function Yr(e, t = false, n) {
  let s = [], r = 0;
  for (let i = 0; i < e.length; i++) {
    let o = e[i];
    const l = n == null ? o.key : String(n) + String(o.key != null ? o.key : i);
    o.type === Te ? (o.patchFlag & 128 && r++, s = s.concat(Yr(o.children, t, l))) : (t || o.type !== de) && s.push(l != null ? nt(o, { key: l }) : o);
  }
  if (r > 1)
    for (let i = 0; i < s.length; i++)
      s[i].patchFlag = -2;
  return s;
}
function Po(e, t) {
  return N(e) ? (() => ne({ name: e.name }, t, { setup: e }))() : e;
}
function Xr(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function Ds(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const gn = /* @__PURE__ */ new WeakMap();
function Ht(e, t, n, s, r = false) {
  if (M(e)) {
    e.forEach((P, W) => Ht(P, t && (M(t) ? t[W] : t), n, s, r));
    return;
  }
  if ($t(s) && !r) {
    s.shapeFlag & 512 && s.type.__asyncResolved && s.component.subTree.component && Ht(e, t, n, s.component.subTree);
    return;
  }
  const i = s.shapeFlag & 4 ? Rn(s.component) : s.el, o = r ? null : i, { i: l, r: c } = e, d = t && t.r, u = l.refs === G ? l.refs = {} : l.refs, h = l.setupState, v = j(h), C = h === G ? hr : (P) => Ds(u, P) ? false : B(v, P), R = (P, W) => !(W && Ds(u, W));
  if (d != null && d !== c) {
    if (Ns(t), Q(d))
      u[d] = null, C(d) && (h[d] = null);
    else if (ce(d)) {
      const P = t;
      R(d, P.k) && (d.value = null), P.k && (u[P.k] = null);
    }
  }
  if (N(c))
    Zt(c, l, 12, [o, u]);
  else {
    const P = Q(c), W = ce(c);
    if (P || W) {
      const O = () => {
        if (e.f) {
          const F = P ? C(c) ? h[c] : u[c] : R() || !e.k ? c.value : u[e.k];
          if (r)
            M(F) && cs(F, i);
          else if (M(F))
            F.includes(i) || F.push(i);
          else if (P)
            u[c] = [i], C(c) && (h[c] = u[c]);
          else {
            const D = [i];
            R(c, e.k) && (c.value = D), e.k && (u[e.k] = D);
          }
        } else
          P ? (u[c] = o, C(c) && (h[c] = o)) : W && (R(c, e.k) && (c.value = o), e.k && (u[e.k] = o));
      };
      if (o) {
        const F = () => {
          O(), gn.delete(e);
        };
        F.id = -1, gn.set(e, F), ge(F, n);
      } else
        Ns(e), O();
    }
  }
}
function Ns(e) {
  const t = gn.get(e);
  t && (t.flags |= 8, gn.delete(e));
}
En().requestIdleCallback;
En().cancelIdleCallback;
const $t = (e) => !!e.type.__asyncLoader, Mn = (e) => e.type.__isKeepAlive;
function Mo(e, t) {
  Zr(e, "a", t);
}
function Io(e, t) {
  Zr(e, "da", t);
}
function Zr(e, t, n = he) {
  const s = e.__wdc || (e.__wdc = () => {
    let r = n;
    for (; r; ) {
      if (r.isDeactivated)
        return;
      r = r.parent;
    }
    return e();
  });
  if (In(t, s, n), n) {
    let r = n.parent;
    for (; r && r.parent; )
      Mn(r.parent.vnode) && Lo(s, t, n, r), r = r.parent;
  }
}
function Lo(e, t, n, s) {
  const r = In(t, e, s, true);
  Ss(() => {
    cs(s[t], r);
  }, n);
}
function In(e, t, n = he, s = false) {
  if (n) {
    const r = n[e] || (n[e] = []), i = t.__weh || (t.__weh = (...o) => {
      ze();
      const l = Qt(n), c = we(t, n, e, o);
      return l(), Je(), c;
    });
    return s ? r.unshift(i) : r.push(i), i;
  }
}
const Xe = (e) => (t, n = he) => {
  (!zt || e === "sp") && In(e, (...s) => t(...s), n);
}, Fo = Xe("bm"), xs = Xe("m"), Ro = Xe("bu"), Do = Xe("u"), Qr = Xe("bum"), Ss = Xe("um"), No = Xe("sp"), Vo = Xe("rtg"), Ho = Xe("rtc");
function $o(e, t = he) {
  In("ec", e, t);
}
const jo = Symbol.for("v-ndc");
function Bo(e, t, n, s) {
  let r;
  const i = n, o = M(e);
  if (o || Q(e)) {
    const l = o && gt(e);
    let c = false, d = false;
    l && (c = !Ce(e), d = Ye(e), e = An(e)), r = new Array(e.length);
    for (let u = 0, h = e.length; u < h; u++)
      r[u] = t(c ? d ? Tt(Oe(e[u])) : Oe(e[u]) : e[u], u, void 0, i);
  } else if (typeof e == "number") {
    r = new Array(e);
    for (let l = 0; l < e; l++)
      r[l] = t(l + 1, l, void 0, i);
  } else if (U(e))
    if (e[Symbol.iterator])
      r = Array.from(e, (l, c) => t(l, c, void 0, i));
    else {
      const l = Object.keys(e);
      r = new Array(l.length);
      for (let c = 0, d = l.length; c < d; c++) {
        const u = l[c];
        r[c] = t(e[u], u, c, i);
      }
    }
  else
    r = [];
  return r;
}
const ns = (e) => e ? xi(e) ? Rn(e) : ns(e.parent) : null, jt = ne(/* @__PURE__ */ Object.create(null), { $: (e) => e, $el: (e) => e.vnode.el, $data: (e) => e.data, $props: (e) => e.props, $attrs: (e) => e.attrs, $slots: (e) => e.slots, $refs: (e) => e.refs, $parent: (e) => ns(e.parent), $root: (e) => ns(e.root), $host: (e) => e.ce, $emit: (e) => e.emit, $options: (e) => ti(e), $forceUpdate: (e) => e.f || (e.f = () => {
  ys(e.update);
}), $nextTick: (e) => e.n || (e.n = cn.bind(e.proxy)), $watch: (e) => wo.bind(e) }), Kn = (e, t) => e !== G && !e.__isScriptSetup && B(e, t), Uo = { get({ _: e }, t) {
  if (t === "__v_skip")
    return true;
  const { ctx: n, setupState: s, data: r, props: i, accessCache: o, type: l, appContext: c } = e;
  if (t[0] !== "$") {
    const v = o[t];
    if (v !== void 0)
      switch (v) {
        case 1:
          return s[t];
        case 2:
          return r[t];
        case 4:
          return n[t];
        case 3:
          return i[t];
      }
    else {
      if (Kn(s, t))
        return o[t] = 1, s[t];
      if (r !== G && B(r, t))
        return o[t] = 2, r[t];
      if (B(i, t))
        return o[t] = 3, i[t];
      if (n !== G && B(n, t))
        return o[t] = 4, n[t];
      ss && (o[t] = 0);
    }
  }
  const d = jt[t];
  let u, h;
  if (d)
    return t === "$attrs" && le(e.attrs, "get", ""), d(e);
  if ((u = l.__cssModules) && (u = u[t]))
    return u;
  if (n !== G && B(n, t))
    return o[t] = 4, n[t];
  if (h = c.config.globalProperties, B(h, t))
    return h[t];
}, set({ _: e }, t, n) {
  const { data: s, setupState: r, ctx: i } = e;
  return Kn(r, t) ? (r[t] = n, true) : s !== G && B(s, t) ? (s[t] = n, true) : B(e.props, t) || t[0] === "$" && t.slice(1) in e ? false : (i[t] = n, true);
}, has({ _: { data: e, setupState: t, accessCache: n, ctx: s, appContext: r, props: i, type: o } }, l) {
  let c;
  return !!(n[l] || e !== G && l[0] !== "$" && B(e, l) || Kn(t, l) || B(i, l) || B(s, l) || B(jt, l) || B(r.config.globalProperties, l) || (c = o.__cssModules) && c[l]);
}, defineProperty(e, t, n) {
  return n.get != null ? e._.accessCache[t] = 0 : B(n, "value") && this.set(e, t, n.value, null), Reflect.defineProperty(e, t, n);
} };
function Vs(e) {
  return M(e) ? e.reduce((t, n) => (t[n] = null, t), {}) : e;
}
let ss = true;
function Ko(e) {
  const t = ti(e), n = e.proxy, s = e.ctx;
  ss = false, t.beforeCreate && Hs(t.beforeCreate, e, "bc");
  const { data: r, computed: i, methods: o, watch: l, provide: c, inject: d, created: u, beforeMount: h, mounted: v, beforeUpdate: C, updated: R, activated: P, deactivated: W, beforeDestroy: O, beforeUnmount: F, destroyed: D, unmounted: E, render: $, renderTracked: ee, renderTriggered: fe, errorCaptured: pe, serverPrefetch: V, expose: K, inheritAttrs: X, components: T, directives: Y, filters: oe } = t;
  if (d && ko(d, s, null), o)
    for (const Z in o) {
      const z = o[Z];
      N(z) && (s[Z] = z.bind(n));
    }
  if (r) {
    const Z = r.call(n, n);
    U(Z) && (e.data = bs(Z));
  }
  if (ss = true, i)
    for (const Z in i) {
      const z = i[Z], st = N(z) ? z.bind(n, n) : N(z.get) ? z.get.bind(n, n) : He, en = !N(z) && N(z.set) ? z.set.bind(n) : He, rt = Ci({ get: st, set: en });
      Object.defineProperty(s, Z, { enumerable: true, configurable: true, get: () => rt.value, set: (Pe) => rt.value = Pe });
    }
  if (l)
    for (const Z in l)
      ei(l[Z], s, n, Z);
  if (c) {
    const Z = N(c) ? c.call(n) : c;
    Reflect.ownKeys(Z).forEach((z) => {
      xo(z, Z[z]);
    });
  }
  u && Hs(u, e, "c");
  function se(Z, z) {
    M(z) ? z.forEach((st) => Z(st.bind(n))) : z && Z(z.bind(n));
  }
  if (se(Fo, h), se(xs, v), se(Ro, C), se(Do, R), se(Mo, P), se(Io, W), se($o, pe), se(Ho, ee), se(Vo, fe), se(Qr, F), se(Ss, E), se(No, V), M(K))
    if (K.length) {
      const Z = e.exposed || (e.exposed = {});
      K.forEach((z) => {
        Object.defineProperty(Z, z, { get: () => n[z], set: (st) => n[z] = st, enumerable: true });
      });
    } else
      e.exposed || (e.exposed = {});
  $ && e.render === He && (e.render = $), X != null && (e.inheritAttrs = X), T && (e.components = T), Y && (e.directives = Y), V && Xr(e);
}
function ko(e, t, n = He) {
  M(e) && (e = rs(e));
  for (const s in e) {
    const r = e[s];
    let i;
    U(r) ? "default" in r ? i = fn(r.from || s, r.default, true) : i = fn(r.from || s) : i = fn(r), ce(i) ? Object.defineProperty(t, s, { enumerable: true, configurable: true, get: () => i.value, set: (o) => i.value = o }) : t[s] = i;
  }
}
function Hs(e, t, n) {
  we(M(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function ei(e, t, n, s) {
  let r = s.includes(".") ? Wr(n, s) : () => n[s];
  if (Q(e)) {
    const i = t[e];
    N(i) && Bn(r, i);
  } else if (N(e))
    Bn(r, e.bind(n));
  else if (U(e))
    if (M(e))
      e.forEach((i) => ei(i, t, n, s));
    else {
      const i = N(e.handler) ? e.handler.bind(n) : t[e.handler];
      N(i) && Bn(r, i, e);
    }
}
function ti(e) {
  const t = e.type, { mixins: n, extends: s } = t, { mixins: r, optionsCache: i, config: { optionMergeStrategies: o } } = e.appContext, l = i.get(t);
  let c;
  return l ? c = l : !r.length && !n && !s ? c = t : (c = {}, r.length && r.forEach((d) => mn(c, d, o, true)), mn(c, t, o)), U(t) && i.set(t, c), c;
}
function mn(e, t, n, s = false) {
  const { mixins: r, extends: i } = t;
  i && mn(e, i, n, true), r && r.forEach((o) => mn(e, o, n, true));
  for (const o in t)
    if (!(s && o === "expose")) {
      const l = Wo[o] || n && n[o];
      e[o] = l ? l(e[o], t[o]) : t[o];
    }
  return e;
}
const Wo = { data: $s, props: js, emits: js, methods: Ft, computed: Ft, beforeCreate: ue, created: ue, beforeMount: ue, mounted: ue, beforeUpdate: ue, updated: ue, beforeDestroy: ue, beforeUnmount: ue, destroyed: ue, unmounted: ue, activated: ue, deactivated: ue, errorCaptured: ue, serverPrefetch: ue, components: Ft, directives: Ft, watch: Go, provide: $s, inject: qo };
function $s(e, t) {
  return t ? e ? function() {
    return ne(N(e) ? e.call(this, this) : e, N(t) ? t.call(this, this) : t);
  } : t : e;
}
function qo(e, t) {
  return Ft(rs(e), rs(t));
}
function rs(e) {
  if (M(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++)
      t[e[n]] = e[n];
    return t;
  }
  return e;
}
function ue(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Ft(e, t) {
  return e ? ne(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function js(e, t) {
  return e ? M(e) && M(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : ne(/* @__PURE__ */ Object.create(null), Vs(e), Vs(t ?? {})) : t;
}
function Go(e, t) {
  if (!e)
    return t;
  if (!t)
    return e;
  const n = ne(/* @__PURE__ */ Object.create(null), e);
  for (const s in t)
    n[s] = ue(e[s], t[s]);
  return n;
}
function ni() {
  return { app: null, config: { isNativeTag: hr, performance: false, globalProperties: {}, optionMergeStrategies: {}, errorHandler: void 0, warnHandler: void 0, compilerOptions: {} }, mixins: [], components: {}, directives: {}, provides: /* @__PURE__ */ Object.create(null), optionsCache: /* @__PURE__ */ new WeakMap(), propsCache: /* @__PURE__ */ new WeakMap(), emitsCache: /* @__PURE__ */ new WeakMap() };
}
let zo = 0;
function Jo(e, t) {
  return function(s, r = null) {
    N(s) || (s = ne({}, s)), r != null && !U(r) && (r = null);
    const i = ni(), o = /* @__PURE__ */ new WeakSet(), l = [];
    let c = false;
    const d = i.app = { _uid: zo++, _component: s, _props: r, _container: null, _context: i, _instance: null, version: Ol, get config() {
      return i.config;
    }, set config(u) {
    }, use(u, ...h) {
      return o.has(u) || (u && N(u.install) ? (o.add(u), u.install(d, ...h)) : N(u) && (o.add(u), u(d, ...h))), d;
    }, mixin(u) {
      return i.mixins.includes(u) || i.mixins.push(u), d;
    }, component(u, h) {
      return h ? (i.components[u] = h, d) : i.components[u];
    }, directive(u, h) {
      return h ? (i.directives[u] = h, d) : i.directives[u];
    }, mount(u, h, v) {
      if (!c) {
        const C = d._ceVNode || me(s, r);
        return C.appContext = i, v === true ? v = "svg" : v === false && (v = void 0), e(C, u, v), c = true, d._container = u, u.__vue_app__ = d, Rn(C.component);
      }
    }, onUnmount(u) {
      l.push(u);
    }, unmount() {
      c && (we(l, d._instance, 16), e(null, d._container), delete d._container.__vue_app__);
    }, provide(u, h) {
      return i.provides[u] = h, d;
    }, runWithContext(u) {
      const h = wt;
      wt = d;
      try {
        return u();
      } finally {
        wt = h;
      }
    } };
    return d;
  };
}
let wt = null;
const Yo = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Ee(t)}Modifiers`] || e[`${bt(t)}Modifiers`];
function Xo(e, t, ...n) {
  if (e.isUnmounted)
    return;
  const s = e.vnode.props || G;
  let r = n;
  const i = t.startsWith("update:"), o = i && Yo(s, t.slice(7));
  o && (o.trim && (r = n.map((u) => Q(u) ? u.trim() : u)), o.number && (r = n.map(us)));
  let l, c = s[l = Nn(t)] || s[l = Nn(Ee(t))];
  !c && i && (c = s[l = Nn(bt(t))]), c && we(c, e, 6, r);
  const d = s[l + "Once"];
  if (d) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[l])
      return;
    e.emitted[l] = true, we(d, e, 6, r);
  }
}
const Zo = /* @__PURE__ */ new WeakMap();
function si(e, t, n = false) {
  const s = n ? Zo : t.emitsCache, r = s.get(e);
  if (r !== void 0)
    return r;
  const i = e.emits;
  let o = {}, l = false;
  if (!N(e)) {
    const c = (d) => {
      const u = si(d, t, true);
      u && (l = true, ne(o, u));
    };
    !n && t.mixins.length && t.mixins.forEach(c), e.extends && c(e.extends), e.mixins && e.mixins.forEach(c);
  }
  return !i && !l ? (U(e) && s.set(e, null), null) : (M(i) ? i.forEach((c) => o[c] = null) : ne(o, i), U(e) && s.set(e, o), o);
}
function Ln(e, t) {
  return !e || !Sn(t) ? false : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), B(e, t[0].toLowerCase() + t.slice(1)) || B(e, bt(t)) || B(e, t));
}
function Bs(e) {
  const { type: t, vnode: n, proxy: s, withProxy: r, propsOptions: [i], slots: o, attrs: l, emit: c, render: d, renderCache: u, props: h, data: v, setupState: C, ctx: R, inheritAttrs: P } = e, W = hn(e);
  let O, F;
  try {
    if (n.shapeFlag & 4) {
      const E = r || s, $ = E;
      O = Ne(d.call($, E, u, h, C, v, R)), F = l;
    } else {
      const E = t;
      O = Ne(E.length > 1 ? E(h, { attrs: l, slots: o, emit: c }) : E(h, null)), F = t.props ? l : Qo(l);
    }
  } catch (E) {
    mt.length = 0, On(E, e, 1), O = me(de);
  }
  let D = O;
  if (F && P !== false) {
    const E = Object.keys(F), { shapeFlag: $ } = D;
    E.length && $ & 7 && (i && E.some(Cn) && (F = el(F, i)), D = nt(D, F, false, true));
  }
  if (n.dirs && (D = nt(D, null, false, true), D.dirs = D.dirs ? D.dirs.concat(n.dirs) : n.dirs), n.transition) {
    const E = Pn(D.type) && pn(D) || D;
    Wt(E, n.transition);
  }
  return O = D, hn(W), O;
}
const Qo = (e) => {
  let t;
  for (const n in e)
    (n === "class" || n === "style" || Sn(n)) && ((t || (t = {}))[n] = e[n]);
  return t;
}, el = (e, t) => {
  const n = {};
  for (const s in e)
    (!Cn(s) || !(s.slice(9) in t)) && (n[s] = e[s]);
  return n;
};
function tl(e, t, n) {
  const { props: s, children: r, component: i } = e, { props: o, children: l, patchFlag: c } = t, d = i.emitsOptions;
  if (t.dirs || t.transition)
    return true;
  if (n && c >= 0) {
    if (c & 1024)
      return true;
    if (c & 16)
      return s ? Us(s, o, d) : !!o;
    if (c & 8) {
      const u = t.dynamicProps;
      for (let h = 0; h < u.length; h++) {
        const v = u[h];
        if (ri(o, s, v) && !Ln(d, v))
          return true;
      }
    }
  } else
    return (r || l) && (!l || !l.$stable) ? true : s === o ? false : s ? o ? Us(s, o, d) : true : !!o;
  return false;
}
function Us(e, t, n) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length)
    return true;
  for (let r = 0; r < s.length; r++) {
    const i = s[r];
    if (ri(t, e, i) && !Ln(n, i))
      return true;
  }
  return false;
}
function ri(e, t, n) {
  const s = e[n], r = t[n];
  return n === "style" && U(s) && U(r) ? !Xt(s, r) : s !== r;
}
function nl({ vnode: e, parent: t, suspense: n }, s) {
  for (; t; ) {
    const r = t.subTree;
    if (r.suspense && r.suspense.activeBranch === e && (r.suspense.vnode.el = r.el = s, e = r), r === e)
      (e = t.vnode).el = s, t = t.parent;
    else
      break;
  }
  n && n.activeBranch === e && (n.vnode.el = s);
}
const ii = {}, oi = () => Object.create(ii), li = (e) => Object.getPrototypeOf(e) === ii;
function sl(e, t, n, s = false) {
  const r = {}, i = oi();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), ci(e, t, r, i);
  for (const o in e.propsOptions[0])
    o in r || (r[o] = void 0);
  n ? e.props = s ? r : lo(r) : e.type.props ? e.props = r : e.props = i, e.attrs = i;
}
function rl(e, t, n, s) {
  const { props: r, attrs: i, vnode: { patchFlag: o } } = e, l = j(r), [c] = e.propsOptions;
  let d = false;
  if ((s || o > 0) && !(o & 16)) {
    if (o & 8) {
      const u = e.vnode.dynamicProps;
      for (let h = 0; h < u.length; h++) {
        let v = u[h];
        if (Ln(e.emitsOptions, v))
          continue;
        const C = t[v];
        if (c)
          if (B(i, v))
            C !== i[v] && (i[v] = C, d = true);
          else {
            const R = Ee(v);
            r[R] = is(c, l, R, C, e, false);
          }
        else
          C !== i[v] && (i[v] = C, d = true);
      }
    }
  } else {
    ci(e, t, r, i) && (d = true);
    let u;
    for (const h in l)
      (!t || !B(t, h) && ((u = bt(h)) === h || !B(t, u))) && (c ? n && (n[h] !== void 0 || n[u] !== void 0) && (r[h] = is(c, l, h, void 0, e, true)) : delete r[h]);
    if (i !== l)
      for (const h in i)
        (!t || !B(t, h)) && (delete i[h], d = true);
  }
  d && qe(e.attrs, "set", "");
}
function ci(e, t, n, s) {
  const [r, i] = e.propsOptions;
  let o = false, l;
  if (t)
    for (let c in t) {
      if (Dt(c))
        continue;
      const d = t[c];
      let u;
      r && B(r, u = Ee(c)) ? !i || !i.includes(u) ? n[u] = d : (l || (l = {}))[u] = d : Ln(e.emitsOptions, c) || (!(c in s) || d !== s[c]) && (s[c] = d, o = true);
    }
  if (i) {
    const c = j(n), d = l || G;
    for (let u = 0; u < i.length; u++) {
      const h = i[u];
      n[h] = is(r, c, h, d[h], e, !B(d, h));
    }
  }
  return o;
}
function is(e, t, n, s, r, i) {
  const o = e[n];
  if (o != null) {
    const l = B(o, "default");
    if (l && s === void 0) {
      const c = o.default;
      if (o.type !== Function && !o.skipFactory && N(c)) {
        const { propsDefaults: d } = r;
        if (n in d)
          s = d[n];
        else {
          const u = Qt(r);
          s = d[n] = c.call(null, t), u();
        }
      } else
        s = c;
      r.ce && r.ce._setProp(n, s);
    }
    o[0] && (i && !l ? s = false : o[1] && (s === "" || s === bt(n)) && (s = true));
  }
  return s;
}
const il = /* @__PURE__ */ new WeakMap();
function fi(e, t, n = false) {
  const s = n ? il : t.propsCache, r = s.get(e);
  if (r)
    return r;
  const i = e.props, o = {}, l = [];
  let c = false;
  if (!N(e)) {
    const u = (h) => {
      c = true;
      const [v, C] = fi(h, t, true);
      ne(o, v), C && l.push(...C);
    };
    !n && t.mixins.length && t.mixins.forEach(u), e.extends && u(e.extends), e.mixins && e.mixins.forEach(u);
  }
  if (!i && !c)
    return U(e) && s.set(e, xt), xt;
  if (M(i))
    for (let u = 0; u < i.length; u++) {
      const h = Ee(i[u]);
      Ks(h) && (o[h] = G);
    }
  else if (i)
    for (const u in i) {
      const h = Ee(u);
      if (Ks(h)) {
        const v = i[u], C = o[h] = M(v) || N(v) ? { type: v } : ne({}, v), R = C.type;
        let P = false, W = true;
        if (M(R))
          for (let O = 0; O < R.length; ++O) {
            const F = R[O], D = N(F) && F.name;
            if (D === "Boolean") {
              P = true;
              break;
            } else
              D === "String" && (W = false);
          }
        else
          P = N(R) && R.name === "Boolean";
        C[0] = P, C[1] = W, (P || B(C, "default")) && l.push(h);
      }
    }
  const d = [o, l];
  return U(e) && s.set(e, d), d;
}
function Ks(e) {
  return e[0] !== "$" && !Dt(e);
}
const Cs = (e) => e === "_" || e === "_ctx" || e === "$stable", ws = (e) => M(e) ? e.map(Ne) : [Ne(e)], ol = (e, t, n) => {
  if (t._n)
    return t;
  const s = Kr((...r) => ws(t(...r)), n);
  return s._c = false, s;
}, ui = (e, t, n) => {
  const s = e._ctx;
  for (const r in e) {
    if (Cs(r))
      continue;
    const i = e[r];
    if (N(i))
      t[r] = ol(r, i, s);
    else if (i != null) {
      const o = ws(i);
      t[r] = () => o;
    }
  }
}, ai = (e, t) => {
  const n = ws(t);
  e.slots.default = () => n;
}, di = (e, t, n) => {
  for (const s in t)
    (n || !Cs(s)) && (e[s] = t[s]);
}, ll = (e, t, n) => {
  const s = e.slots = oi();
  if (e.vnode.shapeFlag & 32) {
    const r = t._;
    r ? (di(s, t, n), n && _r(s, "_", r, true)) : ui(t, s);
  } else
    t && ai(e, t);
}, cl = (e, t, n) => {
  const { vnode: s, slots: r } = e;
  let i = true, o = G;
  if (s.shapeFlag & 32) {
    const l = t._;
    l ? n && l === 1 ? i = false : di(r, t, n) : (i = !t.$stable, ui(t, r)), o = t;
  } else
    t && (ai(e, t), o = { default: 1 });
  if (i)
    for (const l in r)
      !Cs(l) && o[l] == null && delete r[l];
}, ge = hl;
function fl(e) {
  return ul(e);
}
function ul(e, t) {
  const n = En();
  n.__VUE__ = true;
  const { insert: s, remove: r, patchProp: i, createElement: o, createText: l, createComment: c, setText: d, setElementText: u, parentNode: h, nextSibling: v, setScopeId: C = He, insertStaticContent: R } = e, P = (f, a, p, _ = null, b = null, g = null, S = void 0, x = null, y = !!a.dynamicChildren) => {
    if (f === a)
      return;
    f && !at(f, a) && (_ = tn(f), Pe(f, b, g, true), f = null), a.patchFlag === -2 && (y = false, a.dynamicChildren = null);
    const { type: m, ref: I, shapeFlag: w } = a;
    switch (m) {
      case Fn:
        W(f, a, p, _);
        break;
      case de:
        O(f, a, p, _);
        break;
      case Wn:
        f == null && F(a, p, _, S);
        break;
      case Te:
        T(f, a, p, _, b, g, S, x, y);
        break;
      default:
        w & 1 ? $(f, a, p, _, b, g, S, x, y) : w & 6 ? Y(f, a, p, _, b, g, S, x, y) : (w & 64 || w & 128) && m.process(f, a, p, _, b, g, S, x, y, At);
    }
    I != null && b ? Ht(I, f && f.ref, g, a || f, !a) : I == null && f && f.ref != null && Ht(f.ref, null, g, f, true);
  }, W = (f, a, p, _) => {
    if (f == null)
      s(a.el = l(a.children), p, _);
    else {
      const b = a.el = f.el;
      a.children !== f.children && d(b, a.children);
    }
  }, O = (f, a, p, _) => {
    f == null ? s(a.el = c(a.children || ""), p, _) : a.el = f.el;
  }, F = (f, a, p, _) => {
    [f.el, f.anchor] = R(f.children, a, p, _, f.el, f.anchor);
  }, D = ({ el: f, anchor: a }, p, _) => {
    let b;
    for (; f && f !== a; )
      b = v(f), s(f, p, _), f = b;
    s(a, p, _);
  }, E = ({ el: f, anchor: a }) => {
    let p;
    for (; f && f !== a; )
      p = v(f), r(f), f = p;
    r(a);
  }, $ = (f, a, p, _, b, g, S, x, y) => {
    if (a.type === "svg" ? S = "svg" : a.type === "math" && (S = "mathml"), f == null)
      ee(a, p, _, b, g, S, x, y);
    else {
      const m = f.el && f.el._isVueCE ? f.el : null;
      try {
        m && m._beginPatch(), V(f, a, b, g, S, x, y);
      } finally {
        m && m._endPatch();
      }
    }
  }, ee = (f, a, p, _, b, g, S, x) => {
    let y, m;
    const { props: I, shapeFlag: w, transition: A, dirs: L } = f;
    if (y = f.el = o(f.type, g, I && I.is, I), w & 8 ? u(y, f.children) : w & 16 && pe(f.children, y, null, _, b, kn(f, g), S, x), L && it(f, null, _, "created"), fe(y, f, f.scopeId, S, _), I) {
      for (const q in I)
        q !== "value" && !Dt(q) && i(y, q, null, I[q], g, _);
      "value" in I && i(y, "value", null, I.value, g), (m = I.onVnodeBeforeMount) && Fe(m, _, f);
    }
    L && it(f, null, _, "beforeMount");
    const H = al(b, A);
    H && A.beforeEnter(y), s(y, a, p), ((m = I && I.onVnodeMounted) || H || L) && ge(() => {
      try {
        m && Fe(m, _, f), H && A.enter(y), L && it(f, null, _, "mounted");
      } finally {
      }
    }, b);
  }, fe = (f, a, p, _, b) => {
    if (p && C(f, p), _)
      for (let g = 0; g < _.length; g++)
        C(f, _[g]);
    if (b) {
      let g = b.subTree;
      if (a === g || mi(g.type) && (g.ssContent === a || g.ssFallback === a)) {
        const S = b.vnode;
        fe(f, S, S.scopeId, S.slotScopeIds, b.parent);
      }
    }
  }, pe = (f, a, p, _, b, g, S, x, y = 0) => {
    for (let m = y; m < f.length; m++) {
      const I = f[m] = x ? We(f[m]) : Ne(f[m]);
      P(null, I, a, p, _, b, g, S, x);
    }
  }, V = (f, a, p, _, b, g, S) => {
    const x = a.el = f.el;
    let { patchFlag: y, dynamicChildren: m, dirs: I } = a;
    y |= f.patchFlag & 16;
    const w = f.props || G, A = a.props || G;
    let L;
    if (p && ot(p, false), (L = A.onVnodeBeforeUpdate) && Fe(L, p, a, f), I && it(a, f, p, "beforeUpdate"), p && ot(p, true), m && (!f.dynamicChildren || f.dynamicChildren.length !== m.length) && (y = 0, S = false, m = null), (w.innerHTML && A.innerHTML == null || w.textContent && A.textContent == null) && u(x, ""), m ? K(f.dynamicChildren, m, x, p, _, kn(a, b), g) : S || z(f, a, x, null, p, _, kn(a, b), g, false), y > 0) {
      if (y & 16)
        X(x, w, A, p, b);
      else if (y & 2 && w.class !== A.class && i(x, "class", null, A.class, b), y & 4 && i(x, "style", w.style, A.style, b), y & 8) {
        const H = a.dynamicProps;
        for (let q = 0; q < H.length; q++) {
          const k = H[q], te = w[k], re = A[k];
          (re !== te || k === "value") && i(x, k, te, re, b, p);
        }
      }
      y & 1 && f.children !== a.children && u(x, a.children);
    } else
      !S && m == null && X(x, w, A, p, b);
    ((L = A.onVnodeUpdated) || I) && ge(() => {
      L && Fe(L, p, a, f), I && it(a, f, p, "updated");
    }, _);
  }, K = (f, a, p, _, b, g, S) => {
    for (let x = 0; x < a.length; x++) {
      const y = f[x], m = a[x], I = y.el && (y.type === Te || !at(y, m) || y.shapeFlag & 198) ? h(y.el) : p;
      P(y, m, I, null, _, b, g, S, true);
    }
  }, X = (f, a, p, _, b) => {
    if (a !== p) {
      if (a !== G)
        for (const g in a)
          !Dt(g) && !(g in p) && i(f, g, a[g], null, b, _);
      for (const g in p) {
        if (Dt(g))
          continue;
        const S = p[g], x = a[g];
        S !== x && g !== "value" && i(f, g, x, S, b, _);
      }
      "value" in p && i(f, "value", a.value, p.value, b);
    }
  }, T = (f, a, p, _, b, g, S, x, y) => {
    const m = a.el = f ? f.el : l(""), I = a.anchor = f ? f.anchor : l("");
    let { patchFlag: w, dynamicChildren: A, slotScopeIds: L } = a;
    L && (x = x ? x.concat(L) : L), f == null ? (s(m, p, _), s(I, p, _), pe(a.children || [], p, I, b, g, S, x, y)) : w > 0 && w & 64 && A && f.dynamicChildren && f.dynamicChildren.length === A.length ? (K(f.dynamicChildren, A, p, b, g, S, x), (a.key != null || b && a === b.subTree) && hi(f, a, true)) : z(f, a, p, I, b, g, S, x, y);
  }, Y = (f, a, p, _, b, g, S, x, y) => {
    a.slotScopeIds = x, f == null ? a.shapeFlag & 512 ? b.ctx.activate(a, p, _, S, y) : oe(a, p, _, b, g, S, y) : je(f, a, y);
  }, oe = (f, a, p, _, b, g, S) => {
    const x = f.component = xl(f, _, b);
    if (Mn(f) && (x.ctx.renderer = At), Sl(x, false, S), x.asyncDep) {
      if (b && b.registerDep(x, se, S), !f.el) {
        const y = x.subTree = me(de);
        O(null, y, a, p), f.placeholder = y.el;
      }
    } else
      se(x, f, a, p, b, g, S);
  }, je = (f, a, p) => {
    const _ = a.component = f.component;
    if (tl(f, a, p))
      if (_.asyncDep && !_.asyncResolved) {
        Z(_, a, p);
        return;
      } else
        _.next = a, _.update();
    else
      a.el = f.el, _.vnode = a;
  }, se = (f, a, p, _, b, g, S) => {
    const x = () => {
      if (f.isMounted) {
        let { next: w, bu: A, u: L, parent: H, vnode: q } = f;
        {
          const Ie = pi(f);
          if (Ie) {
            w && (w.el = q.el, Z(f, w, S)), Ie.asyncDep.then(() => {
              ge(() => {
                f.isUnmounted || m();
              }, b);
            });
            return;
          }
        }
        let k = w, te;
        ot(f, false), w ? (w.el = q.el, Z(f, w, S)) : w = q, A && ln(A), (te = w.props && w.props.onVnodeBeforeUpdate) && Fe(te, H, w, q), ot(f, true);
        const re = Bs(f), Me = f.subTree;
        f.subTree = re, P(Me, re, h(Me.el), tn(Me), f, b, g), w.el = re.el, k === null && nl(f, re.el), L && ge(L, b), (te = w.props && w.props.onVnodeUpdated) && ge(() => Fe(te, H, w, q), b);
      } else {
        let w;
        const { el: A, props: L } = a, { bm: H, m: q, parent: k, root: te, type: re } = f, Me = $t(a);
        ot(f, false), H && ln(H), !Me && (w = L && L.onVnodeBeforeMount) && Fe(w, k, a), ot(f, true);
        {
          te.ce && te.ce._hasShadowRoot() && te.ce._injectChildStyle(re, f.parent ? f.parent.type : void 0);
          const Ie = f.subTree = Bs(f);
          P(null, Ie, p, _, f, b, g), a.el = Ie.el;
        }
        if (q && ge(q, b), !Me && (w = L && L.onVnodeMounted)) {
          const Ie = a;
          ge(() => Fe(w, k, Ie), b);
        }
        (a.shapeFlag & 256 || k && $t(k.vnode) && k.vnode.shapeFlag & 256) && f.a && ge(f.a, b), f.isMounted = true, a = p = _ = null;
      }
    };
    f.scope.on();
    const y = f.effect = new Cr(x);
    f.scope.off();
    const m = f.update = y.run.bind(y), I = f.job = y.runIfDirty.bind(y);
    I.i = f, I.id = f.uid, y.scheduler = () => ys(I), ot(f, true), m();
  }, Z = (f, a, p) => {
    a.component = f;
    const _ = f.vnode.props;
    f.vnode = a, f.next = null, rl(f, a.props, _, p), cl(f, a.children, p), ze(), Rs(f), Je();
  }, z = (f, a, p, _, b, g, S, x, y = false) => {
    const m = f && f.children, I = f ? f.shapeFlag : 0, w = a.children, { patchFlag: A, shapeFlag: L } = a;
    if (A > 0) {
      if (A & 128) {
        en(m, w, p, _, b, g, S, x, y);
        return;
      } else if (A & 256) {
        st(m, w, p, _, b, g, S, x, y);
        return;
      }
    }
    L & 8 ? (I & 16 && Et(m, b, g), w !== m && u(p, w)) : I & 16 ? L & 16 ? en(m, w, p, _, b, g, S, x, y) : Et(m, b, g, true) : (I & 8 && u(p, ""), L & 16 && pe(w, p, _, b, g, S, x, y));
  }, st = (f, a, p, _, b, g, S, x, y) => {
    f = f || xt, a = a || xt;
    const m = f.length, I = a.length, w = Math.min(m, I);
    let A;
    for (A = 0; A < w; A++) {
      const L = a[A] = y ? We(a[A]) : Ne(a[A]);
      P(f[A], L, p, null, b, g, S, x, y);
    }
    m > I ? Et(f, b, g, true, false, w) : pe(a, p, _, b, g, S, x, y, w);
  }, en = (f, a, p, _, b, g, S, x, y) => {
    let m = 0;
    const I = a.length;
    let w = f.length - 1, A = I - 1;
    for (; m <= w && m <= A; ) {
      const L = f[m], H = a[m] = y ? We(a[m]) : Ne(a[m]);
      if (at(L, H))
        P(L, H, p, null, b, g, S, x, y);
      else
        break;
      m++;
    }
    for (; m <= w && m <= A; ) {
      const L = f[w], H = a[A] = y ? We(a[A]) : Ne(a[A]);
      if (at(L, H))
        P(L, H, p, null, b, g, S, x, y);
      else
        break;
      w--, A--;
    }
    if (m > w) {
      if (m <= A) {
        const L = A + 1, H = L < I ? a[L].el : _;
        for (; m <= A; )
          P(null, a[m] = y ? We(a[m]) : Ne(a[m]), p, H, b, g, S, x, y), m++;
      }
    } else if (m > A)
      for (; m <= w; )
        Pe(f[m], b, g, true), m++;
    else {
      const L = m, H = m, q = /* @__PURE__ */ new Map();
      for (m = H; m <= A; m++) {
        const be = a[m] = y ? We(a[m]) : Ne(a[m]);
        be.key != null && q.set(be.key, m);
      }
      let k, te = 0;
      const re = A - H + 1;
      let Me = false, Ie = 0;
      const Ot = new Array(re);
      for (m = 0; m < re; m++)
        Ot[m] = 0;
      for (m = L; m <= w; m++) {
        const be = f[m];
        if (te >= re) {
          Pe(be, b, g, true);
          continue;
        }
        let Le;
        if (be.key != null)
          Le = q.get(be.key);
        else
          for (k = H; k <= A; k++)
            if (Ot[k - H] === 0 && at(be, a[k])) {
              Le = k;
              break;
            }
        Le === void 0 ? Pe(be, b, g, true) : (Ot[Le - H] = m + 1, Le >= Ie ? Ie = Le : Me = true, P(be, a[Le], p, null, b, g, S, x, y), te++);
      }
      const As = Me ? dl(Ot) : xt;
      for (k = As.length - 1, m = re - 1; m >= 0; m--) {
        const be = H + m, Le = a[be], Os = a[be + 1], Ps = be + 1 < I ? Os.el || gi(Os) : _;
        Ot[m] === 0 ? P(null, Le, p, Ps, b, g, S, x, y) : Me && (k < 0 || m !== As[k] ? rt(Le, p, Ps, 2) : k--);
      }
    }
  }, rt = (f, a, p, _, b = null) => {
    const { el: g, type: S, transition: x, children: y, shapeFlag: m } = f;
    if (m & 6) {
      rt(f.component.subTree, a, p, _);
      return;
    }
    if (m & 128) {
      f.suspense.move(a, p, _);
      return;
    }
    if (m & 64) {
      S.move(f, a, p, At);
      return;
    }
    if (S === Te) {
      s(g, a, p);
      for (let w = 0; w < y.length; w++)
        rt(y[w], a, p, _);
      s(f.anchor, a, p);
      return;
    }
    if (S === Wn) {
      D(f, a, p);
      return;
    }
    if (_ !== 2 && m & 1 && x)
      if (_ === 0)
        x.persisted && !g[xe] ? s(g, a, p) : (x.beforeEnter(g), s(g, a, p), ge(() => x.enter(g), b));
      else {
        const { leave: w, delayLeave: A, afterLeave: L } = x, H = () => {
          f.ctx.isUnmounted ? r(g) : s(g, a, p);
        }, q = () => {
          const k = g._isLeaving || !!g[xe];
          g._isLeaving && g[xe](true), x.persisted && !k ? H() : w(g, () => {
            H(), L && L();
          });
        };
        A ? A(g, H, q) : q();
      }
    else
      s(g, a, p);
  }, Pe = (f, a, p, _ = false, b = false) => {
    const { type: g, props: S, ref: x, children: y, dynamicChildren: m, shapeFlag: I, patchFlag: w, dirs: A, cacheIndex: L, memo: H } = f;
    if (w === -2 && (b = false), x != null && (ze(), Ht(x, null, p, f, true), Je()), L != null && (a.renderCache[L] = void 0), I & 256) {
      a.ctx.deactivate(f);
      return;
    }
    const q = I & 1 && A, k = !$t(f);
    let te;
    if (k && (te = S && S.onVnodeBeforeUnmount) && Fe(te, a, f), I & 6)
      Oi(f.component, p, _);
    else {
      if (I & 128) {
        f.suspense.unmount(p, _);
        return;
      }
      q && it(f, null, a, "beforeUnmount"), I & 64 ? f.type.remove(f, a, p, At, _) : m && !m.hasOnce && (g !== Te || w > 0 && w & 64) ? Et(m, a, p, false, true) : (g === Te && w & 384 || !b && I & 16) && Et(y, a, p), _ && Ts(f);
    }
    const re = H != null && L == null;
    (k && (te = S && S.onVnodeUnmounted) || q || re) && ge(() => {
      te && Fe(te, a, f), q && it(f, null, a, "unmounted"), re && (f.el = null);
    }, p);
  }, Ts = (f) => {
    const { type: a, el: p, anchor: _, transition: b } = f;
    if (a === Te) {
      Ai(p, _);
      return;
    }
    if (a === Wn) {
      E(f);
      return;
    }
    const g = () => {
      r(p), b && !b.persisted && b.afterLeave && b.afterLeave();
    };
    if (f.shapeFlag & 1 && b && !b.persisted) {
      const { leave: S, delayLeave: x } = b, y = () => S(p, g);
      x ? x(f.el, g, y) : y();
    } else
      g();
  }, Ai = (f, a) => {
    let p;
    for (; f !== a; )
      p = v(f), r(f), f = p;
    r(a);
  }, Oi = (f, a, p) => {
    const { bum: _, scope: b, job: g, subTree: S, um: x, m: y, a: m } = f;
    ks(y), ks(m), _ && ln(_), b.stop(), g && (g.flags |= 8, Pe(S, f, a, p)), x && ge(x, a), ge(() => {
      f.isUnmounted = true;
    }, a);
  }, Et = (f, a, p, _ = false, b = false, g = 0) => {
    for (let S = g; S < f.length; S++)
      Pe(f[S], a, p, _, b);
  }, tn = (f) => {
    if (f.shapeFlag & 6)
      return tn(f.component.subTree);
    if (f.shapeFlag & 128)
      return f.suspense.next();
    const a = v(f.anchor || f.el), p = a && a[To];
    return p ? v(p) : a;
  };
  let Dn = false;
  const Es = (f, a, p) => {
    let _;
    f == null ? a._vnode && (Pe(a._vnode, null, null, true), _ = a._vnode.component) : P(a._vnode || null, f, a, null, null, null, p), a._vnode = f, Dn || (Dn = true, Rs(_), jr(), Dn = false);
  }, At = { p: P, um: Pe, m: rt, r: Ts, mt: oe, mc: pe, pc: z, pbc: K, n: tn, o: e };
  let Pi;
  return { render: Es, hydrate: Pi, createApp: Jo(Es) };
}
function kn({ type: e, props: t }, n) {
  return n === "svg" && e === "foreignObject" || n === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : n;
}
function ot({ effect: e, job: t }, n) {
  n ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function al(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function hi(e, t, n = false) {
  const s = e.children, r = t.children;
  if (M(s) && M(r))
    for (let i = 0; i < s.length; i++) {
      const o = s[i];
      let l = r[i];
      l.shapeFlag & 1 && !l.dynamicChildren && ((l.patchFlag <= 0 || l.patchFlag === 32) && (l = r[i] = We(r[i]), l.el = o.el), !n && l.patchFlag !== -2 && hi(o, l)), l.type === Fn && (l.patchFlag === -1 && (l = r[i] = We(l)), l.el = o.el), l.type === de && !l.el && (l.el = o.el);
    }
}
function dl(e) {
  const t = e.slice(), n = [0];
  let s, r, i, o, l;
  const c = e.length;
  for (s = 0; s < c; s++) {
    const d = e[s];
    if (d !== 0) {
      if (r = n[n.length - 1], e[r] < d) {
        t[s] = r, n.push(s);
        continue;
      }
      for (i = 0, o = n.length - 1; i < o; )
        l = i + o >> 1, e[n[l]] < d ? i = l + 1 : o = l;
      d < e[n[i]] && (i > 0 && (t[s] = n[i - 1]), n[i] = s);
    }
  }
  for (i = n.length, o = n[i - 1]; i-- > 0; )
    n[i] = o, o = t[o];
  return n;
}
function pi(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : pi(t);
}
function ks(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function gi(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? gi(t.subTree) : null;
}
const mi = (e) => e.__isSuspense;
function hl(e, t) {
  t && t.pendingBranch ? M(e) ? t.effects.push(...e) : t.effects.push(e) : yo(e);
}
const Te = Symbol.for("v-fgt"), Fn = Symbol.for("v-txt"), de = Symbol.for("v-cmt"), Wn = Symbol.for("v-stc"), mt = [];
let _e = null;
function Qe(e = false) {
  mt.push(_e = e ? null : []);
}
function bi() {
  mt.pop(), _e = mt[mt.length - 1] || null;
}
let qt = 1;
function bn(e, t = false) {
  qt += e, e < 0 && _e && t && (_e.hasOnce = true);
}
function _i(e) {
  return e.dynamicChildren = qt > 0 ? _e || xt : null, bi(), qt > 0 && _e && _e.push(e), e;
}
function lt(e, t, n, s, r, i) {
  return _i(ye(e, t, n, s, r, i, true));
}
function pl(e, t, n, s, r) {
  return _i(me(e, t, n, s, r, true));
}
function _n(e) {
  return e ? e.__v_isVNode === true : false;
}
function at(e, t) {
  return e.type === t.type && e.key === t.key;
}
const vi = ({ key: e }) => e ?? null, un = ({ ref: e, ref_key: t, ref_for: n }) => (typeof e == "number" && (e = "" + e), e != null ? Q(e) || ce(e) || N(e) ? { i: Se, r: e, k: t, f: !!n } : e : null);
function ye(e, t = null, n = null, s = 0, r = null, i = e === Te ? 0 : 1, o = false, l = false) {
  const c = { __v_isVNode: true, __v_skip: true, type: e, props: t, key: t && vi(t), ref: t && un(t), scopeId: Ur, slotScopeIds: null, children: n, component: null, suspense: null, ssContent: null, ssFallback: null, dirs: null, transition: null, el: null, anchor: null, target: null, targetStart: null, targetAnchor: null, staticCount: 0, shapeFlag: i, patchFlag: s, dynamicProps: r, dynamicChildren: null, appContext: null, ctx: Se };
  return l ? (vn(c, n), i & 128 && e.normalize(c)) : n && (c.shapeFlag |= Q(n) ? 8 : 16), qt > 0 && !o && _e && (c.patchFlag > 0 || i & 6) && c.patchFlag !== 32 && _e.push(c), c;
}
const me = gl;
function gl(e, t = null, n = null, s = 0, r = null, i = false) {
  if ((!e || e === jo) && (e = de), _n(e)) {
    const l = nt(e, t, true);
    return n && vn(l, n), qt > 0 && !i && _e && (l.shapeFlag & 6 ? _e[_e.indexOf(e)] = l : _e.push(l)), l.patchFlag = -2, l;
  }
  if (El(e) && (e = e.__vccOpts), t) {
    t = ml(t);
    let { class: l, style: c } = t;
    l && !Q(l) && (t.class = tt(l)), U(c) && (vs(c) && !M(c) && (c = ne({}, c)), t.style = as(c));
  }
  const o = Q(e) ? 1 : mi(e) ? 128 : Pn(e) ? 64 : U(e) ? 4 : N(e) ? 2 : 0;
  return ye(e, t, n, s, r, o, i, true);
}
function ml(e) {
  return e ? vs(e) || li(e) ? ne({}, e) : e : null;
}
function nt(e, t, n = false, s = false) {
  const { props: r, ref: i, patchFlag: o, children: l, transition: c } = e, d = t ? _l(r || {}, t) : r, u = { __v_isVNode: true, __v_skip: true, type: e.type, props: d, key: d && vi(d), ref: t && t.ref ? n && i ? M(i) ? i.concat(un(t)) : [i, un(t)] : un(t) : i, scopeId: e.scopeId, slotScopeIds: e.slotScopeIds, children: l, target: e.target, targetStart: e.targetStart, targetAnchor: e.targetAnchor, staticCount: e.staticCount, shapeFlag: e.shapeFlag, patchFlag: t && e.type !== Te ? o === -1 ? 16 : o | 16 : o, dynamicProps: e.dynamicProps, dynamicChildren: e.dynamicChildren, appContext: e.appContext, dirs: e.dirs, transition: c, component: e.component, suspense: e.suspense, ssContent: e.ssContent && nt(e.ssContent), ssFallback: e.ssFallback && nt(e.ssFallback), placeholder: e.placeholder, el: e.el, anchor: e.anchor, ctx: e.ctx, ce: e.ce };
  return c && s && Wt(u, c.clone(u)), u;
}
function bl(e = " ", t = 0) {
  return me(Fn, null, e, t);
}
function Ke(e = "", t = false) {
  return t ? (Qe(), pl(de, null, e)) : me(de, null, e);
}
function Ne(e) {
  return e == null || typeof e == "boolean" ? me(de) : M(e) ? me(Te, null, e.slice()) : _n(e) ? We(e) : me(Fn, null, String(e));
}
function We(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : nt(e);
}
function vn(e, t) {
  let n = 0;
  const { shapeFlag: s } = e;
  if (t == null)
    t = null;
  else if (M(t))
    n = 16;
  else if (typeof t == "object")
    if (s & 65) {
      const r = t.default;
      r && (r._c && (r._d = false), vn(e, r()), r._c && (r._d = true));
      return;
    } else {
      n = 32;
      const r = t._;
      !r && !li(t) ? t._ctx = Se : r === 3 && Se && (Se.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else if (N(t)) {
    if (s & 65) {
      vn(e, { default: t });
      return;
    }
    t = { default: t, _ctx: Se }, n = 32;
  } else
    t = String(t), s & 64 ? (n = 16, t = [bl(t)]) : n = 8;
  e.children = t, e.shapeFlag |= n;
}
function _l(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const s = e[n];
    for (const r in s)
      if (r === "class")
        t.class !== s.class && (t.class = tt([t.class, s.class]));
      else if (r === "style")
        t.style = as([t.style, s.style]);
      else if (Sn(r)) {
        const i = t[r], o = s[r];
        o && i !== o && !(M(i) && i.includes(o)) ? t[r] = i ? [].concat(i, o) : o : o == null && i == null && !Cn(r) && (t[r] = o);
      } else
        r !== "" && (t[r] = s[r]);
  }
  return t;
}
function Fe(e, t, n, s = null) {
  we(e, t, 7, [n, s]);
}
const vl = ni();
let yl = 0;
function xl(e, t, n) {
  const s = e.type, r = (t ? t.appContext : e.appContext) || vl, i = { uid: yl++, vnode: e, type: s, parent: t, appContext: r, root: null, next: null, subTree: null, effect: null, update: null, job: null, scope: new Ui(true), render: null, proxy: null, exposed: null, exposeProxy: null, withProxy: null, provides: t ? t.provides : Object.create(r.provides), ids: t ? t.ids : ["", 0, 0], accessCache: null, renderCache: [], components: null, directives: null, propsOptions: fi(s, r), emitsOptions: si(s, r), emit: null, emitted: null, propsDefaults: G, inheritAttrs: s.inheritAttrs, ctx: G, data: G, props: G, attrs: G, slots: G, refs: G, setupState: G, setupContext: null, suspense: n, suspenseId: n ? n.pendingId : 0, asyncDep: null, asyncResolved: false, isMounted: false, isUnmounted: false, isDeactivated: false, bc: null, c: null, bm: null, m: null, bu: null, u: null, um: null, bum: null, da: null, a: null, rtg: null, rtc: null, ec: null, sp: null };
  return i.ctx = { _: i }, i.root = t ? t.root : i, i.emit = Xo.bind(null, i), e.ce && e.ce(i), i;
}
let he = null;
const yi = () => he || Se;
let yn, Gt;
{
  const e = En(), t = (n, s) => {
    let r;
    return (r = e[n]) || (r = e[n] = []), r.push(s), (i) => {
      r.length > 1 ? r.forEach((o) => o(i)) : r[0](i);
    };
  };
  yn = t("__VUE_INSTANCE_SETTERS__", (n) => he = n), Gt = t("__VUE_SSR_SETTERS__", (n) => zt = n);
}
const Qt = (e) => {
  const t = he;
  return yn(e), e.scope.on(), () => {
    e.scope.off(), yn(t);
  };
}, Ws = () => {
  he && he.scope.off(), yn(null);
};
function xi(e) {
  return e.vnode.shapeFlag & 4;
}
let zt = false;
function Sl(e, t = false, n = false) {
  t && Gt(t);
  const { props: s, children: r } = e.vnode, i = xi(e);
  sl(e, s, i, t), ll(e, r, n || t);
  const o = i ? Cl(e, t) : void 0;
  return t && Gt(false), o;
}
function Cl(e, t) {
  const n = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, Uo);
  const { setup: s } = n;
  if (s) {
    ze();
    const r = e.setupContext = s.length > 1 ? Tl(e) : null, i = Qt(e), o = Zt(s, e, 0, [e.props, r]), l = pr(o);
    if (Je(), i(), (l || e.sp) && !$t(e) && Xr(e), l) {
      if (o.then(Ws, Ws), t)
        return o.then((c) => {
          Gt(true);
          try {
            qs(e, c, t);
          } finally {
            Gt(false);
          }
        }).catch((c) => {
          On(c, e, 0);
        });
      e.asyncDep = o;
    } else
      qs(e, o);
  } else
    Si(e);
}
function qs(e, t, n) {
  N(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : U(t) && (e.setupState = Vr(t)), Si(e);
}
function Si(e, t, n) {
  const s = e.type;
  e.render || (e.render = s.render || He);
  {
    const r = Qt(e);
    ze();
    try {
      Ko(e);
    } finally {
      Je(), r();
    }
  }
}
const wl = { get(e, t) {
  return le(e, "get", ""), e[t];
} };
function Tl(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return { attrs: new Proxy(e.attrs, wl), slots: e.slots, emit: e.emit, expose: t };
}
function Rn(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(Vr(co(e.exposed)), { get(t, n) {
    if (n in t)
      return t[n];
    if (n in jt)
      return jt[n](e);
  }, has(t, n) {
    return n in t || n in jt;
  } })) : e.proxy;
}
function El(e) {
  return N(e) && "__vccOpts" in e;
}
const Ci = (e, t) => go(e, t, zt);
function Al(e, t, n) {
  try {
    bn(-1);
    const s = arguments.length;
    return s === 2 ? U(t) && !M(t) ? _n(t) ? me(e, null, [t]) : me(e, t) : me(e, null, t) : (s > 3 ? n = Array.prototype.slice.call(arguments, 2) : s === 3 && _n(n) && (n = [n]), me(e, t, n));
  } finally {
    bn(1);
  }
}
const Ol = "3.5.41";
/**
* @vue/runtime-dom v3.5.41
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
let os;
const Gs = typeof window < "u" && window.trustedTypes;
if (Gs)
  try {
    os = Gs.createPolicy("vue", { createHTML: (e) => e });
  } catch {
  }
const wi = os ? (e) => os.createHTML(e) : (e) => e, Pl = "http://www.w3.org/2000/svg", Ml = "http://www.w3.org/1998/Math/MathML", ke = typeof document < "u" ? document : null, zs = ke && ke.createElement("template"), Il = { insert: (e, t, n) => {
  t.insertBefore(e, n || null);
}, remove: (e) => {
  const t = e.parentNode;
  t && t.removeChild(e);
}, createElement: (e, t, n, s) => {
  const r = t === "svg" ? ke.createElementNS(Pl, e) : t === "mathml" ? ke.createElementNS(Ml, e) : n ? ke.createElement(e, { is: n }) : ke.createElement(e);
  return e === "select" && s && s.multiple != null && r.setAttribute("multiple", s.multiple), r;
}, createText: (e) => ke.createTextNode(e), createComment: (e) => ke.createComment(e), setText: (e, t) => {
  e.nodeValue = t;
}, setElementText: (e, t) => {
  e.textContent = t;
}, parentNode: (e) => e.parentNode, nextSibling: (e) => e.nextSibling, querySelector: (e) => ke.querySelector(e), setScopeId(e, t) {
  e.setAttribute(t, "");
}, insertStaticContent(e, t, n, s, r, i) {
  const o = n ? n.previousSibling : t.lastChild;
  if (r && (r === i || r.nextSibling))
    for (; t.insertBefore(r.cloneNode(true), n), !(r === i || !(r = r.nextSibling)); )
      ;
  else {
    zs.innerHTML = wi(s === "svg" ? `<svg>${e}</svg>` : s === "mathml" ? `<math>${e}</math>` : e);
    const l = zs.content;
    if (s === "svg" || s === "mathml") {
      const c = l.firstChild;
      for (; c.firstChild; )
        l.appendChild(c.firstChild);
      l.removeChild(c);
    }
    t.insertBefore(l, n);
  }
  return [o ? o.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
} }, Ze = "transition", It = "animation", Jt = Symbol("_vtc"), Ti = { name: String, type: String, css: { type: Boolean, default: true }, duration: [String, Number, Object], enterFromClass: String, enterActiveClass: String, enterToClass: String, appearFromClass: String, appearActiveClass: String, appearToClass: String, leaveFromClass: String, leaveActiveClass: String, leaveToClass: String }, Ll = ne({}, qr, Ti), Fl = (e) => (e.displayName = "Transition", e.props = Ll, e), Rl = Fl((e, { slots: t }) => Al(Oo, Dl(e), t)), ct = (e, t = []) => {
  M(e) ? e.forEach((n) => n(...t)) : e && e(...t);
}, Js = (e) => e ? M(e) ? e.some((t) => t.length > 1) : e.length > 1 : false;
function Dl(e) {
  const t = {};
  for (const T in e)
    T in Ti || (t[T] = e[T]);
  if (e.css === false)
    return t;
  const { name: n = "v", type: s, duration: r, enterFromClass: i = `${n}-enter-from`, enterActiveClass: o = `${n}-enter-active`, enterToClass: l = `${n}-enter-to`, appearFromClass: c = i, appearActiveClass: d = o, appearToClass: u = l, leaveFromClass: h = `${n}-leave-from`, leaveActiveClass: v = `${n}-leave-active`, leaveToClass: C = `${n}-leave-to` } = e, R = Nl(r), P = R && R[0], W = R && R[1], { onBeforeEnter: O, onEnter: F, onEnterCancelled: D, onLeave: E, onLeaveCancelled: $, onBeforeAppear: ee = O, onAppear: fe = F, onAppearCancelled: pe = D } = t, V = (T, Y, oe, je) => {
    T._enterCancelled = je, ft(T, Y ? u : l), ft(T, Y ? d : o), oe && oe();
  }, K = (T, Y) => {
    T._isLeaving = false, ft(T, h), ft(T, C), ft(T, v), Y && Y();
  }, X = (T) => (Y, oe) => {
    const je = T ? fe : F, se = () => V(Y, T, oe);
    ct(je, [Y, se]), Ys(() => {
      ft(Y, T ? c : i), Ue(Y, T ? u : l), Js(je) || Xs(Y, s, P, se);
    });
  };
  return ne(t, { onBeforeEnter(T) {
    ct(O, [T]), Ue(T, i), Ue(T, o);
  }, onBeforeAppear(T) {
    ct(ee, [T]), Ue(T, c), Ue(T, d);
  }, onEnter: X(false), onAppear: X(true), onLeave(T, Y) {
    T._isLeaving = true;
    const oe = () => K(T, Y);
    Ue(T, h), T._enterCancelled ? (Ue(T, v), er(T)) : (er(T), Ue(T, v)), Ys(() => {
      T._isLeaving && (ft(T, h), Ue(T, C), Js(E) || Xs(T, s, W, oe));
    }), ct(E, [T, oe]);
  }, onEnterCancelled(T) {
    V(T, false, void 0, true), ct(D, [T]);
  }, onAppearCancelled(T) {
    V(T, true, void 0, true), ct(pe, [T]);
  }, onLeaveCancelled(T) {
    K(T), ct($, [T]);
  } });
}
function Nl(e) {
  if (e == null)
    return null;
  if (U(e))
    return [qn(e.enter), qn(e.leave)];
  {
    const t = qn(e);
    return [t, t];
  }
}
function qn(e) {
  return Ri(e);
}
function Ue(e, t) {
  t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[Jt] || (e[Jt] = /* @__PURE__ */ new Set())).add(t);
}
function ft(e, t) {
  t.split(/\s+/).forEach((s) => s && e.classList.remove(s));
  const n = e[Jt];
  n && (n.delete(t), n.size || (e[Jt] = void 0));
}
function Ys(e) {
  requestAnimationFrame(() => {
    requestAnimationFrame(e);
  });
}
let Vl = 0;
function Xs(e, t, n, s) {
  const r = e._endId = ++Vl, i = () => {
    r === e._endId && s();
  };
  if (n != null)
    return setTimeout(i, n);
  const { type: o, timeout: l, propCount: c } = Hl(e, t);
  if (!o)
    return s();
  const d = o + "end";
  let u = 0;
  const h = () => {
    e.removeEventListener(d, v), i();
  }, v = (C) => {
    C.target === e && ++u >= c && h();
  };
  setTimeout(() => {
    u < c && h();
  }, l + 1), e.addEventListener(d, v);
}
function Hl(e, t) {
  const n = window.getComputedStyle(e), s = (R) => (n[R] || "").split(", "), r = s(`${Ze}Delay`), i = s(`${Ze}Duration`), o = Zs(r, i), l = s(`${It}Delay`), c = s(`${It}Duration`), d = Zs(l, c);
  let u = null, h = 0, v = 0;
  t === Ze ? o > 0 && (u = Ze, h = o, v = i.length) : t === It ? d > 0 && (u = It, h = d, v = c.length) : (h = Math.max(o, d), u = h > 0 ? o > d ? Ze : It : null, v = u ? u === Ze ? i.length : c.length : 0);
  const C = u === Ze && /\b(?:transform|all)(?:,|$)/.test(s(`${Ze}Property`).toString());
  return { type: u, timeout: h, propCount: v, hasTransform: C };
}
function Zs(e, t) {
  for (; e.length < t.length; )
    e = e.concat(e);
  return Math.max(...t.map((n, s) => Qs(n) + Qs(e[s])));
}
function Qs(e) {
  return e === "auto" ? 0 : Number(e.slice(0, -1).replace(",", ".")) * 1e3;
}
function er(e) {
  return (e ? e.ownerDocument : document).body.offsetHeight;
}
function $l(e, t, n) {
  const s = e[Jt];
  s && (t = (t ? [t, ...s] : [...s]).join(" ")), t == null ? e.removeAttribute("class") : n ? e.setAttribute("class", t) : e.className = t;
}
const tr = Symbol("_vod"), jl = Symbol("_vsh"), Bl = Symbol(""), Ul = /(?:^|;)\s*display\s*:/;
function Kl(e, t, n) {
  const s = e.style, r = Q(n);
  let i = false;
  if (n && !r) {
    if (t)
      if (Q(t))
        for (const o of t.split(";")) {
          const l = o.slice(0, o.indexOf(":")).trim();
          n[l] == null && Rt(s, l, "");
        }
      else
        for (const o in t)
          n[o] == null && Rt(s, o, "");
    for (const o in n) {
      o === "display" && (i = true);
      const l = n[o];
      l != null ? Wl(e, o, !Q(t) && t ? t[o] : void 0, l) || Rt(s, o, l) : Rt(s, o, "");
    }
  } else if (r) {
    if (t !== n) {
      const o = s[Bl];
      o && (n += ";" + o), s.cssText = n, i = Ul.test(n);
    }
  } else
    t && e.removeAttribute("style");
  tr in e && (e[tr] = i ? s.display : "", e[jl] && (s.display = "none"));
}
const nr = /\s*!important$/;
function Rt(e, t, n) {
  if (M(n))
    n.forEach((s) => Rt(e, t, s));
  else if (n == null && (n = ""), t.startsWith("--"))
    e.setProperty(t, n);
  else {
    const s = kl(e, t);
    nr.test(n) ? e.setProperty(bt(s), n.replace(nr, ""), "important") : e[s] = n;
  }
}
const sr = ["Webkit", "Moz", "ms"], Gn = {};
function kl(e, t) {
  const n = Gn[t];
  if (n)
    return n;
  let s = Ee(t);
  if (s !== "filter" && s in e)
    return Gn[t] = s;
  s = br(s);
  for (let r = 0; r < sr.length; r++) {
    const i = sr[r] + s;
    if (i in e)
      return Gn[t] = i;
  }
  return t;
}
function Wl(e, t, n, s) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && Q(s) && n === s;
}
const rr = "http://www.w3.org/1999/xlink";
function ir(e, t, n, s, r, i = ji(t)) {
  s && t.startsWith("xlink:") ? n == null ? e.removeAttributeNS(rr, t.slice(6, t.length)) : e.setAttributeNS(rr, t, n) : n == null || i && !vr(n) ? e.removeAttribute(t) : e.setAttribute(t, i ? "" : $e(n) ? String(n) : n);
}
function or(e, t, n, s, r) {
  if (t === "innerHTML" || t === "textContent") {
    n != null && (e[t] = t === "innerHTML" ? wi(n) : n);
    return;
  }
  const i = e.tagName;
  if (t === "value" && i !== "PROGRESS" && !i.includes("-")) {
    const l = i === "OPTION" ? e.getAttribute("value") || "" : e.value, c = n == null ? e.type === "checkbox" ? "on" : "" : String(n);
    (l !== c || !("_value" in e)) && (e.value = c), n == null && e.removeAttribute(t), e._value = n;
    return;
  }
  let o = false;
  if (n === "" || n == null) {
    const l = typeof e[t];
    l === "boolean" ? n = vr(n) : n == null && l === "string" ? (n = "", o = true) : l === "number" && (n = 0, o = true);
  }
  try {
    e[t] = n;
  } catch {
  }
  o && e.removeAttribute(r || t);
}
function dt(e, t, n, s) {
  e.addEventListener(t, n, s);
}
function ql(e, t, n, s) {
  e.removeEventListener(t, n, s);
}
const lr = Symbol("_vei");
function Gl(e, t, n, s, r = null) {
  const i = e[lr] || (e[lr] = {}), o = i[t];
  if (s && o)
    o.value = s;
  else {
    const [l, c] = Yl(t);
    if (s) {
      const d = i[t] = Ql(s, r);
      dt(e, l, d, c);
    } else
      o && (ql(e, l, o, c), i[t] = void 0);
  }
}
const zl = /(Once|Passive|Capture)$/, Jl = /^on:?(?:Once|Passive|Capture)$/;
function Yl(e) {
  let t, n;
  for (; (n = e.match(zl)) && !Jl.test(e); )
    t || (t = {}), e = e.slice(0, e.length - n[1].length), t[n[1].toLowerCase()] = true;
  return [e[2] === ":" ? e.slice(3) : bt(e.slice(2)), t];
}
let zn = 0;
const Xl = Promise.resolve(), Zl = () => zn || (Xl.then(() => zn = 0), zn = Date.now());
function Ql(e, t) {
  const n = (s) => {
    if (!s._vts)
      s._vts = Date.now();
    else if (s._vts <= n.attached)
      return;
    const r = n.value;
    if (M(r)) {
      const i = s.stopImmediatePropagation;
      s.stopImmediatePropagation = () => {
        i.call(s), s._stopped = true;
      };
      const o = r.slice(), l = [s];
      for (let c = 0; c < o.length && !s._stopped; c++) {
        const d = o[c];
        d && we(d, t, 5, l);
      }
    } else
      we(r, t, 5, [s]);
  };
  return n.value = e, n.attached = Zl(), n;
}
const cr = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, ec = (e, t, n, s, r, i) => {
  const o = r === "svg";
  t === "class" ? $l(e, s, o) : t === "style" ? Kl(e, n, s) : Sn(t) ? Cn(t) || Gl(e, t, n, s, i) : (t[0] === "." ? (t = t.slice(1), true) : t[0] === "^" ? (t = t.slice(1), false) : tc(e, t, s, o)) ? (or(e, t, s), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && ir(e, t, s, o, i, t !== "value")) : e._isVueCE && (nc(e, t) || e._def.__asyncLoader && (/[A-Z]/.test(t) || !Q(s))) ? or(e, Ee(t), s, i, t) : (t === "true-value" ? e._trueValue = s : t === "false-value" && (e._falseValue = s), ir(e, t, s, o));
};
function tc(e, t, n, s) {
  if (s)
    return !!(t === "innerHTML" || t === "textContent" || t in e && cr(t) && N(n));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return false;
  if (t === "width" || t === "height") {
    const r = e.tagName;
    if (r === "IMG" || r === "VIDEO" || r === "CANVAS" || r === "SOURCE")
      return false;
  }
  return cr(t) && Q(n) ? false : t in e;
}
function nc(e, t) {
  const n = e._def.props;
  if (!n)
    return false;
  const s = Ee(t);
  return Array.isArray(n) ? n.some((r) => Ee(r) === s) : Object.keys(n).some((r) => Ee(r) === s);
}
const xn = (e) => {
  const t = e.props["onUpdate:modelValue"] || false;
  return M(t) ? (n) => ln(t, n) : t;
};
function sc(e) {
  e.target.composing = true;
}
function fr(e) {
  const t = e.target;
  t.composing && (t.composing = false, t.dispatchEvent(new Event("input")));
}
const ht = Symbol("_assign"), on = Symbol("_initialValue");
function Jn(e, t, n) {
  return t && (e = e.trim()), n && (e = us(e)), e;
}
const xc = { created(e, { modifiers: { lazy: t, trim: n, number: s } }, r) {
  e.parentNode && (e.type === "text" ? e[on] = e.defaultValue.replace(/[\r\n]/g, "") : e.type === "textarea" && (e[on] = e.defaultValue.replace(/\r\n?/g, `
`))), e[ht] = xn(r);
  const i = s || r.props && r.props.type === "number";
  dt(e, t ? "change" : "input", (o) => {
    o.target.composing || e[ht](Jn(e.value, n, i));
  }), (n || i) && dt(e, "change", () => {
    e.value = Jn(e.value, n, i);
  }), t || (dt(e, "compositionstart", sc), dt(e, "compositionend", fr), dt(e, "change", fr));
}, mounted(e, { value: t, modifiers: { trim: n, number: s } }) {
  const r = t ?? "", i = e[on];
  delete e[on], i !== void 0 && (e.type === "text" || e.type === "textarea") && e.value !== i ? e[ht](Jn(e.value, n, s)) : e.value = r;
}, beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: s, trim: r, number: i } }, o) {
  if (e[ht] = xn(o), e.composing)
    return;
  const l = (i || e.type === "number") && !/^0\d/.test(e.value) ? us(e.value) : e.value, c = t ?? "";
  if (l === c)
    return;
  const d = e.getRootNode();
  (d instanceof Document || d instanceof ShadowRoot) && d.activeElement === e && e.type !== "range" && (s && t === n || r && e.value.trim() === c) || (e.value = c);
} }, Sc = { deep: true, created(e, t, n) {
  e[ht] = xn(n), dt(e, "change", () => {
    const s = e._modelValue, r = rc(e), i = e.checked, o = e[ht];
    if (M(s)) {
      const l = yr(s, r), c = l !== -1;
      if (i && !c)
        o(s.concat(r));
      else if (!i && c) {
        const d = [...s];
        d.splice(l, 1), o(d);
      }
    } else if (wn(s)) {
      const l = new Set(s);
      i ? l.add(r) : l.delete(r), o(l);
    } else
      o(Ei(e, i));
  });
}, mounted: ur, beforeUpdate(e, t, n) {
  e[ht] = xn(n), ur(e, t, n);
} };
function ur(e, { value: t, oldValue: n }, s) {
  e._modelValue = t;
  let r;
  if (M(t))
    r = yr(t, s.props.value) > -1;
  else if (wn(t))
    r = t.has(s.props.value);
  else {
    if (t === n)
      return;
    r = Xt(t, Ei(e, true));
  }
  e.checked !== r && (e.checked = r);
}
function rc(e) {
  return "_value" in e ? e._value : e.value;
}
function Ei(e, t) {
  const n = t ? "_trueValue" : "_falseValue";
  return n in e ? e[n] : t;
}
const ic = ne({ patchProp: ec }, Il);
let ar;
function oc() {
  return ar || (ar = fl(ic));
}
const Cc = (...e) => {
  const t = oc().createApp(...e), { mount: n } = t;
  return t.mount = (s) => {
    const r = cc(s);
    if (!r)
      return;
    const i = t._component;
    !N(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
    const o = n(r, false, lc(r));
    return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), o;
  }, t;
};
function lc(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function cc(e) {
  return Q(e) ? document.querySelector(e) : e;
}
const wc = "/assets/logo.png", fc = ["disabled", "aria-expanded"], uc = { class: "flex items-center gap-6px min-w-0 truncate text-left" }, ac = { class: "font-medium text-[--text-primary] truncate" }, dc = { key: 0, class: "text-11px text-[--text-muted] truncate font-normal opacity-80" }, hc = ["aria-selected", "onClick", "onMouseenter"], pc = { class: "flex items-center gap-6px min-w-0 truncate" }, gc = { class: "truncate" }, mc = { key: 0, class: "flex-shrink-0 text-[--primary-color] flex items-center" }, bc = Po({ __name: "CustomSelect", props: { modelValue: {}, options: {}, placeholder: { default: "\u8BF7\u9009\u62E9" }, disabled: { type: Boolean, default: false } }, emits: ["update:modelValue", "change"], setup(e, { emit: t }) {
  const n = e, s = t, r = vt(false), i = vt(null), o = vt(null), l = vt(-1), c = vt(null), d = Ci(() => n.options.find((O) => O.value === n.modelValue));
  function u() {
    n.disabled || (r.value ? v() : h());
  }
  function h() {
    r.value = true;
    const O = n.options.findIndex((F) => F.value === n.modelValue);
    l.value = O >= 0 ? O : 0, cn(() => {
      R();
    });
  }
  function v() {
    r.value = false, l.value = -1;
  }
  function C(O) {
    s("update:modelValue", O.value), s("change", O.value), v();
  }
  function R() {
    c.value && o.value && c.value.scrollIntoView({ block: "nearest" });
  }
  function P(O) {
    if (!n.disabled) {
      if (!r.value) {
        (O.key === "ArrowDown" || O.key === "ArrowUp" || O.key === "Enter" || O.key === " ") && (O.preventDefault(), h());
        return;
      }
      switch (O.key) {
        case "ArrowDown":
          O.preventDefault(), l.value < n.options.length - 1 && (l.value++, cn(() => R()));
          break;
        case "ArrowUp":
          O.preventDefault(), l.value > 0 && (l.value--, cn(() => R()));
          break;
        case "Enter":
        case " ":
          O.preventDefault(), l.value >= 0 && l.value < n.options.length && C(n.options[l.value]);
          break;
        case "Escape":
          O.preventDefault(), O.stopPropagation(), v();
          break;
        case "Tab":
          v();
          break;
      }
    }
  }
  function W(O) {
    i.value && !i.value.contains(O.target) && v();
  }
  return xs(() => {
    window.addEventListener("pointerdown", W, true);
  }), Ss(() => {
    window.removeEventListener("pointerdown", W, true);
  }), (O, F) => {
    var _a, _b;
    return Qe(), lt("div", { ref_key: "containerRef", ref: i, class: tt(["custom-select-container relative select-none", [r.value ? "z-40" : "z-1", { "opacity-50 pointer-events-none": e.disabled }]]) }, [Ke(" Trigger Button "), ye("button", { type: "button", class: tt(["custom-select-trigger w-full flex items-center justify-between gap-8px py-6.5px px-9px rounded-lg border transition-all text-12px outline-none cursor-pointer", [r.value ? "border-[--primary-color] ring-2 ring-blue-500/20 bg-[--bg-page]" : "border-[--border-color] bg-[--bg-subtle] hover:border-[--text-muted] hover:bg-[--bg-hover]"]]), disabled: e.disabled, "aria-haspopup": "listbox", "aria-expanded": r.value, onClick: u, onKeydown: P }, [ye("span", uc, [ye("span", ac, Lt(((_a = d.value) == null ? void 0 : _a.label) || e.placeholder), 1), ((_b = d.value) == null ? void 0 : _b.subLabel) ? (Qe(), lt("span", dc, " (" + Lt(d.value.subLabel) + ") ", 1)) : Ke("v-if", true)]), Ke(" Chevron Arrow "), ye("span", { class: tt(["flex-shrink-0 text-[--text-muted] transition-transform duration-200", { "rotate-180 text-[--primary-color]": r.value }]) }, [...F[0] || (F[0] = [ye("svg", { class: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor" }, [ye("path", { "fill-rule": "evenodd", d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z", "clip-rule": "evenodd" })], -1)])], 2)], 42, fc), Ke(" Dropdown Menu "), me(Rl, { name: "select-dropdown" }, { default: Kr(() => [r.value ? (Qe(), lt("div", { key: 0, ref_key: "menuRef", ref: o, class: "custom-select-menu absolute left-0 right-0 top-[calc(100%+4px)] z-50 min-w-full rounded-xl p-4px shadow-xl border border-[--border-color] bg-[--bg-card]/98 backdrop-blur-xl max-h-220px overflow-y-auto", role: "listbox", tabindex: "-1" }, [(Qe(true), lt(Te, null, Bo(e.options, (D, E) => (Qe(), lt("div", { key: D.value, ref_for: true, ref: ($) => {
      E === l.value && (c.value = $);
    }, class: tt(["custom-select-option flex items-center justify-between gap-8px px-9px py-6px rounded-lg cursor-pointer transition-colors text-12px select-none", [D.value === e.modelValue ? "bg-[--primary-light] text-[--primary-color] font-semibold" : E === l.value ? "bg-[--bg-hover] text-[--text-primary]" : "text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"]]), role: "option", "aria-selected": D.value === e.modelValue, onClick: ($) => C(D), onMouseenter: ($) => l.value = E }, [ye("div", pc, [ye("span", gc, Lt(D.label), 1), D.subLabel ? (Qe(), lt("span", { key: 0, class: tt(["text-10.5px px-5px py-0.5 rounded font-mono truncate border", [D.value === e.modelValue ? "bg-[--bg-page] text-[--primary-color] border-[--border-color] font-medium" : "bg-[--bg-page] text-[--text-muted] border-[--border-subtle]"]]) }, Lt(D.subLabel), 3)) : Ke("v-if", true)]), Ke(" Active Checkmark "), D.value === e.modelValue ? (Qe(), lt("span", mc, [...F[1] || (F[1] = [ye("svg", { class: "w-3.5 h-3.5", viewBox: "0 0 20 20", fill: "currentColor" }, [ye("path", { "fill-rule": "evenodd", d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z", "clip-rule": "evenodd" })], -1)])])) : Ke("v-if", true)], 42, hc))), 128))], 512)) : Ke("v-if", true)]), _: 1 })], 2);
  };
} }), _c = (e, t) => {
  const n = e.__vccOpts || e;
  for (const [s, r] of t)
    n[s] = r;
  return n;
}, Tc = _c(bc, [["__scopeId", "data-v-dc2823cb"]]), vc = ["Emoji", "Sub", "Sup", "Ins", "Mark", "Katex", "Mermaid", "TOC", "Alert", "TaskLists", "MultimdTable", "Linkify", "FrontMatter"], Bt = { pageTheme: "auto", textFont: "Default", textSize: "Normal", enableCustomContentWidth: false, enableCustomCSS: false, refresh: 0, maxOutlineExpandLevel: 6, mdPlugins: vc, mdPluginOptions: {}, charsetCompat: true };
function dr(e) {
  const t = { ...Bt, ...e || {} };
  if (!Array.isArray(t.mdPlugins))
    if (typeof t.mdPlugins == "string")
      try {
        const n = JSON.parse(t.mdPlugins);
        t.mdPlugins = Array.isArray(n) ? n : t.mdPlugins.split(",").map((s) => s.trim()).filter(Boolean);
      } catch {
        t.mdPlugins = t.mdPlugins.split(",").map((n) => n.trim()).filter(Boolean);
      }
    else
      t.mdPlugins = [...Bt.mdPlugins];
  return (!Array.isArray(t.mdPlugins) || t.mdPlugins.length === 0) && (t.mdPlugins = [...Bt.mdPlugins]), t;
}
function Ec() {
  const e = vt({ ...Bt });
  return { settings: e, loadSettings: async () => {
    var _a;
    if (typeof chrome < "u" && ((_a = chrome.storage) == null ? void 0 : _a.local))
      try {
        const s = await chrome.storage.local.get("settings");
        s.settings && (e.value = dr(s.settings));
      } catch (s) {
        console.warn("[Markdown Reader] Failed to load settings from storage:", s), e.value = { ...Bt };
      }
  }, saveSettings: async (s) => {
    var _a;
    const r = dr({ ...e.value, ...s });
    if (e.value = r, typeof chrome < "u" && ((_a = chrome.storage) == null ? void 0 : _a.local))
      try {
        await chrome.storage.local.set({ settings: r });
      } catch (i) {
        console.warn("[Markdown Reader] Failed to save settings to storage:", i);
      }
  } };
}
export {
  Tc as C,
  vc as D,
  Te as F,
  wc as _,
  Qe as a,
  ye as b,
  lt as c,
  Po as d,
  Ke as e,
  me as f,
  xc as g,
  Ec as h,
  _c as i,
  Cc as j,
  Ci as k,
  pl as l,
  tt as n,
  xs as o,
  Bo as r,
  Lt as t,
  ao as u,
  Sc as v,
  yc as w
};
