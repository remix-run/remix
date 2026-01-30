// ../../../../../node_modules/.pnpm/preact@10.28.0/node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var r;
var o;
var e;
var f;
var c;
var s;
var a;
var h;
var p = {};
var v = [];
var y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var w = Array.isArray;
function d(n2, l3) {
  for (var u4 in l3) n2[u4] = l3[u4];
  return n2;
}
function g(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function _(l3, u4, t3) {
  var i3, r3, o3, e3 = {};
  for (o3 in u4) "key" == o3 ? i3 = u4[o3] : "ref" == o3 ? r3 = u4[o3] : e3[o3] = u4[o3];
  if (arguments.length > 2 && (e3.children = arguments.length > 3 ? n.call(arguments, 2) : t3), "function" == typeof l3 && null != l3.defaultProps) for (o3 in l3.defaultProps) void 0 === e3[o3] && (e3[o3] = l3.defaultProps[o3]);
  return m(l3, e3, i3, r3, null);
}
function m(n2, t3, i3, r3, o3) {
  var e3 = { type: n2, props: t3, key: i3, ref: r3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o3 ? ++u : o3, __i: -1, __u: 0 };
  return null == o3 && null != l.vnode && l.vnode(e3), e3;
}
function k(n2) {
  return n2.children;
}
function x(n2, l3) {
  this.props = n2, this.context = l3;
}
function S(n2, l3) {
  if (null == l3) return n2.__ ? S(n2.__, n2.__i + 1) : null;
  for (var u4; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) return u4.__e;
  return "function" == typeof n2.type ? S(n2) : null;
}
function C(n2) {
  var l3, u4;
  if (null != (n2 = n2.__) && null != n2.__c) {
    for (n2.__e = n2.__c.base = null, l3 = 0; l3 < n2.__k.length; l3++) if (null != (u4 = n2.__k[l3]) && null != u4.__e) {
      n2.__e = n2.__c.base = u4.__e;
      break;
    }
    return C(n2);
  }
}
function M(n2) {
  (!n2.__d && (n2.__d = true) && i.push(n2) && !$.__r++ || r != l.debounceRendering) && ((r = l.debounceRendering) || o)($);
}
function $() {
  for (var n2, u4, t3, r3, o3, f4, c3, s3 = 1; i.length; ) i.length > s3 && i.sort(e), n2 = i.shift(), s3 = i.length, n2.__d && (t3 = void 0, r3 = void 0, o3 = (r3 = (u4 = n2).__v).__e, f4 = [], c3 = [], u4.__P && ((t3 = d({}, r3)).__v = r3.__v + 1, l.vnode && l.vnode(t3), O(u4.__P, t3, r3, u4.__n, u4.__P.namespaceURI, 32 & r3.__u ? [o3] : null, f4, null == o3 ? S(r3) : o3, !!(32 & r3.__u), c3), t3.__v = r3.__v, t3.__.__k[t3.__i] = t3, N(f4, t3, c3), r3.__e = r3.__ = null, t3.__e != o3 && C(t3)));
  $.__r = 0;
}
function I(n2, l3, u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, y2, w3, d3, g2, _2, m3 = t3 && t3.__k || v, b = l3.length;
  for (f4 = P(u4, l3, m3, f4, b), a3 = 0; a3 < b; a3++) null != (y2 = u4.__k[a3]) && (h3 = -1 == y2.__i ? p : m3[y2.__i] || p, y2.__i = a3, g2 = O(n2, y2, h3, i3, r3, o3, e3, f4, c3, s3), w3 = y2.__e, y2.ref && h3.ref != y2.ref && (h3.ref && B(h3.ref, null, y2), s3.push(y2.ref, y2.__c || w3, y2)), null == d3 && null != w3 && (d3 = w3), (_2 = !!(4 & y2.__u)) || h3.__k === y2.__k ? f4 = A(y2, f4, n2, _2) : "function" == typeof y2.type && void 0 !== g2 ? f4 = g2 : w3 && (f4 = w3.nextSibling), y2.__u &= -7);
  return u4.__e = d3, f4;
}
function P(n2, l3, u4, t3, i3) {
  var r3, o3, e3, f4, c3, s3 = u4.length, a3 = s3, h3 = 0;
  for (n2.__k = new Array(i3), r3 = 0; r3 < i3; r3++) null != (o3 = l3[r3]) && "boolean" != typeof o3 && "function" != typeof o3 ? ("string" == typeof o3 || "number" == typeof o3 || "bigint" == typeof o3 || o3.constructor == String ? o3 = n2.__k[r3] = m(null, o3, null, null, null) : w(o3) ? o3 = n2.__k[r3] = m(k, { children: o3 }, null, null, null) : null == o3.constructor && o3.__b > 0 ? o3 = n2.__k[r3] = m(o3.type, o3.props, o3.key, o3.ref ? o3.ref : null, o3.__v) : n2.__k[r3] = o3, f4 = r3 + h3, o3.__ = n2, o3.__b = n2.__b + 1, -1 != (c3 = o3.__i = L(o3, u4, f4, a3)) && (a3--, (e3 = u4[c3]) && (e3.__u |= 2)), null == e3 || null == e3.__v ? (-1 == c3 && (i3 > s3 ? h3-- : i3 < s3 && h3++), "function" != typeof o3.type && (o3.__u |= 4)) : c3 != f4 && (c3 == f4 - 1 ? h3-- : c3 == f4 + 1 ? h3++ : (c3 > f4 ? h3-- : h3++, o3.__u |= 4))) : n2.__k[r3] = null;
  if (a3) for (r3 = 0; r3 < s3; r3++) null != (e3 = u4[r3]) && 0 == (2 & e3.__u) && (e3.__e == t3 && (t3 = S(e3)), D(e3, e3));
  return t3;
}
function A(n2, l3, u4, t3) {
  var i3, r3;
  if ("function" == typeof n2.type) {
    for (i3 = n2.__k, r3 = 0; i3 && r3 < i3.length; r3++) i3[r3] && (i3[r3].__ = n2, l3 = A(i3[r3], l3, u4, t3));
    return l3;
  }
  n2.__e != l3 && (t3 && (l3 && n2.type && !l3.parentNode && (l3 = S(n2)), u4.insertBefore(n2.__e, l3 || null)), l3 = n2.__e);
  do {
    l3 = l3 && l3.nextSibling;
  } while (null != l3 && 8 == l3.nodeType);
  return l3;
}
function L(n2, l3, u4, t3) {
  var i3, r3, o3, e3 = n2.key, f4 = n2.type, c3 = l3[u4], s3 = null != c3 && 0 == (2 & c3.__u);
  if (null === c3 && null == e3 || s3 && e3 == c3.key && f4 == c3.type) return u4;
  if (t3 > (s3 ? 1 : 0)) {
    for (i3 = u4 - 1, r3 = u4 + 1; i3 >= 0 || r3 < l3.length; ) if (null != (c3 = l3[o3 = i3 >= 0 ? i3-- : r3++]) && 0 == (2 & c3.__u) && e3 == c3.key && f4 == c3.type) return o3;
  }
  return -1;
}
function T(n2, l3, u4) {
  "-" == l3[0] ? n2.setProperty(l3, null == u4 ? "" : u4) : n2[l3] = null == u4 ? "" : "number" != typeof u4 || y.test(l3) ? u4 : u4 + "px";
}
function j(n2, l3, u4, t3, i3) {
  var r3, o3;
  n: if ("style" == l3) if ("string" == typeof u4) n2.style.cssText = u4;
  else {
    if ("string" == typeof t3 && (n2.style.cssText = t3 = ""), t3) for (l3 in t3) u4 && l3 in u4 || T(n2.style, l3, "");
    if (u4) for (l3 in u4) t3 && u4[l3] == t3[l3] || T(n2.style, l3, u4[l3]);
  }
  else if ("o" == l3[0] && "n" == l3[1]) r3 = l3 != (l3 = l3.replace(f, "$1")), o3 = l3.toLowerCase(), l3 = o3 in n2 || "onFocusOut" == l3 || "onFocusIn" == l3 ? o3.slice(2) : l3.slice(2), n2.l || (n2.l = {}), n2.l[l3 + r3] = u4, u4 ? t3 ? u4.u = t3.u : (u4.u = c, n2.addEventListener(l3, r3 ? a : s, r3)) : n2.removeEventListener(l3, r3 ? a : s, r3);
  else {
    if ("http://www.w3.org/2000/svg" == i3) l3 = l3.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l3 && "height" != l3 && "href" != l3 && "list" != l3 && "form" != l3 && "tabIndex" != l3 && "download" != l3 && "rowSpan" != l3 && "colSpan" != l3 && "role" != l3 && "popover" != l3 && l3 in n2) try {
      n2[l3] = null == u4 ? "" : u4;
      break n;
    } catch (n3) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l3[4] ? n2.removeAttribute(l3) : n2.setAttribute(l3, "popover" == l3 && 1 == u4 ? "" : u4));
  }
}
function F(n2) {
  return function(u4) {
    if (this.l) {
      var t3 = this.l[u4.type + n2];
      if (null == u4.t) u4.t = c++;
      else if (u4.t < t3.u) return;
      return t3(l.event ? l.event(u4) : u4);
    }
  };
}
function O(n2, u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, p3, v3, y2, _2, m3, b, S2, C3, M2, $2, P2, A3, H, L2, T2, j3 = u4.type;
  if (null != u4.constructor) return null;
  128 & t3.__u && (c3 = !!(32 & t3.__u), o3 = [f4 = u4.__e = t3.__e]), (a3 = l.__b) && a3(u4);
  n: if ("function" == typeof j3) try {
    if (b = u4.props, S2 = "prototype" in j3 && j3.prototype.render, C3 = (a3 = j3.contextType) && i3[a3.__c], M2 = a3 ? C3 ? C3.props.value : a3.__ : i3, t3.__c ? m3 = (h3 = u4.__c = t3.__c).__ = h3.__E : (S2 ? u4.__c = h3 = new j3(b, M2) : (u4.__c = h3 = new x(b, M2), h3.constructor = j3, h3.render = E), C3 && C3.sub(h3), h3.state || (h3.state = {}), h3.__n = i3, p3 = h3.__d = true, h3.__h = [], h3._sb = []), S2 && null == h3.__s && (h3.__s = h3.state), S2 && null != j3.getDerivedStateFromProps && (h3.__s == h3.state && (h3.__s = d({}, h3.__s)), d(h3.__s, j3.getDerivedStateFromProps(b, h3.__s))), v3 = h3.props, y2 = h3.state, h3.__v = u4, p3) S2 && null == j3.getDerivedStateFromProps && null != h3.componentWillMount && h3.componentWillMount(), S2 && null != h3.componentDidMount && h3.__h.push(h3.componentDidMount);
    else {
      if (S2 && null == j3.getDerivedStateFromProps && b !== v3 && null != h3.componentWillReceiveProps && h3.componentWillReceiveProps(b, M2), u4.__v == t3.__v || !h3.__e && null != h3.shouldComponentUpdate && false === h3.shouldComponentUpdate(b, h3.__s, M2)) {
        for (u4.__v != t3.__v && (h3.props = b, h3.state = h3.__s, h3.__d = false), u4.__e = t3.__e, u4.__k = t3.__k, u4.__k.some(function(n3) {
          n3 && (n3.__ = u4);
        }), $2 = 0; $2 < h3._sb.length; $2++) h3.__h.push(h3._sb[$2]);
        h3._sb = [], h3.__h.length && e3.push(h3);
        break n;
      }
      null != h3.componentWillUpdate && h3.componentWillUpdate(b, h3.__s, M2), S2 && null != h3.componentDidUpdate && h3.__h.push(function() {
        h3.componentDidUpdate(v3, y2, _2);
      });
    }
    if (h3.context = M2, h3.props = b, h3.__P = n2, h3.__e = false, P2 = l.__r, A3 = 0, S2) {
      for (h3.state = h3.__s, h3.__d = false, P2 && P2(u4), a3 = h3.render(h3.props, h3.state, h3.context), H = 0; H < h3._sb.length; H++) h3.__h.push(h3._sb[H]);
      h3._sb = [];
    } else do {
      h3.__d = false, P2 && P2(u4), a3 = h3.render(h3.props, h3.state, h3.context), h3.state = h3.__s;
    } while (h3.__d && ++A3 < 25);
    h3.state = h3.__s, null != h3.getChildContext && (i3 = d(d({}, i3), h3.getChildContext())), S2 && !p3 && null != h3.getSnapshotBeforeUpdate && (_2 = h3.getSnapshotBeforeUpdate(v3, y2)), L2 = a3, null != a3 && a3.type === k && null == a3.key && (L2 = V(a3.props.children)), f4 = I(n2, w(L2) ? L2 : [L2], u4, t3, i3, r3, o3, e3, f4, c3, s3), h3.base = u4.__e, u4.__u &= -161, h3.__h.length && e3.push(h3), m3 && (h3.__E = h3.__ = null);
  } catch (n3) {
    if (u4.__v = null, c3 || null != o3) if (n3.then) {
      for (u4.__u |= c3 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o3[o3.indexOf(f4)] = null, u4.__e = f4;
    } else {
      for (T2 = o3.length; T2--; ) g(o3[T2]);
      z(u4);
    }
    else u4.__e = t3.__e, u4.__k = t3.__k, n3.then || z(u4);
    l.__e(n3, u4, t3);
  }
  else null == o3 && u4.__v == t3.__v ? (u4.__k = t3.__k, u4.__e = t3.__e) : f4 = u4.__e = q(t3.__e, u4, t3, i3, r3, o3, e3, c3, s3);
  return (a3 = l.diffed) && a3(u4), 128 & u4.__u ? void 0 : f4;
}
function z(n2) {
  n2 && n2.__c && (n2.__c.__e = true), n2 && n2.__k && n2.__k.forEach(z);
}
function N(n2, u4, t3) {
  for (var i3 = 0; i3 < t3.length; i3++) B(t3[i3], t3[++i3], t3[++i3]);
  l.__c && l.__c(u4, n2), n2.some(function(u5) {
    try {
      n2 = u5.__h, u5.__h = [], n2.some(function(n3) {
        n3.call(u5);
      });
    } catch (n3) {
      l.__e(n3, u5.__v);
    }
  });
}
function V(n2) {
  return "object" != typeof n2 || null == n2 || n2.__b && n2.__b > 0 ? n2 : w(n2) ? n2.map(V) : d({}, n2);
}
function q(u4, t3, i3, r3, o3, e3, f4, c3, s3) {
  var a3, h3, v3, y2, d3, _2, m3, b = i3.props || p, k3 = t3.props, x2 = t3.type;
  if ("svg" == x2 ? o3 = "http://www.w3.org/2000/svg" : "math" == x2 ? o3 = "http://www.w3.org/1998/Math/MathML" : o3 || (o3 = "http://www.w3.org/1999/xhtml"), null != e3) {
    for (a3 = 0; a3 < e3.length; a3++) if ((d3 = e3[a3]) && "setAttribute" in d3 == !!x2 && (x2 ? d3.localName == x2 : 3 == d3.nodeType)) {
      u4 = d3, e3[a3] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x2) return document.createTextNode(k3);
    u4 = document.createElementNS(o3, x2, k3.is && k3), c3 && (l.__m && l.__m(t3, e3), c3 = false), e3 = null;
  }
  if (null == x2) b === k3 || c3 && u4.data == k3 || (u4.data = k3);
  else {
    if (e3 = e3 && n.call(u4.childNodes), !c3 && null != e3) for (b = {}, a3 = 0; a3 < u4.attributes.length; a3++) b[(d3 = u4.attributes[a3]).name] = d3.value;
    for (a3 in b) if (d3 = b[a3], "children" == a3) ;
    else if ("dangerouslySetInnerHTML" == a3) v3 = d3;
    else if (!(a3 in k3)) {
      if ("value" == a3 && "defaultValue" in k3 || "checked" == a3 && "defaultChecked" in k3) continue;
      j(u4, a3, null, d3, o3);
    }
    for (a3 in k3) d3 = k3[a3], "children" == a3 ? y2 = d3 : "dangerouslySetInnerHTML" == a3 ? h3 = d3 : "value" == a3 ? _2 = d3 : "checked" == a3 ? m3 = d3 : c3 && "function" != typeof d3 || b[a3] === d3 || j(u4, a3, d3, b[a3], o3);
    if (h3) c3 || v3 && (h3.__html == v3.__html || h3.__html == u4.innerHTML) || (u4.innerHTML = h3.__html), t3.__k = [];
    else if (v3 && (u4.innerHTML = ""), I("template" == t3.type ? u4.content : u4, w(y2) ? y2 : [y2], t3, i3, r3, "foreignObject" == x2 ? "http://www.w3.org/1999/xhtml" : o3, e3, f4, e3 ? e3[0] : i3.__k && S(i3, 0), c3, s3), null != e3) for (a3 = e3.length; a3--; ) g(e3[a3]);
    c3 || (a3 = "value", "progress" == x2 && null == _2 ? u4.removeAttribute("value") : null != _2 && (_2 !== u4[a3] || "progress" == x2 && !_2 || "option" == x2 && _2 != b[a3]) && j(u4, a3, _2, b[a3], o3), a3 = "checked", null != m3 && m3 != u4[a3] && j(u4, a3, m3, b[a3], o3));
  }
  return u4;
}
function B(n2, u4, t3) {
  try {
    if ("function" == typeof n2) {
      var i3 = "function" == typeof n2.__u;
      i3 && n2.__u(), i3 && null == u4 || (n2.__u = n2(u4));
    } else n2.current = u4;
  } catch (n3) {
    l.__e(n3, t3);
  }
}
function D(n2, u4, t3) {
  var i3, r3;
  if (l.unmount && l.unmount(n2), (i3 = n2.ref) && (i3.current && i3.current != n2.__e || B(i3, null, u4)), null != (i3 = n2.__c)) {
    if (i3.componentWillUnmount) try {
      i3.componentWillUnmount();
    } catch (n3) {
      l.__e(n3, u4);
    }
    i3.base = i3.__P = null;
  }
  if (i3 = n2.__k) for (r3 = 0; r3 < i3.length; r3++) i3[r3] && D(i3[r3], u4, t3 || "function" != typeof n2.type);
  t3 || g(n2.__e), n2.__c = n2.__ = n2.__e = void 0;
}
function E(n2, l3, u4) {
  return this.constructor(n2, u4);
}
function G(u4, t3, i3) {
  var r3, o3, e3, f4;
  t3 == document && (t3 = document.documentElement), l.__ && l.__(u4, t3), o3 = (r3 = "function" == typeof i3) ? null : i3 && i3.__k || t3.__k, e3 = [], f4 = [], O(t3, u4 = (!r3 && i3 || t3).__k = _(k, null, [u4]), o3 || p, p, t3.namespaceURI, !r3 && i3 ? [i3] : o3 ? null : t3.firstChild ? n.call(t3.childNodes) : null, e3, !r3 && i3 ? i3 : o3 ? o3.__e : t3.firstChild, r3, f4), N(e3, u4, f4);
}
n = v.slice, l = { __e: function(n2, l3, u4, t3) {
  for (var i3, r3, o3; l3 = l3.__; ) if ((i3 = l3.__c) && !i3.__) try {
    if ((r3 = i3.constructor) && null != r3.getDerivedStateFromError && (i3.setState(r3.getDerivedStateFromError(n2)), o3 = i3.__d), null != i3.componentDidCatch && (i3.componentDidCatch(n2, t3 || {}), o3 = i3.__d), o3) return i3.__E = i3;
  } catch (l4) {
    n2 = l4;
  }
  throw n2;
} }, u = 0, t = function(n2) {
  return null != n2 && null == n2.constructor;
}, x.prototype.setState = function(n2, l3) {
  var u4;
  u4 = null != this.__s && this.__s != this.state ? this.__s : this.__s = d({}, this.state), "function" == typeof n2 && (n2 = n2(d({}, u4), this.props)), n2 && d(u4, n2), null != n2 && this.__v && (l3 && this._sb.push(l3), M(this));
}, x.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), M(this));
}, x.prototype.render = k, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n2, l3) {
  return n2.__v.__b - l3.__v.__b;
}, $.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = F(false), a = F(true), h = 0;

// ../../../../../node_modules/.pnpm/preact@10.28.0/node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function p2(n2, t3) {
  c2.__h && c2.__h(r2, n2, o2 || t3), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n2 >= u4.__.length && u4.__.push({}), u4.__[n2];
}
function d2(n2) {
  return o2 = 1, h2(D2, n2);
}
function h2(n2, u4, i3) {
  var o3 = p2(t2++, 2);
  if (o3.t = n2, !o3.__c && (o3.__ = [i3 ? i3(u4) : D2(void 0, u4), function(n3) {
    var t3 = o3.__N ? o3.__N[0] : o3.__[0], r3 = o3.t(t3, n3);
    t3 !== r3 && (o3.__N = [r3, o3.__[1]], o3.__c.setState({}));
  }], o3.__c = r2, !r2.__f)) {
    var f4 = function(n3, t3, r3) {
      if (!o3.__c.__H) return true;
      var u5 = o3.__c.__H.__.filter(function(n4) {
        return !!n4.__c;
      });
      if (u5.every(function(n4) {
        return !n4.__N;
      })) return !c3 || c3.call(this, n3, t3, r3);
      var i4 = o3.__c.props !== n3;
      return u5.forEach(function(n4) {
        if (n4.__N) {
          var t4 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t4 !== n4.__[0] && (i4 = true);
        }
      }), c3 && c3.call(this, n3, t3, r3) || i4;
    };
    r2.__f = true;
    var c3 = r2.shouldComponentUpdate, e3 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n3, t3, r3) {
      if (this.__e) {
        var u5 = c3;
        c3 = void 0, f4(n3, t3, r3), c3 = u5;
      }
      e3 && e3.call(this, n3, t3, r3);
    }, r2.shouldComponentUpdate = f4;
  }
  return o3.__N || o3.__;
}
function j2() {
  for (var n2; n2 = f2.shift(); ) if (n2.__P && n2.__H) try {
    n2.__H.__h.forEach(z2), n2.__H.__h.forEach(B2), n2.__H.__h = [];
  } catch (t3) {
    n2.__H.__h = [], c2.__e(t3, n2.__v);
  }
}
c2.__b = function(n2) {
  r2 = null, e2 && e2(n2);
}, c2.__ = function(n2, t3) {
  n2 && t3.__k && t3.__k.__m && (n2.__m = t3.__k.__m), s2 && s2(n2, t3);
}, c2.__r = function(n2) {
  a2 && a2(n2), t2 = 0;
  var i3 = (r2 = n2.__c).__H;
  i3 && (u2 === r2 ? (i3.__h = [], r2.__h = [], i3.__.forEach(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.u = n3.__N = void 0;
  })) : (i3.__h.forEach(z2), i3.__h.forEach(B2), i3.__h = [], t2 = 0)), u2 = r2;
}, c2.diffed = function(n2) {
  v2 && v2(n2);
  var t3 = n2.__c;
  t3 && t3.__H && (t3.__H.__h.length && (1 !== f2.push(t3) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t3.__H.__.forEach(function(n3) {
    n3.u && (n3.__H = n3.u), n3.u = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n2, t3) {
  t3.some(function(n3) {
    try {
      n3.__h.forEach(z2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B2(n4);
      });
    } catch (r3) {
      t3.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t3 = [], c2.__e(r3, n3.__v);
    }
  }), l2 && l2(n2, t3);
}, c2.unmount = function(n2) {
  m2 && m2(n2);
  var t3, r3 = n2.__c;
  r3 && r3.__H && (r3.__H.__.forEach(function(n3) {
    try {
      z2(n3);
    } catch (n4) {
      t3 = n4;
    }
  }), r3.__H = void 0, t3 && c2.__e(t3, r3.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n2) {
  var t3, r3 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t3), setTimeout(n2);
  }, u4 = setTimeout(r3, 35);
  k2 && (t3 = requestAnimationFrame(r3));
}
function z2(n2) {
  var t3 = r2, u4 = n2.__c;
  "function" == typeof u4 && (n2.__c = void 0, u4()), r2 = t3;
}
function B2(n2) {
  var t3 = r2;
  n2.__c = n2.__(), r2 = t3;
}
function D2(n2, t3) {
  return "function" == typeof t3 ? t3(n2) : t3;
}

// ../shared.ts
var idCounter = 1;
var A2 = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy"
];
var C2 = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange"
];
var N2 = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard"
];
function buildData(count) {
  let data = new Array(count);
  for (let i3 = 0; i3 < count; i3++) {
    data[i3] = {
      id: idCounter++,
      label: `${A2[i3 % A2.length]} ${C2[i3 % C2.length]} ${N2[i3 % N2.length]}`
    };
  }
  return data;
}
function get1000Rows() {
  return buildData(1e3);
}
function get10000Rows() {
  return buildData(1e4);
}
function updatedEvery10thRow(data) {
  let newData = data.slice(0);
  for (let i3 = 0, d3 = data, len = d3.length; i3 < len; i3 += 10) {
    newData[i3] = { id: data[i3].id, label: data[i3].label + " !!!" };
  }
  return newData;
}
function swapRows(data) {
  let d3 = data.slice();
  if (d3.length > 998) {
    let tmp = d3[1];
    d3[1] = d3[998];
    d3[998] = tmp;
  }
  return d3;
}
function remove(data, id) {
  return data.filter((d3) => d3.id !== id);
}
function sortRows(data, ascending = true) {
  let sorted = data.slice().sort((a3, b) => {
    if (ascending) {
      return a3.label.localeCompare(b.label);
    } else {
      return b.label.localeCompare(a3.label);
    }
  });
  return sorted;
}

// ../../../../../node_modules/.pnpm/preact@10.28.0/node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js
var f3 = 0;
function u3(e3, t3, n2, o3, i3, u4) {
  t3 || (t3 = {});
  var a3, c3, p3 = t3;
  if ("ref" in p3) for (c3 in p3 = {}, t3) "ref" == c3 ? a3 = t3[c3] : p3[c3] = t3[c3];
  var l3 = { type: e3, props: p3, key: n2, ref: a3, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --f3, __i: -1, __u: 0, __source: i3, __self: u4 };
  if ("function" == typeof e3 && (a3 = e3.defaultProps)) for (c3 in a3) void 0 === p3[c3] && (p3[c3] = a3[c3]);
  return l.vnode && l.vnode(l3), l3;
}

// index.tsx
var name = "preact";
function MetricCard({
  id,
  label,
  value,
  change
}) {
  let [selected, setSelected] = d2(false);
  let [hovered, setHovered] = d2(false);
  return /* @__PURE__ */ u3(
    "div",
    {
      class: `metric-card ${selected ? "selected" : ""}`,
      onClick: () => setSelected(!selected),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: (e3) => {
        e3.currentTarget.style.outline = "2px solid #222";
        e3.currentTarget.style.outlineOffset = "2px";
      },
      onBlur: (e3) => {
        e3.currentTarget.style.outline = "";
      },
      tabIndex: 0,
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        transform: hovered && !selected ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        cursor: "pointer",
        boxShadow: selected ? "0 4px 8px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)"
      },
      children: [
        /* @__PURE__ */ u3("div", { style: { fontSize: "14px", color: "#666", marginBottom: "8px" }, children: label }),
        /* @__PURE__ */ u3("div", { style: { fontSize: "24px", fontWeight: "bold", marginBottom: "4px" }, children: value }),
        /* @__PURE__ */ u3("div", { style: { fontSize: "12px", color: change.startsWith("+") ? "#28a745" : "#dc3545" }, children: change })
      ]
    }
  );
}
function ChartBar({ value, index }) {
  let [hovered, setHovered] = d2(false);
  return /* @__PURE__ */ u3(
    "div",
    {
      class: "chart-bar",
      style: {
        height: `${value}%`,
        backgroundColor: hovered ? "#286090" : "#337ab7",
        width: "30px",
        margin: "0 2px",
        cursor: "pointer",
        transition: "all 0.2s",
        opacity: hovered ? 0.9 : 1,
        transform: hovered ? "scaleY(1.1)" : "scaleY(1)"
      },
      onClick: () => {
      },
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: (e3) => {
        e3.currentTarget.style.outline = "2px solid #222";
        e3.currentTarget.style.outlineOffset = "2px";
      },
      onBlur: (e3) => {
        e3.currentTarget.style.outline = "";
      },
      tabIndex: 0
    }
  );
}
function ActivityItem({
  id,
  title,
  time,
  icon
}) {
  let [read, setRead] = d2(false);
  let [hovered, setHovered] = d2(false);
  return /* @__PURE__ */ u3(
    "li",
    {
      class: `activity-item ${read ? "read" : ""}`,
      onClick: () => setRead(!read),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        padding: "12px",
        borderBottom: "1px solid #eee",
        cursor: "pointer",
        backgroundColor: hovered ? "#f5f5f5" : read ? "rgba(245, 245, 245, 0.6)" : "#fff",
        display: "flex",
        alignItems: "center",
        gap: "12px"
      },
      children: [
        /* @__PURE__ */ u3(
          "span",
          {
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#337ab7",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold"
            },
            children: icon
          }
        ),
        /* @__PURE__ */ u3("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ u3("div", { style: { fontWeight: read ? "normal" : "bold" }, children: title }),
          /* @__PURE__ */ u3("div", { style: { fontSize: "12px", color: "#666" }, children: time })
        ] })
      ]
    }
  );
}
function DropdownMenu({ rowId }) {
  let [open, setOpen] = d2(false);
  let [hovered, setHovered] = d2(false);
  let actions = ["View Details", "Edit", "Duplicate", "Archive", "Delete"];
  return /* @__PURE__ */ u3("div", { style: { position: "relative", display: "inline-block" }, children: [
    /* @__PURE__ */ u3(
      "button",
      {
        class: "btn btn-primary",
        onClick: (e3) => {
          e3.stopPropagation();
          setOpen(!open);
        },
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: (e3) => {
          e3.currentTarget.style.outline = "2px solid #222";
          e3.currentTarget.style.outlineOffset = "2px";
        },
        onBlur: (e3) => {
          e3.currentTarget.style.outline = "";
        },
        style: {
          padding: "4px 8px",
          fontSize: "12px",
          backgroundColor: hovered ? "#286090" : "#337ab7"
        },
        children: "\u22EE"
      }
    ),
    open && /* @__PURE__ */ u3(
      "div",
      {
        style: {
          position: "absolute",
          top: "100%",
          right: 0,
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          borderRadius: "4px",
          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          zIndex: 1e3,
          minWidth: "150px",
          marginTop: "4px"
        },
        onMouseLeave: () => setOpen(false),
        children: actions.map((action, idx) => /* @__PURE__ */ u3(
          "div",
          {
            onClick: (e3) => {
              e3.stopPropagation();
              setOpen(false);
            },
            onMouseEnter: (e3) => {
              e3.currentTarget.style.backgroundColor = "#f5f5f5";
            },
            onMouseLeave: (e3) => {
              e3.currentTarget.style.backgroundColor = "#fff";
            },
            style: {
              padding: "8px 12px",
              cursor: "pointer",
              borderBottom: idx < actions.length - 1 ? "1px solid #eee" : "none"
            },
            children: action
          },
          idx
        ))
      }
    )
  ] });
}
function DashboardTableRow({ row }) {
  let [hovered, setHovered] = d2(false);
  let [selected, setSelected] = d2(false);
  return /* @__PURE__ */ u3(
    "tr",
    {
      class: selected ? "danger" : "",
      onClick: () => setSelected(!selected),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        backgroundColor: hovered ? "#f5f5f5" : "#fff",
        cursor: "pointer"
      },
      children: [
        /* @__PURE__ */ u3("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.id }),
        /* @__PURE__ */ u3("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: row.label }),
        /* @__PURE__ */ u3("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ u3("span", { style: { color: "#28a745" }, children: "Active" }) }),
        /* @__PURE__ */ u3("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: [
          "$",
          (row.id * 10.5).toFixed(2)
        ] }),
        /* @__PURE__ */ u3("td", { style: { padding: "12px", borderTop: "1px solid #ddd" }, children: /* @__PURE__ */ u3(DropdownMenu, { rowId: row.id }) })
      ]
    }
  );
}
function SearchInput() {
  let [value, setValue] = d2("");
  let [focused, setFocused] = d2(false);
  return /* @__PURE__ */ u3(
    "input",
    {
      type: "text",
      placeholder: "Search...",
      value,
      onInput: (e3) => setValue(e3.target.value),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        padding: "8px 12px",
        border: `1px solid ${focused ? "#337ab7" : "#ddd"}`,
        borderRadius: "4px",
        fontSize: "14px",
        width: "300px",
        outline: focused ? "2px solid #337ab7" : "none",
        outlineOffset: "2px"
      }
    }
  );
}
function FormWidgets() {
  let [selectValue, setSelectValue] = d2("option1");
  let [checkboxValues, setCheckboxValues] = d2(/* @__PURE__ */ new Set());
  let [radioValue, setRadioValue] = d2("radio1");
  let [toggleValue, setToggleValue] = d2(false);
  let [progressValue, setProgressValue] = d2(45);
  return /* @__PURE__ */ u3("div", { style: { padding: "20px", backgroundColor: "#f9f9f9", borderRadius: "8px" }, children: [
    /* @__PURE__ */ u3("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Settings" }),
    /* @__PURE__ */ u3("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ u3("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Select Option" }),
      /* @__PURE__ */ u3(
        "select",
        {
          value: selectValue,
          onChange: (e3) => setSelectValue(e3.target.value),
          onFocus: (e3) => {
            e3.currentTarget.style.borderColor = "#337ab7";
            e3.currentTarget.style.outline = "2px solid #337ab7";
            e3.currentTarget.style.outlineOffset = "2px";
          },
          onBlur: (e3) => {
            e3.currentTarget.style.borderColor = "#ddd";
            e3.currentTarget.style.outline = "none";
          },
          style: {
            padding: "6px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "14px",
            width: "100%"
          },
          children: [
            /* @__PURE__ */ u3("option", { value: "option1", children: "Option 1" }),
            /* @__PURE__ */ u3("option", { value: "option2", children: "Option 2" }),
            /* @__PURE__ */ u3("option", { value: "option3", children: "Option 3" }),
            /* @__PURE__ */ u3("option", { value: "option4", children: "Option 4" })
          ]
        }
      )
    ] }),
    ["Checkbox 1", "Checkbox 2", "Checkbox 3"].map((label, idx) => /* @__PURE__ */ u3(
      "div",
      {
        style: { marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" },
        children: [
          /* @__PURE__ */ u3(
            "input",
            {
              type: "checkbox",
              id: `checkbox-${idx}`,
              checked: checkboxValues.has(`checkbox-${idx}`),
              onChange: (e3) => {
                let next = new Set(checkboxValues);
                if (e3.target.checked) {
                  next.add(`checkbox-${idx}`);
                } else {
                  next.delete(`checkbox-${idx}`);
                }
                setCheckboxValues(next);
              },
              onFocus: (e3) => {
                e3.currentTarget.style.outline = "2px solid #337ab7";
                e3.currentTarget.style.outlineOffset = "2px";
              },
              onBlur: (e3) => {
                e3.currentTarget.style.outline = "";
              }
            }
          ),
          /* @__PURE__ */ u3("label", { htmlFor: `checkbox-${idx}`, style: { fontSize: "14px", cursor: "pointer" }, children: label })
        ]
      },
      idx
    )),
    /* @__PURE__ */ u3("div", { style: { marginBottom: "16px" }, children: ["Radio 1", "Radio 2", "Radio 3"].map((label, idx) => /* @__PURE__ */ u3("label", { style: { display: "block", marginBottom: "8px", cursor: "pointer" }, children: [
      /* @__PURE__ */ u3(
        "input",
        {
          type: "radio",
          name: "radio-group",
          value: `radio${idx + 1}`,
          checked: radioValue === `radio${idx + 1}`,
          onChange: (e3) => setRadioValue(e3.target.value),
          onFocus: (e3) => {
            e3.currentTarget.style.outline = "2px solid #337ab7";
            e3.currentTarget.style.outlineOffset = "2px";
          },
          onBlur: (e3) => {
            e3.currentTarget.style.outline = "";
          },
          style: { marginRight: "8px" }
        }
      ),
      label
    ] }, idx)) }),
    /* @__PURE__ */ u3("div", { style: { marginBottom: "16px" }, children: [
      /* @__PURE__ */ u3("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Toggle Switch" }),
      /* @__PURE__ */ u3(
        "label",
        {
          style: {
            display: "inline-block",
            position: "relative",
            width: "50px",
            height: "24px",
            cursor: "pointer"
          },
          children: [
            /* @__PURE__ */ u3(
              "input",
              {
                type: "checkbox",
                checked: toggleValue,
                onChange: (e3) => setToggleValue(e3.target.checked),
                onFocus: (e3) => {
                  e3.currentTarget.style.outline = "2px solid #222";
                  e3.currentTarget.style.outlineOffset = "2px";
                },
                onBlur: (e3) => {
                  e3.currentTarget.style.outline = "";
                },
                style: { opacity: 0, width: 0, height: 0 }
              }
            ),
            /* @__PURE__ */ u3(
              "span",
              {
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: toggleValue ? "#337ab7" : "#ccc",
                  borderRadius: "24px",
                  transition: "background-color 0.3s"
                },
                children: /* @__PURE__ */ u3(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      backgroundColor: "#fff",
                      borderRadius: "50%",
                      transition: "transform 0.3s",
                      transform: toggleValue ? "translateX(26px)" : "translateX(0)"
                    }
                  }
                )
              }
            )
          ]
        }
      )
    ] }),
    /* @__PURE__ */ u3("div", { children: [
      /* @__PURE__ */ u3("label", { style: { display: "block", marginBottom: "4px", fontSize: "14px" }, children: "Progress Bar" }),
      /* @__PURE__ */ u3(
        "div",
        {
          style: {
            width: "100%",
            height: "24px",
            backgroundColor: "#eee",
            borderRadius: "4px",
            overflow: "hidden",
            position: "relative"
          },
          children: /* @__PURE__ */ u3(
            "div",
            {
              style: {
                width: `${progressValue}%`,
                height: "100%",
                backgroundColor: "#337ab7",
                transition: "width 0.3s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "12px"
              },
              children: [
                progressValue,
                "%"
              ]
            }
          )
        }
      )
    ] })
  ] });
}
function Dashboard({ onSwitchToTable }) {
  let [dashboardRows, setDashboardRows] = d2(() => buildData(300));
  let sortDashboardAsc = () => {
    setDashboardRows((current) => sortRows(current, true));
  };
  let sortDashboardDesc = () => {
    setDashboardRows((current) => sortRows(current, false));
  };
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84];
  let activities = Array.from({ length: 50 }, (_2, i3) => ({
    id: i3 + 1,
    title: `Activity ${i3 + 1}: ${["Order placed", "Payment received", "Shipment created", "Customer registered", "Product updated"][i3 % 5]}`,
    time: `${i3 + 1} ${i3 === 0 ? "minute" : "minutes"} ago`,
    icon: ["O", "P", "S", "C", "U"][i3 % 5]
  }));
  return /* @__PURE__ */ u3("div", { class: "container", style: { maxWidth: "1400px" }, children: [
    /* @__PURE__ */ u3(
      "div",
      {
        style: {
          display: "flex",
          marginBottom: "20px",
          alignItems: "center",
          justifyContent: "space-between"
        },
        children: [
          /* @__PURE__ */ u3("h1", { style: { margin: 0 }, children: "Dashboard" }),
          /* @__PURE__ */ u3(
            "button",
            {
              id: "switchToTable",
              class: "btn btn-primary",
              type: "button",
              onClick: onSwitchToTable,
              onFocus: (e3) => {
                e3.currentTarget.style.outline = "2px solid #222";
                e3.currentTarget.style.outlineOffset = "2px";
              },
              onBlur: (e3) => {
                e3.currentTarget.style.outline = "";
              },
              children: "Switch to Table"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ u3("div", { style: { display: "flex", gap: "20px", marginBottom: "20px" }, children: /* @__PURE__ */ u3("div", { style: { flex: 1, display: "flex", gap: "16px" }, children: [
      /* @__PURE__ */ u3(MetricCard, { id: 1, label: "Total Sales", value: "$125,430", change: "+12.5%" }),
      /* @__PURE__ */ u3(MetricCard, { id: 2, label: "Orders", value: "1,234", change: "+8.2%" }),
      /* @__PURE__ */ u3(MetricCard, { id: 3, label: "Customers", value: "5,678", change: "+15.3%" }),
      /* @__PURE__ */ u3(MetricCard, { id: 4, label: "Revenue", value: "$89,123", change: "+9.7%" })
    ] }) }),
    /* @__PURE__ */ u3(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px"
        },
        children: [
          /* @__PURE__ */ u3(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ u3("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Sales Performance" }),
                /* @__PURE__ */ u3(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-around",
                      height: "200px",
                      padding: "20px 0"
                    },
                    children: chartData.map((value, index) => /* @__PURE__ */ u3(ChartBar, { value, index }, index))
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ u3(
            "div",
            {
              style: {
                padding: "20px",
                backgroundColor: "#fff",
                border: "1px solid #ddd",
                borderRadius: "8px"
              },
              children: [
                /* @__PURE__ */ u3("h3", { style: { marginTop: 0, marginBottom: "16px" }, children: "Recent Activity" }),
                /* @__PURE__ */ u3(
                  "ul",
                  {
                    style: {
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      maxHeight: "200px",
                      overflowY: "auto"
                    },
                    children: activities.map((activity) => /* @__PURE__ */ u3(ActivityItem, { ...activity }, activity.id))
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ u3("div", { style: { marginBottom: "20px" }, children: [
      /* @__PURE__ */ u3(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          },
          children: [
            /* @__PURE__ */ u3("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
              /* @__PURE__ */ u3("h3", { style: { margin: 0 }, children: "Dashboard Items" }),
              /* @__PURE__ */ u3(
                "button",
                {
                  id: "sortDashboardAsc",
                  class: "btn btn-primary",
                  type: "button",
                  onClick: sortDashboardAsc,
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2191"
                }
              ),
              /* @__PURE__ */ u3(
                "button",
                {
                  id: "sortDashboardDesc",
                  class: "btn btn-primary",
                  type: "button",
                  onClick: sortDashboardDesc,
                  style: { padding: "4px 8px", fontSize: "12px" },
                  children: "Sort \u2193"
                }
              )
            ] }),
            /* @__PURE__ */ u3(SearchInput, {})
          ]
        }
      ),
      /* @__PURE__ */ u3(
        "div",
        {
          style: {
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden"
          },
          children: /* @__PURE__ */ u3("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [
            /* @__PURE__ */ u3("thead", { children: /* @__PURE__ */ u3("tr", { style: { backgroundColor: "#f5f5f5" }, children: [
              /* @__PURE__ */ u3("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "ID" }),
              /* @__PURE__ */ u3("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Label" }),
              /* @__PURE__ */ u3("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Status" }),
              /* @__PURE__ */ u3("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Value" }),
              /* @__PURE__ */ u3("th", { style: { padding: "12px", textAlign: "left", borderBottom: "2px solid #ddd" }, children: "Actions" })
            ] }) }),
            /* @__PURE__ */ u3("tbody", { children: dashboardRows.map((row) => /* @__PURE__ */ u3(DashboardTableRow, { row }, row.id)) })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ u3(FormWidgets, {})
  ] });
}
function App() {
  let [rows, setRows] = d2([]);
  let [selected, setSelected] = d2(null);
  let [view, setView] = d2("table");
  let run = () => {
    setRows(get1000Rows());
    setSelected(null);
  };
  let runLots = () => {
    setRows(get10000Rows());
    setSelected(null);
  };
  let add = () => {
    setRows((current) => [...current, ...get1000Rows()]);
  };
  let update = () => {
    setRows((current) => updatedEvery10thRow(current));
  };
  let clear = () => {
    setRows([]);
    setSelected(null);
  };
  let swap = () => {
    setRows((current) => swapRows(current));
  };
  let removeRow = (id) => {
    setRows((current) => remove(current, id));
  };
  let sortAsc = () => {
    setRows((current) => sortRows(current, true));
  };
  let sortDesc = () => {
    setRows((current) => sortRows(current, false));
  };
  let switchToDashboard = () => {
    setView("dashboard");
  };
  let switchToTable = () => {
    setView("table");
  };
  if (view === "dashboard") {
    return /* @__PURE__ */ u3(Dashboard, { onSwitchToTable: switchToTable });
  }
  return /* @__PURE__ */ u3("div", { class: "container", children: [
    /* @__PURE__ */ u3("div", { class: "jumbotron", children: /* @__PURE__ */ u3("div", { class: "row", children: [
      /* @__PURE__ */ u3("div", { class: "col-md-6", children: /* @__PURE__ */ u3("h1", { children: "Preact" }) }),
      /* @__PURE__ */ u3("div", { class: "col-md-6", children: /* @__PURE__ */ u3("div", { class: "row", children: [
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3("button", { id: "run", class: "btn btn-primary btn-block", type: "button", onClick: run, children: "Create 1,000 rows" }) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "runlots",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: runLots,
            children: "Create 10,000 rows"
          }
        ) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3("button", { id: "add", class: "btn btn-primary btn-block", type: "button", onClick: add, children: "Append 1,000 rows" }) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "update",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: update,
            children: "Update every 10th row"
          }
        ) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3("button", { id: "clear", class: "btn btn-primary btn-block", type: "button", onClick: clear, children: "Clear" }) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "swaprows",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: swap,
            children: "Swap Rows"
          }
        ) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "sortasc",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: sortAsc,
            children: "Sort Ascending"
          }
        ) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "sortdesc",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: sortDesc,
            children: "Sort Descending"
          }
        ) }),
        /* @__PURE__ */ u3("div", { class: "col-sm-6 smallpad", children: /* @__PURE__ */ u3(
          "button",
          {
            id: "switchToDashboard",
            class: "btn btn-primary btn-block",
            type: "button",
            onClick: switchToDashboard,
            children: "Switch to Dashboard"
          }
        ) })
      ] }) })
    ] }) }),
    /* @__PURE__ */ u3("table", { class: "table table-hover table-striped test-data", children: /* @__PURE__ */ u3("tbody", { children: rows.map((row) => {
      let rowId = row.id;
      return /* @__PURE__ */ u3("tr", { class: selected === rowId ? "danger" : "", children: [
        /* @__PURE__ */ u3("td", { class: "col-md-1", children: rowId }),
        /* @__PURE__ */ u3("td", { class: "col-md-4", children: /* @__PURE__ */ u3(
          "a",
          {
            href: "#",
            onClick: (event) => {
              event.preventDefault();
              setSelected(rowId);
            },
            children: row.label
          }
        ) }),
        /* @__PURE__ */ u3("td", { class: "col-md-1", children: /* @__PURE__ */ u3(
          "a",
          {
            href: "#",
            onClick: (event) => {
              event.preventDefault();
              removeRow(rowId);
            },
            children: /* @__PURE__ */ u3("span", { class: "glyphicon glyphicon-remove", "aria-hidden": "true" })
          }
        ) }),
        /* @__PURE__ */ u3("td", { class: "col-md-6" })
      ] }, rowId);
    }) }) }),
    /* @__PURE__ */ u3("span", { class: "preloadicon glyphicon glyphicon-remove", "aria-hidden": "true" })
  ] });
}
var el = document.getElementById("app");
G(/* @__PURE__ */ u3(App, {}), el);
export {
  name
};
