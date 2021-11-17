import {
  __commonJS,
  __toModule,
  init_react,
  require_react
} from "/build/_shared/chunk-E7VMOUYL.js";

// node_modules/history/umd/history.development.js
var require_history_development = __commonJS({
  "node_modules/history/umd/history.development.js"(exports, module) {
    init_react();
    "use strict";
    (function(l, y) {
      typeof exports === "object" && typeof module !== "undefined" ? y(exports) : typeof define === "function" && define.amd ? define(["exports"], y) : (l = typeof globalThis !== "undefined" ? globalThis : l || self, y(l.HistoryLibrary = {}));
    })(exports, function(l) {
      function y() {
        y = Object.assign || function(b) {
          for (var g = 1; g < arguments.length; g++) {
            var h = arguments[g], t;
            for (t in h)
              Object.prototype.hasOwnProperty.call(h, t) && (b[t] = h[t]);
          }
          return b;
        };
        return y.apply(this, arguments);
      }
      function C(b, g) {
        if (!b) {
          typeof console !== "undefined" && console.warn(g);
          try {
            throw Error(g);
          } catch (h) {
          }
        }
      }
      function H(b) {
        b.preventDefault();
        b.returnValue = "";
      }
      function D() {
        var b = [];
        return { get length() {
          return b.length;
        }, push: function(g) {
          b.push(g);
          return function() {
            b = b.filter(function(h) {
              return h !== g;
            });
          };
        }, call: function(g) {
          b.forEach(function(h) {
            return h && h(g);
          });
        } };
      }
      function I() {
        return Math.random().toString(36).substr(2, 8);
      }
      function E(b) {
        var g = b.pathname, h = b.search;
        b = b.hash;
        return (g === void 0 ? "/" : g) + (h === void 0 ? "" : h) + (b === void 0 ? "" : b);
      }
      function F(b) {
        var g = {};
        if (b) {
          var h = b.indexOf("#");
          0 <= h && (g.hash = b.substr(h), b = b.substr(0, h));
          h = b.indexOf("?");
          0 <= h && (g.search = b.substr(h), b = b.substr(0, h));
          b && (g.pathname = b);
        }
        return g;
      }
      l.Action = void 0;
      (function(b) {
        b.Pop = "POP";
        b.Push = "PUSH";
        b.Replace = "REPLACE";
      })(l.Action || (l.Action = {}));
      l.createBrowserHistory = function(b) {
        function g() {
          var c = q.location, a = n.state || {};
          return [a.idx, Object.freeze({ pathname: c.pathname, search: c.search, hash: c.hash, state: a.usr || null, key: a.key || "default" })];
        }
        function h(c) {
          return typeof c === "string" ? c : E(c);
        }
        function t(c, a) {
          a === void 0 && (a = null);
          return Object.freeze(y({ pathname: r.pathname, hash: "", search: "" }, typeof c === "string" ? F(c) : c, { state: a, key: I() }));
        }
        function A(c) {
          u = c;
          c = g();
          w = c[0];
          r = c[1];
          d.call({ action: u, location: r });
        }
        function B(c, a) {
          function e() {
            B(c, a);
          }
          var m = l.Action.Push, k = t(c, a);
          if (!f.length || (f.call({ action: m, location: k, retry: e }), false)) {
            var p = [{ usr: k.state, key: k.key, idx: w + 1 }, h(k)];
            k = p[0];
            p = p[1];
            try {
              n.pushState(k, "", p);
            } catch (G) {
              q.location.assign(p);
            }
            A(m);
          }
        }
        function z(c, a) {
          function e() {
            z(c, a);
          }
          var m = l.Action.Replace, k = t(c, a);
          f.length && (f.call({ action: m, location: k, retry: e }), 1) || (k = [{ usr: k.state, key: k.key, idx: w }, h(k)], n.replaceState(k[0], "", k[1]), A(m));
        }
        function x(c) {
          n.go(c);
        }
        b === void 0 && (b = {});
        b = b.window;
        var q = b === void 0 ? document.defaultView : b, n = q.history, v = null;
        q.addEventListener("popstate", function() {
          if (v)
            f.call(v), v = null;
          else {
            var c = l.Action.Pop, a = g(), e = a[0];
            a = a[1];
            if (f.length)
              if (e != null) {
                var m = w - e;
                m && (v = { action: c, location: a, retry: function() {
                  x(-1 * m);
                } }, x(m));
              } else
                C(false, "You are trying to block a POP navigation to a location that was not created by the history library. The block will fail silently in production, but in general you should do all navigation with the history library (instead of using window.history.pushState directly) to avoid this situation.");
            else
              A(c);
          }
        });
        var u = l.Action.Pop;
        b = g();
        var w = b[0], r = b[1], d = D(), f = D();
        w == null && (w = 0, n.replaceState(y({}, n.state, { idx: w }), ""));
        return { get action() {
          return u;
        }, get location() {
          return r;
        }, createHref: h, push: B, replace: z, go: x, back: function() {
          x(-1);
        }, forward: function() {
          x(1);
        }, listen: function(c) {
          return d.push(c);
        }, block: function(c) {
          var a = f.push(c);
          f.length === 1 && q.addEventListener("beforeunload", H);
          return function() {
            a();
            f.length || q.removeEventListener("beforeunload", H);
          };
        } };
      };
      l.createHashHistory = function(b) {
        function g() {
          var a = F(n.location.hash.substr(1)), e = a.pathname, m = a.search;
          a = a.hash;
          var k = v.state || {};
          return [k.idx, Object.freeze({ pathname: e === void 0 ? "/" : e, search: m === void 0 ? "" : m, hash: a === void 0 ? "" : a, state: k.usr || null, key: k.key || "default" })];
        }
        function h() {
          if (u)
            c.call(u), u = null;
          else {
            var a = l.Action.Pop, e = g(), m = e[0];
            e = e[1];
            if (c.length)
              if (m != null) {
                var k = r - m;
                k && (u = { action: a, location: e, retry: function() {
                  q(-1 * k);
                } }, q(k));
              } else
                C(false, "You are trying to block a POP navigation to a location that was not created by the history library. The block will fail silently in production, but in general you should do all navigation with the history library (instead of using window.history.pushState directly) to avoid this situation.");
            else
              B(a);
          }
        }
        function t(a) {
          var e = document.querySelector("base"), m = "";
          e && e.getAttribute("href") && (e = n.location.href, m = e.indexOf("#"), m = m === -1 ? e : e.slice(0, m));
          return m + "#" + (typeof a === "string" ? a : E(a));
        }
        function A(a, e) {
          e === void 0 && (e = null);
          return Object.freeze(y({ pathname: d.pathname, hash: "", search: "" }, typeof a === "string" ? F(a) : a, { state: e, key: I() }));
        }
        function B(a) {
          w = a;
          a = g();
          r = a[0];
          d = a[1];
          f.call({ action: w, location: d });
        }
        function z(a, e) {
          function m() {
            z(a, e);
          }
          var k = l.Action.Push, p = A(a, e);
          C(p.pathname.charAt(0) === "/", "Relative pathnames are not supported in hash history.push(" + JSON.stringify(a) + ")");
          if (!c.length || (c.call({ action: k, location: p, retry: m }), false)) {
            var G = [{ usr: p.state, key: p.key, idx: r + 1 }, t(p)];
            p = G[0];
            G = G[1];
            try {
              v.pushState(p, "", G);
            } catch (J) {
              n.location.assign(G);
            }
            B(k);
          }
        }
        function x(a, e) {
          function m() {
            x(a, e);
          }
          var k = l.Action.Replace, p = A(a, e);
          C(p.pathname.charAt(0) === "/", "Relative pathnames are not supported in hash history.replace(" + JSON.stringify(a) + ")");
          c.length && (c.call({ action: k, location: p, retry: m }), 1) || (p = [{ usr: p.state, key: p.key, idx: r }, t(p)], v.replaceState(p[0], "", p[1]), B(k));
        }
        function q(a) {
          v.go(a);
        }
        b === void 0 && (b = {});
        b = b.window;
        var n = b === void 0 ? document.defaultView : b, v = n.history, u = null;
        n.addEventListener("popstate", h);
        n.addEventListener("hashchange", function() {
          var a = g()[1];
          E(a) !== E(d) && h();
        });
        var w = l.Action.Pop;
        b = g();
        var r = b[0], d = b[1], f = D(), c = D();
        r == null && (r = 0, v.replaceState(y({}, v.state, { idx: r }), ""));
        return {
          get action() {
            return w;
          },
          get location() {
            return d;
          },
          createHref: t,
          push: z,
          replace: x,
          go: q,
          back: function() {
            q(-1);
          },
          forward: function() {
            q(1);
          },
          listen: function(a) {
            return f.push(a);
          },
          block: function(a) {
            var e = c.push(a);
            c.length === 1 && n.addEventListener("beforeunload", H);
            return function() {
              e();
              c.length || n.removeEventListener("beforeunload", H);
            };
          }
        };
      };
      l.createMemoryHistory = function(b) {
        function g(d, f) {
          f === void 0 && (f = null);
          return Object.freeze(y({ pathname: u.pathname, search: "", hash: "" }, typeof d === "string" ? F(d) : d, { state: f, key: I() }));
        }
        function h(d, f, c) {
          return !r.length || (r.call({ action: d, location: f, retry: c }), false);
        }
        function t(d, f) {
          v = d;
          u = f;
          w.call({ action: v, location: u });
        }
        function A(d, f) {
          var c = l.Action.Push, a = g(d, f);
          C(u.pathname.charAt(0) === "/", "Relative pathnames are not supported in memory history.push(" + JSON.stringify(d) + ")");
          h(c, a, function() {
            A(d, f);
          }) && (n += 1, q.splice(n, q.length, a), t(c, a));
        }
        function B(d, f) {
          var c = l.Action.Replace, a = g(d, f);
          C(u.pathname.charAt(0) === "/", "Relative pathnames are not supported in memory history.replace(" + JSON.stringify(d) + ")");
          h(c, a, function() {
            B(d, f);
          }) && (q[n] = a, t(c, a));
        }
        function z(d) {
          var f = Math.min(Math.max(n + d, 0), q.length - 1), c = l.Action.Pop, a = q[f];
          h(c, a, function() {
            z(d);
          }) && (n = f, t(c, a));
        }
        b === void 0 && (b = {});
        var x = b;
        b = x.initialEntries;
        x = x.initialIndex;
        var q = (b === void 0 ? ["/"] : b).map(function(d) {
          var f = Object.freeze(y({ pathname: "/", search: "", hash: "", state: null, key: I() }, typeof d === "string" ? F(d) : d));
          C(f.pathname.charAt(0) === "/", "Relative pathnames are not supported in createMemoryHistory({ initialEntries }) (invalid entry: " + JSON.stringify(d) + ")");
          return f;
        }), n = Math.min(Math.max(x == null ? q.length - 1 : x, 0), q.length - 1), v = l.Action.Pop, u = q[n], w = D(), r = D();
        return { get index() {
          return n;
        }, get action() {
          return v;
        }, get location() {
          return u;
        }, createHref: function(d) {
          return typeof d === "string" ? d : E(d);
        }, push: A, replace: B, go: z, back: function() {
          z(-1);
        }, forward: function() {
          z(1);
        }, listen: function(d) {
          return w.push(d);
        }, block: function(d) {
          return r.push(d);
        } };
      };
      l.createPath = E;
      l.parsePath = F;
      Object.defineProperty(l, "__esModule", { value: true });
    });
  }
});

// node_modules/history/main.js
var require_main = __commonJS({
  "node_modules/history/main.js"(exports, module) {
    init_react();
    "use strict";
    module.exports = false ? null : require_history_development();
  }
});

// node_modules/react-router/umd/react-router.development.js
var require_react_router_development = __commonJS({
  "node_modules/react-router/umd/react-router.development.js"(exports, module) {
    init_react();
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_react(), require_main()) : typeof define === "function" && define.amd ? define(["exports", "react", "history"], factory) : (global = global || self, factory(global.ReactRouter = {}, global.React, global.HistoryLibrary));
    })(exports, function(exports2, React2, history) {
      "use strict";
      function invariant2(cond, message) {
        if (!cond)
          throw new Error(message);
      }
      function warning(cond, message) {
        if (!cond) {
          if (typeof console !== "undefined")
            console.warn(message);
          try {
            throw new Error(message);
          } catch (e) {
          }
        }
      }
      const alreadyWarned = {};
      function warningOnce(key, cond, message) {
        if (!cond && !alreadyWarned[key]) {
          alreadyWarned[key] = true;
          warning(false, message);
        }
      }
      const NavigationContext = /* @__PURE__ */ React2.createContext(null);
      {
        NavigationContext.displayName = "Navigation";
      }
      const LocationContext = /* @__PURE__ */ React2.createContext(null);
      {
        LocationContext.displayName = "Location";
      }
      const RouteContext = /* @__PURE__ */ React2.createContext({
        outlet: null,
        matches: []
      });
      {
        RouteContext.displayName = "Route";
      }
      function MemoryRouter(_ref) {
        let {
          basename,
          children,
          initialEntries,
          initialIndex
        } = _ref;
        let historyRef = React2.useRef();
        if (historyRef.current == null) {
          historyRef.current = history.createMemoryHistory({
            initialEntries,
            initialIndex
          });
        }
        let history$1 = historyRef.current;
        let [state, setState] = React2.useState({
          action: history$1.action,
          location: history$1.location
        });
        React2.useLayoutEffect(() => history$1.listen(setState), [history$1]);
        return /* @__PURE__ */ React2.createElement(Router2, {
          basename,
          children,
          location: state.location,
          navigationType: state.action,
          navigator: history$1
        });
      }
      function Navigate(_ref2) {
        let {
          to,
          replace,
          state
        } = _ref2;
        !useInRouterContext() ? invariant2(false, "<Navigate> may be used only in the context of a <Router> component.") : void 0;
        warning(!React2.useContext(NavigationContext).static, "<Navigate> must not be used on the initial render in a <StaticRouter>. This is a no-op, but you should modify your code so the <Navigate> is only ever rendered in response to some user interaction or state change.");
        let navigate = useNavigate2();
        React2.useEffect(() => {
          navigate(to, {
            replace,
            state
          });
        });
        return null;
      }
      function Outlet2(_props) {
        return useOutlet();
      }
      function Route(_props) {
        invariant2(false, "A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.");
      }
      function Router2(_ref3) {
        let {
          basename: basenameProp = "/",
          children = null,
          location: locationProp,
          navigationType = history.Action.Pop,
          navigator,
          static: staticProp = false
        } = _ref3;
        !!useInRouterContext() ? invariant2(false, "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.") : void 0;
        let basename = normalizePathname(basenameProp);
        let navigationContext = React2.useMemo(() => ({
          basename,
          navigator,
          static: staticProp
        }), [basename, navigator, staticProp]);
        if (typeof locationProp === "string") {
          locationProp = history.parsePath(locationProp);
        }
        let {
          pathname = "/",
          search = "",
          hash = "",
          state = null,
          key = "default"
        } = locationProp;
        let location = React2.useMemo(() => {
          let trailingPathname = stripBasename(pathname, basename);
          if (trailingPathname == null) {
            return null;
          }
          return {
            pathname: trailingPathname,
            search,
            hash,
            state,
            key
          };
        }, [basename, pathname, search, hash, state, key]);
        warning(location != null, '<Router basename="' + basename + '"> is not able to match the URL ' + ('"' + pathname + search + hash + '" because it does not start with the ') + "basename, so the <Router> won't render anything.");
        if (location == null) {
          return null;
        }
        return /* @__PURE__ */ React2.createElement(NavigationContext.Provider, {
          value: navigationContext
        }, /* @__PURE__ */ React2.createElement(LocationContext.Provider, {
          children,
          value: {
            location,
            navigationType
          }
        }));
      }
      function Routes2(_ref4) {
        let {
          children,
          location
        } = _ref4;
        return useRoutes2(createRoutesFromChildren(children), location);
      }
      function useHref2(to) {
        !useInRouterContext() ? invariant2(false, "useHref() may be used only in the context of a <Router> component.") : void 0;
        let {
          basename,
          navigator
        } = React2.useContext(NavigationContext);
        let {
          hash,
          pathname,
          search
        } = useResolvedPath2(to);
        let joinedPathname = pathname;
        if (basename !== "/") {
          let toPathname = getToPathname(to);
          let endsWithSlash = toPathname != null && toPathname.endsWith("/");
          joinedPathname = pathname === "/" ? basename + (endsWithSlash ? "/" : "") : joinPaths([basename, pathname]);
        }
        return navigator.createHref({
          pathname: joinedPathname,
          search,
          hash
        });
      }
      function useInRouterContext() {
        return React2.useContext(LocationContext) != null;
      }
      function useLocation2() {
        !useInRouterContext() ? invariant2(false, "useLocation() may be used only in the context of a <Router> component.") : void 0;
        return React2.useContext(LocationContext).location;
      }
      function useNavigationType() {
        return React2.useContext(LocationContext).navigationType;
      }
      function useMatch(pattern) {
        !useInRouterContext() ? invariant2(false, "useMatch() may be used only in the context of a <Router> component.") : void 0;
        return matchPath(pattern, useLocation2().pathname);
      }
      function useNavigate2() {
        !useInRouterContext() ? invariant2(false, "useNavigate() may be used only in the context of a <Router> component.") : void 0;
        let {
          basename,
          navigator
        } = React2.useContext(NavigationContext);
        let {
          matches
        } = React2.useContext(RouteContext);
        let {
          pathname: locationPathname
        } = useLocation2();
        let routePathnamesJson = JSON.stringify(matches.map((match) => match.pathnameBase));
        let activeRef = React2.useRef(false);
        React2.useEffect(() => {
          activeRef.current = true;
        });
        let navigate = React2.useCallback(function(to, options) {
          if (options === void 0) {
            options = {};
          }
          warning(activeRef.current, "You should call navigate() in a React.useEffect(), not when your component is first rendered.");
          if (!activeRef.current)
            return;
          if (typeof to === "number") {
            navigator.go(to);
            return;
          }
          let path = resolveTo(to, JSON.parse(routePathnamesJson), locationPathname);
          if (basename !== "/") {
            path.pathname = joinPaths([basename, path.pathname]);
          }
          (!!options.replace ? navigator.replace : navigator.push)(path, options.state);
        }, [basename, navigator, routePathnamesJson, locationPathname]);
        return navigate;
      }
      function useOutlet() {
        return React2.useContext(RouteContext).outlet;
      }
      function useParams() {
        let {
          matches
        } = React2.useContext(RouteContext);
        let routeMatch = matches[matches.length - 1];
        return routeMatch ? routeMatch.params : {};
      }
      function useResolvedPath2(to) {
        let {
          matches
        } = React2.useContext(RouteContext);
        let {
          pathname: locationPathname
        } = useLocation2();
        let routePathnamesJson = JSON.stringify(matches.map((match) => match.pathnameBase));
        return React2.useMemo(() => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname), [to, routePathnamesJson, locationPathname]);
      }
      function useRoutes2(routes, locationArg) {
        !useInRouterContext() ? invariant2(false, "useRoutes() may be used only in the context of a <Router> component.") : void 0;
        let {
          matches: parentMatches
        } = React2.useContext(RouteContext);
        let routeMatch = parentMatches[parentMatches.length - 1];
        let parentParams = routeMatch ? routeMatch.params : {};
        let parentPathname = routeMatch ? routeMatch.pathname : "/";
        let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
        let parentRoute = routeMatch && routeMatch.route;
        {
          let parentPath = parentRoute && parentRoute.path || "";
          warningOnce(parentPathname, !parentRoute || parentPath.endsWith("*"), "You rendered descendant <Routes> (or called `useRoutes()`) at " + ('"' + parentPathname + '" (under <Route path="' + parentPath + '">) but the ') + `parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

` + ('Please change the parent <Route path="' + parentPath + '"> to <Route ') + ('path="' + parentPath + '/*">.'));
        }
        let locationFromContext = useLocation2();
        let location;
        if (locationArg) {
          var _parsedLocationArg$pa;
          let parsedLocationArg = typeof locationArg === "string" ? history.parsePath(locationArg) : locationArg;
          !(parentPathnameBase === "/" || ((_parsedLocationArg$pa = parsedLocationArg.pathname) == null ? void 0 : _parsedLocationArg$pa.startsWith(parentPathnameBase))) ? invariant2(false, "When overriding the location using `<Routes location>` or `useRoutes(routes, location)`, the location pathname must begin with the portion of the URL pathname that was " + ('matched by all parent routes. The current pathname base is "' + parentPathnameBase + '" ') + ('but pathname "' + parsedLocationArg.pathname + '" was given in the `location` prop.')) : void 0;
          location = parsedLocationArg;
        } else {
          location = locationFromContext;
        }
        let pathname = location.pathname || "/";
        let remainingPathname = parentPathnameBase === "/" ? pathname : pathname.slice(parentPathnameBase.length) || "/";
        let matches = matchRoutes2(routes, {
          pathname: remainingPathname
        });
        {
          warning(parentRoute || matches != null, 'No routes matched location "' + location.pathname + location.search + location.hash + '" ');
          warning(matches == null || matches[matches.length - 1].route.element !== void 0, 'Matched leaf route at location "' + location.pathname + location.search + location.hash + '" does not have an element. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.');
        }
        return _renderMatches(matches && matches.map((match) => Object.assign({}, match, {
          params: Object.assign({}, parentParams, match.params),
          pathname: joinPaths([parentPathnameBase, match.pathname]),
          pathnameBase: match.pathnameBase === "/" ? parentPathnameBase : joinPaths([parentPathnameBase, match.pathnameBase])
        })), parentMatches);
      }
      function createRoutesFromChildren(children) {
        let routes = [];
        React2.Children.forEach(children, (element) => {
          if (!/* @__PURE__ */ React2.isValidElement(element)) {
            return;
          }
          if (element.type === React2.Fragment) {
            routes.push.apply(routes, createRoutesFromChildren(element.props.children));
            return;
          }
          !(element.type === Route) ? invariant2(false, "[" + (typeof element.type === "string" ? element.type : element.type.name) + "] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>") : void 0;
          let route = {
            caseSensitive: element.props.caseSensitive,
            element: element.props.element,
            index: element.props.index,
            path: element.props.path
          };
          if (element.props.children) {
            route.children = createRoutesFromChildren(element.props.children);
          }
          routes.push(route);
        });
        return routes;
      }
      function generatePath(path, params) {
        if (params === void 0) {
          params = {};
        }
        return path.replace(/:(\w+)/g, (_, key) => {
          !(params[key] != null) ? invariant2(false, 'Missing ":' + key + '" param') : void 0;
          return params[key];
        }).replace(/\/*\*$/, (_) => params["*"] == null ? "" : params["*"].replace(/^\/*/, "/"));
      }
      function matchRoutes2(routes, locationArg, basename) {
        if (basename === void 0) {
          basename = "/";
        }
        let location = typeof locationArg === "string" ? history.parsePath(locationArg) : locationArg;
        let pathname = stripBasename(location.pathname || "/", basename);
        if (pathname == null) {
          return null;
        }
        let branches = flattenRoutes(routes);
        rankRouteBranches(branches);
        let matches = null;
        for (let i = 0; matches == null && i < branches.length; ++i) {
          matches = matchRouteBranch(branches[i], routes, pathname);
        }
        return matches;
      }
      function flattenRoutes(routes, branches, parentsMeta, parentPath) {
        if (branches === void 0) {
          branches = [];
        }
        if (parentsMeta === void 0) {
          parentsMeta = [];
        }
        if (parentPath === void 0) {
          parentPath = "";
        }
        routes.forEach((route, index) => {
          let meta = {
            relativePath: route.path || "",
            caseSensitive: route.caseSensitive === true,
            childrenIndex: index
          };
          if (meta.relativePath.startsWith("/")) {
            !meta.relativePath.startsWith(parentPath) ? invariant2(false, 'Absolute route path "' + meta.relativePath + '" nested under path ' + ('"' + parentPath + '" is not valid. An absolute child route path ') + "must start with the combined path of all its parent routes.") : void 0;
            meta.relativePath = meta.relativePath.slice(parentPath.length);
          }
          let path = joinPaths([parentPath, meta.relativePath]);
          let routesMeta = parentsMeta.concat(meta);
          if (route.children && route.children.length > 0) {
            !(route.index !== true) ? invariant2(false, "Index routes must not have child routes. Please remove " + ('all child routes from route path "' + path + '".')) : void 0;
            flattenRoutes(route.children, branches, routesMeta, path);
          }
          if (route.path == null && !route.index) {
            return;
          }
          branches.push({
            path,
            score: computeScore(path, route.index),
            routesMeta
          });
        });
        return branches;
      }
      function rankRouteBranches(branches) {
        branches.sort((a, b) => a.score !== b.score ? b.score - a.score : compareIndexes(a.routesMeta.map((meta) => meta.childrenIndex), b.routesMeta.map((meta) => meta.childrenIndex)));
      }
      const paramRe = /^:\w+$/;
      const dynamicSegmentValue = 3;
      const indexRouteValue = 2;
      const emptySegmentValue = 1;
      const staticSegmentValue = 10;
      const splatPenalty = -2;
      const isSplat = (s) => s === "*";
      function computeScore(path, index) {
        let segments = path.split("/");
        let initialScore = segments.length;
        if (segments.some(isSplat)) {
          initialScore += splatPenalty;
        }
        if (index) {
          initialScore += indexRouteValue;
        }
        return segments.filter((s) => !isSplat(s)).reduce((score, segment) => score + (paramRe.test(segment) ? dynamicSegmentValue : segment === "" ? emptySegmentValue : staticSegmentValue), initialScore);
      }
      function compareIndexes(a, b) {
        let siblings = a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);
        return siblings ? a[a.length - 1] - b[b.length - 1] : 0;
      }
      function matchRouteBranch(branch, routesArg, pathname) {
        let routes = routesArg;
        let {
          routesMeta
        } = branch;
        let matchedParams = {};
        let matchedPathname = "/";
        let matches = [];
        for (let i = 0; i < routesMeta.length; ++i) {
          let meta = routesMeta[i];
          let end = i === routesMeta.length - 1;
          let remainingPathname = matchedPathname === "/" ? pathname : pathname.slice(matchedPathname.length) || "/";
          let match = matchPath({
            path: meta.relativePath,
            caseSensitive: meta.caseSensitive,
            end
          }, remainingPathname);
          if (!match)
            return null;
          Object.assign(matchedParams, match.params);
          let route = routes[meta.childrenIndex];
          matches.push({
            params: matchedParams,
            pathname: joinPaths([matchedPathname, match.pathname]),
            pathnameBase: joinPaths([matchedPathname, match.pathnameBase]),
            route
          });
          if (match.pathnameBase !== "/") {
            matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
          }
          routes = route.children;
        }
        return matches;
      }
      function renderMatches(matches) {
        return _renderMatches(matches);
      }
      function _renderMatches(matches, parentMatches) {
        if (parentMatches === void 0) {
          parentMatches = [];
        }
        if (matches == null)
          return null;
        return matches.reduceRight((outlet, match, index) => {
          return /* @__PURE__ */ React2.createElement(RouteContext.Provider, {
            children: match.route.element !== void 0 ? match.route.element : /* @__PURE__ */ React2.createElement(Outlet2, null),
            value: {
              outlet,
              matches: parentMatches.concat(matches.slice(0, index + 1))
            }
          });
        }, null);
      }
      function matchPath(pattern, pathname) {
        if (typeof pattern === "string") {
          pattern = {
            path: pattern,
            caseSensitive: false,
            end: true
          };
        }
        let [matcher, paramNames] = compilePath(pattern.path, pattern.caseSensitive, pattern.end);
        let match = pathname.match(matcher);
        if (!match)
          return null;
        let matchedPathname = match[0];
        let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
        let captureGroups = match.slice(1);
        let params = paramNames.reduce((memo, paramName, index) => {
          if (paramName === "*") {
            let splatValue = captureGroups[index] || "";
            pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, "$1");
          }
          memo[paramName] = safelyDecodeURIComponent(captureGroups[index] || "", paramName);
          return memo;
        }, {});
        return {
          params,
          pathname: matchedPathname,
          pathnameBase,
          pattern
        };
      }
      function compilePath(path, caseSensitive, end) {
        if (caseSensitive === void 0) {
          caseSensitive = false;
        }
        if (end === void 0) {
          end = true;
        }
        warning(path === "*" || !path.endsWith("*") || path.endsWith("/*"), 'Route path "' + path + '" will be treated as if it were ' + ('"' + path.replace(/\*$/, "/*") + '" because the `*` character must ') + "always follow a `/` in the pattern. To get rid of this warning, " + ('please change the route path to "' + path.replace(/\*$/, "/*") + '".'));
        let paramNames = [];
        let regexpSource = "^" + path.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^$?{}|()[\]]/g, "\\$&").replace(/:(\w+)/g, (_, paramName) => {
          paramNames.push(paramName);
          return "([^\\/]+)";
        });
        if (path.endsWith("*")) {
          paramNames.push("*");
          regexpSource += path === "*" || path === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$";
        } else {
          regexpSource += end ? "\\/*$" : "(?:\\b|$)";
        }
        let matcher = new RegExp(regexpSource, caseSensitive ? void 0 : "i");
        return [matcher, paramNames];
      }
      function safelyDecodeURIComponent(value, paramName) {
        try {
          return decodeURIComponent(value);
        } catch (error) {
          warning(false, 'The value for the URL param "' + paramName + '" will not be decoded because' + (' the string "' + value + '" is a malformed URL segment. This is probably') + (" due to a bad percent encoding (" + error + ")."));
          return value;
        }
      }
      function resolvePath(to, fromPathname) {
        if (fromPathname === void 0) {
          fromPathname = "/";
        }
        let {
          pathname: toPathname,
          search = "",
          hash = ""
        } = typeof to === "string" ? history.parsePath(to) : to;
        let pathname = toPathname ? toPathname.startsWith("/") ? toPathname : resolvePathname(toPathname, fromPathname) : fromPathname;
        return {
          pathname,
          search: normalizeSearch(search),
          hash: normalizeHash(hash)
        };
      }
      function resolvePathname(relativePath, fromPathname) {
        let segments = fromPathname.replace(/\/+$/, "").split("/");
        let relativeSegments = relativePath.split("/");
        relativeSegments.forEach((segment) => {
          if (segment === "..") {
            if (segments.length > 1)
              segments.pop();
          } else if (segment !== ".") {
            segments.push(segment);
          }
        });
        return segments.length > 1 ? segments.join("/") : "/";
      }
      function resolveTo(toArg, routePathnames, locationPathname) {
        let to = typeof toArg === "string" ? history.parsePath(toArg) : toArg;
        let toPathname = toArg === "" || to.pathname === "" ? "/" : to.pathname;
        let from;
        if (toPathname == null) {
          from = locationPathname;
        } else {
          let routePathnameIndex = routePathnames.length - 1;
          if (toPathname.startsWith("..")) {
            let toSegments = toPathname.split("/");
            while (toSegments[0] === "..") {
              toSegments.shift();
              routePathnameIndex -= 1;
            }
            to.pathname = toSegments.join("/");
          }
          from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
        }
        let path = resolvePath(to, from);
        if (toPathname && toPathname !== "/" && toPathname.endsWith("/") && !path.pathname.endsWith("/")) {
          path.pathname += "/";
        }
        return path;
      }
      function getToPathname(to) {
        return to === "" || to.pathname === "" ? "/" : typeof to === "string" ? history.parsePath(to).pathname : to.pathname;
      }
      function stripBasename(pathname, basename) {
        if (basename === "/")
          return pathname;
        if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
          return null;
        }
        let nextChar = pathname.charAt(basename.length);
        if (nextChar && nextChar !== "/") {
          return null;
        }
        return pathname.slice(basename.length) || "/";
      }
      const joinPaths = (paths) => paths.join("/").replace(/\/\/+/g, "/");
      const normalizePathname = (pathname) => pathname.replace(/\/+$/, "").replace(/^\/*/, "/");
      const normalizeSearch = (search) => !search || search === "?" ? "" : search.startsWith("?") ? search : "?" + search;
      const normalizeHash = (hash) => !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
      exports2.MemoryRouter = MemoryRouter;
      exports2.Navigate = Navigate;
      exports2.Outlet = Outlet2;
      exports2.Route = Route;
      exports2.Router = Router2;
      exports2.Routes = Routes2;
      exports2.UNSAFE_LocationContext = LocationContext;
      exports2.UNSAFE_NavigationContext = NavigationContext;
      exports2.UNSAFE_RouteContext = RouteContext;
      exports2.createRoutesFromChildren = createRoutesFromChildren;
      exports2.generatePath = generatePath;
      exports2.matchPath = matchPath;
      exports2.matchRoutes = matchRoutes2;
      exports2.renderMatches = renderMatches;
      exports2.resolvePath = resolvePath;
      exports2.useHref = useHref2;
      exports2.useInRouterContext = useInRouterContext;
      exports2.useLocation = useLocation2;
      exports2.useMatch = useMatch;
      exports2.useNavigate = useNavigate2;
      exports2.useNavigationType = useNavigationType;
      exports2.useOutlet = useOutlet;
      exports2.useParams = useParams;
      exports2.useResolvedPath = useResolvedPath2;
      exports2.useRoutes = useRoutes2;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/react-router/main.js
var require_main2 = __commonJS({
  "node_modules/react-router/main.js"(exports, module) {
    init_react();
    "use strict";
    module.exports = false ? null : require_react_router_development();
  }
});

// node_modules/react-router-dom/umd/react-router-dom.development.js
var require_react_router_dom_development = __commonJS({
  "node_modules/react-router-dom/umd/react-router-dom.development.js"(exports, module) {
    init_react();
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_react(), require_main(), require_main2()) : typeof define === "function" && define.amd ? define(["exports", "react", "history", "react-router"], factory) : (global = global || self, factory(global.ReactRouterDOM = {}, global.React, global.HistoryLibrary, global.ReactRouter));
    })(exports, function(exports2, React2, history, reactRouter) {
      "use strict";
      function _extends2() {
        _extends2 = Object.assign || function(target) {
          for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = source[key];
              }
            }
          }
          return target;
        };
        return _extends2.apply(this, arguments);
      }
      function _objectWithoutPropertiesLoose(source, excluded) {
        if (source == null)
          return {};
        var target = {};
        var sourceKeys = Object.keys(source);
        var key, i;
        for (i = 0; i < sourceKeys.length; i++) {
          key = sourceKeys[i];
          if (excluded.indexOf(key) >= 0)
            continue;
          target[key] = source[key];
        }
        return target;
      }
      const _excluded = ["onClick", "reloadDocument", "replace", "state", "target", "to"], _excluded2 = ["aria-current", "caseSensitive", "className", "end", "style", "to"];
      function warning(cond, message) {
        if (!cond) {
          if (typeof console !== "undefined")
            console.warn(message);
          try {
            throw new Error(message);
          } catch (e) {
          }
        }
      }
      function BrowserRouter(_ref) {
        let {
          basename,
          children,
          window: window2
        } = _ref;
        let historyRef = React2.useRef();
        if (historyRef.current == null) {
          historyRef.current = history.createBrowserHistory({
            window: window2
          });
        }
        let history$1 = historyRef.current;
        let [state, setState] = React2.useState({
          action: history$1.action,
          location: history$1.location
        });
        React2.useLayoutEffect(() => history$1.listen(setState), [history$1]);
        return /* @__PURE__ */ React2.createElement(reactRouter.Router, {
          basename,
          children,
          location: state.location,
          navigationType: state.action,
          navigator: history$1
        });
      }
      function HashRouter(_ref2) {
        let {
          basename,
          children,
          window: window2
        } = _ref2;
        let historyRef = React2.useRef();
        if (historyRef.current == null) {
          historyRef.current = history.createHashHistory({
            window: window2
          });
        }
        let history$1 = historyRef.current;
        let [state, setState] = React2.useState({
          action: history$1.action,
          location: history$1.location
        });
        React2.useLayoutEffect(() => history$1.listen(setState), [history$1]);
        return /* @__PURE__ */ React2.createElement(reactRouter.Router, {
          basename,
          children,
          location: state.location,
          navigationType: state.action,
          navigator: history$1
        });
      }
      function isModifiedEvent(event) {
        return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
      }
      const Link2 = /* @__PURE__ */ React2.forwardRef(function LinkWithRef(_ref3, ref) {
        let {
          onClick,
          reloadDocument,
          replace = false,
          state,
          target,
          to
        } = _ref3, rest = _objectWithoutPropertiesLoose(_ref3, _excluded);
        let href = reactRouter.useHref(to);
        let internalOnClick = useLinkClickHandler(to, {
          replace,
          state,
          target
        });
        function handleClick(event) {
          if (onClick)
            onClick(event);
          if (!event.defaultPrevented && !reloadDocument) {
            internalOnClick(event);
          }
        }
        return /* @__PURE__ */ React2.createElement("a", _extends2({}, rest, {
          href,
          onClick: handleClick,
          ref,
          target
        }));
      });
      {
        Link2.displayName = "Link";
      }
      const NavLink2 = /* @__PURE__ */ React2.forwardRef(function NavLinkWithRef(_ref4, ref) {
        let {
          "aria-current": ariaCurrentProp = "page",
          caseSensitive = false,
          className: classNameProp = "",
          end = false,
          style: styleProp,
          to
        } = _ref4, rest = _objectWithoutPropertiesLoose(_ref4, _excluded2);
        let location = reactRouter.useLocation();
        let path = reactRouter.useResolvedPath(to);
        let locationPathname = location.pathname;
        let toPathname = path.pathname;
        if (!caseSensitive) {
          locationPathname = locationPathname.toLowerCase();
          toPathname = toPathname.toLowerCase();
        }
        let isActive = locationPathname === toPathname || !end && locationPathname.startsWith(toPathname) && locationPathname.charAt(toPathname.length) === "/";
        let ariaCurrent = isActive ? ariaCurrentProp : void 0;
        let className;
        if (typeof classNameProp === "function") {
          className = classNameProp({
            isActive
          });
        } else {
          className = [classNameProp, isActive ? "active" : null].filter(Boolean).join(" ");
        }
        let style = typeof styleProp === "function" ? styleProp({
          isActive
        }) : styleProp;
        return /* @__PURE__ */ React2.createElement(Link2, _extends2({}, rest, {
          "aria-current": ariaCurrent,
          className,
          ref,
          style,
          to
        }));
      });
      {
        NavLink2.displayName = "NavLink";
      }
      function useLinkClickHandler(to, _temp) {
        let {
          target,
          replace: replaceProp,
          state
        } = _temp === void 0 ? {} : _temp;
        let navigate = reactRouter.useNavigate();
        let location = reactRouter.useLocation();
        let path = reactRouter.useResolvedPath(to);
        return React2.useCallback((event) => {
          if (event.button === 0 && (!target || target === "_self") && !isModifiedEvent(event)) {
            event.preventDefault();
            let replace = !!replaceProp || history.createPath(location) === history.createPath(path);
            navigate(to, {
              replace,
              state
            });
          }
        }, [location, navigate, path, replaceProp, state, target, to]);
      }
      function useSearchParams(defaultInit) {
        warning(typeof URLSearchParams !== "undefined", "You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params\n\nIf you're unsure how to load polyfills, we recommend you check out https://polyfill.io/v3/ which provides some recommendations about how to load polyfills only for users that need them, instead of for every user.");
        let defaultSearchParamsRef = React2.useRef(createSearchParams(defaultInit));
        let location = reactRouter.useLocation();
        let searchParams = React2.useMemo(() => {
          let searchParams2 = createSearchParams(location.search);
          for (let key of defaultSearchParamsRef.current.keys()) {
            if (!searchParams2.has(key)) {
              defaultSearchParamsRef.current.getAll(key).forEach((value) => {
                searchParams2.append(key, value);
              });
            }
          }
          return searchParams2;
        }, [location.search]);
        let navigate = reactRouter.useNavigate();
        let setSearchParams = React2.useCallback((nextInit, navigateOptions) => {
          navigate("?" + createSearchParams(nextInit), navigateOptions);
        }, [navigate]);
        return [searchParams, setSearchParams];
      }
      function createSearchParams(init) {
        if (init === void 0) {
          init = "";
        }
        return new URLSearchParams(typeof init === "string" || Array.isArray(init) || init instanceof URLSearchParams ? init : Object.keys(init).reduce((memo, key) => {
          let value = init[key];
          return memo.concat(Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]);
        }, []));
      }
      Object.defineProperty(exports2, "MemoryRouter", {
        enumerable: true,
        get: function() {
          return reactRouter.MemoryRouter;
        }
      });
      Object.defineProperty(exports2, "Navigate", {
        enumerable: true,
        get: function() {
          return reactRouter.Navigate;
        }
      });
      Object.defineProperty(exports2, "Outlet", {
        enumerable: true,
        get: function() {
          return reactRouter.Outlet;
        }
      });
      Object.defineProperty(exports2, "Route", {
        enumerable: true,
        get: function() {
          return reactRouter.Route;
        }
      });
      Object.defineProperty(exports2, "Router", {
        enumerable: true,
        get: function() {
          return reactRouter.Router;
        }
      });
      Object.defineProperty(exports2, "Routes", {
        enumerable: true,
        get: function() {
          return reactRouter.Routes;
        }
      });
      Object.defineProperty(exports2, "UNSAFE_LocationContext", {
        enumerable: true,
        get: function() {
          return reactRouter.UNSAFE_LocationContext;
        }
      });
      Object.defineProperty(exports2, "UNSAFE_NavigationContext", {
        enumerable: true,
        get: function() {
          return reactRouter.UNSAFE_NavigationContext;
        }
      });
      Object.defineProperty(exports2, "UNSAFE_RouteContext", {
        enumerable: true,
        get: function() {
          return reactRouter.UNSAFE_RouteContext;
        }
      });
      Object.defineProperty(exports2, "createRoutesFromChildren", {
        enumerable: true,
        get: function() {
          return reactRouter.createRoutesFromChildren;
        }
      });
      Object.defineProperty(exports2, "generatePath", {
        enumerable: true,
        get: function() {
          return reactRouter.generatePath;
        }
      });
      Object.defineProperty(exports2, "matchPath", {
        enumerable: true,
        get: function() {
          return reactRouter.matchPath;
        }
      });
      Object.defineProperty(exports2, "matchRoutes", {
        enumerable: true,
        get: function() {
          return reactRouter.matchRoutes;
        }
      });
      Object.defineProperty(exports2, "renderMatches", {
        enumerable: true,
        get: function() {
          return reactRouter.renderMatches;
        }
      });
      Object.defineProperty(exports2, "resolvePath", {
        enumerable: true,
        get: function() {
          return reactRouter.resolvePath;
        }
      });
      Object.defineProperty(exports2, "useHref", {
        enumerable: true,
        get: function() {
          return reactRouter.useHref;
        }
      });
      Object.defineProperty(exports2, "useInRouterContext", {
        enumerable: true,
        get: function() {
          return reactRouter.useInRouterContext;
        }
      });
      Object.defineProperty(exports2, "useLocation", {
        enumerable: true,
        get: function() {
          return reactRouter.useLocation;
        }
      });
      Object.defineProperty(exports2, "useMatch", {
        enumerable: true,
        get: function() {
          return reactRouter.useMatch;
        }
      });
      Object.defineProperty(exports2, "useNavigate", {
        enumerable: true,
        get: function() {
          return reactRouter.useNavigate;
        }
      });
      Object.defineProperty(exports2, "useNavigationType", {
        enumerable: true,
        get: function() {
          return reactRouter.useNavigationType;
        }
      });
      Object.defineProperty(exports2, "useOutlet", {
        enumerable: true,
        get: function() {
          return reactRouter.useOutlet;
        }
      });
      Object.defineProperty(exports2, "useParams", {
        enumerable: true,
        get: function() {
          return reactRouter.useParams;
        }
      });
      Object.defineProperty(exports2, "useResolvedPath", {
        enumerable: true,
        get: function() {
          return reactRouter.useResolvedPath;
        }
      });
      Object.defineProperty(exports2, "useRoutes", {
        enumerable: true,
        get: function() {
          return reactRouter.useRoutes;
        }
      });
      exports2.BrowserRouter = BrowserRouter;
      exports2.HashRouter = HashRouter;
      exports2.Link = Link2;
      exports2.NavLink = NavLink2;
      exports2.createSearchParams = createSearchParams;
      exports2.useLinkClickHandler = useLinkClickHandler;
      exports2.useSearchParams = useSearchParams;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/react-router-dom/main.js
var require_main3 = __commonJS({
  "node_modules/react-router-dom/main.js"(exports, module) {
    init_react();
    "use strict";
    module.exports = false ? null : require_react_router_dom_development();
  }
});

// node_modules/@remix-run/react/browser/browser.js
init_react();
var import_history3 = __toModule(require_main());
var import_react4 = __toModule(require_react());

// node_modules/@remix-run/react/browser/components.js
init_react();

// node_modules/@remix-run/react/browser/_virtual/_rollupPluginBabelHelpers.js
init_react();
function _extends() {
  _extends = Object.assign || function(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}

// node_modules/@remix-run/react/browser/components.js
var import_react3 = __toModule(require_react());
var import_react_router_dom2 = __toModule(require_main3());

// node_modules/@remix-run/react/browser/errorBoundaries.js
init_react();
var import_react = __toModule(require_react());
var RemixErrorBoundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: props.error || null,
      location: props.location
    };
  }
  static getDerivedStateFromError(error) {
    return {
      error
    };
  }
  static getDerivedStateFromProps(props, state) {
    if (state.location !== props.location) {
      return {
        error: props.error || null,
        location: props.location
      };
    }
    return state;
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ import_react.default.createElement(this.props.component, {
        error: this.state.error
      });
    } else {
      return this.props.children;
    }
  }
};
function RemixRootDefaultErrorBoundary({
  error
}) {
  console.error(error);
  return /* @__PURE__ */ import_react.default.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ import_react.default.createElement("head", null, /* @__PURE__ */ import_react.default.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ import_react.default.createElement("title", null, "Uncaught Exception!")), /* @__PURE__ */ import_react.default.createElement("body", null, /* @__PURE__ */ import_react.default.createElement("main", {
    style: {
      border: "solid 2px hsl(10, 50%, 50%)",
      padding: "2rem"
    }
  }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("h1", null, "Uncaught Exception!"), /* @__PURE__ */ import_react.default.createElement("p", null, "If you are not the developer, please click back in your browser and try again."), /* @__PURE__ */ import_react.default.createElement("div", {
    style: {
      fontFamily: `"SFMono-Regular",Consolas,"Liberation Mono",Menlo,Courier,monospace`,
      padding: "1rem",
      margin: "1rem 0",
      border: "solid 4px"
    }
  }, error.message), /* @__PURE__ */ import_react.default.createElement("p", null, "There was an uncaught exception in your application. Check the browser console and/or server console to inspect the error."), /* @__PURE__ */ import_react.default.createElement("p", null, "If you are the developer, consider adding your own error boundary so users don't see this page when unexpected errors happen in production!"), /* @__PURE__ */ import_react.default.createElement("p", null, "Read more about", " ", /* @__PURE__ */ import_react.default.createElement("a", {
    target: "_blank",
    rel: "noreferrer",
    href: "https://remix.run/dashboard/docs/errors"
  }, "Error Handling in Remix"), ".")))));
}
var RemixCatchContext = /* @__PURE__ */ import_react.default.createContext(void 0);
function useCatch() {
  return (0, import_react.useContext)(RemixCatchContext);
}
function RemixCatchBoundary({
  catch: catchVal,
  component: Component,
  children
}) {
  if (catchVal) {
    return /* @__PURE__ */ import_react.default.createElement(RemixCatchContext.Provider, {
      value: catchVal
    }, /* @__PURE__ */ import_react.default.createElement(Component, null));
  }
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, children);
}
function RemixRootDefaultCatchBoundary() {
  return /* @__PURE__ */ import_react.default.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ import_react.default.createElement("head", null, /* @__PURE__ */ import_react.default.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ import_react.default.createElement("title", null, "Unhandled Thrown Response!")), /* @__PURE__ */ import_react.default.createElement("body", null, /* @__PURE__ */ import_react.default.createElement("main", {
    style: {
      border: "solid 2px hsl(10, 50%, 50%)",
      padding: "2rem"
    }
  }, /* @__PURE__ */ import_react.default.createElement("div", null, /* @__PURE__ */ import_react.default.createElement("h1", null, "Unhandled Thrown Response!"), /* @__PURE__ */ import_react.default.createElement("p", null, "If you are not the developer, please click back in your browser and try again."), /* @__PURE__ */ import_react.default.createElement("p", null, "There was an unhandled thrown response in your application."), /* @__PURE__ */ import_react.default.createElement("p", null, "If you are the developer, consider adding your own catch boundary so users don't see this page when unhandled thrown response happen in production!"), /* @__PURE__ */ import_react.default.createElement("p", null, "Read more about", " ", /* @__PURE__ */ import_react.default.createElement("a", {
    target: "_blank",
    rel: "noreferrer",
    href: "https://remix.run/dashboard/docs/errors"
  }, "Throwing Responses in Remix"), ".")))));
}

// node_modules/@remix-run/react/browser/invariant.js
init_react();
function invariant(value, message) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}

// node_modules/@remix-run/react/browser/links.js
init_react();
var import_history = __toModule(require_main());

// node_modules/@remix-run/react/browser/routeModules.js
init_react();
async function loadRouteModule(route, routeModulesCache) {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }
  try {
    let routeModule = await import(route.module);
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error) {
    window.location.reload();
    return new Promise(() => {
    });
  }
}

// node_modules/@remix-run/react/browser/links.js
function getLinksForMatches(matches, routeModules, manifest) {
  let descriptors = matches.map((match) => {
    let module = routeModules[match.route.id];
    return module.links && module.links() || [];
  }).flat(1);
  let preloads = getCurrentPageModulePreloadHrefs(matches, manifest);
  return dedupe(descriptors, preloads);
}
async function prefetchStyleLinks(routeModule) {
  if (!routeModule.links)
    return;
  let descriptors = routeModule.links();
  if (!descriptors)
    return;
  let styleLinks = [];
  for (let descriptor of descriptors) {
    if (!isPageLinkDescriptor(descriptor) && descriptor.rel === "stylesheet") {
      styleLinks.push({
        ...descriptor,
        rel: "preload",
        as: "style"
      });
    }
  }
  let matchingLinks = styleLinks.filter((link) => !link.media || window.matchMedia(link.media).matches);
  await Promise.all(matchingLinks.map(prefetchStyleLink));
}
async function prefetchStyleLink(descriptor) {
  return new Promise((resolve) => {
    let link = document.createElement("link");
    Object.assign(link, descriptor);
    function removeLink() {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    }
    link.onload = () => {
      removeLink();
      resolve();
    };
    link.onerror = () => {
      removeLink();
      resolve();
    };
    document.head.appendChild(link);
  });
}
function isPageLinkDescriptor(object) {
  return object != null && typeof object.page === "string";
}
function isHtmlLinkDescriptor(object) {
  return object != null && typeof object.rel === "string" && typeof object.href === "string";
}
async function getStylesheetPrefetchLinks(matches, routeModules) {
  let links = await Promise.all(matches.map(async (match) => {
    let mod = await loadRouteModule(match.route, routeModules);
    return mod.links ? mod.links() : [];
  }));
  return links.flat(1).filter(isHtmlLinkDescriptor).filter((link) => link.rel === "stylesheet").map(({
    rel,
    ...attrs
  }) => ({
    rel: "prefetch",
    as: "style",
    ...attrs
  }));
}
function getNewMatchesForLinks(page, nextMatches, currentMatches, location, mode) {
  let path = parsePathPatch(page);
  let isNew = (match, index) => {
    if (!currentMatches[index])
      return true;
    return match.route.id !== currentMatches[index].route.id;
  };
  let matchPathChanged = (match, index) => {
    var _currentMatches$index;
    return currentMatches[index].pathname !== match.pathname || ((_currentMatches$index = currentMatches[index].route.path) === null || _currentMatches$index === void 0 ? void 0 : _currentMatches$index.endsWith("*")) && currentMatches[index].params["*"] !== match.params["*"];
  };
  let newMatches = mode === "data" && location.search !== path.search ? nextMatches.filter((match, index) => {
    if (!match.route.hasLoader) {
      return false;
    }
    if (isNew(match, index) || matchPathChanged(match, index)) {
      return true;
    }
    if (match.route.shouldReload) {
      return match.route.shouldReload({
        params: match.params,
        prevUrl: new URL(location.pathname + location.search + location.hash, window.origin),
        url: new URL(page, window.origin)
      });
    }
    return true;
  }) : nextMatches.filter((match, index) => {
    return match.route.hasLoader && (isNew(match, index) || matchPathChanged(match, index));
  });
  return newMatches;
}
function getDataLinkHrefs(page, matches, manifest) {
  let path = parsePathPatch(page);
  return dedupeHrefs(matches.filter((match) => manifest.routes[match.route.id].hasLoader).map((match) => {
    let {
      pathname,
      search
    } = path;
    let searchParams = new URLSearchParams(search);
    searchParams.append("_data", match.route.id);
    return `${pathname}?${searchParams}`;
  }));
}
function getModuleLinkHrefs(matches, manifestPatch) {
  return dedupeHrefs(matches.map((match) => {
    let route = manifestPatch.routes[match.route.id];
    let hrefs = [route.module];
    if (route.imports) {
      hrefs = hrefs.concat(route.imports);
    }
    return hrefs;
  }).flat(1));
}
function getCurrentPageModulePreloadHrefs(matches, manifest) {
  return dedupeHrefs(matches.map((match) => {
    let route = manifest.routes[match.route.id];
    let hrefs = [route.module];
    if (route.imports) {
      hrefs = hrefs.concat(route.imports);
    }
    return hrefs;
  }).flat(1));
}
function dedupeHrefs(hrefs) {
  return [...new Set(hrefs)];
}
function dedupe(descriptors, preloads) {
  let set = new Set();
  let preloadsSet = new Set(preloads);
  return descriptors.reduce((deduped, descriptor) => {
    let alreadyModulePreload = !isPageLinkDescriptor(descriptor) && descriptor.as === "script" && descriptor.href && preloadsSet.has(descriptor.href);
    if (alreadyModulePreload) {
      return deduped;
    }
    let str = JSON.stringify(descriptor);
    if (!set.has(str)) {
      set.add(str);
      deduped.push(descriptor);
    }
    return deduped;
  }, []);
}
function parsePathPatch(href) {
  let path = (0, import_history.parsePath)(href);
  if (path.search === void 0)
    path.search = "";
  return path;
}

// node_modules/@remix-run/react/browser/markup.js
init_react();
function createHtml(html) {
  return {
    __html: html
  };
}

// node_modules/@remix-run/react/browser/routes.js
init_react();
var import_react2 = __toModule(require_react());

// node_modules/@remix-run/react/browser/data.js
init_react();
function isCatchResponse(response) {
  return response instanceof Response && response.headers.get("X-Remix-Catch") != null;
}
function isErrorResponse(response) {
  return response instanceof Response && response.headers.get("X-Remix-Error") != null;
}
function isRedirectResponse(response) {
  return response instanceof Response && response.headers.get("X-Remix-Redirect") != null;
}
async function fetchData(url, routeId, signal, submission) {
  url.searchParams.set("_data", routeId);
  url.searchParams.sort();
  let init = submission ? getActionInit(submission, signal) : {
    credentials: "same-origin",
    signal
  };
  let response = await fetch(url.href, init);
  if (isErrorResponse(response)) {
    let data = await response.json();
    let error = new Error(data.message);
    error.stack = data.stack;
    return error;
  }
  return response;
}
async function extractData(response) {
  let contentType = response.headers.get("Content-Type");
  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }
  return response.text();
}
function getActionInit(submission, signal) {
  let {
    encType,
    method,
    formData
  } = submission;
  if (encType !== "application/x-www-form-urlencoded") {
    throw new Error(`Only "application/x-www-form-urlencoded" forms are supported right now.`);
  }
  let body = new URLSearchParams();
  for (let [key, value] of formData) {
    invariant(typeof value === "string", "File inputs are not supported right now");
    body.append(key, value);
  }
  return {
    method,
    body: body.toString(),
    signal,
    credentials: "same-origin",
    headers: {
      "Content-Type": encType
    }
  };
}

// node_modules/@remix-run/react/browser/transition.js
init_react();
var import_history2 = __toModule(require_main());

// node_modules/@remix-run/react/browser/routeMatching.js
init_react();
var import_react_router_dom = __toModule(require_main3());
function matchClientRoutes(routes, location) {
  let matches = (0, import_react_router_dom.matchRoutes)(routes, location);
  if (!matches)
    return null;
  return matches.map((match) => ({
    params: match.params,
    pathname: match.pathname,
    route: match.route
  }));
}

// node_modules/@remix-run/react/browser/transition.js
var CatchValue = class {
  constructor(status, statusText, data) {
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
};
function isActionSubmission(submission) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(submission.method);
}
function isLoaderSubmission(submission) {
  return submission.method === "GET";
}
function isRedirectLocation(location) {
  return Boolean(location.state) && location.state.isRedirect;
}
function isLoaderRedirectLocation(location) {
  return isRedirectLocation(location) && location.state.type === "loader";
}
function isActionRedirectLocation(location) {
  return isRedirectLocation(location) && location.state.type === "action";
}
function isFetchActionRedirect(location) {
  return isRedirectLocation(location) && location.state.type === "fetchAction";
}
function isLoaderSubmissionRedirectLocation(location) {
  return isRedirectLocation(location) && location.state.type === "loaderSubmission";
}
var TransitionRedirect = class {
  constructor(location) {
    this.location = typeof location === "string" ? location : location.pathname + location.search;
  }
};
var IDLE_TRANSITION = {
  state: "idle",
  submission: void 0,
  location: void 0,
  type: "idle"
};
var IDLE_FETCHER = {
  state: "idle",
  type: "init",
  data: void 0,
  submission: void 0
};
function createTransitionManager(init) {
  let {
    routes
  } = init;
  let pendingNavigationController;
  let fetchControllers = new Map();
  let incrementingLoadId = 0;
  let navigationLoadId = -1;
  let fetchReloadIds = new Map();
  let matches = matchClientRoutes(routes, init.location);
  if (!matches) {
    matches = [{
      params: {},
      pathname: "",
      route: routes[0]
    }];
  }
  let state = {
    location: init.location,
    loaderData: init.loaderData || {},
    actionData: init.actionData,
    catch: init.catch,
    error: init.error,
    catchBoundaryId: init.catchBoundaryId || null,
    errorBoundaryId: init.errorBoundaryId || null,
    matches,
    nextMatches: void 0,
    transition: IDLE_TRANSITION,
    fetchers: new Map()
  };
  function update(updates) {
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }
  function getState() {
    return state;
  }
  function getFetcher(key) {
    return state.fetchers.get(key) || IDLE_FETCHER;
  }
  function deleteFetcher(key) {
    if (fetchControllers.has(key))
      abortFetcher(key);
    fetchReloadIds.delete(key);
    state.fetchers.delete(key);
  }
  async function send(event) {
    switch (event.type) {
      case "navigation": {
        let {
          action,
          location,
          submission
        } = event;
        let matches2 = matchClientRoutes(routes, location);
        if (!matches2) {
          matches2 = [{
            params: {},
            pathname: "",
            route: routes[0]
          }];
          await handleNotFoundNavigation(location, matches2);
        } else if (!submission && isHashChangeOnly(location)) {
          await handleHashChange(location, matches2);
        } else if (action === import_history2.Action.Pop) {
          await handleLoad(location, matches2);
        } else if (submission && isActionSubmission(submission)) {
          await handleActionSubmissionNavigation(location, submission, matches2);
        } else if (submission && isLoaderSubmission(submission)) {
          await handleLoaderSubmissionNavigation(location, submission, matches2);
        } else if (isActionRedirectLocation(location)) {
          await handleActionRedirect(location, matches2);
        } else if (isLoaderSubmissionRedirectLocation(location)) {
          await handleLoaderSubmissionRedirect(location, matches2);
        } else if (isLoaderRedirectLocation(location)) {
          await handleLoaderRedirect(location, matches2);
        } else if (isFetchActionRedirect(location)) {
          await handleFetchActionRedirect(location, matches2);
        } else {
          await handleLoad(location, matches2);
        }
        navigationLoadId = -1;
        break;
      }
      case "fetcher": {
        let {
          key,
          submission,
          href
        } = event;
        let matches2 = matchClientRoutes(routes, href);
        invariant(matches2, "No matches found");
        let match = matches2.slice(-1)[0];
        if (fetchControllers.has(key))
          abortFetcher(key);
        if (submission && isActionSubmission(submission)) {
          await handleActionFetchSubmission(key, submission, match);
        } else if (submission && isLoaderSubmission(submission)) {
          await handleLoaderFetchSubmission(href, key, submission, match);
        } else {
          await handleLoaderFetch(href, key, match);
        }
        break;
      }
      default: {
        throw new Error(`Unknown data event type: ${event.type}`);
      }
    }
  }
  function dispose() {
    abortNormalNavigation();
    for (let [, controller] of fetchControllers) {
      controller.abort();
    }
  }
  async function handleActionFetchSubmission(key, submission, match) {
    let fetcher = {
      state: "submitting",
      type: "actionSubmission",
      submission,
      data: void 0
    };
    state.fetchers.set(key, fetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callAction(submission, match, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "fetchAction"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }
    if (maybeBailOnError(match, key, result)) {
      return;
    }
    if (await maybeBailOnCatch(match, key, result)) {
      return;
    }
    let loadFetcher = {
      state: "loading",
      type: "actionReload",
      data: result.value,
      submission
    };
    state.fetchers.set(key, loadFetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let maybeActionErrorResult = isErrorResult(result) ? result : void 0;
    let maybeActionCatchResult = isCatchResult(result) ? result : void 0;
    let loadId = ++incrementingLoadId;
    fetchReloadIds.set(key, loadId);
    let matchesToLoad = state.nextMatches || state.matches;
    let hrefToLoad = createHref(state.transition.location || state.location);
    let results = await callLoaders(state, createUrl(hrefToLoad), matchesToLoad, controller.signal, maybeActionErrorResult, maybeActionCatchResult, submission, loadFetcher);
    if (controller.signal.aborted) {
      return;
    }
    fetchReloadIds.delete(key);
    fetchControllers.delete(key);
    let redirect = findRedirect(results);
    if (redirect) {
      let locationState = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(redirect.location, locationState);
      return;
    }
    let [error, errorBoundaryId] = findErrorAndBoundaryId(results, state.matches, maybeActionErrorResult);
    let [catchVal, catchBoundaryId] = await findCatchAndBoundaryId(results, state.matches, maybeActionCatchResult);
    let doneFetcher = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: void 0
    };
    state.fetchers.set(key, doneFetcher);
    let abortedKeys = abortStaleFetchLoads(loadId);
    if (abortedKeys) {
      markFetchersDone(abortedKeys);
    }
    let yeetedNavigation = yeetStaleNavigationLoad(loadId);
    if (yeetedNavigation) {
      let {
        transition
      } = state;
      invariant(transition.state === "loading", "Expected loading transition");
      update({
        location: transition.location,
        matches: state.nextMatches,
        error,
        errorBoundaryId,
        catch: catchVal,
        catchBoundaryId,
        loaderData: makeLoaderData(state, results, matchesToLoad),
        actionData: transition.type === "actionReload" ? state.actionData : void 0,
        transition: IDLE_TRANSITION,
        fetchers: new Map(state.fetchers)
      });
    } else {
      update({
        fetchers: new Map(state.fetchers),
        error,
        errorBoundaryId,
        loaderData: makeLoaderData(state, results, matchesToLoad)
      });
    }
  }
  function yeetStaleNavigationLoad(landedId) {
    let isLoadingNavigation = state.transition.state === "loading";
    if (isLoadingNavigation && navigationLoadId < landedId) {
      abortNormalNavigation();
      return true;
    }
    return false;
  }
  function markFetchersDone(keys) {
    for (let key of keys) {
      let fetcher = getFetcher(key);
      let doneFetcher = {
        state: "idle",
        type: "done",
        data: fetcher.data,
        submission: void 0
      };
      state.fetchers.set(key, doneFetcher);
    }
  }
  function abortStaleFetchLoads(landedId) {
    let yeetedKeys = [];
    for (let [key, id] of fetchReloadIds) {
      if (id < landedId) {
        let fetcher = state.fetchers.get(key);
        invariant(fetcher, `Expected fetcher: ${key}`);
        if (fetcher.state === "loading") {
          abortFetcher(key);
          fetchReloadIds.delete(key);
          yeetedKeys.push(key);
        }
      }
    }
    return yeetedKeys.length ? yeetedKeys : false;
  }
  async function handleLoaderFetchSubmission(href, key, submission, match) {
    let fetcher = {
      state: "submitting",
      type: "loaderSubmission",
      submission,
      data: void 0
    };
    state.fetchers.set(key, fetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callLoader(match, createUrl(href), controller.signal);
    fetchControllers.delete(key);
    if (controller.signal.aborted) {
      return;
    }
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }
    if (maybeBailOnError(match, key, result)) {
      return;
    }
    if (await maybeBailOnCatch(match, key, result)) {
      return;
    }
    let doneFetcher = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: void 0
    };
    state.fetchers.set(key, doneFetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
  }
  async function handleLoaderFetch(href, key, match) {
    let fetcher = {
      state: "loading",
      type: "normalLoad",
      submission: void 0,
      data: void 0
    };
    state.fetchers.set(key, fetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callLoader(match, createUrl(href), controller.signal);
    fetchControllers.delete(key);
    if (controller.signal.aborted)
      return;
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "loader"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }
    if (maybeBailOnError(match, key, result)) {
      return;
    }
    if (await maybeBailOnCatch(match, key, result)) {
      return;
    }
    let doneFetcher = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: void 0
    };
    state.fetchers.set(key, doneFetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
  }
  async function maybeBailOnCatch(match, key, result) {
    if (isCatchResult(result)) {
      let catchBoundaryId = findNearestCatchBoundary(match, state.matches);
      state.fetchers.delete(key);
      update({
        transition: IDLE_TRANSITION,
        fetchers: new Map(state.fetchers),
        catch: {
          data: result.value.data,
          status: result.value.status,
          statusText: result.value.statusText
        },
        catchBoundaryId
      });
      return true;
    }
    return false;
  }
  function maybeBailOnError(match, key, result) {
    if (isErrorResult(result)) {
      let errorBoundaryId = findNearestBoundary(match, state.matches);
      state.fetchers.delete(key);
      update({
        fetchers: new Map(state.fetchers),
        error: result.value,
        errorBoundaryId
      });
      return true;
    }
    return false;
  }
  async function handleNotFoundNavigation(location, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "loading",
      type: "normalLoad",
      submission: void 0,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await Promise.resolve();
    let catchBoundaryId = findNearestCatchBoundary(matches2[0], matches2);
    update({
      location,
      matches: matches2,
      catch: {
        data: null,
        status: 404,
        statusText: "Not Found"
      },
      catchBoundaryId,
      transition: IDLE_TRANSITION
    });
  }
  async function handleActionSubmissionNavigation(location, submission, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "submitting",
      type: "actionSubmission",
      submission,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    let controller = new AbortController();
    pendingNavigationController = controller;
    if (!isIndexRequestAction(submission.action) && matches2[matches2.length - 1].route.id.endsWith("/index")) {
      matches2 = matches2.slice(0, -1);
    }
    let leafMatch = matches2.slice(-1)[0];
    let result = await callAction(submission, leafMatch, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "action"
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }
    if (isCatchResult(result)) {
      let [catchVal, catchBoundaryId] = await findCatchAndBoundaryId([result], matches2, result);
      update({
        transition: IDLE_TRANSITION,
        catch: catchVal,
        catchBoundaryId
      });
      return;
    }
    let loadTransition = {
      state: "loading",
      type: "actionReload",
      submission,
      location
    };
    update({
      transition: loadTransition,
      actionData: {
        [leafMatch.route.id]: result.value
      }
    });
    await loadPageData(location, matches2, submission, result);
  }
  async function handleLoaderSubmissionNavigation(location, submission, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "submitting",
      type: "loaderSubmission",
      submission,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2, submission);
  }
  async function handleHashChange(location, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "loading",
      type: "normalLoad",
      submission: void 0,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await Promise.resolve();
    update({
      location,
      matches: matches2,
      transition: IDLE_TRANSITION
    });
  }
  async function handleLoad(location, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "loading",
      type: "normalLoad",
      submission: void 0,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2);
  }
  async function handleLoaderRedirect(location, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "loading",
      type: "normalRedirect",
      submission: void 0,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2);
  }
  async function handleLoaderSubmissionRedirect(location, matches2) {
    abortNormalNavigation();
    invariant(state.transition.type === "loaderSubmission", `Unexpected transition: ${JSON.stringify(state.transition)}`);
    let {
      submission
    } = state.transition;
    let transition = {
      state: "loading",
      type: "loaderSubmissionRedirect",
      submission,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2, submission);
  }
  async function handleFetchActionRedirect(location, matches2) {
    abortNormalNavigation();
    let transition = {
      state: "loading",
      type: "fetchActionRedirect",
      submission: void 0,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2);
  }
  async function handleActionRedirect(location, matches2) {
    abortNormalNavigation();
    invariant(state.transition.type === "actionSubmission" || state.transition.type === "actionReload", `Unexpected transition: ${JSON.stringify(state.transition)}`);
    let {
      submission
    } = state.transition;
    let transition = {
      state: "loading",
      type: "actionRedirect",
      submission,
      location
    };
    update({
      transition,
      nextMatches: matches2
    });
    await loadPageData(location, matches2, submission);
  }
  function isHashChangeOnly(location) {
    return createHref(state.location) === createHref(location) && state.location.hash !== location.hash;
  }
  async function loadPageData(location, matches2, submission, actionResult) {
    let maybeActionErrorResult = actionResult && isErrorResult(actionResult) ? actionResult : void 0;
    let maybeActionCatchResult = actionResult && isCatchResult(actionResult) ? actionResult : void 0;
    let controller = new AbortController();
    pendingNavigationController = controller;
    navigationLoadId = ++incrementingLoadId;
    let results = await callLoaders(state, createUrl(createHref(location)), matches2, controller.signal, maybeActionErrorResult, maybeActionCatchResult, submission);
    if (controller.signal.aborted) {
      return;
    }
    let redirect = findRedirect(results);
    if (redirect) {
      if (state.transition.type === "actionReload") {
        let locationState = {
          isRedirect: true,
          type: "action"
        };
        init.onRedirect(redirect.location, locationState);
      } else if (state.transition.type === "loaderSubmission") {
        let locationState = {
          isRedirect: true,
          type: "loaderSubmission"
        };
        init.onRedirect(redirect.location, locationState);
      } else {
        let locationState = {
          isRedirect: true,
          type: "loader"
        };
        init.onRedirect(redirect.location, locationState);
      }
      return;
    }
    let [error, errorBoundaryId] = findErrorAndBoundaryId(results, matches2, maybeActionErrorResult);
    let [catchVal, catchBoundaryId] = await findCatchAndBoundaryId(results, matches2, maybeActionErrorResult);
    let abortedIds = abortStaleFetchLoads(navigationLoadId);
    if (abortedIds) {
      markFetchersDone(abortedIds);
    }
    update({
      location,
      matches: matches2,
      error,
      errorBoundaryId,
      catch: catchVal,
      catchBoundaryId,
      loaderData: makeLoaderData(state, results, matches2),
      actionData: state.transition.type === "actionReload" ? state.actionData : void 0,
      transition: IDLE_TRANSITION,
      fetchers: abortedIds ? new Map(state.fetchers) : state.fetchers
    });
  }
  function abortNormalNavigation() {
    var _pendingNavigationCon;
    (_pendingNavigationCon = pendingNavigationController) === null || _pendingNavigationCon === void 0 ? void 0 : _pendingNavigationCon.abort();
  }
  function abortFetcher(key) {
    let controller = fetchControllers.get(key);
    invariant(controller, `Expected fetch controller: ${key}`);
    controller.abort();
    fetchControllers.delete(key);
  }
  return {
    send,
    getState,
    getFetcher,
    deleteFetcher,
    dispose,
    get _internalFetchControllers() {
      return fetchControllers;
    }
  };
}
function isIndexRequestAction(action) {
  let indexRequest = false;
  let searchParams = new URLSearchParams(action.split("?", 2)[1] || "");
  for (let param of searchParams.getAll("index")) {
    if (!param) {
      indexRequest = true;
    }
  }
  return indexRequest;
}
async function callLoaders(state, url, matches, signal, actionErrorResult, actionCatchResult, submission, fetcher) {
  let matchesToLoad = filterMatchesToLoad(state, url, matches, actionErrorResult, actionCatchResult, submission, fetcher);
  return Promise.all(matchesToLoad.map((match) => callLoader(match, url, signal)));
}
async function callLoader(match, url, signal) {
  invariant(match.route.loader, `Expected loader for ${match.route.id}`);
  try {
    let {
      params
    } = match;
    let value = await match.route.loader({
      params,
      url,
      signal
    });
    return {
      match,
      value
    };
  } catch (error) {
    return {
      match,
      value: error
    };
  }
}
async function callAction(submission, match, signal) {
  if (!match.route.action) {
    throw new Error(`Route "${match.route.id}" does not have an action, but you are trying to submit to it. To fix this, please add an \`action\` function to the route`);
  }
  try {
    let value = await match.route.action({
      url: createUrl(submission.action),
      params: match.params,
      submission,
      signal
    });
    return {
      match,
      value
    };
  } catch (error) {
    return {
      match,
      value: error
    };
  }
}
function filterMatchesToLoad(state, url, matches, actionErrorResult, actionCatchResult, submission, fetcher) {
  let isNew = (match, index) => {
    if (!state.matches[index])
      return true;
    return match.route.id !== state.matches[index].route.id;
  };
  let matchPathChanged = (match, index) => {
    var _state$matches$index$;
    return state.matches[index].pathname !== match.pathname || ((_state$matches$index$ = state.matches[index].route.path) === null || _state$matches$index$ === void 0 ? void 0 : _state$matches$index$.endsWith("*")) && state.matches[index].params["*"] !== match.params["*"];
  };
  let filterByRouteProps = (match, index) => {
    if (!match.route.loader) {
      return false;
    }
    if (isNew(match, index) || matchPathChanged(match, index)) {
      return true;
    }
    if (match.route.shouldReload) {
      let prevUrl = createUrl(createHref(state.location));
      return match.route.shouldReload({
        prevUrl,
        url,
        submission,
        params: match.params
      });
    }
    return true;
  };
  let isInRootCatchBoundary = state.matches.length === 1;
  if (isInRootCatchBoundary) {
    return matches.filter((match) => !!match.route.loader);
  }
  if ((fetcher === null || fetcher === void 0 ? void 0 : fetcher.type) === "actionReload") {
    return matches.filter(filterByRouteProps);
  } else if (state.transition.type === "actionReload" || state.transition.type === "actionRedirect" || createHref(url) === createHref(state.location) || url.searchParams.toString() !== state.location.search) {
    return matches.filter(filterByRouteProps);
  }
  return matches.filter((match, index, arr) => {
    if ((actionErrorResult || actionCatchResult) && arr.length - 1 === index) {
      return false;
    }
    return match.route.loader && (isNew(match, index) || matchPathChanged(match, index));
  });
}
function isRedirectResult(result) {
  return result.value instanceof TransitionRedirect;
}
function createHref(location) {
  return location.pathname + location.search;
}
function findRedirect(results) {
  for (let result of results) {
    if (isRedirectResult(result)) {
      return result.value;
    }
  }
  return null;
}
async function findCatchAndBoundaryId(results, matches, actionCatchResult) {
  let loaderCatchResult;
  for (let result of results) {
    if (isCatchResult(result)) {
      loaderCatchResult = result;
      break;
    }
  }
  let extractCatchData = async (res) => ({
    status: res.status,
    statusText: res.statusText,
    data: res.data
  });
  if (actionCatchResult && loaderCatchResult) {
    let boundaryId = findNearestCatchBoundary(loaderCatchResult.match, matches);
    return [await extractCatchData(actionCatchResult.value), boundaryId];
  }
  if (loaderCatchResult) {
    let boundaryId = findNearestCatchBoundary(loaderCatchResult.match, matches);
    return [await extractCatchData(loaderCatchResult.value), boundaryId];
  }
  return [void 0, void 0];
}
function findErrorAndBoundaryId(results, matches, actionErrorResult) {
  let loaderErrorResult;
  for (let result of results) {
    if (isErrorResult(result)) {
      loaderErrorResult = result;
      break;
    }
  }
  if (actionErrorResult && loaderErrorResult) {
    let boundaryId = findNearestBoundary(loaderErrorResult.match, matches);
    return [actionErrorResult.value, boundaryId];
  }
  if (actionErrorResult) {
    let boundaryId = findNearestBoundary(actionErrorResult.match, matches);
    return [actionErrorResult.value, boundaryId];
  }
  if (loaderErrorResult) {
    let boundaryId = findNearestBoundary(loaderErrorResult.match, matches);
    return [loaderErrorResult.value, boundaryId];
  }
  return [void 0, void 0];
}
function findNearestCatchBoundary(matchWithError, matches) {
  let nearestBoundaryId = null;
  for (let match of matches) {
    if (match.route.CatchBoundary) {
      nearestBoundaryId = match.route.id;
    }
    if (match === matchWithError) {
      break;
    }
  }
  return nearestBoundaryId;
}
function findNearestBoundary(matchWithError, matches) {
  let nearestBoundaryId = null;
  for (let match of matches) {
    if (match.route.ErrorBoundary) {
      nearestBoundaryId = match.route.id;
    }
    if (match === matchWithError) {
      break;
    }
  }
  return nearestBoundaryId;
}
function makeLoaderData(state, results, matches) {
  let newData = {};
  for (let {
    match,
    value
  } of results) {
    newData[match.route.id] = value;
  }
  let loaderData = {};
  for (let {
    route
  } of matches) {
    let value = newData[route.id] !== void 0 ? newData[route.id] : state.loaderData[route.id];
    if (value !== void 0) {
      loaderData[route.id] = value;
    }
  }
  return loaderData;
}
function isCatchResult(result) {
  return result.value instanceof CatchValue;
}
function isErrorResult(result) {
  return result.value instanceof Error;
}
function createUrl(href) {
  return new URL(href, window.location.origin);
}

// node_modules/@remix-run/react/browser/routes.js
function createClientRoute(entryRoute, routeModulesCache, Component) {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    element: /* @__PURE__ */ import_react2.default.createElement(Component, {
      id: entryRoute.id
    }),
    id: entryRoute.id,
    path: entryRoute.path,
    index: entryRoute.index,
    module: entryRoute.module,
    loader: createLoader(entryRoute, routeModulesCache),
    action: createAction(entryRoute),
    shouldReload: createShouldReload(entryRoute, routeModulesCache),
    ErrorBoundary: entryRoute.hasErrorBoundary,
    CatchBoundary: entryRoute.hasCatchBoundary,
    hasLoader: entryRoute.hasLoader
  };
}
function createClientRoutes(routeManifest, routeModulesCache, Component, parentId) {
  return Object.keys(routeManifest).filter((key) => routeManifest[key].parentId === parentId).map((key) => {
    let route = createClientRoute(routeManifest[key], routeModulesCache, Component);
    let children = createClientRoutes(routeManifest, routeModulesCache, Component, route.id);
    if (children.length > 0)
      route.children = children;
    return route;
  });
}
function createShouldReload(route, routeModules) {
  let shouldReload = (arg) => {
    let module = routeModules[route.id];
    invariant(module, `Expected route module to be loaded for ${route.id}`);
    if (module.unstable_shouldReload) {
      return module.unstable_shouldReload(arg);
    }
    return true;
  };
  return shouldReload;
}
async function loadRouteModuleWithBlockingLinks(route, routeModules) {
  let routeModule = await loadRouteModule(route, routeModules);
  await prefetchStyleLinks(routeModule);
  return routeModule;
}
function createLoader(route, routeModules) {
  let loader = async ({
    url,
    signal,
    submission
  }) => {
    if (route.hasLoader) {
      let [result] = await Promise.all([fetchData(url, route.id, signal, submission), loadRouteModuleWithBlockingLinks(route, routeModules)]);
      if (result instanceof Error)
        throw result;
      let redirect = await checkRedirect(result);
      if (redirect)
        return redirect;
      if (isCatchResponse(result)) {
        throw new CatchValue(result.status, result.statusText, await extractData(result.clone()));
      }
      let data = await extractData(result);
      return data;
    } else {
      await loadRouteModuleWithBlockingLinks(route, routeModules);
    }
  };
  return loader;
}
function createAction(route) {
  if (!route.hasAction)
    return void 0;
  let action = async ({
    url,
    signal,
    submission
  }) => {
    let result = await fetchData(url, route.id, signal, submission);
    if (result instanceof Error) {
      throw result;
    }
    if (isCatchResponse(result)) {
      throw new CatchValue(result.status, result.statusText, await extractData(result.clone()));
    }
    let redirect = await checkRedirect(result);
    if (redirect)
      return redirect;
    return extractData(result);
  };
  return action;
}
async function checkRedirect(response) {
  if (isRedirectResponse(response)) {
    let url = new URL(response.headers.get("X-Remix-Redirect"), window.location.origin);
    if (url.origin !== window.location.origin) {
      await new Promise(() => {
        window.location.replace(url.href);
      });
    } else {
      return new TransitionRedirect(url.pathname + url.search);
    }
  }
  return null;
}

// node_modules/@remix-run/react/browser/components.js
var RemixEntryContext = /* @__PURE__ */ import_react3.default.createContext(void 0);
function useRemixEntryContext() {
  let context = import_react3.default.useContext(RemixEntryContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}
function RemixEntry({
  context: entryContext,
  action,
  location: historyLocation,
  navigator: _navigator,
  static: staticProp = false
}) {
  let {
    manifest,
    routeData: documentLoaderData,
    actionData: documentActionData,
    routeModules,
    serverHandoffString,
    componentDidCatchEmulator: entryComponentDidCatchEmulator
  } = entryContext;
  let clientRoutes = import_react3.default.useMemo(() => createClientRoutes(manifest.routes, routeModules, RemixRoute), [manifest, routeModules]);
  let [clientState, setClientState] = import_react3.default.useState(entryComponentDidCatchEmulator);
  let [transitionManager] = import_react3.default.useState(() => {
    return createTransitionManager({
      routes: clientRoutes,
      actionData: documentActionData,
      loaderData: documentLoaderData,
      location: historyLocation,
      catch: entryComponentDidCatchEmulator.catch,
      catchBoundaryId: entryComponentDidCatchEmulator.catchBoundaryRouteId,
      onRedirect: _navigator.replace,
      onChange: (state) => {
        setClientState({
          catch: state.catch,
          error: state.error,
          catchBoundaryRouteId: state.catchBoundaryId,
          loaderBoundaryRouteId: state.errorBoundaryId,
          renderBoundaryRouteId: null,
          trackBoundaries: false,
          trackCatchBoundaries: false
        });
      }
    });
  });
  let navigator = import_react3.default.useMemo(() => {
    let push = (to, state) => {
      return transitionManager.getState().transition.state !== "idle" ? _navigator.replace(to, state) : _navigator.push(to, state);
    };
    return {
      ..._navigator,
      push
    };
  }, [_navigator, transitionManager]);
  let {
    location,
    matches,
    loaderData,
    actionData
  } = transitionManager.getState();
  import_react3.default.useEffect(() => {
    let {
      location: location2
    } = transitionManager.getState();
    if (historyLocation === location2)
      return;
    transitionManager.send({
      type: "navigation",
      location: historyLocation,
      submission: consumeNextNavigationSubmission(),
      action
    });
  }, [transitionManager, historyLocation, action]);
  let ssrErrorBeforeRoutesRendered = clientState.error && clientState.renderBoundaryRouteId === null && clientState.loaderBoundaryRouteId === null ? deserializeError(clientState.error) : void 0;
  let ssrCatchBeforeRoutesRendered = clientState.catch && clientState.catchBoundaryRouteId === null ? clientState.catch : void 0;
  return /* @__PURE__ */ import_react3.default.createElement(RemixEntryContext.Provider, {
    value: {
      matches,
      manifest,
      componentDidCatchEmulator: clientState,
      routeModules,
      serverHandoffString,
      clientRoutes,
      routeData: loaderData,
      actionData,
      transitionManager
    }
  }, /* @__PURE__ */ import_react3.default.createElement(RemixErrorBoundary, {
    location,
    component: RemixRootDefaultErrorBoundary,
    error: ssrErrorBeforeRoutesRendered
  }, /* @__PURE__ */ import_react3.default.createElement(RemixCatchBoundary, {
    location,
    component: RemixRootDefaultCatchBoundary,
    catch: ssrCatchBeforeRoutesRendered
  }, /* @__PURE__ */ import_react3.default.createElement(import_react_router_dom2.Router, {
    navigationType: action,
    location,
    navigator,
    static: staticProp
  }, /* @__PURE__ */ import_react3.default.createElement(Routes, null)))));
}
function deserializeError(data) {
  let error = new Error(data.message);
  error.stack = data.stack;
  return error;
}
function Routes() {
  let {
    clientRoutes
  } = useRemixEntryContext();
  let element = (0, import_react_router_dom2.useRoutes)(clientRoutes) || clientRoutes[0].element;
  return element;
}
var RemixRouteContext = /* @__PURE__ */ import_react3.default.createContext(void 0);
function useRemixRouteContext() {
  let context = import_react3.default.useContext(RemixRouteContext);
  invariant(context, "You must render this element in a remix route element");
  return context;
}
function DefaultRouteComponent({
  id
}) {
  throw new Error(`Route "${id}" has no component! Please go add a \`default\` export in the route module file.
If you were trying to navigate or submit to a resource route, use \`<a>\` instead of \`<Link>\` or \`<Form reloadDocument>\`.`);
}
function RemixRoute({
  id
}) {
  let location = (0, import_react_router_dom2.useLocation)();
  let {
    routeData,
    routeModules,
    componentDidCatchEmulator
  } = useRemixEntryContext();
  let data = routeData[id];
  let {
    default: Component,
    CatchBoundary,
    ErrorBoundary
  } = routeModules[id];
  let element = Component ? /* @__PURE__ */ import_react3.default.createElement(Component, null) : /* @__PURE__ */ import_react3.default.createElement(DefaultRouteComponent, {
    id
  });
  let context = {
    data,
    id
  };
  if (CatchBoundary) {
    let maybeServerCaught = componentDidCatchEmulator.catch && componentDidCatchEmulator.catchBoundaryRouteId === id ? componentDidCatchEmulator.catch : void 0;
    if (componentDidCatchEmulator.trackCatchBoundaries) {
      componentDidCatchEmulator.catchBoundaryRouteId = id;
    }
    context = maybeServerCaught ? {
      id,
      get data() {
        console.error("You cannot `useLoaderData` in a catch boundary.");
        return void 0;
      }
    } : {
      id,
      data
    };
    element = /* @__PURE__ */ import_react3.default.createElement(RemixCatchBoundary, {
      location,
      component: CatchBoundary,
      catch: maybeServerCaught
    }, element);
  }
  if (ErrorBoundary) {
    let maybeServerRenderError = componentDidCatchEmulator.error && (componentDidCatchEmulator.renderBoundaryRouteId === id || componentDidCatchEmulator.loaderBoundaryRouteId === id) ? deserializeError(componentDidCatchEmulator.error) : void 0;
    if (componentDidCatchEmulator.trackBoundaries) {
      componentDidCatchEmulator.renderBoundaryRouteId = id;
    }
    context = maybeServerRenderError ? {
      id,
      get data() {
        console.error("You cannot `useLoaderData` in an error boundary.");
        return void 0;
      }
    } : {
      id,
      data
    };
    element = /* @__PURE__ */ import_react3.default.createElement(RemixErrorBoundary, {
      location,
      component: ErrorBoundary,
      error: maybeServerRenderError
    }, element);
  }
  return /* @__PURE__ */ import_react3.default.createElement(RemixRouteContext.Provider, {
    value: context
  }, element);
}
function usePrefetchBehavior(prefetch, theirElementProps) {
  let [maybePrefetch, setMaybePrefetch] = import_react3.default.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = import_react3.default.useState(false);
  let {
    onFocus,
    onBlur,
    onMouseEnter,
    onMouseLeave,
    onTouchStart
  } = theirElementProps;
  import_react3.default.useEffect(() => {
    if (prefetch === "render") {
      setShouldPrefetch(true);
    }
  }, [prefetch]);
  let setIntent = () => {
    if (prefetch === "intent") {
      setMaybePrefetch(true);
    }
  };
  let cancelIntent = () => {
    if (prefetch === "intent") {
      setMaybePrefetch(false);
    }
  };
  import_react3.default.useEffect(() => {
    if (maybePrefetch) {
      let id = setTimeout(() => {
        setShouldPrefetch(true);
      }, 100);
      return () => {
        clearTimeout(id);
      };
    }
  }, [maybePrefetch]);
  return [shouldPrefetch, {
    onFocus: composeEventHandlers(onFocus, setIntent),
    onBlur: composeEventHandlers(onBlur, cancelIntent),
    onMouseEnter: composeEventHandlers(onMouseEnter, setIntent),
    onMouseLeave: composeEventHandlers(onMouseLeave, cancelIntent),
    onTouchStart: composeEventHandlers(onTouchStart, setIntent)
  }];
}
var Link = /* @__PURE__ */ import_react3.default.forwardRef(({
  to,
  prefetch = "none",
  ...props
}, forwardedRef) => {
  let href = (0, import_react_router_dom2.useHref)(to);
  let [shouldPrefetch, prefetchHandlers] = usePrefetchBehavior(prefetch, props);
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement(import_react_router_dom2.Link, _extends({
    ref: forwardedRef,
    to
  }, prefetchHandlers, props)), shouldPrefetch && /* @__PURE__ */ import_react3.default.createElement(PrefetchPageLinks, {
    page: href
  }));
});
function composeEventHandlers(theirHandler, ourHandler) {
  return (event) => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}
function Links() {
  let {
    matches,
    routeModules,
    manifest
  } = useRemixEntryContext();
  let links = import_react3.default.useMemo(() => getLinksForMatches(matches, routeModules, manifest), [matches, routeModules, manifest]);
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, links.map((link) => isPageLinkDescriptor(link) ? /* @__PURE__ */ import_react3.default.createElement(PrefetchPageLinks, _extends({
    key: link.page
  }, link)) : /* @__PURE__ */ import_react3.default.createElement("link", _extends({
    key: link.rel + link.href
  }, link))));
}
function PrefetchPageLinks({
  page,
  ...dataLinkProps
}) {
  let {
    clientRoutes
  } = useRemixEntryContext();
  let matches = import_react3.default.useMemo(() => matchClientRoutes(clientRoutes, page), [clientRoutes, page]);
  if (!matches) {
    console.warn(`Tried to prefetch ${page} but no routes matched.`);
    return null;
  }
  return /* @__PURE__ */ import_react3.default.createElement(PrefetchPageLinksImpl, _extends({
    page,
    matches
  }, dataLinkProps));
}
function usePrefetchedStylesheets(matches) {
  let {
    routeModules
  } = useRemixEntryContext();
  let [styleLinks, setStyleLinks] = import_react3.default.useState([]);
  import_react3.default.useEffect(() => {
    let interrupted = false;
    getStylesheetPrefetchLinks(matches, routeModules).then((links) => {
      if (!interrupted)
        setStyleLinks(links);
    });
    return () => {
      interrupted = true;
    };
  }, [matches, routeModules]);
  return styleLinks;
}
function PrefetchPageLinksImpl({
  page,
  matches: nextMatches,
  ...linkProps
}) {
  let location = (0, import_react_router_dom2.useLocation)();
  let {
    matches,
    manifest
  } = useRemixEntryContext();
  let newMatchesForData = import_react3.default.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, location, "data"), [page, nextMatches, matches, location]);
  let newMatchesForAssets = import_react3.default.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, location, "assets"), [page, nextMatches, matches, location]);
  let dataHrefs = import_react3.default.useMemo(() => getDataLinkHrefs(page, newMatchesForData, manifest), [newMatchesForData, page, manifest]);
  let moduleHrefs = import_react3.default.useMemo(() => getModuleLinkHrefs(newMatchesForAssets, manifest), [newMatchesForAssets, manifest]);
  let styleLinks = usePrefetchedStylesheets(newMatchesForAssets);
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ import_react3.default.createElement("link", _extends({
    key: href,
    rel: "prefetch",
    as: "fetch",
    href
  }, linkProps))), moduleHrefs.map((href) => /* @__PURE__ */ import_react3.default.createElement("link", _extends({
    key: href,
    rel: "modulepreload",
    href
  }, linkProps))), styleLinks.map((link) => /* @__PURE__ */ import_react3.default.createElement("link", _extends({
    key: link.href
  }, link))));
}
function Meta() {
  let {
    matches,
    routeData,
    routeModules
  } = useRemixEntryContext();
  let location = (0, import_react_router_dom2.useLocation)();
  let meta = {};
  let parentsData = {};
  for (let match of matches) {
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;
    let routeModule = routeModules[routeId];
    if (routeModule.meta) {
      let routeMeta = typeof routeModule.meta === "function" ? routeModule.meta({
        data,
        parentsData,
        params,
        location
      }) : routeModule.meta;
      Object.assign(meta, routeMeta);
    }
    parentsData[routeId] = data;
  }
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, Object.keys(meta).map((name) => {
    let value = meta[name];
    let isOpenGraphTag = name.startsWith("og:");
    return name === "title" ? /* @__PURE__ */ import_react3.default.createElement("title", {
      key: "title"
    }, meta[name]) : Array.isArray(value) ? value.map((content) => isOpenGraphTag ? /* @__PURE__ */ import_react3.default.createElement("meta", {
      key: name + content,
      property: name,
      content
    }) : /* @__PURE__ */ import_react3.default.createElement("meta", {
      key: name + content,
      name,
      content
    })) : isOpenGraphTag ? /* @__PURE__ */ import_react3.default.createElement("meta", {
      key: name,
      property: name,
      content: value
    }) : /* @__PURE__ */ import_react3.default.createElement("meta", {
      key: name,
      name,
      content: value
    });
  }));
}
function Scripts(props) {
  let {
    manifest,
    matches,
    pendingLocation,
    clientRoutes,
    serverHandoffString
  } = useRemixEntryContext();
  let initialScripts = import_react3.default.useMemo(() => {
    let contextScript = serverHandoffString ? `window.__remixContext = ${serverHandoffString};` : "";
    let routeModulesScript = `${matches.map((match, index) => `import * as route${index} from ${JSON.stringify(manifest.routes[match.route.id].module)};`).join("\n")}
window.__remixRouteModules = {${matches.map((match, index) => `${JSON.stringify(match.route.id)}:route${index}`).join(",")}};`;
    return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("script", _extends({}, props, {
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: createHtml(contextScript)
    })), /* @__PURE__ */ import_react3.default.createElement("script", _extends({}, props, {
      src: manifest.url
    })), /* @__PURE__ */ import_react3.default.createElement("script", _extends({}, props, {
      dangerouslySetInnerHTML: createHtml(routeModulesScript),
      type: "module"
    })), /* @__PURE__ */ import_react3.default.createElement("script", _extends({}, props, {
      src: manifest.entry.module,
      type: "module"
    })));
  }, []);
  let nextMatches = import_react3.default.useMemo(() => {
    if (pendingLocation) {
      let matches2 = matchClientRoutes(clientRoutes, pendingLocation);
      invariant(matches2, `No routes match path "${pendingLocation.pathname}"`);
      return matches2;
    }
    return [];
  }, [pendingLocation, clientRoutes]);
  let routePreloads = matches.concat(nextMatches).map((match) => {
    let route = manifest.routes[match.route.id];
    return (route.imports || []).concat([route.module]);
  }).flat(1);
  let preloads = manifest.entry.imports.concat(routePreloads);
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, dedupe2(preloads).map((path) => /* @__PURE__ */ import_react3.default.createElement("link", {
    key: path,
    rel: "modulepreload",
    href: path,
    crossOrigin: props.crossOrigin
  })), initialScripts);
}
function dedupe2(array) {
  return [...new Set(array)];
}
var Form = /* @__PURE__ */ import_react3.default.forwardRef((props, ref) => {
  return /* @__PURE__ */ import_react3.default.createElement(FormImpl, _extends({}, props, {
    ref
  }));
});
var FormImpl = /* @__PURE__ */ import_react3.default.forwardRef(({
  reloadDocument = false,
  replace = false,
  method = "get",
  action = ".",
  encType = "application/x-www-form-urlencoded",
  fetchKey,
  onSubmit,
  ...props
}, forwardedRef) => {
  let submit = useSubmitImpl(fetchKey);
  let formMethod = method.toLowerCase() === "get" ? "get" : "post";
  let formAction = useFormAction(action, formMethod);
  let formRef = import_react3.default.useRef();
  let ref = useComposedRefs(forwardedRef, formRef);
  let clickedButtonRef = import_react3.default.useRef();
  import_react3.default.useEffect(() => {
    let form = formRef.current;
    if (!form)
      return;
    function handleClick(event) {
      if (!(event.target instanceof HTMLElement))
        return;
      let submitButton = event.target.closest("button,input[type=submit]");
      if (submitButton && submitButton.type === "submit") {
        clickedButtonRef.current = submitButton;
      }
    }
    form.addEventListener("click", handleClick);
    return () => {
      form && form.removeEventListener("click", handleClick);
    };
  }, []);
  return /* @__PURE__ */ import_react3.default.createElement("form", _extends({
    ref,
    method: formMethod,
    action: formAction,
    encType,
    onSubmit: reloadDocument ? void 0 : (event) => {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented)
        return;
      event.preventDefault();
      submit(clickedButtonRef.current || event.currentTarget, {
        method,
        replace
      });
      clickedButtonRef.current = null;
    }
  }, props));
});
function isActionRequestMethod(method) {
  method = method.toLowerCase();
  return method === "post" || method === "put" || method === "patch" || method === "delete";
}
function useFormAction(action = ".", method = "get") {
  let {
    id
  } = useRemixRouteContext();
  let path = (0, import_react_router_dom2.useResolvedPath)(action);
  let search = path.search;
  let isIndexRoute = id.endsWith("/index");
  if (action === "." && isIndexRoute && isActionRequestMethod(method)) {
    search = search ? search.replace(/^\?/, "?index&") : "?index";
  }
  return path.pathname + search;
}
function useSubmitImpl(key) {
  let navigate = (0, import_react_router_dom2.useNavigate)();
  let defaultAction = useFormAction();
  let {
    transitionManager
  } = useRemixEntryContext();
  return import_react3.default.useCallback((target, options = {}) => {
    let method;
    let action;
    let encType;
    let formData;
    if (isFormElement(target)) {
      let submissionTrigger = options.submissionTrigger;
      method = options.method || target.method;
      action = options.action || target.action;
      encType = options.encType || target.enctype;
      formData = new FormData(target);
      if (submissionTrigger && submissionTrigger.name) {
        formData.append(submissionTrigger.name, submissionTrigger.value);
      }
    } else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
      let form = target.form;
      if (form == null) {
        throw new Error(`Cannot submit a <button> without a <form>`);
      }
      method = options.method || target.getAttribute("formmethod") || form.method;
      action = options.action || target.getAttribute("formaction") || form.action;
      encType = options.encType || target.getAttribute("formenctype") || form.enctype;
      formData = new FormData(form);
      if (target.name) {
        formData.set(target.name, target.value);
      }
    } else {
      if (isHtmlElement(target)) {
        throw new Error(`Cannot submit element that is not <form>, <button>, or <input type="submit|image">`);
      }
      method = options.method || "get";
      action = options.action || defaultAction;
      encType = options.encType || "application/x-www-form-urlencoded";
      if (target instanceof FormData) {
        formData = target;
      } else {
        formData = new FormData();
        if (target instanceof URLSearchParams) {
          for (let [name, value] of target) {
            formData.set(name, value);
          }
        } else if (target != null) {
          for (let name of Object.keys(target)) {
            formData.set(name, target[name]);
          }
        }
      }
    }
    let {
      protocol,
      host
    } = window.location;
    let url = new URL(action, `${protocol}//${host}`);
    if (method.toLowerCase() === "get") {
      for (let [name, value] of formData) {
        if (typeof value === "string") {
          url.searchParams.set(name, value);
        } else {
          throw new Error(`Cannot submit binary form data using GET`);
        }
      }
    }
    let submission = {
      formData,
      action: url.pathname + url.search,
      method: method.toUpperCase(),
      encType,
      key: Math.random().toString(36).substr(2, 8)
    };
    if (key) {
      transitionManager.send({
        type: "fetcher",
        href: submission.action,
        submission,
        key
      });
    } else {
      setNextNavigationSubmission(submission);
      navigate(url.pathname + url.search, {
        replace: options.replace
      });
    }
  }, [defaultAction, key, navigate, transitionManager]);
}
var nextNavigationSubmission;
function setNextNavigationSubmission(submission) {
  nextNavigationSubmission = submission;
}
function consumeNextNavigationSubmission() {
  let submission = nextNavigationSubmission;
  nextNavigationSubmission = void 0;
  return submission;
}
function isHtmlElement(object) {
  return object != null && typeof object.tagName === "string";
}
function isButtonElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "button";
}
function isFormElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "form";
}
function isInputElement(object) {
  return isHtmlElement(object) && object.tagName.toLowerCase() === "input";
}
function useLoaderData() {
  return useRemixRouteContext().data;
}
function useActionData() {
  let {
    id: routeId
  } = useRemixRouteContext();
  let {
    transitionManager
  } = useRemixEntryContext();
  let {
    actionData
  } = transitionManager.getState();
  return actionData ? actionData[routeId] : void 0;
}
function LiveReload({
  port = 8002
}) {
  if (false)
    return null;
  return /* @__PURE__ */ import_react3.default.createElement("script", {
    dangerouslySetInnerHTML: {
      __html: `
          let ws = new WebSocket("ws://localhost:${port}/socket");
          ws.onmessage = message => {
            let event = JSON.parse(message.data);
            if (event.type === "LOG") {
              console.log(event.message);
            }
            if (event.type === "RELOAD") {
              console.log("\u{1F4BF} Reloading window ...");
              window.location.reload();
            }
          };
          ws.onerror = error => {
            console.log("Remix dev asset server web socket error:");
            console.error(error);
          };
      `
    }
  });
}
function useComposedRefs(...refs) {
  return import_react3.default.useCallback((node) => {
    for (let ref of refs) {
      if (ref == null)
        continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        try {
          ref.current = node;
        } catch (_) {
        }
      }
    }
  }, refs);
}

// node_modules/@remix-run/react/browser/browser.js
function RemixBrowser(_props) {
  let historyRef = import_react4.default.useRef();
  if (historyRef.current == null) {
    historyRef.current = (0, import_history3.createBrowserHistory)({
      window
    });
  }
  let history = historyRef.current;
  let [state, dispatch] = import_react4.default.useReducer((_, update) => update, {
    action: history.action,
    location: history.location
  });
  import_react4.default.useLayoutEffect(() => history.listen(dispatch), [history]);
  let entryContext = window.__remixContext;
  entryContext.manifest = window.__remixManifest;
  entryContext.routeModules = window.__remixRouteModules;
  entryContext.componentDidCatchEmulator.trackBoundaries = false;
  entryContext.componentDidCatchEmulator.trackCatchBoundaries = false;
  return /* @__PURE__ */ import_react4.default.createElement(RemixEntry, {
    context: entryContext,
    action: state.action,
    location: state.location,
    navigator: history
  });
}

// node_modules/@remix-run/react/browser/index.js
init_react();
var import_react_router_dom3 = __toModule(require_main3());

// node_modules/remix/browser/client.js
init_react();

export {
  require_main3 as require_main,
  useCatch,
  Link,
  Links,
  Meta,
  Scripts,
  Form,
  useLoaderData,
  useActionData,
  LiveReload,
  RemixBrowser,
  import_react_router_dom3 as import_react_router_dom
};
/**
 * @remix-run/react v1.0.0-rc.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * React Router DOM v6.0.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * React Router v6.0.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
//# sourceMappingURL=/build/_shared/chunk-P2NWWZRW.js.map
