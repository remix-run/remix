import {
  __esm,
  __toESM,
  init_react,
  require_react
} from "/build/_shared/chunk-O6YYFGCX.js";

// node_modules/@babel/runtime/helpers/esm/extends.js
function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function(target) {
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
var init_extends = __esm({
  "node_modules/@babel/runtime/helpers/esm/extends.js"() {
    init_react();
  }
});

// node_modules/history/index.js
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
function createBrowserHistory(options) {
  if (options === void 0) {
    options = {};
  }
  var _options = options, _options$window = _options.window, window2 = _options$window === void 0 ? document.defaultView : _options$window;
  var globalHistory = window2.history;
  function getIndexAndLocation() {
    var _window$location = window2.location, pathname = _window$location.pathname, search = _window$location.search, hash = _window$location.hash;
    var state = globalHistory.state || {};
    return [state.idx, readOnly({
      pathname,
      search,
      hash,
      state: state.usr || null,
      key: state.key || "default"
    })];
  }
  var blockedPopTx = null;
  function handlePop() {
    if (blockedPopTx) {
      blockers.call(blockedPopTx);
      blockedPopTx = null;
    } else {
      var nextAction = Action.Pop;
      var _getIndexAndLocation = getIndexAndLocation(), nextIndex = _getIndexAndLocation[0], nextLocation = _getIndexAndLocation[1];
      if (blockers.length) {
        if (nextIndex != null) {
          var delta = index - nextIndex;
          if (delta) {
            blockedPopTx = {
              action: nextAction,
              location: nextLocation,
              retry: function retry() {
                go(delta * -1);
              }
            };
            go(delta);
          }
        } else {
          true ? warning(false, "You are trying to block a POP navigation to a location that was not created by the history library. The block will fail silently in production, but in general you should do all navigation with the history library (instead of using window.history.pushState directly) to avoid this situation.") : void 0;
        }
      } else {
        applyTx(nextAction);
      }
    }
  }
  window2.addEventListener(PopStateEventType, handlePop);
  var action = Action.Pop;
  var _getIndexAndLocation2 = getIndexAndLocation(), index = _getIndexAndLocation2[0], location = _getIndexAndLocation2[1];
  var listeners = createEvents();
  var blockers = createEvents();
  if (index == null) {
    index = 0;
    globalHistory.replaceState(_extends({}, globalHistory.state, {
      idx: index
    }), "");
  }
  function createHref2(to) {
    return typeof to === "string" ? to : createPath(to);
  }
  function getNextLocation(to, state) {
    if (state === void 0) {
      state = null;
    }
    return readOnly(_extends({
      pathname: location.pathname,
      hash: "",
      search: ""
    }, typeof to === "string" ? parsePath(to) : to, {
      state,
      key: createKey()
    }));
  }
  function getHistoryStateAndUrl(nextLocation, index2) {
    return [{
      usr: nextLocation.state,
      key: nextLocation.key,
      idx: index2
    }, createHref2(nextLocation)];
  }
  function allowTx(action2, location2, retry) {
    return !blockers.length || (blockers.call({
      action: action2,
      location: location2,
      retry
    }), false);
  }
  function applyTx(nextAction) {
    action = nextAction;
    var _getIndexAndLocation3 = getIndexAndLocation();
    index = _getIndexAndLocation3[0];
    location = _getIndexAndLocation3[1];
    listeners.call({
      action,
      location
    });
  }
  function push(to, state) {
    var nextAction = Action.Push;
    var nextLocation = getNextLocation(to, state);
    function retry() {
      push(to, state);
    }
    if (allowTx(nextAction, nextLocation, retry)) {
      var _getHistoryStateAndUr = getHistoryStateAndUrl(nextLocation, index + 1), historyState = _getHistoryStateAndUr[0], url = _getHistoryStateAndUr[1];
      try {
        globalHistory.pushState(historyState, "", url);
      } catch (error) {
        window2.location.assign(url);
      }
      applyTx(nextAction);
    }
  }
  function replace(to, state) {
    var nextAction = Action.Replace;
    var nextLocation = getNextLocation(to, state);
    function retry() {
      replace(to, state);
    }
    if (allowTx(nextAction, nextLocation, retry)) {
      var _getHistoryStateAndUr2 = getHistoryStateAndUrl(nextLocation, index), historyState = _getHistoryStateAndUr2[0], url = _getHistoryStateAndUr2[1];
      globalHistory.replaceState(historyState, "", url);
      applyTx(nextAction);
    }
  }
  function go(delta) {
    globalHistory.go(delta);
  }
  var history = {
    get action() {
      return action;
    },
    get location() {
      return location;
    },
    createHref: createHref2,
    push,
    replace,
    go,
    back: function back() {
      go(-1);
    },
    forward: function forward() {
      go(1);
    },
    listen: function listen(listener) {
      return listeners.push(listener);
    },
    block: function block(blocker) {
      var unblock = blockers.push(blocker);
      if (blockers.length === 1) {
        window2.addEventListener(BeforeUnloadEventType, promptBeforeUnload);
      }
      return function() {
        unblock();
        if (!blockers.length) {
          window2.removeEventListener(BeforeUnloadEventType, promptBeforeUnload);
        }
      };
    }
  };
  return history;
}
function promptBeforeUnload(event) {
  event.preventDefault();
  event.returnValue = "";
}
function createEvents() {
  var handlers = [];
  return {
    get length() {
      return handlers.length;
    },
    push: function push(fn) {
      handlers.push(fn);
      return function() {
        handlers = handlers.filter(function(handler) {
          return handler !== fn;
        });
      };
    },
    call: function call(arg) {
      handlers.forEach(function(fn) {
        return fn && fn(arg);
      });
    }
  };
}
function createKey() {
  return Math.random().toString(36).substr(2, 8);
}
function createPath(_ref) {
  var _ref$pathname = _ref.pathname, pathname = _ref$pathname === void 0 ? "/" : _ref$pathname, _ref$search = _ref.search, search = _ref$search === void 0 ? "" : _ref$search, _ref$hash = _ref.hash, hash = _ref$hash === void 0 ? "" : _ref$hash;
  if (search && search !== "?")
    pathname += search.charAt(0) === "?" ? search : "?" + search;
  if (hash && hash !== "#")
    pathname += hash.charAt(0) === "#" ? hash : "#" + hash;
  return pathname;
}
function parsePath(path) {
  var parsedPath = {};
  if (path) {
    var hashIndex = path.indexOf("#");
    if (hashIndex >= 0) {
      parsedPath.hash = path.substr(hashIndex);
      path = path.substr(0, hashIndex);
    }
    var searchIndex = path.indexOf("?");
    if (searchIndex >= 0) {
      parsedPath.search = path.substr(searchIndex);
      path = path.substr(0, searchIndex);
    }
    if (path) {
      parsedPath.pathname = path;
    }
  }
  return parsedPath;
}
var Action, readOnly, BeforeUnloadEventType, PopStateEventType;
var init_history = __esm({
  "node_modules/history/index.js"() {
    init_react();
    init_extends();
    (function(Action2) {
      Action2["Pop"] = "POP";
      Action2["Push"] = "PUSH";
      Action2["Replace"] = "REPLACE";
    })(Action || (Action = {}));
    readOnly = true ? function(obj) {
      return Object.freeze(obj);
    } : function(obj) {
      return obj;
    };
    BeforeUnloadEventType = "beforeunload";
    PopStateEventType = "popstate";
  }
});

// node_modules/react-router/index.js
function invariant(cond, message) {
  if (!cond)
    throw new Error(message);
}
function warning2(cond, message) {
  if (!cond) {
    if (typeof console !== "undefined")
      console.warn(message);
    try {
      throw new Error(message);
    } catch (e) {
    }
  }
}
function warningOnce(key, cond, message) {
  if (!cond && !alreadyWarned[key]) {
    alreadyWarned[key] = true;
    true ? warning2(false, message) : void 0;
  }
}
function matchRoutes(routes, locationArg, basename) {
  if (basename === void 0) {
    basename = "/";
  }
  let location = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
  let pathname = stripBasename(location.pathname || "/", basename);
  if (pathname == null) {
    return null;
  }
  let branches = flattenRoutes(routes);
  rankRouteBranches(branches);
  let matches = null;
  for (let i = 0; matches == null && i < branches.length; ++i) {
    matches = matchRouteBranch(branches[i], pathname);
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
      childrenIndex: index,
      route
    };
    if (meta.relativePath.startsWith("/")) {
      !meta.relativePath.startsWith(parentPath) ? true ? invariant(false, 'Absolute route path "' + meta.relativePath + '" nested under path ' + ('"' + parentPath + '" is not valid. An absolute child route path ') + "must start with the combined path of all its parent routes.") : invariant(false) : void 0;
      meta.relativePath = meta.relativePath.slice(parentPath.length);
    }
    let path = joinPaths([parentPath, meta.relativePath]);
    let routesMeta = parentsMeta.concat(meta);
    if (route.children && route.children.length > 0) {
      !(route.index !== true) ? true ? invariant(false, "Index routes must not have child routes. Please remove " + ('all child routes from route path "' + path + '".')) : invariant(false) : void 0;
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
function matchRouteBranch(branch, pathname) {
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
    let route = meta.route;
    matches.push({
      params: matchedParams,
      pathname: joinPaths([matchedPathname, match.pathname]),
      pathnameBase: normalizePathname(joinPaths([matchedPathname, match.pathnameBase])),
      route
    });
    if (match.pathnameBase !== "/") {
      matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
    }
  }
  return matches;
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
  true ? warning2(path === "*" || !path.endsWith("*") || path.endsWith("/*"), 'Route path "' + path + '" will be treated as if it were ' + ('"' + path.replace(/\*$/, "/*") + '" because the `*` character must ') + "always follow a `/` in the pattern. To get rid of this warning, " + ('please change the route path to "' + path.replace(/\*$/, "/*") + '".')) : void 0;
  let paramNames = [];
  let regexpSource = "^" + path.replace(/\/*\*?$/, "").replace(/^\/*/, "/").replace(/[\\.*+^$?{}|()[\]]/g, "\\$&").replace(/:(\w+)/g, (_, paramName) => {
    paramNames.push(paramName);
    return "([^\\/]+)";
  });
  if (path.endsWith("*")) {
    paramNames.push("*");
    regexpSource += path === "*" || path === "/*" ? "(.*)$" : "(?:\\/(.+)|\\/*)$";
  } else {
    regexpSource += end ? "\\/*$" : "(?:(?=[.~-]|%[0-9A-F]{2})|\\b|\\/|$)";
  }
  let matcher = new RegExp(regexpSource, caseSensitive ? void 0 : "i");
  return [matcher, paramNames];
}
function safelyDecodeURIComponent(value, paramName) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    true ? warning2(false, 'The value for the URL param "' + paramName + '" will not be decoded because' + (' the string "' + value + '" is a malformed URL segment. This is probably') + (" due to a bad percent encoding (" + error + ").")) : void 0;
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
  } = typeof to === "string" ? parsePath(to) : to;
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
  let to = typeof toArg === "string" ? parsePath(toArg) : toArg;
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
  return to === "" || to.pathname === "" ? "/" : typeof to === "string" ? parsePath(to).pathname : to.pathname;
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
function useHref(to) {
  !useInRouterContext() ? true ? invariant(false, "useHref() may be used only in the context of a <Router> component.") : invariant(false) : void 0;
  let {
    basename,
    navigator
  } = (0, import_react.useContext)(NavigationContext);
  let {
    hash,
    pathname,
    search
  } = useResolvedPath(to);
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
  return (0, import_react.useContext)(LocationContext) != null;
}
function useLocation() {
  !useInRouterContext() ? true ? invariant(false, "useLocation() may be used only in the context of a <Router> component.") : invariant(false) : void 0;
  return (0, import_react.useContext)(LocationContext).location;
}
function useNavigate() {
  !useInRouterContext() ? true ? invariant(false, "useNavigate() may be used only in the context of a <Router> component.") : invariant(false) : void 0;
  let {
    basename,
    navigator
  } = (0, import_react.useContext)(NavigationContext);
  let {
    matches
  } = (0, import_react.useContext)(RouteContext);
  let {
    pathname: locationPathname
  } = useLocation();
  let routePathnamesJson = JSON.stringify(matches.map((match) => match.pathnameBase));
  let activeRef = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    activeRef.current = true;
  });
  let navigate = (0, import_react.useCallback)(function(to, options) {
    if (options === void 0) {
      options = {};
    }
    true ? warning2(activeRef.current, "You should call navigate() in a React.useEffect(), not when your component is first rendered.") : void 0;
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
function useOutlet(context) {
  let outlet = (0, import_react.useContext)(RouteContext).outlet;
  if (outlet) {
    return /* @__PURE__ */ (0, import_react.createElement)(OutletContext.Provider, {
      value: context
    }, outlet);
  }
  return outlet;
}
function useResolvedPath(to) {
  let {
    matches
  } = (0, import_react.useContext)(RouteContext);
  let {
    pathname: locationPathname
  } = useLocation();
  let routePathnamesJson = JSON.stringify(matches.map((match) => match.pathnameBase));
  return (0, import_react.useMemo)(() => resolveTo(to, JSON.parse(routePathnamesJson), locationPathname), [to, routePathnamesJson, locationPathname]);
}
function useRoutes(routes, locationArg) {
  !useInRouterContext() ? true ? invariant(false, "useRoutes() may be used only in the context of a <Router> component.") : invariant(false) : void 0;
  let {
    matches: parentMatches
  } = (0, import_react.useContext)(RouteContext);
  let routeMatch = parentMatches[parentMatches.length - 1];
  let parentParams = routeMatch ? routeMatch.params : {};
  let parentPathname = routeMatch ? routeMatch.pathname : "/";
  let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
  let parentRoute = routeMatch && routeMatch.route;
  if (true) {
    let parentPath = parentRoute && parentRoute.path || "";
    warningOnce(parentPathname, !parentRoute || parentPath.endsWith("*"), "You rendered descendant <Routes> (or called `useRoutes()`) at " + ('"' + parentPathname + '" (under <Route path="' + parentPath + '">) but the ') + `parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

` + ('Please change the parent <Route path="' + parentPath + '"> to <Route ') + ('path="' + (parentPath === "/" ? "*" : parentPath + "/*") + '">.'));
  }
  let locationFromContext = useLocation();
  let location;
  if (locationArg) {
    var _parsedLocationArg$pa;
    let parsedLocationArg = typeof locationArg === "string" ? parsePath(locationArg) : locationArg;
    !(parentPathnameBase === "/" || ((_parsedLocationArg$pa = parsedLocationArg.pathname) == null ? void 0 : _parsedLocationArg$pa.startsWith(parentPathnameBase))) ? true ? invariant(false, "When overriding the location using `<Routes location>` or `useRoutes(routes, location)`, the location pathname must begin with the portion of the URL pathname that was " + ('matched by all parent routes. The current pathname base is "' + parentPathnameBase + '" ') + ('but pathname "' + parsedLocationArg.pathname + '" was given in the `location` prop.')) : invariant(false) : void 0;
    location = parsedLocationArg;
  } else {
    location = locationFromContext;
  }
  let pathname = location.pathname || "/";
  let remainingPathname = parentPathnameBase === "/" ? pathname : pathname.slice(parentPathnameBase.length) || "/";
  let matches = matchRoutes(routes, {
    pathname: remainingPathname
  });
  if (true) {
    true ? warning2(parentRoute || matches != null, 'No routes matched location "' + location.pathname + location.search + location.hash + '" ') : void 0;
    true ? warning2(matches == null || matches[matches.length - 1].route.element !== void 0, 'Matched leaf route at location "' + location.pathname + location.search + location.hash + '" does not have an element. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.') : void 0;
  }
  return _renderMatches(matches && matches.map((match) => Object.assign({}, match, {
    params: Object.assign({}, parentParams, match.params),
    pathname: joinPaths([parentPathnameBase, match.pathname]),
    pathnameBase: match.pathnameBase === "/" ? parentPathnameBase : joinPaths([parentPathnameBase, match.pathnameBase])
  })), parentMatches);
}
function _renderMatches(matches, parentMatches) {
  if (parentMatches === void 0) {
    parentMatches = [];
  }
  if (matches == null)
    return null;
  return matches.reduceRight((outlet, match, index) => {
    return /* @__PURE__ */ (0, import_react.createElement)(RouteContext.Provider, {
      children: match.route.element !== void 0 ? match.route.element : outlet,
      value: {
        outlet,
        matches: parentMatches.concat(matches.slice(0, index + 1))
      }
    });
  }, null);
}
function Outlet(props) {
  return useOutlet(props.context);
}
function Router(_ref3) {
  let {
    basename: basenameProp = "/",
    children = null,
    location: locationProp,
    navigationType = Action.Pop,
    navigator,
    static: staticProp = false
  } = _ref3;
  !!useInRouterContext() ? true ? invariant(false, "You cannot render a <Router> inside another <Router>. You should never have more than one in your app.") : invariant(false) : void 0;
  let basename = normalizePathname(basenameProp);
  let navigationContext = (0, import_react.useMemo)(() => ({
    basename,
    navigator,
    static: staticProp
  }), [basename, navigator, staticProp]);
  if (typeof locationProp === "string") {
    locationProp = parsePath(locationProp);
  }
  let {
    pathname = "/",
    search = "",
    hash = "",
    state = null,
    key = "default"
  } = locationProp;
  let location = (0, import_react.useMemo)(() => {
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
  true ? warning2(location != null, '<Router basename="' + basename + '"> is not able to match the URL ' + ('"' + pathname + search + hash + '" because it does not start with the ') + "basename, so the <Router> won't render anything.") : void 0;
  if (location == null) {
    return null;
  }
  return /* @__PURE__ */ (0, import_react.createElement)(NavigationContext.Provider, {
    value: navigationContext
  }, /* @__PURE__ */ (0, import_react.createElement)(LocationContext.Provider, {
    children,
    value: {
      location,
      navigationType
    }
  }));
}
var import_react, NavigationContext, LocationContext, RouteContext, alreadyWarned, paramRe, dynamicSegmentValue, indexRouteValue, emptySegmentValue, staticSegmentValue, splatPenalty, isSplat, joinPaths, normalizePathname, normalizeSearch, normalizeHash, OutletContext;
var init_react_router = __esm({
  "node_modules/react-router/index.js"() {
    init_react();
    init_history();
    init_history();
    import_react = __toESM(require_react());
    NavigationContext = /* @__PURE__ */ (0, import_react.createContext)(null);
    if (true) {
      NavigationContext.displayName = "Navigation";
    }
    LocationContext = /* @__PURE__ */ (0, import_react.createContext)(null);
    if (true) {
      LocationContext.displayName = "Location";
    }
    RouteContext = /* @__PURE__ */ (0, import_react.createContext)({
      outlet: null,
      matches: []
    });
    if (true) {
      RouteContext.displayName = "Route";
    }
    alreadyWarned = {};
    paramRe = /^:\w+$/;
    dynamicSegmentValue = 3;
    indexRouteValue = 2;
    emptySegmentValue = 1;
    staticSegmentValue = 10;
    splatPenalty = -2;
    isSplat = (s) => s === "*";
    joinPaths = (paths) => paths.join("/").replace(/\/\/+/g, "/");
    normalizePathname = (pathname) => pathname.replace(/\/+$/, "").replace(/^\/*/, "/");
    normalizeSearch = (search) => !search || search === "?" ? "" : search.startsWith("?") ? search : "?" + search;
    normalizeHash = (hash) => !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;
    OutletContext = /* @__PURE__ */ (0, import_react.createContext)(null);
  }
});

// node_modules/react-router-dom/index.js
function _extends3() {
  _extends3 = Object.assign || function(target) {
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
  return _extends3.apply(this, arguments);
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
function warning3(cond, message) {
  if (!cond) {
    if (typeof console !== "undefined")
      console.warn(message);
    try {
      throw new Error(message);
    } catch (e) {
    }
  }
}
function HistoryRouter(_ref3) {
  let {
    basename,
    children,
    history
  } = _ref3;
  const [state, setState] = (0, import_react2.useState)({
    action: history.action,
    location: history.location
  });
  (0, import_react2.useLayoutEffect)(() => history.listen(setState), [history]);
  return /* @__PURE__ */ (0, import_react2.createElement)(Router, {
    basename,
    children,
    location: state.location,
    navigationType: state.action,
    navigator: history
  });
}
function isModifiedEvent(event) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}
function useLinkClickHandler(to, _temp) {
  let {
    target,
    replace: replaceProp,
    state
  } = _temp === void 0 ? {} : _temp;
  let navigate = useNavigate();
  let location = useLocation();
  let path = useResolvedPath(to);
  return (0, import_react2.useCallback)((event) => {
    if (event.button === 0 && (!target || target === "_self") && !isModifiedEvent(event)) {
      event.preventDefault();
      let replace = !!replaceProp || createPath(location) === createPath(path);
      navigate(to, {
        replace,
        state
      });
    }
  }, [location, navigate, path, replaceProp, state, target, to]);
}
function useSearchParams(defaultInit) {
  true ? warning3(typeof URLSearchParams !== "undefined", "You cannot use the `useSearchParams` hook in a browser that does not support the URLSearchParams API. If you need to support Internet Explorer 11, we recommend you load a polyfill such as https://github.com/ungap/url-search-params\n\nIf you're unsure how to load polyfills, we recommend you check out https://polyfill.io/v3/ which provides some recommendations about how to load polyfills only for users that need them, instead of for every user.") : void 0;
  let defaultSearchParamsRef = (0, import_react2.useRef)(createSearchParams(defaultInit));
  let location = useLocation();
  let searchParams = (0, import_react2.useMemo)(() => {
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
  let navigate = useNavigate();
  let setSearchParams = (0, import_react2.useCallback)((nextInit, navigateOptions) => {
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
var import_react2, _excluded, _excluded2, Link, NavLink;
var init_react_router_dom = __esm({
  "node_modules/react-router-dom/index.js"() {
    init_react();
    import_react2 = __toESM(require_react());
    init_react_router();
    init_react_router();
    _excluded = ["onClick", "reloadDocument", "replace", "state", "target", "to"];
    _excluded2 = ["aria-current", "caseSensitive", "className", "end", "style", "to", "children"];
    if (true) {
      HistoryRouter.displayName = "unstable_HistoryRouter";
    }
    Link = /* @__PURE__ */ (0, import_react2.forwardRef)(function LinkWithRef(_ref4, ref) {
      let {
        onClick,
        reloadDocument,
        replace = false,
        state,
        target,
        to
      } = _ref4, rest = _objectWithoutPropertiesLoose(_ref4, _excluded);
      let href = useHref(to);
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
      return /* @__PURE__ */ (0, import_react2.createElement)("a", _extends3({}, rest, {
        href,
        onClick: handleClick,
        ref,
        target
      }));
    });
    if (true) {
      Link.displayName = "Link";
    }
    NavLink = /* @__PURE__ */ (0, import_react2.forwardRef)(function NavLinkWithRef(_ref5, ref) {
      let {
        "aria-current": ariaCurrentProp = "page",
        caseSensitive = false,
        className: classNameProp = "",
        end = false,
        style: styleProp,
        to,
        children
      } = _ref5, rest = _objectWithoutPropertiesLoose(_ref5, _excluded2);
      let location = useLocation();
      let path = useResolvedPath(to);
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
      return /* @__PURE__ */ (0, import_react2.createElement)(Link, _extends3({}, rest, {
        "aria-current": ariaCurrent,
        className,
        ref,
        style,
        to
      }), typeof children === "function" ? children({
        isActive
      }) : children);
    });
    if (true) {
      NavLink.displayName = "NavLink";
    }
  }
});

// node_modules/@remix-run/react/dist/esm/browser.js
init_react();
init_history();
var React4 = __toESM(require_react());

// node_modules/@remix-run/react/dist/esm/components.js
init_react();

// node_modules/@remix-run/react/dist/esm/_virtual/_rollupPluginBabelHelpers.js
init_react();
function _extends2() {
  _extends2 = Object.assign ? Object.assign.bind() : function(target) {
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

// node_modules/@remix-run/react/dist/esm/components.js
var React3 = __toESM(require_react());
init_react_router_dom();

// node_modules/@remix-run/react/dist/esm/errorBoundaries.js
init_react();
var import_react3 = __toESM(require_react());
var RemixErrorBoundary = class extends import_react3.default.Component {
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
    return {
      error: props.error || state.error,
      location: state.location
    };
  }
  render() {
    if (this.state.error) {
      return /* @__PURE__ */ import_react3.default.createElement(this.props.component, {
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
  return /* @__PURE__ */ import_react3.default.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ import_react3.default.createElement("head", null, /* @__PURE__ */ import_react3.default.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ import_react3.default.createElement("meta", {
    name: "viewport",
    content: "width=device-width,initial-scale=1,viewport-fit=cover"
  }), /* @__PURE__ */ import_react3.default.createElement("title", null, "Application Error!")), /* @__PURE__ */ import_react3.default.createElement("body", null, /* @__PURE__ */ import_react3.default.createElement("main", {
    style: {
      fontFamily: "system-ui, sans-serif",
      padding: "2rem"
    }
  }, /* @__PURE__ */ import_react3.default.createElement("h1", {
    style: {
      fontSize: "24px"
    }
  }, "Application Error"), /* @__PURE__ */ import_react3.default.createElement("pre", {
    style: {
      padding: "2rem",
      background: "hsla(10, 50%, 50%, 0.1)",
      color: "red",
      overflow: "auto"
    }
  }, error.stack)), /* @__PURE__ */ import_react3.default.createElement("script", {
    dangerouslySetInnerHTML: {
      __html: `
              console.log(
                "\u{1F4BF} Hey developer\u{1F44B}. You can provide a way better UX than this when your app throws errors. Check out https://remix.run/guides/errors for more information."
              );
            `
    }
  })));
}
var RemixCatchContext = /* @__PURE__ */ import_react3.default.createContext(void 0);
function useCatch() {
  return (0, import_react3.useContext)(RemixCatchContext);
}
function RemixCatchBoundary({
  catch: catchVal,
  component: Component,
  children
}) {
  if (catchVal) {
    return /* @__PURE__ */ import_react3.default.createElement(RemixCatchContext.Provider, {
      value: catchVal
    }, /* @__PURE__ */ import_react3.default.createElement(Component, null));
  }
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, children);
}
function RemixRootDefaultCatchBoundary() {
  let caught = useCatch();
  return /* @__PURE__ */ import_react3.default.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ import_react3.default.createElement("head", null, /* @__PURE__ */ import_react3.default.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ import_react3.default.createElement("meta", {
    name: "viewport",
    content: "width=device-width,initial-scale=1,viewport-fit=cover"
  }), /* @__PURE__ */ import_react3.default.createElement("title", null, "Unhandled Thrown Response!")), /* @__PURE__ */ import_react3.default.createElement("body", null, /* @__PURE__ */ import_react3.default.createElement("h1", {
    style: {
      fontFamily: "system-ui, sans-serif",
      padding: "2rem"
    }
  }, caught.status, " ", caught.statusText), /* @__PURE__ */ import_react3.default.createElement("script", {
    dangerouslySetInnerHTML: {
      __html: `
              console.log(
                "\u{1F4BF} Hey developer\u{1F44B}. You can provide a way better UX than this when your app throws 404s (and other responses). Check out https://remix.run/guides/not-found for more information."
              );
            `
    }
  })));
}

// node_modules/@remix-run/react/dist/esm/invariant.js
init_react();
function invariant2(value, message) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}

// node_modules/@remix-run/react/dist/esm/links.js
init_react();
init_history();

// node_modules/@remix-run/react/dist/esm/routeModules.js
init_react();
async function loadRouteModule(route, routeModulesCache) {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }
  try {
    let routeModule = await import(
      /* webpackIgnore: true */
      route.module
    );
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error) {
    window.location.reload();
    return new Promise(() => {
    });
  }
}

// node_modules/@remix-run/react/dist/esm/links.js
function getLinksForMatches(matches, routeModules, manifest) {
  let descriptors = matches.map((match) => {
    var _module$links;
    let module = routeModules[match.route.id];
    return ((_module$links = module.links) === null || _module$links === void 0 ? void 0 : _module$links.call(module)) || [];
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
  if (object == null)
    return false;
  if (object.href == null) {
    return object.rel === "preload" && (typeof object.imageSrcSet === "string" || typeof object.imagesrcset === "string") && (typeof object.imageSizes === "string" || typeof object.imagesizes === "string");
  }
  return typeof object.rel === "string" && typeof object.href === "string";
}
async function getStylesheetPrefetchLinks(matches, routeModules) {
  let links = await Promise.all(matches.map(async (match) => {
    let mod = await loadRouteModule(match.route, routeModules);
    return mod.links ? mod.links() : [];
  }));
  return links.flat(1).filter(isHtmlLinkDescriptor).filter((link) => link.rel === "stylesheet" || link.rel === "preload").map((link) => link.rel === "preload" ? {
    ...link,
    rel: "prefetch"
  } : {
    ...link,
    rel: "prefetch",
    as: "style"
  });
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
    return (mode === "assets" || match.route.hasLoader) && (isNew(match, index) || matchPathChanged(match, index));
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
    searchParams.set("_data", match.route.id);
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
  let set = /* @__PURE__ */ new Set();
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
  let path = parsePath(href);
  if (path.search === void 0)
    path.search = "";
  return path;
}

// node_modules/@remix-run/react/dist/esm/markup.js
init_react();
function createHtml(html) {
  return {
    __html: html
  };
}

// node_modules/@remix-run/react/dist/esm/routes.js
init_react();
var React2 = __toESM(require_react());

// node_modules/@remix-run/react/dist/esm/data.js
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
  let headers = void 0;
  let body = formData;
  if (encType === "application/x-www-form-urlencoded") {
    body = new URLSearchParams();
    for (let [key, value] of formData) {
      invariant2(typeof value === "string", `File inputs are not supported with encType "application/x-www-form-urlencoded", please use "multipart/form-data" instead.`);
      body.append(key, value);
    }
    headers = {
      "Content-Type": encType
    };
  }
  return {
    method,
    body,
    signal,
    credentials: "same-origin",
    headers
  };
}

// node_modules/@remix-run/react/dist/esm/transition.js
init_react();
init_history();

// node_modules/@remix-run/react/dist/esm/routeMatching.js
init_react();
init_react_router_dom();
function matchClientRoutes(routes, location) {
  let matches = matchRoutes(routes, location);
  if (!matches)
    return null;
  return matches.map((match) => ({
    params: match.params,
    pathname: match.pathname,
    route: match.route
  }));
}

// node_modules/@remix-run/react/dist/esm/transition.js
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
  constructor(location, setCookie) {
    this.setCookie = setCookie;
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
  let fetchControllers = /* @__PURE__ */ new Map();
  let incrementingLoadId = 0;
  let navigationLoadId = -1;
  let fetchReloadIds = /* @__PURE__ */ new Map();
  let fetchRedirectIds = /* @__PURE__ */ new Set();
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
    fetchers: /* @__PURE__ */ new Map()
  };
  function update(updates) {
    if (updates.transition) {
      if (updates.transition === IDLE_TRANSITION) {
        pendingNavigationController = void 0;
      }
    }
    state = Object.assign({}, state, updates);
    init.onChange(state);
  }
  function getState() {
    return state;
  }
  function getFetcher(key) {
    return state.fetchers.get(key) || IDLE_FETCHER;
  }
  function setFetcher(key, fetcher) {
    state.fetchers.set(key, fetcher);
  }
  function deleteFetcher(key) {
    if (fetchControllers.has(key))
      abortFetcher(key);
    fetchReloadIds.delete(key);
    fetchRedirectIds.delete(key);
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
        } else if (action === Action.Pop) {
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
        invariant2(matches2, "No matches found");
        if (fetchControllers.has(key))
          abortFetcher(key);
        let match = getFetcherRequestMatch(new URL(href, window.location.href), matches2);
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
  function isIndexRequestUrl(url) {
    for (let param of url.searchParams.getAll("index")) {
      if (param === "") {
        return true;
      }
    }
    return false;
  }
  function getFetcherRequestMatch(url, matches2) {
    let match = matches2.slice(-1)[0];
    if (!isIndexRequestUrl(url) && match.route.index) {
      return matches2.slice(-2)[0];
    }
    return match;
  }
  async function handleActionFetchSubmission(key, submission, match) {
    let currentFetcher = state.fetchers.get(key);
    let fetcher = {
      state: "submitting",
      type: "actionSubmission",
      submission,
      data: (currentFetcher === null || currentFetcher === void 0 ? void 0 : currentFetcher.data) || void 0
    };
    setFetcher(key, fetcher);
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
        type: "fetchAction",
        setCookie: result.value.setCookie
      };
      fetchRedirectIds.add(key);
      init.onRedirect(result.value.location, locationState);
      let loadingFetcher = {
        state: "loading",
        type: "actionRedirect",
        submission,
        data: void 0
      };
      setFetcher(key, loadingFetcher);
      update({
        fetchers: new Map(state.fetchers)
      });
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
    setFetcher(key, loadFetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let maybeActionErrorResult = isErrorResult(result) ? result : void 0;
    let maybeActionCatchResult = isCatchResult(result) ? result : void 0;
    let loadId = ++incrementingLoadId;
    fetchReloadIds.set(key, loadId);
    let matchesToLoad = state.nextMatches || state.matches;
    let results = await callLoaders(state, state.transition.location || state.location, matchesToLoad, controller.signal, maybeActionErrorResult, maybeActionCatchResult, submission, match.route.id, loadFetcher);
    if (controller.signal.aborted) {
      return;
    }
    fetchReloadIds.delete(key);
    fetchControllers.delete(key);
    let redirect = findRedirect(results);
    if (redirect) {
      let locationState = {
        isRedirect: true,
        type: "loader",
        setCookie: redirect.setCookie
      };
      init.onRedirect(redirect.location, locationState);
      return;
    }
    let [error, errorBoundaryId] = findErrorAndBoundaryId(results, state.matches, maybeActionErrorResult);
    let [catchVal, catchBoundaryId] = await findCatchAndBoundaryId(results, state.matches, maybeActionCatchResult) || [];
    let doneFetcher = {
      state: "idle",
      type: "done",
      data: result.value,
      submission: void 0
    };
    setFetcher(key, doneFetcher);
    let abortedKeys = abortStaleFetchLoads(loadId);
    if (abortedKeys) {
      markFetchersDone(abortedKeys);
    }
    let yeetedNavigation = yeetStaleNavigationLoad(loadId);
    if (yeetedNavigation) {
      let {
        transition
      } = state;
      invariant2(transition.state === "loading", "Expected loading transition");
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
      setFetcher(key, doneFetcher);
    }
  }
  function abortStaleFetchLoads(landedId) {
    let yeetedKeys = [];
    for (let [key, id] of fetchReloadIds) {
      if (id < landedId) {
        let fetcher = state.fetchers.get(key);
        invariant2(fetcher, `Expected fetcher: ${key}`);
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
    let currentFetcher = state.fetchers.get(key);
    let fetcher = {
      state: "submitting",
      type: "loaderSubmission",
      submission,
      data: (currentFetcher === null || currentFetcher === void 0 ? void 0 : currentFetcher.data) || void 0
    };
    setFetcher(key, fetcher);
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
        type: "loader",
        setCookie: result.value.setCookie
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
    setFetcher(key, doneFetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
  }
  async function handleLoaderFetch(href, key, match) {
    if (typeof AbortController === "undefined") {
      throw new Error("handleLoaderFetch was called during the server render, but it shouldn't be. You are likely calling useFetcher.load() in the body of your component. Try moving it to a useEffect or a callback.");
    }
    let currentFetcher = state.fetchers.get(key);
    let fetcher = {
      state: "loading",
      type: "normalLoad",
      submission: void 0,
      data: (currentFetcher === null || currentFetcher === void 0 ? void 0 : currentFetcher.data) || void 0
    };
    setFetcher(key, fetcher);
    update({
      fetchers: new Map(state.fetchers)
    });
    let controller = new AbortController();
    fetchControllers.set(key, controller);
    let result = await callLoader(match, createUrl(href), controller.signal);
    if (controller.signal.aborted)
      return;
    fetchControllers.delete(key);
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "loader",
        setCookie: result.value.setCookie
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
    setFetcher(key, doneFetcher);
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
    let actionMatches = matches2;
    if (!isIndexRequestUrl(createUrl(submission.action)) && actionMatches[matches2.length - 1].route.index) {
      actionMatches = actionMatches.slice(0, -1);
    }
    let leafMatch = actionMatches.slice(-1)[0];
    let result = await callAction(submission, leafMatch, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    if (isRedirectResult(result)) {
      let locationState = {
        isRedirect: true,
        type: "action",
        setCookie: result.value.setCookie
      };
      init.onRedirect(result.value.location, locationState);
      return;
    }
    let catchVal, catchBoundaryId;
    if (isCatchResult(result)) {
      [catchVal, catchBoundaryId] = await findCatchAndBoundaryId([result], actionMatches, result) || [];
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
    await loadPageData(location, matches2, submission, leafMatch.route.id, result, catchVal, catchBoundaryId);
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
    invariant2(state.transition.type === "loaderSubmission", `Unexpected transition: ${JSON.stringify(state.transition)}`);
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
    invariant2(state.transition.type === "actionSubmission" || state.transition.type === "actionReload" || state.transition.type === "actionRedirect", `Unexpected transition: ${JSON.stringify(state.transition)}`);
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
  async function loadPageData(location, matches2, submission, submissionRouteId, actionResult, catchVal, catchBoundaryId) {
    let maybeActionErrorResult = actionResult && isErrorResult(actionResult) ? actionResult : void 0;
    let maybeActionCatchResult = actionResult && isCatchResult(actionResult) ? actionResult : void 0;
    let controller = new AbortController();
    pendingNavigationController = controller;
    navigationLoadId = ++incrementingLoadId;
    let results = await callLoaders(state, location, matches2, controller.signal, maybeActionErrorResult, maybeActionCatchResult, submission, submissionRouteId, void 0, catchBoundaryId);
    if (controller.signal.aborted) {
      return;
    }
    let redirect = findRedirect(results);
    if (redirect) {
      if (state.transition.type === "actionReload" || isActionRedirectLocation(location)) {
        let locationState = {
          isRedirect: true,
          type: "action",
          setCookie: redirect.setCookie
        };
        init.onRedirect(redirect.location, locationState);
      } else if (state.transition.type === "loaderSubmission") {
        let locationState = {
          isRedirect: true,
          type: "loaderSubmission",
          setCookie: redirect.setCookie
        };
        init.onRedirect(redirect.location, locationState);
      } else {
        var _location$state;
        let locationState = {
          isRedirect: true,
          type: "loader",
          setCookie: redirect.setCookie || ((_location$state = location.state) === null || _location$state === void 0 ? void 0 : _location$state.setCookie) === true
        };
        init.onRedirect(redirect.location, locationState);
      }
      return;
    }
    let [error, errorBoundaryId] = findErrorAndBoundaryId(results, matches2, maybeActionErrorResult);
    [catchVal, catchBoundaryId] = await findCatchAndBoundaryId(results, matches2, maybeActionErrorResult) || [catchVal, catchBoundaryId];
    markFetchRedirectsDone();
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
    if (pendingNavigationController) {
      pendingNavigationController.abort();
    }
  }
  function abortFetcher(key) {
    let controller = fetchControllers.get(key);
    invariant2(controller, `Expected fetch controller: ${key}`);
    controller.abort();
    fetchControllers.delete(key);
  }
  function markFetchRedirectsDone() {
    let doneKeys = [];
    for (let key of fetchRedirectIds) {
      let fetcher = state.fetchers.get(key);
      invariant2(fetcher, `Expected fetcher: ${key}`);
      if (fetcher.type === "actionRedirect") {
        fetchRedirectIds.delete(key);
        doneKeys.push(key);
      }
    }
    markFetchersDone(doneKeys);
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
async function callLoaders(state, location, matches, signal, actionErrorResult, actionCatchResult, submission, submissionRouteId, fetcher, catchBoundaryId) {
  let url = createUrl(createHref(location));
  let matchesToLoad = filterMatchesToLoad(state, location, matches, actionErrorResult, actionCatchResult, submission, submissionRouteId, fetcher, catchBoundaryId);
  return Promise.all(matchesToLoad.map((match) => callLoader(match, url, signal)));
}
async function callLoader(match, url, signal) {
  invariant2(match.route.loader, `Expected loader for ${match.route.id}`);
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
function filterMatchesToLoad(state, location, matches, actionErrorResult, actionCatchResult, submission, submissionRouteId, fetcher, catchBoundaryId) {
  var _location$state2;
  if (catchBoundaryId || submissionRouteId && (actionCatchResult || actionErrorResult)) {
    let foundProblematicRoute = false;
    matches = matches.filter((match) => {
      if (foundProblematicRoute) {
        return false;
      }
      if (match.route.id === submissionRouteId || match.route.id === catchBoundaryId) {
        foundProblematicRoute = true;
        return false;
      }
      return true;
    });
  }
  let isNew = (match, index) => {
    if (!state.matches[index])
      return true;
    return match.route.id !== state.matches[index].route.id;
  };
  let matchPathChanged = (match, index) => {
    var _state$matches$index$;
    return state.matches[index].pathname !== match.pathname || ((_state$matches$index$ = state.matches[index].route.path) === null || _state$matches$index$ === void 0 ? void 0 : _state$matches$index$.endsWith("*")) && state.matches[index].params["*"] !== match.params["*"];
  };
  let url = createUrl(createHref(location));
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
  } else if (state.transition.type === "actionReload" || state.transition.type === "actionRedirect" || state.transition.type === "fetchActionRedirect" || createHref(url) === createHref(state.location) || url.searchParams.toString() !== state.location.search.substring(1) || (_location$state2 = location.state) !== null && _location$state2 !== void 0 && _location$state2.setCookie) {
    return matches.filter(filterByRouteProps);
  }
  return matches.filter((match, index, arr) => {
    var _location$state3;
    if ((actionErrorResult || actionCatchResult) && arr.length - 1 === index) {
      return false;
    }
    return match.route.loader && (isNew(match, index) || matchPathChanged(match, index) || ((_location$state3 = location.state) === null || _location$state3 === void 0 ? void 0 : _location$state3.setCookie));
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
  return null;
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

// node_modules/@remix-run/react/dist/esm/routes.js
function createClientRoute(entryRoute, routeModulesCache, Component) {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    element: /* @__PURE__ */ React2.createElement(Component, {
      id: entryRoute.id
    }),
    id: entryRoute.id,
    path: entryRoute.path,
    index: entryRoute.index,
    module: entryRoute.module,
    loader: createLoader(entryRoute, routeModulesCache),
    action: createAction(entryRoute, routeModulesCache),
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
    invariant2(module, `Expected route module to be loaded for ${route.id}`);
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
        throw new CatchValue(result.status, result.statusText, await extractData(result));
      }
      return extractData(result);
    } else {
      await loadRouteModuleWithBlockingLinks(route, routeModules);
    }
  };
  return loader;
}
function createAction(route, routeModules) {
  let action = async ({
    url,
    signal,
    submission
  }) => {
    if (!route.hasAction) {
      console.error(`Route "${route.id}" does not have an action, but you are trying to submit to it. To fix this, please add an \`action\` function to the route`);
    }
    let result = await fetchData(url, route.id, signal, submission);
    if (result instanceof Error) {
      throw result;
    }
    let redirect = await checkRedirect(result);
    if (redirect)
      return redirect;
    await loadRouteModuleWithBlockingLinks(route, routeModules);
    if (isCatchResponse(result)) {
      throw new CatchValue(result.status, result.statusText, await extractData(result));
    }
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
      return new TransitionRedirect(url.pathname + url.search + url.hash, response.headers.get("X-Remix-Revalidate") !== null);
    }
  }
  return null;
}

// node_modules/@remix-run/react/dist/esm/components.js
var RemixEntryContext = /* @__PURE__ */ React3.createContext(void 0);
function useRemixEntryContext() {
  let context = React3.useContext(RemixEntryContext);
  invariant2(context, "You must render this element inside a <Remix> element");
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
    appState: entryComponentDidCatchEmulator
  } = entryContext;
  let clientRoutes = React3.useMemo(() => createClientRoutes(manifest.routes, routeModules, RemixRoute), [manifest, routeModules]);
  let [clientState, setClientState] = React3.useState(entryComponentDidCatchEmulator);
  let [transitionManager] = React3.useState(() => {
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
  let navigator = React3.useMemo(() => {
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
  React3.useEffect(() => {
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
  return /* @__PURE__ */ React3.createElement(RemixEntryContext.Provider, {
    value: {
      matches,
      manifest,
      appState: clientState,
      routeModules,
      serverHandoffString,
      clientRoutes,
      routeData: loaderData,
      actionData,
      transitionManager
    }
  }, /* @__PURE__ */ React3.createElement(RemixErrorBoundary, {
    location,
    component: RemixRootDefaultErrorBoundary,
    error: ssrErrorBeforeRoutesRendered
  }, /* @__PURE__ */ React3.createElement(RemixCatchBoundary, {
    location,
    component: RemixRootDefaultCatchBoundary,
    catch: ssrCatchBeforeRoutesRendered
  }, /* @__PURE__ */ React3.createElement(Router, {
    navigationType: action,
    location,
    navigator,
    static: staticProp
  }, /* @__PURE__ */ React3.createElement(Routes2, null)))));
}
function deserializeError(data) {
  let error = new Error(data.message);
  error.stack = data.stack;
  return error;
}
function Routes2() {
  let {
    clientRoutes
  } = useRemixEntryContext();
  let element = useRoutes(clientRoutes) || clientRoutes[0].element;
  return element;
}
var RemixRouteContext = /* @__PURE__ */ React3.createContext(void 0);
function useRemixRouteContext() {
  let context = React3.useContext(RemixRouteContext);
  invariant2(context, "You must render this element in a remix route element");
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
  let location = useLocation();
  let {
    routeData,
    routeModules,
    appState
  } = useRemixEntryContext();
  invariant2(routeData, "Cannot initialize 'routeData'. This normally occurs when you have server code in your client modules.\nCheck this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles");
  invariant2(routeModules, "Cannot initialize 'routeModules'. This normally occurs when you have server code in your client modules.\nCheck this link for more details:\nhttps://remix.run/pages/gotchas#server-code-in-client-bundles");
  let data = routeData[id];
  let {
    default: Component,
    CatchBoundary,
    ErrorBoundary
  } = routeModules[id];
  let element = Component ? /* @__PURE__ */ React3.createElement(Component, null) : /* @__PURE__ */ React3.createElement(DefaultRouteComponent, {
    id
  });
  let context = {
    data,
    id
  };
  if (CatchBoundary) {
    let maybeServerCaught = appState.catch && appState.catchBoundaryRouteId === id ? appState.catch : void 0;
    if (appState.trackCatchBoundaries) {
      appState.catchBoundaryRouteId = id;
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
    element = /* @__PURE__ */ React3.createElement(RemixCatchBoundary, {
      location,
      component: CatchBoundary,
      catch: maybeServerCaught
    }, element);
  }
  if (ErrorBoundary) {
    let maybeServerRenderError = appState.error && (appState.renderBoundaryRouteId === id || appState.loaderBoundaryRouteId === id) ? deserializeError(appState.error) : void 0;
    if (appState.trackBoundaries) {
      appState.renderBoundaryRouteId = id;
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
    element = /* @__PURE__ */ React3.createElement(RemixErrorBoundary, {
      location,
      component: ErrorBoundary,
      error: maybeServerRenderError
    }, element);
  }
  return /* @__PURE__ */ React3.createElement(RemixRouteContext.Provider, {
    value: context
  }, element);
}
function usePrefetchBehavior(prefetch, theirElementProps) {
  let [maybePrefetch, setMaybePrefetch] = React3.useState(false);
  let [shouldPrefetch, setShouldPrefetch] = React3.useState(false);
  let {
    onFocus,
    onBlur,
    onMouseEnter,
    onMouseLeave,
    onTouchStart
  } = theirElementProps;
  React3.useEffect(() => {
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
      setShouldPrefetch(false);
    }
  };
  React3.useEffect(() => {
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
var NavLink2 = /* @__PURE__ */ React3.forwardRef(({
  to,
  prefetch = "none",
  ...props
}, forwardedRef) => {
  let href = useHref(to);
  let [shouldPrefetch, prefetchHandlers] = usePrefetchBehavior(prefetch, props);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement(NavLink, _extends2({
    ref: forwardedRef,
    to
  }, props, prefetchHandlers)), shouldPrefetch ? /* @__PURE__ */ React3.createElement(PrefetchPageLinks, {
    page: href
  }) : null);
});
NavLink2.displayName = "NavLink";
var Link2 = /* @__PURE__ */ React3.forwardRef(({
  to,
  prefetch = "none",
  ...props
}, forwardedRef) => {
  let href = useHref(to);
  let [shouldPrefetch, prefetchHandlers] = usePrefetchBehavior(prefetch, props);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement(Link, _extends2({
    ref: forwardedRef,
    to
  }, props, prefetchHandlers)), shouldPrefetch ? /* @__PURE__ */ React3.createElement(PrefetchPageLinks, {
    page: href
  }) : null);
});
Link2.displayName = "Link";
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
  let links = React3.useMemo(() => getLinksForMatches(matches, routeModules, manifest), [matches, routeModules, manifest]);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, links.map((link) => {
    if (isPageLinkDescriptor(link)) {
      return /* @__PURE__ */ React3.createElement(PrefetchPageLinks, _extends2({
        key: link.page
      }, link));
    }
    let imageSrcSet = null;
    if ("useId" in React3) {
      if (link.imagesrcset) {
        link.imageSrcSet = imageSrcSet = link.imagesrcset;
        delete link.imagesrcset;
      }
      if (link.imagesizes) {
        link.imageSizes = link.imagesizes;
        delete link.imagesizes;
      }
    } else {
      if (link.imageSrcSet) {
        link.imagesrcset = imageSrcSet = link.imageSrcSet;
        delete link.imageSrcSet;
      }
      if (link.imageSizes) {
        link.imagesizes = link.imageSizes;
        delete link.imageSizes;
      }
    }
    return /* @__PURE__ */ React3.createElement("link", _extends2({
      key: link.rel + (link.href || "") + (imageSrcSet || "")
    }, link));
  }));
}
function PrefetchPageLinks({
  page,
  ...dataLinkProps
}) {
  let {
    clientRoutes
  } = useRemixEntryContext();
  let matches = React3.useMemo(() => matchClientRoutes(clientRoutes, page), [clientRoutes, page]);
  if (!matches) {
    console.warn(`Tried to prefetch ${page} but no routes matched.`);
    return null;
  }
  return /* @__PURE__ */ React3.createElement(PrefetchPageLinksImpl, _extends2({
    page,
    matches
  }, dataLinkProps));
}
function usePrefetchedStylesheets(matches) {
  let {
    routeModules
  } = useRemixEntryContext();
  let [styleLinks, setStyleLinks] = React3.useState([]);
  React3.useEffect(() => {
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
  let location = useLocation();
  let {
    matches,
    manifest
  } = useRemixEntryContext();
  let newMatchesForData = React3.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, location, "data"), [page, nextMatches, matches, location]);
  let newMatchesForAssets = React3.useMemo(() => getNewMatchesForLinks(page, nextMatches, matches, location, "assets"), [page, nextMatches, matches, location]);
  let dataHrefs = React3.useMemo(() => getDataLinkHrefs(page, newMatchesForData, manifest), [newMatchesForData, page, manifest]);
  let moduleHrefs = React3.useMemo(() => getModuleLinkHrefs(newMatchesForAssets, manifest), [newMatchesForAssets, manifest]);
  let styleLinks = usePrefetchedStylesheets(newMatchesForAssets);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, dataHrefs.map((href) => /* @__PURE__ */ React3.createElement("link", _extends2({
    key: href,
    rel: "prefetch",
    as: "fetch",
    href
  }, linkProps))), moduleHrefs.map((href) => /* @__PURE__ */ React3.createElement("link", _extends2({
    key: href,
    rel: "modulepreload",
    href
  }, linkProps))), styleLinks.map((link) => /* @__PURE__ */ React3.createElement("link", _extends2({
    key: link.href
  }, link))));
}
function Meta() {
  let {
    matches,
    routeData,
    routeModules
  } = useRemixEntryContext();
  let location = useLocation();
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
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, Object.entries(meta).map(([name, value]) => {
    if (!value) {
      return null;
    }
    if (["charset", "charSet"].includes(name)) {
      return /* @__PURE__ */ React3.createElement("meta", {
        key: "charset",
        charSet: value
      });
    }
    if (name === "title") {
      return /* @__PURE__ */ React3.createElement("title", {
        key: "title"
      }, value);
    }
    let isOpenGraphTag = name.startsWith("og:");
    return [value].flat().map((content) => {
      if (isOpenGraphTag) {
        return /* @__PURE__ */ React3.createElement("meta", {
          content,
          key: name + content,
          property: name
        });
      }
      if (typeof content === "string") {
        return /* @__PURE__ */ React3.createElement("meta", {
          content,
          name,
          key: name + content
        });
      }
      return /* @__PURE__ */ React3.createElement("meta", _extends2({
        key: name + JSON.stringify(content)
      }, content));
    });
  }));
}
var isHydrated = false;
function Scripts(props) {
  let {
    manifest,
    matches,
    pendingLocation,
    clientRoutes,
    serverHandoffString
  } = useRemixEntryContext();
  React3.useEffect(() => {
    isHydrated = true;
  }, []);
  let initialScripts = React3.useMemo(() => {
    let contextScript = serverHandoffString ? `window.__remixContext = ${serverHandoffString};` : "";
    let routeModulesScript = `${matches.map((match, index) => `import * as route${index} from ${JSON.stringify(manifest.routes[match.route.id].module)};`).join("\n")}
window.__remixRouteModules = {${matches.map((match, index) => `${JSON.stringify(match.route.id)}:route${index}`).join(",")}};`;
    return /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement("script", _extends2({}, props, {
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: createHtml(contextScript)
    })), /* @__PURE__ */ React3.createElement("script", _extends2({}, props, {
      src: manifest.url
    })), /* @__PURE__ */ React3.createElement("script", _extends2({}, props, {
      dangerouslySetInnerHTML: createHtml(routeModulesScript),
      type: "module"
    })), /* @__PURE__ */ React3.createElement("script", _extends2({}, props, {
      src: manifest.entry.module,
      type: "module"
    })));
  }, []);
  let nextMatches = React3.useMemo(() => {
    if (pendingLocation) {
      let matches2 = matchClientRoutes(clientRoutes, pendingLocation);
      invariant2(matches2, `No routes match path "${pendingLocation.pathname}"`);
      return matches2;
    }
    return [];
  }, [pendingLocation, clientRoutes]);
  let routePreloads = matches.concat(nextMatches).map((match) => {
    let route = manifest.routes[match.route.id];
    return (route.imports || []).concat([route.module]);
  }).flat(1);
  let preloads = manifest.entry.imports.concat(routePreloads);
  return /* @__PURE__ */ React3.createElement(React3.Fragment, null, dedupe2(preloads).map((path) => /* @__PURE__ */ React3.createElement("link", {
    key: path,
    rel: "modulepreload",
    href: path,
    crossOrigin: props.crossOrigin
  })), isHydrated ? null : initialScripts);
}
function dedupe2(array) {
  return [...new Set(array)];
}
var Form = /* @__PURE__ */ React3.forwardRef((props, ref) => {
  return /* @__PURE__ */ React3.createElement(FormImpl, _extends2({}, props, {
    ref
  }));
});
Form.displayName = "Form";
var FormImpl = /* @__PURE__ */ React3.forwardRef(({
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
  let formAction = useFormAction(action);
  return /* @__PURE__ */ React3.createElement("form", _extends2({
    ref: forwardedRef,
    method: formMethod,
    action: formAction,
    encType,
    onSubmit: reloadDocument ? void 0 : (event) => {
      onSubmit && onSubmit(event);
      if (event.defaultPrevented)
        return;
      event.preventDefault();
      let submitter = event.nativeEvent.submitter;
      submit(submitter || event.currentTarget, {
        method,
        replace
      });
    }
  }, props));
});
FormImpl.displayName = "FormImpl";
function useFormAction(action = ".", method = "get") {
  let {
    id
  } = useRemixRouteContext();
  let path = useResolvedPath(action);
  let search = path.search;
  let isIndexRoute = id.endsWith("/index");
  if (action === "." && isIndexRoute) {
    search = search ? search.replace(/^\?/, "?index&") : "?index";
  }
  return path.pathname + search;
}
var defaultMethod = "get";
var defaultEncType = "application/x-www-form-urlencoded";
function useSubmitImpl(key) {
  let navigate = useNavigate();
  let defaultAction = useFormAction();
  let {
    transitionManager
  } = useRemixEntryContext();
  return React3.useCallback((target, options = {}) => {
    let method;
    let action;
    let encType;
    let formData;
    if (isFormElement(target)) {
      let submissionTrigger = options.submissionTrigger;
      method = options.method || target.getAttribute("method") || defaultMethod;
      action = options.action || target.getAttribute("action") || defaultAction;
      encType = options.encType || target.getAttribute("enctype") || defaultEncType;
      formData = new FormData(target);
      if (submissionTrigger && submissionTrigger.name) {
        formData.append(submissionTrigger.name, submissionTrigger.value);
      }
    } else if (isButtonElement(target) || isInputElement(target) && (target.type === "submit" || target.type === "image")) {
      let form = target.form;
      if (form == null) {
        throw new Error(`Cannot submit a <button> without a <form>`);
      }
      method = options.method || target.getAttribute("formmethod") || form.getAttribute("method") || defaultMethod;
      action = options.action || target.getAttribute("formaction") || form.getAttribute("action") || defaultAction;
      encType = options.encType || target.getAttribute("formenctype") || form.getAttribute("enctype") || defaultEncType;
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
            formData.append(name, value);
          }
        } else if (target != null) {
          for (let name of Object.keys(target)) {
            formData.append(name, target[name]);
          }
        }
      }
    }
    if (typeof document === "undefined") {
      throw new Error("You are calling submit during the server render. Try calling submit within a `useEffect` or callback instead.");
    }
    let {
      protocol,
      host
    } = window.location;
    let url = new URL(action, `${protocol}//${host}`);
    if (method.toLowerCase() === "get") {
      for (let [name, value] of formData) {
        if (typeof value === "string") {
          url.searchParams.append(name, value);
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
function useBeforeUnload(callback) {
  React3.useEffect(() => {
    window.addEventListener("beforeunload", callback);
    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}
function useMatches() {
  let {
    matches,
    routeData,
    routeModules
  } = useRemixEntryContext();
  return React3.useMemo(() => matches.map((match) => {
    var _routeModules$match$r;
    let {
      pathname,
      params
    } = match;
    return {
      id: match.route.id,
      pathname,
      params,
      data: routeData[match.route.id],
      handle: (_routeModules$match$r = routeModules[match.route.id]) === null || _routeModules$match$r === void 0 ? void 0 : _routeModules$match$r.handle
    };
  }), [matches, routeData, routeModules]);
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
function useTransition() {
  let {
    transitionManager
  } = useRemixEntryContext();
  return transitionManager.getState().transition;
}
var LiveReload = false ? () => null : function LiveReload2({
  port = Number(8002),
  nonce = void 0
}) {
  let js = String.raw;
  return /* @__PURE__ */ React3.createElement("script", {
    nonce,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: {
      __html: js`
                function remixLiveReloadConnect(config) {
                  let protocol = location.protocol === "https:" ? "wss:" : "ws:";
                  let host = location.hostname;
                  let socketPath = protocol + "//" + host + ":" + ${String(port)} + "/socket";

                  let ws = new WebSocket(socketPath);
                  ws.onmessage = (message) => {
                    let event = JSON.parse(message.data);
                    if (event.type === "LOG") {
                      console.log(event.message);
                    }
                    if (event.type === "RELOAD") {
                      console.log("💿 Reloading window ...");
                      window.location.reload();
                    }
                  };
                  ws.onopen = () => {
                    if (config && typeof config.onOpen === "function") {
                      config.onOpen();
                    }
                  };
                  ws.onclose = (error) => {
                    console.log("Remix dev asset server web socket closed. Reconnecting...");
                    setTimeout(
                      () =>
                        remixLiveReloadConnect({
                          onOpen: () => window.location.reload(),
                        }),
                      1000
                    );
                  };
                  ws.onerror = (error) => {
                    console.log("Remix dev asset server web socket error:");
                    console.error(error);
                  };
                }
                remixLiveReloadConnect();
              `
    }
  });
};

// node_modules/@remix-run/react/dist/esm/browser.js
function RemixBrowser(_props) {
  let historyRef = React4.useRef();
  if (historyRef.current == null) {
    historyRef.current = createBrowserHistory({
      window
    });
  }
  let history = historyRef.current;
  let [state, dispatch] = React4.useReducer((_, update) => update, {
    action: history.action,
    location: history.location
  });
  React4.useLayoutEffect(() => history.listen(dispatch), [history]);
  let entryContext = window.__remixContext;
  entryContext.manifest = window.__remixManifest;
  entryContext.routeModules = window.__remixRouteModules;
  entryContext.appState.trackBoundaries = false;
  entryContext.appState.trackCatchBoundaries = false;
  return /* @__PURE__ */ React4.createElement(RemixEntry, {
    context: entryContext,
    action: state.action,
    location: state.location,
    navigator: history
  });
}

// node_modules/@remix-run/react/dist/esm/index.js
init_react();
init_react_router_dom();

// node_modules/@remix-run/react/dist/esm/scroll-restoration.js
init_react();
var React5 = __toESM(require_react());
init_react_router_dom();
var STORAGE_KEY = "positions";
var positions = {};
if (typeof document !== "undefined") {
  let sessionPositions = sessionStorage.getItem(STORAGE_KEY);
  if (sessionPositions) {
    positions = JSON.parse(sessionPositions);
  }
}
function ScrollRestoration({
  nonce = void 0
}) {
  useScrollRestoration();
  React5.useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);
  useBeforeUnload(React5.useCallback(() => {
    window.history.scrollRestoration = "auto";
  }, []));
  let restoreScroll = ((STORAGE_KEY2) => {
    if (!window.history.state || !window.history.state.key) {
      let key = Math.random().toString(32).slice(2);
      window.history.replaceState({
        key
      }, "");
    }
    try {
      let positions2 = JSON.parse(sessionStorage.getItem(STORAGE_KEY2) || "{}");
      let storedY = positions2[window.history.state.key];
      if (typeof storedY === "number") {
        window.scrollTo(0, storedY);
      }
    } catch (error) {
      console.error(error);
      sessionStorage.removeItem(STORAGE_KEY2);
    }
  }).toString();
  return /* @__PURE__ */ React5.createElement("script", {
    nonce,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: {
      __html: `(${restoreScroll})(${JSON.stringify(STORAGE_KEY)})`
    }
  });
}
var hydrated = false;
function useScrollRestoration() {
  let location = useLocation();
  let transition = useTransition();
  let wasSubmissionRef = React5.useRef(false);
  React5.useEffect(() => {
    if (transition.submission) {
      wasSubmissionRef.current = true;
    }
  }, [transition]);
  React5.useEffect(() => {
    if (transition.location) {
      positions[location.key] = window.scrollY;
    }
  }, [transition, location]);
  useBeforeUnload(React5.useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }, []));
  if (typeof document !== "undefined") {
    React5.useLayoutEffect(() => {
      if (!hydrated) {
        hydrated = true;
        return;
      }
      let y = positions[location.key];
      if (y != void 0) {
        window.scrollTo(0, y);
        return;
      }
      if (location.hash) {
        let el = document.getElementById(location.hash.slice(1));
        if (el) {
          el.scrollIntoView();
          return;
        }
      }
      if (wasSubmissionRef.current === true) {
        wasSubmissionRef.current = false;
        return;
      }
      window.scrollTo(0, 0);
    }, [location]);
  }
  React5.useEffect(() => {
    if (transition.submission) {
      wasSubmissionRef.current = true;
    }
  }, [transition]);
}

export {
  Outlet,
  useSearchParams,
  useCatch,
  NavLink2 as NavLink,
  Link2 as Link,
  Links,
  Meta,
  Scripts,
  Form,
  useMatches,
  useLoaderData,
  useActionData,
  useTransition,
  LiveReload,
  RemixBrowser,
  ScrollRestoration
};
/**
 * @remix-run/react v1.6.5
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * React Router DOM v6.3.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * React Router v6.3.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
//# sourceMappingURL=/build/_shared/chunk-DOPJ42JF.js.map
