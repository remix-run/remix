var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[Object.keys(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/@remix-run/dev/compiler/shims/react.ts
var React;
var init_react = __esm({
  "node_modules/@remix-run/dev/compiler/shims/react.ts"() {
    React = __toModule(require("react"));
  }
});

// node_modules/remix/client.js
var require_client = __commonJS({
  "node_modules/remix/client.js"(exports) {
    init_react();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var react = require("@remix-run/react");
    Object.defineProperty(exports, "Form", {
      enumerable: true,
      get: function() {
        return react.Form;
      }
    });
    Object.defineProperty(exports, "Link", {
      enumerable: true,
      get: function() {
        return react.Link;
      }
    });
    Object.defineProperty(exports, "Links", {
      enumerable: true,
      get: function() {
        return react.Links;
      }
    });
    Object.defineProperty(exports, "LiveReload", {
      enumerable: true,
      get: function() {
        return react.LiveReload;
      }
    });
    Object.defineProperty(exports, "Meta", {
      enumerable: true,
      get: function() {
        return react.Meta;
      }
    });
    Object.defineProperty(exports, "NavLink", {
      enumerable: true,
      get: function() {
        return react.NavLink;
      }
    });
    Object.defineProperty(exports, "Outlet", {
      enumerable: true,
      get: function() {
        return react.Outlet;
      }
    });
    Object.defineProperty(exports, "PrefetchPageLinks", {
      enumerable: true,
      get: function() {
        return react.PrefetchPageLinks;
      }
    });
    Object.defineProperty(exports, "RemixBrowser", {
      enumerable: true,
      get: function() {
        return react.RemixBrowser;
      }
    });
    Object.defineProperty(exports, "RemixServer", {
      enumerable: true,
      get: function() {
        return react.RemixServer;
      }
    });
    Object.defineProperty(exports, "Scripts", {
      enumerable: true,
      get: function() {
        return react.Scripts;
      }
    });
    Object.defineProperty(exports, "ScrollRestoration", {
      enumerable: true,
      get: function() {
        return react.ScrollRestoration;
      }
    });
    Object.defineProperty(exports, "useActionData", {
      enumerable: true,
      get: function() {
        return react.useActionData;
      }
    });
    Object.defineProperty(exports, "useBeforeUnload", {
      enumerable: true,
      get: function() {
        return react.useBeforeUnload;
      }
    });
    Object.defineProperty(exports, "useCatch", {
      enumerable: true,
      get: function() {
        return react.useCatch;
      }
    });
    Object.defineProperty(exports, "useFetcher", {
      enumerable: true,
      get: function() {
        return react.useFetcher;
      }
    });
    Object.defineProperty(exports, "useFetchers", {
      enumerable: true,
      get: function() {
        return react.useFetchers;
      }
    });
    Object.defineProperty(exports, "useFormAction", {
      enumerable: true,
      get: function() {
        return react.useFormAction;
      }
    });
    Object.defineProperty(exports, "useHref", {
      enumerable: true,
      get: function() {
        return react.useHref;
      }
    });
    Object.defineProperty(exports, "useLoaderData", {
      enumerable: true,
      get: function() {
        return react.useLoaderData;
      }
    });
    Object.defineProperty(exports, "useLocation", {
      enumerable: true,
      get: function() {
        return react.useLocation;
      }
    });
    Object.defineProperty(exports, "useMatches", {
      enumerable: true,
      get: function() {
        return react.useMatches;
      }
    });
    Object.defineProperty(exports, "useNavigate", {
      enumerable: true,
      get: function() {
        return react.useNavigate;
      }
    });
    Object.defineProperty(exports, "useNavigationType", {
      enumerable: true,
      get: function() {
        return react.useNavigationType;
      }
    });
    Object.defineProperty(exports, "useOutlet", {
      enumerable: true,
      get: function() {
        return react.useOutlet;
      }
    });
    Object.defineProperty(exports, "useOutletContext", {
      enumerable: true,
      get: function() {
        return react.useOutletContext;
      }
    });
    Object.defineProperty(exports, "useParams", {
      enumerable: true,
      get: function() {
        return react.useParams;
      }
    });
    Object.defineProperty(exports, "useResolvedPath", {
      enumerable: true,
      get: function() {
        return react.useResolvedPath;
      }
    });
    Object.defineProperty(exports, "useSearchParams", {
      enumerable: true,
      get: function() {
        return react.useSearchParams;
      }
    });
    Object.defineProperty(exports, "useSubmit", {
      enumerable: true,
      get: function() {
        return react.useSubmit;
      }
    });
    Object.defineProperty(exports, "useTransition", {
      enumerable: true,
      get: function() {
        return react.useTransition;
      }
    });
  }
});

// node_modules/remix/server.js
var require_server = __commonJS({
  "node_modules/remix/server.js"(exports) {
    init_react();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var serverRuntime = require("@remix-run/server-runtime");
    Object.defineProperty(exports, "createCookie", {
      enumerable: true,
      get: function() {
        return serverRuntime.createCookie;
      }
    });
    Object.defineProperty(exports, "createCookieSessionStorage", {
      enumerable: true,
      get: function() {
        return serverRuntime.createCookieSessionStorage;
      }
    });
    Object.defineProperty(exports, "createMemorySessionStorage", {
      enumerable: true,
      get: function() {
        return serverRuntime.createMemorySessionStorage;
      }
    });
    Object.defineProperty(exports, "createSession", {
      enumerable: true,
      get: function() {
        return serverRuntime.createSession;
      }
    });
    Object.defineProperty(exports, "createSessionStorage", {
      enumerable: true,
      get: function() {
        return serverRuntime.createSessionStorage;
      }
    });
    Object.defineProperty(exports, "isCookie", {
      enumerable: true,
      get: function() {
        return serverRuntime.isCookie;
      }
    });
    Object.defineProperty(exports, "isSession", {
      enumerable: true,
      get: function() {
        return serverRuntime.isSession;
      }
    });
    Object.defineProperty(exports, "json", {
      enumerable: true,
      get: function() {
        return serverRuntime.json;
      }
    });
    Object.defineProperty(exports, "redirect", {
      enumerable: true,
      get: function() {
        return serverRuntime.redirect;
      }
    });
  }
});

// node_modules/remix/platform.js
var require_platform = __commonJS({
  "node_modules/remix/platform.js"(exports) {
    init_react();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var node = require("@remix-run/node");
    Object.defineProperty(exports, "createFileSessionStorage", {
      enumerable: true,
      get: function() {
        return node.createFileSessionStorage;
      }
    });
    Object.defineProperty(exports, "unstable_createFileUploadHandler", {
      enumerable: true,
      get: function() {
        return node.unstable_createFileUploadHandler;
      }
    });
    Object.defineProperty(exports, "unstable_createMemoryUploadHandler", {
      enumerable: true,
      get: function() {
        return node.unstable_createMemoryUploadHandler;
      }
    });
    Object.defineProperty(exports, "unstable_parseMultipartFormData", {
      enumerable: true,
      get: function() {
        return node.unstable_parseMultipartFormData;
      }
    });
  }
});

// node_modules/remix/index.js
var require_remix = __commonJS({
  "node_modules/remix/index.js"(exports) {
    init_react();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var client = require_client();
    var server = require_server();
    var platform = require_platform();
    Object.keys(client).forEach(function(k) {
      if (k !== "default" && !exports.hasOwnProperty(k))
        Object.defineProperty(exports, k, {
          enumerable: true,
          get: function() {
            return client[k];
          }
        });
    });
    Object.keys(server).forEach(function(k) {
      if (k !== "default" && !exports.hasOwnProperty(k))
        Object.defineProperty(exports, k, {
          enumerable: true,
          get: function() {
            return server[k];
          }
        });
    });
    Object.keys(platform).forEach(function(k) {
      if (k !== "default" && !exports.hasOwnProperty(k))
        Object.defineProperty(exports, k, {
          enumerable: true,
          get: function() {
            return platform[k];
          }
        });
    });
  }
});

// empty-module:../scripts/message.client
var require_message = __commonJS({
  "empty-module:../scripts/message.client"(exports, module2) {
    init_react();
    module2.exports = {};
  }
});

// <stdin>
__export(exports, {
  assets: () => import_assets.default,
  entry: () => entry,
  routes: () => routes
});
init_react();

// app/entry.server.jsx
var entry_server_exports = {};
__export(entry_server_exports, {
  default: () => handleRequest,
  handleDataRequest: () => handleDataRequest
});
init_react();
var import_server = __toModule(require("react-dom/server"));
var import_remix = __toModule(require_remix());
function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  let markup = import_server.default.renderToString(/* @__PURE__ */ React.createElement(import_remix.RemixServer, {
    context: remixContext,
    url: request.url
  }));
  responseHeaders.set("Content-Type", "text/html");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders
  });
}
function handleDataRequest(response) {
  response.headers.set("x-hdr", "yes");
  return response;
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/root.jsx
var root_exports = {};
__export(root_exports, {
  CatchBoundary: () => CatchBoundary,
  ErrorBoundary: () => ErrorBoundary,
  default: () => Root,
  handle: () => handle,
  links: () => links,
  loader: () => loader,
  unstable_shouldReload: () => unstable_shouldReload
});
init_react();
var import_react = __toModule(require("react"));
var import_remix2 = __toModule(require_remix());

// node_modules/@exampledev/new.css/new.css
var new_default = "/build/_assets/new-SIOXYGQB.css";

// app/styles/app.css
var app_default = "/build/_assets/app-77DR34FE.css";

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/root.jsx
function links() {
  return [
    {
      rel: "stylesheet",
      href: new_default
    },
    { rel: "stylesheet", href: app_default },
    { rel: "stylesheet", href: "/resources/theme-css" }
  ];
}
function loader({ request }) {
  return {
    enableScripts: new URL(request.url).searchParams.get("disableJs") == null
  };
}
var handle = {
  breadcrumb: () => /* @__PURE__ */ React.createElement(import_remix2.Link, {
    to: "/"
  }, "Home")
};
var unstable_shouldReload = () => false;
function Root() {
  (0, import_react.useEffect)(() => {
    window.reactIsHydrated = true;
  });
  let data = (0, import_remix2.useLoaderData)();
  let matches = (0, import_remix2.useMatches)();
  return /* @__PURE__ */ React.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ React.createElement(import_remix2.Meta, null), /* @__PURE__ */ React.createElement(import_remix2.Links, null)), /* @__PURE__ */ React.createElement("body", {
    className: "m-4"
  }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("ol", {
    className: "breadcrumbs"
  }, matches.filter((match) => {
    var _a;
    return (_a = match.handle) == null ? void 0 : _a.breadcrumb;
  }).map((match, index) => /* @__PURE__ */ React.createElement("li", {
    key: index
  }, match.handle.breadcrumb(match))))), /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "content",
    id: "content"
  }, /* @__PURE__ */ React.createElement(import_remix2.Outlet, null)), data.enableScripts ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(import_remix2.ScrollRestoration, null), /* @__PURE__ */ React.createElement(import_remix2.Scripts, null)) : null));
}
function CatchBoundary() {
  let caught = (0, import_remix2.useCatch)();
  (0, import_react.useEffect)(() => {
    window.reactIsHydrated = true;
  });
  switch (caught.status) {
    case 404:
      return /* @__PURE__ */ React.createElement("html", {
        lang: "en"
      }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ React.createElement("title", null, "404 Not Found"), /* @__PURE__ */ React.createElement(import_remix2.Links, null)), /* @__PURE__ */ React.createElement("body", null, /* @__PURE__ */ React.createElement("div", {
        "data-test-id": "app-catch-boundary"
      }, /* @__PURE__ */ React.createElement("h1", null, "404 Not Found")), /* @__PURE__ */ React.createElement(import_remix2.Scripts, null)));
    default:
      console.warn("Unexpected catch", caught);
      return /* @__PURE__ */ React.createElement("html", {
        lang: "en"
      }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ React.createElement("title", null, caught.status, " Uh-oh!"), /* @__PURE__ */ React.createElement(import_remix2.Links, null)), /* @__PURE__ */ React.createElement("body", null, /* @__PURE__ */ React.createElement("div", {
        "data-test-id": "app-catch-boundary"
      }, /* @__PURE__ */ React.createElement("h1", null, caught.status, " ", caught.statusText), caught.data ? /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, JSON.stringify(caught.data, null, 2))) : null), /* @__PURE__ */ React.createElement(import_remix2.Scripts, null)));
  }
}
function ErrorBoundary({ error }) {
  (0, import_react.useEffect)(() => {
    window.reactIsHydrated = true;
  });
  console.error(error);
  return /* @__PURE__ */ React.createElement("html", {
    lang: "en"
  }, /* @__PURE__ */ React.createElement("head", null, /* @__PURE__ */ React.createElement("meta", {
    charSet: "utf-8"
  }), /* @__PURE__ */ React.createElement("title", null, "Oops!"), /* @__PURE__ */ React.createElement(import_remix2.Links, null)), /* @__PURE__ */ React.createElement("body", null, /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "app-error-boundary"
  }, /* @__PURE__ */ React.createElement("h1", null, "App Error Boundary"), /* @__PURE__ */ React.createElement("pre", null, error.message)), /* @__PURE__ */ React.createElement(import_remix2.Scripts, null)));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-catches-from-loader-self-boundary.jsx
var action_catches_from_loader_self_boundary_exports = {};
__export(action_catches_from_loader_self_boundary_exports, {
  CatchBoundary: () => CatchBoundary2,
  action: () => action,
  default: () => ActionCatches,
  loader: () => loader2
});
init_react();
var import_remix3 = __toModule(require_remix());
function action() {
  return (0, import_remix3.redirect)("/action-catches-from-loader-self-boundary?catch");
}
function loader2({ request }) {
  if (new URL(request.url).searchParams.get("catch") != null) {
    throw (0, import_remix3.json)("loader catch data!", { status: 401 });
  }
  return null;
}
function ActionCatches() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Action Catches from loader self boundary"), /* @__PURE__ */ React.createElement(import_remix3.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}
function CatchBoundary2() {
  let caught = (0, import_remix3.useCatch)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-catches-from-loader-self-boundary"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Catches Self Boundary"), /* @__PURE__ */ React.createElement("p", null, "Status: ", caught.status), /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, JSON.stringify(caught.data, null, 2))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-catches-self-boundary.jsx
var action_catches_self_boundary_exports = {};
__export(action_catches_self_boundary_exports, {
  CatchBoundary: () => CatchBoundary3,
  action: () => action2,
  default: () => ActionCatchesSelfBoundary
});
init_react();
var import_remix4 = __toModule(require_remix());
function action2() {
  throw (0, import_remix4.json)("action catch data!", { status: 401 });
}
function ActionCatchesSelfBoundary() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-catches"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Catches Self Boundary"), /* @__PURE__ */ React.createElement(import_remix4.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}
function CatchBoundary3() {
  let caught = (0, import_remix4.useCatch)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-catches-self-boundary"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Catches Self Boundary"), /* @__PURE__ */ React.createElement("p", null, "Status: ", caught.status), /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, JSON.stringify(caught.data, null, 2))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-errors-self-boundary.jsx
var action_errors_self_boundary_exports = {};
__export(action_errors_self_boundary_exports, {
  ErrorBoundary: () => ErrorBoundary2,
  action: () => action3,
  default: () => ActionErrors,
  loader: () => loader3
});
init_react();
var import_remix5 = __toModule(require_remix());
function action3() {
  throw new Error("I am an action error!");
}
function loader3() {
  return "nope";
}
function ActionErrors() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-errors"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Errors"), /* @__PURE__ */ React.createElement(import_remix5.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}
function ErrorBoundary2({ error }) {
  let nope = (0, import_remix5.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "action-error-boundary"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Error Boundary"), /* @__PURE__ */ React.createElement("pre", null, error.message), nope);
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/catchall-nested-no-layout/$.jsx
var __exports = {};
__export(__exports, {
  default: () => Comp
});
init_react();
function Comp() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/catchall-nested-no-layout"
  }, "Catchall Nested");
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-catches-from-loader.jsx
var action_catches_from_loader_exports = {};
__export(action_catches_from_loader_exports, {
  action: () => action4,
  default: () => ActionCatches2,
  loader: () => loader4
});
init_react();
var import_remix6 = __toModule(require_remix());
function action4() {
  return (0, import_remix6.redirect)("/action-catches-from-loader?catch");
}
function loader4({ request }) {
  if (new URL(request.url).searchParams.get("catch") != null) {
    throw (0, import_remix6.json)("loader catch data!", { status: 401 });
  }
  return null;
}
function ActionCatches2() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-catches-from-loader"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Catches from loader"), /* @__PURE__ */ React.createElement(import_remix6.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/multiple-set-cookies.tsx
var multiple_set_cookies_exports = {};
__export(multiple_set_cookies_exports, {
  action: () => action5,
  default: () => multiple_set_cookies_default,
  loader: () => loader5,
  meta: () => meta
});
init_react();
var import_remix7 = __toModule(require_remix());
var loader5 = async () => {
  let headers12 = new Headers();
  headers12.append("Set-Cookie", "foo=bar");
  headers12.append("Set-Cookie", "bar=baz");
  return (0, import_remix7.json)({}, { headers: headers12 });
};
var action5 = async () => {
  let headers12 = new Headers();
  headers12.append("Set-Cookie", "another=one");
  headers12.append("Set-Cookie", "how-about=two");
  return (0, import_remix7.redirect)("/multiple-set-cookies", { headers: headers12 });
};
var meta = () => ({
  title: "Multi Set Cookie Headers"
});
var MultipleSetCookiesPage = () => {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", null, "\u{1F44B}"), /* @__PURE__ */ React.createElement(import_remix7.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Add cookies")));
};
var multiple_set_cookies_default = MultipleSetCookiesPage;

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/resources/theme-css.ts
var theme_css_exports = {};
__export(theme_css_exports, {
  action: () => action6,
  defaultStyles: () => defaultStyles,
  loader: () => loader6,
  sessionStorage: () => sessionStorage
});
init_react();
var import_remix8 = __toModule(require_remix());
var import_remix9 = __toModule(require_remix());
var sessionStorage = (0, import_remix9.createCookieSessionStorage)({
  cookie: {
    name: "theme-css",
    secrets: ["fjdlafjdkla"]
  }
});
var defaultStyles = {
  "--nc-tx-1": "#ffffff",
  "--nc-tx-2": "#eeeeee",
  "--nc-bg-1": "#000000",
  "--nc-bg-2": "#111111",
  "--nc-bg-3": "#222222",
  "--nc-lk-1": "#3291FF",
  "--nc-lk-2": "#0070F3",
  "--nc-lk-tx": "#FFFFFF",
  "--nc-ac-1": "#7928CA",
  "--nc-ac-tx": "#FFFFFF"
};
var action6 = async ({ request }) => {
  let formData = new URLSearchParams(await request.text());
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  let custom = session.get("custom") || {};
  if (formData.get("event") === "reset") {
    return (0, import_remix8.redirect)("/resources/settings", {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session)
      }
    });
  }
  for (let [key, value] of formData) {
    if (key in defaultStyles) {
      custom[key] = value || defaultStyles[key];
    }
  }
  session.set("custom", custom);
  return (0, import_remix8.redirect)("/resources/settings", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};
var loader6 = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  let custom = session.get("custom") || {};
  return new Response(`/* this css was generated via a loader in a remix resource route */
:root {
  ${Object.entries(custom).map(([key, value]) => defaultStyles[key] && value ? `${key}: ${value};` : false).filter((s) => s).join("\n  ")}
}
  `, {
    headers: {
      "Content-Type": "text/css; charset=UTF-8",
      "x-has-custom": Object.keys(custom).length > 0 ? "yes" : "no"
    }
  });
};

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/resources/redirect.ts
var redirect_exports = {};
__export(redirect_exports, {
  loader: () => loader7
});
init_react();
var import_remix10 = __toModule(require_remix());
var loader7 = () => {
  return (0, import_remix10.redirect)("/");
};

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/resources/settings.tsx
var settings_exports = {};
__export(settings_exports, {
  default: () => Settings,
  handle: () => handle2,
  loader: () => loader8
});
init_react();
var import_react2 = __toModule(require("react"));
var import_remix12 = __toModule(require_remix());
var import_remix13 = __toModule(require_remix());

// app/routes/resources/theme-css.ts
init_react();
var import_remix11 = __toModule(require_remix());
var sessionStorage2 = (0, import_remix11.createCookieSessionStorage)({
  cookie: {
    name: "theme-css",
    secrets: ["fjdlafjdkla"]
  }
});
var defaultStyles2 = {
  "--nc-tx-1": "#ffffff",
  "--nc-tx-2": "#eeeeee",
  "--nc-bg-1": "#000000",
  "--nc-bg-2": "#111111",
  "--nc-bg-3": "#222222",
  "--nc-lk-1": "#3291FF",
  "--nc-lk-2": "#0070F3",
  "--nc-lk-tx": "#FFFFFF",
  "--nc-ac-1": "#7928CA",
  "--nc-ac-tx": "#FFFFFF"
};

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/resources/settings.tsx
var handle2 = {
  breadcrumb: () => /* @__PURE__ */ React.createElement(import_remix13.Link, {
    to: "/resources"
  }, "Resources")
};
var loader8 = async ({ request }) => {
  let session = await sessionStorage2.getSession(request.headers.get("Cookie"));
  let custom = session.get("custom") || {};
  let settings = Object.entries(defaultStyles2).reduce((p, [key, defaultValue]) => __spreadProps(__spreadValues({}, p), {
    [key]: custom[key] || defaultValue
  }), {});
  return (0, import_remix12.json)(settings);
};
function reloadCss() {
  var links13 = document.getElementsByTagName("link");
  for (var cl in links13) {
    var link = links13[cl];
    if (link.rel === "stylesheet")
      link.href += "";
  }
}
function Settings() {
  let settings = (0, import_remix12.useLoaderData)();
  let { state, submission } = (0, import_remix12.useTransition)();
  (0, import_react2.useEffect)(() => {
    if (state === "loading" && submission) {
      reloadCss();
    }
  }, [state, submission]);
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("h1", null, "Edit theme settings"), /* @__PURE__ */ React.createElement(import_remix12.Form, {
    method: "post",
    action: "/resources/theme-css"
  }, /* @__PURE__ */ React.createElement("input", {
    name: "event",
    type: "hidden",
    value: "reset"
  }), /* @__PURE__ */ React.createElement("button", {
    "data-testid": "reset",
    type: "submit"
  }, "Reset")), /* @__PURE__ */ React.createElement(import_remix12.Form, {
    method: "post",
    action: "/resources/theme-css"
  }, Object.entries(settings).map(([key, defaultValue]) => /* @__PURE__ */ React.createElement(import_react2.Fragment, {
    key
  }, /* @__PURE__ */ React.createElement("label", {
    htmlFor: key
  }, key, ":", /* @__PURE__ */ React.createElement("input", {
    name: key,
    type: "color",
    defaultValue
  })), /* @__PURE__ */ React.createElement("br", null))), /* @__PURE__ */ React.createElement("button", {
    "data-testid": "save",
    type: "submit"
  }, "Save")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/catchall-nested.jsx
var catchall_nested_exports = {};
__export(catchall_nested_exports, {
  default: () => Comp2
});
init_react();
var import_remix14 = __toModule(require_remix());
function Comp2() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Catchall nested layout"), /* @__PURE__ */ React.createElement(import_remix14.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/catchall-nested/index.jsx
var catchall_nested_exports2 = {};
__export(catchall_nested_exports2, {
  default: () => CatchAllIndex
});
init_react();
function CatchAllIndex() {
  return /* @__PURE__ */ React.createElement("h1", {
    "data-test-id": "/catchall-nested/index"
  }, "Index");
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/catchall-nested/$.jsx
var __exports2 = {};
__export(__exports2, {
  default: () => Comp3
});
init_react();
function Comp3() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/catchall-nested/splat"
  }, "Catchall Nested");
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/catchall.flat.$.jsx
var catchall_flat_exports = {};
__export(catchall_flat_exports, {
  default: () => Comp4
});
init_react();
function Comp4() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/catchall/flat"
  }, "Catchall flat");
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/redirects/login.jsx
var login_exports = {};
__export(login_exports, {
  action: () => action7,
  default: () => Login,
  loader: () => loader9
});
init_react();
var import_remix15 = __toModule(require_remix());
var sessionStorage3 = (0, import_remix15.createCookieSessionStorage)({
  cookie: {
    name: "redirectslogin",
    path: "/",
    httpOnly: true,
    sameSite: true,
    secure: true
  }
});
var action7 = async ({ request }) => {
  let session = await sessionStorage3.getSession(request.headers.get("Cookie"));
  session.flash("done", "yes");
  throw (0, import_remix15.redirect)("/redirects/login", {
    headers: {
      "Set-Cookie": await sessionStorage3.commitSession(session)
    }
  });
};
var loader9 = async ({ request }) => {
  let session = await sessionStorage3.getSession(request.headers.get("Cookie"));
  return (0, import_remix15.json)(!!session.get("done"), {
    headers: {
      "Set-Cookie": await sessionStorage3.commitSession(session)
    }
  });
};
function Login() {
  let done = (0, import_remix15.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Login"), done ? /* @__PURE__ */ React.createElement("p", {
    "data-testid": "done"
  }, "Logged In!") : /* @__PURE__ */ React.createElement(import_remix15.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Push me to login")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/resources/index.tsx
var resources_exports = {};
__export(resources_exports, {
  default: () => Resources
});
init_react();
var import_remix16 = __toModule(require_remix());
function Resources() {
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix16.Link, {
    to: "/resources/redirect"
  }, "Redirect back home")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix16.Link, {
    to: "/resources/settings"
  }, "Settings")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix16.Link, {
    "data-testid": "csr",
    to: "/resources/theme-css"
  }, "CSR to resource")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement("a", {
    href: "/resources/theme-css"
  }, "Theme CSS"))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-catches.jsx
var action_catches_exports = {};
__export(action_catches_exports, {
  action: () => action8,
  default: () => ActionCatches3
});
init_react();
var import_remix17 = __toModule(require_remix());
function action8() {
  throw (0, import_remix17.json)("action catch data!", { status: 401 });
}
function ActionCatches3() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-errors"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Catches"), /* @__PURE__ */ React.createElement(import_remix17.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/action-errors.jsx
var action_errors_exports = {};
__export(action_errors_exports, {
  action: () => action9,
  default: () => ActionErrors2
});
init_react();
var import_remix18 = __toModule(require_remix());
function action9() {
  throw new Error("I am an action error!");
}
function ActionErrors2() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/action-errors"
  }, /* @__PURE__ */ React.createElement("h1", null, "Action Errors"), /* @__PURE__ */ React.createElement(import_remix18.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/loader-errors.jsx
var loader_errors_exports = {};
__export(loader_errors_exports, {
  default: () => LoaderErrors,
  loader: () => loader10
});
init_react();
var import_remix19 = __toModule(require_remix());
function loader10({ request }) {
  let params = new URL(request.url).searchParams;
  if (params.has("throw")) {
    throw new Error("I am a loader error!");
  }
  if (params.has("catch")) {
    throw (0, import_remix19.json)("catch data!", { status: 401 });
  }
  return null;
}
function LoaderErrors() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/loader-errors"
  }, /* @__PURE__ */ React.createElement("h1", null, "Loader Errors"), /* @__PURE__ */ React.createElement("p", null, "This is the parent route, it rendered just fine. Any errors in the children will be handled there, but this layout renders normally."), /* @__PURE__ */ React.createElement(import_remix19.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/loader-errors/nested-catch.jsx
var nested_catch_exports = {};
__export(nested_catch_exports, {
  CatchBoundary: () => CatchBoundary4,
  default: () => LoaderCatchesNested,
  loader: () => loader11
});
init_react();
var import_remix20 = __toModule(require_remix());
function loader11({ request }) {
  let url = new URL(request.url);
  if (url.searchParams.get("authed")) {
    return {};
  }
  throw (0, import_remix20.json)("catch data!", { status: 401 });
}
function LoaderCatchesNested() {
  let location = (0, import_remix20.useLocation)();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h2", null, "Yay, your're authenticated!"), /* @__PURE__ */ React.createElement(import_remix20.Link, {
    to: location.pathname
  }, "Logout"));
}
function CatchBoundary4() {
  let caught = (0, import_remix20.useCatch)();
  let location = (0, import_remix20.useLocation)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/loader-errors/nested-catch"
  }, /* @__PURE__ */ React.createElement("h2", null, "Nested Catch Boundary"), /* @__PURE__ */ React.createElement(import_remix20.Link, {
    to: location.pathname + "?authed=true"
  }, "Login"), /* @__PURE__ */ React.createElement("p", null, "There was an expected error at this specific route. The parent still renders cause it was fine, but this one threw an expected response."), /* @__PURE__ */ React.createElement("p", null, "Status: ", caught.status, " ", caught.statusText), /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, JSON.stringify(caught.data, null, 2))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/loader-errors/nested.jsx
var nested_exports = {};
__export(nested_exports, {
  ErrorBoundary: () => ErrorBoundary3,
  default: () => LoaderErrorsNested,
  loader: () => loader12
});
init_react();
function loader12() {
  throw new Error("I am a loader error!");
}
function LoaderErrorsNested() {
  return /* @__PURE__ */ React.createElement("div", null, "Loader errors nested");
}
function ErrorBoundary3({ error }) {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/loader-errors/nested"
  }, /* @__PURE__ */ React.createElement("h2", null, "Nested Error Boundary"), /* @__PURE__ */ React.createElement("p", null, "There was an error at this specific route. The parent still renders cause it was fine, but this one blew up."), /* @__PURE__ */ React.createElement("pre", null, error.message));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/render-errors.jsx
var render_errors_exports = {};
__export(render_errors_exports, {
  default: () => RenderErrors
});
init_react();
var import_remix21 = __toModule(require_remix());
function RenderErrors() {
  let location = (0, import_remix21.useLocation)();
  let params = new URLSearchParams(location.search);
  if (params.has("throw")) {
    throw new Error("I am a render error!");
  }
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/render-errors"
  }, /* @__PURE__ */ React.createElement("h1", null, "Render Errors"), /* @__PURE__ */ React.createElement("p", null, "This is the parent route, it rendered just fine. Any errors in the children will be handled there, but this layout renders normally."), /* @__PURE__ */ React.createElement(import_remix21.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/render-errors/nested.jsx
var nested_exports2 = {};
__export(nested_exports2, {
  ErrorBoundary: () => ErrorBoundary4,
  default: () => RenderErrorsNested
});
init_react();
function RenderErrorsNested() {
  throw new Error("I am a render error!");
}
function ErrorBoundary4({ error }) {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/render-errors/nested"
  }, /* @__PURE__ */ React.createElement("h2", null, "Nested Error Boundary"), /* @__PURE__ */ React.createElement("p", null, "There was an error at this specific route. The parent still renders cause it was fine, but this one blew up."), /* @__PURE__ */ React.createElement("pre", null, error.message));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/nested-forms.tsx
var nested_forms_exports = {};
__export(nested_forms_exports, {
  action: () => action10,
  default: () => NestedFormsIndexLayout
});
init_react();
var import_remix22 = __toModule(require_remix());
var action10 = ({ request }) => {
  return (0, import_remix22.json)("layout action data");
};
function NestedFormsIndexLayout() {
  let actionData = (0, import_remix22.useActionData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(import_remix22.Form, {
    method: "post",
    action: "."
  }, actionData ? /* @__PURE__ */ React.createElement("p", null, actionData) : null, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Submit Layout Form")), /* @__PURE__ */ React.createElement(import_remix22.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/nested-forms/nested.tsx
var nested_exports3 = {};
__export(nested_exports3, {
  action: () => action11,
  default: () => NestedFormsIndexLayout2,
  loader: () => loader13
});
init_react();
var import_remix23 = __toModule(require_remix());
var loader13 = ({ request }) => {
  let value = new URL(request.url).searchParams.get("value");
  return (0, import_remix23.json)(value);
};
function action11() {
  return (0, import_remix23.json)("nested layout action data");
}
function NestedFormsIndexLayout2() {
  let actionData = (0, import_remix23.useActionData)();
  let loaderData = (0, import_remix23.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(import_remix23.Form, {
    method: "post"
  }, actionData ? /* @__PURE__ */ React.createElement("p", null, actionData) : null, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Submit Nested POST Form")), /* @__PURE__ */ React.createElement(import_remix23.Form, {
    method: "get"
  }, loaderData ? /* @__PURE__ */ React.createElement("p", null, loaderData) : null, /* @__PURE__ */ React.createElement("input", {
    type: "hidden",
    name: "value",
    value: "data from get submission"
  }), /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Submit Nested GET Form")), /* @__PURE__ */ React.createElement(import_remix23.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/nested-forms/nested/index.tsx
var nested_exports4 = {};
__export(nested_exports4, {
  action: () => action12,
  default: () => NestedFormsIndexLayout3,
  loader: () => loader14
});
init_react();
var import_remix24 = __toModule(require_remix());
var import_remix25 = __toModule(require_remix());
var loader14 = ({ request }) => {
  let value = new URL(request.url).searchParams.get("subvalue");
  return (0, import_remix24.json)(value);
};
var action12 = () => {
  return (0, import_remix24.json)("nested index action data");
};
function NestedFormsIndexLayout3() {
  let actionData = (0, import_remix24.useActionData)();
  let loaderData = (0, import_remix24.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(import_remix24.Form, {
    method: "post"
  }, actionData ? /* @__PURE__ */ React.createElement("p", null, actionData) : null, /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Submit Nested Index POST Form")), /* @__PURE__ */ React.createElement(import_remix24.Form, {
    method: "get"
  }, loaderData ? /* @__PURE__ */ React.createElement("p", null, loaderData) : null, /* @__PURE__ */ React.createElement("input", {
    type: "hidden",
    name: "subvalue",
    value: "data from get submission"
  }), /* @__PURE__ */ React.createElement("button", null, "Submit Nested Index GET Form")), /* @__PURE__ */ React.createElement(import_remix25.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/gists.mine.jsx
var gists_mine_exports = {};
__export(gists_mine_exports, {
  default: () => Gists
});
init_react();
function Gists() {
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/gists/mine"
  }, /* @__PURE__ */ React.createElement("h1", null, "My Gists"));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/__layout.tsx
var layout_exports = {};
__export(layout_exports, {
  default: () => LayoutTest
});
init_react();
var React2 = __toModule(require("react"));
var import_remix26 = __toModule(require_remix());
function LayoutTest() {
  return /* @__PURE__ */ React2.createElement("div", {
    "data-test-id": "_layout"
  }, /* @__PURE__ */ React2.createElement("h1", null, "Layout Test"), /* @__PURE__ */ React2.createElement(import_remix26.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/__layout/with-layout.tsx
var with_layout_exports = {};
__export(with_layout_exports, {
  default: () => WithLayout
});
init_react();
function WithLayout() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Page inside layout"));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/fetchers.tsx
var fetchers_exports = {};
__export(fetchers_exports, {
  action: () => action13,
  default: () => Tasks,
  links: () => links2,
  loader: () => loader15
});
init_react();
var import_react3 = __toModule(require("react"));
var import_remix27 = __toModule(require_remix());
var import_remix28 = __toModule(require_remix());

// app/styles/pending-forms.css
var pending_forms_default = "/build/_assets/pending-forms-KHC4FUF6.css";

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/fetchers.tsx
var tasks = [
  {
    id: "taco",
    name: "Eat tacos",
    complete: false,
    delay: 1e3
  },
  {
    id: "puppy",
    name: "Adopt a puppy",
    complete: false,
    delay: 2e3
  },
  {
    id: "giveup",
    name: "Give up",
    complete: false,
    delay: 1e3
  }
];
function links2() {
  return [{ rel: "stylesheet", href: pending_forms_default }];
}
var loader15 = async ({ request }) => {
  let searchParams = new URL(request.url).searchParams;
  if (searchParams.has("q")) {
    return tasks.filter((task) => task.name.toLowerCase().includes(searchParams.get("q").toLowerCase()));
  }
  return tasks;
};
async function action13({ request }) {
  let body = new URLSearchParams(await request.text());
  let id = body.get("id");
  let complete = JSON.parse(body.get("complete"));
  let task = tasks.find((t) => t.id === id);
  await new Promise((res) => setTimeout(res, task.delay));
  if (id === "giveup") {
    return (0, import_remix27.json)({ error: "NEVER GIVE UP!" }, { status: 500 });
  }
  task.complete = complete;
  return (0, import_remix27.json)(task);
}
function Tasks() {
  let tasks2 = (0, import_remix27.useLoaderData)();
  let [searchParams] = (0, import_remix28.useSearchParams)();
  let fetcher = (0, import_remix27.useFetcher)();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", null, "Filter Tasks"), /* @__PURE__ */ React.createElement(FilterForm, null), /* @__PURE__ */ React.createElement("hr", null), /* @__PURE__ */ React.createElement("h2", null, "Tasks"), searchParams.has("q") ? /* @__PURE__ */ React.createElement("p", null, "Filtered by search: ", /* @__PURE__ */ React.createElement("i", null, searchParams.get("q"))) : null, tasks2.map((task) => /* @__PURE__ */ React.createElement(TaskItem, {
    key: task.id,
    task
  })), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement(import_remix27.Link, {
    to: "/gists"
  }, "Gists")), /* @__PURE__ */ React.createElement("h2", null, "Atomic Click This Sucker"), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("button", {
    onClick: () => fetcher.load("/fetchers")
  }, "Load")));
}
function FilterForm() {
  let transition = (0, import_remix27.useTransition)();
  let [searchParams] = (0, import_remix28.useSearchParams)();
  return /* @__PURE__ */ React.createElement(import_remix27.Form, {
    method: "get"
  }, /* @__PURE__ */ React.createElement("input", {
    type: "text",
    name: "q",
    defaultValue: searchParams.get("q") || ""
  }), " ", /* @__PURE__ */ React.createElement("button", {
    type: "submit"
  }, "Go"), transition.type === "loaderSubmission" ? /* @__PURE__ */ React.createElement("p", null, "Searching for: ", transition.submission.formData.get("q"), "...") : /* @__PURE__ */ React.createElement("p", null, "\xA0"));
}
function TaskItem({ task }) {
  let toggleComplete = (0, import_remix27.useFetcher)();
  let renderedTask = toggleComplete.type === "done" && !("error" in toggleComplete.data) ? toggleComplete.data : task;
  return /* @__PURE__ */ React.createElement(toggleComplete.Form, {
    method: "post"
  }, /* @__PURE__ */ React.createElement("input", {
    type: "hidden",
    name: "id",
    value: task.id
  }), /* @__PURE__ */ React.createElement("input", {
    type: "hidden",
    name: "complete",
    value: String(!task.complete)
  }), /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    "data-status": toggleComplete.data && "error" in toggleComplete.data ? "error" : task.complete ? "complete" : "incomplete"
  }, renderedTask.complete ? "Mark Incomplete" : "Mark Complete", toggleComplete.state === "submitting" ? /* @__PURE__ */ React.createElement(ProgressBar, {
    key: toggleComplete.submission.key,
    total: task.delay
  }) : null), " ", task.name, " ", toggleComplete.type === "done" && "error" in toggleComplete.data ? /* @__PURE__ */ React.createElement("span", {
    style: { color: "red" }
  }, "Error! ", toggleComplete.data.error) : null);
}
function ProgressBar({ total }) {
  let [ts, setTimeStamp] = (0, import_react3.useState)(0);
  let [start, setStart] = (0, import_react3.useState)(null);
  let progress = 0;
  if (start) {
    let elapsed = ts - start;
    progress = elapsed / total * 100;
  }
  (0, import_react3.useEffect)(() => {
    if (progress >= 100)
      return;
    let id = requestAnimationFrame((now) => {
      setTimeStamp(now);
      if (!start)
        setStart(now);
    });
    return () => cancelAnimationFrame(id);
  }, [start, progress]);
  return /* @__PURE__ */ React.createElement("progress", {
    value: progress,
    max: "100"
  });
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/actions.tsx
var actions_exports = {};
__export(actions_exports, {
  CatchBoundary: () => CatchBoundary5,
  ErrorBoundary: () => ErrorBoundary5,
  action: () => action14,
  default: () => Actions,
  headers: () => headers,
  loader: () => loader16
});
init_react();
var import_remix30 = __toModule(require_remix());

// app/uploadHandler.server.ts
init_react();
var import_remix29 = __toModule(require_remix());
var uploadHandler = (0, import_remix29.unstable_createFileUploadHandler)({
  directory: "public/uploads",
  maxFileSize: 1234,
  avoidFileConflicts: false,
  file: ({ filename: filename6 }) => filename6
});

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/actions.tsx
function loader16() {
  return "ay! data from the loader!";
}
var action14 = async ({ request }) => {
  let files = [];
  let formData = await (0, import_remix30.unstable_parseMultipartFormData)(request, uploadHandler);
  let file = formData.get("file");
  if (file && typeof file !== "string") {
    files.push({ name: file.name, size: file.size });
  }
  return (0, import_remix30.json)({
    files,
    message: `heyooo, data from the action: ${formData.get("field1")}`
  }, {
    headers: {
      "x-test": "works"
    }
  });
};
var headers = ({ actionHeaders }) => {
  return {
    "x-test": actionHeaders.get("x-test")
  };
};
function CatchBoundary5() {
  return /* @__PURE__ */ React.createElement("h1", null, "Actions Catch Boundary");
}
function ErrorBoundary5({ error }) {
  console.error(error);
  return /* @__PURE__ */ React.createElement("div", {
    id: "actions-error-boundary"
  }, /* @__PURE__ */ React.createElement("h1", null, "Actions Error Boundary"), /* @__PURE__ */ React.createElement("p", null, error.message));
}
function Actions() {
  let { files, message: message2 } = (0, import_remix30.useActionData)() || {};
  let loaderData = (0, import_remix30.useLoaderData)();
  return /* @__PURE__ */ React.createElement(import_remix30.Form, {
    method: "post",
    id: "form",
    encType: "multipart/form-data"
  }, /* @__PURE__ */ React.createElement("p", {
    id: "action-text"
  }, message2 ? /* @__PURE__ */ React.createElement("span", {
    id: "action-data"
  }, message2) : "Waiting..."), files ? /* @__PURE__ */ React.createElement("ul", null, files.map((file) => /* @__PURE__ */ React.createElement("li", {
    key: JSON.stringify(file)
  }, /* @__PURE__ */ React.createElement("pre", null, /* @__PURE__ */ React.createElement("code", null, JSON.stringify(file, null, 2)))))) : null, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", {
    htmlFor: "file"
  }, "Choose a file:"), /* @__PURE__ */ React.createElement("input", {
    type: "file",
    id: "file",
    name: "file"
  })), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("input", {
    type: "text",
    defaultValue: "stuff",
    name: "field1"
  }), /* @__PURE__ */ React.createElement("button", {
    type: "submit",
    id: "submit"
  }, "Go")), /* @__PURE__ */ React.createElement("p", null, loaderData));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/methods.tsx
var methods_exports = {};
__export(methods_exports, {
  action: () => action15,
  default: () => Methods,
  links: () => links3,
  loader: () => loader17
});
init_react();
var React3 = __toModule(require("react"));
var import_remix32 = __toModule(require_remix());

// app/styles/methods.css
var methods_default = "/build/_assets/methods-JZZVQUYI.css";

// app/sessionStorage.ts
init_react();
var import_remix31 = __toModule(require_remix());
var { getSession, commitSession, destroySession } = (0, import_remix31.createCookieSessionStorage)({
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"]
  }
});

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/methods.tsx
function links3() {
  return [{ rel: "stylesheet", href: methods_default }];
}
var loader17 = async ({ request }) => {
  let session = await getSession(request.headers.get("Cookie"));
  return (0, import_remix32.json)({
    body: JSON.parse(session.get("body") || null)
  });
};
var action15 = async ({ request }) => {
  let session = await getSession(request.headers.get("Cookie"));
  let bodyParams = await request.formData();
  let body = Array.from(bodyParams.entries()).reduce((p, [k, v]) => {
    if (typeof p[k] === "undefined") {
      p[k] = v;
    } else if (Array.isArray(p[k])) {
      p[k].push(v);
    } else {
      p[k] = [p[k], v];
    }
    return p;
  }, {});
  session.flash("body", JSON.stringify(body));
  if (body.slow === "on") {
    await new Promise((res) => setTimeout(res, 2e3));
  }
  return (0, import_remix32.redirect)("/methods", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
};
function Methods() {
  let data = (0, import_remix32.useLoaderData)();
  let [method, setMethod] = React3.useState("post");
  let [enctype, setEnctype] = React3.useState("application/x-www-form-urlencoded");
  let pendingFormSubmit = (0, import_remix32.useTransition)().submission;
  let pendingForm = pendingFormSubmit ? Object.fromEntries(pendingFormSubmit.formData) : null;
  return /* @__PURE__ */ React3.createElement("div", {
    "data-test-id": "/methods"
  }, /* @__PURE__ */ React3.createElement(import_remix32.Form, {
    action: "/methods",
    method,
    encType: enctype
  }, /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement("label", null, "Method:", " ", /* @__PURE__ */ React3.createElement("select", {
    value: method,
    name: "selectedMethod",
    onChange: (event) => setMethod(event.target.value)
  }, /* @__PURE__ */ React3.createElement("option", null, "get"), /* @__PURE__ */ React3.createElement("option", null, "post"), /* @__PURE__ */ React3.createElement("option", null, "put"), /* @__PURE__ */ React3.createElement("option", null, "delete")))), /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement("label", null, "Enctype:", " ", /* @__PURE__ */ React3.createElement("select", {
    value: enctype,
    name: "selectedEnctype",
    onChange: (event) => setEnctype(event.target.value)
  }, /* @__PURE__ */ React3.createElement("option", null, "application/x-www-form-urlencoded"), /* @__PURE__ */ React3.createElement("option", null, "multipart/form-data")))), /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement("label", null, "User Input:", " ", /* @__PURE__ */ React3.createElement("input", {
    type: "text",
    name: "userInput",
    defaultValue: "whatever"
  }))), /* @__PURE__ */ React3.createElement("p", null, "Multiple", /* @__PURE__ */ React3.createElement("br", null), /* @__PURE__ */ React3.createElement("label", null, "A:", " ", /* @__PURE__ */ React3.createElement("input", {
    defaultChecked: true,
    type: "checkbox",
    name: "multiple[]",
    defaultValue: "a"
  })), /* @__PURE__ */ React3.createElement("br", null), /* @__PURE__ */ React3.createElement("label", null, "B:", " ", /* @__PURE__ */ React3.createElement("input", {
    defaultChecked: true,
    type: "checkbox",
    name: "multiple[]",
    defaultValue: "b"
  }))), /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement("label", null, /* @__PURE__ */ React3.createElement("input", {
    type: "checkbox",
    name: "slow"
  }), " Go slow")), /* @__PURE__ */ React3.createElement("p", null, /* @__PURE__ */ React3.createElement("button", {
    type: "submit",
    id: "submit-with-data",
    name: "data",
    value: "c"
  }, method, " (with data)"), /* @__PURE__ */ React3.createElement("button", {
    type: "submit",
    id: "submit"
  }, method))), /* @__PURE__ */ React3.createElement("div", {
    id: "results",
    style: {
      opacity: pendingForm ? 0.25 : 1,
      transition: "opacity 300ms",
      transitionDelay: "50ms"
    }
  }, pendingForm ? /* @__PURE__ */ React3.createElement("dl", null, Object.keys(pendingForm).map((key) => /* @__PURE__ */ React3.createElement("div", {
    key
  }, /* @__PURE__ */ React3.createElement("dt", null, key), /* @__PURE__ */ React3.createElement("dd", null, pendingForm[key])))) : data.body ? /* @__PURE__ */ React3.createElement("dl", {
    "data-test-id": data.body.selectedMethod
  }, Object.keys(data.body).map((key) => /* @__PURE__ */ React3.createElement("div", {
    key
  }, /* @__PURE__ */ React3.createElement("dt", null, key), /* @__PURE__ */ React3.createElement("dd", null, JSON.stringify(data.body[key]))))) : /* @__PURE__ */ React3.createElement("p", null, "null")));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/empty.jsx
var empty_exports = {};
__markAsModule(empty_exports);
init_react();

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/gists.jsx
var gists_exports = {};
__export(gists_exports, {
  default: () => Gists2,
  handle: () => handle3,
  headers: () => headers2,
  links: () => links4,
  loader: () => loader18
});
init_react();
var import_remix33 = __toModule(require_remix());

// app/components/Shared.js
init_react();
function Shared() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "Shared"));
}

// app/styles/gists.css
var gists_default = "/build/_assets/gists-KKXPJPDC.css";

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/gists.jsx
function links4() {
  return [{ rel: "stylesheet", href: gists_default }];
}
function loader18() {
  let data = {
    users: [
      { id: "ryanflorence", name: "Ryan Florence" },
      { id: "mjackson", name: "Michael Jackson" }
    ]
  };
  return (0, import_remix33.json)(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
}
function headers2({ loaderHeaders }) {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
}
var handle3 = {
  breadcrumb: () => /* @__PURE__ */ React.createElement(import_remix33.Link, {
    to: "/gists"
  }, "Gists")
};
function Gists2() {
  let locationPending = (0, import_remix33.useTransition)().location;
  let { users } = (0, import_remix33.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/gists"
  }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h1", null, "Gists"), /* @__PURE__ */ React.createElement("ul", null, users.map((user) => /* @__PURE__ */ React.createElement("li", {
    key: user.id
  }, /* @__PURE__ */ React.createElement(import_remix33.Link, {
    to: user.id,
    className: "text-blue-700 underline"
  }, user.name, " ", locationPending ? "..." : null))))), /* @__PURE__ */ React.createElement(import_remix33.Outlet, null), /* @__PURE__ */ React.createElement(Shared, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/gists/$username.jsx
var username_exports = {};
__export(username_exports, {
  default: () => UserGists,
  handle: () => handle4,
  headers: () => headers3,
  loader: () => loader19,
  meta: () => meta2
});
init_react();
var import_remix34 = __toModule(require_remix());
async function loader19({ params }) {
  let { username } = params;
  if (username === "mjijackson") {
    return (0, import_remix34.redirect)("/gists/mjackson", 302);
  }
  if (username === "_why") {
    return (0, import_remix34.json)(null, { status: 404 });
  }
  if (false) {
    return fakeGists;
  }
  let response = await fetch(`https://api.github.com/users/${username}/gists`);
  return (0, import_remix34.json)(await response.json(), {
    headers: {
      "Cache-Control": response.headers.get("Cache-Control")
    }
  });
}
function headers3() {
  return {
    "Cache-Control": "public, max-age=300"
  };
}
function meta2({ data, params }) {
  let { username } = params;
  return {
    title: data ? `${data.length} gists from ${username}` : `User ${username} not found`,
    description: `View all of the gists from ${username}`
  };
}
var handle4 = {
  breadcrumb: ({ params }) => /* @__PURE__ */ React.createElement(import_remix34.Link, {
    to: `gists/${params.username}`
  }, params.username)
};
function UserGists() {
  let { username } = (0, import_remix34.useParams)();
  let data = (0, import_remix34.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/gists/$username"
  }, data ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h2", null, "All gists from ", username), /* @__PURE__ */ React.createElement("ul", null, data.map((gist) => /* @__PURE__ */ React.createElement("li", {
    key: gist.id
  }, /* @__PURE__ */ React.createElement("a", {
    href: gist.html_url
  }, Object.keys(gist.files)[0]))))) : /* @__PURE__ */ React.createElement("h2", null, "No gists for ", username));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/gists/index.jsx
var gists_exports2 = {};
__export(gists_exports2, {
  default: () => GistsIndex,
  handle: () => handle5,
  headers: () => headers4,
  loader: () => loader20,
  meta: () => meta3
});
init_react();
var import_remix35 = __toModule(require_remix());
var fakeGists = [
  {
    url: "https://api.github.com/gists/610613b54e5b34f8122d1ba4a3da21a9",
    id: "610613b54e5b34f8122d1ba4a3da21a9",
    files: {
      "remix-server.jsx": {
        filename: "remix-server.jsx"
      }
    },
    owner: {
      login: "ryanflorence",
      id: 100200,
      avatar_url: "https://avatars0.githubusercontent.com/u/100200?v=4"
    }
  }
];
async function loader20() {
  if (true) {
    return Promise.resolve(fakeGists);
  }
  let res = await fetch(`https://api.github.com/gists`);
  return res.json();
}
function headers4() {
  return {
    "Cache-Control": "public, max-age=60"
  };
}
function meta3() {
  return {
    title: "Public Gists",
    description: "View the latest gists from the public"
  };
}
var handle5 = {
  breadcrumb: () => /* @__PURE__ */ React.createElement("span", null, "Public")
};
function GistsIndex() {
  let data = (0, import_remix35.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/gists/index"
  }, /* @__PURE__ */ React.createElement("h2", null, "Public Gists"), /* @__PURE__ */ React.createElement("ul", null, data.map((gist) => /* @__PURE__ */ React.createElement("li", {
    key: gist.id,
    style: { display: "flex", alignItems: "center" }
  }, /* @__PURE__ */ React.createElement("img", {
    src: gist.owner.avatar_url,
    style: { height: 36, margin: "0.25rem 0.5rem 0.25rem 0" },
    alt: "avatar"
  }), /* @__PURE__ */ React.createElement("a", {
    href: gist.html_url
  }, Object.keys(gist.files)[0])))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/index.jsx
var routes_exports = {};
__export(routes_exports, {
  default: () => Index,
  headers: () => headers5,
  loader: () => loader21,
  meta: () => meta4
});
init_react();
var import_react4 = __toModule(require("react"));
var import_remix36 = __toModule(require_remix());
var import_message = __toModule(require_message());

// app/scripts/message.server.js
init_react();
var message = "I'm on the server";

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/index.jsx
function meta4() {
  return {
    title: "Gists Fixture App",
    description: "We're just tryin' to make sure stuff works, ya know?!"
  };
}
function loader21() {
  if (true) {
    console.log(message);
  }
  return null;
}
function headers5() {
  return {
    test: "value"
  };
}
function Index() {
  (0, import_react4.useEffect)(() => {
    console.log(import_message.message);
  }, []);
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/"
  }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h1", null, "Cool Gists App")), /* @__PURE__ */ React.createElement("nav", null, /* @__PURE__ */ React.createElement("ul", null, /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    prefetch: "intent",
    to: "/links"
  }, "Link preloads and stuff")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/gists"
  }, "View Some gists")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/gists/mjackson"
  }, "View Michael's gists")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/gists/mjijackson"
  }, "Loader Redirect")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/fart"
  }, "Broken link")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/methods"
  }, "Forms")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/actions"
  }, "Actions")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/fetchers"
  }, "Fetchers")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/loader-errors?throw"
  }, "Loader error with no ErrorBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/loader-errors?catch"
  }, "Loader throws Response with no CatchBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/loader-errors/nested"
  }, "Loader error in nested route with ErrorBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/loader-errors/nested-catch"
  }, "Loader error in nested route with CatchBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/render-errors?throw"
  }, "Render error with no ErrorBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/render-errors/nested"
  }, "Render error in nested route with ErrorBoundary")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/multiple-set-cookies"
  }, "Multiple Set Cookie Headers")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "prefs"
  }, "Preferences")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall/flat"
  }, "Catchall flat")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall/flat/sub"
  }, "Catchall flat subroute")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall-nested"
  }, "Catchall with layout index takes precedence")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall-nested/sub"
  }, "Catchall with layout splat")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall-nested-no-layout"
  }, "Catchall without layout")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/catchall-nested-no-layout/sub"
  }, "Catchall without layout splat")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/with-layout"
  }, "Route with _layout")), /* @__PURE__ */ React.createElement("li", null, /* @__PURE__ */ React.createElement(import_remix36.Link, {
    to: "/resources"
  }, "Resource routes")))), /* @__PURE__ */ React.createElement(Shared, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/links.tsx
var links_exports = {};
__export(links_exports, {
  default: () => LinksPage,
  links: () => links5,
  loader: () => loader22
});
init_react();
var import_remix37 = __toModule(require_remix());

// app/styles/redText.css
var redText_default = "/build/_assets/redText-FRCIGV4H.css";

// app/styles/blueText.css
var blueText_default = "/build/_assets/blueText-IH5VWOWJ.css";

// app/components/guitar.jpg
var guitar_default = "/build/_assets/guitar-7G45WLHK.jpg";

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/links.tsx
var loader22 = () => {
  return [
    { name: "Michael Jackson", id: "mjackson" },
    { name: "Ryan Florence", id: "ryanflorence" }
  ];
};
var links5 = () => {
  let styleLink = { rel: "stylesheet", href: redText_default };
  let nonMatching = {
    rel: "stylesheet",
    href: blueText_default,
    media: "(prefers-color-scheme: beef)"
  };
  let fails = { rel: "stylesheet", href: "/fails.css" };
  let pageLink = { page: `/gists/mjackson` };
  let preloadGuitar = { rel: "preload", as: "image", href: guitar_default };
  return [styleLink, nonMatching, fails, pageLink, preloadGuitar];
};
function LinksPage() {
  let users = (0, import_remix37.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/links"
  }, /* @__PURE__ */ React.createElement("h2", null, "Links Page"), users.map((user) => /* @__PURE__ */ React.createElement("li", {
    key: user.id
  }, /* @__PURE__ */ React.createElement(import_remix37.Link, {
    to: `/gists/${user.id}`,
    prefetch: "none"
  }, user.name))), /* @__PURE__ */ React.createElement("hr", null), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("img", {
    alt: "a guitar",
    src: guitar_default,
    "data-test-id": "blocked"
  }), " Prefetched because it's a preload."));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/prefs.tsx
var prefs_exports = {};
__export(prefs_exports, {
  action: () => action16,
  default: () => UserPrefs,
  handle: () => handle6,
  loader: () => loader23,
  meta: () => meta5
});
init_react();
var import_remix39 = __toModule(require_remix());

// app/cookies.ts
init_react();
var import_remix38 = __toModule(require_remix());
var userPrefsCookie = (0, import_remix38.createCookie)("user-prefs", {
  path: "/",
  httpOnly: false
});

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/prefs.tsx
async function getUserPrefs(cookieHeader) {
  return await userPrefsCookie.parse(cookieHeader) || {
    language: null,
    showBanner: true
  };
}
function setUserPrefs(userPrefs) {
  return userPrefsCookie.serialize(userPrefs);
}
var meta5 = () => {
  return { title: "User Preferences" };
};
var loader23 = async ({ request }) => {
  return getUserPrefs(request.headers.get("Cookie"));
};
var action16 = async ({ request }) => {
  let userPrefs = await getUserPrefs(request.headers.get("Cookie"));
  let formParams = new URLSearchParams(await request.text());
  if (formParams.has("language")) {
    userPrefs.language = formParams.get("language");
  }
  userPrefs.showBanner = formParams.get("showBanner") === "on";
  return (0, import_remix39.redirect)("/prefs", {
    headers: {
      "Set-Cookie": await setUserPrefs(userPrefs)
    }
  });
};
var handle6 = {
  breadcrumb: () => /* @__PURE__ */ React.createElement(import_remix39.Link, {
    to: "/prefs"
  }, "Preferences")
};
function UserPrefs() {
  let userPrefs = (0, import_remix39.useLoaderData)();
  let submit = (0, import_remix39.useSubmit)();
  function handleChange(event) {
    submit(event.currentTarget, { replace: true });
  }
  function handleClick(event) {
    submit(event.currentTarget, { replace: true });
  }
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h1", null, "User Preferences")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(import_remix39.Form, {
    method: "post",
    replace: true,
    onChange: handleChange
  }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", null, "Language:", " ", /* @__PURE__ */ React.createElement("select", {
    name: "language",
    defaultValue: userPrefs.language || typeof navigator !== "undefined" && navigator.language
  }, /* @__PURE__ */ React.createElement("option", {
    value: "en-US"
  }, "English (US)"), /* @__PURE__ */ React.createElement("option", {
    value: "en-GB"
  }, "English (GB)"), /* @__PURE__ */ React.createElement("option", {
    value: "it-IT"
  }, "Italian"), /* @__PURE__ */ React.createElement("option", {
    value: "es-ES"
  }, "Spanish"), /* @__PURE__ */ React.createElement("option", {
    value: "fr-FR"
  }, "French"), /* @__PURE__ */ React.createElement("option", {
    value: "zh-CN"
  }, "Chinese")))), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", null, "Show banner:", " ", /* @__PURE__ */ React.createElement("input", {
    type: "checkbox",
    name: "showBanner",
    defaultChecked: userPrefs.showBanner
  }))), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("label", null, "Banner:", " ", /* @__PURE__ */ React.createElement("button", {
    type: "button",
    onClick: handleClick,
    name: "showBanner",
    value: "on"
  }, "Show"), " ", /* @__PURE__ */ React.createElement("button", {
    type: "button",
    onClick: handleClick,
    name: "showBanner",
    value: "off"
  }, "Hide"))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("pre", null, JSON.stringify(userPrefs, null, 2))));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog.tsx
var blog_exports = {};
__export(blog_exports, {
  default: () => BlogLayout,
  handle: () => handle7,
  links: () => links6
});
init_react();
var import_remix40 = __toModule(require_remix());
var links6 = () => [
  {
    rel: "stylesheet",
    href: "https://unpkg.com/@highlightjs/cdn-assets@11.2.0/styles/a11y-dark.min.css"
  }
];
var handle7 = {
  breadcrumb: () => /* @__PURE__ */ React.createElement(import_remix40.Link, {
    to: "/blog"
  }, "Blog")
};
function BlogLayout() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(import_remix40.Outlet, null), /* @__PURE__ */ React.createElement(Shared, null));
}

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/hello-world.mdx
var hello_world_exports = {};
__export(hello_world_exports, {
  attributes: () => attributes,
  default: () => hello_world_default,
  filename: () => filename,
  headers: () => headers6,
  links: () => links7,
  meta: () => meta6
});
init_react();
var import_react6 = __toModule(require("react"));

// app/components/Counter.js
init_react();
var import_react5 = __toModule(require("react"));
function Counter() {
  let [count, setCount] = (0, import_react5.useState)(0);
  return /* @__PURE__ */ React.createElement("button", {
    "data-test-id": "counter-button",
    onClick: () => setCount(count + 1)
  }, `Clicked ${count}`);
}

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/hello-world.mdx
var attributes = {
  "meta": {
    "title": "Hello, World!",
    "description": "Isn't this fantastic?!?!?!"
  },
  "headers": {
    "Cache-Control": "public, max-age=0, must-revalidate"
  },
  "message": "Hello World!"
};
function MDXContent(props = {}) {
  const _components = Object.assign({
    h1: "h1",
    p: "p",
    h2: "h2",
    ul: "ul",
    li: "li",
    a: "a",
    pre: "pre",
    code: "code",
    span: "span"
  }, props.components), { wrapper: MDXLayout } = _components;
  const _content = /* @__PURE__ */ import_react6.default.createElement(import_react6.default.Fragment, null, /* @__PURE__ */ import_react6.default.createElement(_components.h1, null, "Hello Blog!"), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.p, null, "I am a MDX page. This is a message from frontmatter: ", attributes.message), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.h2, null, "Table of Contents"), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.ul, null, "\n", /* @__PURE__ */ import_react6.default.createElement(_components.li, null, /* @__PURE__ */ import_react6.default.createElement(_components.a, {
    href: "#stateful-jsx-component"
  }, "Stateful JSX Component")), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.li, null, /* @__PURE__ */ import_react6.default.createElement(_components.a, {
    href: "#rehype-plugin-syntax-highlighting"
  }, "Rehype Plugin Syntax Highlighting")), "\n"), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.h2, null, "Stateful JSX Component"), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.p, null, "This is stateful:"), "\n", /* @__PURE__ */ import_react6.default.createElement(Counter, null), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.h2, null, "Rehype Plugin Syntax Highlighting"), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.p, null, "Here's a code block."), "\n", /* @__PURE__ */ import_react6.default.createElement(_components.pre, null, /* @__PURE__ */ import_react6.default.createElement(_components.code, {
    className: "hljs language-js"
  }, /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "export"), " ", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "default"), " ", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "function"), " ", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-title hljs-function"
  }, "PageOne"), "(", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-params"
  }), ") {\n  ", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "return"), " ", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "xml"
  }, /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "<", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">"), "Page One", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "</", /* @__PURE__ */ import_react6.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">")), ";\n}\n")));
  return MDXLayout ? /* @__PURE__ */ import_react6.default.createElement(MDXLayout, __spreadValues({}, props), _content) : _content;
}
var hello_world_default = MDXContent;
var filename = "hello-world.mdx";
var headers6 = typeof attributes !== "undefined" && attributes.headers;
var meta6 = typeof attributes !== "undefined" && attributes.meta;
var links7 = void 0;

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/second.md
var second_exports = {};
__export(second_exports, {
  attributes: () => attributes2,
  default: () => second_default,
  filename: () => filename2,
  headers: () => headers7,
  links: () => links8,
  meta: () => meta7
});
init_react();
var import_react7 = __toModule(require("react"));
var attributes2 = {
  "meta": {
    "title": "Second post",
    "description": "Isn't this fantastic?!?!?!"
  },
  "headers": {
    "Cache-Control": "public, max-age=0, must-revalidate"
  }
};
function MDXContent2(props = {}) {
  const _components = Object.assign({
    h1: "h1",
    p: "p",
    pre: "pre",
    code: "code",
    span: "span"
  }, props.components), { wrapper: MDXLayout } = _components;
  const _content = /* @__PURE__ */ import_react7.default.createElement(import_react7.default.Fragment, null, /* @__PURE__ */ import_react7.default.createElement(_components.h1, null, "Second Post!"), "\n", /* @__PURE__ */ import_react7.default.createElement(_components.p, null, "I am a Markdown page."), "\n", /* @__PURE__ */ import_react7.default.createElement(_components.p, null, "Here's a code block."), "\n", /* @__PURE__ */ import_react7.default.createElement(_components.pre, null, /* @__PURE__ */ import_react7.default.createElement(_components.code, {
    className: "hljs language-jsx"
  }, /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "export"), " ", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "default"), " ", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "function"), " ", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-title hljs-function"
  }, "PageOne"), "(", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-params"
  }), ") {\n  ", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "return"), " ", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "xml"
  }, /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "<", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">"), "Page One", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "</", /* @__PURE__ */ import_react7.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">")), ";\n}\n")));
  return MDXLayout ? /* @__PURE__ */ import_react7.default.createElement(MDXLayout, __spreadValues({}, props), _content) : _content;
}
var second_default = MDXContent2;
var filename2 = "second.md";
var headers7 = typeof attributes2 !== "undefined" && attributes2.headers;
var meta7 = typeof attributes2 !== "undefined" && attributes2.meta;
var links8 = void 0;

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/index.tsx
var blog_exports2 = {};
__export(blog_exports2, {
  default: () => BlogPosts,
  headers: () => headers9,
  links: () => links10,
  loader: () => loader24
});
init_react();
var import_remix41 = __toModule(require_remix());

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/third.md
var third_exports = {};
__export(third_exports, {
  attributes: () => attributes3,
  default: () => third_default,
  filename: () => filename3,
  headers: () => headers8,
  links: () => links9,
  meta: () => meta8
});
init_react();
var import_react8 = __toModule(require("react"));
var attributes3 = {
  "meta": {
    "title": "Third post",
    "description": "Isn't this fantastic?!?!?!"
  },
  "headers": {
    "Cache-Control": "public, max-age=0, must-revalidate"
  }
};
function MDXContent3(props = {}) {
  const _components = Object.assign({
    h1: "h1",
    p: "p",
    pre: "pre",
    code: "code",
    span: "span"
  }, props.components), { wrapper: MDXLayout } = _components;
  const _content = /* @__PURE__ */ import_react8.default.createElement(import_react8.default.Fragment, null, /* @__PURE__ */ import_react8.default.createElement(_components.h1, null, "Third Post!"), "\n", /* @__PURE__ */ import_react8.default.createElement(_components.p, null, "I am a Markdown page."), "\n", /* @__PURE__ */ import_react8.default.createElement(_components.p, null, "Here's a code block."), "\n", /* @__PURE__ */ import_react8.default.createElement(_components.pre, null, /* @__PURE__ */ import_react8.default.createElement(_components.code, {
    className: "hljs language-jsx"
  }, /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "export"), " ", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "default"), " ", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "function"), " ", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-title hljs-function"
  }, "PageOne"), "(", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-params"
  }), ") {\n  ", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "return"), " ", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "xml"
  }, /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "<", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">"), "Page One", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "</", /* @__PURE__ */ import_react8.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">")), ";\n}\n")));
  return MDXLayout ? /* @__PURE__ */ import_react8.default.createElement(MDXLayout, __spreadValues({}, props), _content) : _content;
}
var third_default = MDXContent3;
var filename3 = "third.md";
var headers8 = typeof attributes3 !== "undefined" && attributes3.headers;
var meta8 = typeof attributes3 !== "undefined" && attributes3.meta;
var links9 = void 0;

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/blog/index.tsx
function postFromModule(mod) {
  return __spreadValues({
    slug: mod.filename.replace(/\.mdx?$/, "")
  }, mod.attributes.meta);
}
var loader24 = () => {
  let data = {
    posts: [
      postFromModule(hello_world_exports),
      postFromModule(second_exports),
      postFromModule(third_exports)
    ]
  };
  return (0, import_remix41.json)(data, {
    headers: {
      "Cache-Control": "public, max-age=60"
    }
  });
};
var links10 = () => {
  return [{ rel: "stylesheet", href: gists_default }];
};
var headers9 = ({ loaderHeaders }) => {
  return {
    "Cache-Control": loaderHeaders.get("Cache-Control")
  };
};
function BlogPosts() {
  let locationPending = (0, import_remix41.useTransition)().location;
  let { posts } = (0, import_remix41.useLoaderData)();
  return /* @__PURE__ */ React.createElement("div", {
    "data-test-id": "/blog"
  }, /* @__PURE__ */ React.createElement("main", null, /* @__PURE__ */ React.createElement("h1", null, "Blog Posts"), /* @__PURE__ */ React.createElement("ul", null, posts.map((post) => /* @__PURE__ */ React.createElement("li", {
    key: post.slug
  }, /* @__PURE__ */ React.createElement(import_remix41.Link, {
    to: post.slug,
    className: "text-blue-700 underline"
  }, post.title, " ", locationPending ? "..." : null))))));
}

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/one.mdx
var one_exports = {};
__export(one_exports, {
  attributes: () => attributes4,
  default: () => one_default,
  filename: () => filename4,
  headers: () => headers10,
  links: () => links11,
  meta: () => meta9
});
init_react();
var import_react9 = __toModule(require("react"));
var attributes4 = {
  "headers": {
    "cache-control": "public, max-age=0, must-revalidate"
  },
  "meta": {
    "title": "This is page one with a counter",
    "description": "Fantastic"
  },
  "name": "World!"
};
function MDXContent4(props = {}) {
  const _components = Object.assign({
    h1: "h1",
    p: "p",
    pre: "pre",
    code: "code",
    span: "span"
  }, props.components), { wrapper: MDXLayout } = _components;
  const _content = /* @__PURE__ */ import_react9.default.createElement(import_react9.default.Fragment, null, /* @__PURE__ */ import_react9.default.createElement(_components.h1, null, "Page One"), "\n", /* @__PURE__ */ import_react9.default.createElement(_components.p, null, "I am a page. Hello, ", attributes4.name), "\n", /* @__PURE__ */ import_react9.default.createElement(_components.p, null, "This is stateful:"), "\n", /* @__PURE__ */ import_react9.default.createElement(Counter, null), "\n", /* @__PURE__ */ import_react9.default.createElement(_components.p, null, "Here's a code block."), "\n", /* @__PURE__ */ import_react9.default.createElement(_components.pre, null, /* @__PURE__ */ import_react9.default.createElement(_components.code, {
    className: "hljs language-jsx"
  }, /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "export"), " ", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "default"), " ", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "function"), " ", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-title hljs-function"
  }, "PageOne"), "(", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-params"
  }), ") {\n  ", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "return"), " ", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "xml"
  }, /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "<", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">"), "Page One", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "</", /* @__PURE__ */ import_react9.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">")), ";\n}\n")));
  return MDXLayout ? /* @__PURE__ */ import_react9.default.createElement(MDXLayout, __spreadValues({}, props), _content) : _content;
}
var one_default = MDXContent4;
var filename4 = "one.mdx";
var headers10 = typeof attributes4 !== "undefined" && attributes4.headers;
var meta9 = typeof attributes4 !== "undefined" && attributes4.meta;
var links11 = void 0;

// mdx:/Users/abereghici/Development/remix/fixtures/gists-app/app/routes/two.md
var two_exports = {};
__export(two_exports, {
  attributes: () => attributes5,
  default: () => two_default,
  filename: () => filename5,
  headers: () => headers11,
  links: () => links12,
  meta: () => meta10
});
init_react();
var import_react10 = __toModule(require("react"));
var attributes5 = {
  "meta": {
    "title": "Page two",
    "description": "Fantastic"
  }
};
function MDXContent5(props = {}) {
  const _components = Object.assign({
    h1: "h1",
    p: "p",
    pre: "pre",
    code: "code",
    span: "span"
  }, props.components), { wrapper: MDXLayout } = _components;
  const _content = /* @__PURE__ */ import_react10.default.createElement(import_react10.default.Fragment, null, /* @__PURE__ */ import_react10.default.createElement(_components.h1, null, "Page Two"), "\n", /* @__PURE__ */ import_react10.default.createElement(_components.p, null, "I am a page."), "\n", /* @__PURE__ */ import_react10.default.createElement(_components.p, null, "Here's a code block."), "\n", /* @__PURE__ */ import_react10.default.createElement(_components.pre, null, /* @__PURE__ */ import_react10.default.createElement(_components.code, {
    className: "hljs language-jsx"
  }, /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "export"), " ", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "default"), " ", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "function"), " ", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-title hljs-function"
  }, "PageOne"), "(", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-params"
  }), ") {\n  ", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-keyword"
  }, "return"), " ", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "xml"
  }, /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "<", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">"), "Page One", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-tag"
  }, "</", /* @__PURE__ */ import_react10.default.createElement(_components.span, {
    className: "hljs-name"
  }, "div"), ">")), ";\n}\n")));
  return MDXLayout ? /* @__PURE__ */ import_react10.default.createElement(MDXLayout, __spreadValues({}, props), _content) : _content;
}
var two_default = MDXContent5;
var filename5 = "two.md";
var headers11 = typeof attributes5 !== "undefined" && attributes5.headers;
var meta10 = typeof attributes5 !== "undefined" && attributes5.meta;
var links12 = void 0;

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/pages/child.jsx
var child_exports = {};
__export(child_exports, {
  default: () => Test
});
init_react();
function Test() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Child"));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/pages/four.jsx
var four_exports = {};
__export(four_exports, {
  default: () => Page
});
init_react();
function Page() {
  return /* @__PURE__ */ React.createElement("p", null, "This is page four");
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/pages/test.jsx
var test_exports = {};
__export(test_exports, {
  default: () => Test2
});
init_react();
var import_remix42 = __toModule(require_remix());
function Test2() {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "Shell"), /* @__PURE__ */ React.createElement(import_remix42.Outlet, null));
}

// route-module:/Users/abereghici/Development/remix/fixtures/gists-app/app/pages/three.jsx
var three_exports = {};
__export(three_exports, {
  default: () => Page2
});
init_react();
function Page2() {
  return /* @__PURE__ */ React.createElement("p", null, "This is page three");
}

// <stdin>
var import_assets = __toModule(require("./assets.json"));
var entry = { module: entry_server_exports };
var routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: root_exports
  },
  "routes/action-catches-from-loader-self-boundary": {
    id: "routes/action-catches-from-loader-self-boundary",
    parentId: "root",
    path: "action-catches-from-loader-self-boundary",
    index: void 0,
    caseSensitive: void 0,
    module: action_catches_from_loader_self_boundary_exports
  },
  "routes/action-catches-self-boundary": {
    id: "routes/action-catches-self-boundary",
    parentId: "root",
    path: "action-catches-self-boundary",
    index: void 0,
    caseSensitive: void 0,
    module: action_catches_self_boundary_exports
  },
  "routes/action-errors-self-boundary": {
    id: "routes/action-errors-self-boundary",
    parentId: "root",
    path: "action-errors-self-boundary",
    index: void 0,
    caseSensitive: void 0,
    module: action_errors_self_boundary_exports
  },
  "routes/catchall-nested-no-layout/$": {
    id: "routes/catchall-nested-no-layout/$",
    parentId: "root",
    path: "catchall-nested-no-layout/*",
    index: void 0,
    caseSensitive: void 0,
    module: __exports
  },
  "routes/action-catches-from-loader": {
    id: "routes/action-catches-from-loader",
    parentId: "root",
    path: "action-catches-from-loader",
    index: void 0,
    caseSensitive: void 0,
    module: action_catches_from_loader_exports
  },
  "routes/multiple-set-cookies": {
    id: "routes/multiple-set-cookies",
    parentId: "root",
    path: "multiple-set-cookies",
    index: void 0,
    caseSensitive: void 0,
    module: multiple_set_cookies_exports
  },
  "routes/resources/theme-css": {
    id: "routes/resources/theme-css",
    parentId: "root",
    path: "resources/theme-css",
    index: void 0,
    caseSensitive: void 0,
    module: theme_css_exports
  },
  "routes/resources/redirect": {
    id: "routes/resources/redirect",
    parentId: "root",
    path: "resources/redirect",
    index: void 0,
    caseSensitive: void 0,
    module: redirect_exports
  },
  "routes/resources/settings": {
    id: "routes/resources/settings",
    parentId: "root",
    path: "resources/settings",
    index: void 0,
    caseSensitive: void 0,
    module: settings_exports
  },
  "routes/catchall-nested": {
    id: "routes/catchall-nested",
    parentId: "root",
    path: "catchall-nested",
    index: void 0,
    caseSensitive: void 0,
    module: catchall_nested_exports
  },
  "routes/catchall-nested/index": {
    id: "routes/catchall-nested/index",
    parentId: "routes/catchall-nested",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: catchall_nested_exports2
  },
  "routes/catchall-nested/$": {
    id: "routes/catchall-nested/$",
    parentId: "routes/catchall-nested",
    path: "*",
    index: void 0,
    caseSensitive: void 0,
    module: __exports2
  },
  "routes/catchall.flat.$": {
    id: "routes/catchall.flat.$",
    parentId: "root",
    path: "catchall/flat/*",
    index: void 0,
    caseSensitive: void 0,
    module: catchall_flat_exports
  },
  "routes/redirects/login": {
    id: "routes/redirects/login",
    parentId: "root",
    path: "redirects/login",
    index: void 0,
    caseSensitive: void 0,
    module: login_exports
  },
  "routes/resources/index": {
    id: "routes/resources/index",
    parentId: "root",
    path: "resources",
    index: true,
    caseSensitive: void 0,
    module: resources_exports
  },
  "routes/action-catches": {
    id: "routes/action-catches",
    parentId: "root",
    path: "action-catches",
    index: void 0,
    caseSensitive: void 0,
    module: action_catches_exports
  },
  "routes/action-errors": {
    id: "routes/action-errors",
    parentId: "root",
    path: "action-errors",
    index: void 0,
    caseSensitive: void 0,
    module: action_errors_exports
  },
  "routes/loader-errors": {
    id: "routes/loader-errors",
    parentId: "root",
    path: "loader-errors",
    index: void 0,
    caseSensitive: void 0,
    module: loader_errors_exports
  },
  "routes/loader-errors/nested-catch": {
    id: "routes/loader-errors/nested-catch",
    parentId: "routes/loader-errors",
    path: "nested-catch",
    index: void 0,
    caseSensitive: void 0,
    module: nested_catch_exports
  },
  "routes/loader-errors/nested": {
    id: "routes/loader-errors/nested",
    parentId: "routes/loader-errors",
    path: "nested",
    index: void 0,
    caseSensitive: void 0,
    module: nested_exports
  },
  "routes/render-errors": {
    id: "routes/render-errors",
    parentId: "root",
    path: "render-errors",
    index: void 0,
    caseSensitive: void 0,
    module: render_errors_exports
  },
  "routes/render-errors/nested": {
    id: "routes/render-errors/nested",
    parentId: "routes/render-errors",
    path: "nested",
    index: void 0,
    caseSensitive: void 0,
    module: nested_exports2
  },
  "routes/nested-forms": {
    id: "routes/nested-forms",
    parentId: "root",
    path: "nested-forms",
    index: void 0,
    caseSensitive: void 0,
    module: nested_forms_exports
  },
  "routes/nested-forms/nested": {
    id: "routes/nested-forms/nested",
    parentId: "routes/nested-forms",
    path: "nested",
    index: void 0,
    caseSensitive: void 0,
    module: nested_exports3
  },
  "routes/nested-forms/nested/index": {
    id: "routes/nested-forms/nested/index",
    parentId: "routes/nested-forms/nested",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: nested_exports4
  },
  "routes/gists.mine": {
    id: "routes/gists.mine",
    parentId: "root",
    path: "gists/mine",
    index: void 0,
    caseSensitive: void 0,
    module: gists_mine_exports
  },
  "routes/__layout": {
    id: "routes/__layout",
    parentId: "root",
    path: void 0,
    index: void 0,
    caseSensitive: void 0,
    module: layout_exports
  },
  "routes/__layout/with-layout": {
    id: "routes/__layout/with-layout",
    parentId: "routes/__layout",
    path: "with-layout",
    index: void 0,
    caseSensitive: void 0,
    module: with_layout_exports
  },
  "routes/fetchers": {
    id: "routes/fetchers",
    parentId: "root",
    path: "fetchers",
    index: void 0,
    caseSensitive: void 0,
    module: fetchers_exports
  },
  "routes/actions": {
    id: "routes/actions",
    parentId: "root",
    path: "actions",
    index: void 0,
    caseSensitive: void 0,
    module: actions_exports
  },
  "routes/methods": {
    id: "routes/methods",
    parentId: "root",
    path: "methods",
    index: void 0,
    caseSensitive: void 0,
    module: methods_exports
  },
  "routes/empty": {
    id: "routes/empty",
    parentId: "root",
    path: "empty",
    index: void 0,
    caseSensitive: void 0,
    module: empty_exports
  },
  "routes/gists": {
    id: "routes/gists",
    parentId: "root",
    path: "gists",
    index: void 0,
    caseSensitive: void 0,
    module: gists_exports
  },
  "routes/gists/$username": {
    id: "routes/gists/$username",
    parentId: "routes/gists",
    path: ":username",
    index: void 0,
    caseSensitive: void 0,
    module: username_exports
  },
  "routes/gists/index": {
    id: "routes/gists/index",
    parentId: "routes/gists",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: gists_exports2
  },
  "routes/index": {
    id: "routes/index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: routes_exports
  },
  "routes/links": {
    id: "routes/links",
    parentId: "root",
    path: "links",
    index: void 0,
    caseSensitive: void 0,
    module: links_exports
  },
  "routes/prefs": {
    id: "routes/prefs",
    parentId: "root",
    path: "prefs",
    index: void 0,
    caseSensitive: void 0,
    module: prefs_exports
  },
  "routes/blog": {
    id: "routes/blog",
    parentId: "root",
    path: "blog",
    index: void 0,
    caseSensitive: void 0,
    module: blog_exports
  },
  "routes/blog/hello-world": {
    id: "routes/blog/hello-world",
    parentId: "routes/blog",
    path: "hello-world",
    index: void 0,
    caseSensitive: void 0,
    module: hello_world_exports
  },
  "routes/blog/second": {
    id: "routes/blog/second",
    parentId: "routes/blog",
    path: "second",
    index: void 0,
    caseSensitive: void 0,
    module: second_exports
  },
  "routes/blog/index": {
    id: "routes/blog/index",
    parentId: "routes/blog",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: blog_exports2
  },
  "routes/blog/third": {
    id: "routes/blog/third",
    parentId: "routes/blog",
    path: "third",
    index: void 0,
    caseSensitive: void 0,
    module: third_exports
  },
  "routes/one": {
    id: "routes/one",
    parentId: "root",
    path: "one",
    index: void 0,
    caseSensitive: void 0,
    module: one_exports
  },
  "routes/two": {
    id: "routes/two",
    parentId: "root",
    path: "two",
    index: void 0,
    caseSensitive: void 0,
    module: two_exports
  },
  "pages/child": {
    id: "pages/child",
    parentId: "pages/test",
    path: ":messageId",
    index: void 0,
    caseSensitive: void 0,
    module: child_exports
  },
  "pages/four": {
    id: "pages/four",
    parentId: "root",
    path: "/page/four",
    index: void 0,
    caseSensitive: void 0,
    module: four_exports
  },
  "pages/test": {
    id: "pages/test",
    parentId: "root",
    path: "programmatic",
    index: void 0,
    caseSensitive: void 0,
    module: test_exports
  },
  "pages/three": {
    id: "pages/three",
    parentId: "root",
    path: "/page/three",
    index: void 0,
    caseSensitive: void 0,
    module: three_exports
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  assets,
  entry,
  routes
});
/**
 * @remix-run/node v1.1.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * @remix-run/react v1.1.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * @remix-run/server-runtime v1.1.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
/**
 * remix v1.1.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */
